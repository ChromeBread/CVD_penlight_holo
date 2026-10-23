// Page 14 (debug): what debug mode changes, overlay opacity, penlight spec list.
import { h, t, getState, setState } from '../core.js';
import { DB } from '../data.js';

const clamp = v => Math.max(0, Math.min(95, Math.round(Number(v) || 0)));
const SPEC_COLS = ['penlight_name', 'maker', 'release', 'length_cm', 'screw', 'oshi_button', 'brightness_button', 'color_count', 'battery', 'note'];

export default {
  id: 14,
  debug: true,
  render(root) {
    const val = getState().overlayOpacity;
    const range = h('input', { type: 'range', min: '0', max: '95', step: '1', value: val });
    const num = h('input', { class: 'input num', type: 'number', min: '0', max: '95', step: '1', value: val, inputmode: 'numeric' });
    const apply = v => { v = clamp(v); range.value = v; num.value = v; setState({ overlayOpacity: v }); };
    range.addEventListener('input', e => apply(e.target.value));
    num.addEventListener('change', e => apply(e.target.value));

    root.append(h('div', { class: 'page stack' },
      h('h2', null, t('p14.what')),
      h('ul', null, t('p14.items').map(x => h('li', null, x))),
      h('h2', null, t('p14.opacity')),
      h('div', { class: 'row' }, range, num, h('span', null, '%')),
      h('p', { class: 'fine' }, t('p14.opacityNote')),
      h('h2', null, t('p14.specs')),
      DB.specs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, SPEC_COLS.map(c => h('th', null, t(`p14.col.${c}`))))),
        h('tbody', null, DB.specs.map(r => h('tr', { class: r.verified === 'yes' ? '' : 'unverified' }, SPEC_COLS.map(c => h('td', null, r[c] || '—')))))))
        : h('p', null, t('p14.noSpecs')),
      h('p', { class: 'fine' }, t('p14.specsNote'))));
  },
};
