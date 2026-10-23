// Page 3: "Color match with your neighbor" - a two-player game on one screen.
// Top (upside down, kept small) = common color vision player, bottom = color vision diversity player.
import { h, t, toast } from '../core.js';
import { buildSlots, stageMembers } from '../data.js';
import { glowBackground, paleHex } from '../color.js';
import { createPenlightButtons } from '../penlight.js';
import { stageSelect, penlightSelect, field, ensureSelection, memberName, memberLabel, slotColorName, swatch } from '../ui.js';

// Fixed layout for the game: edits from Page 1 never apply here.
// The circle is much bigger than the pad and sits low, so only its top ~40% is on screen:
// pad height = 0.4 x diameter (see .p3-pad), diameter = 2.5 x pad height, center 1.25 below the top.
const GAME_LAYOUT = {
  striped: { x: 0.5, y: 1.25, d: 2.5, r: 0 },
  plain: { x: 0.5, y: 1.25, d: 2.5, r: 180 },
  hitStriped: { x: 0.5, y: 1.25, d: 2.5, r: 0, shape: 'semi' },
  hitPlain: { x: 0.5, y: 1.25, d: 2.5, r: 180, shape: 'semi' },
};
const ROUNDS = 10;
const MARK = ok => (ok ? '○' : '△');

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
      let idx = 0, round = 0, target = null, judging = false;
      const results = [];  // true = ○, false = △, one per judged round
      const count = ok => results.filter(x => x === ok).length;

      // the current light with the two previous / next colors on each side
      const discs = h('div', { class: 'p3-discs' });
      const topTarget = h('div', { class: 'p3-target' });
      const botTarget = h('div', { class: 'p3-target' });
      const reveal = h('div', { class: 'p3-reveal' });
      const tally = h('div', { class: 'p3-tally' });
      const fixBtn = h('button', { class: 'btn ghost p3-fix', hidden: true, onclick: fixLast }, t('p3.fix'));
      const top = h('div', { class: 'p3-half p3-top' },
        topTarget, reveal,
        h('div', { class: 'row center' },
          h('button', { class: 'btn judge good', onclick: () => judge(true) }, t('p3.great')),
          h('button', { class: 'btn judge close', onclick: () => judge(false) }, t('p3.close'))),
        h('div', { class: 'row center p3-sub' }, tally, fixBtn),
        h('p', { class: 'fine' }, t('p3.topRole')));
      const padArea = h('div', { class: 'p3-pad' });
      const bottom = h('div', { class: 'p3-half p3-bottom' }, botTarget, h('p', { class: 'fine' }, t('p3.bottomRole')), padArea);
      root.replaceChildren(h('div', { class: 'p3' }, top, discs, bottom));

      buttons = createPenlightButtons(padArea, {
        layout: GAME_LAYOUT,
        guard: () => 'off',
        onNext: () => { idx = (idx + 1) % slots.length; paint(); },
        onPrev: () => { idx = (idx - 1 + slots.length) % slots.length; paint(); },
      });

      function paint() {
        const at = k => slots[((idx + k) % slots.length + slots.length) % slots.length];
        discs.replaceChildren(...[-2, -1, 0, 1, 2].map(k =>
          h('div', { class: `p3-disc d${k}`, style: { background: glowBackground(at(k).hex) }, 'aria-hidden': k !== 0 })));
      }
      const showTally = () => { tally.textContent = `○ ${count(true)}   △ ${count(false)}`; };

      function next() {
        round++;
        if (round > ROUNDS) return finish();
        target = pool[Math.floor(Math.random() * pool.length)];
        const label = () => memberLabel(target, true);
        const q = t('p3.round', { n: round, total: ROUNDS });
        topTarget.replaceChildren(h('small', null, q), h('strong', null, label()));
        botTarget.replaceChildren(h('small', null, q), h('strong', null, label()));
        reveal.replaceChildren();
        showTally();
        judging = false;
        paint();
      }

      function judge(ok) {
        if (judging) return;
        judging = true;
        results.push(ok);
        fixBtn.hidden = false;
        const ans = slots.find(sl => sl.color_key === target.color_key);
        reveal.replaceChildren(h('span', null, t('p3.answer')), swatch(paleHex(ans.hex), slotColorName(ans)));
        showTally();
        setTimeout(next, 1600);
      }

      // the common color vision player can flip the last judgment once
      function fixLast() {
        if (!results.length) return;
        const i = results.length - 1;
        results[i] = !results[i];
        fixBtn.hidden = true;
        showTally();
        toast(t('p3.fixed', { from: MARK(!results[i]), to: MARK(results[i]) }));
      }

      function finish() {
        buttons.destroy(); buttons = null;
        const msg = h('div', { class: 'stack center' },
          h('p', { class: 'big-text' }, t('p3.finished')),
          h('p', null, `○ ${count(true)}   △ ${count(false)}`),
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
