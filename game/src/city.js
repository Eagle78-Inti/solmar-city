// Solmar City v7 — the city itself: procedural textures, buildings with
// setbacks and rooftop clutter, storefronts and neon, streets, lamps and
// traffic lights, the bay with piers and the Solmar Tower, and the sky
// with a full day/night cycle. Everything is generated in code, offline.
import * as THREE from 'three';
import { clamp, lerp, rand, randi, pick, mulberry, makeCanvas, canvasTex } from './util.js';

export const ROAD_COORDS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const CITY_MIN = -270, CITY_MAX = 270, BAY_X = 300;

// --- procedural canvas textures -------------------------------------------
function asphaltCanvas() {
  return makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#23262c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${20 + randi(40)},${20 + randi(40)},${25 + randi(40)},0.5)`; g.fillRect(rand(w), rand(h), rand(1, 3), rand(1, 3)); }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = rand(w), y = rand(h); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rand(-26, 26); y += rand(-26, 26); g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#d8c95a'; g.fillRect(w / 2 - 3, 8, 6, 26); g.fillRect(w / 2 - 3, h / 2 - 13, 6, 26); g.fillRect(w / 2 - 3, h - 34, 6, 26);
    g.fillStyle = 'rgba(230,230,230,0.75)'; g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
  });
}
function groundCanvas() {
  return makeCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3d4a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${40 + randi(50)},${60 + randi(50)},${40 + randi(40)},0.5)`; g.fillRect(rand(w), rand(h), rand(1, 4), rand(1, 4)); }
    g.fillStyle = '#8a8378';
    for (let i = 0; i < 40; i++) { g.fillRect(rand(w), rand(h), rand(6, 22), rand(6, 22)); }
  });
}
function facadeCanvases(base, lit) {
  // day map: brick/concrete with a window grid; glow map: windows only.
  const day = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(rand(w), rand(h), rand(2, 8), rand(2, 8)); }
    const cols = 6, rows = 10, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + 6, y = r * ch + 6;
      g.fillStyle = '#20242e'; g.fillRect(x, y, cw - 12, ch - 12);
      g.fillStyle = lit && Math.random() < 0.45 ? '#ffd98a' : '#5a6a80';
      g.fillRect(x + 2, y + 2, cw - 16, ch - 16);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 14, w, 14);
  });
  const glow = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 10, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.5) { g.fillStyle = '#ffc873'; g.fillRect(c * cw + 8, r * ch + 8, cw - 16, ch - 16); }
    }
  });
  return { day, glow };
}
function waterCanvas() {
  return makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#0e3a5c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(140,200,240,${rand(0.08, 0.3)})`; g.lineWidth = rand(1, 2); g.beginPath(); const x = rand(w), y = rand(h); g.moveTo(x, y); g.lineTo(x + rand(10, 40), y + rand(-3, 3)); g.stroke(); }
  });
}
function neonCanvas(text, color) {
  return makeCanvas(256, 64, (g, w, h) => {
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, w, h);
    g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 16; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 1);
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + 1);
  });
}
function billboardCanvas(text, bg, fg) {
  return makeCanvas(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 - 20);
    g.font = 'bold 30px system-ui, sans-serif'; g.fillText('SOLMAR CITY', w / 2, h / 2 + 44);
  });
}

// --- shared materials (reused so the frame rate stays up) ------------------
let MATS;
function materials() {
  if (MATS) return MATS;
  const asphalt = new THREE.MeshStandardMaterial({ map: canvasTex(asphaltCanvas(), 1, 8), roughness: 0.85, metalness: 0.08 });
  const ground = new THREE.MeshStandardMaterial({ map: canvasTex(groundCanvas(), 10, 10), roughness: 1, metalness: 0 });
  const water = new THREE.MeshStandardMaterial({ map: canvasTex(waterCanvas(), 6, 6), roughness: 0.22, metalness: 0.55, color: 0x9fd4ff });
  const sand = new THREE.MeshStandardMaterial({ color: 0xd9c28a, roughness: 1 });
  const pierWood = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.95 });
  const darkGlass = new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.12, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.4, metalness: 0.8 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, side: THREE.DoubleSide });
  const facades = [];
  const bases = ['#a8623f', '#7a6a58', '#5d6a7a', '#8a5a5a', '#6a7a5d', '#94663f'];
  for (const b of bases) { const { day, glow } = facadeCanvases(b, true); facades.push({ map: canvasTex(day), glow: canvasTex(glow) }); }
  MATS = { asphalt, ground, water, sand, pierWood, concrete, darkGlass, steel, trunk, palmLeaf, facades };
  return MATS;
}

