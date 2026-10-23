// Page 6 (debug): phrase cards for when you cannot talk out loud.
import { h, t } from '../core.js';
import { messageCard } from '../ui.js';

export default {
  id: 6,
  debug: true,
  render(root) {
    const list = () => root.replaceChildren(h('div', { class: 'page' },
      h('p', { class: 'fine' }, t('p6.intro')),
      h('div', { class: 'phrase-grid' }, t('p6.phrases').map(p =>
        h('button', { class: 'phrase', onclick: () => show(p) }, p)))));
    const show = p => root.replaceChildren(h('div', { class: 'page full' },
      messageCard([p]),
      h('button', { class: 'btn ghost', onclick: list }, '← ' + t('common.back'))));
    list();
  },
};
