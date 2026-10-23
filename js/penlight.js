// Penlight-style two half-circle buttons (one striped, one plain), with
// separate visual and hit-area transforms, edit mode, and mis-tap guards.

const NS = 'http://www.w3.org/2000/svg';
export const KEYS = ['striped', 'plain', 'hitStriped', 'hitPlain'];
export const MIN_PX = 56;          // never shrink below this, so it can always be grabbed again
export const MAX_OUTSIDE = 0.6;    // an element may stick out of the screen by up to 60%

export function defaultLayout() {
  return {
    striped: { x: 0.5, y: 0.78, d: 0.62, r: 0 },
    plain: { x: 0.5, y: 0.78, d: 0.62, r: 180 },
    hitStriped: { x: 0.5, y: 0.78, d: 0.62, r: 0, shape: 'semi' },
    hitPlain: { x: 0.5, y: 0.78, d: 0.62, r: 180, shape: 'semi' },
  };
}

export function cloneLayout(l) { return JSON.parse(JSON.stringify(l || defaultLayout())); }

const SEMI = 'M0,-1 A1,1 0 0 0 0,1 Z';
const RECT = 'M-1,-1 H0 V1 H-1 Z';

function svg(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

// Keep size and position inside the allowed range (in-place, fraction units).
export function clampItem(it, W, H) {
  const m = Math.min(W, H) || 1;
  let dpx = Math.max(MIN_PX, Math.min(it.d * m, 2 * Math.max(W, H)));
  it.d = dpx / m;
  const R = dpx / 2, a = (it.r * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const pts = [[-R, -R], [0, -R], [0, R], [-R, R]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = maxX - minX, bh = maxY - minY;
  const cx = Math.max(-MAX_OUTSIDE * bw - minX, Math.min(it.x * W, W + MAX_OUTSIDE * bw - maxX));
  const cy = Math.max(-MAX_OUTSIDE * bh - minY, Math.min(it.y * H, H + MAX_OUTSIDE * bh - maxY));
  it.x = cx / W; it.y = cy / H;
  return it;
}

export function createPenlightButtons(container, opts = {}) {
  let layout = cloneLayout(opts.layout);
  let edit = false, selected = 'striped';
  let W = 1, H = 1;

  const root = svg('svg', { class: 'pl-svg', 'aria-hidden': 'false' });
  const defs = svg('defs');
  const pat = svg('pattern', { id: 'pl-stripes', width: '0.22', height: '0.22', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' });
  pat.append(svg('rect', { width: '0.22', height: '0.22', fill: '#3b3f48' }), svg('rect', { width: '0.11', height: '0.22', fill: '#5e6470' }));
  defs.append(pat);
  root.append(defs);

  const groups = {}, paths = {};
  for (const k of KEYS) {
    const g = svg('g', { class: `pl-item pl-${k}` });
    const isHit = k.startsWith('hit');
    const p = svg('path', {
      d: SEMI,
      fill: isHit ? 'transparent' : k === 'striped' ? 'url(#pl-stripes)' : '#3b3f48',
      stroke: isHit ? 'none' : '#8a90a0',
      'stroke-width': '2',
      'vector-effect': 'non-scaling-stroke',
    });
    if (isHit) {
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '0');
      p.setAttribute('aria-label', k === 'hitStriped' ? (opts.labelStriped || 'striped') : (opts.labelPlain || 'plain'));
    }
    g.append(p);
    groups[k] = g; paths[k] = p;
  }
  // visuals below, hit areas on top
  root.append(groups.striped, groups.plain, groups.hitStriped, groups.hitPlain);
  container.append(root);

  // Size is measured only on resize; drawing is batched to one frame and, while dragging,
  // only the moved part is redrawn, so editing stays light on phones and slow PCs.
  function measure() {
    const rect = container.getBoundingClientRect();
    W = rect.width || 1; H = rect.height || 1;
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    root.setAttribute('width', W); root.setAttribute('height', H);
  }
  function drawItem(k) {
    const it = clampItem(layout[k], W, H);
    const R = (it.d * Math.min(W, H)) / 2;
    groups[k].setAttribute('transform', `translate(${it.x * W} ${it.y * H}) rotate(${it.r}) scale(${R})`);
    if (k.startsWith('hit')) paths[k].setAttribute('d', it.shape === 'rect' ? RECT : SEMI);
  }
  function render() {
    for (const k of KEYS) drawItem(k);
    root.classList.toggle('editing', edit);
    for (const k of KEYS) groups[k].classList.toggle('selected', edit && k === selected);
  }
  let frame = 0, onlySelected = false;
  function schedule(selectedOnly = false) {
    if (frame) { onlySelected = onlySelected && selectedOnly; return; }
    onlySelected = selectedOnly;
    frame = requestAnimationFrame(() => { frame = 0; if (onlySelected) drawItem(selected); else render(); });
  }
  // save after the user pauses, not on every move
  let saveTimer = 0;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = 0; opts.onChange?.(layout); }, 250); };

  const ro = new ResizeObserver(() => { measure(); schedule(); });
  ro.observe(container);

  // ---------- press handling with mis-tap guards ----------
  const down = new Set();
  let last = -Infinity, holdTimer = 0, longTimer = 0;
  const clearTimers = () => { clearTimeout(holdTimer); clearTimeout(longTimer); };

  function flash(which) {
    const g = groups[which === 'hitStriped' ? 'striped' : 'plain'];
    g.classList.add('pressed');
    setTimeout(() => g.classList.remove('pressed'), 140);
  }
  function fire(which) {
    last = performance.now();
    flash(which);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* ignore */ }
    const forward = (which === 'hitStriped') !== !!(opts.swap && opts.swap());
    (forward ? opts.onNext : opts.onPrev)?.();
  }

  function onHitDown(which, e) {
    if (edit) return;
    e.preventDefault();
    down.add(e.pointerId);
    clearTimers();
    if (opts.isLocked && opts.isLocked()) { opts.onBlocked?.('locked'); return; }
    if (down.size > 1) { opts.onBlocked?.('multi'); return; }          // palm / second finger
    if (e.pointerType === 'touch' && e.width > 90 && e.height > 90) { opts.onBlocked?.('palm'); return; }
    if (opts.onLongPress) longTimer = setTimeout(() => opts.onLongPress(which), 600);
    const mode = opts.guard ? opts.guard() : 'off';
    if (mode === 'hold') {
      holdTimer = setTimeout(() => fire(which), 230);
    } else if (mode === 'cooldown' && performance.now() - last < 380) {
      opts.onBlocked?.('cooldown');
    } else fire(which);
  }
  const onUp = e => { down.delete(e.pointerId); clearTimers(); };
  for (const k of ['hitStriped', 'hitPlain']) {
    paths[k].addEventListener('pointerdown', e => onHitDown(k, e));
    paths[k].addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(k); } });
  }
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  root.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- edit mode: drag = move, pinch = size + rotate, wheel = size ----------
  const pts = new Map();
  let start = null;
  function snapshot() {
    const it = layout[selected];
    const p = [...pts.values()];
    start = { it: { ...it }, p: p.map(q => ({ ...q })) };
    if (p.length >= 2) {
      start.dist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1;
      start.ang = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
    }
  }
  root.addEventListener('pointerdown', e => {
    if (!edit) return;
    e.preventDefault();
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
  });
  root.addEventListener('pointermove', e => {
    if (!edit || !pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    const it = layout[selected];
    if (p.length === 1 && start.p.length === 1) {
      it.x = start.it.x + (p[0].x - start.p[0].x) / W;
      it.y = start.it.y + (p[0].y - start.p[0].y) / H;
    } else if (p.length >= 2 && start.dist) {
      const dist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const ang = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      it.d = start.it.d * (dist / start.dist);
      it.r = Math.round(start.it.r + ((ang - start.ang) * 180) / Math.PI);
    }
    schedule(true);
  });
  const endPt = e => { if (pts.delete(e.pointerId)) { snapshot(); opts.onChange?.(layout); } };
  root.addEventListener('pointerup', endPt);
  root.addEventListener('pointercancel', endPt);
  root.addEventListener('wheel', e => {
    if (!edit) return;
    e.preventDefault();
    const it = layout[selected];
    if (e.shiftKey) it.r = Math.round(it.r + Math.sign(e.deltaY) * 5);
    else it.d *= e.deltaY > 0 ? 0.95 : 1.05;
    schedule(true);
    saveSoon();
  }, { passive: false });

  measure();
  render();

  return {
    get layout() { return layout; },
    setLayout(l) { layout = cloneLayout(l); render(); },
    setEdit(on) { edit = !!on; render(); },
    select(k) { selected = k; render(); },
    get selected() { return selected; },
    update(patch) { clampItem(Object.assign(layout[selected], patch), W, H); schedule(true); saveSoon(); },
    render,
    destroy() {
      cancelAnimationFrame(frame);
      if (saveTimer) { clearTimeout(saveTimer); opts.onChange?.(layout); }
      ro.disconnect();
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      clearTimers();
      root.remove();
    },
  };
}