// --- build the world ---------------------------------------------------------
export function buildCity(G) {
  const M = materials();
  const scene = G.scene;
  G.colliders = [];
  G.facadeMats = [];
  G.neonMats = [];
  G.lampPools = [];
  G.lampHeads = [];
  G.trafficLights = [];
  G.puddleMat = new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.35, metalness: 0.85 });
  for (const f of M.facades) {
    const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.glow, emissive: new THREE.Color(0xffc873), emissiveIntensity: 0, roughness: 0.9, metalness: 0.02 });
    G.facadeMats.push(mat);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(780, 780), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(140, -0.06, 0); ground.receiveShadow = true; scene.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(44, 640), M.sand);
  beach.rotation.x = -Math.PI / 2; beach.position.set(292, 0.02, 0); beach.receiveShadow = true; scene.add(beach);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(360, 660, 20, 20), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(490, 0.08, 0); scene.add(water);
  G.water = water;
  for (const c of ROAD_COORDS) {
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(14, 560), M.asphalt);
    rv.rotation.x = -Math.PI / 2; rv.position.set(c, 0.01, 0); rv.receiveShadow = true; scene.add(rv);
    const rh = new THREE.Mesh(new THREE.PlaneGeometry(560, 14), M.asphalt);
    rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.01, c); rh.receiveShadow = true; scene.add(rh);
  }
  // crosswalk stripes at every intersection
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const x of ROAD_COORDS) for (const z of ROAD_COORDS) {
    for (let i = -2; i <= 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.5), stripeMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x + i * 2.4, 0.03, z - 9.5); scene.add(s);
    }
  }
  // puddles that catch the light at night
  const puddleGeo = new THREE.CircleGeometry(1, 16);
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(puddleGeo, G.puddleMat);
    p.rotation.x = -Math.PI / 2; p.scale.setScalar(rand(1.5, 3.5));
    p.position.set(pick(ROAD_COORDS) + rand(-4, 4), 0.04, rand(-250, 250)); scene.add(p);
  }
  buildBuildings(G, M, scene);
  buildStreetProps(G, M, scene);
  buildPiers(G, M, scene);
  buildSky(G, scene);
}

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (shadow) m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

