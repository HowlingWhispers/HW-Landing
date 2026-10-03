import { ProviderError } from './spotify.mjs';

// In-memory provider used by the test suite and by local development
// (CODA_MUSIC_PROVIDER=fake). It implements the same adapter contract as
// Spotify, including the failure modes that matter: no active device, ambiguous
// recordings, a rejected refresh, and rate limiting. Nothing here touches the
// network or a real music account.
export function createFakeProvider(options = {}) {
  const settings = {
    clientId: 'fake-client',
    clientSecret: 'fake-secret',
    redirectUri: 'http://localhost/coda/api/music/fake/callback',
    code: 'fake-code',
    scopes: ['user-read-playback-state', 'user-modify-playback-state'],
    expiresIn: 3600,
    refreshError: null,
    devices: [
      { id: 'device-active', label: 'Laptop', type: 'Computer', active: true, restricted: false, volume_percent: 80 },
      { id: 'device-idle', label: 'Phone', type: 'Smartphone', active: false, restricted: false, volume_percent: 50 },
    ],
    tracks: {
      'the chain': [
        { uri: 'spotify:track:chain1977', id: 'chain1977', name: 'The Chain', artists: ['Fleetwood Mac'], album: 'Rumours', isrc: 'USRC17607839', duration_ms: 271000, explicit: false, popularity: 79 },
      ],
      'dreams': [
        { uri: 'spotify:track:dreams1977', id: 'dreams1977', name: 'Dreams', artists: ['Fleetwood Mac'], album: 'Rumours', isrc: 'USRC17607841', duration_ms: 257000, explicit: false, popularity: 81 },
      ],
      'take on me': [
        { uri: 'spotify:track:takeonme1985', id: 'takeonme1985', name: 'Take On Me', artists: ['a-ha'], album: 'Hunting High and Low', isrc: 'NOAPA7310001', duration_ms: 225000, explicit: false, popularity: 83 },
        { uri: 'spotify:track:takeonmelive', id: 'takeonmelive', name: 'Take On Me (Live)', artists: ['a-ha'], album: 'Live at Oslo Spektrum', isrc: 'NOAPA7310002', duration_ms: 248000, explicit: false, popularity: 41 },
      ],
    },
    // user id -> failure kind, applied to every playback action for that listener.
    failures: {},
    ...options,
  };

  const calls = [];
  const record = (method, detail) => { calls.push({ method, ...detail }); };
  const players = new Map();
  const player = user => {
    if (!players.has(user)) players.set(user, { playing: false, paused: false, track: null, positionMs: 0, queue: [] });
    return players.get(user);
  };
  const fail = (settings, user, action) => {
    const mode = settings.failures?.[user];
    if (!mode) return;
    if (mode === 'rate_limited') throw new ProviderError('rate_limited', 'Rate limited.', 429);
    if (mode === 'forbidden') throw new ProviderError('forbidden', 'Premium required.', 403);
    if (mode === 'unauthorized') throw new ProviderError('unauthorized', 'Bad token.', 401);
    if (mode === 'no_device') throw new ProviderError('no_device', 'No active device.', 409);
    throw new ProviderError(mode, `Fake ${action} failed.`, 502);
  };

  return {
    id: 'fake',
    label: 'Fake Music',
    scopes: settings.scopes,
    // Declared as an object so a capability name can never collide with a
    // method name of the same name.
    capabilities: { play: true, pause: true, resume: true, skip: true, queue: true, now_playing: true },
    calls,
    settings,
    // Test-only view of one listener's device state.
    player: user => players.get(user) || { playing: false, paused: false, track: null, positionMs: 0, queue: [] },

    configured: () => true,

    // The credential contract. The fake has no deployment defaults, so an
    // account that stores its own app is the only way it becomes account-scoped.
    envCredentials: () => ({ clientId: null, clientSecret: null, redirectUri: null }),
    validateCredentials: ({ clientId, clientSecret }) => {
      const id = String(clientId || '').trim();
      const secret = String(clientSecret || '').trim();
      if (id.length < 8) return 'That fake client ID is too short.';
      if (secret.length < 8) return 'That fake client secret is too short.';
      return null;
    },

    authorizeUrl({ state }) {
      return `https://fake.invalid/authorize?state=${encodeURIComponent(state)}`;
    },

    async exchange({ code }) {
      record('exchange', { code });
      if (code !== settings.code) throw new ProviderError('auth_failed', 'Fake provider rejected that code.', 400);
      return {
        accessToken: 'fake-access',
        refreshToken: 'fake-refresh',
        expiresAt: Date.now() + settings.expiresIn * 1000,
        scopes: settings.scopes,
        authorizedAt: Date.now(),
      };
    },

    async refresh() {
      record('refresh', {});
      if (settings.refreshError) throw new ProviderError(settings.refreshError, 'Fake provider rejected the refresh token.', 401);
      return { accessToken: 'fake-access-2', refreshToken: 'fake-refresh-2', expiresAt: Date.now() + settings.expiresIn * 1000, scopes: settings.scopes };
    },

    async disconnect() {
      record('disconnect', {});
      return { remoteRevoked: false, guidance: 'Fake provider keeps its authorization until the member removes it themselves.' };
    },

    async devices() {
      record('devices', {});
      return settings.devices.map(({ volume_percent, ...device }) => ({ ...device, volume: volume_percent ?? null }));
    },

    async resolveTrack({ query }) {
      record('resolveTrack', { query });
      const key = String(query || '').trim().toLowerCase();
      const matches = settings.tracks[key];
      if (!matches) return { status: 'not_found', candidates: [] };
      if (matches.length > 1) return { status: 'ambiguous', candidates: matches };
      return { status: 'ok', track: matches[0], candidates: matches };
    },

    // Playback. Each listener's state is keyed by its own account, so one
    // listener failing can never disturb another. failures maps a member id to
    // an error kind, which is how partial-fan-out and leave-during-session are
    // exercised without touching a real service.
    async play({ connection, track, deviceId, positionMs = 0 }) {
      record('play', { user: connection.user, track: track?.uri, deviceId, positionMs });
      fail(settings, connection.user, 'play');
      const state = player(connection.user);
      state.playing = true; state.paused = false; state.track = track; state.positionMs = positionMs; state.queue = [];
      return { ok: true };
    },

    async pause({ connection }) {
      record('pause', { user: connection.user });
      fail(settings, connection.user, 'pause');
      const state = player(connection.user);
      if (!state.track) throw new ProviderError('no_playback', 'Nothing is playing on that device.', 409);
      state.playing = false; state.paused = true;
      return { ok: true };
    },

    async resume({ connection }) {
      record('resume', { user: connection.user });
      fail(settings, connection.user, 'resume');
      const state = player(connection.user);
      if (!state.track) throw new ProviderError('no_playback', 'Nothing is paused on that device.', 409);
      state.playing = true; state.paused = false;
      return { ok: true };
    },

    async skip({ connection }) {
      record('skip', { user: connection.user });
      fail(settings, connection.user, 'skip');
      const state = player(connection.user);
      if (!state.track) throw new ProviderError('no_playback', 'Nothing is playing to skip.', 409);
      const next = state.queue.shift();
      if (next) { state.track = next; state.positionMs = 0; }
      else { state.track = null; state.playing = false; state.paused = false; }
      return { ok: true, track: state.track };
    },

    // The real queue endpoint is a member-scoped FIFO on the provider, so a
    // queued track is genuinely pending rather than played immediately.
    async queue({ connection, track }) {
      record('queue', { user: connection.user, track: track?.uri });
      fail(settings, connection.user, 'queue');
      const state = player(connection.user);
      state.queue.push(track);
      return { ok: true, depth: state.queue.length };
    },

    async nowPlaying({ connection }) {
      record('nowPlaying', { user: connection.user });
      fail(settings, connection.user, 'nowPlaying');
      const state = player(connection.user);
      if (!state.track) return { playing: false, track: null, positionMs: 0 };
      return { playing: state.playing, paused: state.paused, track: state.track, positionMs: state.positionMs };
    },
  };
}
