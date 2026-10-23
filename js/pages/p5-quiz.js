// Page 5: oshi color quiz for common color vision players.
import { h, t, getState, setState, isDebug, toast } from '../core.js';
import { buildSlots, stageMembers } from '../data.js';
import { glowBackground, paleHex } from '../color.js';
import { createPenlightButtons } from '../penlight.js';
import { stageSelect, penlightSelect, field, ensureSelection, memberName, slotColorName, fanBackground, hotButton } from '../ui.js';

const LAYOUT = {
  striped: { x: 0.5, y: 0.6, d: 0.72, r: 0 },
  plain: { x: 0.5, y: 0.6, d: 0.72, r: 180 },
  hitStriped: { x: 0.5, y: 0.6, d: 0.72, r: 0, shape: 'semi' },
  hitPlain: { x: 0.5, y: 0.6, d: 0.72, r: 180, shape: 'semi' },
};
const MAX_Q = 10;
const points = debug => (debug ? { best: 95, ok: 67, wrong: 2 } : { best: 10, ok: 6, wrong: 1 });
const label = (p, kind, debug) => (debug && kind !== 'ok' ? `${p}${t('p5.pt')}♠` : `${p}${t('p5.pt')}`);

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export default {
  id: 5,
  render(root) {
    const s = ensureSelection();
    let stageId = s.stageId, penlightId = s.penlightId;
    let buttons = null;
    const kill = () => { buttons?.destroy(); buttons = null; };

    function intro() {
      kill();
      root.replaceChildren(h('div', { class: 'page stack' },
        h('h2', null, t('p5.mindsetTitle')),
        h('ul', { class: 'mindset' }, t('p5.mindset').map(x => h('li', null, x))),
        h('p', { class: 'quote' }, t('p5.quote')),
        h('p', null, t('p5.understood')),
        field(t('common.stage'), stageSelect(stageId, v => { stageId = v; })),
        field(t('common.penlight'), penlightSelect(penlightId, v => { penlightId = v; })),
        h('button', { class: 'btn big', onclick: ready }, t('common.next') + ' ▶')));
    }

    function ready() {
      kill();
      const slots = buildSlots(stageId, penlightId);
      const pool = stageMembers(stageId).filter(m => slots.some(sl => sl.color_key === m.color_key));
      if (!slots.length || !pool.length) { intro(); return; }
      const debug = isDebug();
      const qs = shuffle(pool).slice(0, Math.min(MAX_Q, pool.length));
      const pt = points(debug);
      let on = false, idx = 0, q = -1, taps = 0, t0 = 0;
      const answers = [];

      const light = h('div', { class: 'p5-light off' });
      const msg = h('div', { class: 'p5-msg' }, h('p', null, t('p5.longPress')), h('p', null, t('p5.oshiReady')));
      const head = h('div', { class: 'p5-head' });
      const pad = h('div', { class: 'p5-pad' });
      const startBtn = h('button', { class: 'btn big', hidden: true, onclick: begin }, 'START');
      const decide = h('button', { class: 'btn big', hidden: true, onclick: submit }, t('p5.decide'));
      let hotReturn = null;
      const oshiBtn = hotButton('💖 ' + t('p1.oshi'), {
        onSave: () => { if (on) { setState({ oshiColorKey: slots[idx].color_key }); toast(t('p1.hotSaved', { color: slotColorName(slots[idx]) })); } },
        onJump: jumpOshi,
      });
      oshiBtn.className = 'btn ghost';
      root.replaceChildren(h('div', { class: 'p5' }, head, light, msg, h('div', { class: 'row center' }, startBtn, decide, oshiBtn), pad));

      buttons = createPenlightButtons(pad, {
        layout: LAYOUT, guard: () => 'off',
        onLongPress: () => { if (!on) turnOn(); },
        onNext: () => move(1),
        onPrev: () => move(-1),
      });

      // next / back right after a Hot Button jump returns to the color before the jump
      function move(d) {
        if (!on) return;
        taps++;
        if (hotReturn != null) { idx = hotReturn; hotReturn = null; } else idx = (idx + d + slots.length) % slots.length;
        paint();
      }

      function paint() { light.classList.toggle('off', !on); light.style.background = on ? glowBackground(slots[idx].hex) : ''; }

      function jumpOshi() {
        const i = slots.findIndex(sl => sl.color_key === getState().oshiColorKey);
        if (!on) return;
        if (i < 0) { toast(t('p1.oshiNotSet')); return; }
        if (hotReturn == null) hotReturn = idx;
        idx = i; taps = Infinity; paint();
      }

      function turnOn() {
        on = true; idx = 0; taps = 0; paint();
        const max = qs.length * pt.best;
        msg.replaceChildren(
          h('div', { class: 'p5-fan', style: { background: fanBackground(slots) } }),
          h('ul', { class: 'p5-legend' }, slots.map(sl => h('li', null,
            h('span', { class: 'dot', style: { background: paleHex(sl.hex) } }),
            `${slotColorName(sl)} ${sl.members.map(m => m.oshi_mark).join('')}`))),
          h('p', null, h('strong', null, t('p5.maxScore', { max }))),
          h('p', null, t('p5.pressStart')));
        startBtn.hidden = false;
      }

      function begin() { startBtn.hidden = true; decide.hidden = false; nextQ(); }

      function nextQ() {
        q++;
        if (q >= qs.length) return result();
        const m = qs[q];
        idx = 0; taps = 0; hotReturn = null; paint();
        head.replaceChildren(h('small', null, t('p5.q', { n: q + 1, total: qs.length })), h('strong', { class: 'p5-member' }, `${m.oshi_mark} ${memberName(m)}`));
        msg.replaceChildren(h('p', { class: 'fine' }, t('p5.hint')));
        t0 = performance.now();
      }

      function submit() {
        const m = qs[q], n = slots.length;
        const target = slots.findIndex(sl => sl.color_key === m.color_key);
        const shortest = Math.min(target, n - target);
        const correct = slots[idx].color_key === m.color_key;
        const kind = !correct ? 'wrong' : taps <= shortest ? 'best' : 'ok';
        answers.push({ m, kind, p: pt[kind], taps, shortest, sec: (performance.now() - t0) / 1000, chosen: slots[idx], answer: slots[target] });
        nextQ();
      }

      function result() {
        kill();
        const total = answers.reduce((a, x) => a + x.p, 0), max = qs.length * pt.best;
        const list = h('div', { class: 'p5-list', hidden: true }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['#', t('p5.col.member'), t('p5.col.answer'), t('p5.col.result'), t('p5.col.taps'), t('p5.col.time')].map(x => h('th', null, x)))),
          h('tbody', null, answers.map((a, i) => h('tr', null,
            h('td', null, i + 1),
            h('td', null, `${a.m.oshi_mark} ${memberName(a.m)}`),
            h('td', null, `${slotColorName(a.chosen)} → ${slotColorName(a.answer)}`),
            h('td', null, `${a.kind === 'wrong' ? '✗' : '✓'} ${label(a.p, a.kind, debug)}`),
            h('td', null, a.taps === Infinity ? '💖' : `${a.taps} / ${a.shortest} ${a.kind === 'best' ? t('p5.shortest') : ''}`),
            h('td', null, `${a.sec.toFixed(2)}s`))))));
        root.replaceChildren(h('div', { class: 'page stack center' },
          h('p', { class: 'hooray' }, t('p5.hooray')),
          h('p', { class: 'score' }, `${debug ? label(total, 'best', true) : total} / ${max}`),
          debug ? h('button', { class: 'btn', onclick: () => { list.hidden = !list.hidden; } }, t('p5.wakatta')) : null,
          list,
          h('div', { class: 'row center' },
            h('button', { class: 'btn', onclick: ready }, '↻ ' + t('common.again')),
            h('button', { class: 'btn ghost', onclick: intro }, t('common.back')))));
      }
    }

    intro();
    return kill;
  },
};
