// Solmar City v8 — shared helpers (seeded random, math, formatting).
// Written fresh for v8; nothing here is copied from an earlier version.
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

// Deterministic PRNG (mulberry32) so the city layout is identical every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// Clock text from the day fraction (0 = midnight, 0.5 = noon).
export function clockText(dayFrac) {
  const total = Math.floor((((dayFrac % 1) + 1) % 1) * 24 * 60);
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}

// Day (1) to night (0) brightness from the day fraction: full sun at noon,
// deep night at midnight, with a golden-hour shoulder at dawn and dusk.
export function daylight(dayFrac) {
  const s = Math.sin(((dayFrac % 1) + 1) % 1 * TAU - Math.PI / 2);
  return clamp(s * 1.6 + 0.35, 0, 1);
}

// Smallest signed angle difference, for steering and turret-style aiming.
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// True when a circle at (x, z) with radius r hits an axis-aligned box.
export function circleHitsBox(x, z, r, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}