function buildBuildings(G, M, scene) {
  const rng = mulberry(1337);
  const neonWords = [['PIER 9', '#ff4fd8'], ['NEON', '#39d5ff'], ['TACOS', '#ffb020'], ['SOLMAR', '#7CFF6B'], ['24H', '#ff5a5a'], ['HOTEL', '#c98aff']];
  const billboards = [['SOLMAR', '#123a6b', '#ffd76a'], ['BAY FEST', '#6b123a', '#ffffff'], ['PIER 9', '#0a4a3a', '#ffe9a8']];
  for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 8; bz++) {
    const cx = ROAD_COORDS[bx] + 30, cz = ROAD_COORDS[bz] + 30;
    if (cx > 250) continue;
    if (bx === 4 && bz === 4) { buildPlaza(G, M, scene, cx, cz); continue; }
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const w = 13 + rng() * 16, d = 13 + rng() * 16;
      const h = (bx === 2 && bz === 2) ? 110 : 9 + rng() * rng() * 48;
      const x = cx + (rng() - 0.5) * (44 - w), z = cz + (rng() - 0.5) * (44 - d);
      const mat = G.facadeMats[Math.floor(rng() * G.facadeMats.length)];
      const b = box(w, h, d, mat, x, h / 2, z, scene);
      box(w + 0.6, 0.8, d + 0.6, M.concrete, x, h + 0.4, z, scene, false);
      if (rng() < 0.6) box(rand(2, 4), rand(1, 2), rand(2, 4), M.steel, x + rand(-w / 4, w / 4), h + 1, z + rand(-d / 4, d / 4), scene, false);
      if (rng() < 0.3) {
        const tw = new THREE.Group();
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
        tank.position.y = 2.4; tank.castShadow = true; tw.add(tank);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.9 }));
        cone.position.y = 4.6; tw.add(cone);
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), M.steel); leg.position.set(lx, 0.8, lz); tw.add(leg); }
        tw.position.set(x + rand(-w / 4, w / 4), h + 0.8, z + rand(-d / 4, d / 4)); scene.add(tw);
      }
      if (h < 30 && rng() < 0.55) {
        const [word, color] = neonWords[Math.floor(rng() * neonWords.length)];
        const nmat = new THREE.MeshStandardMaterial({ map: canvasTex(neonCanvas(word, color)), emissive: new THREE.Color(0xffffff), emissiveMap: canvasTex(neonCanvas(word, color)), emissiveIntensity: 0.4, roughness: 0.4 });
        G.neonMats.push(nmat);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), nmat);
        sign.position.set(x, 4.6, z + d / 2 + 0.15); scene.add(sign);
        box(w * 0.7, 0.3, 1.2, new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.8 }), x, 3.9, z + d / 2 + 0.6, scene, false);
      }
      if (h > 34 && rng() < 0.4) {
        const [word, bg, fg] = billboards[Math.floor(rng() * billboards.length)];
        const bmat = new THREE.MeshStandardMaterial({ map: canvasTex(billboardCanvas(word, bg, fg)), emissive: new THREE.Color(0xffffff), emissiveMap: canvasTex(billboardCanvas(word, bg, fg)), emissiveIntensity: 0.25, roughness: 0.6 });
        G.neonMats.push(bmat);
        const bb = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), bmat);
        bb.position.set(x, h + 3.4, z); bb.rotation.y = rng() * Math.PI; scene.add(bb);
        box(0.5, 3.4, 0.5, M.steel, x - 4, h + 1.7, z, scene, false);
        box(0.5, 3.4, 0.5, M.steel, x + 4, h + 1.7, z, scene, false);
      }
      if (bx === 2 && bz === 2) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
        beacon.position.set(x, h + 2.2, z); scene.add(beacon); G.towerBeacon = beacon;
      }
      G.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }
}

function buildPlaza(G, M, scene, cx, cz) {
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshStandardMaterial({ color: 0x3f6a35, roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.05, cz); lawn.receiveShadow = true; scene.add(lawn);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    box(2.4, 0.5, 0.9, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }), cx + Math.cos(a) * 12, 0.3, cz + Math.sin(a) * 12, scene, false);
  }
  for (let i = 0; i < 6; i++) makePalm(M, scene, cx + rand(-15, 15), cz + rand(-15, 15));
}

function makePalm(M, scene, x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.5, 7), M.trunk);
  trunk.position.y = 2.75; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), M.palmLeaf);
    leaf.position.y = 5.6; leaf.rotation.y = (i / 6) * Math.PI * 2; leaf.rotation.z = 0.7;
    leaf.translateX(1.2); g.add(leaf);
  }
  g.position.set(x, 0, z); scene.add(g);
}

