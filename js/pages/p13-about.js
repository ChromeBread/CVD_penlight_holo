// Page 13: please post with the hashtag, debug switch, app info, updates / cache, credits, thanks.
import { h, t, APP, isDebug, setDebug, currentLang, formatSize, formatDate, toast } from '../core.js';
import { DB, getUserData, saveUserData, getDraft, saveDraft, clearDraft, getCsvDraft, saveCsvDraft, clearCsvDraft } from '../data.js';
import { CSV_EDITOR, addonInfo, installAddon, removeAddon, latestSizes } from '../addon.js';
import { listImages, deleteImage, clearImages, exportImages, importImages } from '../images.js';
import { toggle } from '../ui.js';

const fmtTime = iso => { try { return new Date(iso).toLocaleString(currentLang()); } catch { return iso; } };
const versionOf = name => name.replace(/^cvdph-/, '');


// What the service worker saved on this device: when, how big at download, and how big now
// (data updates and images opened later change the current amount).
async function cachedInfo() {
  try {
    const name = (await caches.keys()).find(k => k.startsWith('cvdph-') && !k.startsWith('cvdph-addon-'));
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
// The service worker is kept (unregistering left it half-alive and nothing was saved again):
// after the reload the app sees its copy is missing and has it downloaded fresh (app.js).
async function clearCache() {
  if (!confirm(t('p13.clearConfirm'))) return;
  try {
    // add-ons stay: the fresh app download refreshes them too
    for (const k of await caches.keys()) if (k.startsWith('cvdph-') && !k.startsWith('cvdph-addon-')) await caches.delete(k);
    await (await navigator.serviceWorker?.getRegistration?.())?.update();   // a newer version installs itself
  } catch { /* nothing saved / offline */ }
  try { sessionStorage.setItem('cvdph.cleared', '1'); } catch { /* ignore */ }
  location.reload();
}

const lines = list => list.filter(Boolean).flatMap((x, i) => (i ? [h('br'), x] : [x]));

function updateSection() {
  const saved = h('p', null, '…');
  const sizes = h('p', { class: 'fine' });
  const status = h('p', { class: 'fine', 'aria-live': 'polite' });
  // after "clear cache": say how much the fresh copy took, once it is saved
  let cleared = false;
  try { cleared = sessionStorage.getItem('cvdph.cleared') === '1'; } catch { /* ignore */ }
  const reloaded = cleared ? h('p', { class: 'ok-note', 'aria-live': 'polite' }, '🧹 ' + t('p13.reloaded')) : null;
  function refresh() {
    cachedInfo().then(c => {
      saved.textContent = c ? t('p13.cached', { v: c.version, at: c.savedAt ? fmtTime(c.savedAt) : '—' }) : t('p13.notCached');
      if (!c) return;
      sizes.replaceChildren(...lines([
        c.downloaded ? t('p13.size', { size: formatSize(c.downloaded.bytes), n: c.downloaded.files }) : null,
        t('p13.sizeNow', { size: formatSize(c.now.bytes), n: c.now.files }),
      ]));
      if (reloaded && c.downloaded && c.version === APP.version) {
        reloaded.textContent = '🧹 ' + t('p13.reloadedSize', { v: c.version, size: formatSize(c.downloaded.bytes), n: c.downloaded.files });
        try { sessionStorage.removeItem('cvdph.cleared'); } catch { /* ignore */ }
      }
    });
  }
  refresh();
  // the service worker tells when the new copy is saved
  const onMsg = e => {
    if (!saved.isConnected) { navigator.serviceWorker.removeEventListener('message', onMsg); return; }
    if (e.data?.source === 'cvdph-sw' && e.data.type === 'done') refresh();
  };
  navigator.serviceWorker?.addEventListener('message', onMsg);

  const check = async () => {
    status.textContent = '…';
    try {
      const v = await latestVersion();
      if (!v) throw new Error('no version');
      const head = v === APP.version ? t('p13.latest', { v }) : t('p13.newer', { v });
      let size = null;
      try {
        const s = await latestSizes();
        size = t('p13.expected', { size: formatSize(s.app.bytes), n: s.app.files });
      } catch { /* sizes unknown: the version is still shown */ }
      status.replaceChildren(...lines([head, size]));
    } catch { status.textContent = t('p13.checkFail'); }
  };
  return h('div', { class: 'card stack' },
    h('h2', null, t('p13.update')),
    reloaded,
    saved, sizes,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: check }, '🔄 ' + t('p13.check'))),
    status,
    h('button', { class: 'btn', onclick: clearCache }, '🧹 ' + t('p13.clear')),
    h('p', { class: 'fine' }, t('p13.clearNote')));
}

