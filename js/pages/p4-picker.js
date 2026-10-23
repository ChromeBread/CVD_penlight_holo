// Page 4: read colors from an image (file or camera). Hover / tap to see the color.
import { h, t, colorNameText } from '../core.js';
import { rgbToHex, rgbToHsl, rgbToHsv, rgbToCmyk, roughName, simulate, textOn } from '../color.js';

const fmt = n => Math.round(n);

export default {
  id: 4,
  debug: true,
  render(root) {
    // Memory: phones crashed with big photos (48 MP = about 190 MB as pixels). So the image is drawn from a
    // copy at most MAX px on its long side, colors are read one pixel at a time with a 1x1 canvas instead of
    // keeping every pixel, and the previous image is let go when a new one is opened or the page is left.
    const MAX = 3072;
    let img = null, file = null, url = '', orig = null, iw = 0, ih = 0;
    const one = document.createElement('canvas');
    one.width = one.height = 1;
    const oneCtx = one.getContext('2d', { willReadFrequently: true });
    function release() {
      if (img instanceof HTMLCanvasElement) img.width = img.height = 0;
      if (url) URL.revokeObjectURL(url);
      img = null; url = '';
    }
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
      scale = Math.min(r.width / iw, r.height / ih);
      ox = (r.width - iw * scale) / 2; oy = (r.height - ih * scale) / 2;
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
      release();
      file = f;
      url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        orig = { w: im.naturalWidth, h: im.naturalHeight };
        const k = Math.min(1, MAX / Math.max(orig.w, orig.h));
        if (k < 1) {
          // big photo: keep a smaller copy and let the full-size one go
          const c = document.createElement('canvas');
          c.width = Math.round(orig.w * k); c.height = Math.round(orig.h * k);
          const cx = c.getContext('2d');
          cx.imageSmoothingQuality = 'high';
          cx.drawImage(im, 0, 0, c.width, c.height);
          img = c;
          im.src = ''; URL.revokeObjectURL(url); url = '';
        } else img = im;
        iw = img.width; ih = img.height;
        empty.hidden = true; picked = null; pickPos = null;
        fit(); renderSide();
      };
      im.src = url;
    }

    function pick(clientX, clientY) {
      if (!img) return;
      const r = area.getBoundingClientRect();
      const x = Math.floor((clientX - r.left - ox) / scale), y = Math.floor((clientY - r.top - oy) / scale);
      if (x < 0 || y < 0 || x >= iw || y >= ih) return;
      let p;
      try {
        oneCtx.clearRect(0, 0, 1, 1);
        oneCtx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
        p = oneCtx.getImageData(0, 0, 1, 1).data;
      } catch { return; }
      picked = { r: p[0], g: p[1], b: p[2], a: p[3] };
      pickPos = { x, y, ox: Math.floor((x * orig.w) / iw), oy: Math.floor((y * orig.h) / ih) };
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
            h('dt', null, t('p4.resolution')), h('dd', null, `${orig.w} × ${orig.h}`),
            h('dt', null, t('p4.fileSize')), h('dd', null, file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`)));
      }
      if (picked) {
        const hsl = rgbToHsl(picked), hsv = rgbToHsv(picked), cmyk = rgbToCmyk(picked);
        rows.push(h('h3', null, t('p4.color')),
          h('dl', { class: 'kv' },
            h('dt', null, t('p4.position')), h('dd', null, `x ${pickPos.ox}, y ${pickPos.oy}`),
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
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
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
    return () => { ro.disconnect(); release(); canvas.width = canvas.height = 0; };
  },
};
