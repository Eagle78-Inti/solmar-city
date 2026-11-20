// Solmar City v8 — procedural city: road grid, varied buildings, neon district,
// beach and bay, marina, palms and streetlights, with a day/night cycle.
// All geometry is generated from a fixed seed, so the city is identical every load.
import * as THREE from 'three';
import { clamp, lerp, mulberry32, pick } from './util.js';

export const CITY = {
  minX: -240, maxX: 300, minZ: -300, maxZ: 300,
  roadGap: 60, roadWidth: 12,
  waterX: -244, // west of this line is the bay
};

const PALETTES = {
  downtown: [0x8fa3b8, 0x6e7f92, 0xa8b6c4, 0x5d6d7e, 0x93a8bd],
  beach: [0xf2c9a0, 0xe8a87c, 0xf7d7b5, 0xd98c5f, 0xffe0b8],
  neon: [0x2b2b4a, 0x40204a, 0x1f3a4a, 0x4a2b3a, 0x33335e],
  harbor: [0x7d8a94, 0x5f6e78, 0x8a7d6e, 0x6e7a6e, 0x9aa0a3],
};

const NEON_WORDS = ['NEON', 'SOLMAR', 'CASINO', 'HOTEL', 'TACOS', 'PIER 9', 'VICE', 'PALMS', '24H', 'LUNA'];
const NEON_COLORS = ['#ff2e88', '#00e5ff', '#ffe14d', '#7cff4d', '#ff7a1a', '#c26bff'];

function windowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9ad7ff') : '#10131a';
      g.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function neonTexture(word, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(word, 128, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(word, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8c33a';
  g.fillRect(62, 0, 4, 40);
  g.fillRect(62, 88, 4, 40);
  g.fillStyle = '#c8ccd2';
  g.fillRect(0, 0, 128, 3);
  g.fillRect(0, 125, 128, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function districtAt(x, z) {
  if (x < CITY.waterX + 20) return 'Beachside';
  if (x >= 120 && z >= -120 && z <= 120) return 'Neon Mile';
  if (x < -120 && z > 120) return 'Harbor';
  if (Math.abs(x) < 120 && Math.abs(z) < 120) return 'Downtown';
  if (z > 180) return 'Marina';
  return 'Solmar';
}

export function buildCity(scene) {
  const rng = mulberry32(1337);
  const colliders = [];
  const windowMats = [];
  const winTexes = [windowTexture(rng, 0.45), windowTexture(rng, 0.6), windowTexture(rng, 0.3)];
  for (const t of winTexes) {
    windowMats.push(new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 }));
  }
  const neonMats = NEON_WORDS.map((w, i) => new THREE.MeshBasicMaterial({
    map: neonTexture(w, NEON_COLORS[i % NEON_COLORS.length]),
    toneMapped: false,
  }));
  const roadTex = roadTexture();
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffe9a8, emissiveIntensity: 0 });
  const lampMats = [lampMat];

  // Ground + water + beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x3a4038 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(30, -0.05, 0);
  scene.add(ground);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 700),
    new THREE.MeshLambertMaterial({ color: 0x14506e, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-244 - 160, 0.15, 0);
  scene.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 600),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-232, 0.02, 0);
  scene.add(sand);

  // Roads: asphalt strips with dashed centre lines, plus sidewalks.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8a8d90 });
  const roadLines = [];
  for (let i = -240; i <= 300; i += 60) {
    roadLines.push(i);
  }
  for (const v of roadLines) {
    if (v > 240) continue;
    const len = 540;
    const texV = roadTex.clone();
    texV.needsUpdate = true;
    texV.repeat.set(1, len / 12);
    const mV = new THREE.MeshLambertMaterial({ map: texV });
    const rV = new THREE.Mesh(new THREE.PlaneGeometry(12, len), mV);
    rV.rotation.x = -Math.PI / 2;
    rV.position.set(v, 0.01, 0);
    scene.add(rV);
    const texH = roadTex.clone();
    texH.needsUpdate = true;
    texH.repeat.set(1, len / 12);
    const mH = new THREE.MeshLambertMaterial({ map: texH });
    const rH = new THREE.Mesh(new THREE.PlaneGeometry(12, len), mH);
    rH.rotation.x = -Math.PI / 2;
    rH.rotation.z = Math.PI / 2;
    rH.position.set(30, 0.01, v);
    scene.add(rH);
    // Sidewalk strips along each road.
    const sV = new THREE.Mesh(new THREE.PlaneGeometry(3, len), walkMat);
    sV.rotation.x = -Math.PI / 2;
    sV.position.set(v + 7.5, 0.005, 0);
    scene.add(sV);
    const sH = new THREE.Mesh(new THREE.PlaneGeometry(3, len), walkMat);
    sH.rotation.x = -Math.PI / 2;
    sH.rotation.z = Math.PI / 2;
    sH.position.set(30, 0.005, v + 7.5);
    scene.add(sH);
  }

  // Buildings: one to three per block, heights and colours by district.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const signGeo = new THREE.PlaneGeometry(14, 3.5);
  for (let bx = -240; bx < 300; bx += 60) {
    for (let bz = -300; bz < 300; bz += 60) {
      const cx = bx + 30;
      const cz = bz + 30;
      if (cx < -210) continue; // beach / water blocks stay open
      const district = districtAt(cx, cz);
      const palette = PALETTES[district === 'Neon Mile' ? 'neon' : district === 'Beachside' ? 'beach' : district === 'Harbor' || district === 'Marina' ? 'harbor' : 'downtown'];
      const count = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < count; k++) {
        const w = 16 + rng() * 18;
        const d = 16 + rng() * 18;
        const h = district === 'Downtown' ? 22 + rng() * 42 : district === 'Neon Mile' ? 14 + rng() * 26 : 8 + rng() * 18;
        const px = cx + (rng() - 0.5) * (44 - w);
        const pz = cz + (rng() - 0.5) * (44 - d);
        const winTex = pick(rng, winTexes);
        const mat = new THREE.MeshLambertMaterial({
          color: pick(rng, palette),
          map: winTex,
          emissive: 0xffffff,
          emissiveMap: winTex,
          emissiveIntensity: 0,
        });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(px, h / 2, pz);
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(px, h + 0.4, pz);
        scene.add(roof);
        // Window-lit material instances for the night glow.
        windowMats.push(mat);
        colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
        // Neon signs in Neon Mile (and a few downtown towers).
        if ((district === 'Neon Mile' && rng() < 0.85) || (district === 'Downtown' && rng() < 0.12)) {
          const sign = new THREE.Mesh(signGeo, pick(rng, neonMats));
          const side = rng() < 0.5 ? 1 : -1;
          sign.position.set(px + side * (w / 2 + 0.3), Math.min(h - 2, 12 + rng() * 8), pz);
          sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(sign);
        }
      }
    }
  }

  // Streetlights along the main avenues.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const bulbGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (let x = -240; x <= 240; x += 60) {
    for (let z = -240; z <= 240; z += 120) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 8, 3.5, z);
      scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(x + 8, 7.1, z);
      scene.add(bulb);
    }
  }

  // Palm trees on the beach and along the Neon Mile strip.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e5233 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const crownGeo = new THREE.ConeGeometry(2.6, 3.4, 7);
  for (let i = 0; i < 46; i++) {
    const onBeach = i < 26;
    const px = onBeach ? -238 + rng() * 6 : 126 + rng() * 168;
    const pz = onBeach ? -280 + rng() * 560 : -110 + rng() * 220;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(px, 8.2, pz);
    scene.add(crown);
  }

  // Marina: piers and moored yachts in the south-west bay.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const piers = [];
  for (let i = 0; i < 3; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 5), pierMat);
    pier.position.set(-272, 0.6, -140 + i * 90);
    scene.add(pier);
    piers.push(pier);
  }
  const yachtMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const yachtAccent = new THREE.MeshLambertMaterial({ color: 0x14324a });
  for (let i = 0; i < 5; i++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 3.4), yachtMat);
    hull.position.set(-268 - rng() * 22, 0.7, -150 + i * 70 + rng() * 12);
    hull.rotation.y = (rng() - 0.5) * 0.2;
    scene.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 2.6), yachtAccent);
    cabin.position.set(hull.position.x, 2.6, hull.position.z);
    cabin.rotation.y = hull.rotation.y;
    scene.add(cabin);
  }

  const spawnPoints = {
    beach: { x: -210, z: 0 },
    downtown: { x: 0, z: 0 },
    harbor: { x: -180, z: 210 },
    neonMile: { x: 180, z: 0 },
    marina: { x: -210, z: 240 },
    docks: { x: -190, z: 260 },
    casino: { x: 180, z: 30 },
    pier: { x: -280, z: 60 },
  };

  return {
    colliders,
    spawnPoints,
    water,
    update(dayFrac, sun, hemi, sceneRef) {
      const day = clamp(Math.sin(dayFrac * Math.PI * 2 - Math.PI / 2) * 1.6 + 0.35, 0, 1);
      const golden = clamp(1 - Math.abs(dayFrac - 0.74) * 9, 0, 1);
      const night = 1 - day;
      const sunAngle = (dayFrac - 0.25) * Math.PI * 2;
      sun.position.set(Math.cos(sunAngle) * 300, Math.sin(sunAngle) * 300 + 40, 120);
      sun.intensity = 0.25 + day * 1.5 + golden * 0.5;
      sun.color.setHSL(0.09 - golden * 0.04, 0.55 + golden * 0.4, 0.55 + day * 0.15);
      hemi.intensity = 0.35 + day * 0.7;
      const sky = new THREE.Color().setHSL(0.6, 0.5, lerp(0.06, 0.55, day));
      sky.lerp(new THREE.Color(0xff7a2a), golden * 0.45);
      sceneRef.background = sky;
      sceneRef.fog.color.copy(sky);
      sceneRef.fog.near = 180 + day * 120;
      sceneRef.fog.far = 420 + day * 180;
      for (const m of windowMats) m.emissiveIntensity = night * 0.85;
      lampMat.emissiveIntensity = night * 1.6;
      for (const m of neonMats) m.color.setScalar(0.55 + night * 0.45 + golden * 0.2);
      water.material.opacity = 0.88 + night * 0.06;
      water.position.y = 0.15 + Math.sin(performance.now() * 0.0004) * 0.08;
    },
  };
}
