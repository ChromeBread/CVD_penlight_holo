// Page 2: safety warning, how to use each page, pre-live checklist.
import { h, t, getState, setState, pageNo } from '../core.js';

const CHECKS = ['airplane', 'power', 'volume', 'alarm', 'brightness', 'streetpass', 'charge', 'offline'];
const GUIDE_PAGES = [1, 3, 4, 5, 13, 15, 16];
const DEBUG_PAGES = [6, 7, 8, 9, 10, 11, 12, 14];

export default {
  id: 2,
  render(root) {
    const done = { ...getState().checklist };
    root.append(h('div', { class: 'page stack' },
      h('div', { class: 'danger' }, h('strong', null, '⚠ ' + t('p2.noSwing')), h('p', null, t('p2.noSwingSub'))),
      h('h2', null, t('p2.howTo')),
      h('dl', { class: 'howto' }, GUIDE_PAGES.flatMap(n => [h('dt', null, `${t('nav.page', { n: pageNo({ id: n }) })} ${t(`page.${n}`)}`), h('dd', null, t(`p2.use.${n}`), n === 1 ? [h('br'), t('p2.lockMove')] : null)])),
      h('details', null, h('summary', null, t('p2.debugPages')),
        h('dl', { class: 'howto' }, DEBUG_PAGES.flatMap(n => [h('dt', null, `${t('nav.page', { n: pageNo({ id: n }) })} ${t(`page.${n}`)}`), h('dd', null, t(`p2.use.${n}`))]))),
      h('h2', null, t('p2.beforeLive')),
      h('ul', { class: 'checklist' }, CHECKS.map(k => h('li', null,
        h('label', null,
          h('input', { type: 'checkbox', checked: !!done[k], onchange: e => { done[k] = e.target.checked; setState({ checklist: done }); } }),
          h('span', null, t(`p2.check.${k}`)))))),
      h('button', { class: 'btn ghost', onclick: () => { setState({ checklist: {} }); root.querySelectorAll('.checklist input').forEach(i => { i.checked = false; }); } }, t('p2.resetChecks')),
      h('h2', null, t('p2.offlineTitle')),
      h('p', null, t('p2.offline')),
      h('p', { class: 'fine' }, t('common.unofficial'))));
  },
};
