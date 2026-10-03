import fs from 'node:fs/promises';
import sharp from 'sharp';
const source = new URL('../public/coda-social-preview.svg', import.meta.url);
const artwork = new URL('../public/art/coda-workshop.webp', import.meta.url);
const output = new URL('../public/coda-social-preview.png', import.meta.url);
const png = await sharp(await fs.readFile(artwork)).png().toBuffer();
const svg = (await fs.readFile(source, 'utf8')).replace('art/coda-workshop.webp', `data:image/png;base64,${png.toString('base64')}`);
await sharp(Buffer.from(svg)).png().toFile(output.pathname);
