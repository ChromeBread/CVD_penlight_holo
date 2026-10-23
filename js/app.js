import { h, t, APP, LANGS, getState, setState, setDebug, detectLang, loadLang, currentLang, isDebug, onDebug, pageNo, formatSize } from './core.js';
import { loadData, getDraft, clearDraft, getCsvDraft, clearCsvDraft } from './data.js';
import { loadImages } from './images.js';
import p1 from './pages/p1-main.js';
import p2 from './pages/p2-guide.js';
import p3 from './pages/p3-neighbor.js';
import p4 from './pages/p4-picker.js';
import p5 from './pages/p5-quiz.js';
import p6 from './pages/p6-phrases.js';
import { p7, p8, p9, p10, p11 } from './pages/p7-11-cards.js';
import p12 from './pages/p12-test.js';
import p13 from './pages/p13-about.js';
import p14 from './pages/p14-debug.js';
import { p15, p16 } from './pages/p15-16-cycle.js';
import { p17, p18 } from './pages/p17-18-livedata.js';
import p19 from './pages/p19-csv.js';

const PAGES = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19];

const view = document.getElementById('view');
const bar = document.getElementById('bar');
let cleanup = null;

function pageFromHash() {
  const n = Number((location.hash.match(/^#\/(\d+)/) || [])[1] || 1);
  const p = PAGES.find(x => x.id === n);
  if (!p || (p.debug && !isDebug())) return p1;
  return p;
}

function go(n) { location.hash = `#/${n}`; }

// The menu button says "Menu" in words, and until the menu has been opened once a hint points at it,
// because first-time users did not notice there is a menu at all.
function renderBar(page) {
  const menuBtn = h('button', { class: 'menu-btn' + (getState().menuSeen ? '' : ' new'), 'aria-label': t('nav.menu'), onclick: openMenu },
    h('span', { class: 'menu-btn-icon', 'aria-hidden': 'true' }, '☰'), h('span', { class: 'menu-btn-text' }, t('nav.menu')));
  bar.replaceChildren(
    menuBtn,
    h('div', { class: 'bar-title' }, h('span', { class: 'bar-no' }, t('nav.page', { n: pageNo(page) })), t(`page.${page.id}`)),
    h('div', { id: 'bar-actions', class: 'bar-actions' }),
  );
  document.querySelector('.menu-hint')?.remove();
  if (!getState().menuSeen) {
    document.body.append(h('div', { class: 'menu-hint', role: 'status' },
      h('span', null, '👆 ' + t('nav.menuHint')),
      h('button', { class: 'icon-btn', 'aria-label': t('common.close'), onclick: e => { setState({ menuSeen: true }); e.target.closest('.menu-hint').remove(); bar.querySelector('.menu-btn')?.classList.remove('new'); } }, '✕')));
  }
}

function render() {
  const page = pageFromHash();
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  document.body.dataset.page = page.id;
  renderBar(page);
  view.replaceChildren();
  view.scrollTop = 0;
  cleanup = page.render(view, { go }) || null;
}

function openMenu() {
  if (!getState().menuSeen) { setState({ menuSeen: true }); document.querySelector('.menu-hint')?.remove(); bar.querySelector('.menu-btn')?.classList.remove('new'); }
  const close = () => sheet.remove();
  const list = PAGES.filter(p => !p.debug || isDebug()).map(p =>
    h('button', { class: 'menu-item' + (p === pageFromHash() ? ' active' : ''), onclick: () => { close(); go(p.id); } },
      h('span', { class: 'menu-no' }, pageNo(p)), t(`page.${p.id}`), p.debug ? h('span', { class: 'tag' }, 'DEBUG') : null));
  const langSel = h('select', {
    class: 'select', 'aria-label': t('nav.language'),
    onchange: async e => { setState({ lang: e.target.value }); await loadLang(e.target.value); close(); render(); },
  }, LANGS.map(l => h('option', { value: l.code, selected: l.code === currentLang() }, l.label)));
  const sheet = h('div', { class: 'menu-backdrop', onclick: e => { if (e.target === sheet) close(); } },
    h('nav', { class: 'menu' },
      h('div', { class: 'menu-head' }, h('strong', null, t('app.title')), h('button', { class: 'icon-btn', 'aria-label': t('common.close'), onclick: close }, '✕')),
      h('label', { class: 'field' }, h('span', null, '🌐 ' + t('nav.language')), langSel),
      h('div', { class: 'menu-list' }, list),
      h('p', { class: 'fine' }, t('common.unofficial'))));
  document.body.append(sheet);
}

// Progress bar while the service worker saves the app for offline use (first visit or update).
function saveProgress() {
  if (!('serviceWorker' in navigator)) return;
  const fill = h('div', { class: 'save-fill' });
  const label = h('span', { class: 'save-label' });
  const box = h('div', { class: 'save-bar', role: 'progressbar', 'aria-valuemin': '0', hidden: true }, label, h('div', { class: 'save-track' }, fill));
  document.body.append(box);
  let hideTimer = 0;
  const show = (text, ratio, state = '') => {
    clearTimeout(hideTimer);
    box.hidden = false; box.className = `save-bar ${state}`;
    label.textContent = text;
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    box.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  };
  navigator.serviceWorker.addEventListener('message', e => {
    const m = e.data;
    if (!m || m.source !== 'cvdph-sw') return;
    const update = !!navigator.serviceWorker.controller && !m.resave;
    const v = m.version.replace(/^cvdph-/, '');
    if (m.type === 'progress') {
      show(t(update ? 'save.update' : 'save.first', { v, done: m.done, total: m.total, size: formatSize(m.bytes) }), m.total ? m.done / m.total : 0);
    } else if (m.type === 'done') {
      show(t(update ? 'save.updateDone' : 'save.done', { size: formatSize(m.bytes) }), 1, 'ok');
      hideTimer = setTimeout(() => { box.hidden = true; }, update ? 6000 : 3000);
    } else if (m.type === 'failed') {
      show(t('save.failed'), 1, 'bad');
      hideTimer = setTimeout(() => { box.hidden = true; }, 8000);
    }
  });
}

// The live data editor is a debug page and debug mode is off after a restart, so an unfinished edit
// is offered here: one tap turns debug mode on and opens the editor where it was left.
function offerResume() {
  if (!getState().resumeEdit) return;
  // page 18 draft { data }, or the CSV editor (page 19) draft { doc }
  const e18 = getDraft(), e19 = getCsvDraft();
  const d = e18?.data ? { name: e18.data.name, savedAt: e18.savedAt, page: 18, drop: clearDraft }
    : e19?.doc ? { name: e19.doc.name, savedAt: e19.savedAt, page: 19, drop: clearCsvDraft } : null;
  if (!d) return;
  const box = h('div', { class: 'resume-box', role: 'dialog' },
    h('p', null, '✎ ' + t('ed.draftFound', { name: d.name || '—', time: d.savedAt ? new Date(d.savedAt).toLocaleString(currentLang()) : '' })),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { box.remove(); setDebug(true); go(d.page); } }, t('ed.draftResume')),
      h('button', { class: 'btn ghost', onclick: () => box.remove() }, t('ed.draftLater')),
      h('button', { class: 'btn ghost', onclick: () => { if (confirm(t('ed.draftDropConfirm'))) { d.drop(); box.remove(); } } }, t('ed.draftDrop'))));
  document.body.append(box);
}

async function boot() {
  const s = getState();
  await loadLang(s.lang || detectLang());
  saveProgress();
  await loadData();
  loadImages();   // pages redraw when the images are ready
  window.addEventListener('hashchange', render);
  onDebug(() => render());
  render();
  offerResume();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // the offline copy of this version is missing (e.g. after "clear cache"): have it saved again
    navigator.serviceWorker.ready.then(async reg => {
      if (reg.installing || reg.waiting) return;   // a new version is being saved anyway
      // (the cache itself may already be back with a few files, so look for the "fully saved" note)
      if (!(await caches.match('cache-info.json', { cacheName: `cvdph-${APP.version}` }))) reg.active?.postMessage({ type: 'resave' });
    }).catch(() => {});
  }
}

boot();
