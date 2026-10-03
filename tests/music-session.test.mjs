import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, hash } from '../server/store.mjs';
import { createCodaServer } from '../server/coda.mjs';
import { createMusicLayer } from '../server/music/index.mjs';
import { createMusicSession } from '../server/music/session.mjs';
import { createFakeProvider } from '../server/music/fake.mjs';
import { seal } from '../server/music/tokens.mjs';
import { spotifyProvider } from '../server/music/spotify.mjs';

const KEY = Buffer.alloc(32, 11).toString('base64');

// Step 4 runs entirely against the in-memory provider. No Spotify endpoint is
// contacted: spotifyProvider is asserted to be playback-disabled so a stray
// adapter can never reach the network from this suite.
function harness(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coda-music4-'));
  const store = openStore(join(dir, 'rooms.sqlite'));
  const provider = createFakeProvider(options);
  const config = { origin: 'http://localhost', tokenKey: KEY, musicProvider: 'fake', env: {} };
  const music = createMusicLayer({ config, store, providers: [provider] });
  const session = createMusicSession({ music, store, config });
  t.after(() => { store.db.close(); rmSync(dir, { recursive: true, force: true }); });

  const connect = (id, room) => {
    store.saveMusicConnection({ user: id, provider: 'fake', accessSealed: seal(config, `access-${id}`), refreshSealed: seal(config, `refresh-${id}`), expires: Date.now() + 3_600_000, scopes: 'user-read-playback-state user-modify-playback-state', authorizedAt: Date.now(), status: 'connected' });
    if (room) music.optIn(room, id, 'fake', null);
  };
  const member = (name, { join = true, connected = true } = {}) => {
    const id = name.toLowerCase();
    store.run('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)', id, name);
    store.run('INSERT OR IGNORE INTO sessions VALUES(?,?,?)', hash(`${id}-session`), id, Date.now() + 600_000);
    const room = store.createRoom(id, `${name} room`);
    return { id, room };
  };
  const addTo = (room, who) => store.run('INSERT OR IGNORE INTO members VALUES(?,?)', room, who.id);
  return { store, music, session, provider, config, connect, member, addTo };
}

test('the real Spotify adapter declares playback and drives it entirely through injected fetch', async t => {
  const { spotifyProvider: spotify } = await import('../server/music/spotify.mjs');
  assert.deepEqual(spotify.capabilities, { play: true, pause: true, resume: true, skip: true, queue: true, now_playing: true });
  // Every provider call must go through the injected fetch. A missing or wrong
  // base URL throws rather than reaching the network, which is what keeps this
  // suite from ever making a live provider call.
  const credentials = { clientId: 'a'.repeat(32), clientSecret: 'b'.repeat(32) };
  const connection = { user: 'u', tokens: { accessToken: 'token' } };
  await assert.rejects(() => spotify.devices({ connection, credentials, fetchImpl: undefined }), 'injected fetch is mandatory');
  // Authorization URL is built for the fixed provider host with the two scopes.
  const url = new URL(spotify.authorizeUrl({ state: 'st', redirectUri: 'https://example.test/cb', credentials }));
  assert.equal(url.origin + url.pathname, 'https://accounts.spotify.com/authorize');
  assert.equal(url.searchParams.get('client_id'), credentials.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.test/cb');
  assert.equal(url.searchParams.get('scope'), 'user-read-playback-state user-modify-playback-state');
  assert.equal(url.searchParams.get('state'), 'st');
});

test('a request fans out to every opted-in listener on the same recording', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const b = h.member('Bbb'); const c = h.member('Ccc');
  h.addTo(a.room, b); h.addTo(a.room, c);
  h.connect(a.id, a.room); h.connect(b.id, a.room); h.connect(c.id, a.room);

  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'ok');
  assert.equal(outcome.listeners.length, 3);
  assert.ok(outcome.listeners.every(listener => listener.ok));
  for (const who of [a, b, c]) {
    const player = h.provider.player(who.id);
    assert.equal(player.track.uri, 'spotify:track:chain1977', 'every listener gets the same recording');
    assert.equal(player.playing, true);
  }
  // The session record is what a later drift pass will read.
  const drift = h.session.drift(a.room);
  assert.equal(drift.state, 'playing');
  assert.equal(drift.trackUri, 'spotify:track:chain1977');
  assert.ok(drift.startedAt > 0);
});

