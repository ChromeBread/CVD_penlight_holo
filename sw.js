// Offline support: everything is cached on first visit, so the app works
// inside the venue without signal. Data CSVs are refreshed when online.
const VERSION = 'cvdph-0.2.6';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/data.js', 'js/color.js', 'js/penlight.js', 'js/ui.js', 'js/images.js', 'js/addon.js',
  'js/pages/p1-main.js', 'js/pages/p2-guide.js', 'js/pages/p3-neighbor.js', 'js/pages/p4-picker.js',
  'js/pages/p5-quiz.js', 'js/pages/p6-phrases.js', 'js/pages/p7-11-cards.js', 'js/pages/p12-test.js',
  'js/pages/p13-about.js', 'js/pages/p14-debug.js', 'js/pages/p15-16-cycle.js', 'js/pages/p17-18-livedata.js',
  'js/pages/p19-csv.js', 'js/pages/p20-beta.js',
  'i18n/en.json', 'i18n/ja.json', 'i18n/ko.json', 'i18n/zh-Hans.json', 'i18n/zh-Hant.json', 'i18n/id.json',
  'data/builtin/a_fes_members.csv', 'data/builtin/b_penlight_colors.csv', 'data/builtin/c_penlight_specs.csv', 'data/builtin/contributors.csv',
  'data/templates/a_template.csv', 'data/templates/b_template.csv',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

// Optional add-ons (downloaded from the About page in debug mode), each in its own cache.
// Keep in step with js/addon.js.
const ADDONS = { 'cvdph-addon-csv': ['addons/csv-editor.js', 'addons/csv-editor.css'] };
const isAddonCache = k => k.startsWith('cvdph-addon-');

// Install: always fetch fresh copies (cache: 'reload'), so a new version never mixes in
// old files from the browser's HTTP cache, and note when this copy was saved and how big it was.
// Progress is posted to open pages so they can show a progress bar.
// No skipWaiting: an open page keeps the version it started with; the new one takes over
// on the next launch, or right away with "clear cache" on the About page.
let resave = false;   // true while the same version is saved again (messages say so, not "new version")
async function tell(msg) {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) client.postMessage({ source: 'cvdph-sw', version: VERSION, resave, ...msg });
}

async function saveAll(c) {
  let done = 0, bytes = 0;
  const total = FILES.length;
  await tell({ type: 'progress', done, total, bytes });
  const queue = [...FILES];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift();
      const r = await fetch(new Request(f, { cache: 'reload' }));
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      const blob = await r.clone().blob();
      await c.put(f, r);
      done++; bytes += blob.size;
      await tell({ type: 'progress', done, total, bytes });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);  // 4 at a time
  return { bytes, files: done };
}

// Installed add-ons are downloaded again with each new version, so they always match the app.
// A failed refresh keeps the old copy and never stops the app update.
async function refreshAddons() {
  for (const [name, files] of Object.entries(ADDONS)) {
    if (!(await caches.has(name))) continue;
    try {
      const got = [];
      let bytes = 0;
      for (const f of files) {
        const r = await fetch(new Request(f, { cache: 'reload' }));
        if (!r.ok) throw new Error(`${f}: ${r.status}`);
        bytes += (await r.clone().blob()).size;
        got.push([f, r]);
      }
      const c = await caches.open(name);
      for (const [f, r] of got) await c.put(f, r);
      const info = { version: VERSION, savedAt: new Date().toISOString(), bytes, files: got.length };
      await c.put('addon-info.json', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
    } catch { /* offline or missing: keep what is there */ }
  }
}

async function saveVersion() {
  const c = await caches.open(VERSION);
  try {
    const size = await saveAll(c);
    const info = { version: VERSION, savedAt: new Date().toISOString(), ...size };
    await c.put('cache-info.json', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
    await refreshAddons();
    await tell({ type: 'done', ...size });
  } catch (err) {
    await caches.delete(VERSION);  // never keep a half-saved version
    await tell({ type: 'failed', error: String(err) });
    throw err;
  }
}

self.addEventListener('install', e => e.waitUntil(saveVersion()));

// "Clear cache" on the About page deletes the saved copy, but the browser may keep this same worker
// (sw.js did not change), so no install runs. The page then asks for the copy to be saved again.
let resaving = null;
self.addEventListener('message', e => {
  if (e.data?.type !== 'resave') return;
  resaving ||= caches.open(VERSION).then(c => c.match('cache-info.json')).then(hit => { if (hit) return null; resave = true; return saveVersion(); }).catch(() => {}).finally(() => { resaving = null; resave = false; });
  e.waitUntil(resaving);
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cvdph-') && !isAddonCache(k) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // version / size checks always go to the network (a cached sw.js would always say "latest")
  if (/\/(sw\.js|app-size\.json)$/.test(url.pathname)) return;
  // add-on files: from their own cache when installed, never copied into the app cache
  if (url.pathname.includes('/addons/')) {
    e.respondWith(e.request.cache === 'reload' ? fetch(e.request)
      : caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
    return;
  }
  const isData = url.pathname.includes('/data/');
  if (isData) {
    // network first, cache fallback
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else {
    // cache first, also store anything new (e.g. member images)
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    })));
  }
});