// ---------- debug: everything added on this device (live data, penlights, member images, the editor draft) ----------
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

function saveFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function backup() {
  const b = { format: 'cvdph-backup', version: APP.version, savedAt: new Date().toISOString(),
    userdata: getUserData(), draft: getDraft(), csvDraft: getCsvDraft(), images: await exportImages() };
  saveFile(`cvdph-backup-${stamp()}.json`, JSON.stringify(b));
}

// Adds what the backup has; data already here (same id / member) is kept as it is, images are replaced.
async function restore(file) {
  const b = JSON.parse(await file.text());
  if (b?.format !== 'cvdph-backup') throw new Error('not a backup');
  const u = getUserData();
  for (const k of ['stages', 'penlights']) {
    for (const x of b.userdata?.[k] || []) if (x?.id && !u[k].some(y => y.id === x.id)) u[k].push(x);
  }
  saveUserData(u);
  await importImages(b.images);
  if (b.draft?.data && !getDraft()) saveDraft(b.draft);
  if (b.csvDraft?.doc && !getCsvDraft()) saveCsvDraft(b.csvDraft);
}

function dataSection() {
  const u = getUserData(), imgs = listImages(), draft = getDraft(), csvDraft = getCsvDraft();
  const refresh = () => box.replaceWith(dataSection());
  const del = (name, fn) => async () => {
    if (!confirm(t('p13.data.delConfirm', { name }))) return;
    await fn(); refresh();
  };
  const drop = (kind, id) => () => { const d = getUserData(); d[kind] = d[kind].filter(x => x.id !== id); saveUserData(d); };
  const item = (name, sub, fn) => h('li', null, h('span', null, h('strong', null, name), sub ? h('small', null, ` ${sub}`) : null),
    h('button', { class: 'btn ghost', onclick: del(name, fn) }, '🗑 ' + t('ed.delete')));
  const group = (title, items) => [h('h3', null, title), items.length ? h('ul', { class: 'ed-list' }, items) : h('p', { class: 'fine' }, t('ld.none'))];
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try { await restore(f); toast(t('p13.data.restored')); refresh(); } catch { toast(t('p13.data.restoreFail')); }
  });
  const all = async () => {
    if (!confirm(t('p13.data.allConfirm'))) return;
    saveUserData({ stages: [], penlights: [] });
    clearDraft();
    clearCsvDraft();
    try { await clearImages(); } catch { /* no image store */ }
    toast(t('p13.data.cleared')); refresh();
  };
  const box = h('div', { class: 'card stack' },
    h('h2', null, t('p13.data')),
    h('p', { class: 'fine' }, t('p13.data.note')),
    group(t('ld.lives'), u.stages.map(s => item(s.name, s.date ? formatDate(s.date) : '', drop('stages', s.id)))),
    group(t('ld.penlights'), u.penlights.map(p => item(p.name, t('ld.colors', { n: p.colors.length }), drop('penlights', p.id)))),
    group(t('p13.data.images'), imgs.map(i => item(i.label || i.key, i.size ? formatSize(i.size) : t('p13.data.urlOnly'), () => deleteImage(i.key)))),
    group(t('p13.data.draft'), [
      draft?.data ? item(draft.data.name || '—', `${t('page.18')} · ${draft.savedAt ? fmtTime(draft.savedAt) : ''}`, clearDraft) : null,
      csvDraft?.doc ? item(csvDraft.doc.name || '—', `${t('page.19')} · ${csvDraft.savedAt ? fmtTime(csvDraft.savedAt) : ''}`, clearCsvDraft) : null,
    ].filter(Boolean)),
    input,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => backup().then(() => toast(t('p13.data.backedUp')), () => toast(t('p13.data.backupFail'))) }, '💾 ' + t('p13.data.backup')),
      h('button', { class: 'btn ghost', onclick: () => input.click() }, '📂 ' + t('p13.data.restore'))),
    h('button', { class: 'btn danger-btn', onclick: all }, '🗑 ' + t('p13.data.all')));
  return box;
}

