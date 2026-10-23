// Page 17: view all live (stage) and penlight data. Page 18: edit your own live / penlight data.
// Built-in data (the CSV tables) is read-only here; user data lives in this browser (see data.js).
import { h, t, toast, localized, formatDate, getState, currentLang } from '../core.js';
import { DB, parseCsv, getUserData, saveUserData, isUserId, newUserId, hexForKey, rowDate, dateParts, OSHI_COLS, getDraft, saveDraft, clearDraft } from '../data.js';
import { paleHex, textOn } from '../color.js';
import { memberName, memberLabel, slotColorName, field } from '../ui.js';

// ---------- shared ----------
const stageName = s => localized(s, 'stage_name') || s.stage_id;
const chip = (hex, text) => h('span', { class: 'ld-chip', style: { background: paleHex(hex || '#888888'), color: textOn(paleHex(hex || '#888888')) } }, text);
const q = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const csv = (head, rows) => [head.join(','), ...rows.map(r => head.map(k => q(r[k] ?? '')).join(','))].join('\n');

const HEAD_A = ['stage_id', 'stage_name_en', 'stage_name_ja', 'year', 'month', 'day', 'member_id', 'name_en', 'name_ja', 'oshi_mark', 'color_key', 'color_hex', ...OSHI_COLS, 'surprise'];
const HEAD_B = ['penlight_id', 'penlight_name', 'order', 'color_key', 'color_name_en', 'color_name_ja', 'color_hex'];

function copyText(text) {
  const done = () => toast(t('common.copied'));
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast(text.slice(0, 40)));
  else {
    const ta = h('textarea', null, text); document.body.append(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { /* ignore */ } ta.remove();
  }
}

// one <details> per stage / penlight, filled when opened so long lists stay light
function lazyDetails(summary, fill) {
  const body = h('div', { class: 'ld-body' });
  const d = h('details', { class: 'ld-item' }, h('summary', null, summary), body);
  d.addEventListener('toggle', () => { if (d.open && !body.childNodes.length) body.append(...fill()); });
  return d;
}

function stageDetails(s) {
  const rows = DB.members.filter(m => m.stage_id === s.stage_id);
  return lazyDetails(
    [h('strong', null, stageName(s)), s.date ? h('small', null, ` ${formatDate(s.date)}`) : null],
    () => [
      h('table', { class: 'table' },
        h('thead', null, h('tr', null, [t('ld.col.mark'), t('ld.col.name'), t('ld.col.color')].map(x => h('th', null, x)))),
        h('tbody', null, rows.map(m => h('tr', null,
          h('td', null, m.oshi_mark),
          h('td', null, memberLabel(m), m.surprise === 'yes' ? h('span', { class: 'tag' }, t('ld.guest')) : null),
          h('td', null, chip(m.color_hex || hexForKey(m.color_key), slotColorName(m) || m.color_key)))))),
    ].filter(Boolean));
}

function penlightDetails(p) {
  const spec = DB.specs.find(x => x.penlight_id === p.id);
  return lazyDetails(
    [h('strong', null, `${p.user ? '✎ ' : ''}${p.name || p.id}`), h('small', null, ` · ${t('ld.colors', { n: p.colors.length })}`)],
    () => [
      h('ol', { class: 'ld-order' }, p.colors.map(c => h('li', null, chip(c.color_hex, slotColorName(c) || c.color_key)))),
      spec ? h('dl', { class: 'kv' }, ['maker', 'release', 'length_cm', 'screw', 'oshi_button', 'brightness_button', 'color_count', 'battery', 'note']
        .filter(k => spec[k]).flatMap(k => [h('dt', null, t(`p14.col.${k}`)), h('dd', null, spec[k])])) : null,
    ].filter(Boolean));
}

