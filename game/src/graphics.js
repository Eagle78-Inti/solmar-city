// graphics.js — renderer, sky dome, lights, fog, procedural textures, rain.
// All sky colours are blended channel-by-channel with mixHex/mix3.
import * as THREE from 'three';
import { clamp, lerp, mixHex, mix3, rand } from './util.js';

// --- procedural canvas textures -------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function brickTex(base, mortar) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    const bh = 32, bw = 64;
    for (let y = 0; y < h / bh; y++) {
      for (let x = 0; x < w / bw + 1; x++) {
        const off = (y % 2) * bw / 2;
        const shade = 0.85 + Math.random() * 0.3;
        g.fillStyle = shadeColor(base, shade);
        g.fillRect(x * bw + off - bw / 2 + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }
  });
}
function shadeColor(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f, 0, 255);
  const g = clamp(((n >> 8) & 255) * f, 0, 255);
  const b = clamp((n & 255) * f, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function windowsTex(base, litRatio) {
  // A facade: dark base with a grid of windows, some lit warm.
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 8, rows = 12, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = Math.random() < litRatio;
        if (lit) {
          const warm = Math.random() < 0.6;
          g.fillStyle = warm ? '#ffca6a' : '#9fd8ff';
          g.fillRect(x * cw + 5, y * ch + 5, cw - 10, ch - 10);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(x * cw + 5, y * ch + 5, cw - 10, 4);
        } else {
          g.fillStyle = '#10141f';
          g.fillRect(x * cw + 5, y * ch + 5, cw - 10, ch - 10);
        }
      }
    }
  });
}
export function asphaltTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = '#d8b93a';
    g.fillRect(w / 2 - 3, 0, 6, 40); g.fillRect(w / 2 - 3, 90, 6, 40);
    g.fillRect(w / 2 - 3, 180, 6, 40);
  });
}
export function neonSignTex(text, color, bg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
export function sandTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9a86a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,200,0.18)' : 'rgba(120,90,40,0.15)';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    }
  });
}
export function waterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0e3a52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(140,220,255,0.25)';
      g.lineWidth = 2;
      const y = Math.random() * h;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y);
      g.stroke();
    }
  });
}

// --- renderer / sky / lights ----------------------------------------------
export function createGraphics(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1280, 800, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  // 2048px shadow maps for crisp long shadows at sunset.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2233, 0.0016);

  const camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.1, 2000);
  camera.position.set(-20, 14, 30);

  // Sky dome: big sphere with a vertical gradient texture (top -> horizon),
  // redrawn every frame from the time-of-day colours.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Sun disc + moon disc + a few clouds, all parented to the sky.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }));
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(18, 32),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(rand(18, 42), 8, 6), cloudMat.clone());
    cl.scale.y = 0.35;
    cl.position.set(rand(-700, 700), rand(180, 320), rand(-700, 700));
    clouds.push(cl); scene.add(cl);
  }
  scene.add(sun); scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x2a1f2e, 0.75);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffc98a, 2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260; sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260; sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);
  const moonLight = new THREE.DirectionalLight(0x8fb0ff, 0.35);
  scene.add(moonLight);

  // Rain: a points cloud that falls and recycles.
  const rainCount = 1400;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = rand(-320, 320);
    rainPos[i * 3 + 1] = rand(0, 90);
    rainPos[i * 3 + 2] = rand(-240, 240);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.55, transparent: true, opacity: 0,
  }));
  scene.add(rain);

  const gfx = { renderer, scene, camera, sky, skyMat, skyCanvas, skyCtx, skyTex, sun, moon, clouds, hemi, sunLight, moonLight, rain, rainGeo, rainCount };
  return gfx;
}

// Time-of-day look: dawn -> noon -> golden hour -> night, blended per channel.
// Daylight runs 05:30–19:30 so golden hour lasts into the evening;
// the night floor is kept bright enough to read the city by.
export function applyTimeOfDay(gfx, G) {
  const t = G.time % 24;
  // daylight factor: 1 at midday, 0 at night
  const dayF = clamp(Math.sin((t - 5.5) / 14 * Math.PI), 0, 1);
  const duskF = clamp(1 - Math.abs(t - 19.0) / 2.4, 0, 1);
  const dawnF = clamp(1 - Math.abs(t - 6.0) / 2.0, 0, 1);
  const warmF = Math.max(duskF, dawnF);
  // Sky top colour: night indigo -> day blue -> sunset teal/orange mix.
  let top = mixHex('#0a1030', '#3f7fd0', dayF);
  top = mixHex(top, '#ff7a3c', warmF * 0.55);
  const horizon = mix3('#141b3a', '#bfe0ff', '#ff9e57', dayF * 0.7 + warmF * 0.3);
  // Redraw the vertical sky gradient.
  const grad = gfx.skyCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.62, mixHex(top, horizon, 0.55));
  grad.addColorStop(1, horizon);
  gfx.skyCtx.fillStyle = grad;
  gfx.skyCtx.fillRect(0, 0, 4, 256);
  gfx.skyTex.needsUpdate = true;
  gfx.scene.fog.color.set(mixHex(horizon, '#0b1226', 0.35));
  gfx.scene.fog.density = lerp(0.0022, 0.0011, dayF) + G.rain * 0.0012;
  // Sun position on an arc; moon opposite.
  const ang = ((t - 5.5) / 14) * Math.PI;
  const sx = Math.cos(ang) * 780, sy = Math.sin(ang) * 620 + 40, sz = -260;
  gfx.sun.position.set(sx, sy, sz);
  gfx.sun.lookAt(0, 0, 0);
  gfx.sun.material.color.set(mixHex('#ffb347', '#ff5a1f', warmF));
  gfx.sun.visible = sy > -20;
  gfx.moon.position.set(-sx, -sy + 300, -sz);
  gfx.moon.visible = sy < 60;
  gfx.sunLight.position.set(sx * 0.4, Math.max(sy, 30) * 0.6, sz * 0.4);
  gfx.sunLight.intensity = lerp(0.35, 2.4, dayF) + warmF * 0.5;
  gfx.sunLight.color.set(mixHex('#8fb0ff', '#ffc98a', dayF));
  gfx.moonLight.intensity = lerp(0.5, 0.08, dayF);
  gfx.hemi.intensity = lerp(0.55, 0.85, dayF);
  gfx.renderer.toneMappingExposure = lerp(1.0, 1.1, dayF) + warmF * 0.08;
  for (const c of gfx.clouds) {
    c.material.color.set(mixHex('#2a2f45', '#ffd9b0', dayF * 0.6 + warmF * 0.4));
    c.material.opacity = lerp(0.35, 0.55, dayF);
  }
  // Rain falls and recycles around the origin.
  const op = G.rain > 0 ? 0.55 : 0;
  gfx.rain.material.opacity = lerp(gfx.rain.material.opacity, op, 0.08);
  if (G.rain > 0) {
    const p = gfx.rainGeo.attributes.position.array;
    for (let i = 0; i < gfx.rainCount; i++) {
      p[i * 3 + 1] -= 0.9 + G.rain * 0.8;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] = rand(60, 90);
    }
    gfx.rainGeo.attributes.position.needsUpdate = true;
  }
}
// Wet-road sheen: a dark glossy plane laid over the road grid.
export function makeWetSheen() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 520),
    new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.25, metalness: 0.55, transparent: true, opacity: 0 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.06, 0);
  m.receiveShadow = true;
  return m;
}
