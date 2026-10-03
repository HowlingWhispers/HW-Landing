const cache = new Map();
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const normalize = model => String(model || '').replace(/^kilo\//, '').trim();

export async function imageCapability(config, fetchImpl = fetch) {
  const model = config.kiloVisionModel || config.kiloModel; const key = `${config.kiloUrl}|${normalize(model)}`; const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  let value = null;
  try {
    const response = await fetchImpl(`${config.kiloUrl.replace(/\/+$/, '')}/provider`, { headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${config.kiloUsername}:${config.kiloPassword}`).toString('base64')}` }, signal: AbortSignal.timeout(15_000) });
    if (response.ok) for (const provider of record(await response.json()).all || []) {
      const match = Object.values(record(record(provider).models)).find(entry => [record(entry).id, record(entry).modelID].map(String).includes(normalize(model)));
      if (!match) continue; const capabilities = record(record(match).capabilities); value = record(capabilities.input).image === true || capabilities.attachment === true ? model : null; break;
    }
  } catch { value = null; }
  cache.set(key, { value, until: Date.now() + 300_000 }); return value;
}
