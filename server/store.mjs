import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user TEXT REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, owner TEXT REFERENCES users(id), title TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'reply', created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members(room TEXT REFERENCES rooms(id) ON DELETE CASCADE, user TEXT REFERENCES users(id), PRIMARY KEY(room,user));
    CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT REFERENCES rooms(id) ON DELETE CASCADE, author TEXT NOT NULL, name TEXT NOT NULL, content TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, uploader TEXT NOT NULL REFERENCES users(id), filename TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, storage_path TEXT NOT NULL UNIQUE, created INTEGER NOT NULL, attached INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS message_images(message_seq INTEGER NOT NULL REFERENCES messages(seq) ON DELETE CASCADE, image TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, PRIMARY KEY(message_seq,image), UNIQUE(message_seq,ordinal));
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY, room TEXT REFERENCES rooms(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS music_connections(user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, access_sealed TEXT, refresh_sealed TEXT, expires INTEGER, scopes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'connected', authorized_at INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(user, provider));
    CREATE TABLE IF NOT EXISTS music_optin(room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, device_hint TEXT, joined INTEGER NOT NULL, PRIMARY KEY(room, user, provider));
    CREATE TABLE IF NOT EXISTS music_oauth(token TEXT PRIMARY KEY, provider TEXT NOT NULL, user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
  `);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const history = (room, includePaths = false) => {
    const messages = all('SELECT * FROM (SELECT seq,author,name,content,created FROM messages WHERE room=? ORDER BY seq DESC LIMIT 80) ORDER BY seq', room);
    const images = all(`SELECT mi.message_seq,i.id,i.filename,i.alt,i.mime,i.size,i.width,i.height,i.storage_path FROM message_images mi JOIN images i ON i.id=mi.image JOIN messages m ON m.seq=mi.message_seq WHERE m.room=? ORDER BY mi.message_seq,mi.ordinal`, room);
    return messages.map(message => ({ ...message, images: images.filter(image => image.message_seq === message.seq).map(image => ({ id:image.id,filename:image.filename,alt:image.alt,mime:image.mime,size:image.size,width:image.width,height:image.height,url:`/coda/api/rooms/${room}/images/${image.id}`,...(includePaths?{storagePath:image.storage_path}:{}) })) }));
  };
  return { db, get, all, run,
    member: (room, user) => Boolean(get('SELECT 1 FROM members WHERE room=? AND user=?', room, user)),
    createRoom(user, title) {
      const id = randomUUID();
      db.exec('BEGIN');
      try { run('INSERT INTO rooms(id,owner,title,created) VALUES(?,?,?,?)', id, user, title, Date.now()); run('INSERT INTO members VALUES(?,?)', id, user); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
      return id;
    },
    history: room => history(room),
    generationHistory: room => history(room,true),
    addImage: image => run('INSERT INTO images(id,room,uploader,filename,alt,mime,size,width,height,storage_path,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)', image.id,image.room,image.uploader,image.filename,image.alt,image.mime,image.size,image.width,image.height,image.path,Date.now()),
    addMessage(room, author, name, content, imageIds = []) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (imageIds.length > 4 || new Set(imageIds).size !== imageIds.length) throw Object.assign(new Error('Attach up to four distinct images.'),{status:400});
        const images = imageIds.map(id => get('SELECT * FROM images WHERE id=? AND room=? AND uploader=? AND attached=0 AND created>?',id,room,author,Date.now()-3600_000));
        if (images.some(image=>!image)) throw Object.assign(new Error('One of those images is unavailable or already attached.'),{status:400});
        if (images.reduce((sum,image)=>sum+image.size,0)>16*1024*1024) throw Object.assign(new Error('Attached images may total up to 16 MiB.'),{status:413});
        const result=run('INSERT INTO messages(room,author,name,content,created) VALUES(?,?,?,?,?)',room,author,name,content,Date.now());
        images.forEach((image,index)=>{run('INSERT INTO message_images VALUES(?,?,?)',result.lastInsertRowid,image.id,index);run('UPDATE images SET attached=1 WHERE id=?',image.id);}); db.exec('COMMIT'); return result;
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    },
    redeem(invite, user) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = get('SELECT room FROM invites WHERE token=? AND expires>?', hash(invite), Date.now());
        if (!row) throw new Error('This invitation has expired or has already been used.');
        run('INSERT OR IGNORE INTO members VALUES(?,?)', row.room, user);
        run('DELETE FROM invites WHERE token=?', hash(invite)); db.exec('COMMIT'); return row.room;
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    saveMusicConnection: record => run(
      'INSERT INTO music_connections(user,provider,access_sealed,refresh_sealed,expires,scopes,status,authorized_at,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user,provider) DO UPDATE SET access_sealed=excluded.access_sealed, refresh_sealed=excluded.refresh_sealed, expires=excluded.expires, scopes=excluded.scopes, status=excluded.status, updated=excluded.updated',
      record.user, record.provider, record.accessSealed, record.refreshSealed, record.expires, record.scopes, record.status, record.authorizedAt, Date.now(),
    ),
    // Terminal for a rejected refresh: the sealed material is destroyed and the
    // member is told to reconnect. The row survives only to carry that state.
    markMusicReconnectRequired: (user, provider) => run('UPDATE music_connections SET access_sealed=NULL, refresh_sealed=NULL, expires=NULL, status=?, updated=? WHERE user=? AND provider=?', 'reconnect_required', Date.now(), user, provider),
    // Disconnect is local and total: the connection row and every opt-in this
    // member held in any room go away together, so control stops immediately.
    removeMusicConnection(user, provider) {
      db.exec('BEGIN IMMEDIATE');
      try { run('DELETE FROM music_optin WHERE user=? AND provider=?', user, provider); run('DELETE FROM music_connections WHERE user=? AND provider=?', user, provider); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
