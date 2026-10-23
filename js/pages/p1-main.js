// Page 1: main penlight helper.
import { h, t, getState, setState, isDebug, toast } from '../core.js';
import { buildSlots, unmatchedMembers, stageMembers } from '../data.js';
import { paleHex, simulateHex, glowBackground } from '../color.js';
import { createPenlightButtons, cloneLayout, defaultLayout, KEYS } from '../penlight.js';
import { stageSelect, penlightSelect, cvTypeSelect, field, toggle, ensureSelection, memberName, slotColorName, swatch, bottomSheet, hotButton } from '../ui.js';

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported / denied */ }
}

export default {
  id: 1,
  render(root) {
    let s = ensureSelection();
    let slots = buildSlots(s.stageId, s.penlightId);
    let locked = false, editing = false;
    const n = () => slots.length || 1;
    const idx = () => ((getState().index % n()) + n()) % n();

    const disc = h('div', { class: 'disc', 'aria-live': 'polite' });
    const info = h('div', { class: 'now' });
    const stage = h('div', { class: 'pl-stage' });
    const lockBanner = h('div', { class: 'lock-banner', hidden: true }, '🔒 ' + t('p1.lockedHint'));
    const oshiBtn = hotButton('💖 ' + t('p1.oshi'), { onSave: saveOshi, onJump: jumpOshi });
    oshiBtn.hidden = true;
    const editBar = h('div', { class: 'edit-bar', hidden: true });
    const wrap = h('div', { class: 'p1' }, disc, info, stage, lockBanner, oshiBtn, editBar);
    root.append(wrap);

    const buttons = createPenlightButtons(stage, {
      layout: s.layout || defaultLayout(),
      guard: () => getState().guard,
      swap: () => getState().swapDirection,
      isLocked: () => locked,
      labelStriped: t('p1.btnStriped'), labelPlain: t('p1.btnPlain'),
      onNext: () => step(1),
      onPrev: () => step(-1),
      onBlocked: why => { if (why === 'locked') pulse(lockBanner); },
      onChange: l => setState({ layout: cloneLayout(l) }),
    });

    function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

    function step(d) {
      // After a Hot Button jump, next / back returns to the color before the jump (like the real penlight).
      const back = getState().hotReturn;
      if (back != null) { setState({ index: back, hotReturn: null }); draw(); return; }
      setState({ index: idx() + d });
      draw(d);
    }

    function saveOshi() {
      setState({ oshiColorKey: slots[idx()].color_key });
      toast(t('p1.hotSaved', { color: slotColorName(slots[idx()]) }));
      draw();
    }

    function jumpOshi() {
      const i = slots.findIndex(sl => sl.color_key === getState().oshiColorKey);
      if (i < 0) { toast(t('p1.oshiNotSet')); return; }
      if (getState().hotReturn == null) setState({ hotReturn: idx() });
      setState({ index: i });
      draw();
    }

    function marks(slot) { return slot.members.map(m => m.oshi_mark).join(' ') || '·'; }

    function draw(dir = 0) {
      s = getState();
      if (!slots.length) {
        disc.replaceChildren();
        info.replaceChildren(h('p', { class: 'empty' }, t('p1.noData')));
        return;
      }
      const i = idx();
      const at = k => slots[((i + k) % n() + n()) % n()];
      const debug = isDebug();
      // disc row: -2 .. +2
      disc.replaceChildren(...[-2, -1, 0, 1, 2].map(k => {
        const sl = at(k);
        return h('div', { class: `disc-item d${k}`, 'aria-hidden': k !== 0 },
          h('div', { class: 'disc-light', style: { background: glowBackground(sl.hex) } }),
          h('div', { class: 'disc-mark' }, marks(sl)),
          k !== 0 ? h('div', { class: 'disc-tag' }, k < 0 ? t('p1.prev') : t('p1.next')) : null);
      }));
      if (dir) { disc.classList.remove('slide-l', 'slide-r'); void disc.offsetWidth; disc.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }

      const cur = at(0);
      const pale = paleHex(cur.hex);
      const sim = simulateHex(pale, s.cvType);
      const names = cur.members.length ? cur.members.map(m => h('div', { class: 'now-member' },
        h('span', { class: 'now-mark' }, m.oshi_mark), h('span', null, memberName(m)))) : [h('div', { class: 'now-member muted' }, t('p1.nobody'))];
      const overlay = debug && cur.members[0]?.image
        ? h('img', { class: 'member-img', src: cur.members[0].image, alt: '', style: { opacity: String(1 - (getState().overlayOpacity / 100)) } }) : null;
      info.replaceChildren(
        h('div', { class: 'now-head' },
          h('span', { class: 'now-count' }, `${i + 1}/${n()}`),
          h('span', { class: 'now-color' }, slotColorName(cur))),
        h('div', { class: 'now-members' }, names),
        h('div', { class: 'pair' },
          h('div', { class: 'pair-cell' }, overlay, swatch(pale, t('cv.C.short'), cur.hex)),
          h('div', { class: 'pair-cell' }, swatch(sim, t(`cv.${s.cvType}.short`), sim))),
        h('div', { class: 'neighbors' },
          h('span', null, `◀ ${marks(at(-1))}`), h('span', null, `${marks(at(1))} ▶`)));

      oshiBtn.hidden = !(debug && s.oshiButton);
      const saved = slots.find(sl => sl.color_key === s.oshiColorKey);
      oshiBtn.style.boxShadow = saved ? `0 0 0 3px ${paleHex(saved.hex)}` : '';
    }

    // ---------- movable lock button: tap toggles, drag moves ----------
    const lockBtn = h('button', { class: 'lock-fab', 'aria-label': t('p1.lock') }, '🔓');
    wrap.append(lockBtn);
    const setLock = on => {
      locked = on; lockBtn.textContent = on ? '🔒' : '🔓';
      lockBanner.hidden = !on; wrap.classList.toggle('locked', on);
    };
    function placeLock(pos = getState().lockPos || { x: 0.9, y: 0.64 }) {
      const size = getState().lockSize;
      const W = wrap.clientWidth || 1, H = wrap.clientHeight || 1;
      const x = Math.max(0, Math.min(W - size, pos.x * W - size / 2));
      const y = Math.max(0, Math.min(H - size, pos.y * H - size / 2));
      Object.assign(lockBtn.style, { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px`, transform: `translate(${x}px, ${y}px)` });
    }
    let drag = null, moved = false, lockFrame = 0;
    lockBtn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      try { lockBtn.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      moved = false;
    });
    lockBtn.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
      moved = true;
      const r = wrap.getBoundingClientRect();
      drag.pos = { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.height || 1) };
      // draw at most once per frame; saved on release
      if (!lockFrame) lockFrame = requestAnimationFrame(() => { lockFrame = 0; if (drag?.pos) placeLock(drag.pos); });
    });
    const endDrag = () => {
      cancelAnimationFrame(lockFrame); lockFrame = 0;
      if (drag?.pos) { setState({ lockPos: drag.pos }); placeLock(); }
      drag = null;
    };
    lockBtn.addEventListener('pointerup', endDrag);
    lockBtn.addEventListener('pointercancel', endDrag);
    lockBtn.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      setLock(!locked);
      if (!locked) toast(t('p1.unlocked'));
    });
    const lockRo = new ResizeObserver(() => placeLock());
    lockRo.observe(wrap);
    placeLock();

    // ---------- top bar action: settings ----------
    const actions = document.getElementById('bar-actions');
    actions.append(h('button', { class: 'icon-btn', 'aria-label': t('p1.settings'), onclick: openSettings }, '⚙'));

    function reload() {
      s = getState();
      slots = buildSlots(s.stageId, s.penlightId);
      draw();
    }

    function openSettings() {
      const st = getState();
      const missing = unmatchedMembers(st.stageId, st.penlightId);
      const debugPart = isDebug() ? [
        h('h3', null, 'DEBUG'),
        toggle(t('p1.oshiButtonMode'), st.oshiButton, v => { setState({ oshiButton: v }); draw(); }),
        h('p', { class: 'fine' }, t('p1.hotHelp')),
        field(t('p1.myOshi'), h('select', { class: 'select', onchange: e => {
          const m = stageMembers(getState().stageId).find(x => x.member_id === e.target.value);
          setState({ oshiMemberId: e.target.value, oshiColorKey: m ? m.color_key : null }); draw();
        } },
          h('option', { value: '' }, '—'),
          stageMembers(st.stageId).map(m => h('option', { value: m.member_id, selected: m.member_id === st.oshiMemberId }, `${m.oshi_mark} ${memberName(m)}`)))),
        field(`${t('p1.lockSize')} (px)`, h('input', { type: 'range', min: '48', max: '140', step: '2', value: st.lockSize,
          oninput: e => { setState({ lockSize: Number(e.target.value) }); placeLock(); } })),
      ] : [];
      const close = bottomSheet(h('div', { class: 'stack' },
        h('h2', null, t('p1.settings')),
        field(t('common.stage'), stageSelect(st.stageId, v => { setState({ stageId: v, index: 0, hotReturn: null }); reload(); })),
        field(t('common.penlight'), penlightSelect(st.penlightId, v => { setState({ penlightId: v, index: 0, hotReturn: null }); reload(); })),
        missing.length ? h('p', { class: 'warn' }, t('p1.notOnPenlight', { list: missing.map(m => m.oshi_mark + memberName(m)).join(', ') })) : null,
        field(t('p1.compareWith'), cvTypeSelect(st.cvType, v => { setState({ cvType: v }); draw(); })),
        field(t('p1.guard'), h('select', { class: 'select', onchange: e => setState({ guard: e.target.value }) },
          ['off', 'cooldown', 'hold'].map(g => h('option', { value: g, selected: g === st.guard }, t(`p1.guard.${g}`))))),
        h('p', { class: 'fine' }, t('p1.guardHelp')),
        toggle(t('p1.keepAwake'), st.wakeLock, v => { setState({ wakeLock: v }); keepAwake(v); }),
        toggle(t('p1.swap'), st.swapDirection, v => setState({ swapDirection: v })),
        h('button', { class: 'btn', onclick: () => { close(); startEdit(); } }, '✎ ' + t('p1.editLayout')),
        debugPart));
    }

    // ---------- half-circle edit mode ----------
    function startEdit() {
      editing = true;
      wrap.classList.add('editing');
      buttons.setEdit(true);
      buildEditBar();
      editBar.hidden = false;
    }
    function endEdit() {
      editing = false;
      wrap.classList.remove('editing');
      buttons.setEdit(false);
      editBar.hidden = true;
      setState({ layout: cloneLayout(buttons.layout) });
    }
    function buildEditBar() {
      const sel = buttons.selected;
      const it = buttons.layout[sel];
      const presets = getState().presets;
      const chip = k => h('button', { class: 'chip' + (k === sel ? ' on' : ''), onclick: () => { buttons.select(k); buildEditBar(); } }, t(`p1.part.${k}`));
      const size = h('input', { type: 'range', min: '0.05', max: '2', step: '0.01', value: it.d, oninput: e => { buttons.update({ d: Number(e.target.value) }); } });
      const rot = h('input', { type: 'range', min: '-180', max: '180', step: '1', value: ((it.r + 540) % 360) - 180, oninput: e => { buttons.update({ r: Number(e.target.value) }); } });
      const shape = sel.startsWith('hit') ? field(t('p1.hitShape'), h('select', { class: 'select', onchange: e => buttons.update({ shape: e.target.value }) },
        ['semi', 'rect'].map(v => h('option', { value: v, selected: it.shape === v }, t(`p1.shape.${v}`))))) : null;
      const copyBtn = sel.startsWith('hit') ? h('button', { class: 'btn ghost', onclick: () => {
        const src = buttons.layout[sel === 'hitStriped' ? 'striped' : 'plain'];
        buttons.update({ x: src.x, y: src.y, d: src.d, r: src.r }); buildEditBar();
      } }, t('p1.matchLook')) : null;
      const presetSel = h('select', { class: 'select' }, h('option', { value: '' }, t('p1.presets')), presets.map((p, i) => h('option', { value: String(i) }, p.name)));
      editBar.replaceChildren(
        h('div', { class: 'edit-head' }, h('div', { class: 'chips' }, KEYS.map(chip)),
          h('button', { class: 'icon-btn edit-close', 'aria-label': t('common.close'), onclick: endEdit }, '✕')),
        h('p', { class: 'fine' }, t('p1.editHelp')),
        field(t('p1.size'), size), field(t('p1.rotate'), rot), ...[shape, copyBtn].filter(Boolean),
        h('div', { class: 'row' },
          presetSel,
          h('button', { class: 'btn ghost', onclick: () => { const p = presets[Number(presetSel.value)]; if (p) { buttons.setLayout(p.layout); setState({ layout: cloneLayout(p.layout) }); buildEditBar(); } } }, t('p1.load')),
          h('button', { class: 'btn ghost', onclick: () => {
            const name = prompt(t('p1.presetName'), `Preset ${presets.length + 1}`);
            if (!name) return;
            setState({ presets: [...presets, { name, layout: cloneLayout(buttons.layout) }] }); buildEditBar(); toast(t('common.saved'));
          } }, t('p1.save')),
          h('button', { class: 'btn ghost', onclick: () => { const i = Number(presetSel.value); if (presetSel.value === '') return; setState({ presets: presets.filter((_, j) => j !== i) }); buildEditBar(); } }, t('p1.delete'))),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => { buttons.setLayout(defaultLayout()); setState({ layout: defaultLayout() }); buildEditBar(); } }, t('p1.reset')),
          h('button', { class: 'btn', onclick: endEdit }, '✓ ' + t('common.done'))));
    }

    draw();
    if (getState().wakeLock) keepAwake(true);
    const onVis = () => { if (document.visibilityState === 'visible' && getState().wakeLock) keepAwake(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (editing) endEdit();
      buttons.destroy();
      lockRo.disconnect();
      keepAwake(false);
      document.removeEventListener('visibilitychange', onVis);
    };
  },
};
