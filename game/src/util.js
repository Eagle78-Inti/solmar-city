// Solmar City v7 — small shared helpers: math, random, canvas textures.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function angleLerp(a, b, t) { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; }
export function angleDiff(a, b) { return ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function makeCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
export function canvasTex(canvas, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t; }
export function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function pad2(n) { return String(n).padStart(2, '0'); }
export function clockLabel(hours) { const h = Math.floor(hours) % 24; const m = Math.floor((hours % 1) * 60); return `${pad2(h)}:${pad2(m)}`; }
export function daypart(hours) { if (hours >= 6 && hours < 11) return 'MORNING'; if (hours >= 11 && hours < 17) return 'DAY'; if (hours >= 17 && hours < 19.5) return 'DUSK'; if (hours >= 19.5 || hours < 5) return 'NIGHT'; return 'DAWN'; }

export function lerpColor(a, b, t) { const ca = new THREE.Color(a), cb = new THREE.Color(b); return ca.lerp(cb, t); }
export function collideCircle(pos, r, boxes) {
  for (const b of boxes) {
    const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
      else pos.x = b.maxX + r;
    }
  }
}
export function insideBox(x, z, b) { return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ; }
export function fmtTime(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${pad2(s)}`; }
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export function clamp01(v) { return clamp(v, 0, 1); }
