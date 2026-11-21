// util.js — small shared helpers for Solmar City.
// No external dependencies. All colour blending is done channel by
// channel on purpose: THREE.Color has no addScaledVector.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtClock(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
// Hex colour helpers — everything is blended per channel.
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  const h = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
export function mixHex(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t));
}
export function mix3(a, b, c, t) {
  // Two-stop blend: a -> b for t in [0,0.5], b -> c for t in (0.5,1].
  if (t <= 0.5) return mixHex(a, b, t * 2);
  return mixHex(b, c, (t - 0.5) * 2);
}
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
export function $(id) { return document.getElementById(id); }
export function on(target, type, fn) { target.addEventListener(type, fn); }
// True when the player is close enough to interact with a point.
export function near(ax, az, bx, bz, r) { return dist2d(ax, az, bx, bz) <= r; }

// Small 2D vector helpers used by traffic and peds.
export function vec2(x, z) { return { x, z }; }
export function vecLen(x, z) { return Math.sqrt(x * x + z * z); }
export function norm2(x, z) {
  const l = vecLen(x, z) || 1;
  return { x: x / l, z: z / l };
}
// Deterministic-ish id generator for in-world objects.
let __uid = 1;
export function uid() { return __uid++; }
// Clamp a position inside the drivable world. The pier and the loft
// sit far west, so the west edge is -310, not -280.
export function clampWorld(x, z) {
  return { x: clamp(x, -310, 320), z: clamp(z, -240, 240) };
}
// Grid helpers: the city is a 8x6 block grid of 80m blocks.
export const BLOCK = 80;
export function blockOf(x, z) {
  return { bx: Math.floor((x + 320) / BLOCK), bz: Math.floor((z + 240) / BLOCK) };
}
