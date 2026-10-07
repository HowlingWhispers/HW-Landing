const invoke = window.__TAURI__.core.invoke;
const $ = id => document.getElementById(id);

const state = {
  installRoot: localStorage.getItem('coda.installRoot') || '',
  feedUrl: localStorage.getItem('coda.feedUrl') || '',
  loader: null,
  mods: []
};

function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function setView(name) {
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node.id === 'view-' + name));
  document.querySelectorAll('.nav').forEach(node => node.classList.toggle('active', node.dataset.view === name));
  if (name === 'logs') loadLogs();
  if (name === 'mods') loadMods();
}

async function ensureDefaults() {
  if (!state.installRoot) {
    try {
      state.installRoot = await invoke('default_install_root');
    } catch {}
  }
  $('install-root').value = state.installRoot;
  $('feed-url').value = state.feedUrl;
}

async function inspect() {
  try {
    state.installRoot = $('install-root').value.trim();
    state.loader = await invoke('inspect_install', { installRoot: state.installRoot });
    const good = Boolean(state.loader.found && state.loader.loaderVersion);
    $('rail-dot').classList.toggle('good', good);
    $('rail-status').textContent = good ? 'CML ready' : 'CodaLoader not ready';
    $('loader-version').textContent = state.loader.loaderVersion || 'Not found';
    $('minecraft-version').textContent = state.loader.minecraftDisplay || state.loader.minecraft || '26.4 Snapshot 3';
    $('loader-state').textContent = state.loader.error || (good ? 'Install detected' : 'Choose the install folder');
    $('hero-status').textContent = good
      ? `CodaLoader ${state.loader.loaderVersion} is ready for ${state.loader.minecraftDisplay || state.loader.minecraft}.`
      : (state.loader.error || 'Choose your CodaLoader folder in Settings.');
    $('play').disabled = !good;
  } catch (error) {
    $('play').disabled = true;
    $('hero-status').textContent = String(error);
  }
  await loadMods();
}

async function loadMods() {
  try {
    state.mods = await invoke('list_mods', { installRoot: state.installRoot });
  } catch {
    state.mods = [];
  }
  $('home-mod-count').textContent = state.mods.filter(mod => mod.enabled).length;
  $('mod-count-pill').textContent = state.mods.length;
  const list = $('mods-list');
  if (!state.mods.length) {
    list.innerHTML = '<div class="mod-row"><div><h3>No CML mods found</h3><p>Drop CodaLoader mods into run\\mods.</p></div><span class="tag">EMPTY</span></div>';
    return;
  }
  list.innerHTML = state.mods.map(mod => `
    <article class="mod-row">
      <div>
        <h3>${escapeHtml(mod.name || mod.id || mod.file)}</h3>
        <p>${escapeHtml([mod.id, mod.version, mod.file].filter(Boolean).join(' · '))}${mod.error ? ' · ' + escapeHtml(mod.error) : ''}</p>
      </div>
      <span class="tag ${mod.enabled ? '' : 'off'}">${mod.enabled ? 'ENABLED' : 'DISABLED'}</span>
    </article>`).join('');
}

async function loadLogs() {
  try {
    $('logs').textContent = await invoke('read_logs', { installRoot: state.installRoot });
  } catch (error) {
    $('logs').textContent = String(error);
  }
}

async function loadNews() {
  const root = $('news');
  if (!state.feedUrl) {
    root.innerHTML = '<article class="news-card"><span>LOCAL</span><h3>CodaLauncher wakes up</h3><p>Set the launcher feed URL in Settings when the server endpoint is deployed.</p></article>';
    return;
  }
  try {
    const response = await fetch(state.feedUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const items = data.news || data.items || [];
    root.innerHTML = items.slice(0, 8).map(item => `
      <article class="news-card">
        <span>${escapeHtml(item.date || 'NEWS')}</span>
        <h3>${escapeHtml(item.title || 'Howling Whispers')}</h3>
        <p>${escapeHtml(item.text || '')}</p>
      </article>`).join('') || '<article class="news-card"><p>No news items yet.</p></article>';
  } catch (error) {
    root.innerHTML = `<article class="news-card"><span>OFFLINE</span><h3>The den is quiet</h3><p>${escapeHtml(String(error))}</p></article>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function play() {
  $('play').disabled = true;
  $('play').textContent = 'STARTING…';
  try {
    const result = await invoke('launch_game', { installRoot: state.installRoot });
    toast('CodaLoader started · PID ' + result.pid);
    $('hero-status').textContent = 'Minecraft is booting. Logs are being captured by CodaLauncher.';
  } catch (error) {
    toast(String(error));
  } finally {
    setTimeout(() => {
      $('play').disabled = false;
      $('play').textContent = 'PLAY';
    }, 1800);
  }
}

document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('play').addEventListener('click', play);
$('refresh').addEventListener('click', inspect);
$('mods-refresh').addEventListener('click', loadMods);
$('logs-refresh').addEventListener('click', loadLogs);
$('news-refresh').addEventListener('click', loadNews);
$('save-settings').addEventListener('click', async () => {
  state.installRoot = $('install-root').value.trim();
  state.feedUrl = $('feed-url').value.trim();
  localStorage.setItem('coda.installRoot', state.installRoot);
  localStorage.setItem('coda.feedUrl', state.feedUrl);
  toast('Settings saved');
  await inspect();
  await loadNews();
});

await ensureDefaults();
await inspect();
await loadNews();