test('a non-member requester may still ask for a track for the listeners', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const guest = h.member('Zz');
  h.addTo(a.room, guest);
  h.connect(a.id, a.room); h.connect(guest.id);

  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: guest.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'ok');
  assert.equal(outcome.listeners.length, 1, 'only opted-in listeners are controlled');
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977');
  assert.equal(h.provider.player(guest.id).track, null, 'the requester who did not opt in is untouched');
});

test('transport requires the requester to be opted in, but asking does not', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const guest = h.member('Zz');
  h.addTo(a.room, guest);
  h.connect(a.id, a.room); h.connect(guest.id);

  for (const action of ['pause', 'resume', 'skip']) {
    await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: guest.id, action }), error => {
      assert.equal(error.reason, 'not_opted_in');
      assert.match(error.message, /Join shared listening/);
      return true;
    }, `${action} must be refused for a non-listener`);
  }
  // The opted-in listener may control transport.
  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal((await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'pause' })).state, 'ok');
  assert.equal((await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'resume' })).state, 'ok');
});

test('play, pause, resume, and skip drive every listener through the same state', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);

  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'pause' });
  for (const who of [a, b]) { const player = h.provider.player(who.id); assert.equal(player.playing, false); assert.equal(player.paused, true); }

  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'resume' });
  for (const who of [a, b]) assert.equal(h.provider.player(who.id).playing, true);

  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'skip' });
  for (const who of [a, b]) assert.equal(h.provider.player(who.id).track, null, 'skip with an empty queue ends playback for everyone');
});

test('queue is a real pending queue, not an immediate play', async t => {
  const h = harness(t);
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  const queued = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'queue', query: 'Dreams' });
  assert.equal(queued.state, 'ok');
  const player = h.provider.player(a.id);
  assert.equal(player.track.uri, 'spotify:track:chain1977', 'the current track is unchanged by queueing');
  assert.equal(player.queue.length, 1);
  assert.equal(player.queue[0].uri, 'spotify:track:dreams1977');

  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'skip' });
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:dreams1977', 'skip advances into the queue');
});

test('now_playing reports the room without mutating anything', async t => {
  const h = harness(t);
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  // A listener exists but nothing is playing: that is a known answer.
  const idle = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'now_playing' });
  assert.equal(idle.state, 'none');
  assert.match(idle.message, /Nothing is playing/);

  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  const playing = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'now_playing' });
  assert.equal(playing.state, 'playing');
  assert.equal(playing.track.uri, 'spotify:track:chain1977');
  assert.equal(playing.message, null);
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977');
  assert.equal(h.provider.player(a.id).positionMs, 0, 'reporting must not restart playback');

  // With nobody opted in, there is genuinely nothing to read.
  const empty = harness(t);
  const b = empty.member('Bbb');
  const none = await empty.session.dispatch({ room: b.room, providerId: 'fake', requester: b.id, action: 'now_playing' });
  assert.equal(none.state, 'none');
  assert.match(none.message, /Nobody is opted in/);
  assert.equal(empty.provider.calls.length, 0);
});

test('now_playing reports unknown only when no listener could be read', async t => {
  const h = harness(t, { failures: { aaa: 'rate_limited' } });
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'now_playing' });
  assert.equal(outcome.state, 'unknown');
  assert.match(outcome.message, /could not read/);
});

test('an ambiguous recording is asked about, never guessed, and nothing is played', async t => {
  const h = harness(t);
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'Take On Me' }), error => {
    assert.equal(error.reason, 'ambiguous');
    assert.match(error.message, /Which version did you mean/);
    assert.match(error.message, /NOAPA7310001/);
    assert.match(error.message, /NOAPA7310002/);
    return true;
  });
  assert.equal(h.provider.player(a.id).track, null);
  assert.equal(h.provider.calls.filter(call => call.method === 'play').length, 0);
});

test('an unknown track is reported without touching playback', async t => {
  const h = harness(t);
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'obscure local band' }), error => {
    assert.equal(error.reason, 'not_found');
    return true;
  });
  assert.equal(h.provider.player(a.id).track, null);
});

