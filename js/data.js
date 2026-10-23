// Loads the fan-editable CSV tables in /data.
import { getState, isDebug } from './core.js';

// CSV text -> rows of strings (quotes and line breaks inside quotes handled). Empty lines are dropped.
export function parseRows(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

// CSV text -> objects keyed by the first line. Lines starting with # are notes.
export function parseCsv(text) {
  const clean = parseRows(text).filter(r => !r[0].trim().startsWith('#'));
  if (!clean.length) return [];
  const head = clean[0].map(s => s.trim());
  return clean.slice(1).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// "2026/3/8" (as Excel saves it) -> "2026-03-08"
export function normalizeDate(v) {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(String(v || '').trim());
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : (v || '');
}

// Tables keep the date as year / month / day columns so nobody mixes up day and month;
// older files with one "date" column still work.
export function rowDate(r) {
  if (r.year && r.month && r.day) return normalizeDate(`${r.year}-${r.month}-${r.day}`);
  return normalizeDate(r.date);
}
export function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) } : { year: '', month: '', day: '' };
}
export const OSHI_COLS = ['oshi_color_1', 'oshi_color_2', 'oshi_color_3'];

async function loadCsv(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) return [];
    return parseCsv(await r.text());
  } catch { return []; }
}

export const DB = { members: [], stages: [], penlightColors: [], penlights: [], specs: [], contributors: [] };
const BASE = { members: [], colors: [] };

export async function loadData() {
  const [members, colors, specs, contributors] = await Promise.all([
    loadCsv('data/builtin/a_fes_members.csv'),
    loadCsv('data/builtin/b_penlight_colors.csv'),
    loadCsv('data/builtin/c_penlight_specs.csv'),
    loadCsv('data/builtin/contributors.csv'),
  ]);
  BASE.members = members.map(m => ({ ...m, date: rowDate(m) }));
  BASE.colors = colors;
  DB.specs = specs;
  DB.contributors = contributors;
  applyUserData();
}

// ---------- user data (page 18): kept in this browser only, merged after the built-in tables ----------
// Built-in rows are never changed; user stages / penlights get ids starting with "user-".
const USER_KEY = 'cvdph.userdata.v1';

export function getUserData() {
  try {
    const d = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    return { stages: Array.isArray(d.stages) ? d.stages : [], penlights: Array.isArray(d.penlights) ? d.penlights : [] };
  } catch { return { stages: [], penlights: [] }; }
}

export function saveUserData(d) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(d)); } catch { /* storage full or blocked */ }
  applyUserData();
}

// The live data editor saves what is being edited here while typing, so nothing is lost if the app closes.
// { kind: 'live' | 'pen', isNew, data, savedAt }
const DRAFT_KEY = 'cvdph.editdraft.v1';
export function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
export function saveDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: new Date().toISOString() })); } catch { /* storage full or blocked */ }
}
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

// The CSV editor add-on (page 19) keeps its table here the same way: { doc: { name, head, rows }, page, savedAt }
const CSV_DRAFT_KEY = 'cvdph.csvdraft.v1';
export function getCsvDraft() {
  try { return JSON.parse(localStorage.getItem(CSV_DRAFT_KEY) || 'null'); } catch { return null; }
}
export function saveCsvDraft(d) {
  try { localStorage.setItem(CSV_DRAFT_KEY, JSON.stringify({ ...d, savedAt: new Date().toISOString() })); } catch { /* storage full or blocked */ }
}
export function clearCsvDraft() { try { localStorage.removeItem(CSV_DRAFT_KEY); } catch { /* ignore */ } }

export const isUserId = id => String(id || '').startsWith('user-');
export const newUserId = () => `user-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// User stage -> rows shaped like table a, user penlight -> rows shaped like table b.
function userRows(d) {
  const members = d.stages.flatMap(s => s.members.map((m, i) => ({
    stage_id: s.id, stage_name_en: s.name, stage_name_ja: s.name, date: s.date || '',
    member_id: `${s.id}-${i}`, name_en: m.name, name_ja: m.name, oshi_mark: m.mark || '',
    color_key: m.color_key, color_hex: m.hex || '', surprise: m.surprise ? 'yes' : 'no', user: 'yes',
    ...Object.fromEntries(OSHI_COLS.map((k, j) => [k, m.oshiColors?.[j] || ''])),
  })));
  const colors = d.penlights.flatMap(p => p.colors.map((c, i) => ({
    penlight_id: p.id, penlight_name: p.name, order: String(i + 1), color_key: c.color_key,
    color_name_en: c.name, color_name_ja: c.name, color_hex: c.hex || '#888888', user: 'yes',
  })));
  return { members, colors };
}

export function applyUserData() {
  const u = userRows(getUserData());
  const members = [...BASE.members, ...u.members];
  const colors = [...BASE.colors, ...u.colors];
  DB.members = members;
  DB.penlightColors = colors;

  const stages = new Map();
  for (const m of members) {
    if (!stages.has(m.stage_id)) stages.set(m.stage_id, m);
  }
  DB.stages = [...stages.values()];

  const pl = new Map();
  for (const c of colors) {
    if (!pl.has(c.penlight_id)) pl.set(c.penlight_id, { id: c.penlight_id, name: c.penlight_name, colors: [], user: c.user === 'yes' });
    pl.get(c.penlight_id).colors.push(c);
  }
  for (const p of pl.values()) p.colors.sort((a, b) => Number(a.order) - Number(b.order));
  DB.penlights = [...pl.values()];
}

// A color code for a key, from any penlight that has it.
export function hexForKey(key) {
  return DB.penlightColors.find(c => c.color_key === key)?.color_hex || '';
}
// Surprise guests (surprise = yes) stay hidden unless debug mode turns them on.
export function stageMembers(stageId) {
  const surprise = isDebug() && getState().showSurprise;
  return DB.members.filter(m => m.stage_id === stageId && (surprise || m.surprise !== 'yes'));
}

export function getPenlight(id) {
  return DB.penlights.find(p => p.id === id) || DB.penlights[0] || { id: '', name: '', colors: [] };
}

// Each penlight color slot with the members who use it on this stage.
export function buildSlots(stageId, penlightId) {
  const members = stageMembers(stageId);
  return getPenlight(penlightId).colors.map(c => {
    const ms = members.filter(m => m.color_key === c.color_key);
    return { ...c, members: ms, hex: (ms[0] && ms[0].color_hex) || c.color_hex };
  });
}

// Members whose color is not on the chosen penlight.
export function unmatchedMembers(stageId, penlightId) {
  const keys = new Set(getPenlight(penlightId).colors.map(c => c.color_key));
  return stageMembers(stageId).filter(m => !keys.has(m.color_key));
}
