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
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY, room TEXT REFERENCES rooms(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
  `);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  return { db, get, all, run,
    member: (room, user) => Boolean(get('SELECT 1 FROM members WHERE room=? AND user=?', room, user)),
    createRoom(user, title) {
      const id = randomUUID();
      db.exec('BEGIN');
      try { run('INSERT INTO rooms(id,owner,title,created) VALUES(?,?,?,?)', id, user, title, Date.now()); run('INSERT INTO members VALUES(?,?)', id, user); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
      return id;
    },
    history: room => all('SELECT * FROM (SELECT seq,author,name,content,created FROM messages WHERE room=? ORDER BY seq DESC LIMIT 80) ORDER BY seq', room),
    addMessage: (room, author, name, content) => run('INSERT INTO messages(room,author,name,content,created) VALUES(?,?,?,?,?)', room, author, name, content, Date.now()),
    redeem(invite, user) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = get('SELECT room FROM invites WHERE token=? AND expires>?', hash(invite), Date.now());
        if (!row) throw new Error('This invitation has expired or has already been used.');
        run('INSERT OR IGNORE INTO members VALUES(?,?)', row.room, user);
        run('DELETE FROM invites WHERE token=?', hash(invite)); db.exec('COMMIT'); return row.room;
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
