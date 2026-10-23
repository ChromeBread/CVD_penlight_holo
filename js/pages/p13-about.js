// Page 13: please post with the hashtag, debug switch, app info, credits, thanks.
import { h, t, APP, isDebug, setDebug } from '../core.js';
import { DB } from '../data.js';
import { toggle } from '../ui.js';

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
        h('dt', null, t('p13.name')), h('dd', null, `${APP.title} (${APP.code})`),
        h('dt', null, t('p13.version')), h('dd', null, APP.version),
        h('dt', null, t('p13.build')), h('dd', null, APP.build)),
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
