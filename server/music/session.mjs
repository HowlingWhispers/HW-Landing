import { describeMissingDevice, selectDevice } from './devices.mjs';

// Provider-neutral playback dispatch. This file knows how to fan an action out to
// the listeners who opted in; it knows nothing about any provider's endpoints.
//
// Two invariants drive the design:
//   1. A listener's own account is the only thing we ever act on. Every call is
//      made with that listener's sealed token, and the roster is re-read at
//      dispatch time, so leaving or disconnecting mid-session simply removes them.
//   2. One listener's failure is never the room's failure. Each listener is
//      attempted independently and the outcome is reported per listener, so a
//      single 429, dead device, or revoked token cannot abort the fan-out or
//      affect anyone else's playback.
const TRANSPORT = new Set(['pause', 'resume', 'skip']);
const NEEDS_LISTENERS = new Set(['play', 'pause', 'resume', 'skip', 'queue']);

export class MusicDispatchError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}

function reasonText(reason, adapter) {
  switch (reason) {
    case 'no_listeners': return 'Nobody is opted in to shared listening in this room yet.';
    case 'not_opted_in': return 'Join shared listening for this room first. You can still ask for a track for everyone else.';
    case 'not_connected': return 'Connect a music account in this room’s music settings first.';
    case 'reconnect_required': return 'Your music authorization expired. Reconnect it to keep listening together.';
    case 'no_device': return describeMissingDevice(adapter, 'none');
    case 'device_ambiguous': return describeMissingDevice(adapter, 'ambiguous');
    case 'device_missing': return describeMissingDevice(adapter, 'missing');
    case 'device_restricted': return describeMissingDevice(adapter, 'restricted');
    case 'rate_limited': return 'The music service is rate limiting this room right now. Try again in a moment.';
    case 'forbidden': return 'The music service refused that. Shared playback usually needs a Premium account on each listener’s account.';
    case 'unauthorized': return 'A listener’s music authorization was rejected and must be reconnected.';
    case 'not_found': return 'That music service could not find what was asked for.';
    case 'unsupported': return 'That music service cannot do that yet.';
    default: return 'The music service could not complete that.';
  }
}

// Maps a provider error onto a stable reason plus a member-readable sentence.
// Unknown errors stay generic on purpose: provider messages are not shown raw.
function classify(error) {
  const kind = error?.kind || null;
  if (kind === 'invalid_grant' || kind === 'unauthorized') return 'unauthorized';
  if (kind === 'rate_limited') return 'rate_limited';
  if (kind === 'forbidden') return 'forbidden';
  if (kind === 'not_found') return 'not_found';
  if (kind === 'no_device') return 'no_device';
  if (error?.status === 409) return 'not_connected';
  return 'failed';
}

