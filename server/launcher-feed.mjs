import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(HERE, '..', 'launcher-feed', 'data');
const DEFAULT_ASSET_DIR = join(HERE, '..', 'launcher-feed', 'assets');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadFeed(dataDir) {
  const news = readJson(join(dataDir, 'news.json'));
  const status = readJson(join(dataDir, 'status.json'));
  if (!Array.isArray(news.items)) throw new Error('launcher news.json must contain an items array');
  return { news, status };
}

function commonHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  };
}

function sendJson(req, res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    ...commonHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store'
  });
  if (req.method === 'HEAD') return res.end();
  res.end(text);
}

function sendFile(req, res, path) {
  if (!existsSync(path)) return sendJson(req, res, 404, { error: 'asset not found' });
  const stat = statSync(path);
  res.writeHead(200, {
    ...commonHeaders(),
    'Content-Type': 'application/zip',
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=3600',
    'Content-Disposition': 'attachment; filename="' + basename(path) + '"'
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(path).pipe(res);
}

function sendHtml(req, res, body) {
  res.writeHead(200, {
    ...commonHeaders(),
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'public, max-age=60',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  });
  if (req.method === 'HEAD') return res.end();
  res.end(body);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}

function page(feed) {
  const cards = feed.news.items.map(item => `
    <article>
      <div class="date">${escapeHtml(item.date || '')}</div>
      <h2>${escapeHtml(item.title || '')}</h2>
      <p>${escapeHtml(item.text || '')}</p>
    </article>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Howling Whispers Launcher Feed</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#091116;color:#e7f6ff}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 0%,#173341 0,#091116 42%);padding:48px 20px}
main{max-width:900px;margin:auto}
header{display:flex;justify-content:space-between;gap:24px;align-items:end;border-bottom:1px solid #284755;padding-bottom:22px;margin-bottom:28px}
h1{margin:0;font-size:clamp(2rem,5vw,4.5rem);letter-spacing:.04em}
.sub{color:#9cc9dc}.badge{border:1px solid #3f7286;border-radius:999px;padding:8px 12px;color:#aeeaff;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
article{background:#0e1b22cc;border:1px solid #233f4d;border-radius:16px;padding:20px;box-shadow:0 18px 50px #0005}
h2{margin:.3rem 0 .7rem;font-size:1.15rem}p{margin:0;color:#c4dbe5;line-height:1.55}
.date{font-size:.78rem;color:#78b8d0;text-transform:uppercase;letter-spacing:.12em}
footer{margin-top:30px;color:#7194a3;font-size:.85rem}code{color:#aeeaff}
</style>
</head>
<body><main>
<header><div><div class="sub">HOWLING WHISPERS</div><h1>CodaLauncher Feed</h1><div class="sub">News and status for CodaLauncher.</div></div><div class="badge">API v${escapeHtml(String(feed.status.apiVersion || 1))}</div></header>
<section class="grid">${cards}</section>
<footer>Machine endpoints: <code>/api/health</code> · <code>/api/news</code> · <code>/api/status</code> · <code>/api/feed</code></footer>
</main></body></html>`;
}

export function createLauncherFeedServer({
  dataDir = DEFAULT_DATA_DIR,
  assetDir = DEFAULT_ASSET_DIR
} = {}) {
  return createServer((req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...commonHeaders(),
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Max-Age': '86400'
        });
        return res.end();
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD, OPTIONS');
        return sendJson(req, res, 405, { error: 'read-only launcher feed' });
      }

      const url = new URL(req.url, 'http://launcher-feed.local');
      const feed = loadFeed(dataDir);

      if (url.pathname === '/api/health') return sendJson(req, res, 200, { ok: true, service: 'hw-launcher-feed', apiVersion: feed.status.apiVersion || 1 });
      if (url.pathname === '/api/news') return sendJson(req, res, 200, feed.news);
      if (url.pathname === '/api/status') return sendJson(req, res, 200, feed.status);
      if (url.pathname === '/api/feed') return sendJson(req, res, 200, { ...feed.status, news: feed.news.items });
      if (url.pathname === '/assets/CML-Base-Resources-v1.zip'
          || url.pathname === '/assets/CML-BasePack-v1.zip') {
        return sendFile(req, res, join(assetDir, 'CML-Base-Resources-v1.zip'));
      }
      if (url.pathname === '/' || url.pathname === '/index.html') return sendHtml(req, res, page(feed));
      return sendJson(req, res, 404, { error: 'not found' });
    } catch (error) {
      console.error('[launcher-feed] request failed', { path: req.url, message: error.message });
      return sendJson(req, res, 500, { error: 'launcher feed unavailable' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const host = process.env.LAUNCHER_FEED_HOST || '127.0.0.1';
  const port = Number(process.env.LAUNCHER_FEED_PORT || 3220);
  const dataDir = process.env.LAUNCHER_FEED_DATA || DEFAULT_DATA_DIR;
  const assetDir = process.env.LAUNCHER_FEED_ASSETS || DEFAULT_ASSET_DIR;
  const server = createLauncherFeedServer({ dataDir, assetDir });
  server.listen(port, host, () => {
    console.log(`[launcher-feed] listening on http://${host}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
