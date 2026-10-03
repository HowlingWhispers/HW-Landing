import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, token, hash } from './store.mjs';
import { askKilo } from './kilo.mjs';

export function createCodaServer(config, store, generate = askKilo, fetchImpl = fetch) {
  const busy = new Set(); const rates = new Map();
  const cookieName = 'hw_coda';
  const secure = config.origin.startsWith('https:');
  const cookie = (name, value, seconds) => `${name}=${value}; Path=/coda; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
  function limit(key, max) {
    const now = Date.now(); const old = rates.get(key);
    const row = old && old.until > now ? old : { count: 0, until: now + 60_000 };
    if (rates.size > 10_000) for (const [k,v] of rates) if (v.until < now) rates.delete(k);
    rates.set(key, row); if (++row.count > max) fail(429, 'Too many requests. Please wait a minute.');
  }
  function fail(status, message) { throw Object.assign(new Error(message), { status }); }
  async function body(req) {
    let data = ''; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 32_000) fail(413, 'Message is too large.'); }
    try { return JSON.parse(data); } catch { fail(400, 'Please send a valid request.'); }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const redirect = (url, cookies) => { if (cookies) res.setHeader('Set-Cookie', cookies); res.writeHead(302, { Location: url }); res.end(); };
    try {
      const url = new URL(req.url, config.origin); const path = url.pathname;
      const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=')));
      // The app is same-origin only; browsers must supply this exact Origin for every mutation.
      if (req.method !== 'GET' && req.headers.origin !== config.origin) fail(403, 'Request origin was not accepted.');
      if (path === '/coda/api/health' && req.method === 'GET') return send(200, { ok: true });
      if (path === '/coda/api/login' && req.method === 'GET') {
        limit(req.socket.remoteAddress + ':login', 20);
        if (!config.clientId || !config.clientSecret) fail(503, 'Discord sign-in is not configured yet.');
        store.run('DELETE FROM oauth WHERE expires<?', Date.now());
        const state = token(); store.run('INSERT INTO oauth VALUES(?,?)', hash(state), Date.now() + 600_000);
        const auth = new URL('https://discord.com/oauth2/authorize');
        auth.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.origin + '/coda/api/callback', response_type: 'code', scope: 'identify', state }).toString();
        return redirect(auth.href, cookie('hw_coda_state', state, 600));
      }
      if (path === '/coda/api/callback' && req.method === 'GET') {
        const state = url.searchParams.get('state'); const code = url.searchParams.get('code');
        if (!state || !code || state !== cookies.hw_coda_state || !store.get('SELECT 1 FROM oauth WHERE token=? AND expires>?', hash(state), Date.now())) fail(400, 'Sign-in expired. Please start again.');
        store.run('DELETE FROM oauth WHERE token=?', hash(state));
        const response = await fetchImpl('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'authorization_code', code, redirect_uri: config.origin + '/coda/api/callback' }), signal: AbortSignal.timeout(15_000) });
        if (!response.ok) fail(502, 'Discord sign-in failed. Please try again.');
        const credentials = await response.json();
        const profile = await fetchImpl('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(15_000) });
        if (!profile.ok) fail(502, 'Discord could not confirm your account.');
        const user = await profile.json();
        if (!/^\d{17,20}$/.test(user.id)) fail(502, 'Discord returned an invalid account.');
        store.run('INSERT INTO users VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name', user.id, String(user.global_name || user.username).slice(0,100));
        store.run('DELETE FROM sessions WHERE expires<?', Date.now());
        const session = token(); store.run('INSERT INTO sessions VALUES(?,?,?)', hash(session), user.id, Date.now() + 7 * 86400_000);
        return redirect('/coda', [cookie(cookieName, session, 7*86400), cookie('hw_coda_state', '', 0)]);
      }
      const session = cookies[cookieName] && store.get('SELECT u.id,u.name FROM sessions s JOIN users u ON u.id=s.user WHERE s.token=? AND s.expires>?', hash(cookies[cookieName]), Date.now());
      if (path === '/coda/api/me' && req.method === 'GET') return send(200, { user: session || null, configured: Boolean(config.clientId && config.clientSecret), providerReady: Boolean(config.kiloPassword) });
      if (!session) fail(401, 'Sign in with Discord to enter your den.');
      limit(session.id + ':requests', 120);
      if (path === '/coda/api/logout' && req.method === 'POST') { store.run('DELETE FROM sessions WHERE token=?', hash(cookies[cookieName])); res.setHeader('Set-Cookie', cookie(cookieName, '', 0)); return send(200, { ok: true }); }
      if (path === '/coda/api/rooms' && req.method === 'GET') return send(200, { rooms: store.all('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=? ORDER BY r.created DESC', session.id) });
      if (path === '/coda/api/rooms' && req.method === 'POST') {
        const data = await body(req); const title = String(data.title || '').trim().slice(0,80);
        if (!title) fail(400, 'Give your room a name.');
        if (store.get('SELECT COUNT(*) AS n FROM rooms WHERE owner=?', session.id).n >= 30) fail(409, 'You already have 30 rooms. Delete an old room first.');
        return send(201, { id: store.createRoom(session.id, title) });
      }
      if (path === '/coda/api/join' && req.method === 'POST') {
        limit(session.id + ':join', 10); const data = await body(req);
        try { return send(200, { id: store.redeem(String(data.token || ''), session.id) }); } catch(e) { fail(400,e.message); }
      }
      const match = path.match(/^\/coda\/api\/rooms\/([a-f0-9-]+)(?:\/(messages|invite|reply|members))?$/);
      if (!match) fail(404, 'That page could not be found.');
      const [, id, action] = match;
      if (!store.member(id, session.id)) fail(404, 'That room could not be found.');
      const room = store.get('SELECT * FROM rooms WHERE id=?', id);
      const owner = () => { if (room.owner !== session.id) fail(403, 'Only the room host can change this.'); };
      if (!action && req.method === 'GET') return send(200, { room, messages: store.history(id), members: store.all('SELECT u.id,u.name FROM users u JOIN members m ON m.user=u.id WHERE m.room=?', id), busy: busy.has(id) });
      if (!action && req.method === 'PATCH') {
        owner(); const data = await body(req);
        if (data.title === undefined && data.mode === undefined) fail(400,'Nothing to change.');
        const title = data.title === undefined ? undefined : String(data.title || '').trim().slice(0,80);
        if (title !== undefined && !title) fail(400,'Give your conversation a name.');
        if (data.mode !== undefined && !['reply','listen'].includes(data.mode)) fail(400,'Choose reply or listen.');
        if (title !== undefined) store.run('UPDATE rooms SET title=? WHERE id=?',title,id);
        if (data.mode !== undefined) store.run('UPDATE rooms SET mode=? WHERE id=?',data.mode,id);
        return send(200,{ok:true});
      }
      if (!action && req.method === 'DELETE') { owner(); if (busy.has(id)) fail(409,'Wait for Coda to finish before deleting this room.'); store.run('DELETE FROM rooms WHERE id=?',id); return send(200,{ok:true}); }
      if (action === 'members' && req.method === 'DELETE') {
        const data = await body(req); const target = String(data.userId || '');
        // Anyone may remove themselves; removing a fellow member stays host-only.
        if (target === room.owner) fail(400,'The host cannot leave or be removed. Delete the conversation instead.');
        if (target !== session.id) owner();
        store.run('DELETE FROM members WHERE room=? AND user=?',id,target); return send(200,{ok:true});
      }
      if (action === 'invite' && req.method === 'POST') {
        owner(); limit(session.id + ':invite', 10); store.run('DELETE FROM invites WHERE expires<?',Date.now());
        const invite = token(); store.run('INSERT INTO invites VALUES(?,?,?)',hash(invite),id,Date.now()+86400_000);
        return send(200,{url:config.origin+'/coda#invite='+invite});
      }
      if (action === 'invite' && req.method === 'DELETE') { owner(); store.run('DELETE FROM invites WHERE room=?',id); return send(200,{ok:true}); }
      if (action === 'messages' && req.method === 'POST') {
        limit(session.id + ':messages', 20); const data = await body(req); const text = typeof data.text === 'string' ? data.text.trim() : '';
        if (!text || text.length > 8000) fail(400,'Write a message of up to 8,000 characters.');
        store.addMessage(id,session.id,session.name,text); return send(201,{ok:true});
      }
      if (action === 'reply' && req.method === 'POST') {
        limit(session.id + ':generation', 6); if (busy.has(id)) fail(409,'Coda is already answering this room.');
        const history = store.history(id);
        if (!history.length || history.at(-1).author === 'coda') fail(409,'Send a new message before asking Coda again.');
        busy.add(id);
        try {
          const reply = await generate(config,id,history);
          // A participant removed during generation must not receive room content.
          store.addMessage(id,'coda','Coda',reply);
          if (!store.member(id,session.id)) fail(404,'That room could not be found.');
          return send(200,{ok:true});
        } finally { busy.delete(id); }
      }
      fail(405,'That action is not available.');
    } catch(e) { send(e.status || 502, { error: e.status ? e.message : 'Coda could not connect right now. Your messages are saved; try Ask Coda again.' }); }
  });
  server.requestTimeout = 120_000;
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = process.env; const origin = env.CODA_WEB_ORIGIN || 'https://thehowlingwhispers.com';
  if (new URL(origin).origin !== origin) throw new Error('CODA_WEB_ORIGIN must be an origin without a trailing slash');
  const path = env.CODA_WEB_DB || '/var/lib/hw-coda-web/rooms.sqlite'; mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const store = openStore(path);
  const config = { origin, clientId: env.DISCORD_BOT_CLIENT_ID || env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET, kiloUrl: env.CODA_KILO_BASE_URL || 'http://127.0.0.1:4096', kiloUsername: env.KILO_SERVER_USERNAME || 'kilo', kiloPassword: env.KILO_SERVER_PASSWORD, kiloModel: env.CODA_KILO_MODEL || 'kilo/kilo-auto/free' };
  const server = createCodaServer(config,store);
  server.listen(Number(env.CODA_WEB_PORT || 3218),'127.0.0.1',()=>console.log('Coda Web listening on loopback'));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.db.close();process.exit(0);}));
}
