// Pages 7-11 (debug): single big message cards to show someone nearby.
import { h, t } from '../core.js';
import { messageCard } from '../ui.js';

const card = (id, tone) => ({
  id,
  debug: true,
  render(root) {
    root.append(h('div', { class: 'page full' }, messageCard(t(`p${id}.lines`), { tone })));
  },
});

export const p7 = card(7, 'warn');
export const p8 = card(8, 'warn');
export const p9 = card(9, 'urgent');
export const p10 = card(10, 'warm');
export const p11 = card(11, 'calm');
