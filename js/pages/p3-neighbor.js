// Page 3: "Color match with your neighbor" - a two-player game on one screen.
// Top half (upside down) = common color vision player, bottom half = color vision diversity player.
import { h, t, getState } from '../core.js';
import { buildSlots, stageMembers } from '../data.js';
import { glowBackground, paleHex } from '../color.js';
import { createPenlightButtons } from '../penlight.js';
import { stageSelect, penlightSelect, field, ensureSelection, memberName, slotColorName, swatch } from '../ui.js';

// Fixed layout for the game: edits from Page 1 never apply here.
const GAME_LAYOUT = {
  striped: { x: 0.5, y: 0.66, d: 0.78, r: 0 },
  plain: { x: 0.5, y: 0.66, d: 0.78, r: 180 },
  hitStriped: { x: 0.5, y: 0.66, d: 0.78, r: 0, shape: 'semi' },
  hitPlain: { x: 0.5, y: 0.66, d: 0.78, r: 180, shape: 'semi' },
};
const ROUNDS = 10;

export default {
  id: 3,
  render(root) {
    const s = ensureSelection();
    let stageId = s.stageId, penlightId = s.penlightId;
    let buttons = null;

    function setup() {
      buttons?.destroy(); buttons = null;
      root.replaceChildren(h('div', { class: 'page stack' },
        h('p', null, t('p3.intro')),
        field(t('common.stage'), stageSelect(stageId, v => { stageId = v; })),
        field(t('common.penlight'), penlightSelect(penlightId, v => { penlightId = v; })),
        h('p', { class: 'fine' }, t('p3.fixedLayout')),
        h('button', { class: 'btn big', onclick: play }, '▶ ' + t('common.start'))));
    }

    function play() {
      const slots = buildSlots(stageId, penlightId);
      const pool = stageMembers(stageId).filter(m => slots.some(sl => sl.color_key === m.color_key));
      if (!pool.length) { setup(); return; }
      let idx = 0, round = 0, great = 0, close = 0, target = null, judging = false;

      const light = h('div', { class: 'p3-light' });
      const topTarget = h('div', { class: 'p3-target' });
      const botTarget = h('div', { class: 'p3-target' });
      const reveal = h('div', { class: 'p3-reveal' });
      const tally = h('div', { class: 'p3-tally' });
      const top = h('div', { class: 'p3-half p3-top' },
        topTarget, reveal,
        h('div', { class: 'row center' },
          h('button', { class: 'btn judge good', onclick: () => judge(true) }, t('p3.great')),
          h('button', { class: 'btn judge close', onclick: () => judge(false) }, t('p3.close'))),
        tally,
        h('p', { class: 'fine' }, t('p3.topRole')));
      const padArea = h('div', { class: 'p3-pad' });
      const bottom = h('div', { class: 'p3-half p3-bottom' }, botTarget, h('p', { class: 'fine' }, t('p3.bottomRole')), padArea);
      root.replaceChildren(h('div', { class: 'p3' }, top, light, bottom));

      buttons = createPenlightButtons(padArea, {
        layout: GAME_LAYOUT,
        guard: () => 'off',
        onNext: () => { idx = (idx + 1) % slots.length; paint(); },
        onPrev: () => { idx = (idx - 1 + slots.length) % slots.length; paint(); },
      });

      function paint() { light.style.background = glowBackground(slots[idx].hex); }

      function next() {
        round++;
        if (round > ROUNDS) return finish();
        target = pool[Math.floor(Math.random() * pool.length)];
        const label = `${target.oshi_mark} ${memberName(target)}`;
        const q = t('p3.round', { n: round, total: ROUNDS });
        topTarget.replaceChildren(h('small', null, q), h('strong', null, label));
        botTarget.replaceChildren(h('small', null, q), h('strong', null, label));
        reveal.replaceChildren();
        tally.textContent = `○ ${great}   △ ${close}`;
        judging = false;
        paint();
      }

      function judge(ok) {
        if (judging) return;
        judging = true;
        ok ? great++ : close++;
        const ans = slots.find(sl => sl.color_key === target.color_key);
        reveal.replaceChildren(h('span', null, t('p3.answer')), swatch(paleHex(ans.hex), slotColorName(ans)));
        tally.textContent = `○ ${great}   △ ${close}`;
        setTimeout(next, 1600);
      }

      function finish() {
        buttons.destroy(); buttons = null;
        const msg = h('div', { class: 'stack center' },
          h('p', { class: 'big-text' }, t('p3.finished')),
          h('p', null, `○ ${great}   △ ${close}`),
          h('p', null, t('p3.thanks')));
        root.replaceChildren(h('div', { class: 'p3' },
          h('div', { class: 'p3-half p3-top' }, msg.cloneNode(true)),
          h('div', { class: 'p3-half p3-bottom' }, msg,
            h('div', { class: 'row center' },
              h('button', { class: 'btn', onclick: play }, '↻ ' + t('common.again')),
              h('button', { class: 'btn ghost', onclick: setup }, t('common.back'))))));
      }

      next();
    }

    setup();
    return () => buttons?.destroy();
  },
};