// ---------- page 17 ----------
export const p17 = {
  id: 17,
  debug: true,
  render(root, { go }) {
    const built = DB.stages.filter(s => !isUserId(s.stage_id)), mine = DB.stages.filter(s => isUserId(s.stage_id));
    const pens = DB.penlights.filter(p => !p.user), myPens = DB.penlights.filter(p => p.user);
    const none = () => h('p', { class: 'fine' }, t('ld.none'), ' ', h('button', { class: 'btn ghost', onclick: () => go(18) }, '✎ ' + t('page.18')));
    root.append(h('div', { class: 'page stack' },
      h('h2', null, t('ld.lives')),
      h('h3', null, t('ld.builtin')), built.map(stageDetails),
      h('h3', null, t('ld.yours')), mine.length ? mine.map(stageDetails) : none(),
      h('h2', null, t('ld.penlights')),
      h('h3', null, t('ld.builtin')), pens.map(penlightDetails),
      h('h3', null, t('ld.yours')), myPens.length ? myPens.map(penlightDetails) : none()));
  },
};

// ---------- page 18: editor ----------
function importStages(text) {
  const rows = parseCsv(text);
  if (!rows.length || !('color_key' in rows[0]) || !Object.keys(rows[0]).some(k => k.startsWith('name'))) return null;
  const groups = new Map();
  for (const r of rows) {
    const id = r.stage_id || 'imported';
    if (!groups.has(id)) groups.set(id, { id: newUserId(), name: r.stage_name_ja || r.stage_name_en || r.stage_id || 'Imported', date: rowDate(r), members: [] });
    const name = r.name_ja || r.name_en || Object.entries(r).find(([k, v]) => k.startsWith('name_') && v)?.[1] || '';
    if (name && r.color_key) groups.get(id).members.push({ mark: r.oshi_mark || '', name, color_key: r.color_key, hex: r.color_hex || '', oshiColors: OSHI_COLS.map(k => r[k] || ''), surprise: r.surprise === 'yes' });
  }
  return [...groups.values()].filter(s => s.members.length);
}

function importPenlights(text) {
  const rows = parseCsv(text);
  if (!rows.length || !('color_key' in rows[0])) return null;
  const groups = new Map();
  for (const r of rows) {
    const id = r.penlight_id || 'imported';
    if (!groups.has(id)) groups.set(id, { id: newUserId(), name: r.penlight_name || r.penlight_id || 'Imported', colors: [] });
    if (r.color_key) groups.get(id).colors.push({ order: Number(r.order) || 999, color_key: r.color_key, name: r.color_name_ja || r.color_name_en || r.color_key, hex: r.color_hex || hexForKey(r.color_key) || '#888888' });
  }
  return [...groups.values()].filter(p => p.colors.length).map(p => ({ ...p, colors: p.colors.sort((a, b) => a.order - b.order).map(({ order, ...c }) => c) }));
}

const exportStages = stages => csv(HEAD_A, stages.flatMap(s => s.members.map((m, i) => ({
  stage_id: s.id, stage_name_en: s.name, stage_name_ja: s.name, ...dateParts(s.date), member_id: `${s.id}-${i}`,
  name_en: m.name, name_ja: m.name, oshi_mark: m.mark, color_key: m.color_key, color_hex: m.hex,
  ...Object.fromEntries(OSHI_COLS.map((k, j) => [k, m.oshiColors?.[j] || ''])), surprise: m.surprise ? 'yes' : 'no' }))));
const exportPenlights = pens => csv(HEAD_B, pens.flatMap(p => p.colors.map((c, i) => ({
  penlight_id: p.id, penlight_name: p.name, order: i + 1, color_key: c.color_key, color_name_en: c.name, color_name_ja: c.name, color_hex: c.hex }))));

// ---------- files: the same CSV as tables a / b, so a spreadsheet or text editor can make them ----------
// A file with penlight_id / order columns is a penlight table, anything else a live table.
const BOM = String.fromCharCode(0xfeff);
const firstLine = text => text.replace(BOM, '').split(/\r?\n/)[0];
const isPenlightCsv = text => /\b(penlight_id|order)\b/.test(firstLine(text)) && !/\bstage_id\b/.test(firstLine(text));

