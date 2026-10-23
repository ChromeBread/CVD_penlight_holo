// Page 13: please post with the hashtag, debug switch, app info, updates / cache, credits, thanks.
import { h, t, APP, isDebug, setDebug, currentLang } from '../core.js';
import { DB } from '../data.js';
import { toggle } from '../ui.js';

const fmtTime = iso => { try { return new Date(iso).toLocaleString(currentLang()); } catch { return iso; } };
const versionOf = name => name.replace(/^cvdph-/, '');

const fmtSize = bytes => {
  const mb = bytes >= 1024 * 1024, v = mb ? bytes / 1024 / 1024 : bytes / 1024;
  return `${new Intl.NumberFormat(currentLang(), { maximumFractionDigits: 1 }).format(v)} ${mb ? 'MB' : 'KB'}`;
};

// What the service worker saved on this device: when, how big at download, and how big now
// (data updates and images opened later change the current amount).
async function cachedInfo() {
  try {
    const name = (await caches.keys()).find(k => k.startsWith('cvdph-'));
    if (!name) return null;
    const c = await caches.open(name);
    const r = await c.match('cache-info.json');
    const info = r ? await r.json() : {};
    let bytes = 0, files = 0;
    for (const req of await c.keys()) {
      if (req.url.endsWith('/cache-info.json')) continue;
      const res = await c.match(req);
      if (res) { bytes += (await res.blob()).size; files++; }
    }
    return { version: versionOf(name), savedAt: info.savedAt, downloaded: info.bytes != null ? { bytes: info.bytes, files: info.files } : null, now: { bytes, files } };
  } catch { return null; }
}

// Manual update check: compare with the version in the live sw.js.
async function latestVersion() {
  const r = await fetch(`sw.js?check=${Date.now()}`, { cache: 'no-store' });
  const m = /VERSION = '([^']+)'/.exec(await r.text());
  return m ? versionOf(m[1]) : null;
}

// Settings live in localStorage and are kept; only the saved pages are removed.
async function clearCache() {
  if (!confirm(t('p13.clearConfirm'))) return;
  try {
    for (const reg of await navigator.serviceWorker?.getRegistrations?.() || []) await reg.unregister();
    for (const k of await caches.keys()) if (k.startsWith('cvdph-')) await caches.delete(k);
  } catch { /* nothing saved */ }
  location.reload();
}

function updateSection() {
  const saved = h('p', null, '…');
  const sizes = h('p', { class: 'fine' });
  const status = h('p', { class: 'fine', 'aria-live': 'polite' });
  cachedInfo().then(c => {
    saved.textContent = c ? t('p13.cached', { v: c.version, at: c.savedAt ? fmtTime(c.savedAt) : '—' }) : t('p13.notCached');
    if (!c) return;
    sizes.replaceChildren(...[
      c.downloaded ? t('p13.size', { size: fmtSize(c.downloaded.bytes), n: c.downloaded.files }) : null,
      t('p13.sizeNow', { size: fmtSize(c.now.bytes), n: c.now.files }),
    ].filter(Boolean).flatMap((x, i) => (i ? [h('br'), x] : [x])));
  });
  const check = async () => {
    status.textContent = '…';
    try {
      const v = await latestVersion();
      if (!v) throw new Error('no version');
      status.textContent = v === APP.version ? t('p13.latest', { v }) : t('p13.newer', { v });
    } catch { status.textContent = t('p13.checkFail'); }
  };
  return h('div', { class: 'card stack' },
    h('h2', null, t('p13.update')),
    saved, sizes,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: check }, '🔄 ' + t('p13.check'))),
    status,
    h('button', { class: 'btn', onclick: clearCache }, '🧹 ' + t('p13.clear')),
    h('p', { class: 'fine' }, t('p13.clearNote')));
}

export default {
  id: 13,
  render(root) {
    const contributors = DB.contributors.filter(c => c.name);
    root.append(h('div', { class: 'page stack' },
      h('div', { class: 'card' }, h('p', null, t('p13.hashtag', { tag: APP.hashtag }))),
      h('div', { class: 'card' },
        toggle(t('p13.debug'), isDebug(), v => setDebug(v)),
        h('p', { class: 'fine' }, t('p13.debugNote'))),
      h('dl', { class: 'kv' },
        h('dt', null, t('p13.name')), h('dd', null, `${t('app.title')} (${APP.code})`),
        h('dt', null, t('p13.version')), h('dd', null, APP.version),
        h('dt', null, t('p13.build')), h('dd', null, APP.build)),
      updateSection(),
      h('h2', null, t('p13.credits')),
      h('dl', { class: 'kv' },
        h('dt', null, t('p13.author')), h('dd', null, APP.author),
        h('dt', null, t('p13.contributors')),
        h('dd', null, contributors.length
          ? h('ul', { class: 'plain' }, contributors.map(c => h('li', null, c.name, c.fan_name ? ` (${c.fan_name})` : '', c.color_vision_type ? ` · ${t(`cv.${c.color_vision_type}.short`)}` : '')))
          : t('p13.recruiting')),
        h('dt', null, t('p13.you')), h('dd', null, t('p13.youText'))),
      h('p', { class: 'thanks' }, t('p13.thanks')),
      h('p', { class: 'fine' }, t('common.unofficial'))));
  },
};