function buildStreetProps(G, M, scene) {
  const lampPole = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.5, metalness: 0.7 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.15, roughness: 0.3 });
  G.lampHeadMat = lampHeadMat;
  const poolGeo = new THREE.CircleGeometry(4.5, 20);
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  G.poolMat = poolMat;
  for (const c of ROAD_COORDS) for (let s = -240; s <= 240; s += 60) {
    for (const [ox, oz, ry] of [[9, s, 0], [-9, s + 30, Math.PI]]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 8), lampPole);
      pole.position.y = 3; pole.castShadow = true; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), lampPole);
      arm.position.set(0, 5.9, 1); g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), lampHeadMat);
      head.position.set(0, 5.85, 2); g.add(head);
      g.position.set(c + ox, 0, oz); g.rotation.y = ry; scene.add(g);
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2; pool.position.set(c + ox + (ry === 0 ? 0 : 0), 0.06, oz + 2); scene.add(pool);
      G.lampPools.push(pool);
    }
  }
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 });
  const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.85, metalness: 0.2 });
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 26; i++) {
    const x = pick(ROAD_COORDS) + rand(-8, 8), z = rand(-250, 250);
    const kind = i % 3;
    if (kind === 0) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 10), coneMat); c.position.set(x, 0.55, z); c.castShadow = true; scene.add(c); }
    else if (kind === 1) { const d = box(2.2, 1.4, 1.2, dumpMat, x, 0.7, z, scene); G.colliders.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 0.6, maxZ: z + 0.6 }); }
    else { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), hydMat); h.position.set(x, 0.45, z); h.castShadow = true; scene.add(h); }
  }
  for (let i = 0; i < 10; i++) makePalm(M, scene, 282 + rand(-4, 4), -260 + i * 55 + rand(-8, 8));
  const lightPhases = [0, 4, 8, 12];
  let li = 0;
  for (const [x, z] of [[-60, -60], [60, 60], [-120, 120], [120, -120]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 8), lampPole);
    pole.position.y = 2.7; pole.castShadow = true; g.add(pole);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.28), lampPole);
    bar.position.set(0, 5.3, 0); g.add(bar);
    const lamps = [];
    const cols = [0xff2020, 0xffc020, 0x20ff60];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x181818, emissive: cols[i], emissiveIntensity: 0.08 }));
      s.position.set(-0.9 + i * 0.9, 5.3, 0.2); g.add(s); lamps.push(s);
    }
    g.position.set(x + 8.5, 0, z + 8.5); scene.add(g);
    G.trafficLights.push({ lamps, phase: lightPhases[li++ % 4] });
  }
}

function buildPiers(G, M, scene) {
  for (const z of [-120, 0, 120]) {
    const deck = box(95, 1, 9, M.pierWood, 348, 0.7, z, scene);
    for (let x = 310; x <= 390; x += 10) for (const dz of [-3.6, 3.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), M.pierWood);
      post.position.set(x, -0.2, z + dz); scene.add(post);
    }
    box(16, 1, 14, M.pierWood, 392, 0.7, z, scene);
    for (const dz of [-5, 0, 5]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffe9a0, emissiveIntensity: 0.6 }));
      lamp.position.set(392, 2.6, z + dz); scene.add(lamp);
    }
  }
}

function buildSky(G, scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3a7bd5) }, bottom: { value: new THREE.Color(0xbfd9ff) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(0xffe9a8) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vDir; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; void main(){ float h = clamp(vDir.y, -0.1, 1.0); vec3 c = mix(bottom, top, pow(max(h, 0.0), 0.55)); float s = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 200.0); c += sunColor * s * 1.6; float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0); c += sunColor * halo * 0.22; gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(850, 24, 16), skyMat);
  scene.add(sky); G.skyMat = skyMat;
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 420; i++) { const a = rand(Math.PI * 2), e = rand(0.15, 1.4); pts.push(Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0, fog: false }));
  scene.add(stars); G.stars = stars;
  G.clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false });
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(9, 20), 10, 8), cloudMat);
      s.position.set(j * rand(8, 16) - 14, rand(-2, 2), rand(-6, 6)); s.scale.y = 0.42; cl.add(s);
    }
    cl.position.set(rand(-500, 500), rand(120, 190), rand(-500, 500));
    scene.add(cl); G.clouds.push(cl);
  }
  G.sun = new THREE.DirectionalLight(0xffffff, 2.2);
  G.sun.castShadow = true;
  G.sun.shadow.mapSize.set(1024, 1024);
  G.sun.shadow.camera.left = -320; G.sun.shadow.camera.right = 320;
  G.sun.shadow.camera.top = 320; G.sun.shadow.camera.bottom = -320;
  G.sun.shadow.camera.far = 1200; G.sun.shadow.bias = -0.0006;
  scene.add(G.sun); scene.add(G.sun.target);
  G.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3230, 0.9);
  scene.add(G.hemi);
  scene.fog = new THREE.Fog(0xbfd9ff, 420, 950);
}

