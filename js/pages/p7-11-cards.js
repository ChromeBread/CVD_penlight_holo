// Pages 7-11 (debug): single big message cards to show someone nearby.
import { h, t } from '../core.js';
import { messageCard } from '../ui.js';

// With a caution, the page opens on a note for the app user only;
// the card for the other person comes next, and both can be switched back and forth.
const card = (id, tone, caution = false) => ({
  id,
  debug: true,
  render(root) {
    // a function of the translator, so the language buttons under the card can switch its text
    const lines = tr => (caution ? [...tr(`p${id}.lines`), tr('cards.gentle')] : tr(`p${id}.lines`));
    // the way back is small and tucked in a corner, so the other person won't tap it by accident
    const showCard = () => root.replaceChildren(h('div', { class: 'page full' },
      caution ? h('button', { class: 'btn ghost card-back', onclick: showNote }, t('cards.toNote')) : null,
      messageCard(lines, { tone })));
    const showNote = () => root.replaceChildren(h('div', { class: 'page stack' },
      h('p', { class: 'card-caution' }, '⚠ ' + t('cards.caution')),
      h('button', { class: 'btn big', onclick: showCard }, t('cards.toCard'))));
    (caution ? showNote : showCard)();
  },
});

export const p7 = card(7, 'warm');          // thank you
export const p8 = card(8, 'calm');          // sorry
export const p9 = card(9, 'warn', true);    // ultra orange
export const p10 = card(10, 'warn', true);  // photos
export const p11 = card(11, 'urgent');      // medical emergency (shown as the local emergency number)
