// Pages 15-16: penlight cycle charts (circle / vertical) for a chosen live and penlight.
// Limits keep the chart readable with many colors or names: extra colors and names are cut with a note / "+N".
import { h, t, getState, setState, localized, formatDate } from '../core.js';
import { buildSlots, DB } from '../data.js';
import { paleHex, textOn } from '../color.js';
import { stageSelect, penlightSelect, field, ensureSelection, memberName, memberLabel, slotColorName } from '../ui.js';

const MAX_COLORS = 24;
const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

// Rough text width in em: CJK / emoji ~1em, joiners 0, others ~0.55em.
const charW = c => {
  const cp = c.codePointAt(0);
  return cp === 0x200d || cp === 0xfe0e || cp === 0xfe0f ? 0 : cp >= 0x1100 ? 1 : 0.55;
};
function fit(text, maxEm) {
  let w = 0, out = '';
  for (const c of text) {
    w += charW(c);
    if (w > maxEm) return out.replace(/\s+$/, '') + '…';
    out += c;
  }
  return out;
}

const label = m => `${m.oshi_mark} ${memberName(m)}`.trim();

const NEXT_COLOR = '#ff7a90', PREV_COLOR = '#6aa8ff';

// Half-circle icon like the page 1 buttons, tinted with the direction color.
// Striped is the left half and plain the right half, as on page 1.
let iconId = 0;
function halfIcon(striped, color, name) {
  const root = svg('svg', { class: 'cy-half', viewBox: striped ? '-1.1 -1.1 1.2 2.2' : '-0.1 -1.1 1.2 2.2', role: 'img', 'aria-label': name });
  let fill = color;
  if (striped) {
    const id = `cy-stripe-${++iconId}`;
    const pat = svg('pattern', { id, width: '0.5', height: '0.5', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' });
    pat.append(svg('rect', { width: '0.5', height: '0.5', fill: color }), svg('rect', { width: '0.22', height: '0.5', fill: '#1b1d24' }));
    const defs = svg('defs'); defs.append(pat); root.append(defs);
    fill = `url(#${id})`;
  }
  root.append(svg('path', { d: striped ? 'M0,-1 A1,1 0 0 0 0,1 Z' : 'M0,-1 A1,1 0 0 1 0,1 Z', fill, stroke: color, 'stroke-width': '0.12' }));
  return root;
}

// The two halves side by side, each in the color of its arrow (the swap setting flips the colors).
function legend() {
  const swap = getState().swapDirection;
  const stripedColor = swap ? PREV_COLOR : NEXT_COLOR, plainColor = swap ? NEXT_COLOR : PREV_COLOR;
  const dir = c => t(c === NEXT_COLOR ? 'cycle.next' : 'cycle.prev');
  return h('div', { class: 'cy-legend' },
    halfIcon(true, stripedColor, `${t('p1.btnStriped')}: ${dir(stripedColor)}`),
    halfIcon(false, plainColor, `${t('p1.btnPlain')}: ${dir(plainColor)}`));
}

// ---------- circle ----------
function ring(slots) {
  const n = slots.length;
  const maxNames = n > 16 ? 2 : 4;
  const fs = n > 16 ? 24 : 30, lh = fs * 1.22, maxEm = 11;
  const R = Math.max(170, n * 15), cx = 0, cy = 0;
  const dotR = Math.max(9, Math.min(22, (Math.PI * R) / n * 0.42));
  const g = svg('g');

  // direction arrows inside the ring
  const arc = (r, cw, color) => {
    const a0 = -80, a1 = 245, p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
    const [s, e] = cw ? [p(a0), p(a1)] : [p(a1), p(a0)];
    g.append(svg('path', { d: `M${s[0]},${s[1]} A${r},${r} 0 1 ${cw ? 1 : 0} ${e[0]},${e[1]}`, fill: 'none', stroke: color, 'stroke-width': 7, 'marker-end': `url(#cy-arrow-${cw ? 'n' : 'p'})` }));
  };
  const defs = svg('defs');
  for (const [id, color] of [['n', NEXT_COLOR], ['p', PREV_COLOR]]) {
    const m = svg('marker', { id: `cy-arrow-${id}`, viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: color }));
    defs.append(m);
  }
  g.append(defs);
  arc(R * 0.72, true, NEXT_COLOR);
  arc(R * 0.5, false, PREV_COLOR);

  // labels: centered above / below for the top and bottom slots, two relaxed columns for the rest
  const items = slots.map((sl, i) => {
    const a = (-90 + (i * 360) / n) * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const names = sl.members.slice(0, maxNames).map(label);
    if (sl.members.length > maxNames) names.push(`+${sl.members.length - maxNames}`);
    const lines = [`${i + 1}. ${slotColorName(sl)}`, ...names];
    const side = Math.abs(dx) < 0.2 ? (dy < 0 ? 'top' : 'bottom') : dx > 0 ? 'right' : 'left';
    return { sl, x: cx + R * dx, y: cy + R * dy, lines, side, hgt: lines.length * lh };
  });

  let minY = cy - R - 40, maxY = cy + R + 40;
  for (const side of ['left', 'right']) {
    const col = items.filter(it => it.side === side).sort((p, q) => p.y - q.y);
    // ideal spot is centered on the dot; push down when a block would overlap the one above (the chart grows instead)
    for (const it of col) it.top = it.ideal = it.y - it.hgt / 2 + lh * 0.35;
    for (let i = 1; i < col.length; i++) col[i].top = Math.max(col[i].top, col[i - 1].top + col[i - 1].hgt + 6);
    for (const it of col) { minY = Math.min(minY, it.top - fs); maxY = Math.max(maxY, it.top + it.hgt); }
  }
  for (const it of items) {
    if (it.side === 'top') { it.top = it.y - dotR - 24 - it.hgt + lh; minY = Math.min(minY, it.top - fs); }
    if (it.side === 'bottom') { it.top = it.y + dotR + 14 + fs; maxY = Math.max(maxY, it.top + it.hgt); }
  }

  for (const it of items) {
    const pale = paleHex(it.sl.hex);
    g.append(svg('circle', { cx: it.x, cy: it.y, r: dotR, fill: pale, stroke: '#ffffff66', 'stroke-width': 2 }));
    const sideX = it.side === 'right' ? 1 : it.side === 'left' ? -1 : 0;
    const lx = it.x + sideX * (dotR + 12);
    const anchor = sideX > 0 ? 'start' : sideX < 0 ? 'end' : 'middle';
    // top block: names above, color name nearest the dot
    const lines = it.side === 'top' ? [...it.lines.slice(1), it.lines[0]] : it.lines;
    const colorRow = it.side === 'top' ? lines.length - 1 : 0;
    if (sideX && it.top - it.ideal > lh / 2) {
      g.append(svg('line', { x1: it.x + sideX * dotR, y1: it.y, x2: lx - sideX * 4, y2: it.top - fs * 0.35, stroke: '#ffffff44', 'stroke-width': 2 }));
    }
    lines.forEach((text, j) => {
      const isColor = j === colorRow;
      g.append(svg('text', {
        x: lx, y: it.top + j * lh, 'text-anchor': anchor,
        'font-size': isColor ? fs : fs * 0.9, 'font-weight': isColor ? 800 : 600,
        fill: isColor ? pale : '#e8e8ee',
      }, fit(text, maxEm)));
    });
  }

  const half = R + dotR + 12 + maxEm * fs + 10;
  const root = svg('svg', { class: 'cy-ring', viewBox: `${-half} ${minY} ${half * 2} ${maxY - minY}`, role: 'img' });
  root.append(g);
  return root;
}

// ---------- vertical ----------
function column(slots) {
  const MAX_NAMES = 8;
  return h('div', { class: 'cy-list' },
    h('div', { class: 'cy-rail', 'aria-hidden': 'true' }, h('span', null, '▼'), h('span', { class: 'cy-rail-bar' }), h('span', null, '▲')),
    h('ol', { class: 'cy-rows' }, slots.map((sl, i) => {
      const pale = paleHex(sl.hex);
      const names = sl.members.slice(0, MAX_NAMES).map(m => h('span', { class: 'cy-name' }, memberLabel(m, true)));
      if (sl.members.length > MAX_NAMES) names.push(h('span', { class: 'cy-name more' }, `+${sl.members.length - MAX_NAMES}`));
      return h('li', { class: 'cy-row' },
        h('span', { class: 'cy-chip', style: { background: pale, color: textOn(pale) } }, h('small', null, i + 1), slotColorName(sl)),
        h('span', { class: 'cy-names' }, names));
    })));
}

// The circle size is set with a slider (100-300 %). The chart sits in a window that fits the
// screen, so it can be moved by dragging (finger or mouse) without scrolling the page to a scrollbar.
function zoomable(el) {
  const box = h('div', { class: 'cy-zoom' }, el);
  const out = h('output', { class: 'cy-zoom-val' });
  let frame = 0;
  const apply = v => {
    // keep the point at the middle of the window in the middle while zooming
    const old = parseFloat(el.style.width) || 100;
    const cx = (box.scrollLeft + box.clientWidth / 2) / (box.scrollWidth || 1);
    const cy = (box.scrollTop + box.clientHeight / 2) / (box.scrollHeight || 1);
    el.style.width = `${v}%`; out.textContent = `${v}%`;
    if (old !== v) {
      box.scrollLeft = cx * box.scrollWidth - box.clientWidth / 2;
      box.scrollTop = cy * box.scrollHeight - box.clientHeight / 2;
    }
  };
  const range = h('input', { type: 'range', min: '100', max: '300', step: '5', value: getState().cycleZoom, 'aria-label': t('cycle.zoom'),
    oninput: e => { const v = Number(e.target.value); cancelAnimationFrame(frame); frame = requestAnimationFrame(() => apply(v)); },
    onchange: e => { const v = Number(e.target.value); cancelAnimationFrame(frame); apply(v); setState({ cycleZoom: v }); } });
  apply(getState().cycleZoom);

  // mouse / pen drag pans the window (touch already pans natively)
  let pan = null;
  box.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    pan = { x: e.clientX, y: e.clientY, l: box.scrollLeft, t: box.scrollTop };
    try { box.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    box.classList.add('panning');
  });
  box.addEventListener('pointermove', e => {
    if (!pan) return;
    box.scrollLeft = pan.l - (e.clientX - pan.x);
    box.scrollTop = pan.t - (e.clientY - pan.y);
  });
  const stop = () => { pan = null; box.classList.remove('panning'); };
  box.addEventListener('pointerup', stop);
  box.addEventListener('pointercancel', stop);

  return h('div', { class: 'stack' }, h('label', { class: 'cy-zoom-row' }, h('span', null, '🔍 ' + t('cycle.zoom')), range, out), box);
}

