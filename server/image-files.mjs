import { mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const IMAGE_LIMIT = 8 * 1024 * 1024;
export const IMAGE_TOTAL_LIMIT = 16 * 1024 * 1024;
export const IMAGE_COUNT_LIMIT = 4;

export async function readImageBody(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > IMAGE_LIMIT) throw Object.assign(new Error('Images must be 8 MiB or smaller.'), { status: 413 });
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > IMAGE_LIMIT) throw Object.assign(new Error('Images must be 8 MiB or smaller.'), { status: 413 }); chunks.push(chunk); }
  if (!size) throw Object.assign(new Error('Choose an image to upload.'), { status: 400 });
  return Buffer.concat(chunks);
}

export function safeFilename(value) {
  const clean = String(value || 'image').replace(/[\0\r\n/\\"']/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  return clean || 'image';
}

export async function normalizeImage(buffer, root, room, suppliedName) {
  let metadata;
  try { metadata = await sharp(buffer, { animated: false, limitInputPixels: 40_000_000 }).metadata(); } catch { throw Object.assign(new Error('That file is not a valid supported image.'), { status: 400 }); }
  if (!['png','jpeg','webp'].includes(metadata.format) || (metadata.pages || 1) > 1 || !metadata.width || !metadata.height) throw Object.assign(new Error('Use a non-animated PNG, JPEG, or WebP image.'), { status: 400 });
  const id = randomUUID(); const directory = join(root, room); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const storageName = `${id}.webp`; const temporary = join(directory, `${id}.tmp`); const path = join(directory, storageName);
  try {
    const output = await sharp(buffer, { animated: false, limitInputPixels: 40_000_000 }).rotate().resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    if (output.length > IMAGE_LIMIT) throw Object.assign(new Error('The normalized image is too large.'), { status: 413 });
    const normalized = await sharp(output).metadata();
    writeFileSync(temporary, output, { mode: 0o600, flag: 'wx' }); renameSync(temporary, path);
    return { id, filename: safeFilename(suppliedName), mime: 'image/webp', size: output.length, width: normalized.width, height: normalized.height, storageName, path };
  } catch (error) { rmSync(temporary, { force: true }); rmSync(path, { force: true }); if (error.status) throw error; throw Object.assign(new Error('That image could not be processed safely.'), { status: 400 }); }
}

export function readStoredImage(path) { return readFileSync(path); }
export function removeStoredImage(path) { try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
