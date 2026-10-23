// Color helpers: conversions, color vision simulation, penlight-style "pale glow", rough color names.

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 128, g: 128, b: 128 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
}

// Naive device CMYK (no ICC profile) - good enough for "roughly how much ink".
export function rgbToCmyk({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: ((1 - rr - k) / (1 - k)) * 100,
    m: ((1 - gg - k) / (1 - k)) * 100,
    y: ((1 - bb - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

export function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const toSrgb = v => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
const MATRICES = {
  P: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  D: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  T: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

// type: 'C' (common), 'P', 'D', 'T', 'A'
export function simulate(rgb, type) {
  if (!type || type === 'C') return { ...rgb };
  const l = [toLin(rgb.r), toLin(rgb.g), toLin(rgb.b)];
  if (type === 'A') {
    const y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    const v = toSrgb(y);
    return { r: v, g: v, b: v };
  }
  const m = MATRICES[type];
  if (!m) return { ...rgb };
  return {
    r: toSrgb(m[0][0] * l[0] + m[0][1] * l[1] + m[0][2] * l[2]),
    g: toSrgb(m[1][0] * l[0] + m[1][1] * l[1] + m[1][2] * l[2]),
    b: toSrgb(m[2][0] * l[0] + m[2][1] * l[1] + m[2][2] * l[2]),
  };
}

export function simulateHex(hex, type) {
  return rgbToHex(simulate(hexToRgb(hex), type));
}

// Penlight LEDs look lighter and softer than a flat color image.
// Lift toward white a bit and keep the hue.
export function paleHex(hex, amount = 0.32) {
  return rgbToHex(mix(hexToRgb(hex), { r: 255, g: 255, b: 255 }, amount));
}

// CSS background that looks like a glowing penlight tip.
export function glowBackground(hex) {
  const pale = paleHex(hex);
  const core = paleHex(hex, 0.75);
  return `radial-gradient(circle at 50% 45%, ${core} 0%, ${pale} 45%, ${hex} 100%)`;
}

// Rough, everyday color name as key parts: { tone, hue }.
// tone: dark | light | pale | vivid | '' ; hue: red, orange, yellow, ... , white, gray, black
export function roughName(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  if (l >= 94) return { tone: '', hue: 'white' };
  if (l <= 10) return { tone: '', hue: 'black' };
  if (s < 12) return { tone: l > 65 ? 'light' : l < 35 ? 'dark' : '', hue: 'gray' };
  let hue;
  if (h < 12 || h >= 345) hue = 'red';
  else if (h < 40) hue = 'orange';
  else if (h < 64) hue = 'yellow';
  else if (h < 90) hue = 'yellowgreen';
  else if (h < 160) hue = 'green';
  else if (h < 195) hue = 'cyan';
  else if (h < 250) hue = 'blue';
  else if (h < 290) hue = 'purple';
  else hue = 'magenta';
  if ((hue === 'red' || hue === 'magenta') && l > 68) hue = 'pink';
  if ((hue === 'orange' || hue === 'yellow' || hue === 'red') && l < 34 && s < 75) hue = 'brown';
  let tone = '';
  if (l < 30) tone = 'dark';
  else if (l > 80) tone = 'pale';
  else if (l > 66) tone = 'light';
  else if (s > 80 && l > 40 && l < 62) tone = 'vivid';
  return { tone, hue };
}

// Pick black or white text for best contrast.
export function textOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const y = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return y > 0.36 ? '#111111' : '#FFFFFF';
}

export const CV_TYPES = ['C', 'P', 'D', 'T', 'A'];
