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

// This adapter owns every Spotify-specific name, including which environment
// variables hold its app credentials. It never reads them itself: the layer
// resolves credentials (per-account first, then these) and passes them in.
const CREDENTIAL_ENV = { clientId: 'SPOTIFY_CLIENT_ID', clientSecret: 'SPOTIFY_CLIENT_SECRET', redirectUri: 'SPOTIFY_REDIRECT_URI' };

// Deployment-level fallback, used when an account has not stored its own app.
export function envCredentials(config) {
  const env = config?.env || {};
  return {
    clientId: env[CREDENTIAL_ENV.clientId] || null,
    clientSecret: env[CREDENTIAL_ENV.clientSecret] || null,
    redirectUri: env[CREDENTIAL_ENV.redirectUri] || null,
  };
}

// Shape and plausibility of an app's credentials, so an obviously wrong value is
// rejected before it is sealed and stored.
export function validateCredentials({ clientId, clientSecret }) {
  const id = String(clientId || '').trim();
  const secret = String(clientSecret || '').trim();
  if (!/^[0-9a-f]{32}$/i.test(id)) return 'That Spotify client ID does not look like a client ID.';
  if (!/^[0-9a-f]{32}$/i.test(secret)) return 'That Spotify client secret does not look like a client secret.';
  return null;
}

const basic = credentials => `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`;

export class ProviderError extends Error {
  constructor(kind, message, status = 502) { super(message); this.kind = kind; this.status = status; }
}

async function tokenRequest(credentials, fetchImpl, params) {
  if (!credentials?.clientId || !credentials?.clientSecret) throw new ProviderError('unconfigured', 'Spotify is not configured on this server yet.', 503);
  const response = await fetchImpl(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(credentials) },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  if (response.status === 400 && body.error === 'invalid_grant') throw new ProviderError('invalid_grant', 'Spotify rejected the stored authorization.', 401);
  if (response.status === 429) throw new ProviderError('rate_limited', 'Spotify is rate limiting sign-in. Try again shortly.', 429);
  throw new ProviderError('auth_failed', 'Spotify sign-in failed. Try again shortly.', 502);
}

const envConfigured = config => {
  const creds = envCredentials(config);
  return Boolean(creds.clientId && creds.clientSecret && creds.redirectUri);
};

