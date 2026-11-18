// Solmar City v4 — the bay city itself: procedural canvas textures, the road grid,
// buildings with lit windows, street props, piers and beach, the animated bay,
// and the full day/night sky. Everything is generated at runtime; no network.
import * as THREE from 'three';
import { clamp, clamp01, lerp, rand, randInt, pick } from './util.js';

export const ROADS_X = [-120, -60, 0, 60, 120];
export const ROADS_Z = [-120, -60, 0, 60, 120];
export const ROAD_W = 14;
export const CITY_BOUND = 150;
export const BAY_X = -150;
export const HIDEOUT = { x: -100, z: -100 };
export const BANK = { x: 60, z: -60 };
export const GARAGE = { x: -60, z: 60 };
export const MEET = { x: 90, z: 90 };
export const TOWER = { x: 90, z: 90 };
export const PIER_ZS = [-60, 0, 60];
export const SUV_SPOT = { x: 30, z: -30 };

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function asphaltTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#33363b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${randInt(10, 70)},${randInt(10, 70)},${randInt(10, 75)},0.5)`;
      g.fillRect(rand(w), rand(h), rand(1, 3), rand(1, 3));
    }
    g.strokeStyle = 'rgba(20,20,22,0.7)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      let x = rand(w), y = rand(h);
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#c8b45a';
    g.fillRect(w / 2 - 2, 0, 4, 40); g.fillRect(w / 2 - 2, 90, 4, 40); g.fillRect(w / 2 - 2, 180, 4, 40);
  }, 8, 8);
}

function sidewalkTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8c84'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${randInt(100, 160)},${randInt(100, 155)},${randInt(95, 145)},0.4)`;
      g.fillRect(rand(w), rand(h), rand(1, 3), rand(1, 3));
    }
    g.strokeStyle = 'rgba(60,58,52,0.8)'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, 6, 6);
}

function facadeTexture(base, lit) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(rand(w), rand(h), rand(2, 8), rand(2, 8));
    }
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 14 + col * 40, y = 12 + row * 30;
        const isLit = Math.random() < lit;
        g.fillStyle = isLit ? '#ffd98a' : '#141a26';
        g.fillRect(x, y, 24, 18);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x, y, 24, 3);
      }
    }
    g.fillStyle = '#20242c'; g.fillRect(w / 2 - 18, h - 34, 36, 34);
  });
}

function sandTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d9c08a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      g.fillStyle = `rgba(${randInt(150, 220)},${randInt(130, 190)},${randInt(90, 140)},0.5)`;
      g.fillRect(rand(w), rand(h), rand(1, 3), rand(1, 3));
    }
  }, 4, 10);
}

function waterTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1d5f8a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(180,220,255,${rand(0.1, 0.35)})`;
      g.lineWidth = rand(1, 2.5);
      const y = rand(h);
      g.beginPath(); g.moveTo(rand(w * 0.4), y);
      g.bezierCurveTo(rand(w), y + rand(-6, 6), rand(w), y + rand(-6, 6), rand(w), y);
      g.stroke();
    }
  }, 3, 8);
}

function neonTexture(text, color) {
  return canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, w, h);
    g.font = 'bold 52px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

const SKY_DAY = new THREE.Color(0x79aede);
const SKY_DUSK = new THREE.Color(0xff8346);
const SKY_NIGHT = new THREE.Color(0x0a1122);
const WATER_DAY = new THREE.Color(0x2a7ab0);
const WATER_NIGHT = new THREE.Color(0x0d2233);
const _sky = new THREE.Color();
const _water = new THREE.Color();
const _sunCol = new THREE.Color();

export function nearestRoadCoord(v) {
  let best = ROADS_X[0], bd = Infinity;
  for (const r of ROADS_X) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
export function onRoad(x, z) {
  for (const r of ROADS_X) if (Math.abs(x - r) < ROAD_W / 2 + 1) return true;
  for (const r of ROADS_Z) if (Math.abs(z - r) < ROAD_W / 2 + 1) return true;
  return false;
}

export function createCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const asphalt = asphaltTexture();
  const sidewalk = sidewalkTexture();
  const sand = sandTexture();
  const waterTex = waterTexture();
  const facadeMats = [
    new THREE.MeshStandardMaterial({ map: facadeTexture('#8a5a44', 0.45), emissiveMap: facadeTexture('#8a5a44', 0.45), emissive: 0xffc06a, emissiveIntensity: 0, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: facadeTexture('#6f7d8c', 0.5), emissiveMap: facadeTexture('#6f7d8c', 0.5), emissive: 0xffc06a, emissiveIntensity: 0, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: facadeTexture('#3f6d8e', 0.6), emissiveMap: facadeTexture('#3f6d8e', 0.6), emissive: 0xffc06a, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ map: facadeTexture('#b09a72', 0.4), emissiveMap: facadeTexture('#b09a72', 0.4), emissive: 0xffc06a, emissiveIntensity: 0, roughness: 0.9 }),
  ];
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf8a, emissiveIntensity: 0 });
  const neonMats = [];
  const lampHeads = [];
  const trafficLights = [];
  const clouds = [];

  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ map: sidewalk, roughness: 0.95 });
  const sandMat = new THREE.MeshStandardMaterial({ map: sand, roughness: 1 });
  const roadGeoX = new THREE.PlaneGeometry(ROAD_W, 330);
  const roadGeoZ = new THREE.PlaneGeometry(330, ROAD_W);

  const base = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), new THREE.MeshStandardMaterial({ color: 0x2e3134, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.set(0, -0.06, 0); base.receiveShadow = true;
  group.add(base);
  for (const r of ROADS_X) {
    const m = new THREE.Mesh(roadGeoX, asphaltMat);
    m.rotation.x = -Math.PI / 2; m.position.set(r, 0, 0); m.receiveShadow = true;
    group.add(m);
  }
  for (const r of ROADS_Z) {
    const m = new THREE.Mesh(roadGeoZ, asphaltMat);
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0, r); m.receiveShadow = true;
    group.add(m);
  }
  const edges = [-150, -127, -113, -67, -53, -7, 7, 53, 67, 113, 127, 150];
  for (let i = 0; i < edges.length - 1; i += 2) {
    for (let j = 0; j < edges.length - 1; j += 2) {
      const cx = (edges[i] + edges[i + 1]) / 2, cz = (edges[j] + edges[j + 1]) / 2;
      const w = edges[i + 1] - edges[i], d = edges[j + 1] - edges[j];
      if (cx < -130) continue;
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(w, d), walkMat);
      walk.rotation.x = -Math.PI / 2; walk.position.set(cx, 0.02, cz); walk.receiveShadow = true;
      group.add(walk);
    }
  }
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(33, 330), sandMat);
  beach.rotation.x = -Math.PI / 2; beach.position.set(-151.5, 0.01, 0); beach.receiveShadow = true;
  group.add(beach);
  const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x2a7ab0, metalness: 0.35, roughness: 0.22 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 340), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(-232, -0.4, 0);
  group.add(water);

  const blockCenters = [-90, -30, 30, 90, 131];
  const blockW = { '-90': 46, '-30': 46, '30': 46, '90': 46, '131': 23 };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2c4d68, roughness: 0.25, metalness: 0.5 });
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bx === 90 && bz === 90) continue;
      if (bx === -90 && bz === -90) continue;
      if (Math.random() < 0.12) continue;
      const w = blockW[String(bx)] * rand(0.55, 0.8);
      const d = blockW[String(bz)] * rand(0.55, 0.8);
      const h = rand(10, 42) * (1 + (1 - Math.abs(bx) / 160) * 0.5);
      const mat = pick(facadeMats);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx + rand(-3, 3), h / 2, bz + rand(-3, 3));
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.2, d * 0.7), roofMat);
      roof.position.set(b.position.x, h + 0.6, b.position.z);
      group.add(roof);
      if (Math.random() < 0.5) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), roofMat);
        ac.position.set(b.position.x + w * 0.2, h + 1.4, b.position.z);
        group.add(ac);
      }
    }
  }
  const hideout = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 14), facadeMats[3]);
  hideout.position.set(-90, 3.5, -90); hideout.castShadow = true;
  group.add(hideout);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(22, 85, 22), glassMat);
  tower.position.set(90, 42.5, 90); tower.castShadow = true;
  group.add(tower);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 16, 8), new THREE.MeshStandardMaterial({ color: 0xc0c4cc, metalness: 0.8, roughness: 0.3 }));
  spire.position.set(90, 93, 90);
  group.add(spire);
  const towerTop = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff5566, emissive: 0xff2233, emissiveIntensity: 1.4 }));
  towerTop.position.set(90, 102, 90);
  group.add(towerTop);

  function neonSign(text, color, x, y, z, ry) {
    const mat = new THREE.MeshStandardMaterial({ map: neonTexture(text, color), emissiveMap: neonTexture(text, color), emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.4 });
    neonMats.push(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), mat);
    sign.position.set(x, y, z); sign.rotation.y = ry;
    group.add(sign);
    return sign;
  }
  neonSign('CASINO', '#ff2fb3', 30, 9, 45, Math.PI);
  neonSign('PIER 7', '#2fd8ff', -136, 6, 0, Math.PI / 2);
  neonSign('SOLMAR', '#ffc93c', 90, 78, 78.5, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7, metalness: 0.5 });
  function lamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 8), poleMat);
    pole.position.y = 3.2; pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), poleMat);
    arm.position.set(1, 6.3, 0);
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), lampMat);
    head.position.set(2, 6.2, 0);
    g.add(head);
    lampHeads.push(head);
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (const r of ROADS_X) for (let z = -135; z <= 135; z += 30) lamp(r + 8.5, z);
  for (const r of ROADS_Z) for (let x = -120; x <= 135; x += 30) lamp(x, r - 8.5);
  const bulbRed = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 0.2 });
  const bulbAmber = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffaa00, emissiveIntensity: 0.2 });
  const bulbGreen = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x22ff66, emissiveIntensity: 0.2 });
  function trafficLight(x, z, phase) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 8), poleMat);
    pole.position.y = 2.7;
    g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.7), poleMat);
    box.position.y = 5.4;
    g.add(box);
    const mk = (mat, y) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat);
      s.position.set(0, y, 0.42);
      g.add(s);
      return s;
    };
    const red = mk(bulbRed, 6.05), amber = mk(bulbAmber, 5.4), green = mk(bulbGreen, 4.75);
    g.position.set(x, 0, z);
    group.add(g);
    trafficLights.push({ red, amber, green, phase });
  }
  trafficLight(66, -66, 0); trafficLight(-66, 66, 4); trafficLight(6, -66, 8); trafficLight(-66, -6, 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8b4a, roughness: 0.9, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7, 7), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = rand(-0.08, 0.08); trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.6, 7.1, Math.sin(a) * 1.6);
      f.rotation.set(Math.sin(a) * 0.5 - 0.5, -a, Math.cos(a) * 0.5);
      f.castShadow = true;
      g.add(f);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let z = -140; z <= 140; z += 22) palm(-138, z + rand(-3, 3));
  palm(-112, 40); palm(-112, -40); palm(112, 120); palm(40, -112);
  for (const pz of PIER_ZS) {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x6e5232, roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(52, 0.7, 8), deckMat);
    deck.position.set(-162, 0.6, pz); deck.castShadow = true; deck.receiveShadow = true;
    group.add(deck);
    for (let x = -140; x >= -184; x -= 11) {
      for (const dz of [-3.4, 3.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), deckMat);
        post.position.set(x, -0.4, pz + dz);
        group.add(post);
      }
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), facadeMats[1]);
    hut.position.set(-180, 2.6, pz); hut.castShadow = true;
    group.add(hut);
  }
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(6, 12), 10, 8), cloudMat);
      s.scale.y = 0.35;
      s.position.set(j * rand(6, 10) - 8, rand(-1, 1), rand(-4, 4));
      c.add(s);
    }
    c.position.set(rand(-220, 220), rand(62, 95), rand(-220, 220));
    clouds.push(c);
    scene.add(c);
  }
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a4238, 0.6);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.16);
  scene.add(amb);
  scene.fog = new THREE.Fog(0x79aede, 130, 460);

  let elapsed = 0;
  function update(dt, hours) {
    elapsed += dt;
    const elev = Math.sin((hours - 6) / 12 * Math.PI);
    const nightF = clamp01(-elev * 2 + 0.22);
    const duskF = clamp01(1 - Math.abs(elev) * 3.2);
    _sky.copy(SKY_DAY).lerp(SKY_DUSK, duskF).lerp(SKY_NIGHT, nightF);
    scene.background = _sky.clone();
    scene.fog.color.copy(_sky);
    const ang = (hours - 6) / 12 * Math.PI;
    sun.position.set(Math.cos(ang) * 280, Math.max(12, Math.sin(ang) * 280), 130);
    _sunCol.set(0xfff2dd).lerp(new THREE.Color(0xff8844), duskF);
    sun.color.copy(_sunCol);
    sun.intensity = elev > 0 ? clamp01(elev * 3 + 0.12) * 2.4 : 0.22;
    hemi.intensity = 0.28 + clamp01(elev + 0.3) * 0.45;
    amb.intensity = 0.12 + clamp01(elev + 0.3) * 0.1;
    const winGlow = nightF * 1.15;
    for (const m of facadeMats) m.emissiveIntensity = winGlow;
    lampMat.emissiveIntensity = nightF * 2.6;
    for (const m of neonMats) m.emissiveIntensity = 0.35 + nightF * 1.7;
    _water.copy(WATER_DAY).lerp(WATER_NIGHT, nightF);
    waterMat.color.copy(_water);
    waterTex.offset.x += dt * 0.008;
    waterTex.offset.y += dt * 0.003;
    for (const c of clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 240) c.position.x = -240;
    }
    for (const tl of trafficLights) {
      const ph = (elapsed + tl.phase) % 12;
      const g = ph < 5 ? 2.4 : 0.15;
      const a = ph >= 5 && ph < 6.5 ? 2.4 : 0.15;
      const r = ph >= 6.5 ? 2.4 : 0.15;
      tl.green.material.emissiveIntensity = g;
      tl.amber.material.emissiveIntensity = a;
      tl.red.material.emissiveIntensity = r;
    }
    return { nightF, duskF, elev };
  }
  return { group, update, sun, hemi, water, trafficLights, lampHeads };
}
