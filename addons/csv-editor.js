// CSV editor add-on (page 19, debug mode): every column of a CSV table in a grid, like a small spreadsheet.
// Opens a file, a copy of a built-in table or your own data; saves as a CSV file (UTF-8 with BOM for Excel)
// or adds it to the app as your own live / penlight data. Built-in tables are never changed.
// What is being edited is saved 0.4 s after each change, so closing the app loses nothing.
import { h, t, toast, getState, currentLang } from '../js/core.js';
import { parseRows, getUserData, saveUserData, getCsvDraft, saveCsvDraft, clearCsvDraft } from '../js/data.js';
import { q, download, today, isPenlightCsv, importStages, importPenlights, exportStages, exportPenlights } from '../js/pages/p17-18-livedata.js';

const PAGE = 50;   // rows drawn at a time, so a 400-row table stays light
const SOURCES = [
  ['data/builtin/a_fes_members.csv', 'a_fes_members.csv'],
  ['data/builtin/b_penlight_colors.csv', 'b_penlight_colors.csv'],
  ['data/builtin/c_penlight_specs.csv', 'c_penlight_specs.csv'],
  ['data/templates/a_template.csv', 'a_template.csv'],
  ['data/templates/b_template.csv', 'b_template.csv'],
];

const toText = doc => [doc.head, ...doc.rows].map(r => doc.head.map((_, i) => q(r[i] ?? '')).join(',')).join('\n');
function fromText(name, text) {
  const rows = parseRows(text);
  const head = (rows[0] || ['column_1']).map(s => s.trim());
  return { name, head, rows: rows.slice(1).map(r => head.map((_, i) => r[i] ?? '')) };
}
const fmtTime = iso => { try { return new Date(iso).toLocaleString(currentLang()); } catch { return iso; } };

function loadCss() {
  if (document.querySelector('link[data-addon="csv"]')) return;
  document.head.append(h('link', { rel: 'stylesheet', href: 'addons/csv-editor.css', 'data-addon': 'csv' }));
}