// Excel opens UTF-8 CSV correctly only with a BOM.
function download(name, text) {
  const url = URL.createObjectURL(new Blob([BOM + text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

// built-in data -> an editable user copy (the original stays as it is)
function copyBuiltInStage(id) {
  const s = DB.stages.find(x => x.stage_id === id);
  return { id: newUserId(), name: stageName(s) + t('ed.copySuffix'), date: s.date || '',
    members: DB.members.filter(m => m.stage_id === id).map(m => ({ mark: m.oshi_mark, name: memberName(m), color_key: m.color_key, hex: m.color_hex, oshiColors: OSHI_COLS.map(k => m[k] || ''), surprise: m.surprise === 'yes' })) };
}
function copyBuiltInPenlight(id) {
  const p = DB.penlights.find(x => x.id === id);
  return { id: newUserId(), name: (p.name || p.id) + t('ed.copySuffix'), colors: p.colors.map(c => ({ color_key: c.color_key, name: slotColorName(c) || c.color_key, hex: c.color_hex })) };
}

function keyList() {
  return h('datalist', { id: 'ed-keys' }, [...new Set(DB.penlightColors.map(c => c.color_key))].map(k => h('option', { value: k })));
}

// "mark,name,key,#hex" per line (stage) or "key,name,#hex" per line (penlight)
const splitLine = l => l.split(/[,\t、，]/).map(x => x.trim());
const hexOf = (v, key) => (/^#?[0-9a-f]{6}$/i.test(v || '') ? (v.startsWith('#') ? v : `#${v}`) : hexForKey(key) || '#888888');

export const p18 = {
  id: 18,
  debug: true,
  render(root) {
    let tab = 'live';

    const save = (fn, msg = t('common.saved')) => { const d = getUserData(); fn(d); saveUserData(d); toast(msg); };

    // ---------- autosave: what is being edited goes to the draft 0.4 s after the last change ----------
    let draftTimer = 0, pending = null;
    function flushDraft() {
      clearTimeout(draftTimer); draftTimer = 0;
      if (!pending) return;
      saveDraft(pending); pending = null;
      const el = root.querySelector('.ed-autosave');
      if (el) el.textContent = '✓ ' + t('ed.autosaved', { time: new Date().toLocaleTimeString(currentLang()) });
    }
    function watch(page, kind, isNew, data) {
      const mark = () => {
        if (!page.isConnected) return;   // the click that saved or cancelled bubbles here after the page is gone
        pending = { kind, isNew, data };
        clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 400);
      };
      for (const ev of ['input', 'change', 'click']) page.addEventListener(ev, mark);
      mark();
    }
    const dropDraft = () => { clearTimeout(draftTimer); pending = null; clearDraft(); };
    const reopen = d => (d.kind === 'pen' ? editPen(d.data, d.isNew) : editStage(d.data, d.isNew));
    const onHide = () => { if (document.visibilityState === 'hidden') flushDraft(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushDraft);

    function textBox(help, onGo, label = t('ed.doImport')) {
      const ta = h('textarea', { class: 'input ed-text', rows: '5', spellcheck: 'false' });
      return h('div', { class: 'stack' }, h('p', { class: 'fine' }, help), ta,
        h('button', { class: 'btn ghost', onclick: () => onGo(ta.value, ta) }, label));
    }

    function exportBox(text) {
      return h('div', { class: 'stack' },
        h('textarea', { class: 'input ed-text', rows: '5', readonly: true, spellcheck: 'false' }, text),
        h('button', { class: 'btn ghost', onclick: () => copyText(text) }, '📋 ' + t('common.copy')));
    }

    function list() {
      const d = getUserData();
      const live = tab === 'live';
      const items = live ? d.stages : d.penlights;
      const builtIn = live ? DB.stages.filter(s => !isUserId(s.stage_id)) : DB.penlights.filter(p => !p.user);
      const pick = h('select', { class: 'select' }, builtIn.map(x => h('option', { value: live ? x.stage_id : x.id }, live ? stageName(x) : x.name)));
      const draft = getDraft();
      root.replaceChildren(h('div', { class: 'page stack' },
        h('p', { class: 'fine' }, t('ed.intro')),
        h('p', { class: 'fine' }, '💾 ' + t('ed.autosaveNote')),
        draft?.data ? h('div', { class: 'card stack ed-draft' },
          h('strong', null, t('ed.draftFound', { name: draft.data.name || '—', time: draft.savedAt ? new Date(draft.savedAt).toLocaleString(currentLang()) : '' })),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => reopen(draft) }, '✎ ' + t('ed.draftResume')),
            h('button', { class: 'btn ghost', onclick: () => { if (confirm(t('ed.draftDropConfirm'))) { dropDraft(); list(); } } }, t('ed.draftDrop')))) : null,
        h('div', { class: 'chips' },
          h('button', { class: 'chip' + (live ? ' on' : ''), onclick: () => { tab = 'live'; list(); } }, t('ed.tabLive')),
          h('button', { class: 'chip' + (!live ? ' on' : ''), onclick: () => { tab = 'pen'; list(); } }, t('ed.tabPen'))),
        h('h3', null, t('ld.yours')),
        items.length ? h('ul', { class: 'ed-list' }, items.map(x => h('li', null,
          h('span', null, h('strong', null, x.name), h('small', null, live ? ` ${x.date ? formatDate(x.date) : ''}` : ` · ${t('ld.colors', { n: x.colors.length })}`)),
          h('span', { class: 'row' },
            h('button', { class: 'btn ghost', onclick: () => (live ? editStage(x) : editPen(x)) }, t('ed.edit')),
            h('button', { class: 'btn ghost', onclick: () => {
              if (!confirm(t('ed.deleteConfirm', { name: x.name }))) return;
              save(dd => { const arr = live ? dd.stages : dd.penlights; arr.splice(arr.findIndex(y => y.id === x.id), 1); }, t('common.saved'));
              list();
            } }, t('ed.delete')))))) : h('p', { class: 'fine' }, t('ld.none')),
        h('button', { class: 'btn', onclick: () => (live ? editStage({ id: newUserId(), name: '', date: '', members: [{ mark: '', name: '', color_key: '', hex: '' }] }, true) : editPen({ id: newUserId(), name: '', colors: [{ color_key: '', name: '', hex: '#888888' }] }, true)) }, t('ed.new')),
        h('div', { class: 'row' }, pick, h('button', { class: 'btn ghost', onclick: () => (live ? editStage(copyBuiltInStage(pick.value), true) : editPen(copyBuiltInPenlight(pick.value), true)) }, t('ed.copyFrom'))),
        fileBox(live, items),
        h('details', null, h('summary', null, t('ed.import')),
          textBox(live ? t('ed.importHelp') : t('ed.importHelpPen'), text => {
            const got = live ? importStages(text) : importPenlights(text);
            if (!got?.length) { toast(t('ed.importFail')); return; }
            save(dd => (live ? dd.stages : dd.penlights).push(...got), t('ed.imported', { n: got.length }));
            list();
          })),
        items.length ? h('details', null, h('summary', null, t('ed.export')), exportBox(live ? exportStages(items) : exportPenlights(items))) : null));
    }

    // read CSV / TXT files (lives or penlights, found from the header), save yours as a file, get a blank template
    function fileBox(live, items) {
      const input = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', multiple: true, hidden: true });
      input.addEventListener('change', async () => {
        let stages = 0, pens = 0;
        const d = getUserData();
        for (const file of input.files) {
          const text = await file.text();
          const got = isPenlightCsv(text) ? importPenlights(text) : importStages(text);
          if (!got?.length) { toast(`${file.name}: ${t('ed.importFail')}`); continue; }
          if (isPenlightCsv(text)) { d.penlights.push(...got); pens += got.length; } else { d.stages.push(...got); stages += got.length; }
        }
        input.value = '';
        if (!stages && !pens) return;
        saveUserData(d);
        toast(t('ed.imported', { n: stages + pens }));
        if (pens && !stages) tab = 'pen'; else if (stages && !pens) tab = 'live';
        list();
      });
      const kind = live ? 'lives' : 'penlights';
      return h('div', { class: 'card stack' },
        h('h3', null, t('ed.files')),
        h('p', { class: 'fine' }, t('ed.filesHelp')),
        input,
        h('button', { class: 'btn', onclick: () => input.click() }, '📂 ' + t('ed.openFile')),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', disabled: !items.length, onclick: () => download(`cvdph-${kind}-${today()}.csv`, live ? exportStages(items) : exportPenlights(items)) }, '💾 ' + t('ed.saveFile')),
          h('a', { class: 'btn ghost', href: `data/templates/${live ? 'a' : 'b'}_template.csv`, download: `cvdph-${kind}-template.csv` }, '📄 ' + t('ed.template'))));
    }

    function rowsEditor(rows, cols, make) {
      const tbody = h('tbody');
      const draw = () => tbody.replaceChildren(...rows.map((r, i) => h('tr', null,
        cols.map(c => h('td', null, c.input(r, i))),
        h('td', { class: 'ed-tools' },
          make.reorder ? h('button', { class: 'icon-btn', 'aria-label': '↑', onclick: () => { if (i) { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); } } }, '↑') : null,
          make.reorder ? h('button', { class: 'icon-btn', 'aria-label': '↓', onclick: () => { if (i < rows.length - 1) { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); } } }, '↓') : null,
          h('button', { class: 'icon-btn', 'aria-label': t('ed.delete'), onclick: () => { rows.splice(i, 1); draw(); } }, '✕')))));
      draw();
      return { el: h('div', { class: 'table-wrap' }, h('table', { class: 'table ed-table' }, h('thead', null, h('tr', null, cols.map(c => h('th', null, c.label)), h('th'))), tbody)), draw };
    }

    const text = (r, k, attrs = {}) => h('input', { class: 'input', value: r[k] || '', ...attrs, oninput: e => { r[k] = e.target.value; } });
    const color = (r, keyField = 'color_key') => {
      const inp = h('input', { type: 'color', class: 'ed-color', value: hexOf(r.hex, r[keyField]), oninput: e => { r.hex = e.target.value; } });
      return inp;
    };

    // year / month / day as three boxes (same as the CSV columns), so the order can't be mixed up
    function dateFields(s) {
      const p = dateParts(s.date);
      const box = (k, min, max, w) => h('label', { class: 'ed-datepart' },
        h('input', { class: 'input', type: 'number', inputmode: 'numeric', min, max, value: p[k], style: { width: w },
          oninput: e => { p[k] = e.target.value; s.date = rowDate(p); } }),
        h('span', null, t(`ed.${k}`)));
      return h('div', { class: 'field' }, h('span', null, t('ed.date')),
        h('div', { class: 'row ed-date' }, box('year', '2000', '2100', '6.5em'), box('month', '1', '12', '4.2em'), box('day', '1', '31', '4.2em')));
    }

    function editStage(src, isNew = false) {
      const s = JSON.parse(JSON.stringify(src));
      const rows = rowsEditor(s.members, [
        { label: t('ld.col.mark'), input: r => text(r, 'mark', { size: '3', class: 'input ed-mark' }) },
        { label: t('ld.col.name'), input: r => text(r, 'name') },
        { label: t('ed.colorKey'), input: r => text(r, 'color_key', { list: 'ed-keys', size: '9', onchange: e => { if (!r.hex) { r.hex = hexForKey(e.target.value); rows.draw(); } } }) },
        { label: t('ld.col.color'), input: r => color(r) },
        { label: t('ld.guest'), input: r => h('input', { type: 'checkbox', checked: !!r.surprise, onchange: e => { r.surprise = e.target.checked; } }) },
      ], {});
      const page = h('div', { class: 'page stack' }, keyList(),
        h('h2', null, isNew ? t('ed.new') : t('ed.edit')),
        h('p', { class: 'fine ed-autosave', 'aria-live': 'polite' }, '💾 ' + t('ed.autosaveNote')),
        field(t('ed.stageName'), text(s, 'name')),
        dateFields(s),
        h('h3', null, t('ed.members')), rows.el,
        h('button', { class: 'btn ghost', onclick: () => { s.members.push({ mark: '', name: '', color_key: '', hex: '' }); rows.draw(); } }, t('ed.addRow')),
        h('p', { class: 'fine' }, t('ed.keyHelp')),
        h('details', null, h('summary', null, t('ed.paste')), textBox(t('ed.pasteHelp'), (v, ta) => {
          for (const l of v.split(/\r?\n/).filter(x => x.trim())) {
            const [mark, name, key, hex] = splitLine(l);
            if (name) s.members.push({ mark, name, color_key: key || '', hex: hexOf(hex, key) });
          }
          ta.value = ''; rows.draw();
        }, t('ed.addLines'))),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => {
            s.members = s.members.filter(m => m.name.trim() && m.color_key.trim());
            if (!s.name.trim()) { toast(t('ed.needName')); return; }
            save(d => { const i = d.stages.findIndex(x => x.id === s.id); if (i < 0) d.stages.push(s); else d.stages[i] = s; });
            dropDraft();
            list();
          } }, '✓ ' + t('ed.save')),
          h('button', { class: 'btn ghost', onclick: () => { dropDraft(); list(); } }, t('ed.cancel'))));
      root.replaceChildren(page);
      watch(page, 'live', isNew, s);
    }

    function editPen(src, isNew = false) {
      const p = JSON.parse(JSON.stringify(src));
      const rows = rowsEditor(p.colors, [
        { label: t('ed.colorKey'), input: r => text(r, 'color_key', { list: 'ed-keys', size: '9' }) },
        { label: t('ed.colorName'), input: r => text(r, 'name') },
        { label: t('ld.col.color'), input: r => color(r) },
      ], { reorder: true });
      const page = h('div', { class: 'page stack' }, keyList(),
        h('h2', null, isNew ? t('ed.new') : t('ed.edit')),
        h('p', { class: 'fine ed-autosave', 'aria-live': 'polite' }, '💾 ' + t('ed.autosaveNote')),
        field(t('ed.penName'), text(p, 'name')),
        h('h3', null, t('ed.colorOrder')), rows.el,
        h('button', { class: 'btn ghost', onclick: () => { p.colors.push({ color_key: '', name: '', hex: '#888888' }); rows.draw(); } }, t('ed.addRow')),
        h('p', { class: 'fine' }, t('ed.keyHelp')),
        h('details', null, h('summary', null, t('ed.paste')), textBox(t('ed.pastePenHelp'), (v, ta) => {
          for (const l of v.split(/\r?\n/).filter(x => x.trim())) {
            const [key, name, hex] = splitLine(l);
            if (key) p.colors.push({ color_key: key, name: name || key, hex: hexOf(hex, key) });
          }
          ta.value = ''; rows.draw();
        }, t('ed.addLines'))),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => {
            p.colors = p.colors.filter(c => c.color_key.trim()).map(c => ({ ...c, name: c.name || c.color_key }));
            if (!p.name.trim()) { toast(t('ed.needName')); return; }
            save(d => { const i = d.penlights.findIndex(x => x.id === p.id); if (i < 0) d.penlights.push(p); else d.penlights[i] = p; });
            dropDraft();
            list();
          } }, '✓ ' + t('ed.save')),
          h('button', { class: 'btn ghost', onclick: () => { dropDraft(); list(); } }, t('ed.cancel'))));
      root.replaceChildren(page);
      watch(page, 'pen', isNew, p);
    }

    const draft = getDraft();
    if (draft?.data && getState().resumeEdit) reopen(draft); else list();
    return () => {
      flushDraft();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushDraft);
    };
  },
};