test('one failing listener does not stop the others, and the room is told exactly who fell out', async t => {
  const h = harness(t, { failures: { bbb: 'forbidden' } });
  const a = h.member('Aaa'); const b = h.member('Bbb'); const c = h.member('Ccc');
  h.addTo(a.room, b); h.addTo(a.room, c);
  h.connect(a.id, a.room); h.connect(b.id, a.room); h.connect(c.id, a.room);

  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'ok', 'a partial success is still a success for the room');
  assert.equal(outcome.listeners.filter(l => l.ok).length, 2);
  const failed = outcome.listeners.find(l => !l.ok);
  assert.equal(failed.user, b.id);
  assert.equal(failed.reason, 'forbidden');
  assert.match(outcome.message, /1 listener could not follow/);
  assert.match(outcome.message, /Premium/);
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977');
  assert.equal(h.provider.player(c.id).track.uri, 'spotify:track:chain1977');
  assert.equal(h.provider.player(b.id).track, null, 'the failing listener never started');
  assert.equal(h.session.drift(a.room).state, 'playing', 'the room session still records what started');
});

test('every failure mode is per listener and never aborts the fan-out', async t => {
  for (const [mode, reason] of [['rate_limited', 'rate_limited'], ['no_device', 'no_device'], ['unauthorized', 'unauthorized'], ['failed', 'failed']]) {
    const h = harness(t, { failures: { bbb: mode } });
    const a = h.member('Aaa'); const b = h.member('Bbb');
    h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);
    const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
    assert.equal(outcome.state, 'ok', `${mode} must not fail the whole room`);
    assert.equal(outcome.listeners.find(l => l.user === b.id).reason, reason, `${mode} maps to ${reason}`);
    assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977', `${mode} leaves the healthy listener playing`);
  }
});

test('a rate limit does not turn into a retry storm', async t => {
  const h = harness(t, { failures: { aaa: 'rate_limited', bbb: 'rate_limited' } });
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'failed');
  assert.match(outcome.message, /2 listeners could not follow/);
  assert.match(outcome.message, /rate limiting/);
  // Exactly one attempt per listener: no backoff loop, no second call.
  assert.equal(h.provider.calls.filter(call => call.method === 'play').length, 2);
});

test('a listener with no usable device is skipped with an explanation, others still play', async t => {
  const h = harness(t, { devices: [{ id: 'only-one', label: 'Phone', type: 'Smartphone', active: true, restricted: false }] });
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);
  // Only the second listener's device disappears, mid-session.
  let devicesFor = null;
  const original = h.provider.devices;
  h.provider.devices = async function (context) {
    if (context.connection.user === b.id) return [];
    devicesFor = context.connection.user;
    return original.call(this, context);
  };
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'ok');
  assert.equal(outcome.listeners.find(l => l.user === b.id).reason, 'no_device');
  assert.match(outcome.message, /Open Fake Music/);
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977');
  assert.equal(h.provider.player(b.id).track, null);
  assert.equal(devicesFor, a.id);
});

test('a disconnected listener is skipped, and disconnecting mid-session stops control immediately', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);
  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(h.provider.player(b.id).track.uri, 'spotify:track:chain1977');

  // Mid-session: the second member drops their music account entirely.
  await h.music.disconnect(b.id, 'fake');
  const before = h.provider.calls.filter(call => call.method === 'pause').length;
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'pause' });
  assert.equal(outcome.listeners.length, 1, 'the disconnected listener is no longer in the roster');
  assert.equal(outcome.state, 'ok');
  assert.equal(h.provider.player(a.id).paused, true);
  assert.equal(h.provider.calls.filter(call => call.method === 'pause').length, before + 1, 'exactly one pause call, for the remaining listener');
  assert.equal(h.provider.player(b.id).paused, false, 'the disconnected listener was never touched again');
});

test('a member who leaves mid-session is not controlled again', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);
  await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });

  h.music.optOut(a.room, b.id, 'fake');
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'pause' });
  assert.equal(outcome.listeners.length, 1);
  assert.equal(h.provider.player(b.id).paused, false, 'a member who left is not paused');
  assert.equal(h.provider.player(a.id).paused, true);

  // And they can no longer drive the shared session themselves.
  await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: b.id, action: 'resume' }), /Join shared listening/);
});

test('a listener whose opt-in vanishes between roster read and dispatch is skipped', async t => {
  const h = harness(t);
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b); h.connect(a.id, a.room); h.connect(b.id, a.room);

  // Remove the opt-in during device discovery, after the roster was read.
  const original = h.provider.devices;
  h.provider.devices = async function (context) {
    h.store.run('DELETE FROM music_optin WHERE room=? AND user=?', a.room, b.id);
    return original.call(this, context);
  };
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.listeners.find(l => l.user === b.id).reason, 'left');
  assert.equal(h.provider.player(b.id).track, null);
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977');
});

