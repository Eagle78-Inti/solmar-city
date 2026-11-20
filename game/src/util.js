// util.js — small shared helpers for Solmar City: maths, colours, randomness,
// canvas texture painting. No imports: every other module builds on this file.

/** Clamp a number into [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Turn an angle towards a target by at most step radians. */
export function turnToward(a, target, step) {
  const d = wrapAngle(target - a);
  if (Math.abs(d) <= step) return target;
  return a + Math.sign(d) * step;
}

/** Distance on the ground plane between two {x, z} points. */
export function groundDist(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

/** A seeded random number generator (mulberry32) so the city is stable. */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of an array with a seeded rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** A number in [lo, hi) from a seeded rng. */
export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** Blend two hex colours channel by channel. THREE.Color has no addScaledVector. */
export function mixHex(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

/** A hex colour as a CSS rgb() string. */
export function cssHex(hex) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgb(${r},${g},${b})`;
}

/** Format a money amount as $1,234. */
export function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Format seconds of in-game clock as HH:MM. */
export function clockText(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** Make a canvas of the given size and return its 2d context. */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Paint a building facade: base colour, rows of windows, some lit warm,
 * a darker ground floor with a door. Returns the canvas.
 */
export function paintFacade(w, h, base, litRatio, rng) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = cssHex(base);
  x.fillRect(0, 0, w, h);
  // subtle vertical shading so the face is not flat
  const grad = x.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  x.fillStyle = grad;
  x.fillRect(0, 0, w, h);
  const cols = Math.max(3, Math.floor(w / 26));
  const rows = Math.max(4, Math.floor(h / 30));
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < litRatio;
      x.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#1c2433';
      x.fillRect(col * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, ch * 0.5);
    }
  }
  // ground floor: darker band with a lit doorway
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fillRect(0, h - ch * 1.1, w, ch * 1.1);
  x.fillStyle = '#ffcf7d';
  x.fillRect(w * 0.44, h - ch * 0.95, w * 0.12, ch * 0.95);
  return c;
}

/** Paint a brick wall texture: courses of bricks with mortar lines. */
export function paintBrick(w, h, base, rng) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = cssHex(base);
  x.fillRect(0, 0, w, h);
  const bh = Math.max(6, Math.floor(h / 14));
  const bw = Math.max(14, Math.floor(w / 6));
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col * bw < w + bw; col++) {
      const shade = 0.85 + rng() * 0.3;
      const rr = Math.min(255, Math.round(((base >> 16) & 255) * shade));
      const gg = Math.min(255, Math.round(((base >> 8) & 255) * shade));
      const bb = Math.min(255, Math.round((base & 255) * shade));
      x.fillStyle = `rgb(${rr},${gg},${bb})`;
      x.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  // Windows: dark frames, a third of them lit warm, so brick blocks read
  // as buildings at night instead of flat red boxes.
  const ww = Math.max(16, Math.floor(w / 12));
  const wh = Math.max(20, Math.floor(h / 10));
  for (let wy = 8; wy + wh < h; wy += wh + 14) {
    for (let wx = 10; wx + ww < w; wx += ww + 16) {
      const lit = rng() < 0.35;
      x.fillStyle = lit ? (rng() < 0.5 ? '#ffd28a' : '#ffb36a') : '#14141c';
      x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(wx, wy + wh / 2 - 1, ww, 2);
    }
  }
  return c;
}

/** Paint an asphalt road tile with a centre line and speckle. */
export function paintAsphalt(w, h, rng) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#363a41';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const g = 30 + Math.floor(rng() * 40);
    x.fillStyle = `rgb(${g},${g},${g + 4})`;
    x.fillRect(rng() * w, rng() * h, 2, 2);
  }
  // dashed centre line along the tile's length
  x.fillStyle = '#d8c25a';
  for (let yy = 0; yy < h; yy += 32) x.fillRect(w / 2 - 2, yy, 4, 18);
  return c;
}

/** Paint a glowing neon sign board with the given text. */
export function paintNeon(w, h, text, colour, rng) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#0d0716';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = colour;
  x.lineWidth = 6;
  x.shadowColor = colour;
  x.shadowBlur = 22;
  x.strokeRect(6, 6, w - 12, h - 12);
  x.fillStyle = colour;
  x.font = `bold ${Math.floor(h * 0.42)}px Arial, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2);
  // a few bright flecks for character
  x.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    x.fillStyle = rng() < 0.5 ? '#ffffff' : colour;
    x.fillRect(rng() * w, rng() * h, 3, 3);
  }
  x.globalAlpha = 1;
  return c;
}

/** Paint a sand tile with speckles. */
export function paintSand(w, h, rng) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#d9c08a';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const g = 180 + Math.floor(rng() * 60);
    x.fillStyle = `rgb(${g},${Math.floor(g * 0.85)},${Math.floor(g * 0.6)})`;
    x.fillRect(rng() * w, rng() * h, 2, 2);
  }
  return c;
}

/** A short id for debug logs. */
export function shortId(n) {
  return 'id' + Math.floor(n).toString(36);
}

/** Degrees to radians. */
export function deg2rad(d) {
  return (d * Math.PI) / 180;
}
