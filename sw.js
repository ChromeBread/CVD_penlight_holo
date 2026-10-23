// Offline support: everything is cached on first visit, so the app works
// inside the venue without signal. Data CSVs are refreshed when online.
const VERSION = 'cvdph-0.1.9';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/data.js', 'js/color.js', 'js/penlight.js', 'js/ui.js',
  'js/pages/p1-main.js', 'js/pages/p2-guide.js', 'js/pages/p3-neighbor.js', 'js/pages/p4-picker.js',
  'js/pages/p5-quiz.js', 'js/pages/p6-phrases.js', 'js/pages/p7-11-cards.js', 'js/pages/p12-test.js',
  'js/pages/p13-about.js', 'js/pages/p14-debug.js', 'js/pages/p15-16-cycle.js',
  'i18n/en.json', 'i18n/ja.json', 'i18n/ko.json', 'i18n/zh-Hans.json', 'i18n/zh-Hant.json', 'i18n/id.json',
  'data/a_fes_members.csv', 'data/b_penlight_colors.csv', 'data/c_penlight_specs.csv', 'data/contributors.csv',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

// Install: always fetch fresh copies (cache: 'reload'), so a new version never mixes in
// old files from the browser's HTTP cache, and note when this copy was saved and how big it was.
// Progress is posted to open pages so they can show a progress bar.
// No skipWaiting: an open page keeps the version it started with; the new one takes over
// on the next launch, or right away with "clear cache" on the About page.
async function tell(msg) {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) client.postMessage({ source: 'cvdph-sw', version: VERSION, ...msg });
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

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    try {
      const size = await saveAll(c);
      const info = { version: VERSION, savedAt: new Date().toISOString(), ...size };
      await c.put('cache-info.json', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
      await tell({ type: 'done', ...size });
    } catch (err) {
      await caches.delete(VERSION);  // never keep a half-saved version
      await tell({ type: 'failed', error: String(err) });
      throw err;
    }
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cvdph-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
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