export function createMusicSession({ music, store, config, fetchImpl = fetch }) {
  // Room session record. This exists so drift correction can be added later
  // without changing the dispatch path: we already record what was started, on
  // which recording, and when.
  const sessionOf = room => store.get('SELECT * FROM music_sessions WHERE room=?', room);
  function recordSession(room, providerId, patch) {
    store.saveMusicSession({ room, provider: providerId, ...patch });
  }

  // Common gate for every listener: a usable token, and still opted in right now.
  // Returning a ready connection rather than a bare ok means the caller can make
  // exactly one provider call per listener.
  async function authorizeListener(entry, providerId, intent) {
    const adapter = music.provider(providerId);
    const failure = reason => ({ ok: false, user: entry.user, reason, detail: null });
    let ready;
    try {
      ready = await music.freshConnection(entry.user, providerId);
    } catch (error) {
      const reason = error.message.includes('expired') ? 'reconnect_required'
        : error.message.includes('Connect') ? 'not_connected'
          : classify(error);
      return { failed: failure(reason) };
    }
    // A listener who left between the roster read and now must not be touched.
    if (!store.get('SELECT 1 FROM music_optin WHERE room=? AND user=? AND provider=?', intent.room, entry.user, providerId)) {
      return { failed: { ...failure('left'), detail: 'No longer opted in.' } };
    }
    return { adapter, connection: ready.connection, deviceId: entry.device_hint || null };
  }

  // Playback command for one listener. Exactly one provider call is made.
  async function commandListener(entry, providerId, intent) {
    const gate = await authorizeListener(entry, providerId, intent);
    if (gate.failed) return gate.failed;
    const { adapter, connection } = gate;
    let deviceId = gate.deviceId;
    if (intent.action === 'play') {
      // Only a fresh start needs a device; transport acts on whatever is live.
      let devices;
      try { devices = await adapter.devices({ connection, credentials: music.resolveCredentials(entry.user, providerId), fetchImpl }); }
      catch (error) { return { ok: false, user: entry.user, reason: classify(error), detail: error.message }; }
      const selection = selectDevice(devices, deviceId);
      if (!selection.device) {
        return {
          ok: false, user: entry.user,
          reason: { ambiguous: 'device_ambiguous', missing: 'device_missing', restricted: 'device_restricted' }[selection.reason] || 'no_device',
          detail: describeMissingDevice(adapter, selection.reason),
        };
      }
      deviceId = selection.device.id;
    }
    try {
      const call = { connection, credentials: music.resolveCredentials(entry.user, providerId), fetchImpl, deviceId };
      switch (intent.action) {
        case 'play': await adapter.play({ ...call, track: intent.track, positionMs: intent.positionMs || 0 }); break;
        case 'pause': await adapter.pause(call); break;
        case 'resume': await adapter.resume(call); break;
        case 'skip': await adapter.skip(call); break;
        case 'queue': await adapter.queue({ ...call, track: intent.track }); break;
        default: return { ok: false, user: entry.user, reason: 'unsupported', detail: null };
      }
      return { ok: true, user: entry.user, reason: null, detail: null };
    } catch (error) {
      return { ok: false, user: entry.user, reason: classify(error), detail: error.message };
    }
  }

  // Read-only report for one listener. Never mutates playback.
  async function reportListener(entry, providerId, intent) {
    const gate = await authorizeListener(entry, providerId, intent);
    if (gate.failed) return gate.failed;
    try {
      const state = await gate.adapter.nowPlaying({ connection: gate.connection, credentials: music.resolveCredentials(entry.user, providerId), fetchImpl });
      return { ok: true, user: entry.user, reason: null, detail: null, state };
    } catch (error) {
      return { ok: false, user: entry.user, reason: classify(error), detail: error.message };
    }
  }

  async function dispatch({ room, providerId, requester, action, query, track = null }) {
    const adapter = music.provider(providerId);
    if (!adapter) throw new MusicDispatchError('unsupported', 'That music service is not available.');
    // A provider must declare the capability. An undeclared action is refused
    // before any call, so an adapter can never be driven into a request it has
    // not implemented.
    const declared = adapter.capabilities || {};
    if (!declared[action]) throw new MusicDispatchError('unsupported', `${adapter.label} cannot do that on this server yet.`);

    const listeners = music.connectedUsers(room, providerId);

    // Permission matrix, unchanged from the design: asking for a track is
    // allowed for anyone in the room, because it plays for the listeners who
    // opted in. Controlling transport requires being one of them.
    if (TRANSPORT.has(action) && !listeners.some(entry => entry.user === requester)) {
      throw new MusicDispatchError('not_opted_in', reasonText('not_opted_in', adapter));
    }
    if (NEEDS_LISTENERS.has(action) && !listeners.length) {
      throw new MusicDispatchError('no_listeners', reasonText('no_listeners', adapter));
    }

    // now_playing is a report, not a command: it must never mutate playback.
    if (action === 'now_playing') {
      if (!listeners.length) return { action, track: null, state: 'none', listeners: [], message: reasonText('no_listeners', adapter) };
      const reports = await Promise.all(listeners.map(entry => reportListener(entry, providerId, { room, action: 'now_playing' })));
      const playing = reports.filter(report => report.ok && report.state?.track).map(report => report.state.track);
      const results = reports.map(({ state, ...rest }) => rest);
      const first = playing[0] || null;
      // We only claim "unknown" when we could not read anybody. If every
      // readable listener reports nothing, that is a known answer.
      if (first) return { action, state: 'playing', track: first, listeners: summarize(results), message: null };
      const readable = reports.filter(report => report.ok).length;
      return {
        action, state: readable ? 'none' : 'unknown', track: null, listeners: summarize(results),
        message: readable ? 'Nothing is playing for the room right now.' : 'Coda could not read what the room is playing right now.',
      };
    }

    // Resolution happens once, before fan-out, so every listener gets the same
    // recording. Ambiguity is answered, never guessed.
    let resolved = track;
    if (action === 'play' || action === 'queue') {
      const resolution = await music.resolveTrack(requester, providerId, query);
      if (resolution.status === 'ambiguous') {
        const options = resolution.candidates.map(entry => `${entry.name} — ${entry.artists.join(', ')}${entry.isrc ? ` [${entry.isrc}]` : ''}`).join('; ');
        throw new MusicDispatchError('ambiguous', `Which version did you mean? I found more than one recording: ${options}.`);
      }
      if (resolution.status !== 'ok') throw new MusicDispatchError('not_found', reasonText('not_found', adapter));
      resolved = resolution.track;
    }

    // Single start time plus per-listener position compensation. Listeners are
    // attempted in order, so a slow one is not handed a stale offset.
    const startedAt = Date.now();
    const intent = { room, action, track: resolved, positionMs: 0 };
    const results = [];
    for (const entry of listeners) {
      intent.positionMs = Math.max(0, Date.now() - startedAt);
      results.push(await commandListener(entry, providerId, intent));
    }

    if (action === 'play') {
      const ok = results.filter(result => result.ok).length;
      if (ok) recordSession(room, providerId, { state: 'playing', trackUri: resolved.uri, trackName: resolved.name, startedAt, positionMs: 0 });
      else recordSession(room, providerId, { state: 'failed', trackUri: null, trackName: null, startedAt: 0, positionMs: 0 });
    } else if (action === 'pause') {
      recordSession(room, providerId, { state: 'paused' });
    } else if (action === 'resume') {
      recordSession(room, providerId, { state: 'playing' });
    } else if (action === 'skip') {
      recordSession(room, providerId, { state: 'skipped', startedAt: Date.now(), positionMs: 0 });
    }

    const succeeded = results.filter(result => result.ok).length;
    return {
      action,
      state: succeeded ? 'ok' : 'failed',
      track: resolved,
      listeners: summarize(results),
      message: summarizeMessage(results, adapter),
    };
  }

  function summarize(results) {
    return results.map(result => ({ ok: result.ok, reason: result.reason, user: result.user }));
  }

  function summarizeMessage(results, adapter) {
    const failed = results.filter(result => !result.ok);
    if (!failed.length) return null;
    const reasons = [...new Set(failed.map(result => result.reason))];
    const sentences = reasons.map(reason => reasonText(reason, adapter));
    const listenerWord = failed.length === 1 ? 'listener' : 'listeners';
    return `${failed.length} ${listenerWord} could not follow: ${sentences.join(' ')}`;
  }

  // Drift-correction hook. The session record already holds what was started and
  // when, so a later resync pass can compare each listener's reported position
  // against startedAt without changing how playback was issued.
  function drift(room) {
    const session = sessionOf(room);
    if (!session?.started_at) return { state: session?.state || 'none', driftMs: null };
    return { state: session.state, trackUri: session.track_uri, trackName: session.track_name, startedAt: session.started_at, expectedMs: Date.now() - session.started_at, driftMs: null };
  }

  return { dispatch, drift, session: sessionOf };
}
