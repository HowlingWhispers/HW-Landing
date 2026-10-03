import { randomBytes } from 'node:crypto';
import { createFakeProvider } from './fake.mjs';
import { selectDevice } from './devices.mjs';
import { open, seal } from './tokens.mjs';
import { spotifyProvider } from './spotify.mjs';
import { hash } from '../store.mjs';

// Provider-agnostic music layer. Nothing above this file may name a provider:
// coda.mjs and kilo.mjs only see the registry, the opt-in roster, and a neutral
// prompt state. Adding YouTube Music or Amazon Music later means adding one
// adapter here and nothing else.
const REFRESH_WINDOW = 60_000;

function defaultProviders(config) {
  const list = [spotifyProvider];
  if (config.musicProvider === 'fake') list.unshift(createFakeProvider());
  return list;
}

export function createMusicLayer({ config, store, fetchImpl = fetch, providers }) {
  const adapters = new Map((providers || defaultProviders(config)).map(adapter => [adapter.id, adapter]));
  const refreshing = new Map();

  const provider = id => adapters.get(id) || null;
  const configured = () => [...adapters.values()].filter(adapter => {
    try { return adapter.configured(config); } catch { return false; }
  });
  const providerIds = () => configured().map(adapter => adapter.id);

  // The adapter's registered redirect URI wins; otherwise derive one from the
  // origin, because Spotify rejects any mismatch byte for byte.
  const redirectFor = id => {
    const adapter = adapters.get(id);
    if (!adapter) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
    const fallback = `${config.origin}/coda/api/music/${id}/callback`;
    return typeof adapter.redirectUri === 'function' ? adapter.redirectUri(config, fallback) : fallback;
  };

  function publicView(adapter) {
    return { id: adapter.id, label: adapter.label, scopes: adapter.scopes, configured: true };
  }

  // Sealed material never leaves this module; callers get a descriptor only.
  function connection(user, providerId) {
    const row = store.get('SELECT * FROM music_connections WHERE user=? AND provider=?', user, providerId);
    if (!row) return null;
    return {
      user: row.user,
      provider: row.provider,
      status: row.status,
      scopes: row.scopes ? row.scopes.split(' ').filter(Boolean) : [],
      authorizedAt: row.authorized_at,
      expiresAt: row.expires ?? null,
      tokens: {
        accessToken: open(config, row.access_sealed),
        refreshToken: open(config, row.refresh_sealed),
      },
    };
  }

  // Always the same shape, whether or not a row exists, so callers and the
  // prompt builder never have to guard on a missing descriptor.
  function descriptor(row) {
    if (!row) return { provider: null, status: null, connected: false, scopes: [], authorizedAt: null };
    return {
      provider: row.provider,
      status: row.status,
      connected: row.status === 'connected' && Boolean(row.access_sealed),
      scopes: row.scopes ? row.scopes.split(' ').filter(Boolean) : [],
      authorizedAt: row.authorized_at,
    };
  }

  function persist(user, providerId, record) {
    store.saveMusicConnection({
      user, provider: providerId,
      accessSealed: seal(config, record.accessToken),
      refreshSealed: seal(config, record.refreshToken),
      expires: record.expiresAt ?? null,
      scopes: (record.scopes || []).join(' '),
      authorizedAt: record.authorizedAt ?? Date.now(),
      status: 'connected',
    });
  }

  // invalid_grant is terminal for a connection: drop the sealed material, mark it
  // reconnect-required, and let the member reconnect. No retry loop.
  function markReconnectRequired(user, providerId) {
    store.markMusicReconnectRequired(user, providerId);
  }

  async function access(user, providerId) {
    const adapter = provider(providerId);
    if (!adapter) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
    const row = connection(user, providerId);
    if (!row) throw Object.assign(new Error('Connect a music account first.'), { status: 409 });
    if (row.status !== 'connected' || !row.tokens.accessToken) throw Object.assign(new Error('Reconnect your music account to continue.'), { status: 409 });
    return { adapter, connection: row };
  }

  async function freshConnection(user, providerId) {
    const { adapter, connection: row } = await access(user, providerId);
    if (row.expiresAt && row.expiresAt - Date.now() > REFRESH_WINDOW) return { adapter, connection: row };
    const key = `${user}:${providerId}`;
    const existing = refreshing.get(key);
    if (existing) return existing;
    const attempt = (async () => {
      try {
        const refreshed = await adapter.refresh({ connection: row, config, fetchImpl });
        persist(user, providerId, { ...refreshed, authorizedAt: row.authorizedAt });
        return { adapter, connection: connection(user, providerId) };
      } catch (error) {
        if (error.kind === 'invalid_grant') {
          markReconnectRequired(user, providerId);
          throw Object.assign(new Error('Your music authorization expired. Reconnect it to keep listening together.'), { status: 409 });
        }
        throw error;
      } finally {
        refreshing.delete(key);
      }
    })();
    refreshing.set(key, attempt);
    return attempt;
  }

  return {
    providers: () => configured().map(publicView),
    providerIds,
    provider,

    async startConnect(user, providerId) {
      const adapter = provider(providerId);
      if (!adapter || !adapter.configured(config)) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
      const state = randomBytes(32).toString('base64url');
      store.run('DELETE FROM music_oauth WHERE expires<?', Date.now());
      store.run('INSERT INTO music_oauth(token,provider,user,expires) VALUES(?,?,?,?)', hash(state), providerId, user, Date.now() + 600_000);
      return { state, url: adapter.authorizeUrl({ state, redirectUri: redirectFor(providerId), config }) };
    },

    async completeConnect({ state, code, sessionUser, cookieState }) {
      if (!state || !code) throw Object.assign(new Error('That music sign-in was incomplete.'), { status: 400 });
      if (cookieState !== state) throw Object.assign(new Error('That music sign-in could not be verified. Start again.'), { status: 400 });
      const row = store.get('SELECT * FROM music_oauth WHERE token=? AND expires>?', hash(state), Date.now());
      if (!row) throw Object.assign(new Error('That music sign-in expired. Start again.'), { status: 400 });
      store.run('DELETE FROM music_oauth WHERE token=?', hash(state));
      if (row.user !== sessionUser) throw Object.assign(new Error('That music sign-in belongs to a different account.'), { status: 403 });
      const adapter = provider(row.provider);
      if (!adapter) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
      try {
        const record = await adapter.exchange({ code, redirectUri: redirectFor(row.provider), config, fetchImpl });
        persist(row.user, row.provider, record);
        return { provider: row.provider, scopes: record.scopes };
      } catch (error) {
        throw Object.assign(new Error(error.status && error.status < 500 ? error.message : 'That music sign-in failed. Try again.'), { status: error.status || 502 });
      }
    },

    connection,
    descriptor: (user, providerId) => descriptor(store.get('SELECT * FROM music_connections WHERE user=? AND provider=?', user, providerId)),

    // Local disconnect only: sealed tokens and opt-ins go, control stops
    // immediately. Spotify-side authorization is the member's to revoke.
    async disconnect(user, providerId) {
      const adapter = provider(providerId);
      if (!adapter) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
      const result = await adapter.disconnect({ connection: connection(user, providerId), config, fetchImpl });
      store.removeMusicConnection(user, providerId);
      return { ok: true, remoteRevoked: result.remoteRevoked === true, guidance: result.guidance || null };
    },

    async devices(room, user, providerId) {
      const { adapter, connection: row } = await freshConnection(user, providerId);
      const devices = await adapter.devices({ connection: row, config, fetchImpl });
      const hint = store.get('SELECT device_hint FROM music_optin WHERE room=? AND user=? AND provider=?', room, user, providerId);
      return { devices, selection: selectDevice(devices, hint?.device_hint) };
    },

    async resolveTrack(user, providerId, query) {
      const { adapter, connection: row } = await freshConnection(user, providerId);
      return adapter.resolveTrack({ query, connection: row, config, fetchImpl });
    },

    optIn(room, user, providerId, deviceId = null) {
      if (!provider(providerId)) throw Object.assign(new Error('That music provider is not available.'), { status: 404 });
      const row = store.get('SELECT status FROM music_connections WHERE user=? AND provider=?', user, providerId);
      if (!row) throw Object.assign(new Error('Connect a music account before joining shared listening.'), { status: 409 });
      if (row.status !== 'connected') throw Object.assign(new Error('Reconnect your music account before joining shared listening.'), { status: 409 });
      store.run('INSERT INTO music_optin(room,user,provider,device_hint,joined) VALUES(?,?,?,?,?) ON CONFLICT(room,user,provider) DO UPDATE SET device_hint=excluded.device_hint, joined=excluded.joined', room, user, providerId, deviceId, Date.now());
      return { ok: true };
    },

    optOut(room, user, providerId) {
      store.run('DELETE FROM music_optin WHERE room=? AND user=? AND provider=?', room, user, providerId);
      return { ok: true };
    },

    // Read fresh on every request. There is no cached opt-in, so leaving or
    // disconnecting revokes control with no window where a stale grant survives.
    roster(room, providerId) {
      return store.all('SELECT user,provider,device_hint,joined FROM music_optin WHERE room=? AND provider=? ORDER BY joined', room, providerId);
    },

    connectedUsers(room, providerId) {
      return this.roster(room, providerId).filter(entry => {
        const row = store.get('SELECT status FROM music_connections WHERE user=? AND provider=?', entry.user, providerId);
        return row && row.status === 'connected';
      });
    },

    // Neutral prompt state: no provider names, no tokens, no ids beyond labels.
    promptState(room, user) {
      const available = configured().map(adapter => ({ id: adapter.id, label: adapter.label }));
      const listeners = available.length ? this.connectedUsers(room, available[0].id).length : 0;
      const own = available.length ? descriptor(store.get('SELECT * FROM music_connections WHERE user=? AND provider=?', user, available[0].id)) : { provider: null };
      const optedIn = available.length ? Boolean(store.get('SELECT 1 FROM music_optin WHERE room=? AND user=? AND provider=?', room, user, available[0].id)) : false;
      return { available, listeners, requester: { connected: own.connected === true, status: own.status || null, optedIn } };
    },
  };
}
