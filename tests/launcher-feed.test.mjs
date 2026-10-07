import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLauncherFeedServer } from '../server/launcher-feed.mjs';

function makeDataDir() {
  const dir = mkdtempSync(join(tmpdir(), 'hw-launcher-feed-'));
  writeFileSync(join(dir, 'news.json'), JSON.stringify({
    schema: 1,
    items: [{ id: 'one', date: '2026-10-07', title: 'Test', text: 'Hello' }]
  }));
  writeFileSync(join(dir, 'status.json'), JSON.stringify({
    schema: 1, apiVersion: 1, project: 'Howling Whispers'
  }));
  return dir;
}

test('launcher feed serves public read-only JSON', async t => {
  const server = createLauncherFeedServer({ dataDir: makeDataDir() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();

  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true, service: 'hw-launcher-feed', apiVersion: 1
  });
  assert.equal(health.headers.get('access-control-allow-origin'), '*');

  const news = await fetch(`http://127.0.0.1:${port}/api/news`);
  assert.equal(news.status, 200);
  assert.equal((await news.json()).items[0].title, 'Test');

  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /CodaLauncher Feed/);

  const post = await fetch(`http://127.0.0.1:${port}/api/news`, { method: 'POST' });
  assert.equal(post.status, 405);
});
