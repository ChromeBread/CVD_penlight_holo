// Pages 15-16: penlight cycle charts (circle / vertical) for a chosen live and penlight.
// Limits keep the chart readable with many colors or names: extra colors and names are cut with a note / "+N".
import { h, t, APP, toast, getState, setState, localized, formatDate, currentLang } from '../core.js';
import { buildSlots, getPenlight, DB } from '../data.js';
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
// One layout for both the screen (SVG) and the saved image (canvas), in chart units.
const ARC = { from: -80, to: 245 };   // degrees of the direction arrows inside the ring
function ringLayout(slots) {
  const n = slots.length;
  const maxNames = n > 16 ? 2 : 4;
  const fs = n > 16 ? 24 : 30, lh = fs * 1.22, maxEm = 11;
  const R = Math.max(170, n * 15);
  const dotR = Math.max(9, Math.min(22, (Math.PI * R) / n * 0.42));

  // labels: centered above / below for the top and bottom slots, two relaxed columns for the rest
  const items = slots.map((sl, i) => {
    const a = (-90 + (i * 360) / n) * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const names = sl.members.slice(0, maxNames).map(label);
    if (sl.members.length > maxNames) names.push(`+${sl.members.length - maxNames}`);
    const lines = [`${i + 1}. ${slotColorName(sl)}`, ...names];
    const side = Math.abs(dx) < 0.2 ? (dy < 0 ? 'top' : 'bottom') : dx > 0 ? 'right' : 'left';
    return { sl, x: R * dx, y: R * dy, lines, side, hgt: lines.length * lh };
  });

  let minY = -R - 40, maxY = R + 40;
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

  const dots = items.map(it => {
    const pale = paleHex(it.sl.hex);
    const sideX = it.side === 'right' ? 1 : it.side === 'left' ? -1 : 0;
    const lx = it.x + sideX * (dotR + 12);
    // top block: names above, color name nearest the dot
    const lines = it.side === 'top' ? [...it.lines.slice(1), it.lines[0]] : it.lines;
    const colorRow = it.side === 'top' ? lines.length - 1 : 0;
    return {
      x: it.x, y: it.y, pale,
      align: sideX > 0 ? 'start' : sideX < 0 ? 'end' : 'middle',
      leader: sideX && it.top - it.ideal > lh / 2 ? [it.x + sideX * dotR, it.y, lx - sideX * 4, it.top - fs * 0.35] : null,
      texts: lines.map((text, j) => ({ text: fit(text, maxEm), x: lx, y: it.top + j * lh, color: j === colorRow,
        size: j === colorRow ? fs : fs * 0.9, weight: j === colorRow ? 800 : 600, fill: j === colorRow ? pale : '#e8e8ee' })),
    };
  });
  const half = R + dotR + 12 + maxEm * fs + 10;
  return { R, dotR, dots, arcs: [{ r: R * 0.72, cw: true, color: NEXT_COLOR }, { r: R * 0.5, cw: false, color: PREV_COLOR }], x: -half, y: minY, w: half * 2, h: maxY - minY };
}

function ring(slots) {
  const L = ringLayout(slots);
  const g = svg('g');
  const defs = svg('defs');
  for (const [id, color] of [['n', NEXT_COLOR], ['p', PREV_COLOR]]) {
    const m = svg('marker', { id: `cy-arrow-${id}`, viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: color }));
    defs.append(m);
  }
  g.append(defs);
  for (const { r, cw, color } of L.arcs) {
    const p = a => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
    const [s, e] = cw ? [p(ARC.from), p(ARC.to)] : [p(ARC.to), p(ARC.from)];
    g.append(svg('path', { d: `M${s[0]},${s[1]} A${r},${r} 0 1 ${cw ? 1 : 0} ${e[0]},${e[1]}`, fill: 'none', stroke: color, 'stroke-width': 7, 'marker-end': `url(#cy-arrow-${cw ? 'n' : 'p'})` }));
  }
  for (const d of L.dots) {
    g.append(svg('circle', { cx: d.x, cy: d.y, r: L.dotR, fill: d.pale, stroke: '#ffffff66', 'stroke-width': 2 }));
    if (d.leader) g.append(svg('line', { x1: d.leader[0], y1: d.leader[1], x2: d.leader[2], y2: d.leader[3], stroke: '#ffffff44', 'stroke-width': 2 }));
    for (const tx of d.texts) {
      g.append(svg('text', { x: tx.x, y: tx.y, 'text-anchor': d.align, 'font-size': tx.size, 'font-weight': tx.weight, fill: tx.fill }, tx.text));
    }
  }
  const root = svg('svg', { class: 'cy-ring', viewBox: `${L.x} ${L.y} ${L.w} ${L.h}`, role: 'img' });
  root.append(g);
  return root;
}

