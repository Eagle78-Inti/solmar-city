// graphics.js — the look of Solmar City: renderer, sky dome, sun and moon,
// fog, shadows, rain and the procedural canvas textures. Graphics first.

import * as THREE from 'three';
import { G } from './state.js';
import { clamp, lerp, makeRng, mixHex, paintAsphalt, paintBrick, paintFacade, paintNeon, paintSand } from './util.js';

export const gfx = {
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  moon: null,
  hemi: null,
  skyMat: null,
  skyMesh: null,
  rain: null,
  rainVel: null,
  textures: {},
};

/** Build the WebGL renderer with ACES tone mapping and 2048px shadows. */
export function initGraphics(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a2438, 0.0016);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(10, 8, 24);
  gfx.renderer = renderer;
  gfx.scene = scene;
  gfx.camera = camera;

  // Sun: warm directional light with a 2048px shadow map over the city.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  gfx.sun = sun;

  // Moon: cool fill so nights are readable, never pitch black.
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
  moon.position.set(-120, 180, -80);
  scene.add(moon);
  gfx.moon = moon;

  const hemi = new THREE.HemisphereLight(0xffe0b8, 0x2a2438, 0.75);
  scene.add(hemi);
  gfx.hemi = hemi;

  buildSky();
  buildRain();
  buildTextures();
  return gfx;
}

/** A big sky dome whose colours follow the time of day. */
function buildSky() {
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a4a8a) },
      mid: { value: new THREE.Color(0xff9a5a) },
      bot: { value: new THREE.Color(0x1a1428) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  gfx.scene.add(mesh);
  gfx.skyMat = mat;
  gfx.skyMesh = mesh;

  // Sun disc + moon disc + a few clouds, all children of the sky.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.name = 'sunDisc';
  mesh.add(sunDisc);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
  );
  moonDisc.name = 'moonDisc';
  mesh.add(moonDisc);
  const rng = makeRng(77);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(18 + rng() * 22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, fog: false }),
    );
    cloud.scale.y = 0.32;
    const a = rng() * Math.PI * 2;
    const r = 620 + rng() * 160;
    cloud.position.set(Math.cos(a) * r, 120 + rng() * 160, Math.sin(a) * r);
    mesh.add(cloud);
  }
}

/** Rain as a Points cloud, hidden until the weather turns. */
function buildRain() {
  const count = 2600;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count);
  const rng = makeRng(4242);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * 220;
    pos[i * 3 + 1] = rng() * 60;
    pos[i * 3 + 2] = (rng() - 0.5) * 220;
    vel[i] = 55 + rng() * 30;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaac4e0, size: 0.55, transparent: true, opacity: 0.5 });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  pts.frustumCulled = false;
  gfx.scene.add(pts);
  gfx.rain = pts;
  gfx.rainVel = vel;
}

/** All procedural canvas textures, built once. */
function buildTextures() {
  const rng = makeRng(20261121);
  const t = {};
  t.facadeCream = new THREE.CanvasTexture(paintFacade(256, 512, 0xd8c49a, 0.45, rng));
  t.facadePink = new THREE.CanvasTexture(paintFacade(256, 512, 0xd89a9a, 0.5, rng));
  t.facadeBlue = new THREE.CanvasTexture(paintFacade(256, 512, 0x7a8fb0, 0.55, rng));
  t.facadeDark = new THREE.CanvasTexture(paintFacade(256, 512, 0x3a4258, 0.7, rng));
  t.facadeGold = new THREE.CanvasTexture(paintFacade(256, 512, 0xc9a24a, 0.5, rng));
  t.brick = new THREE.CanvasTexture(paintBrick(256, 256, 0x8a4a38, rng));
  t.brick2 = new THREE.CanvasTexture(paintBrick(256, 256, 0x6a5a48, rng));
  t.asphalt = new THREE.CanvasTexture(paintAsphalt(128, 256, rng));
  t.sand = new THREE.CanvasTexture(paintSand(256, 256, rng));
  t.neonPalms = new THREE.CanvasTexture(paintNeon(512, 128, 'PALMS', '#ff5ad0', rng));
  t.neonCasino = new THREE.CanvasTexture(paintNeon(512, 128, 'CASINO', '#ffd23e', rng));
  t.neonNeon = new THREE.CanvasTexture(paintNeon(512, 128, 'NEON MILE', '#3ee6ff', rng));
  t.neonAmmu = new THREE.CanvasTexture(paintNeon(512, 128, 'AMMU-NATION', '#ff6a3e', rng));
  t.neonGarage = new THREE.CanvasTexture(paintNeon(512, 128, 'SUNSET GARAGE', '#7dff6a', rng));
  t.neonHotel = new THREE.CanvasTexture(paintNeon(512, 128, 'HOTEL SOLMAR', '#ff9a3e', rng));
  for (const k of Object.keys(t)) {
    t[k].colorSpace = THREE.SRGBColorSpace;
    t[k].wrapS = THREE.RepeatWrapping;
    t[k].wrapT = THREE.RepeatWrapping;
    t[k].anisotropy = 4;
  }
  gfx.textures = t;
}

