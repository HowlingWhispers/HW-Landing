// Coda may only *ask* for music. The model never names a provider track id and
// never calls a provider directly: the server re-resolves the query itself and
// only ever acts on an account that opted in. A malformed block is always
// stripped from the visible reply so internal markup can never reach a member.
export const ACTIONS = ['play', 'pause', 'resume', 'skip', 'queue', 'now_playing', 'join', 'leave'];
const NEEDS_QUERY = new Set(['play', 'queue']);
const MAX_QUERY = 300;

// Disconnect is deliberately absent. Revoking someone's music access is a
// destructive, account-level action a member performs deliberately in the UI,
// never something a conversational turn can trigger.
export const MODEL_ACTIONS = ACTIONS;

const isPlain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function validateMusicIntent(value, providers = []) {
  if (!isPlain(value)) return { intent: null, error: 'intent must be an object' };
  const keys = Object.keys(value);
  if (keys.some(key => !['action', 'query', 'provider', 'confidence'].includes(key))) return { intent: null, error: 'intent has unsupported fields' };
  const { action, query, provider, confidence } = value;
  if (typeof action !== 'string' || !ACTIONS.includes(action)) return { intent: null, error: 'unsupported action' };
  if (provider !== undefined) {
    if (typeof provider !== 'string' || !providers.length || !providers.includes(provider)) return { intent: null, error: 'unsupported provider' };
  }
  if (confidence !== undefined && (typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1))) return { intent: null, error: 'confidence out of range' };
  if (NEEDS_QUERY.has(action)) {
    if (typeof query !== 'string' || !query.trim()) return { intent: null, error: `${action} requires a query` };
    if (query.length > MAX_QUERY) return { intent: null, error: 'query too long' };
  }
  if (query !== undefined && query !== null && typeof query !== 'string') return { intent: null, error: 'query must be a string' };
  if (!NEEDS_QUERY.has(action) && query) return { intent: null, error: `${action} does not accept a query` };
  return {
    intent: {
      action,
      ...(NEEDS_QUERY.has(action) ? { query: query.trim().slice(0, MAX_QUERY) } : {}),
      ...(provider ? { provider } : {}),
      ...(typeof confidence === 'number' ? { confidence } : {}),
    },
    error: null,
  };
}

const FENCE = /```coda-music[ \t]*\r?\n?([\s\S]*?)\r?\n?```/g;

// Returns the visible text with every music block removed, plus at most one
// validated intent. Several blocks, unparseable JSON, or a failed schema all
// yield intent: null and are logged by the caller.
export function splitMusicIntent(raw, providers = []) {
  const text = String(raw ?? '');
  if (!text.includes('coda-music')) return { text: text.trim(), intent: null, rejected: null };
  const blocks = [...text.matchAll(FENCE)];
  const stripped = text.replace(FENCE, '').replace(/\n{3,}/g, '\n\n').trim();
  if (blocks.length !== 1) return { text: stripped, intent: null, rejected: blocks.length ? 'multiple music blocks' : 'unterminated music block' };
  let parsed;
  try { parsed = JSON.parse(blocks[0][1]); } catch { return { text: stripped, intent: null, rejected: 'music block was not valid JSON' }; }
  const { intent, error } = validateMusicIntent(parsed, providers);
  return { text: stripped, intent, rejected: intent ? null : error };
}
