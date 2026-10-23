// Pages 7-11 (debug): single big message cards to show someone nearby.
import { h, t } from '../core.js';
import { messageCard } from '../ui.js';

const card = (id, tone, caution = false) => ({
  id,
  debug: true,
  render(root) {
    root.append(h('div', { class: 'page full' },
      caution ? h('p', { class: 'card-caution' }, '⚠ ' + t('cards.caution')) : null,
      messageCard(t(`p${id}.lines`), { tone })));
  },
});

export const p7 = card(7, 'warm');          // thank you
export const p8 = card(8, 'calm');          // sorry
export const p9 = card(9, 'warn', true);    // ultra orange
export const p10 = card(10, 'warn', true);  // photos
export const p11 = card(11, 'urgent');      // medical emergency (shown as the local emergency number)
