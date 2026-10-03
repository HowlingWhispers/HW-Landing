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
      'take on me': [
        { uri: 'spotify:track:takeonme1985', id: 'takeonme1985', name: 'Take On Me', artists: ['a-ha'], album: 'Hunting High and Low', isrc: 'NOAPA7310001', duration_ms: 225000, explicit: false, popularity: 83 },
        { uri: 'spotify:track:takeonmelive', id: 'takeonmelive', name: 'Take On Me (Live)', artists: ['a-ha'], album: 'Live at Oslo Spektrum', isrc: 'NOAPA7310002', duration_ms: 248000, explicit: false, popularity: 41 },
      ],
    },
    ...options,
  };

  const calls = [];
  const record = (method, detail) => { calls.push({ method, ...detail }); };

  return {
    id: 'fake',
    label: 'Fake Music',
    scopes: settings.scopes,
    playback: true,
    calls,
    settings,

    configured: () => true,

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
  };
}
