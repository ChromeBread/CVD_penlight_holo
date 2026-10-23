// Page 20, shown as "Page 67" (page.20.no; just a meme number): CVDp-h itself is a beta /
// development test build, said plainly to everyone (not a debug page).
import { h, t, APP } from '../core.js';

export default {
  id: 20,
  render(root) {
    root.append(h('div', { class: 'page stack' },
      h('div', { class: 'beta-banner beta-big', role: 'note' },
        h('strong', null, 'β BETA'),
        h('span', { class: 'beta-title' }, t('beta.title')),
        h('span', null, t('beta.version', { v: APP.version }))),
      h('p', null, t('beta.lead')),
      h('ul', { class: 'beta-list' }, ['changes', 'data', 'bugs', 'backup'].map(k => h('li', null, t(`beta.${k}`)))),
      h('p', null, t('beta.thanks', { tag: APP.hashtag })),
      h('p', { class: 'fine' }, t('common.unofficial'))));
  },
};
