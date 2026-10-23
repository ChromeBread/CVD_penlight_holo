import { h, t, APP, LANGS, getState, setState, detectLang, loadLang, currentLang, isDebug, onDebug } from './core.js';
import { loadData } from './data.js';
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

const PAGES = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14];
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

function renderBar(page) {
  bar.replaceChildren(
    h('button', { class: 'icon-btn', 'aria-label': t('nav.menu'), onclick: openMenu }, '☰'),
    h('div', { class: 'bar-title' }, h('span', { class: 'bar-no' }, `P${page.id}`), t(`page.${page.id}`)),
    h('div', { id: 'bar-actions', class: 'bar-actions' }),
  );
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
  const close = () => sheet.remove();
  const list = PAGES.filter(p => !p.debug || isDebug()).map(p =>
    h('button', { class: 'menu-item' + (p === pageFromHash() ? ' active' : ''), onclick: () => { close(); go(p.id); } },
      h('span', { class: 'menu-no' }, p.id), t(`page.${p.id}`), p.debug ? h('span', { class: 'tag' }, 'DEBUG') : null));
  const langSel = h('select', {
    class: 'select', 'aria-label': t('nav.language'),
    onchange: async e => { setState({ lang: e.target.value }); await loadLang(e.target.value); close(); render(); },
  }, LANGS.map(l => h('option', { value: l.code, selected: l.code === currentLang() }, l.label)));
  const sheet = h('div', { class: 'menu-backdrop', onclick: e => { if (e.target === sheet) close(); } },
    h('nav', { class: 'menu' },
      h('div', { class: 'menu-head' }, h('strong', null, APP.title), h('button', { class: 'icon-btn', 'aria-label': t('common.close'), onclick: close }, '✕')),
      h('label', { class: 'field' }, h('span', null, '🌐 ' + t('nav.language')), langSel),
      h('div', { class: 'menu-list' }, list),
      h('p', { class: 'fine' }, t('common.unofficial'))));
  document.body.append(sheet);
}

async function boot() {
  const s = getState();
  await loadLang(s.lang || detectLang());
  await loadData();
  window.addEventListener('hashchange', render);
  onDebug(() => render());
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
