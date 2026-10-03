import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, token, hash } from './store.mjs';
import { askKilo } from './kilo.mjs';
import { IMAGE_COUNT_LIMIT, normalizeImage, readImageBody, readStoredImage, removeStoredImage } from './image-files.mjs';

export function createCodaServer(config, store, generate = askKilo, fetchImpl = fetch) {
  const busy = new Set(); const rates = new Map();
  const headerText = value => { try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); } };
  const purgeExpiredImages = () => { const expired=store.all('SELECT id,storage_path FROM images WHERE attached=0 AND created<?',Date.now()-3600_000);expired.forEach(image=>{store.run('DELETE FROM images WHERE id=?',image.id);removeStoredImage(image.storage_path);}); };
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
      if (path === '/coda/api/me' && req.method === 'GET') return send(200, { user: session || null, configured: Boolean(config.clientId && config.clientSecret), providerReady: Boolean(config.kiloPassword && config.orbisSecret) });
      if (!session) fail(401, 'Sign in with Discord to enter your den.');
      limit(session.id + ':requests', 120);
      if (path === '/coda/api/logout' && req.method === 'POST') { store.run('DELETE FROM sessions WHERE token=?', hash(cookies[cookieName])); res.setHeader('Set-Cookie', cookie(cookieName, '', 0)); return send(200, { ok: true }); }
      if (path === '/coda/api/memory' && req.method === 'GET') {
        const response = await fetchImpl(`${config.orbisMemoryUrl}/view?discordUserId=${encodeURIComponent(session.id)}&scope=dm`, { headers:{Authorization:`Bearer ${config.orbisSecret}`},signal:AbortSignal.timeout(15_000) });
        if (response.status===409) return send(200,{linked:false,profile:null,notes:[],audit:[]}); const data=await response.json(); if(!response.ok)fail(502,data.error||'Coda memory is unavailable.'); return send(200,{...data,linked:true});
      }
      if (path.startsWith('/coda/api/memory/') && req.method === 'POST') {
        const operation=path.slice('/coda/api/memory/'.length); const routes={profile:'profile',notes:'notes',correct:'notes/correct',visibility:'notes/visibility',forget:'notes/forget'}; if(!routes[operation])fail(404,'That memory action is not available.');
        const data=await body(req); delete data.discordUserId; if(operation==='notes'){data.kind='memory';data.provenance='member_stated';data.visibility=data.visibility||'private';} const response=await fetchImpl(`${config.orbisMemoryUrl}/${routes[operation]}`,{method:'POST',headers:{Authorization:`Bearer ${config.orbisSecret}`,'Content-Type':'application/json'},body:JSON.stringify({discordUserId:session.id,...data}),signal:AbortSignal.timeout(15_000)}); const result=await response.json(); if(!response.ok)fail(response.status<500?response.status:502,result.error||'Coda memory is unavailable.'); return send(200,result);
      }
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
      const imageMatch=path.match(/^\/coda\/api\/rooms\/([a-f0-9-]+)\/images(?:\/([a-f0-9-]+))?$/);
      if(imageMatch){const [,roomId,imageId]=imageMatch;if(!store.member(roomId,session.id))fail(404,'That image could not be found.');
        if(req.method==='POST'&&!imageId){limit(session.id+':images',10);purgeExpiredImages();if(!['image/png','image/jpeg','image/webp'].includes(String(req.headers['content-type']||'').split(';')[0]))fail(400,'Use a PNG, JPEG, or WebP image.');const image=await normalizeImage(await readImageBody(req),config.imageRoot,roomId,headerText(req.headers['x-coda-filename']));if(store.get('SELECT COALESCE(SUM(size),0) AS n FROM images WHERE room=?',roomId).n+image.size>200*1024*1024){removeStoredImage(image.path);fail(413,'This room has reached its 200 MiB image limit.');}const alt=headerText(req.headers['x-coda-alt']).trim().slice(0,500);store.addImage({...image,alt,room:roomId,uploader:session.id});return send(201,{image:{id:image.id,filename:image.filename,alt,mime:image.mime,size:image.size,width:image.width,height:image.height,url:`/coda/api/rooms/${roomId}/images/${image.id}`}});}
        const image=store.get('SELECT * FROM images WHERE id=? AND room=?',imageId,roomId);if(!image||(req.method==='GET'&&!image.attached)||(req.method==='DELETE'&&(image.attached||image.uploader!==session.id)))fail(404,'That image could not be found.');
        if(req.method==='GET'){const bytes=readStoredImage(image.storage_path);res.writeHead(200,{'Content-Type':image.mime,'Content-Length':bytes.length,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(image.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'});return res.end(bytes);}
        if(req.method==='DELETE'){store.run('DELETE FROM images WHERE id=?',image.id);removeStoredImage(image.storage_path);return send(200,{ok:true});}fail(405,'That image action is not available.');}
      const match = path.match(/^\/coda\/api\/rooms\/([a-f0-9-]+)(?:\/(messages|invite|reply|members|clear))?$/);
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
      if (!action && req.method === 'DELETE') { owner(); if (busy.has(id)) fail(409,'Wait for Coda to finish before deleting this room.'); const paths=store.all('SELECT storage_path FROM images WHERE room=?',id);store.run('DELETE FROM rooms WHERE id=?',id);paths.forEach(image=>removeStoredImage(image.storage_path));return send(200,{ok:true}); }
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
      if (action === 'clear' && req.method === 'DELETE') { owner(); if(busy.has(id))fail(409,'Wait for Coda to finish before clearing this room.');if(store.get('SELECT COUNT(*) AS n FROM members WHERE room=?',id).n>1)fail(409,'Remove invited members or start a new room before clearing shared history.');const paths=store.all('SELECT storage_path FROM images WHERE room=?',id);store.run('DELETE FROM images WHERE room=?',id);store.run('DELETE FROM messages WHERE room=?',id);paths.forEach(image=>removeStoredImage(image.storage_path));return send(200,{ok:true}); }
      if (action === 'messages' && req.method === 'POST') {
        limit(session.id + ':messages', 20); const data = await body(req); const text = typeof data.text === 'string' ? data.text.trim() : ''; const imageIds=Array.isArray(data.imageIds)?data.imageIds.map(String):[];
        if ((!text&&!imageIds.length) || text.length > 8000 || imageIds.length>IMAGE_COUNT_LIMIT) fail(400,'Write a message of up to 8,000 characters and attach up to four images.');
        if (/^\/(?:help|memory|format|clear)(?:\s|$)/i.test(text)) fail(400,'Browser Coda commands are private controls and cannot be stored as room messages.');
        store.addMessage(id,session.id,session.name,text,imageIds); return send(201,{ok:true});
      }
      if (action === 'reply' && req.method === 'POST') {
        limit(session.id + ':generation', 6); if (busy.has(id)) fail(409,'Coda is already answering this room.');
        const history = store.generationHistory(id);
        if (!history.length || history.at(-1).author === 'coda') fail(409,'Send a new message before asking Coda again.');
        busy.add(id);
        try {
          const memberCount = store.get('SELECT COUNT(*) AS n FROM members WHERE room=?',id).n;
          const reply = await generate(config,id,history,{ discordUserId: session.id, speakerName: session.name, privacyScope: memberCount === 1 ? 'dm' : 'guild' });
          // A participant removed during generation must not receive room content.
          store.addMessage(id,'coda','Coda',reply);
          if (!store.member(id,session.id)) fail(404,'That room could not be found.');
          return send(200,{ok:true});
        } finally { busy.delete(id); }
      }
      fail(405,'That action is not available.');
    } catch(e) { if(!e.status)console.error('[coda-web] request failed',{method:req.method,path:req.url,message:e.message});send(e.status || 502, { error: e.status ? e.message : 'Coda could not connect right now. Your messages are saved; try Ask Coda again.' }); }
  });
  server.requestTimeout = 120_000;
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = process.env; const origin = env.CODA_WEB_ORIGIN || 'https://thehowlingwhispers.com';
  if (new URL(origin).origin !== origin) throw new Error('CODA_WEB_ORIGIN must be an origin without a trailing slash');
  const path = env.CODA_WEB_DB || '/var/lib/hw-coda-web/rooms.sqlite'; mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const store = openStore(path);
  const config = { origin, clientId: env.DISCORD_BOT_CLIENT_ID || env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET, kiloUrl: env.CODA_KILO_BASE_URL || 'http://127.0.0.1:4096', kiloUsername: env.KILO_SERVER_USERNAME || 'kilo', kiloPassword: env.KILO_SERVER_PASSWORD, kiloModel: env.CODA_KILO_MODEL || 'kilo/kilo-auto/free', kiloVisionModel: env.CODA_KILO_VISION_MODEL || env.CODA_KILO_MODEL || 'kilo/kilo-auto/free', orbisUrl: env.CODA_ORBIS_BRIDGE_URL || 'http://127.0.0.1:8789/api/internal/coda-discord', orbisMemoryUrl: env.CODA_ORBIS_MEMORY_URL || 'http://127.0.0.1:8789/api/internal/coda-memory', orbisSecret: env.CODA_ORBIS_BRIDGE_SECRET, imageRoot: env.CODA_WEB_IMAGE_DIR || '/var/lib/hw-coda-web/images' };
  const server = createCodaServer(config,store);
  server.listen(Number(env.CODA_WEB_PORT || 3218),'127.0.0.1',()=>console.log('Coda Web listening on loopback'));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.db.close();process.exit(0);}));
}
