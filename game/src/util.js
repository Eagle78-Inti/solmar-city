// Solmar City — small math and canvas helpers shared by every module.
// Nothing here depends on the game state; it is pure utility code.

// Clamp a value into [a, b].
export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Linear interpolation between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Uniform random number in [a, b).
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Uniform random integer in [a, b].
export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

// Pick a random element from an array.
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Smallest signed angle difference from a to b, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Ease an angle toward a target at a bounded turn rate (rad/s).
export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  return current + clamp(d, -maxStep, maxStep);
}

// 2D distance between two points given as {x, z}.
export function dist2d(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

// A tiny deterministic RNG (mulberry32) for stable city decoration.
// Seeded once per city build so the skyline looks the same every load.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a canvas, run a painter on its 2D context, and hand it back.
export function makeCanvas(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  return c;
}

// Convert a canvas into a THREE CanvasTexture with sane defaults.
export function canvasTexture(THREE, canvas, repeatX, repeatY) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX || 1, repeatY || 1);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Format a money amount as $9,150.
export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// Format a 24h clock hour as 21:25.
export function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Day or night label for a clock hour.
export function daypart(hours) {
  if (hours >= 6 && hours < 17) return 'DAY';
  if (hours >= 17 && hours < 20) return 'DUSK';
  return 'NIGHT';
}

// Wrap an hour value into [0, 24).
export function wrapHours(h) {
  return ((h % 24) + 24) % 24;
}
