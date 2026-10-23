// Page 12 (debug): TEST MODE color bars for checking a monitor.
import { h, t, toast } from '../core.js';
import { rgbToHex, textOn } from '../color.js';
import { bottomSheet } from '../ui.js';

const STEPS = 16;
const ROWS = [
  { k: 'W', f: p => [p, p, p] },
  { k: 'R', f: p => [p, 0, 0] },
  { k: 'G', f: p => [0, p, 0] },
  { k: 'B', f: p => [0, 0, p] },
  { k: 'C', f: p => [1 - p, 1, 1] },
  { k: 'M', f: p => [1, 1 - p, 1] },
  { k: 'Y', f: p => [1, 1, 1 - p] },
  { k: 'K', f: p => [1 - p, 1 - p, 1 - p] },
];
const FIELDS = ['content', 'priority', 'title', 'unit', 'focus', 'hz', 'angle', 'place'];

export default {
  id: 12,
  debug: true,
  render(root) {
    const info = h('div', { class: 'p12-info', hidden: true });
    let sel = null;
    const grid = h('div', { class: 'p12-grid' }, ROWS.map(row =>
      h('div', { class: 'p12-row' }, h('span', { class: 'p12-key' }, row.k),
        Array.from({ length: STEPS }, (_, i) => {
          const p = (STEPS - i) / STEPS;
          const [r, g, b] = row.f(p).map(v => v * 255);
          const hex = rgbToHex({ r, g, b });
          const cell = h('button', { class: 'p12-cell', style: { background: hex }, 'aria-label': `${row.k} ${(p * 100).toFixed(1)}% ${hex}` });
          cell.addEventListener('click', () => {
            sel?.classList.remove('sel'); sel = cell; cell.classList.add('sel');
            info.hidden = false;
            info.style.background = hex; info.style.color = textOn(hex);
            const ink = 'CMYK'.includes(row.k) ? ` (${t('p12.ink')})` : '';
            info.textContent = `${row.k} ${(p * 100).toFixed(2)}%${ink}  ${hex}  rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
          });
          return cell;
        }))));
    root.append(h('div', { class: 'p12' }, h('div', { class: 'p12-title' }, 'TEST MODE'), grid, info));
    document.getElementById('bar-actions').append(h('button', { class: 'icon-btn', 'aria-label': t('p12.share'), onclick: openShare }, '📸'));

    function openShare() {
      const inputs = {};
      const text = () => [t('p12.tpl.head'), ...FIELDS.map(f => `${t(`p12.tpl.${f}`)}: ${inputs[f].value}`), '#CVDphDebug'].join('\n');
      const share = async () => {
        const body = text();
        try {
          if (navigator.share) { await navigator.share({ text: body }); return; }
        } catch { return; }
        window.open('https://x.com/intent/post?text=' + encodeURIComponent(body), '_blank', 'noopener');
      };
      bottomSheet(h('div', { class: 'stack sporty' },
        h('h2', null, t('p12.shareQ')),
        h('p', { class: 'fine' }, t('p12.screenshotHint')),
        FIELDS.map(f => h('label', { class: 'field' }, h('span', null, t(`p12.tpl.${f}`)), inputs[f] = h('input', { class: 'input', type: 'text' }))),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: share }, t('p12.shareBtn')),
          h('button', { class: 'btn ghost', onclick: async () => { try { await navigator.clipboard.writeText(text()); toast(t('common.copied')); } catch { /* ignore */ } } }, t('common.copy')))));
    }
  },
};