export function render(root) {
  loadCss();
  let doc = null, page = 0, filter = '', timer = 0, dirty = false;

  // ---------- autosave ----------
  const status = h('p', { class: 'fine csv-status', 'aria-live': 'polite' }, '💾 ' + t('ed.autosaveNote'));
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!dirty || !doc) return;
    dirty = false;
    saveCsvDraft({ doc, page });
    status.textContent = '✓ ' + t('ed.autosaved', { time: new Date().toLocaleTimeString(currentLang()) });
  }
  const changed = () => { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 400); };
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  // ---------- start screen: open something ----------
  function start() {
    doc = null;
    const draft = getCsvDraft();
    const file = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (f) open(fromText(f.name, await f.text()));
    });
    const src = h('select', { class: 'select' }, SOURCES.map(([path, name]) => h('option', { value: path }, name)));
    const u = getUserData();
    root.replaceChildren(h('div', { class: 'page stack' },
      h('p', { class: 'fine' }, t('csv.intro')),
      draft?.doc ? h('div', { class: 'card stack' },
        h('strong', null, t('ed.draftFound', { name: draft.doc.name || '—', time: draft.savedAt ? fmtTime(draft.savedAt) : '' })),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => open(draft.doc, draft.page) }, '✎ ' + t('ed.draftResume')),
          h('button', { class: 'btn ghost', onclick: () => { if (confirm(t('ed.draftDropConfirm'))) { clearCsvDraft(); start(); } } }, t('ed.draftDrop')))) : null,
      file,
      h('button', { class: 'btn', onclick: () => file.click() }, '📂 ' + t('ed.openFile')),
      h('h3', null, t('csv.fromBuiltin')),
      h('p', { class: 'fine' }, t('csv.builtinNote')),
      h('div', { class: 'row' }, src, h('button', { class: 'btn ghost', onclick: async () => {
        try {
          const r = await fetch(src.value);
          if (!r.ok) throw new Error(String(r.status));
          open(fromText(src.value.split('/').pop(), await r.text()));
        } catch { toast(t('csv.loadFail')); }
      } }, t('csv.open'))),
      h('h3', null, t('ld.yours')),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', disabled: !u.stages.length, onclick: () => open(fromText(`cvdph-lives-${today()}.csv`, exportStages(u.stages))) }, t('ed.tabLive')),
        h('button', { class: 'btn ghost', disabled: !u.penlights.length, onclick: () => open(fromText(`cvdph-penlights-${today()}.csv`, exportPenlights(u.penlights))) }, t('ed.tabPen')))));
  }

  // ---------- the grid ----------
  function open(d, p = 0) {
    doc = { name: d.name || 'table.csv', head: [...d.head], rows: d.rows.map(r => [...r]) };
    page = p; filter = '';
    dirty = true; flush();
    draw();
  }

  const visible = () => {
    const f = filter.trim().toLowerCase();
    const all = doc.rows.map((_, i) => i);
    return f ? all.filter(i => doc.rows[i].some(v => String(v).toLowerCase().includes(f))) : all;
  };
  const width = c => {
    let w = String(doc.head[c] || '').length;
    for (let i = 0; i < Math.min(doc.rows.length, 200); i++) w = Math.max(w, String(doc.rows[i][c] ?? '').length);
    return `${Math.max(4, Math.min(28, w + 1))}ch`;
  };

  function draw() {
    const idx = visible();
    const pages = Math.max(1, Math.ceil(idx.length / PAGE));
    page = Math.min(page, pages - 1);
    const shown = idx.slice(page * PAGE, page * PAGE + PAGE);
    const widths = doc.head.map((_, c) => width(c));

    const headRow = h('tr', null, h('th', { class: 'csv-no' }, '#'),
      doc.head.map((name, c) => h('th', null,
        h('input', { class: 'input csv-cell csv-head', value: name, style: { width: widths[c] }, 'data-c': c, 'aria-label': t('csv.colName') }),
        h('button', { class: 'icon-btn csv-x', 'aria-label': t('csv.delCol'), 'data-delcol': c }, '✕'))));
    const body = h('tbody', null, shown.map(r => h('tr', null,
      h('td', { class: 'csv-no' }, h('span', null, r + 1), h('button', { class: 'icon-btn csv-x', 'aria-label': t('csv.delRow'), 'data-delrow': r }, '✕')),
      doc.head.map((_, c) => h('td', null, h('input', { class: 'input csv-cell', value: doc.rows[r][c] ?? '', style: { width: widths[c] }, 'data-r': r, 'data-c': c }))))));
    const table = h('table', { class: 'table csv-table' }, h('thead', null, headRow), body);

    // one listener for every cell
    table.addEventListener('input', e => {
      const el = e.target, c = Number(el.dataset.c);
      if (el.classList.contains('csv-head')) doc.head[c] = el.value;
      else if (el.dataset.r != null) doc.rows[Number(el.dataset.r)][c] = el.value;
      changed();
    });
    table.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.delrow != null) { doc.rows.splice(Number(b.dataset.delrow), 1); changed(); draw(); }
      if (b.dataset.delcol != null) {
        const c = Number(b.dataset.delcol);
        if (!confirm(t('csv.delColConfirm', { name: doc.head[c] || c + 1 }))) return;
        doc.head.splice(c, 1); doc.rows.forEach(r => r.splice(c, 1)); changed(); draw();
      }
    });

    const search = h('input', { class: 'input', type: 'search', value: filter, placeholder: '🔍 ' + t('csv.search'),
      oninput: e => { filter = e.target.value; page = 0; redrawSoon(); } });
    const nav = h('div', { class: 'row csv-nav' },
      h('button', { class: 'btn ghost', disabled: page === 0, onclick: () => { page--; changed(); draw(); } }, '◀'),
      h('span', null, t('csv.rows', { from: shown.length ? page * PAGE + 1 : 0, to: page * PAGE + shown.length, n: idx.length })),
      h('button', { class: 'btn ghost', disabled: page >= pages - 1, onclick: () => { page++; changed(); draw(); } }, '▶'));

    root.replaceChildren(h('div', { class: 'page stack csv-page' },
      h('label', { class: 'field' }, h('span', null, t('csv.fileName')),
        h('input', { class: 'input', value: doc.name, oninput: e => { doc.name = e.target.value; changed(); } })),
      status,
      h('div', { class: 'row' }, search),
      nav,
      h('div', { class: 'table-wrap csv-wrap' }, table),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { doc.rows.push(doc.head.map(() => '')); filter = ''; page = Math.ceil(doc.rows.length / PAGE) - 1; changed(); draw(); } }, '＋ ' + t('csv.addRow')),
        h('button', { class: 'btn ghost', onclick: () => {
          const name = (prompt(t('csv.colName'), `column_${doc.head.length + 1}`) || '').trim();
          if (!name) return;
          doc.head.push(name); doc.rows.forEach(r => r.push('')); changed(); draw();
        } }, '＋ ' + t('csv.addCol'))),
      h('h3', null, t('csv.finish')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { flush(); download(/\.(csv|txt)$/i.test(doc.name) ? doc.name : `${doc.name}.csv`, toText(doc)); } }, '💾 ' + t('ed.saveFile')),
        h('button', { class: 'btn ghost', onclick: addToApp }, '📥 ' + t('csv.toApp'))),
      h('p', { class: 'fine' }, t('csv.toAppNote')),
      h('button', { class: 'btn ghost', onclick: () => { if (confirm(t('csv.closeConfirm'))) { clearTimeout(timer); dirty = false; clearCsvDraft(); start(); } } }, '✕ ' + t('csv.close'))));
  }

  let searchTimer = 0;
  const redrawSoon = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      draw();
      const s = root.querySelector('input[type=search]');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }, 250);
  };

  // the same import as page 18: lives and penlights are told apart by the first line
  function addToApp() {
    const text = toText(doc);
    const pen = isPenlightCsv(text);
    const got = pen ? importPenlights(text) : importStages(text);
    if (!got?.length) { toast(t('ed.importFail')); return; }
    const u = getUserData();
    (pen ? u.penlights : u.stages).push(...got);
    saveUserData(u);
    toast(t('ed.imported', { n: got.length }));
  }

  const draft = getCsvDraft();
  if (draft?.doc && getState().resumeEdit) open(draft.doc, draft.page); else start();
  return () => {
    flush();
    clearTimeout(searchTimer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
}
