import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, hash } from '../server/store.mjs';
import { createCodaServer } from '../server/coda.mjs';
import { createMusicLayer } from '../server/music/index.mjs';
import { createFakeProvider } from '../server/music/fake.mjs';
import { open } from '../server/music/tokens.mjs';
import { envCredentials, spotifyProvider, validateCredentials } from '../server/music/spotify.mjs';

const KEY = Buffer.alloc(32, 3).toString('base64');
const GOOD = { clientId: 'a'.repeat(32), clientSecret: 'b'.repeat(32) };

function harness(t, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coda-creds-'));
  const store = openStore(join(dir, 'rooms.sqlite'));
  const config = { origin: 'https://den.test', tokenKey: KEY, musicProvider: '', env };
  const provider = createFakeProvider();
  const music = createMusicLayer({ config, store, providers: [provider] });
  store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', 'member', 'Member');
  store.run('INSERT OR IGNORE INTO sessions VALUES(?,?,?)', hash('member-session'), 'member', Date.now() + 600_000);
  t.after(() => { store.db.close(); rmSync(dir, { recursive: true, force: true }); });
  const call = async (path, method = 'GET', data, user = 'member') => {
    const server = t.server;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`, {
      method, redirect: 'manual',
      headers: { Cookie: `hw_coda=${user}-session`, Origin: 'https://den.test' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  return { store, music, provider, config, call };
}

test('an account-stored app secret is sealed at rest and never returned', t => {
  const h = harness(t);
  h.music.setCredentials('member', 'fake', GOOD);
  const row = h.store.musicProviderConfig('member', 'fake');
  assert.equal(row.client_id, GOOD.clientId, 'the client id is not secret and stays readable');
  assert.ok(!row.client_secret_sealed.includes(GOOD.clientSecret), 'the secret is never stored in the clear');
  assert.equal(open(h.config, row.client_secret_sealed), GOOD.clientSecret, 'and it is recoverable by the server');

  // Every read path a client can reach must be free of the secret.
  const status = h.music.credentialsStatus('member', 'fake');
  assert.equal(status.source, 'account');
  assert.equal(status.clientId, GOOD.clientId);
  assert.ok(!JSON.stringify(status).includes(GOOD.clientSecret), 'credentialsStatus never leaks the secret');
  assert.ok(!JSON.stringify(h.music.providers('member')).includes(GOOD.clientSecret));
  assert.ok(!JSON.stringify(h.music.descriptor('member', 'fake')).includes(GOOD.clientSecret));
});

test('credentials fall back to the deployment defaults when an account has none', t => {
  const h = harness(t);
  assert.equal(h.music.credentialsStatus('member', 'fake').source, 'none', 'the fake adapter declares no env defaults');

  // A provider with deployment defaults is usable with no account app stored,
  // and an account app takes precedence over the deployment one.
  const dir = mkdtempSync(join(tmpdir(), 'coda-creds-fallback-'));
  const store = openStore(join(dir, 'r.sqlite'));
  const env = { SPOTIFY_CLIENT_ID: 'c'.repeat(32), SPOTIFY_CLIENT_SECRET: 'd'.repeat(32), SPOTIFY_REDIRECT_URI: 'https://den.test/cb' };
  const config = { origin: 'https://den.test', tokenKey: KEY, env };
  const music = createMusicLayer({ config, store, providers: [spotifyProvider] });
  t.after(() => { store.db.close(); rmSync(dir, { recursive: true, force: true }); });
  store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', 'member', 'Member');

  const deployment = music.credentialsStatus('member', 'spotify');
  assert.equal(deployment.source, 'deployment');
  assert.equal(deployment.clientId, env.SPOTIFY_CLIENT_ID);
  assert.equal(deployment.redirectUri, env.SPOTIFY_REDIRECT_URI, 'the deployment redirect URI is used');
  assert.equal(deployment.configured, true, 'deployment credentials alone make the provider usable');
  assert.deepEqual(music.providers('member').map(entry => entry.id), ['spotify']);

  music.setCredentials('member', 'spotify', GOOD);
  const own = music.credentialsStatus('member', 'spotify');
  assert.equal(own.source, 'account');
  assert.equal(own.clientId, GOOD.clientId, "the account's app wins");
  assert.equal(own.redirectUri, env.SPOTIFY_REDIRECT_URI, 'the callback stays deployment-level');

  // A member with no stored app still sees the provider, via the defaults.
  store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', 'guest', 'Guest');
  assert.equal(music.credentialsStatus('guest', 'spotify').source, 'deployment');

  // With no defaults and no stored app, the provider is simply not offered.
  const bare = createMusicLayer({ config: { origin: 'https://den.test', tokenKey: KEY, env: {} }, store, providers: [spotifyProvider] });
  assert.deepEqual(bare.providers('member').map(entry => entry.id), []);
  // A stored app alone is not enough: OAuth cannot start without a redirect URI,
  // because the provider matches it against a registered callback. Storing one
  // alongside the app is what makes the whole thing work with zero env setup.
  bare.setCredentials('member', 'spotify', GOOD);
  assert.deepEqual(bare.providers('member').map(entry => entry.id), [], 'no redirect URI means no usable provider');
  bare.setCredentials('member', 'spotify', { ...GOOD, redirectUri: 'https://den.test/coda/api/music/spotify/callback' });
  assert.deepEqual(bare.providers('member').map(entry => entry.id), ['spotify'], 'app plus callback needs no env configuration at all');
  assert.equal(bare.credentialsStatus('member', 'spotify').redirectUri, 'https://den.test/coda/api/music/spotify/callback');
});

test('implausible credentials are refused before anything is stored', t => {
  const h = harness(t);
  assert.throws(() => h.music.setCredentials('member', 'fake', { clientId: 'short', clientSecret: 'x' }));
  assert.throws(() => h.music.setCredentials('member', 'fake', { clientId: 'longenoughid', clientSecret: '' }));
  assert.equal(h.store.musicProviderConfig('member', 'fake'), undefined, 'nothing was written');
  // Validation belongs to the adapter, so each provider sets its own bar.
  assert.equal(validateCredentials(GOOD), null);
  assert.ok(validateCredentials({ clientId: 'short', clientSecret: 'x' }));
});

test('the deployment token key cannot be set, read, or shadowed through the account surface', async t => {
  const h = harness(t);
  const server = createCodaServer(h.config, h.store, async () => 'ok', fetch, [h.provider]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  t.server = server;

  // No route accepts a key, under any spelling.
  for (const attempt of [
    { path: '/music/fake/credentials', method: 'PUT', data: { ...GOOD, tokenKey: 'attacker-chosen' } },
    { path: '/music/fake/credentials', method: 'PUT', data: { ...GOOD, CODA_TOKEN_KEY: 'attacker-chosen' } },
  ]) {
    const result = await h.call(attempt.path, attempt.method, attempt.data);
    assert.equal(result.status, 200);
    const row = h.store.musicProviderConfig('member', 'fake');
    assert.ok(!JSON.stringify(row).includes('attacker'), 'an injected key is ignored, not stored');
  }
  // Sealing still uses the server key: the stored value opens with it.
  const row = h.store.musicProviderConfig('member', 'fake');
  assert.equal(open(h.config, row.client_secret_sealed), GOOD.clientSecret);
  assert.equal(open({ tokenKey: Buffer.alloc(32, 9).toString('base64') }, row.client_secret_sealed), null, 'another key cannot read it');
});

test('the credentials routes are authenticated, write-only, and account-scoped', async t => {
  const h = harness(t);
  const server = createCodaServer(h.config, h.store, async () => 'ok', fetch, [h.provider]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  t.server = server;

  const anonymous = await fetch(`http://127.0.0.1:${server.address().port}/coda/api/music/fake/credentials`);
  assert.equal(anonymous.status, 401, 'credentials require a session');

  assert.equal((await h.call('/music/fake/credentials')).status, 200);
  assert.equal((await h.call('/music/fake/credentials', 'PUT', GOOD)).status, 200);
  const read = await h.call('/music/fake/credentials');
  assert.equal(read.body.source, 'account');
  assert.ok(!JSON.stringify(read.body).includes(GOOD.clientSecret), 'GET never echoes the secret back');

  // Stored for this account only.
  h.store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', 'other', 'Other');
  assert.equal(h.music.credentialsStatus('other', 'fake').source, 'none', 'one account cannot see another account app');

  assert.equal((await h.call('/music/fake/credentials', 'DELETE')).status, 200);
  assert.equal(h.store.musicProviderConfig('member', 'fake'), undefined);
});

test('a member cannot edit another member app credentials', async t => {
  const h = harness(t);
  const server = createCodaServer(h.config, h.store, async () => 'ok', fetch, [h.provider]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  t.server = server;
  h.store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', 'victim', 'Victim');
  h.store.run('INSERT OR IGNORE INTO sessions VALUES(?,?,?)', hash('victim-session'), 'victim', Date.now() + 600_000);
  h.music.setCredentials('victim', 'fake', GOOD);

  const attacker = 'attacker';
  h.store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', attacker, 'Attacker');
  h.store.run('INSERT OR IGNORE INTO sessions VALUES(?,?,?)', hash(`${attacker}-session`), attacker, Date.now() + 600_000);
  // The route derives the account from the session; a body claiming someone else
  // is simply ignored, because there is no account field to honour.
  const result = await h.call('/music/fake/credentials', 'PUT', { ...GOOD, user: 'victim', clientId: 'e'.repeat(32) }, attacker);
  assert.equal(result.status, 200);
  assert.equal(h.store.musicProviderConfig('attacker', 'fake').client_id, 'e'.repeat(32), 'the attacker changed only their own row');
  assert.equal(h.store.musicProviderConfig('victim', 'fake').client_id, GOOD.clientId, "the victim's app is untouched");
});