// ---------- debug: the CSV editor add-on (download with progress, sizes, delete) ----------
function addonSection(go) {
  const box = h('div', { class: 'card stack', id: 'addon-csv' });
  const fill = h('div', { class: 'save-fill' });
  const bar = h('div', { class: 'dl-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', hidden: true },
    h('span', { class: 'fine dl-label' }), h('div', { class: 'save-track' }, fill));
  const expected = h('p', { class: 'fine' }, '…');
  latestSizes().then(s => {
    const a = s.addons?.[CSV_EDITOR.id];
    expected.textContent = a ? t('p13.addon.expected', { size: formatSize(a.bytes), n: a.files }) : t('p13.addon.offline');
  }, () => { expected.textContent = t('p13.addon.offline'); });

  async function draw() {
    const info = await addonInfo();
    const state = info
      ? h('p', null, '✓ ' + t('p13.addon.installed', { size: formatSize(info.bytes), n: info.files, at: info.savedAt ? fmtTime(info.savedAt) : '—' }))
      : h('p', null, t('p13.addon.notInstalled'));
    const install = async () => {
      bar.hidden = false;
      const label = bar.querySelector('.dl-label');
      try {
        await installAddon(CSV_EDITOR, ({ done, total, bytes }) => {
          fill.style.transform = `scaleX(${total ? done / total : 0})`;
          bar.setAttribute('aria-valuenow', String(Math.round((total ? done / total : 0) * 100)));
          label.textContent = t('p13.addon.progress', { done, total, size: formatSize(bytes) });
        }, APP.version);
        toast(t('p13.addon.done'));
      } catch { toast(t('p13.addon.fail')); }
      bar.hidden = true;
      draw();
    };
    box.replaceChildren(...[
      h('h2', null, '📊 ' + t('page.19')),
      h('p', { class: 'fine' }, t('p13.addon.note')),
      state, info ? null : expected, bar,
      h('div', { class: 'row' },
        info ? h('button', { class: 'btn', onclick: () => go(19) }, '📊 ' + t('csv.openEditor')) : h('button', { class: 'btn', onclick: install }, '⬇ ' + t('p13.addon.install')),
        info ? h('button', { class: 'btn ghost', onclick: install }, '🔄 ' + t('p13.addon.reinstall')) : null,
        info ? h('button', { class: 'btn ghost', onclick: async () => { if (confirm(t('p13.addon.removeConfirm'))) { await removeAddon(); toast(t('p13.addon.removed')); draw(); } } }, '🗑 ' + t('p13.addon.remove')) : null),
      h('p', { class: 'fine' }, t('p13.addon.keep'))].filter(Boolean));
  }
  draw();
  return box;
}

export default {
  id: 13,
  render(root, { go }) {
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
      isDebug() ? dataSection() : null,
      isDebug() ? addonSection(go) : null,
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
    // page 18 / 19 sent us here to get the CSV editor
    let focus = null;
    try { focus = sessionStorage.getItem('cvdph.focus'); sessionStorage.removeItem('cvdph.focus'); } catch { /* ignore */ }
    if (focus === 'addon') requestAnimationFrame(() => document.getElementById('addon-csv')?.scrollIntoView({ block: 'center' }));
  },
};