// ---------- saved image (canvas, no libraries, works offline) ----------
// 1080 px wide: live name, date, penlight, the half-circle legend, the chart, and the "unofficial" note.
const IMG_W = 1080, PAD = 48;
const BG = '#14151a', TEXT = '#e8e8ee', MUTED = '#9aa0ad', LINE = '#2c2f3a', PANEL = '#1e2027';
const font = (size, weight = 400) => `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;

function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function cut(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s && ctx.measureText(s + '…').width > maxW) s = [...s].slice(0, -1).join('');
  return s + '…';
}
// text that fits in maxW per line: breaks at the last space when there is one (English), anywhere otherwise (CJK)
function wrap(ctx, text, maxW, maxLines = 2) {
  const out = [];
  let line = '', more = false;
  for (const c of text) {
    if (ctx.measureText(line + c).width > maxW && line) {
      if (out.length === maxLines - 1) { more = true; break; }
      const sp = line.lastIndexOf(' ');
      out.push(sp > 0 ? line.slice(0, sp) : line);
      line = sp > 0 ? line.slice(sp + 1) : '';
    }
    line += c;
  }
  if (line) out.push(line);
  if (more) {   // the last line gets "…" when the text goes on
    let s = out[out.length - 1];
    while (s && ctx.measureText(s + '…').width > maxW) s = [...s].slice(0, -1).join('');
    out[out.length - 1] = s + '…';
  }
  return out;
}

function halfOnCanvas(ctx, x, y, r, striped, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, striped ? Math.PI / 2 : -Math.PI / 2, striped ? Math.PI * 1.5 : Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  if (striped) {
    ctx.clip();
    ctx.translate(x, y); ctx.rotate(35 * Math.PI / 180);
    ctx.fillStyle = '#1b1d24';
    for (let s = -2 * r; s < 2 * r; s += r * 0.5) ctx.fillRect(s, -2 * r, r * 0.22, 4 * r);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, striped ? Math.PI / 2 : -Math.PI / 2, striped ? Math.PI * 1.5 : Math.PI / 2);
  ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = r * 0.12; ctx.stroke();
}

function drawRing(ctx, L, x0, y0, scale) {
  ctx.save();
  ctx.translate(x0 - L.x * scale, y0 - L.y * scale);
  ctx.scale(scale, scale);
  for (const { r, cw, color } of L.arcs) {
    const a0 = ARC.from * Math.PI / 180, a1 = ARC.to * Math.PI / 180;
    ctx.beginPath();
    if (cw) ctx.arc(0, 0, r, a0, a1, false); else ctx.arc(0, 0, r, a1, a0, true);
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.stroke();
    // arrowhead centered on the end, along the direction of travel (same as the SVG marker)
    const a = cw ? a1 : a0, ex = r * Math.cos(a), ey = r * Math.sin(a);
    const tx = cw ? -Math.sin(a) : Math.sin(a), ty = cw ? Math.cos(a) : -Math.cos(a), k = 14;
    ctx.beginPath();
    ctx.moveTo(ex + tx * k, ey + ty * k);
    ctx.lineTo(ex - tx * k - ty * k, ey - ty * k + tx * k);
    ctx.lineTo(ex - tx * k + ty * k, ey - ty * k - tx * k);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  for (const d of L.dots) {
    ctx.beginPath(); ctx.arc(d.x, d.y, L.dotR, 0, Math.PI * 2);
    ctx.fillStyle = d.pale; ctx.fill(); ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 2; ctx.stroke();
    if (d.leader) {
      ctx.beginPath(); ctx.moveTo(d.leader[0], d.leader[1]); ctx.lineTo(d.leader[2], d.leader[3]);
      ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.textAlign = d.align === 'start' ? 'left' : d.align === 'end' ? 'right' : 'center';
    ctx.textBaseline = 'alphabetic';
    for (const tx of d.texts) { ctx.font = font(tx.size, tx.weight); ctx.fillStyle = tx.fill; ctx.fillText(tx.text, tx.x, tx.y); }
  }
  ctx.restore();
}

// Vertical list: color chip on the left, name pills wrapping on the right. Returns the height used;
// with draw = false it only measures.
function drawColumn(ctx, slots, x0, y0, w, draw) {
  const CHIP = 250, GAP = 16, PILL_H = 46, MAX_NAMES = 8;
  const namesX = x0 + 36 + CHIP + GAP, namesW = x0 + w - namesX;
  let y = y0;
  const sub = currentLang() !== 'ja' && currentLang() !== 'en';
  slots.forEach((sl, i) => {
    const pale = paleHex(sl.hex);
    ctx.font = font(28, 800);
    const chipLines = wrap(ctx, slotColorName(sl), CHIP - 70);
    const chipH = Math.max(64, 24 + chipLines.length * 34);
    // name pills
    const names = sl.members.slice(0, MAX_NAMES).map(m => ({ main: `${m.oshi_mark} ${memberName(m)}`.trim(), sub: sub && m.name_ja && m.name_ja !== memberName(m) ? m.name_ja : '' }));
    if (sl.members.length > MAX_NAMES) names.push({ main: `+${sl.members.length - MAX_NAMES}`, sub: '', more: true });
    let px = namesX, py = y;
    const pills = names.map(nm => {
      ctx.font = font(26, 600);
      const mainW = ctx.measureText(nm.main).width;
      ctx.font = font(19, 400);
      const subW = nm.sub ? ctx.measureText(nm.sub).width + 10 : 0;
      const pw = Math.min(namesW, mainW + subW + 24);
      if (px + pw > namesX + namesW && px > namesX) { px = namesX; py += PILL_H + 8; }
      const p = { ...nm, x: px, y: py, w: pw };
      px += pw + 8;
      return p;
    });
    const rowH = Math.max(chipH, pills.length ? py - y + PILL_H : 0);
    if (draw) {
      roundRect(ctx, x0 + 36, y, CHIP, chipH, 14); ctx.fillStyle = pale; ctx.fill();
      ctx.fillStyle = textOn(pale); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = font(22, 600); ctx.globalAlpha = 0.7; ctx.fillText(String(i + 1), x0 + 50, y + chipH / 2); ctx.globalAlpha = 1;
      ctx.font = font(28, 800);
      chipLines.forEach((l, j) => ctx.fillText(l, x0 + 88, y + chipH / 2 + (j - (chipLines.length - 1) / 2) * 34));
      for (const p of pills) {
        roundRect(ctx, p.x, p.y, p.w, PILL_H, 10); ctx.fillStyle = PANEL; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = font(26, 600); ctx.fillStyle = p.more ? MUTED : TEXT;
        const main = cut(ctx, p.main, p.w - 24);
        ctx.fillText(main, p.x + 12, p.y + PILL_H / 2);
        if (p.sub) {
          const mw = ctx.measureText(main).width;
          ctx.font = font(19, 400); ctx.fillStyle = MUTED;
          ctx.fillText(cut(ctx, p.sub, p.w - 34 - mw), p.x + 22 + mw, p.y + PILL_H / 2 + 2);
        }
      }
    }
    y += rowH + 12;
  });
  if (draw) {
    // the rail: down = next, up = back
    const grad = ctx.createLinearGradient(0, y0, 0, y - 12);
    grad.addColorStop(0, NEXT_COLOR); grad.addColorStop(1, PREV_COLOR);
    roundRect(ctx, x0 + 8, y0 + 30, 10, Math.max(10, y - y0 - 72), 5); ctx.fillStyle = grad; ctx.fill();
    ctx.font = font(22, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = NEXT_COLOR; ctx.fillText('▼', x0 + 13, y0 + 14);
    ctx.fillStyle = PREV_COLOR; ctx.fillText('▲', x0 + 13, y - 26);
  }
  return y - y0 - 12;
}

function chartImage(kind, slots, stage, penlight) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const cw = IMG_W - PAD * 2;
  const L = kind === 15 ? ringLayout(slots) : null;
  const scale = L ? cw / L.w : 1;
  const chartH = L ? L.h * scale : drawColumn(ctx, slots, PAD, 0, cw, false);
  // long live names wrap onto a second line instead of being cut
  ctx.font = font(44, 800);
  const title = wrap(ctx, stage ? localized(stage, 'stage_name') || stage.stage_id : '', cw, 2);
  const HEAD = 150 + (title.length - 1) * 54, LEG = 70, FOOT = 150;
  canvas.width = IMG_W;
  canvas.height = Math.ceil(PAD + HEAD + LEG + chartH + 30 + FOOT);

  ctx.fillStyle = BG; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // head: live, date, penlight
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(44, 800); ctx.fillStyle = TEXT;
  title.forEach((l, i) => ctx.fillText(l, PAD, PAD + 46 + i * 54));
  ctx.font = font(28, 400); ctx.fillStyle = MUTED;
  const sub = [stage?.date ? formatDate(stage.date) : '', `${t('common.penlight')}: ${penlight?.name || ''}`].filter(Boolean).join('   ');
  ctx.fillText(cut(ctx, sub, cw), PAD, PAD + 96 + (title.length - 1) * 54);
  // legend: the two half buttons, each in its direction color
  const swap = getState().swapDirection;
  const legend = [[true, swap ? PREV_COLOR : NEXT_COLOR], [false, swap ? NEXT_COLOR : PREV_COLOR]];
  let lx = PAD;
  const ly = PAD + HEAD + 20;
  for (const [striped, color] of legend) {
    halfOnCanvas(ctx, lx + 24, ly, 22, striped, color);
    ctx.font = font(26, 700); ctx.fillStyle = color; ctx.textBaseline = 'middle';
    const text = `${t(striped ? 'p1.btnStriped' : 'p1.btnPlain')}: ${t(color === NEXT_COLOR ? 'cycle.next' : 'cycle.prev')}`;
    ctx.fillText(text, lx + 54, ly);
    lx += 54 + ctx.measureText(text).width + 40;
  }
  // chart
  const top = PAD + HEAD + LEG;
  if (L) drawRing(ctx, L, PAD, top, scale); else drawColumn(ctx, slots, PAD, top, cw, true);
  // foot: app name and the unofficial note
  const fy = top + chartH + 30;
  ctx.fillStyle = LINE; ctx.fillRect(PAD, fy, cw, 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = font(26, 700); ctx.fillStyle = TEXT;
  ctx.fillText(cut(ctx, `${t('app.title')} (${APP.code})  ${APP.hashtag}`, cw), PAD, fy + 44);
  ctx.font = font(20, 400); ctx.fillStyle = MUTED;
  wrap(ctx, t('common.unofficial'), cw, 3).forEach((l, i) => ctx.fillText(l, PAD, fy + 80 + i * 28));
  return canvas;
}

// Save buttons: a PNG file, and the phone's share sheet when it can share files.
function imageButtons(kind, getArgs) {
  const name = () => {
    const [, stage, penlight] = getArgs();
    return `cvdph-cycle-${kind === 15 ? 'circle' : 'list'}-${(stage?.stage_id || 'live')}-${(penlight?.id || 'penlight')}.png`.replace(/[^\w.-]+/g, '_');
  };
  const make = () => new Promise((resolve, reject) => {
    try { chartImage(kind, ...getArgs()).toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'); } catch (e) { reject(e); }
  });
  const save = async () => {
    try {
      const url = URL.createObjectURL(await make());
      const a = h('a', { href: url, download: name() });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(t('cycle.imageSaved'));
    } catch { toast(t('cycle.imageFail')); }
  };
  const share = async () => {
    try {
      const file = new File([await make()], name(), { type: 'image/png' });
      await navigator.share({ files: [file], text: APP.hashtag });
    } catch (e) { if (e?.name !== 'AbortError') toast(t('cycle.imageFail')); }
  };
  const probe = typeof File === 'function' && navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  return h('div', { class: 'row cy-save' },
    h('button', { class: 'btn ghost', onclick: save }, '🖼 ' + t('cycle.saveImage')),
    probe ? h('button', { class: 'btn ghost', onclick: share }, '📤 ' + t('cycle.shareImage')) : null);
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
          slots.length ? imageButtons(id, () => [slots, st, getPenlight(penlightId)]) : null,
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