// --- day/night cycle -----------------------------------------------------------
const SKY_KEYS = [
  [0, 0x04061a, 0x0a1230, 0x8a97c8], [5, 0x1a2440, 0x5a4a6a, 0xffb080],
  [7, 0x4a86c8, 0xc8d8f0, 0xffe9a8], [12, 0x3a7bd5, 0xbfd9ff, 0xfff2c0],
  [17, 0x3a6ac0, 0xffc873, 0xffd98a], [18.5, 0x2a2a55, 0xff7a3c, 0xff8a4a],
  [20, 0x0a0a24, 0x1a2040, 0xc8d0ff], [24, 0x04061a, 0x0a1230, 0x8a97c8],
];
export function updateCity(G, dt) {
  G.hours = (G.hours + (dt * 24) / 720) % 24;
  const h = G.hours;
  let k0 = SKY_KEYS[0], k1 = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i][0] && h <= SKY_KEYS[i + 1][0]) { k0 = SKY_KEYS[i]; k1 = SKY_KEYS[i + 1]; break; }
  }
  const t = (h - k0[0]) / Math.max(0.001, k1[0] - k0[0]);
  const top = new THREE.Color(k0[1]).lerp(new THREE.Color(k1[1]), t);
  const bot = new THREE.Color(k0[2]).lerp(new THREE.Color(k1[2]), t);
  const sunC = new THREE.Color(k0[3]).lerp(new THREE.Color(k1[3]), t);
  const ang = ((h - 6) / 12) * Math.PI;
  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.32).normalize();
  const elev = Math.sin(ang);
  const nightF = clamp(-elev * 3.2, 0, 1);
  const dayF = clamp(elev * 3.2, 0, 1);
  G.skyMat.uniforms.top.value.copy(top);
  G.skyMat.uniforms.bottom.value.copy(bot);
  G.skyMat.uniforms.sunDir.value.copy(sunDir);
  G.skyMat.uniforms.sunColor.value.copy(sunC);
  G.sun.position.copy(sunDir).multiplyScalar(420);
  G.sun.target.position.set(0, 0, 0);
  G.sun.intensity = 0.14 + dayF * 2.1;
  G.sun.color.copy(sunC);
  G.hemi.intensity = 0.28 + dayF * 0.65;
  G.scene.fog.color.copy(bot);
  G.stars.material.opacity = nightF * 0.9;
  for (const m of G.facadeMats) m.emissiveIntensity = nightF * 1.15;
  for (const m of G.neonMats) m.emissiveIntensity = 0.35 + nightF * 1.7;
  G.lampHeadMat.emissiveIntensity = 0.15 + nightF * 1.9;
  G.poolMat.opacity = nightF * 0.5;
  G.puddleMat.roughness = 0.35 - nightF * 0.27;
  G.water.material.map.offset.x += dt * 0.012; G.water.material.map.offset.y += dt * 0.007;
  G.water.position.y = 0.08 + Math.sin(G.elapsed * 0.6) * 0.05;
  for (const c of G.clouds) { c.position.x += dt * 2.2; if (c.position.x > 560) c.position.x = -560; }
  if (G.towerBeacon) G.towerBeacon.material.emissiveIntensity = 1.2 + Math.sin(G.elapsed * 2.4) * 1.1;
  for (const tl of G.trafficLights) {
    const ph = (G.elapsed + tl.phase) % 18;
    const on = ph < 8 ? 2 : ph < 10 ? 1 : 0;
    tl.lamps.forEach((s, i) => { s.material.emissiveIntensity = i === on ? 1.8 : 0.06; });
  }
  G.nightF = nightF; G.dayF = dayF;
  G.sunElevation = elev;
}