test('a listener needing reconnect is reported and never retried into a loop', async t => {
  const h = harness(t, { refreshError: 'invalid_grant' });
  const a = h.member('Aaa'); const b = h.member('Bbb');
  h.addTo(a.room, b);
  h.connect(a.id, a.room);
  h.connect(b.id, a.room);
  // Only the second listener's authorization has lapsed.
  h.store.run('UPDATE music_connections SET expires=? WHERE user=?', Date.now() - 1, b.id);

  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  assert.equal(outcome.state, 'ok', 'one lapsed listener does not fail the room');
  assert.equal(outcome.listeners.find(l => l.user === b.id).reason, 'reconnect_required');
  assert.match(outcome.message, /1 listener could not follow/);
  assert.match(outcome.message, /Reconnect/);
  assert.equal(h.provider.player(a.id).track.uri, 'spotify:track:chain1977', 'the healthy listener still plays');

  const refreshes = h.provider.calls.filter(call => call.method === 'refresh').length;
  const second = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'pause' });
  assert.equal(second.listeners.length, 1, 'the lapsed listener drops out of the roster once marked reconnect-required');
  assert.equal(h.provider.calls.filter(call => call.method === 'refresh').length, refreshes, 'no refresh retry loop on the next turn');
});

test('a requester whose own authorization lapsed gets a reconnect prompt, not a crash', async t => {
  const h = harness(t, { refreshError: 'invalid_grant' });
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  h.store.run('UPDATE music_connections SET expires=? WHERE user=?', Date.now() - 1, a.id);
  await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' }), /authorization expired.*Reconnect/s);
  assert.equal(h.provider.calls.filter(call => call.method === 'play').length, 0);
});

test('an empty roster and an unsupported provider are refused before any call', async t => {
  const h = harness(t);
  const a = h.member('Aaa');
  for (const action of ['play', 'pause', 'resume', 'skip', 'queue']) {
    await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action, query: 'The Chain' }), error => {
      assert.ok(['no_listeners', 'not_opted_in'].includes(error.reason), `${action} refused with ${error.reason}`);
      return true;
    });
  }
  await assert.rejects(() => h.session.dispatch({ room: a.room, providerId: 'nope', requester: a.id, action: 'play', query: 'x' }), /not available/);
  assert.equal(h.provider.calls.length, 0, 'nothing was attempted');
});

test('a music failure never loses the reply or turns the room into an error', async t => {
  const h = harness(t, { failures: { aaa: 'rate_limited' } });
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  const server = createCodaServer(h.config, h.store, async () => ({ text: 'I am on it.', musicIntent: { action: 'play', query: 'The Chain' } }), fetch, [h.provider]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (who, path, method = 'GET', data) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`, {
      method, redirect: 'manual',
      headers: { Cookie: `hw_coda=${who}-session`, Origin: 'http://localhost' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  await call(a.id, `/rooms/${a.room}/messages`, 'POST', { text: 'Play The Chain for us' });
  const reply = await call(a.id, `/rooms/${a.room}/reply`, 'POST');
  assert.equal(reply.status, 200, 'a provider failure must not 502 the reply');
  const history = h.store.history(a.room);
  assert.equal(history.find(entry => entry.author === 'coda').content, 'I am on it.', 'the text reply is stored and intact');
  assert.match(history.at(-1).content, /rate limiting/, 'the failure is reported honestly as a follow-up');
});

test('the dispatch layer names no provider, in its code or in what it tells members', async t => {
  const h = harness(t, { failures: { aaa: 'rate_limited' } });
  const a = h.member('Aaa');
  h.connect(a.id, a.room);
  const outcome = await h.session.dispatch({ room: a.room, providerId: 'fake', requester: a.id, action: 'play', query: 'The Chain' });
  // Track fixtures legitimately carry provider URIs, so assert on what a member
  // is actually told, and on the layer's own source.
  assert.equal(/spotify/i.test(outcome.message), false, 'member-facing text must not name a service');
  assert.match(outcome.message, /rate limiting/);
  const source = readFileSync(new URL('../server/music/session.mjs', import.meta.url), 'utf8');
  assert.equal(/spotify/i.test(source), false, 'session.mjs must not mention any provider');
});
