// Page 19 (debug): CSV editor. The editor is an add-on downloaded on the About page;
// this page only opens it, or points there when it is not downloaded yet.
import { h, t } from '../core.js';
import { CSV_EDITOR, addonInfo } from '../addon.js';

export function goInstall(go) {
  try { sessionStorage.setItem('cvdph.focus', 'addon'); } catch { /* ignore */ }
  go(13);
}

export default {
  id: 19,
  debug: true,
  render(root, ctx) {
    let cleanup = null, gone = false;
    root.append(h('div', { class: 'page' }, h('p', { class: 'fine' }, '…')));
    addonInfo().then(async info => {
      if (gone) return;
      if (!info) {
        root.replaceChildren(h('div', { class: 'page stack' },
          h('div', { class: 'card stack' },
            h('h2', null, '📊 ' + t('page.19')),
            h('p', null, t('csv.notInstalled')),
            h('button', { class: 'btn', onclick: () => goInstall(ctx.go) }, '⬇ ' + t('csv.toAbout')))));
        return;
      }
      try {
        const m = await import(new URL(CSV_EDITOR.files[0], document.baseURI).href);
        if (gone) return;
        root.replaceChildren();
        cleanup = m.render(root, ctx) || null;
      } catch {
        root.replaceChildren(h('div', { class: 'page stack' }, h('p', { class: 'warn' }, t('csv.loadFail')),
          h('button', { class: 'btn ghost', onclick: () => goInstall(ctx.go) }, t('csv.toAbout'))));
      }
    });
    return () => { gone = true; cleanup?.(); };
  },
};
