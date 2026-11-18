import * as THREE from 'three';
// Solmar City — shared utilities: seeded random, math helpers, procedural
// canvas textures and shared geometry/material caches. Everything here is
// written for this game; nothing is copied from any other project.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
// Bell curve peaking at 1 when t is near c, falling to 0 at distance w.
export const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
export const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Make a canvas texture from a 2D painter function. The painter gets the
// context, width and height; the result repeats with the given repeat.
export function canvasTexture(w, h, painter, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A speckled-noise painter shared by several textures.
export function speckle(ctx, w, h, rng, n, colors, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = pick(rng, colors);
    ctx.globalAlpha = 0.12 + rng() * 0.25;
    const s = 1 + rng() * size;
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// Shared geometry cache: one box / cylinder / sphere reused by every mesh
// that needs it, so the scene stays light on draw calls and memory.
const _geo = {};
export function boxGeo(w, h, d) {
  const k = `b${w}|${h}|${d}`;
  return (_geo[k] ||= new THREE.BoxGeometry(w, h, d));
}
export function cylGeo(rt, rb, h, seg = 12) {
  const k = `c${rt}|${rb}|${h}|${seg}`;
  return (_geo[k] ||= new THREE.CylinderGeometry(rt, rb, h, seg));
}
export function sphGeo(r, w = 12, h = 10) {
  const k = `s${r}|${w}|${h}`;
  return (_geo[k] ||= new THREE.SphereGeometry(r, w, h));
}

// Standard-material shorthand: the whole city uses MeshStandardMaterial so
// light, shadow and reflections behave like a modern renderer expects.
export function std(color, roughness = 0.85, metalness = 0.0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
export function paint(color, clearcoat = 1.0) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.55,
    clearcoat, clearcoatRoughness: 0.18,
  });
}
