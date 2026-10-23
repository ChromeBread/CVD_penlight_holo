// Shared UI pieces used by several pages.
import { h, t, localized, getState, setState, currentLang } from './core.js';
import { DB, isUserId } from './data.js';
import { glowBackground, paleHex, simulateHex, textOn } from './color.js';

// Stages grouped by fes ("6th fes. Color Rise Harmony / STAGE1" -> group "6th fes. Color Rise Harmony"),
// user-made stages last under their own group. A fes with one stage is a plain option.
export function stageSelect(value, onchange) {
  const groups = new Map();
  for (const s of DB.stages) {
    const name = localized(s, 'stage_name') || s.stage_id;
    const user = isUserId(s.stage_id);
    const [fes, stage] = name.split(' / ');
    const g = user ? `✎ ${t('ed.mine')}` : fes;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ id: s.stage_id, full: name, short: user || !stage ? name : stage });
  }
  const opt = (o, text) => h('option', { value: o.id, selected: o.id === value }, text);
  return h('select', { class: 'select', onchange: e => onchange(e.target.value) },
    [...groups].map(([g, list]) => (list.length === 1 && !g.startsWith('✎')
      ? opt(list[0], list[0].full)
      : h('optgroup', { label: g }, list.map(o => opt(o, o.short))))));
}

export function penlightSelect(value, onchange) {
  return h('select', { class: 'select', onchange: e => onchange(e.target.value) },
    DB.penlights.map(p => h('option', { value: p.id, selected: p.id === value }, `${p.user ? '✎ ' : ''}${p.name || p.id}`)));
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

// Default stage: the first stage of the newest built-in fes (ids look like "fes7-stage1").
function newestStage() {
  const built = DB.stages.filter(x => !isUserId(x.stage_id));
  const last = built[built.length - 1];
  if (!last) return DB.stages[0]?.stage_id || null;
  const fes = last.stage_id.split('-')[0];
  return built.find(x => x.stage_id.split('-')[0] === fes).stage_id;
}

// Make sure a stage/penlight is chosen and still exists in the data.
export function ensureSelection() {
  const s = getState();
  const patch = {};
  if (!DB.stages.some(x => x.stage_id === s.stageId)) patch.stageId = newestStage();
  if (!DB.penlights.some(x => x.id === s.penlightId)) patch.penlightId = DB.penlights[0]?.id || null;
  if (Object.keys(patch).length) setState(patch);
  return getState();
}

export function memberName(m) { return localized(m, 'name'); }

// Name as an element. Outside Japanese and English the English (romaji) name is the main one and the
// Japanese name is added small underneath, since most fans know both.
export function memberLabel(m, mark = false) {
  const main = memberName(m), lang = currentLang();
  const sub = lang !== 'ja' && lang !== 'en' && m.name_ja && m.name_ja !== main ? m.name_ja : '';
  return h('span', { class: 'mname' }, mark && m.oshi_mark ? `${m.oshi_mark} ` : null, main, sub ? h('small', { class: 'mname-sub' }, sub) : null);
}

export function slotColorName(slot) {
  const k = `pc.${slot.color_key}`, v = t(k);
  return localized(slot, 'color_name') || (v === k ? slot.color_key : v);
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

// Hot Button like the official penlight: long-press saves, one push jumps.
export function hotButton(label, { onSave, onJump }) {
  let timer = 0, saved = false;
  const btn = h('button', { class: 'btn oshi-btn' }, label);
  btn.addEventListener('pointerdown', () => {
    saved = false;
    timer = setTimeout(() => { saved = true; onSave(); }, 600);
  });
  const end = jump => { clearTimeout(timer); if (jump && !saved) onJump(); saved = false; };
  btn.addEventListener('pointerup', () => end(true));
  btn.addEventListener('pointerleave', () => end(false));
  btn.addEventListener('pointercancel', () => end(false));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(); } });
  return btn;
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
