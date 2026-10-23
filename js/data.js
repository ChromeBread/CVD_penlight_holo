// Loads the fan-editable CSV tables in /data.

export function parseCsv(text) {
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
  const clean = rows.filter(r => r.some(v => v.trim() !== '') && !r[0].trim().startsWith('#'));
  if (!clean.length) return [];
  const head = clean[0].map(s => s.trim());
  return clean.slice(1).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? '').trim()])));
}

async function loadCsv(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) return [];
    return parseCsv(await r.text());
  } catch { return []; }
}

export const DB = { members: [], stages: [], penlightColors: [], penlights: [], specs: [], contributors: [] };

export async function loadData() {
  const [members, colors, specs, contributors] = await Promise.all([
    loadCsv('data/a_fes_members.csv'),
    loadCsv('data/b_penlight_colors.csv'),
    loadCsv('data/c_penlight_specs.csv'),
    loadCsv('data/contributors.csv'),
  ]);
  DB.members = members;
  DB.penlightColors = colors;
  DB.specs = specs;
  DB.contributors = contributors;

  const stages = new Map();
  for (const m of members) {
    if (!stages.has(m.stage_id)) stages.set(m.stage_id, m);
  }
  DB.stages = [...stages.values()];

  const pl = new Map();
  for (const c of colors) {
    if (!pl.has(c.penlight_id)) pl.set(c.penlight_id, { id: c.penlight_id, name: c.penlight_name, colors: [] });
    pl.get(c.penlight_id).colors.push(c);
  }
  for (const p of pl.values()) p.colors.sort((a, b) => Number(a.order) - Number(b.order));
  DB.penlights = [...pl.values()];
}

export function stageMembers(stageId) {
  return DB.members.filter(m => m.stage_id === stageId);
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
