import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, hash } from '../server/store.mjs';
import { createCodaServer } from '../server/coda.mjs';
import { createMusicLayer } from '../server/music/index.mjs';
import { createFakeProvider } from '../server/music/fake.mjs';
import { spotifyProvider, SPOTIFY_SCOPES } from '../server/music/spotify.mjs';
import { seal, open } from '../server/music/tokens.mjs';
import { selectDevice, describeMissingDevice, DEVICE_REASONS } from '../server/music/devices.mjs';
import { splitMusicIntent, validateMusicIntent } from '../server/music/intent.mjs';
import { browserMusicGuidance, askKilo } from '../server/kilo.mjs';

const KEY = Buffer.alloc(32, 7).toString('base64');

function configFor(overrides = {}) {
  return { origin: 'http://localhost', clientId: 'id', clientSecret: 'secret', kiloPassword: 'secret', orbisSecret: 'secret', tokenKey: KEY, musicProvider: 'fake', ...overrides };
}

function layerFor(t, options = {}, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coda-music-'));
  const store = openStore(join(dir, 'rooms.sqlite'));
  const provider = createFakeProvider(options);
  const config = configFor(overrides);
  const music = createMusicLayer({ config, store, providers: [provider] });
  t.after(() => { store.db.close(); rmSync(dir, { recursive: true, force: true }); });
  return { store, music, provider, config, dir };
}

function seed(store, name = 'Member') {
  const id = name.toLowerCase();
  store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', id, name);
  store.run('INSERT OR IGNORE INTO sessions VALUES(?,?,?)', hash(`${id}-session`), id, Date.now() + 600_000);
  return { id, room: store.createRoom(id, `${name} room`) };
}