/** Move the sun, moon and sky colours for an in-game hour (0-24). */
export function setTimeOfDay(hours) {
  const h = ((hours % 24) + 24) % 24;
  G.time = h;
  // Sun elevation: peaks at noon, below the horizon at night.
  const sunAngle = ((h - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
  const elev = Math.sin(sunAngle);
  const az = Math.cos(sunAngle);
  const sun = gfx.sun;
  sun.position.set(az * 320, Math.max(elev, -0.12) * 320, 120);
  sun.target.position.set(0, 0, 0);
  // Remember the sun's direction so the shadow box can follow the player.
  gfx.sunDir = { x: az * 320, y: Math.max(elev, -0.12) * 320, z: 120 };
  const day = clamp(elev * 1.6 + 0.25, 0, 1);
  const dusk = clamp(1 - Math.abs(elev) * 3.2, 0, 1);
  sun.intensity = 0.4 + day * 2.4;
  sun.color.setHex(mixHex(0xff5a2a, 0xffe8c0, clamp(day + dusk * 0.4, 0, 1)));
  gfx.moon.intensity = 0.12 + (1 - day) * 0.4;
  gfx.hemi.intensity = 0.45 + day * 0.45;
  const u = gfx.skyMat.uniforms;
  // Sky colours blend channel by channel between night, dusk and day.
  const topDay = 0x3a6ab0;
  const topNight = 0x060818;
  const midDay = 0x9fc4e8;
  const midDusk = 0xff7a3c;
  const midNight = 0x1a1430;
  const botDay = 0xcfd8e0;
  const botNight = 0x0a0616;
  const top = mixHex(topNight, topDay, day);
  let mid = mixHex(midNight, midDay, day);
  mid = mixHex(mid, midDusk, dusk * 0.75);
  const bot = mixHex(botNight, botDay, day);
  u.top.value.setHex(top);
  u.mid.value.setHex(mid);
  u.bot.value.setHex(bot);
  // Fog follows the sky.
  gfx.scene.fog.color.setHex(mixHex(0x141024, 0x8a7a68, day * 0.7 + dusk * 0.3));
  gfx.scene.background = null;
  // Sun/moon discs ride the dome.
  const sunDisc = gfx.skyMesh.getObjectByName('sunDisc');
  const moonDisc = gfx.skyMesh.getObjectByName('moonDisc');
  if (sunDisc) {
    sunDisc.position.set(az * 820, Math.max(elev, -0.05) * 820, 300);
    sunDisc.lookAt(gfx.camera.position);
    sunDisc.material.opacity = 1;
  }
  if (moonDisc) {
    moonDisc.position.set(-az * 820, Math.max(-elev, 0.1) * 820, -300);
    moonDisc.lookAt(gfx.camera.position);
  }
}

/** Switch the weather: 'clear' or 'rain'. */
export function setWeather(kind) {
  G.weather = kind;
  G.rainAmount = kind === 'rain' ? 1 : 0;
  if (gfx.rain) gfx.rain.visible = kind === 'rain';
  if (gfx.scene) {
    gfx.scene.fog.density = kind === 'rain' ? 0.0026 : 0.0016;
  }
}

/** Per-frame graphics update: rain fall, sky follows the camera. */
export function updateGraphics(dt, cameraPos) {
  if (gfx.skyMesh && cameraPos) {
    gfx.skyMesh.position.set(cameraPos.x, 0, cameraPos.z);
  }
  if (gfx.rain && gfx.rain.visible) {
    const pos = gfx.rain.geometry.attributes.position;
    const arr = pos.array;
    const cx = cameraPos ? cameraPos.x : 0;
    const cz = cameraPos ? cameraPos.z : 0;
    for (let i = 0; i < gfx.rainVel.length; i++) {
      arr[i * 3 + 1] -= gfx.rainVel[i] * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 55 + Math.random() * 5;
        arr[i * 3] = cx + (Math.random() - 0.5) * 220;
        arr[i * 3 + 2] = cz + (Math.random() - 0.5) * 220;
      }
    }
    pos.needsUpdate = true;
  }
  // Keep the sun's shadow box centred on the player so shadows stay crisp.
  if (gfx.sun && cameraPos && gfx.sunDir) {
    gfx.sun.position.set(cameraPos.x + gfx.sunDir.x, gfx.sunDir.y, cameraPos.z + gfx.sunDir.z);
    gfx.sun.target.position.set(cameraPos.x, 0, cameraPos.z);
  }
}

/** Is it currently dark (night) in-game? */
export function isNight() {
  const h = G.time;
  return h < 6 || h >= 19.5;
}
