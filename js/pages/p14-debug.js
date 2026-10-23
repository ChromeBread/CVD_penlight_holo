// Page 14 (debug): what debug mode changes, debug switches, opacity, penlight spec list.
import { h, t, getState, setState, currentLang, pageNo } from '../core.js';
import { DB } from '../data.js';
import { toggle } from '../ui.js';

// Sudden ends recorded by app.js (the browser closed while this app was on screen).
function crashLog() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('cvdph.crashes.v1') || '[]'); } catch { /* ignore */ }
  const when = ms => { try { return new Date(ms).toLocaleString(currentLang()); } catch { return ''; } };
  const box = h('div', { class: 'stack' },
    h('h2', null, t('p14.crashes')),
    h('p', { class: 'fine' }, t('p14.crashesNote')),
    list.length ? h('ul', { class: 'plain crash-list' }, list.map(c => h('li', null,
      t('p14.crashItem', { at: when(c.at), page: c.page ? pageNo({ id: c.page }) : '?', min: c.since && c.at ? Math.max(0, Math.round((c.at - c.since) / 60000)) : '?', v: c.v || '?' }))))
      : h('p', { class: 'fine' }, t('p14.crashNone')),
    list.length ? h('button', { class: 'btn ghost', onclick: () => { try { localStorage.removeItem('cvdph.crashes.v1'); } catch { /* ignore */ } box.replaceWith(crashLog()); } }, t('p14.crashClear')) : null);
  return box;
}

const clamp = v => Math.max(0, Math.min(95, Math.round(Number(v) || 0)));
const SPEC_COLS = ['penlight_name', 'maker', 'release', 'length_cm', 'screw', 'oshi_button', 'brightness_button', 'color_count', 'battery', 'note'];

// 0-95 % slider + number box bound to one state key.
function percent(key) {
  const val = getState()[key];
  const range = h('input', { type: 'range', min: '0', max: '95', step: '1', value: val });
  const num = h('input', { class: 'input num', type: 'number', min: '0', max: '95', step: '1', value: val, inputmode: 'numeric' });
  const apply = v => { v = clamp(v); range.value = v; num.value = v; setState({ [key]: v }); };
  range.addEventListener('input', e => apply(e.target.value));
  num.addEventListener('change', e => apply(e.target.value));
  return h('div', { class: 'row' }, range, num, h('span', null, '%'));
}

export default {
  id: 14,
  debug: true,
  render(root) {
    const st = getState();
    root.append(h('div', { class: 'page stack' },
      h('h2', null, t('p14.what')),
      h('ul', null, t('p14.items').map(x => h('li', null, x))),
      toggle(t('p14.surprise'), st.showSurprise, v => setState({ showSurprise: v })),
      h('p', { class: 'fine' }, t('p14.surpriseNote')),
      toggle(t('p14.resume'), st.resumeEdit, v => setState({ resumeEdit: v })),
      h('p', { class: 'fine' }, t('p14.resumeNote')),
      toggle(t('p14.hits'), st.showHits, v => setState({ showHits: v })),
      h('h2', null, t('p14.hitOpacity')),
      percent('hitOpacity'),
      h('p', { class: 'fine' }, t('p14.hitNote')),
      h('h2', null, t('p14.opacity')),
      percent('overlayOpacity'),
      h('p', { class: 'fine' }, t('p14.opacityNote')),
      h('h2', null, t('p14.specs')),
      DB.specs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, SPEC_COLS.map(c => h('th', null, t(`p14.col.${c}`))))),
        h('tbody', null, DB.specs.map(r => h('tr', { class: r.verified === 'yes' ? '' : 'unverified' }, SPEC_COLS.map(c => h('td', null, r[c] || '—')))))))
        : h('p', null, t('p14.noSpecs')),
      h('p', { class: 'fine' }, t('p14.specsNote')),
      crashLog()));
  },
};