async function startServer(t, layer, generate) {
  const server = createCodaServer(layer.config, layer.store, generate, fetch, [layer.provider]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (user, path, method = 'GET', data, headers = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`, {
      method,
      // Never follow the provider redirect: the fake authorize URL does not resolve.
      redirect: 'manual',
      headers: { Cookie: `hw_coda=${user}-session`, Origin: 'http://localhost', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) };
  };
  return { call, store: layer.store, music: layer.music, config: layer.config, provider: layer.provider };
}

test('tokens seal and open, and a wrong key or tampered row yields no usable token', t => {
  const config = configFor();
  const sealed = seal(config, 'refresh-token-value');
  assert.notEqual(sealed, 'refresh-token-value');
  assert.equal(open(config, sealed), 'refresh-token-value');
  assert.equal(open(configFor({ tokenKey: Buffer.alloc(32, 9).toString('base64') }), sealed), null);
  const parts = sealed.split('.');
  parts[3] = Buffer.from('tampered').toString('base64');
  assert.equal(open(config, parts.join('.')), null);
  assert.equal(open(config, seal(config, null)), null);
  assert.equal(seal(config, ''), null);
  assert.throws(() => seal({ tokenKey: 'short' }, 'x'), /32 bytes/);
  assert.throws(() => seal({}, 'x'), /not configured/);
});

// Step 1: OAuth state binding, token storage, local-only disconnect.
test('connect stores sealed tokens, and the state cannot be replayed or forged', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer);
  const { id, room } = seed(layer.store);

  const started = await call(id, '/music/fake/connect');
  assert.equal(started.status, 302);
  const location = started.headers.get('location');
  const state = new URL(location).searchParams.get('state');
  assert.ok(state && location.startsWith('https://fake.invalid/authorize'));
  assert.match(started.headers.get('set-cookie') || '', /hw_coda_music=/);

  const layerApi = layer.music;
  assert.equal(layerApi.descriptor(id, 'fake').connected, false, 'not connected before the callback');

  // Wrong cookie state, then correct one.
  const forged = await call(id, `/music/fake/callback?state=${state}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${id}-session; hw_coda_music=forged` });
  assert.equal(forged.status, 302);
  assert.equal(layerApi.descriptor(id, 'fake').connected, false, 'forged cookie state must not connect');

  const cookie = `hw_coda=${id}-session; hw_coda_music=${state}`;
  const done = await call(id, `/music/fake/callback?state=${state}&code=fake-code`, 'GET', undefined, { Cookie: cookie });
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), '/coda#music=connected');
  const descriptor = layerApi.descriptor(id, 'fake');
  assert.equal(descriptor.connected, true);
  assert.deepEqual(descriptor.scopes, ['user-read-playback-state', 'user-modify-playback-state']);

  // Raw tokens live only server-side and are sealed at rest.
  const row = layer.store.get('SELECT * FROM music_connections WHERE user=? AND provider=?', id, 'fake');
  assert.ok(row.access_sealed && row.refresh_sealed);
  assert.ok(!row.access_sealed.includes('fake-access'));
  assert.equal(row.status, 'connected');
  assert.ok(row.authorized_at > 0, 'authorization time is recorded for refresh lifetime');
  assert.equal(JSON.stringify(layerApi.descriptor(id, 'fake')).includes('fake-access'), false);

  // Replay of the same state is rejected.
  const replay = await call(id, `/music/fake/callback?state=${state}&code=fake-code`, 'GET', undefined, { Cookie: cookie });
  assert.equal(replay.headers.get('location'), '/coda#music=failed');
  void room;
});

test('a state issued to one account cannot connect a different account', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer);
  const a = seed(layer.store, 'Aaa');
  const b = seed(layer.store, 'Bbb');
  const started = await call(a.id, '/music/fake/connect');
  const state = new URL(started.headers.get('location')).searchParams.get('state');
  const crossed = await call(b.id, `/music/fake/callback?state=${state}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${b.id}-session; hw_coda_music=${state}` });
  assert.equal(crossed.headers.get('location'), '/coda#music=failed');
  assert.equal(layer.music.descriptor(b.id, 'fake').connected, false);
  assert.equal(layer.music.descriptor(a.id, 'fake').connected, false);
});

test('disconnect is local only: tokens and opt-ins go, and no remote revocation is claimed', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer);
  const { id, room } = seed(layer.store);
  const state = new URL((await call(id, '/music/fake/connect')).headers.get('location')).searchParams.get('state');
  await call(id, `/music/fake/callback?state=${state}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${id}-session; hw_coda_music=${state}` });
  await call(id, `/rooms/${room}/music/join`, 'POST', {});

  const gone = await call(id, '/music/fake/disconnect', 'POST', {});
  assert.equal(gone.status, 200);
  assert.equal(gone.body.remoteRevoked, false, 'we must not claim provider-side revocation');
  assert.ok(gone.body.guidance && gone.body.guidance.length > 10, 'the member is told what disconnect did not do');
  assert.doesNotMatch(gone.body.guidance, /revoked your|removed your access on/i);
  assert.equal(layer.store.get('SELECT COUNT(*) AS n FROM music_connections WHERE user=?', id).n, 0);
  assert.equal(layer.store.get('SELECT COUNT(*) AS n FROM music_optin WHERE user=?', id).n, 0);
  // A disconnected member can no longer be controlled.
  await assert.rejects(() => layer.music.devices(room, id, 'fake'), /Connect a music account/);
});

test('the Spotify adapter asks only for the two playback scopes', () => {
  assert.deepEqual(SPOTIFY_SCOPES, ['user-read-playback-state', 'user-modify-playback-state']);
  const forbidden = ['playlist-modify-public', 'playlist-modify-private', 'user-library-read', 'user-library-modify', 'user-read-email', 'user-read-private'];
  for (const scope of forbidden) assert.equal(SPOTIFY_SCOPES.includes(scope), false, `${scope} must not be requested`);
});

test('the Spotify adapter points at Spotify for provider-side revocation instead of inventing an API', async () => {
  const result = await spotifyProvider.disconnect();
  assert.equal(result.remoteRevoked, false);
  assert.match(result.guidance, /spotify\.com\/account\/apps/);
  assert.match(result.guidance, /remove Howling Whispers Coda/i);
});

// Step 1: refresh lifetime handling.
test('a rejected refresh destroys the token, marks reconnect-required, and never loops', async t => {
  const layer = layerFor(t, { refreshError: 'invalid_grant' });
  const { id, room } = seed(layer.store);
  layer.store.saveMusicConnection({ user: id, provider: 'fake', accessSealed: seal(layer.config, 'fake-access'), refreshSealed: seal(layer.config, 'fake-refresh'), expires: Date.now() + 1000, scopes: 'user-read-playback-state user-modify-playback-state', authorizedAt: Date.now(), status: 'connected' });
  await layer.music.optIn(room, id, 'fake');

  // Force the refresh path by backdating the access token expiry.
  layer.store.run('UPDATE music_connections SET expires=? WHERE user=?', Date.now() - 1000, id);

  await assert.rejects(() => layer.music.devices(room, id, 'fake'), /authorization expired/);
  const row = layer.store.get('SELECT * FROM music_connections WHERE user=?', id);
  assert.equal(row.status, 'reconnect_required');
  assert.equal(row.access_sealed, null, 'expired token deleted');
  assert.equal(row.refresh_sealed, null, 'revoked token deleted');

  // Never retry-loops: further attempts fail immediately without another refresh.
  const refreshesBefore = layer.provider.calls.filter(call => call.method === 'refresh').length;
  await assert.rejects(() => layer.music.devices(room, id, 'fake'), /Reconnect/);
  assert.throws(() => layer.music.optIn(room, id, 'fake'), /Reconnect/, 'opt-in is refused until the member reconnects');
  assert.equal(layer.provider.calls.filter(call => call.method === 'refresh').length, refreshesBefore, 'no refresh retry loop');

  // Reconnect works and clears the flag.
  const fresh = await layer.music.startConnect(id, 'fake');
  await layer.music.completeConnect({ state: fresh.state, code: 'fake-code', sessionUser: id, cookieState: fresh.state });
  assert.equal(layer.music.descriptor(id, 'fake').connected, true);
});

test('a valid refresh persists the rotated refresh token and keeps the original authorization time', async t => {
  const layer = layerFor(t);
  const { id, room } = seed(layer.store);
  layer.store.saveMusicConnection({ user: id, provider: 'fake', accessSealed: seal(layer.config, 'old-access'), refreshSealed: seal(layer.config, 'old-refresh'), expires: Date.now() - 1, scopes: 'user-read-playback-state', authorizedAt: 1_700_000_000_000, status: 'connected' });
  await layer.music.optIn(room, id, 'fake');
  const { devices } = await layer.music.devices(room, id, 'fake');
  assert.ok(devices.length);
  const row = layer.store.get('SELECT * FROM music_connections WHERE user=?', id);
  assert.equal(open(layer.config, row.refresh_sealed), 'fake-refresh-2', 'rotated refresh token persisted');
  assert.equal(row.authorized_at, 1_700_000_000_000, 'original authorization time preserved');
});

// Step 2: opt-in model and device abstraction.
test('joining requires a connection, is per room, and only connected members are listeners', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer);
  const a = seed(layer.store, 'Aaa');
  const b = seed(layer.store, 'Bbb');
  layer.store.run('INSERT OR IGNORE INTO members VALUES(?,?)', a.room, b.id);

  const early = await call(a.id, `/rooms/${a.room}/music/join`, 'POST', {});
  assert.equal(early.status, 409, 'cannot join before connecting');
  assert.match(early.body.error, /Connect a music account/);

  for (const who of [a, b]) {
    const start = new URL((await call(who.id, '/music/fake/connect')).headers.get('location')).searchParams.get('state');
    await call(who.id, `/music/fake/callback?state=${start}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${who.id}-session; hw_coda_music=${start}` });
  }
  await call(a.id, `/rooms/${a.room}/music/join`, 'POST', {});
  assert.equal(layer.music.connectedUsers(a.room, 'fake').length, 1, 'only opted-in members count');
  assert.equal(layer.music.roster(a.room, 'fake').length, 1);

  await call(b.id, `/rooms/${a.room}/music/join`, 'POST', {});
  assert.equal(layer.music.connectedUsers(a.room, 'fake').length, 2);

  // Leaving revokes control immediately: the roster is read per request.
  await call(a.id, `/rooms/${a.room}/music/leave`, 'POST', {});
  assert.deepEqual(layer.music.roster(a.room, 'fake').map(entry => entry.user), [b.id]);
  assert.equal(layer.music.connectedUsers(a.room, 'fake').length, 1);

  // Opt-in is per room.
  assert.equal(layer.music.roster(a.room, 'fake').length, 1);
  assert.equal(layer.music.roster('other-room', 'fake').length, 0);
});

test('room music routes require membership and never leak another room roster', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer);
  const a = seed(layer.store, 'Aaa');
  const outsider = seed(layer.store, 'Zzz');
  const start = new URL((await call(a.id, '/music/fake/connect')).headers.get('location')).searchParams.get('state');
  await call(a.id, `/music/fake/callback?state=${start}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${a.id}-session; hw_coda_music=${start}` });
  await call(a.id, `/rooms/${a.room}/music/join`, 'POST', {});
  assert.equal((await call(a.id, `/rooms/${a.room}/music`)).status, 200);
  assert.equal((await call(outsider.id, `/rooms/${a.room}/music`)).status, 404, 'non-member cannot read the roster');
  assert.equal((await call(outsider.id, `/rooms/${a.room}/music/join`, 'POST', {})).status, 404);
});

test('device selection prefers the active device and explains every failure', () => {
  const devices = [
    { id: 'a', label: 'Laptop', active: true, restricted: false },
    { id: 'b', label: 'Phone', active: false, restricted: false },
  ];
  assert.equal(selectDevice(devices).device.id, 'a');
  assert.equal(selectDevice(devices, 'b').device.id, 'b', 'explicit hint wins');
  assert.equal(selectDevice(devices, 'gone').reason, 'missing');
  assert.equal(selectDevice([]).reason, 'none');
  assert.equal(selectDevice([{ id: 'x', active: false, restricted: true }]).reason, 'restricted');
  const two = [{ id: 'x', active: false, restricted: false }, { id: 'y', active: false, restricted: false }];
  assert.equal(selectDevice(two).reason, 'ambiguous');
  assert.equal(selectDevice([two[0]]).device.id, 'x', 'a single device is chosen without asking');
  for (const reason of ['none', 'restricted', 'ambiguous', 'missing']) assert.ok(DEVICE_REASONS[reason].length > 20, 'every reason is explained in words');
  // Reasons name the provider through substitution, never a hardcoded service.
  for (const reason of Object.keys(DEVICE_REASONS)) assert.equal(DEVICE_REASONS[reason].includes('Spotify'), false);
  assert.match(describeMissingDevice({ label: 'Fake Music' }, 'none'), /^No Fake Music device/);
  assert.equal(describeMissingDevice({ label: 'Fake Music' }, 'none').includes('{provider}'), false);
});

test('each adapter resolves only its own environment keys, so no provider name leaks upward', () => {
  const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REDIRECT_URI: 'https://example.test/cb' };
  const config = { origin: 'https://example.test', env };
  assert.equal(spotifyProvider.configured(config), true);
  assert.equal(spotifyProvider.configured({ origin: 'https://example.test', env: {} }), false);
  // The registered URI is preferred over the derived one.
  assert.equal(spotifyProvider.redirectUri(config, 'https://example.test/coda/api/music/spotify/callback'), 'https://example.test/cb');
  assert.equal(spotifyProvider.redirectUri({ origin: 'https://example.test', env: {} }, 'https://example.test/derived'), 'https://example.test/derived');
  // The fake provider needs no credentials at all.
  const fake = createFakeProvider();
  assert.equal(fake.configured({ origin: 'http://localhost', env: {} }), true);
});

test('a member with no usable device gets a graceful reason, not a crash', async t => {
  const layer = layerFor(t, { devices: [] });
  const { call } = await startServer(t, layer);
  const { id, room } = seed(layer.store);
  const start = new URL((await call(id, '/music/fake/connect')).headers.get('location')).searchParams.get('state');
  await call(id, `/music/fake/callback?state=${start}&code=fake-code`, 'GET', undefined, { Cookie: `hw_coda=${id}-session; hw_coda_music=${start}` });
  const devices = await call(id, `/rooms/${room}/music/devices`);
  assert.equal(devices.status, 200);
  assert.equal(devices.body.selection.device, null);
  assert.equal(devices.body.selection.reason, 'none');
  assert.match(describeMissingDevice({ label: 'Fake Music' }, 'none'), /Open Fake Music/);
});

// Step 2: recording preservation.
test('track resolution keeps distinct recordings apart and reports ambiguity instead of guessing', async t => {
  const layer = layerFor(t);
  const { id, room } = seed(layer.store);
  layer.store.saveMusicConnection({ user: id, provider: 'fake', accessSealed: seal(layer.config, 'a'), refreshSealed: seal(layer.config, 'r'), expires: Date.now() + 60_000, scopes: 'user-read-playback-state', authorizedAt: Date.now(), status: 'connected' });
  await layer.music.optIn(room, id, 'fake');

  const single = await layer.music.resolveTrack(id, 'fake', 'The Chain');
  assert.equal(single.status, 'ok');
  assert.equal(single.track.uri, 'spotify:track:chain1977');
  assert.equal(single.track.isrc, 'USRC17607839', 'stable recording metadata, not title only');

  const ambiguous = await layer.music.resolveTrack(id, 'fake', 'Take On Me');
  assert.equal(ambiguous.status, 'ambiguous', 'a live take is a different recording, so Coda must ask');
  assert.equal(new Set(ambiguous.candidates.map(c => c.isrc)).size, 2);

  const missing = await layer.music.resolveTrack(id, 'fake', 'nothing at all');
  assert.equal(missing.status, 'not_found');
});

// Step 3: strict intent schema.
test('the intent schema accepts the supported actions and rejects everything else', () => {
  for (const action of ['play', 'pause', 'resume', 'skip', 'queue', 'now_playing', 'join', 'leave']) {
    const query = action === 'play' || action === 'queue' ? { action, query: 'x' } : { action };
    assert.equal(validateMusicIntent(query, ['fake']).intent.action, action);
  }
  const rejections = [
    [{ action: 'disconnect' }, 'unsupported action'],
    [{ action: 'play' }, 'requires a query'],
    [{ action: 'play', query: '   ' }, 'requires a query'],
    [{ action: 'skip', query: 'Take On Me' }, 'does not accept a query'],
    [{ action: 'play', query: 'x', device_id: 'attacker' }, 'unsupported fields'],
    [{ action: 'play', query: 'x', provider: 'evil' }, 'unsupported provider'],
    [{ action: 'play', query: 'x', confidence: 5 }, 'confidence out of range'],
    [{ action: 'play', query: 'x'.repeat(400) }, 'query too long'],
    ['not an object', 'must be an object'],
    [null, 'must be an object'],
    [['play'], 'must be an object'],
  ];
  for (const [value, reason] of rejections) {
    const result = validateMusicIntent(value, ['fake']);
    assert.equal(result.intent, null, `must reject ${JSON.stringify(value)}`);
    assert.match(result.error, new RegExp(reason.split(' ')[0]));
  }
  // Omitting the provider is valid: the room may have only one. Naming one that
  // is not registered is not, even when other providers exist.
  assert.equal(validateMusicIntent({ action: 'play', query: 'x' }, []).intent.query, 'x');
  assert.equal(validateMusicIntent({ action: 'play', query: 'x', provider: 'spotify' }, []).intent, null);
  assert.equal(validateMusicIntent({ action: 'play', query: 'x', provider: 'fake' }, ['fake']).intent.provider, 'fake');
});

test('a music block is always stripped from the visible reply, even when unusable', () => {
  const good = splitMusicIntent('On it.\n\n```coda-music\n{"action":"play","query":"The Chain"}\n```', ['fake']);
  assert.equal(good.text, 'On it.');
  assert.equal(good.intent.action, 'play');
  assert.equal(good.intent.query, 'The Chain');

  for (const raw of [
    'Sure.\n```coda-music\nnot json\n```',
    'Sure.\n```coda-music\n{"action":"explode"}\n```',
    '```coda-music\n{"action":"play","query":"a"}\n```\n```coda-music\n{"action":"skip"}\n```',
  ]) {
    const result = splitMusicIntent(raw, ['fake']);
    assert.equal(result.intent, null, 'unusable intent yields no action');
    assert.ok(result.rejected, 'and is reported as rejected');
    assert.ok(!result.text.includes('coda-music'), 'internal markup never reaches a member');
    assert.ok(!result.text.includes('{'), 'and neither does the raw JSON');
  }
  assert.equal(splitMusicIntent('Just talking.', ['fake']).intent, null);
  assert.equal(splitMusicIntent('Just talking.', ['fake']).rejected, null);
});

// Step 3: prompt guidance.
test('music guidance is provider-neutral and states the room truth', () => {
  const none = browserMusicGuidance({ available: [] });
  assert.match(none, /No music account is connected/);
  assert.equal(none.includes('Spotify'), false, 'guidance must not hardwire a provider');

  const solo = browserMusicGuidance({ available: [{ id: 'fake', label: 'Fake Music' }], listeners: 0, requester: { connected: false, optedIn: false } });
  assert.match(solo, /Opted-in listeners right now: 0/);
  assert.match(solo, /has NOT connected a music account/);
  assert.match(solo, /must not control their playback/);

  const ready = browserMusicGuidance({ available: [{ id: 'fake', label: 'Fake Music' }], listeners: 3, requester: { connected: true, optedIn: true } });
  assert.match(ready, /Opted-in listeners right now: 3/);
  assert.match(ready, /Never put a track id, uri/);
  assert.match(ready, /is a request, not a result/);
  assert.match(ready, /emit no block/);

  const stale = browserMusicGuidance({ available: [{ id: 'fake', label: 'Fake Music' }], listeners: 1, requester: { connected: false, status: 'reconnect_required', optedIn: false } });
  assert.match(stale, /must be reconnected/);
  assert.match(stale, /never something a conversational turn may request/);
});

test('prompt state reports readiness without exposing a provider id, token, or name', async t => {
  const layer = layerFor(t);
  const { id, room } = seed(layer.store);
  const before = layer.music.promptState(room, id);
  assert.deepEqual(before.available.map(p => p.id), ['fake']);
  assert.equal(before.requester.connected, false);
  assert.equal(before.requester.optedIn, false);
  const serialized = JSON.stringify(before);
  assert.ok(!serialized.includes('fake-access') && !serialized.includes('accessSealed'));

  layer.store.saveMusicConnection({ user: id, provider: 'fake', accessSealed: seal(layer.config, 'a'), refreshSealed: seal(layer.config, 'r'), expires: Date.now() + 60_000, scopes: 'user-read-playback-state', authorizedAt: Date.now(), status: 'connected' });
  layer.music.optIn(room, id, 'fake');
  const after = layer.music.promptState(room, id);
  assert.equal(after.requester.connected, true);
  assert.equal(after.requester.optedIn, true);
  assert.equal(after.listeners, 1);
  assert.ok(!JSON.stringify(after).includes('fake-access'));
});

// Step 3: askKilo contract.
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('askKilo returns text plus a validated music intent, and never leaks the block', async () => {
  let sentSystem = '';
  let sentBody = null;
  const reply = 'Putting something on now.\n\n```coda-music\n{"action":"play","query":"The Chain"}\n```';
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/context')) return jsonResponse({ prompt: 'ORBIS PROMPT' });
    if (target.endsWith('/session') && options.method === 'POST') return jsonResponse({ id: 'sess' });
    if (target.includes('/message')) { sentBody = JSON.parse(options.body); sentSystem = sentBody.system; return jsonResponse({ parts: [{ type: 'text', text: reply }], info: { finish: 'stop' } }); }
    return jsonResponse({}, 404);
  };
  const config = { kiloUrl: 'http://kilo', kiloUsername: 'k', kiloPassword: 'p', kiloModel: 'kilo/kilo-auto/free', orbisUrl: 'http://orbis/bridge', orbisSecret: 's' };
  const messages = [{ author: '1', name: 'Member', content: 'Play The Chain for us' }];
  const caller = { discordUserId: '1', speakerName: 'Member', privacyScope: 'dm' };
  const result = await askKilo(config, 'room', messages, caller, fetcher, { prompt: { available: [{ id: 'fake', label: 'Fake Music' }], listeners: 1, requester: { connected: true, optedIn: true } }, providerIds: ['fake'] });
  assert.equal(result.text, 'Putting something on now.');
  assert.equal(result.musicIntent.action, 'play');
  assert.equal(result.musicIntent.query, 'The Chain');

  // The neutral music guidance reached the model.
  assert.match(sentSystem, /SHARED MUSIC \(Coda Web\)/);
  assert.match(sentSystem, /Opted-in listeners right now: 1/);
  // Music is not a tool: the model still gets no way to call anything itself.
  assert.ok(Object.keys(sentBody.tools).length > 0);
  assert.equal(Object.values(sentBody.tools).some(Boolean), false, 'every tool stays denied');
  assert.equal(sentBody.parts.filter(part => part.type === 'file').length, 0);
});

test('askKilo yields no intent when the model sends none, and the old string contract is gone', async () => {
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/context')) return jsonResponse({ prompt: 'ORBIS PROMPT' });
    if (target.endsWith('/session') && options.method === 'POST') return jsonResponse({ id: 'sess' });
    if (target.includes('/message')) return jsonResponse({ parts: [{ type: 'text', text: 'Which version did you mean?' }], info: { finish: 'stop' } });
    return jsonResponse({}, 404);
  };
  const config = { kiloUrl: 'http://kilo', kiloUsername: 'k', kiloPassword: 'p', kiloModel: 'kilo/kilo-auto/free', orbisUrl: 'http://orbis/bridge', orbisSecret: 's' };
  const result = await askKilo(config, 'room', [{ author: '1', name: 'Member', content: 'play something' }], { discordUserId: '1', speakerName: 'Member', privacyScope: 'dm' }, fetcher, { prompt: { available: [] }, providerIds: [] });
  assert.equal(result.text, 'Which version did you mean?');
  assert.equal(result.musicIntent, null);
  assert.equal(typeof result, 'object', 'askKilo returns an object, not a bare string');
});

test('the reply route stores only the visible text and reports the intent without dispatching', async t => {
  const layer = layerFor(t);
  const { call } = await startServer(t, layer, async () => ({ text: 'One sec.', musicIntent: { action: 'play', query: 'The Chain' } }));
  const { id, room } = seed(layer.store);
  await call(id, `/rooms/${room}/messages`, 'POST', { text: 'Play The Chain for us' });
  const reply = await call(id, `/rooms/${room}/reply`, 'POST');
  assert.equal(reply.status, 200);
  assert.equal(reply.body.music.action, 'play', 'intent is surfaced for the dispatch step');
  const history = layer.store.history(room);
  assert.equal(history.at(-1).content, 'One sec.');
  assert.ok(!JSON.stringify(history).includes('coda-music'), 'intent is never written into the transcript');
  assert.equal(layer.provider.calls.filter(call => call.method === 'resolveTrack').length, 0, 'no provider is contacted in steps 1-3');
});

test('an unconfigured music service tells members plainly instead of pretending', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'coda-nomusic-'));
  const store = openStore(join(dir, 'rooms.sqlite'));
  t.after(() => { store.db.close(); rmSync(dir, { recursive: true, force: true }); });
  const config = configFor({ musicProvider: '', tokenKey: undefined });
  const music = createMusicLayer({ config, store, providers: [] });
  assert.deepEqual(music.providers(), []);
  assert.deepEqual(music.providerIds(), []);
  assert.match(browserMusicGuidance(music.promptState('room', '1')), /No music account is connected/);
});
