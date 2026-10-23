// Page 4: read colors from an image (file or camera). Hover / tap to see the color.
import { h, t, colorNameText } from '../core.js';
import { rgbToHex, rgbToHsl, rgbToHsv, rgbToCmyk, roughName, simulate, textOn } from '../color.js';

const fmt = n => Math.round(n);

export default {
  id: 4,
  render(root) {
    let img = null, data = null, file = null;
    let scale = 1, ox = 0, oy = 0, picked = null, pickPos = null;
    const canvas = h('canvas', { class: 'p4-canvas' });
    const ctx = canvas.getContext('2d');
    const readout = h('div', { class: 'p4-readout', hidden: true });
    const side = h('aside', { class: 'p4-side', 'aria-hidden': 'true' });
    const sideBtn = h('button', { class: 'icon-btn p4-side-btn', 'aria-label': t('p4.details'), onclick: () => { side.classList.toggle('open'); side.setAttribute('aria-hidden', String(!side.classList.contains('open'))); } }, 'ⓘ');
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => open(e.target.files[0]) });
    const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => open(e.target.files[0]) });
    const empty = h('div', { class: 'p4-empty' }, h('p', null, t('p4.empty')), h('p', { class: 'fine' }, t('p4.example')));
    const tools = h('div', { class: 'p4-tools' },
      h('button', { class: 'btn', onclick: () => input.click() }, '🖼 ' + t('p4.open')),
      h('button', { class: 'btn', onclick: () => cam.click() }, '📷 ' + t('p4.camera')),
      h('button', { class: 'icon-btn', 'aria-label': t('p4.zoomOut'), onclick: () => zoomAt(0.8) }, '−'),
      h('button', { class: 'icon-btn', 'aria-label': t('p4.zoomIn'), onclick: () => zoomAt(1.25) }, '+'),
      h('button', { class: 'icon-btn', 'aria-label': t('p4.fit'), onclick: fit }, '⤢'));
    const area = h('div', { class: 'p4-area' }, canvas, empty, readout, sideBtn, side);
    root.append(h('div', { class: 'p4' }, tools, area, input, cam));

    function size() {
      const r = area.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      draw();
    }
    const ro = new ResizeObserver(size);
    ro.observe(area);

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!img) return;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      ctx.imageSmoothingEnabled = scale < 3;
      ctx.drawImage(img, 0, 0);
      if (pickPos) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const x = ox + (pickPos.x + 0.5) * scale, y = oy + (pickPos.y + 0.5) * scale;
        const r = Math.max(8, scale / 2 + 4);
        ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
      }
    }

    function fit() {
      if (!img) return;
      const r = area.getBoundingClientRect();
      scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      ox = (r.width - img.naturalWidth * scale) / 2; oy = (r.height - img.naturalHeight * scale) / 2;
      draw();
    }

    function zoomAt(f, cx, cy) {
      const r = area.getBoundingClientRect();
      cx ??= r.width / 2; cy ??= r.height / 2;
      const ns = Math.max(0.02, Math.min(64, scale * f));
      ox = cx - ((cx - ox) * ns) / scale; oy = cy - ((cy - oy) * ns) / scale; scale = ns;
      draw();
    }

    function open(f) {
      if (!f) return;
      file = f;
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        img = im;
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(im, 0, 0);
        try { data = cx.getImageData(0, 0, c.width, c.height); } catch { data = null; }
        empty.hidden = true; picked = null; pickPos = null;
        fit(); renderSide();
      };
      im.src = url;
    }

    function pick(clientX, clientY) {
      if (!img || !data) return;
      const r = area.getBoundingClientRect();
      const x = Math.floor((clientX - r.left - ox) / scale), y = Math.floor((clientY - r.top - oy) / scale);
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) return;
      const i = (y * data.width + x) * 4;
      picked = { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2], a: data.data[i + 3] };
      pickPos = { x, y };
      const hex = rgbToHex(picked);
      readout.hidden = false;
      readout.style.background = hex; readout.style.color = textOn(hex);
      readout.replaceChildren(h('strong', null, hex), h('span', null, colorNameText(roughName(picked))));
      draw(); renderSide();
    }

    function renderSide() {
      const rows = [];
      if (file && img) {
        const ext = (file.name.split('.').pop() || '').toUpperCase();
        rows.push(h('h3', null, t('p4.file')),
          h('dl', { class: 'kv' },
            h('dt', null, t('p4.name')), h('dd', null, file.name),
            h('dt', null, t('p4.ext')), h('dd', null, `${ext} (${file.type || '?'})`),
            h('dt', null, t('p4.resolution')), h('dd', null, `${img.naturalWidth} × ${img.naturalHeight}`),
            h('dt', null, t('p4.fileSize')), h('dd', null, file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`)));
      }
      if (picked) {
        const hsl = rgbToHsl(picked), hsv = rgbToHsv(picked), cmyk = rgbToCmyk(picked);
        rows.push(h('h3', null, t('p4.color')),
          h('dl', { class: 'kv' },
            h('dt', null, t('p4.position')), h('dd', null, `x ${pickPos.x}, y ${pickPos.y}`),
            h('dt', null, 'HEX'), h('dd', null, rgbToHex(picked)),
            h('dt', null, 'RGB'), h('dd', null, `${picked.r}, ${picked.g}, ${picked.b}`),
            h('dt', null, 'HSL'), h('dd', null, `${fmt(hsl.h)}°, ${fmt(hsl.s)}%, ${fmt(hsl.l)}%`),
            h('dt', null, 'HSV'), h('dd', null, `${fmt(hsv.h)}°, ${fmt(hsv.s)}%, ${fmt(hsv.v)}%`),
            h('dt', null, 'CMYK'), h('dd', null, `${fmt(cmyk.c)}, ${fmt(cmyk.m)}, ${fmt(cmyk.y)}, ${fmt(cmyk.k)}`),
            h('dt', null, t('p4.alpha')), h('dd', null, `${fmt((picked.a / 255) * 100)}%`),
            h('dt', null, t('p4.roughName')), h('dd', null, colorNameText(roughName(picked)))),
          h('h3', null, t('p4.howOthers')),
          h('div', { class: 'sim-row' }, ['C', 'P', 'D', 'T', 'A'].map(k => {
            const hx = rgbToHex(simulate(picked, k));
            return h('div', { class: 'sim' }, h('div', { class: 'sim-sw', style: { background: hx } }), h('small', null, t(`cv.${k}.short`)), h('small', null, hx));
          })),
          h('p', { class: 'fine' }, t('p4.simNote')));
      }
      if (!rows.length) rows.push(h('p', { class: 'fine' }, t('p4.empty')));
      side.replaceChildren(...rows);
    }

    // pointer handling: 1 finger / mouse = pick, 2 fingers = pan + zoom
    const pts = new Map();
    let pinch = null;
    area.addEventListener('pointerdown', e => {
      if (e.target !== canvas) return;
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: scale, ox, oy };
      } else pick(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const r = area.getBoundingClientRect();
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ns = Math.max(0.02, Math.min(64, pinch.s * (d / pinch.d)));
        const px = pinch.mx - r.left, py = pinch.my - r.top;
        ox = px - ((px - pinch.ox) * ns) / pinch.s + (mx - pinch.mx);
        oy = py - ((py - pinch.oy) * ns) / pinch.s + (my - pinch.my);
        scale = ns; draw();
      } else if (e.pointerType === 'mouse' || pts.has(e.pointerId)) pick(e.clientX, e.clientY);
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const r = area.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 0.9 : 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    renderSide();
    return () => ro.disconnect();
  },
};
