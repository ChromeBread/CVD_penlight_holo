// Optional add-ons that are downloaded only when wanted (debug mode, About page).
// Each one has its own cache, so the app's offline copy stays as small as before; sw.js serves it from there
// and refreshes it whenever a new app version is saved. Keep FILES in step with ADDONS in sw.js.

export const CSV_EDITOR = {
  id: 'csv',
  cache: 'cvdph-addon-csv',
  files: ['addons/csv-editor.js', 'addons/csv-editor.css'],
};

const INFO = 'addon-info.json';

// { bytes, files, savedAt, version } when downloaded, otherwise null
export async function addonInfo(a = CSV_EDITOR) {
  try {
    if (!(await caches.has(a.cache))) return null;
    const c = await caches.open(a.cache);
    for (const f of a.files) if (!(await c.match(f))) return null;
    const r = await c.match(INFO);
    return r ? await r.json() : { bytes: 0, files: a.files.length };
  } catch { return null; }
}

// Expected sizes of the latest app and add-ons, from app-size.json (made by tools/app-size.ps1).
export async function latestSizes() {
  const r = await fetch(`app-size.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// Downloads every file first and stores them only when all arrived, so a broken half copy is never kept.
export async function installAddon(a = CSV_EDITOR, onProgress = () => {}, version = '') {
  const got = [];
  let bytes = 0;
  onProgress({ done: 0, total: a.files.length, bytes });
  for (const f of a.files) {
    const r = await fetch(f, { cache: 'reload' });
    if (!r.ok) throw new Error(`${f}: ${r.status}`);
    const blob = await r.blob();
    bytes += blob.size;
    got.push([f, new Response(blob, { headers: { 'Content-Type': r.headers.get('Content-Type') || '' } })]);
    onProgress({ done: got.length, total: a.files.length, bytes });
  }
  await caches.delete(a.cache);
  const c = await caches.open(a.cache);
  for (const [f, res] of got) await c.put(f, res);
  const info = { version, savedAt: new Date().toISOString(), bytes, files: got.length };
  await c.put(INFO, new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
  return info;
}

export async function removeAddon(a = CSV_EDITOR) {
  try { await caches.delete(a.cache); } catch { /* nothing saved */ }
}
