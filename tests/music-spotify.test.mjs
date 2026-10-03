import test from 'node:test';
import assert from 'node:assert/strict';
import { spotifyProvider as spotify, ProviderError } from '../server/music/spotify.mjs';

// Every provider call in this file goes through an injected fake fetch, so the
// suite verifies the real adapter's request shapes and error mapping without
// ever making a live provider call. Live verification is human-driven.
const CREDENTIALS = { clientId: 'a'.repeat(32), clientSecret: 'b'.repeat(32) };
const CONNECTION = { user: 'member', tokens: { accessToken: 'access-token' } };

function recorder(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    // Playback calls send JSON; the token endpoint sends a form body. Record
    // both faithfully instead of assuming one.
    const raw = options.body ?? null;
    const isJson = String(options.headers?.['Content-Type'] || '').includes('application/json');
    const entry = {
      url: String(url), method: options.method || 'GET', headers: options.headers || {},
      body: raw === null ? null : isJson ? JSON.parse(raw) : raw,
      form: raw !== null && !isJson ? new URLSearchParams(raw) : null,
    };
    calls.push(entry);
    const match = responses.shift();
    if (!match) throw new Error(`unexpected request: ${entry.method} ${entry.url}`);
    return new Response(match.body === undefined ? null : JSON.stringify(match.body), { status: match.status ?? 204, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

const TRACK = { uri: 'spotify:track:chain1977', id: 'chain1977', name: 'The Chain', artists: ['Fleetwood Mac'], isrc: 'USRC17607839', durationMs: 271000 };

test('play targets one device and starts the resolved recording at an offset', async () => {
  const { calls, fetchImpl } = recorder([{ status: 204 }]);
  await spotify.play({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl, deviceId: 'device-1', track: TRACK, positionMs: 1500 });
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.method, 'PUT');
  assert.equal(call.url, 'https://api.spotify.com/v1/me/player/play?device_id=device-1');
  assert.equal(call.headers.Authorization, 'Bearer access-token');
  assert.deepEqual(call.body, { uris: ['spotify:track:chain1977'], position_ms: 1500 });
});

test('play refuses a track with no resolved uri rather than sending an empty target', async () => {
  const { calls, fetchImpl } = recorder([]);
  for (const track of [null, {}, { id: 'x' }]) {
    await assert.rejects(() => spotify.play({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl, deviceId: 'd', track }), error => {
      assert.equal(error.kind, 'invalid_track');
      return true;
    });
  }
  assert.equal(calls.length, 0, 'nothing was sent');
});

test('pause, resume, and skip use the documented transport endpoints', async () => {
  const pause = recorder([{ status: 204 }]);
  await spotify.pause({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl: pause.fetchImpl, deviceId: 'd1' });
  assert.equal(pause.calls[0].method, 'POST');
  assert.equal(pause.calls[0].url, 'https://api.spotify.com/v1/me/player/pause?device_id=d1');
  assert.equal(pause.calls[0].body, null, 'pause carries no body');

  // Resume is a PUT with no body, which is how the provider expresses it.
  const resume = recorder([{ status: 204 }]);
  await spotify.resume({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl: resume.fetchImpl, deviceId: 'd1' });
  assert.equal(resume.calls[0].method, 'PUT');
  assert.equal(resume.calls[0].url, 'https://api.spotify.com/v1/me/player/play?device_id=d1');
  assert.equal(resume.calls[0].body, null, 'resume must not send a body');

  const skip = recorder([{ status: 204 }]);
  await spotify.skip({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl: skip.fetchImpl, deviceId: 'd1' });
  assert.equal(skip.calls[0].method, 'POST');
  assert.equal(skip.calls[0].url, 'https://api.spotify.com/v1/me/player/next?device_id=d1');
});

test('queue uses the real queue endpoint with the uri as a query parameter', async () => {
  const { calls, fetchImpl } = recorder([{ status: 204 }]);
  await spotify.queue({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl, deviceId: 'd1', track: TRACK });
  assert.equal(calls[0].method, 'POST');
  const url = new URL(calls[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.spotify.com/v1/me/player/queue');
  assert.equal(url.searchParams.get('uri'), 'spotify:track:chain1977');
  assert.equal(url.searchParams.get('device_id'), 'd1');
  assert.equal(calls[0].body, null, 'the queue endpoint takes no body');
  // Playlist scopes are never needed for this.
  assert.equal(spotify.scopes.includes('playlist-modify-public'), false);
});

test('now_playing maps the current item and treats no session as a valid answer', async () => {
  const playing = recorder([{ status: 200, body: { is_playing: true, progress_ms: 42_000, item: { uri: TRACK.uri, id: TRACK.id, name: TRACK.name, artists: [{ name: 'Fleetwood Mac' }], album: { name: 'Rumours' }, duration_ms: 271_000, external_ids: { isrc: TRACK.isrc } } } }]);
  const state = await spotify.nowPlaying({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl: playing.fetchImpl });
  assert.equal(state.playing, true);
  assert.equal(state.track.uri, TRACK.uri);
  assert.equal(state.track.isrc, TRACK.isrc, 'stable recording metadata is preserved');
  assert.equal(state.positionMs, 42_000);

  // 204 and 404 both mean there is nothing playing, not a failure.
  for (const status of [204, 404]) {
    const empty = recorder([{ status }]);
    const idle = await spotify.nowPlaying({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl: empty.fetchImpl });
    assert.equal(idle.playing, false, `status ${status} is not an error`);
    assert.equal(idle.track, null);
  }
});

test('provider errors map to reasons the room can explain', async () => {
  const cases = [
    [401, 'unauthorized'], [403, 'forbidden'], [429, 'rate_limited'], [404, 'not_found'], [500, 'provider_error'],
  ];
  for (const [status, kind] of cases) {
    const { fetchImpl } = recorder([{ status }]);
    await assert.rejects(() => spotify.pause({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl, deviceId: 'd' }), error => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.kind, kind, `status ${status} maps to ${kind}`);
      return true;
    });
  }
});

test('a missing credential set never reaches the provider', async () => {
  const { calls, fetchImpl } = recorder([]);
  for (const credentials of [null, {}, { clientId: 'a'.repeat(32) }, { clientSecret: 'b'.repeat(32) }]) {
    await assert.rejects(() => spotify.exchange({ code: 'c', redirectUri: 'https://example.test/cb', credentials, fetchImpl }), error => {
      assert.equal(error.kind, 'unconfigured');
      return true;
    });
  }
  assert.equal(calls.length, 0);
});

test('token exchange and refresh send the right grant to the fixed token host', async () => {
  const exchange = recorder([{ status: 200, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'user-read-playback-state user-modify-playback-state' } }]);
  const record = await spotify.exchange({ code: 'auth-code', redirectUri: 'https://example.test/cb', credentials: CREDENTIALS, fetchImpl: exchange.fetchImpl });
  assert.equal(record.accessToken, 'at');
  assert.equal(record.refreshToken, 'rt');
  assert.ok(record.expiresAt > Date.now());
  assert.ok(record.authorizedAt > 0);
  const call = exchange.calls[0];
  assert.equal(new URL(call.url).origin + new URL(call.url).pathname, 'https://accounts.spotify.com/api/token');
  assert.equal(call.form.get('grant_type'), 'authorization_code');
  assert.equal(call.form.get('code'), 'auth-code');
  assert.equal(call.form.get('redirect_uri'), 'https://example.test/cb');
  assert.equal(call.headers.Authorization, `Basic ${Buffer.from(`${CREDENTIALS.clientId}:${CREDENTIALS.clientSecret}`).toString('base64')}`);

  const refresh = recorder([{ status: 200, body: { access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 } }]);
  const rotated = await spotify.refresh({ connection: { tokens: { refreshToken: 'rt' } }, credentials: CREDENTIALS, fetchImpl: refresh.fetchImpl });
  assert.equal(rotated.refreshToken, 'rt2', 'a rotated refresh token is what gets returned');
  assert.equal(refresh.calls[0].form.get('grant_type'), 'refresh_token');
  assert.equal(refresh.calls[0].form.get('refresh_token'), 'rt');
});

test('a rejected refresh is reported as invalid_grant so the connection is retired', async () => {
  const { fetchImpl } = recorder([{ status: 400, body: { error: 'invalid_grant' } }]);
  await assert.rejects(() => spotify.refresh({ connection: { tokens: { refreshToken: 'rt' } }, credentials: CREDENTIALS, fetchImpl }), error => {
    assert.equal(error.kind, 'invalid_grant');
    assert.equal(error.status, 401);
    return true;
  });
});

test('device discovery reports the fields the selection policy needs', async () => {
  const { fetchImpl } = recorder([{ status: 200, body: { devices: [{ id: 'd1', name: 'Laptop', type: 'Computer', is_active: true, is_restricted: false, volume_percent: 80 }, { id: 'd2', name: 'Speaker', type: 'Speaker', is_active: false, is_restricted: true }] } }]);
  const devices = await spotify.devices({ connection: CONNECTION, credentials: CREDENTIALS, fetchImpl });
  assert.equal(devices.length, 2);
  assert.deepEqual(devices[0], { id: 'd1', label: 'Laptop', type: 'Computer', active: true, restricted: false, volume: 80 });
  assert.equal(devices[1].restricted, true, 'a device Coda cannot control is flagged, not hidden');
});

test('track resolution asks for candidates and keeps distinct recordings apart', async () => {
  const { fetchImpl } = recorder([{ status: 200, body: { tracks: { items: [
    { uri: 'spotify:track:a', id: 'a', name: 'Take On Me', artists: [{ name: 'a-ha' }], album: { name: 'Hunting High and Low' }, duration_ms: 225_000, popularity: 83, external_ids: { isrc: 'NOAPA7310001' } },
    { uri: 'spotify:track:b', id: 'b', name: 'Take On Me (Live)', artists: [{ name: 'a-ha' }], album: { name: 'Live' }, duration_ms: 248_000, popularity: 41, external_ids: { isrc: 'NOAPA7310002' } },
  ] } } }]);
  const resolution = await spotify.resolveTrack({ query: 'Take On Me', connection: CONNECTION, credentials: CREDENTIALS, fetchImpl });
  assert.equal(resolution.status, 'ambiguous', 'two recordings of one title is ambiguity, not a choice');
  assert.equal(new Set(resolution.candidates.map(c => c.isrc)).size, 2);
});

test('disconnect claims no provider-side revocation', async () => {
  const result = await spotify.disconnect();
  assert.equal(result.remoteRevoked, false);
  assert.match(result.guidance, /spotify\.com\/account\/apps/);
});
