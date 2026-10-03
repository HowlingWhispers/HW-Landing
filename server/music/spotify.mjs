import { fingerprint } from './tokens.mjs';

// Provider adapter #1. Deliberately contains no playback calls in this phase:
// step 4 adds them behind the same interface, against the fake provider first.
//
// Token policy: access tokens are short lived and refresh tokens are long lived
// (currently about six months). Every refresh persists whatever Spotify returns,
// because a refresh response may hand back a rotated refresh token. A rejected
// refresh (invalid_grant) is terminal for that connection: the caller deletes
// the sealed material, marks the connection reconnect-required, and asks the
// member to reconnect. It is never retried in a loop.
export const SPOTIFY_SCOPES = ['user-read-playback-state', 'user-modify-playback-state'];
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
export const SPOTIFY_MANAGE_URL = 'https://www.spotify.com/account/apps/';

// This adapter owns every Spotify-specific name, including its environment
// variables, so nothing above the music layer has to know Spotify exists.
const CREDENTIAL_ENV = { clientId: 'SPOTIFY_CLIENT_ID', clientSecret: 'SPOTIFY_CLIENT_SECRET', redirectUri: 'SPOTIFY_REDIRECT_URI' };
function credentials(config) {
  const env = config?.env || {};
  return { clientId: env[CREDENTIAL_ENV.clientId], clientSecret: env[CREDENTIAL_ENV.clientSecret], redirectUri: env[CREDENTIAL_ENV.redirectUri] };
}

const basic = creds => `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')}`;

export class ProviderError extends Error {
  constructor(kind, message, status = 502) { super(message); this.kind = kind; this.status = status; }
}

async function tokenRequest(config, fetchImpl, params) {
  const response = await fetchImpl(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(credentials(config)) },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  if (response.status === 400 && body.error === 'invalid_grant') throw new ProviderError('invalid_grant', 'Spotify rejected the stored authorization.', 401);
  if (response.status === 429) throw new ProviderError('rate_limited', 'Spotify is rate limiting sign-in. Try again shortly.', 429);
  throw new ProviderError('auth_failed', 'Spotify sign-in failed. Try again shortly.', 502);
}

export const spotifyProvider = {
  id: 'spotify',
  label: 'Spotify',
  scopes: SPOTIFY_SCOPES,
  playback: false,

  configured: config => {
    const creds = credentials(config);
    return Boolean(creds.clientId && creds.clientSecret && creds.redirectUri);
  },

  // The registered URI wins: Spotify rejects any mismatch byte for byte.
  redirectUri(config, fallback) {
    return credentials(config).redirectUri || fallback;
  },

  authorizeUrl({ state, redirectUri, config }) {
    const creds = credentials(config);
    if (!this.configured(config)) throw new ProviderError('unconfigured', 'Spotify is not configured on this server yet.', 503);
    const query = new URLSearchParams({
      client_id: creds.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES.join(' '),
      state,
      show_dialog: 'true',
    });
    return `${ACCOUNTS}/authorize?${query}`;
  },

  async exchange({ code, redirectUri, config, fetchImpl }) {
    const body = await tokenRequest(config, fetchImpl, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token || null,
      expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
      scopes: typeof body.scope === 'string' && body.scope ? body.scope.split(' ').filter(Boolean) : SPOTIFY_SCOPES,
      authorizedAt: Date.now(),
    };
  },

  async refresh({ connection, config, fetchImpl }) {
    const refreshToken = connection.tokens.refreshToken;
    if (!refreshToken) throw new ProviderError('invalid_grant', 'No Spotify refresh token is stored.', 401);
    const body = await tokenRequest(config, fetchImpl, { grant_type: 'refresh_token', refresh_token: refreshToken });
    return {
      accessToken: body.access_token,
      // Spotify may rotate the refresh token; keep whichever it returns.
      refreshToken: body.refresh_token || refreshToken,
      expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
      scopes: typeof body.scope === 'string' && body.scope ? body.scope.split(' ').filter(Boolean) : connection.scopes,
    };
  },

  // Local-only. We do not claim to revoke the member's Spotify-side grant; the
  // member can remove Coda from Spotify's own connected-apps page.
  async disconnect() {
    return {
      remoteRevoked: false,
      guidance: `This removed Coda’s copy of your Spotify access. To also remove Coda’s authorization on Spotify’s side, open ${SPOTIFY_MANAGE_URL} and remove Howling Whispers Coda.`,
    };
  },

  async call({ connection, config, fetchImpl, method, path, body, query }) {
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${connection.tokens.accessToken}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) throw new ProviderError('unauthorized', 'Spotify rejected the access token.', 401);
    if (response.status === 403) throw new ProviderError('forbidden', 'Spotify refused this action. Shared playback needs a Spotify Premium account.', 403);
    if (response.status === 429) throw new ProviderError('rate_limited', 'Spotify is rate limiting this room. Try again in a moment.', 429);
    if (response.status === 404) throw new ProviderError('not_found', 'Spotify has no record of that.', 404);
    if (!response.ok) throw new ProviderError('provider_error', 'Spotify could not complete that request.', 502);
    return response.status === 204 ? null : response.json().catch(() => null);
  },

  async devices({ connection, config, fetchImpl }) {
    const body = await this.call({ connection, config, fetchImpl, method: 'GET', path: '/me/player/devices' });
    return (body?.devices || []).map(device => ({
      id: device.id,
      label: device.name || device.type || 'Spotify device',
      type: device.type || 'unknown',
      active: device.is_active === true,
      restricted: device.is_restricted === true,
      volume: typeof device.volume_percent === 'number' ? device.volume_percent : null,
    }));
  },

  // Track matching keeps the same recording: candidates are grouped by ISRC, so
  // a live take, a remix, or a re-recording is a distinct recording rather than a
  // silent substitution. Two different recordings close together is ambiguity we
  // hand back for Coda to ask about, not a guess.
  async resolveTrack({ query, connection, config, fetchImpl }) {
    const body = await this.call({ connection, config, fetchImpl, method: 'GET', path: '/search', query: { q: query, type: 'track', limit: 10 } });
    const items = body?.tracks?.items || [];
    const candidates = items.map(item => ({
      uri: item.uri,
      id: item.id,
      name: item.name,
      artists: (item.artists || []).map(artist => artist.name),
      album: item.album?.name || '',
      isrc: item.external_ids?.isrc || null,
      durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null,
      explicit: item.explicit === true,
      popularity: typeof item.popularity === 'number' ? item.popularity : 0,
    }));
    if (!candidates.length) return { status: 'not_found', candidates: [] };
    const recording = candidate => candidate.isrc || `${candidate.name}|${candidate.artists.join(',')}|${candidate.durationMs}`;
    const top = candidates.slice(0, 5).map(recording);
    const distinct = new Set(top);
    if (distinct.size > 1) {
      const ranked = [...candidates].sort((a, b) => b.popularity - a.popularity);
      const leaders = new Set(ranked.slice(0, 3).map(recording));
      if (leaders.size > 1) return { status: 'ambiguous', candidates: ranked.slice(0, 4) };
    }
    const best = [...candidates].sort((a, b) => b.popularity - a.popularity)[0];
    return { status: 'ok', track: best, candidates: [best] };
  },
};
