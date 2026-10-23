// Member images shown faintly over the penlight color (debug mode). Kept in this browser only (IndexedDB),
// never uploaded and never part of the app files. Images are shrunk to 512 px so storage stays small.
import { isUserId } from './data.js';

const DB_NAME = 'cvdph', STORE = 'images', MAX = 512;
const srcs = new Map();   // key -> object URL or web URL, read synchronously while drawing
let list = [];            // [{ key, label, type, size, url, addedAt }] without the blob
const listeners = new Set();

// Built-in members have a stable member_id (same person on every stage); user-made rows use the name.
export const imageKey = m => (isUserId(m.stage_id) ? `name:${m.name_en || m.name_ja}` : m.member_id);

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => { db.close(); resolve(out?.result ?? out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function loadImages() {
  try {
    const all = await tx('readonly', s => s.getAll());
    srcs.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    srcs.clear();
    list = all.map(({ blob, ...r }) => {
      srcs.set(r.key, blob ? URL.createObjectURL(blob) : r.url);
      return { ...r, size: blob ? blob.size : 0 };
    });
  } catch { list = []; }
  listeners.forEach(f => f());
}
export const onImages = f => { listeners.add(f); return () => listeners.delete(f); };
export const listImages = () => list;
export const imageSrc = key => srcs.get(key) || '';
export const imageFor = m => (m ? imageSrc(imageKey(m)) || m.image || '' : '');

async function shrink(blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise(r => c.toBlob(b => { c.width = c.height = 0; r(b || blob); }, 'image/webp', 0.85));
}

async function put(rec) {
  await tx('readwrite', s => s.put({ addedAt: new Date().toISOString(), ...rec }));
  await loadImages();
}

export async function addImageFile(key, label, file) {
  await put({ key, label, type: file.type, blob: await shrink(file) });
}

// The image is copied into the browser when the site allows it (works offline). Otherwise only the
// address is kept and the image is shown while online. Returns true when it was copied.
export async function addImageUrl(key, label, url) {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    await put({ key, label, type: blob.type, blob: await shrink(blob) });
    return true;
  } catch {
    await put({ key, label, type: 'url', url });
    return false;
  }
}

export async function deleteImage(key) { await tx('readwrite', s => s.delete(key)); await loadImages(); }
export async function clearImages() { await tx('readwrite', s => s.clear()); await loadImages(); }

// ---------- backup: images as data URLs inside the backup file ----------
const toDataUrl = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
export async function exportImages() {
  const all = await tx('readonly', s => s.getAll());
  return Promise.all(all.map(async ({ blob, ...r }) => (blob ? { ...r, data: await toDataUrl(blob) } : r)));
}
export async function importImages(items) {
  for (const it of items || []) {
    if (!it?.key) continue;
    const { data, ...r } = it;
    const blob = data ? await (await fetch(data)).blob() : null;
    await tx('readwrite', s => s.put(blob ? { ...r, blob } : r));
  }
  await loadImages();
}
