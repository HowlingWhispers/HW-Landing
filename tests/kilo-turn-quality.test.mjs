import test from 'node:test';
import assert from 'node:assert/strict';
import { askKilo } from '../server/kilo.mjs';

const config = { kiloPassword: 'secret', orbisSecret: 'bridge', kiloUrl: 'http://kilo.test', kiloUsername: 'kilo', kiloModel: 'kilo/kilo-auto/free', orbisUrl: 'http://orbis.test/coda' };
const caller = { discordUserId: '12345678901234567', speakerName: 'Eirvargr', privacyScope: 'dm' };
const routine = '*My ears flatten. My tail puffs. The clipboard appears.* Article 3! The Bath Clause! Bacon!';
const messages = [
  { author: 'coda', name: 'Coda', content: routine },
  { author: 'coda', name: 'Coda', content: routine },
  { author: caller.discordUserId, name: 'Eirvargr', content: 'Coda, what just happened?' },
];

function mock(drafts) {
  const calls = []; let created = 0; let completed = 0;
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/context')) return Response.json({ prompt: 'Canonical Coda identity' });
    if (String(url).endsWith('/session')) return Response.json({ id: `s${++created}` });
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ parts: [{ type: 'text', text: drafts[completed++] }] });
  };
  return { calls, fetcher };
}

test('browser repairs stale routines in a fresh session and dispatches only the accepted music intent', async () => {
  const { calls, fetcher } = mock([routine + '\n```coda-music\n{"action":"skip"}\n```', '*I pause.* "Ambi, did you see that?"']);
  const result = await askKilo(config, 'private-room', messages, caller, fetcher);
  assert.match(result.text, /did you see that/);
  assert.equal(result.musicIntent, null);
  assert.equal(calls.filter(call => call.url.endsWith('/session')).length, 2);
  assert.equal(calls.filter(call => call.init.method === 'DELETE').length, 2);
  const bodies = calls.filter(call => call.url.endsWith('/message')).map(call => JSON.parse(call.init.body));
  assert.match(bodies[0].system, /RECENT CODA LOOP COOLDOWNS/);
  assert.match(bodies[1].system, /REWRITE THIS TURN ONCE/);
  assert.ok(bodies.every(body => body.tools.bash === false));
});

test('browser rejects two failed drafts with no endless rewrite loop', async () => {
  const { calls, fetcher } = mock([routine, routine]);
  await assert.rejects(askKilo(config, 'room', messages, caller, fetcher), /lost track/);
  assert.equal(calls.filter(call => call.url.endsWith('/message')).length, 2);
  assert.equal(calls.filter(call => call.init.method === 'DELETE').length, 2);
});

test('browser corrects the shotgun immunity regression without deciding the hit outcome', async () => {
  const { fetcher } = mock(['Ambi is very much still standing with all their scales intact.', '*I freeze.* "Ambi?"']);
  const result = await askKilo(config, 'room', [{ author: caller.discordUserId, name: 'Eirvargr', content: '*I fire a shotgun at Ambi\'s head.*' }], caller, fetcher);
  assert.equal(result.text, '*I freeze.* "Ambi?"');
});