export const spotifyProvider = {
  id: 'spotify',
  label: 'Spotify',
  scopes: SPOTIFY_SCOPES,
  capabilities: { play: true, pause: true, resume: true, skip: true, queue: true, now_playing: true },

  // The deployment is configured when env credentials exist. An account that has
  // stored its own app is configured regardless, which the layer decides.
  configured: envConfigured,
  envCredentials,
  validateCredentials,

  authorizeUrl({ state, redirectUri, credentials }) {
    if (!credentials?.clientId) throw new ProviderError('unconfigured', 'Spotify is not configured on this server yet.', 503);
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES.join(' '),
      state,
      show_dialog: 'true',
    });
    return `${ACCOUNTS}/authorize?${query}`;
  },

  async exchange({ code, redirectUri, credentials, fetchImpl }) {
    const body = await tokenRequest(credentials, fetchImpl, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token || null,
      expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
      scopes: typeof body.scope === 'string' && body.scope ? body.scope.split(' ').filter(Boolean) : SPOTIFY_SCOPES,
      authorizedAt: Date.now(),
    };
  },

  async refresh({ connection, credentials, fetchImpl }) {
    const refreshToken = connection.tokens.refreshToken;
    if (!refreshToken) throw new ProviderError('invalid_grant', 'No Spotify refresh token is stored.', 401);
    const body = await tokenRequest(credentials, fetchImpl, { grant_type: 'refresh_token', refresh_token: refreshToken });
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

  // tolerate lists statuses that are a valid answer rather than a failure, so a
  // provider can express "nothing is playing" instead of inventing an error.
  async call({ connection, credentials, fetchImpl, method, path, body, query, tolerate }) {
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${connection.tokens.accessToken}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    // A tolerated status is a valid answer, so it bypasses all error mapping.
    // This must come first, otherwise a tolerated 404 would still be raised as
    // "no record of that" and a caller could never express "nothing playing".
    if ((tolerate || []).includes(response.status)) return response.status === 204 ? null : response.json().catch(() => null);
    if (response.status === 401) throw new ProviderError('unauthorized', 'Spotify rejected the access token.', 401);
    if (response.status === 403) throw new ProviderError('forbidden', 'Spotify refused this action. Shared playback needs a Spotify Premium account.', 403);
    if (response.status === 429) throw new ProviderError('rate_limited', 'Spotify is rate limiting this room. Try again in a moment.', 429);
    if (response.status === 404) throw new ProviderError('not_found', 'Spotify has no record of that.', 404);
    if (!response.ok) throw new ProviderError('provider_error', 'Spotify could not complete that request.', 502);
    return response.status === 204 ? null : response.json().catch(() => null);
  },

  async devices({ connection, credentials, fetchImpl }) {
    const body = await this.call({ connection, credentials, fetchImpl, method: 'GET', path: '/me/player/devices' });
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
  async resolveTrack({ query, connection, credentials, fetchImpl }) {
    const body = await this.call({ connection, credentials, fetchImpl, method: 'GET', path: '/search', query: { q: query, type: 'track', limit: 10 } });
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

  // Playback. Every call targets one device explicitly so a member's other
  // devices are never touched. A 204 is success and carries no body.
  async play({ connection, credentials, fetchImpl, deviceId, track, positionMs = 0 }) {
    if (!track?.uri) throw new ProviderError('invalid_track', 'No track was resolved to play.', 400);
    await this.call({
      connection, credentials, fetchImpl, method: 'PUT', path: '/me/player/play',
      query: { device_id: deviceId },
      body: { uris: [track.uri], position_ms: Math.max(0, Math.round(positionMs)) },
    });
    return { ok: true };
  },

  async pause({ connection, credentials, fetchImpl, deviceId }) {
    await this.call({ connection, credentials, fetchImpl, method: 'POST', path: '/me/player/pause', query: { device_id: deviceId } });
    return { ok: true };
  },

  // Spotify resumes with a PUT carrying no body.
  async resume({ connection, credentials, fetchImpl, deviceId }) {
    await this.call({ connection, credentials, fetchImpl, method: 'PUT', path: '/me/player/play', query: { device_id: deviceId } });
    return { ok: true };
  },

  async skip({ connection, credentials, fetchImpl, deviceId }) {
    await this.call({ connection, credentials, fetchImpl, method: 'POST', path: '/me/player/next', query: { device_id: deviceId } });
    return { ok: true };
  },

  // The real member-scoped queue endpoint. Requires Premium.
  async queue({ connection, credentials, fetchImpl, deviceId, track }) {
    if (!track?.uri) throw new ProviderError('invalid_track', 'No track was resolved to queue.', 400);
    await this.call({ connection, credentials, fetchImpl, method: 'POST', path: '/me/player/queue', query: { uri: track.uri, device_id: deviceId } });
    return { ok: true };
  },

  async nowPlaying({ connection, credentials, fetchImpl }) {
    // 204 means there is no active session at all, which is a valid answer.
    const body = await this.call({ connection, credentials, fetchImpl, method: 'GET', path: '/me/player', tolerate: [404] });
    const item = body?.item;
    if (!item) return { playing: false, track: null, positionMs: 0 };
    return {
      playing: body.is_playing === true,
      track: {
        uri: item.uri, id: item.id, name: item.name,
        artists: (item.artists || []).map(artist => artist.name),
        album: item.album?.name || '',
        isrc: item.external_ids?.isrc || null,
        durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null,
      },
      positionMs: typeof body.progress_ms === 'number' ? body.progress_ms : 0,
    };
  },
};
