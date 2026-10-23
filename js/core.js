// Core: DOM helper, saved state, i18n, debug mode.

export const APP = {
  code: 'CVDp-h',
  title: 'CVDp-h', // release title: TBD
  version: '0.1.1',
  build: '2026-10-23',
  author: 'BlackDream feat. ChromeBread(Dead Beats)',
  hashtag: '#CVDph',
};

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- saved state (localStorage, never required to work) ----------
const KEY = 'cvdph.state.v1';
const defaults = {
  lang: null,
  stageId: null,
  penlightId: null,
  index: 0,
  cvType: 'D',
  guard: 'cooldown', // off | cooldown | hold
  wakeLock: true,
  swapDirection: false,
  layout: null,
  presets: [],
  oshiMemberId: null,
  oshiButton: false,
  fanMode: false,
  overlayOpacity: 45,
  checklist: {},
};
let state = { ...defaults };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...defaults, ...JSON.parse(raw) };
} catch { /* private mode etc. */ }

export function getState() { return state; }
export function setState(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ---------- debug mode: memory only, resets when the page is left ----------
let debug = false;
const debugListeners = new Set();
export function isDebug() { return debug; }
export function setDebug(on) {
  debug = !!on;
  document.documentElement.classList.toggle('debug', debug);
  debugListeners.forEach(f => f(debug));
}
export function onDebug(f) { debugListeners.add(f); return () => debugListeners.delete(f); }
window.addEventListener('pagehide', () => setDebug(false));
window.addEventListener('pageshow', e => { if (e.persisted) setDebug(false); });

// ---------- i18n ----------
export const LANGS = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

export function detectLang() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const raw of list) {
    const l = raw.toLowerCase();
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('ko')) return 'ko';
    if (l.startsWith('id') || l.startsWith('in')) return 'id';
    if (l.startsWith('zh')) {
      if (l.includes('hant') || /-(tw|hk|mo)\b/.test(l)) return 'zh-Hant';
      return 'zh-Hans';
    }
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

let dict = {}, fallback = {}, lang = 'en';
export function currentLang() { return lang; }

export async function loadLang(code) {
  const get = async c => {
    try { const r = await fetch(`i18n/${c}.json`); return r.ok ? r.json() : {}; } catch { return {}; }
  };
  if (!Object.keys(fallback).length) fallback = await get('en');
  dict = code === 'en' ? fallback : await get(code);
  lang = code;
  document.documentElement.lang = code;
}

export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (Array.isArray(s)) return s;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

// Localized column from a data row: name_ja, name_en, name_zh-Hans ...
export function localized(row, base) {
  return row[`${base}_${lang}`] || row[`${base}_en`] || row[`${base}_ja`] || row[base] || '';
}

export function colorNameText(rgbName) {
  const hue = t(`hue.${rgbName.hue}`);
  if (!rgbName.tone) return hue;
  return t('tone.pattern', { tone: t(`tone.${rgbName.tone}`), hue });
}

// Small toast message
export function toast(msg) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 1800);
  setTimeout(() => el.remove(), 2300);
}
