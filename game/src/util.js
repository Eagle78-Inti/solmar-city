// Solmar City — shared helpers: math, seeded random, procedural canvas textures,
// and small caches so the renderer reuses geometry and materials instead of
// allocating a new one for every building, car and pedestrian.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Cheap value noise for texture grain: deterministic per (x, y) so a facade
// painted twice still matches itself.
export function hashNoise(x, y, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

// Deterministic random from a seed, so screenshot staging can rebuild the
// same street layout every time while normal play stays unpredictable.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Procedural canvas textures -------------------------------------------
// Everything the city shows is painted at runtime onto canvases, so the game
// ships no image files and loads nothing over the network.

export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function speckle(ctx, w, h, n, color, alphaMin = 0.04, alphaMax = 0.14, sizeMax = 3) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = rand(alphaMin, alphaMax);
    ctx.fillStyle = color;
    const s = rand(0.6, sizeMax);
    ctx.fillRect(rand(0, w), rand(0, h), s, s);
  }
  ctx.globalAlpha = 1;
}

export function crackLines(ctx, w, h, n, color = '#1a1a1a') {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = rand(0.25, 0.6);
    ctx.lineWidth = rand(0.6, 1.6);
    ctx.beginPath();
    let x = rand(0, w);
    let y = rand(0, h);
    ctx.moveTo(x, y);
    const segs = randInt(3, 7);
    for (let s = 0; s < segs; s++) {
      x += rand(-26, 26);
      y += rand(-26, 26);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---- Shared geometry / material caches ------------------------------------
// One box geometry reused by a hundred buildings costs one draw setup each
// instead of a hundred allocations; materials are keyed by their parameters.
const geoCache = new Map();
export function boxGeo(w, h, d) {
  const key = `b${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}
const cylCache = new Map();
export function cylGeo(rt, rb, h, seg = 10) {
  const key = `c${rt}|${rb}|${h}|${seg}`;
  if (!cylCache.has(key)) cylCache.set(key, new THREE.CylinderGeometry(rt, rb, h, seg));
  return cylCache.get(key);
}
const matCache = new Map();
export function stdMat({ color = 0xffffff, roughness = 0.85, metalness = 0.0, emissive = 0x000000, emissiveIntensity = 1, map = null, emissiveMap = null, transparent = false, opacity = 1 } = {}) {
  const key = JSON.stringify([color, roughness, metalness, emissive, emissiveIntensity, map?.uuid ?? 0, emissiveMap?.uuid ?? 0, transparent, opacity]);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, map, emissiveMap, transparent, opacity }));
  }
  return matCache.get(key);
}
export function paintMat(color, clearcoat = 1) {
  // Glossy car paint: physical material with a clearcoat layer so the sun and
  // the neon signs slide across the bodywork instead of looking flat.
  const key = `p${color}|${clearcoat}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.35, clearcoat, clearcoatRoughness: 0.12, envMapIntensity: 1.4 }));
  }
  return matCache.get(key);
}
export function glassMat(tint = 0x101418) {
  const key = `g${tint}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.06, metalness: 0.9, envMapIntensity: 2.0, transparent: true, opacity: 0.92 }));
  }
  return matCache.get(key);
}

// The city's palette: sun-bleached pastels by day, hot neon by night.
export const PALETTE = {
  asphalt: '#26262b',
  sidewalk: '#8d8578',
  sand: '#d9c08a',
  water: '#0f7f8c',
  buildingTints: ['#e8dcc8', '#d9c9a8', '#c9b8a3', '#b8c4c9', '#e3b7a7', '#a8b8a0', '#d8d2c4', '#c9a89a'],
  neon: ['#ff2e88', '#00e5ff', '#ffd319', '#ff6b35', '#b967ff', '#39ff88'],
  carPaint: [0xc8102e, 0x1c4fd6, 0xe8e8e8, 0x181818, 0xd7a21a, 0x0f7a5c, 0x7a1fa2, 0xc96a1e, 0x2e6f8e],
};

// ---- Glow, neon and reflection helpers ------------------------------------
// Night in Solmar is sold by glow: a soft radial sprite behind every lamp and
// neon sign, and long additive streaks on the wet asphalt underneath them.

export function glowTexture(color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glowSprite(color, scale = 4, opacity = 0.85) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

// A neon sign: text painted with a hot core and a coloured halo, on a dark
// backing board. Used as both the visible face and the emissive map, so the
// sign actually lights the street at night.
export function neonSignTexture(text, color = '#ff2e88', w = 512, h = 160) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(h * 0.42)}px Arial, sans-serif`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 4);
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A fake reflection streak: a long, thin additive gradient plane laid on the
// asphalt under a lamp or a neon sign. At night it reads as the light pooling
// on wet tarmac, for the price of one quad.
export function streakTexture(color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeStreak(color, length = 10, width = 1.6) {
  const mat = new THREE.MeshBasicMaterial({
    map: streakTexture(color),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.PI / 2;
  m.position.y = 0.06;
  return m;
}

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