function cyclePage(id, draw) {
  return {
    id,
    render(root) {
      const s = ensureSelection();
      let stageId = s.stageId, penlightId = s.penlightId;
      const chart = h('div', { class: 'cy-chart' });
      const paint = () => {
        const all = buildSlots(stageId, penlightId);
        const slots = all.slice(0, MAX_COLORS);
        const st = DB.stages.find(x => x.stage_id === stageId);
        const body = !slots.length ? h('p', { class: 'empty' }, t('p1.noData'))
          : id === 15 ? zoomable(draw(slots)) : draw(slots);
        chart.replaceChildren(...[
          st ? h('p', { class: 'cy-title' }, h('strong', null, localized(st, 'stage_name') || st.stage_id), st.date ? h('span', null, formatDate(st.date)) : null) : null,
          legend(),
          all.length > MAX_COLORS ? h('p', { class: 'warn' }, t('cycle.limit', { n: MAX_COLORS })) : null,
          body,
        ].filter(Boolean));
      };
      root.append(h('div', { class: 'page stack' },
        h('div', { class: 'cy-pick' },
          field(t('common.stage'), stageSelect(stageId, v => { stageId = v; paint(); })),
          field(t('common.penlight'), penlightSelect(penlightId, v => { penlightId = v; paint(); }))),
        chart));
      paint();
    },
  };
}

export const p15 = cyclePage(15, ring);
export const p16 = cyclePage(16, column);
