// Page 19 (debug): CSV editor, shown as "Page 67" (page.19.no; just a meme number) and clearly marked
// as a beta / development test build. The editor is an add-on downloaded on the About page;
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
    const banner = h('div', { class: 'beta-banner', role: 'note' }, h('strong', null, 'β BETA'), h('span', null, t('csv.beta')));
    const holder = h('div', null, h('div', { class: 'page' }, h('p', { class: 'fine' }, '…')));
    root.append(banner, holder);
    addonInfo().then(async info => {
      if (gone) return;
      if (!info) {
        holder.replaceChildren(h('div', { class: 'page stack' },
          h('div', { class: 'card stack' },
            h('h2', null, '📊 ' + t('page.19')),
            h('p', null, t('csv.notInstalled')),
            h('button', { class: 'btn', onclick: () => goInstall(ctx.go) }, '⬇ ' + t('csv.toAbout')))));
        return;
      }
      try {
        const m = await import(new URL(CSV_EDITOR.files[0], document.baseURI).href);
        if (gone) return;
        holder.replaceChildren();
        cleanup = m.render(holder, ctx) || null;
      } catch {
        holder.replaceChildren(h('div', { class: 'page stack' }, h('p', { class: 'warn' }, t('csv.loadFail')),
          h('button', { class: 'btn ghost', onclick: () => goInstall(ctx.go) }, t('csv.toAbout'))));
      }
    });
    return () => { gone = true; cleanup?.(); };
  },
};
