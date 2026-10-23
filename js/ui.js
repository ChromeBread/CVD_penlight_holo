// Shared UI pieces used by several pages.
import { h, t, localized, getState, setState } from './core.js';
import { DB } from './data.js';
import { glowBackground, paleHex, simulateHex, textOn } from './color.js';

export function stageSelect(value, onchange) {
  return h('select', { class: 'select', onchange: e => onchange(e.target.value) },
    DB.stages.map(s => h('option', { value: s.stage_id, selected: s.stage_id === value }, localized(s, 'stage_name') || s.stage_id)));
}

export function penlightSelect(value, onchange) {
  return h('select', { class: 'select', onchange: e => onchange(e.target.value) },
    DB.penlights.map(p => h('option', { value: p.id, selected: p.id === value }, p.name || p.id)));
}

export function cvTypeSelect(value, onchange, withC = false) {
  const types = withC ? ['C', 'P', 'D', 'T', 'A'] : ['P', 'D', 'T', 'A'];
  return h('select', { class: 'select', onchange: e => onchange(e.target.value) },
    types.map(k => h('option', { value: k, selected: k === value }, t(`cv.${k}`))));
}

export function field(label, control) {
  return h('label', { class: 'field' }, h('span', null, label), control);
}

export function toggle(label, checked, onchange) {
  return h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked, onchange: e => onchange(e.target.checked) }),
    h('span', { class: 'toggle-ui' }), h('span', null, label));
}

// Make sure a stage/penlight is chosen and still exists in the data.
export function ensureSelection() {
  const s = getState();
  const patch = {};
  if (!DB.stages.some(x => x.stage_id === s.stageId)) patch.stageId = DB.stages[0]?.stage_id || null;
  if (!DB.penlights.some(x => x.id === s.penlightId)) patch.penlightId = DB.penlights[0]?.id || null;
  if (Object.keys(patch).length) setState(patch);
  return getState();
}

export function memberName(m) { return localized(m, 'name'); }

export function slotColorName(slot) {
  return localized(slot, 'color_name') || t(`pc.${slot.color_key}`);
}

// A round "penlight glow" disc.
export function glowDisc(hex, cls = '') {
  return h('div', { class: `glow ${cls}`, style: { background: glowBackground(hex), boxShadow: `0 0 28px ${paleHex(hex)}88` } });
}

export function swatch(hex, label, sub) {
  return h('div', { class: 'swatch', style: { background: hex, color: textOn(hex) } },
    h('span', { class: 'swatch-label' }, label), sub ? h('span', { class: 'swatch-sub' }, sub) : null);
}

export function cvdPair(hex, type) {
  const pale = paleHex(hex);
  const sim = simulateHex(pale, type);
  return h('div', { class: 'pair' },
    swatch(pale, t('cv.C.short'), pale),
    swatch(sim, t(`cv.${type}.short`), sim));
}

// Conic "fan" that looks like a penlight seen from the side.
export function fanBackground(slots) {
  if (!slots.length) return '#333';
  const step = 360 / slots.length;
  const stops = slots.map((s, i) => `${paleHex(s.hex)} ${i * step}deg ${(i + 1) * step}deg`).join(',');
  return `conic-gradient(from -90deg, ${stops})`;
}

// Bottom sheet that slides up.
export function bottomSheet(content, { onClose } = {}) {
  const close = () => { wrap.classList.add('closing'); setTimeout(() => { wrap.remove(); onClose?.(); }, 220); };
  const wrap = h('div', { class: 'sheet-backdrop', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet', role: 'dialog' },
      h('div', { class: 'sheet-grip' }),
      h('button', { class: 'icon-btn sheet-close', 'aria-label': t('common.close'), onclick: close }, '✕'),
      content));
  document.body.append(wrap);
  return close;
}

// Full-screen big message card to show someone nearby. Tap ⟲ to flip it toward them.
export function messageCard(lines, { tone = 'calm', note } = {}) {
  let flipped = false;
  const card = h('div', { class: `msg-card tone-${tone}` },
    lines.map((l, i) => h(i === 0 ? 'p' : 'p', { class: i === 0 ? 'msg-main' : 'msg-sub' }, l)),
    note ? h('p', { class: 'msg-note' }, note) : null);
  const flip = h('button', { class: 'btn ghost msg-flip', onclick: () => { flipped = !flipped; card.classList.toggle('flipped', flipped); } }, '⟲ ' + t('common.flip'));
  return h('div', { class: 'msg-wrap' }, card, flip);
}
