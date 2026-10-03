import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Music provider tokens never leave the server. They are sealed with AES-256-GCM
// under CODA_TOKEN_KEY so a database copy alone cannot play anything in a member's
// account. Nothing here ever returns plaintext to a client or to a log line.
const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

function key(config) {
  const raw = config?.tokenKey;
  if (!raw) throw Object.assign(new Error('Music token storage is not configured yet.'), { status: 503 });
  let material;
  try { material = Buffer.from(String(raw), 'base64'); } catch { material = Buffer.alloc(0); }
  if (material.length !== 32) throw Object.assign(new Error('CODA_TOKEN_KEY must be exactly 32 bytes, base64 encoded.'), { status: 503 });
  return material;
}

export function seal(config, value) {
  if (value === undefined || value === null || value === '') return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(config), iv);
  const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function open(config, sealed) {
  if (!sealed) return null;
  const parts = String(sealed).split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, key(config), Buffer.from(parts[1], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // A failed tag check means the row was tampered with or the key rotated.
    // Callers must treat this as "no usable token" rather than retrying.
    return null;
  }
}

// Correlation handle for logs: stable per token, never reversible.
export function fingerprint(value) {
  if (!value) return null;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}
