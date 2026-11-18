// Solmar City — the city itself: a sun-soaked bay city in the spirit of a
// modern Vice City, built entirely from procedural textures and primitives.
// Grid streets, pastel towers, neon storefronts, palm-lined beach, three
// piers, and a full day/night cycle. Nothing here is copied from any game.
import * as THREE from 'three';
import {
  clamp, lerp, rand, randInt, pick, mulberry32, canvasTexture, speckle,
  crackLines, boxGeo, cylGeo, stdMat, glassMat, glowTexture, glowSprite, neonSignTexture,
  makeStreak, hashNoise, PALETTE, V3,
} from './util.js';

export const ROAD_STEP = 44;
export const ROAD_HALF = 6;
export const ROADS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
export const CITY = 200; // playable half-extent; the bay sits west of x = -188

function roadTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#232327';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, '#000000', 0.05, 0.16, 2);
    speckle(ctx, w, h, 1200, '#5a5a60', 0.04, 0.1, 2);
    crackLines(ctx, w, h, 7);
    // Worn edge lines and a dashed centre line; the texture repeats along the road.
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#cfcabb';
    ctx.fillRect(6, 0, 3, h);
    ctx.fillRect(w - 9, 0, 3, h);
    ctx.fillStyle = '#d8b13a';
    ctx.fillRect(w / 2 - 4, 12, 8, 52);
    ctx.fillRect(w / 2 - 4, 140, 8, 52);
    ctx.globalAlpha = 1;
    // Oil stains and tyre-polish bands where wheels run.
    for (let i = 0; i < 10; i++) {
      ctx.globalAlpha = rand(0.05, 0.12);
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath();
      ctx.ellipse(rand(50, 200), rand(0, h), rand(14, 40), rand(6, 14), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

function sidewalkTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8f867a';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2200, '#6f675c', 0.05, 0.14, 2);
    speckle(ctx, w, h, 900, '#b5ac9c', 0.04, 0.1, 2);
    ctx.strokeStyle = 'rgba(60,54,46,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
    }
    crackLines(ctx, w, h, 4, '#4a443c');
  });
}

function sandTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, '#b89a62', 0.06, 0.16, 2);
    speckle(ctx, w, h, 1400, '#efe0b0', 0.05, 0.12, 2);
  });
}

function waterTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0d7d8f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180,240,255,0.35)';
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = rand(1, 2.5);
      ctx.beginPath();
      const y = rand(0, h);
      ctx.moveTo(rand(0, 40), y);
      ctx.bezierCurveTo(80, y + rand(-8, 8), 170, y + rand(-8, 8), 256, y + rand(-6, 6));
      ctx.stroke();
    }
    speckle(ctx, w, h, 500, '#ffffff', 0.03, 0.08, 2);
  }, { repeat: [8, 8] });
}

// A building facade: base tint, a grid of windows (some lit), a ground-floor
// storefront with glass and an awning. Returns { map, emissiveMap } so the
// windows can glow at night without repainting anything.
function facadeTextures(tint, seed, floors, cols, storefront) {
  const rng = mulberry32(seed);
  const map = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1500, '#000000', 0.03, 0.09, 2);
    speckle(ctx, w, h, 800, '#ffffff', 0.03, 0.08, 2);
    // Subtle horizontal floor bands.
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let f = 0; f < floors; f++) ctx.fillRect(0, (f * h) / floors, w, 3);
    const winW = (w - 24) / cols;
    const winH = (h * 0.86) / floors;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = 12 + c * winW + winW * 0.18;
        const y = 10 + f * winH + winH * 0.2;
        const ww = winW * 0.64;
        const hh = winH * 0.55;
        ctx.fillStyle = '#20262e';
        ctx.fillRect(x, y, ww, hh);
        ctx.fillStyle = 'rgba(140,190,220,0.35)';
        ctx.fillRect(x + 2, y + 2, ww - 4, hh * 0.45);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + hh * 0.45, ww, 2);
      }
    }
    if (storefront) {
      const y0 = h * 0.88;
      ctx.fillStyle = '#14161c';
      ctx.fillRect(0, y0, w, h - y0);
      ctx.fillStyle = 'rgba(120,200,230,0.5)';
      ctx.fillRect(10, y0 + 8, w - 20, (h - y0) * 0.55);
      ctx.fillStyle = pick(['#ff2e88', '#00b8a9', '#ffd319', '#ff6b35']);
      ctx.fillRect(0, y0 - 10, w, 12);
    }
  });
  const emissiveMap = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const winW = (w - 24) / cols;
    const winH = (h * 0.86) / floors;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.42) {
          const x = 12 + c * winW + winW * 0.18;
          const y = 10 + f * winH + winH * 0.2;
          ctx.fillStyle = rng() < 0.8 ? '#ffb45e' : '#9fdcff';
          ctx.fillRect(x, y, winW * 0.64, winH * 0.55);
        }
      }
    }
    if (storefront) {
      ctx.fillStyle = '#ffca7a';
      ctx.fillRect(10, h * 0.88 + 8, w - 20, (h - h * 0.88) * 0.55);
    }
  });
  return { map, emissiveMap };
}

const NEON_WORDS = [
  ['SOLMAR', '#ff2e88'], ['CASINO', '#ffd319'], ['NEON BAY', '#00e5ff'],
  ['HOTEL MIRAMAR', '#ff6b35'], ['PIER 9', '#39ff88'], ['CLUB AZUL', '#b967ff'],
  ['TACOS EL SOL', '#ffd319'], ['PALMS', '#00e5ff'], ['MOTEL', '#ff2e88'],
  ['DONUTS', '#ff6b35'], ['BAR LA LUNA', '#b967ff'], ['VICE VIDEO', '#39ff88'],
];

export function buildCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const parkSpots = [];
  const sidewalkSpots = [];
  const lampHeads = [];
  const neonMats = [];
  const windowMats = [];
  const streaks = [];
  const trafficLights = [];
  const clouds = [];
  let towerTop = null;

  const roadTex = roadTexture();
  const walkTex = sidewalkTexture();
  const roadMat = stdMat({ color: 0xffffff, map: roadTex, roughness: 0.55, metalness: 0.25 });
  const walkMat = stdMat({ color: 0xffffff, map: walkTex, roughness: 0.9 });
  const groundMat = stdMat({ color: 0x9a917f, roughness: 0.95 });
  const roofMat = stdMat({ color: 0x3a3a40, roughness: 0.9 });

  // Ground slab and the road ribbons with their sidewalks.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, -0.02, 0);
  ground.receiveShadow = true;
  group.add(ground);

  for (const r of ROADS) {
    for (const along of [true, false]) {
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 16);
      const roadMatHere = stdMat({ color: 0xffffff, map: tex, roughness: 0.5, metalness: 0.3 });
      roadMatHere.envMapIntensity = 0.35; // asphalt should stay dark, not mirror the sky
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 420),
        roadMatHere,
      );
      m.rotation.x = -Math.PI / 2;
      if (along) m.rotation.z = Math.PI / 2;
      // along=true: the ribbon runs east-west at z = r; along=false: it runs
      // north-south at x = r.
      m.position.set(along ? 0 : r, 0.02, along ? r : 0);
      m.receiveShadow = true;
      group.add(m);
      // Sidewalk strips on both sides of the road.
      for (const side of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(3, 420), walkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.rotation.z = along ? Math.PI / 2 : 0;
        sw.position.set(along ? 0 : r + side * 7.5, 0.05, along ? r + side * 7.5 : 0);
        sw.receiveShadow = true;
        group.add(sw);
      }
    }
  }

  // ---- Buildings -----------------------------------------------------------
  // Blocks between the roads get 1-4 towers each; taller toward the centre so
  // the skyline reads as a real downtown, with roof clutter on top.
  const blockCenters = [];
  for (let i = 0; i < 8; i++) blockCenters.push(-154 + i * ROAD_STEP);
  const rng = mulberry32(20261119);
  let neonIdx = 0;
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bx === 22 && bz === -22) continue; // Solmar Tower plaza
      const downtown = 1 - (Math.abs(bx) + Math.abs(bz)) / 360;
      const count = rng() < 0.45 ? 1 : rng() < 0.7 ? 2 : 4;
      for (let k = 0; k < count; k++) {
        const w = count === 1 ? rand(24, 30) : rand(12, 16);
        const d = count === 1 ? rand(24, 30) : rand(12, 16);
        const h = clamp(rand(9, 16) + downtown * rand(6, 42), 9, 58);
        const ox = count === 1 ? 0 : (k % 2 === 0 ? -8 : 8);
        const oz = count === 1 ? 0 : (k < 2 ? -8 : 8);
        const x = bx + ox;
        const z = bz + oz;
        const floors = Math.max(2, Math.round(h / 4.2));
        const cols = Math.max(3, Math.round(w / 4));
        const { map, emissiveMap } = facadeTextures(pick(PALETTE.buildingTints), randInt(1, 99999), floors, cols, h < 20 && rng() < 0.6);
        // Tile the facade so windows stay a real size on big towers instead of
        // stretching into a blank wall: roughly one texture tile per 14 m wide
        // and 18 m tall. Low buildings keep a single tile, so their ground
        // floor storefront stays at the bottom where it belongs.
        const repX = Math.max(1, Math.round(w / 14));
        const repY = Math.max(1, Math.round(h / 18));
        map.repeat.set(repX, repY);
        emissiveMap.repeat.set(repX, repY);
        const faceMat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.82, metalness: 0.05 });
        windowMats.push(faceMat);
        const mesh = new THREE.Mesh(boxGeo(w, h, d), [faceMat, faceMat, roofMat, roofMat, faceMat, faceMat]);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        // Roof clutter: AC boxes, a water tank, an antenna.
        if (rng() < 0.7) {
          const ac = new THREE.Mesh(boxGeo(2.4, 1.1, 1.8), stdMat({ color: 0x8a8f96, roughness: 0.7, metalness: 0.4 }));
          ac.position.set(x + rand(-w / 4, w / 4), h + 0.55, z + rand(-d / 4, d / 4));
          ac.castShadow = true;
          group.add(ac);
        }
        if (rng() < 0.35) {
          const tank = new THREE.Mesh(cylGeo(1.5, 1.5, 2.6, 10), stdMat({ color: 0x6b4f35, roughness: 0.85 }));
          tank.position.set(x + rand(-w / 4, w / 4), h + 1.3, z + rand(-d / 4, d / 4));
          tank.castShadow = true;
          group.add(tank);
        }
        // Neon sign on some low buildings, facing the street.
        if (h < 22 && rng() < 0.4 && neonIdx < NEON_WORDS.length) {
          const [word, color] = NEON_WORDS[neonIdx++];
          const tex = neonSignTexture(word, color);
          const signMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 });
          neonMats.push(signMat);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), signMat);
          sign.position.set(x, Math.min(h - 1.6, 9), z + d / 2 + 0.15);
          group.add(sign);
          const glow = glowSprite(color, 7, 0);
          glow.position.set(x, Math.min(h - 1.6, 9), z + d / 2 + 1.2);
          group.add(glow);
          lampHeads.push({ glow, base: 0.55 });
          const streak = makeStreak(color, 12, 2.2);
          streak.position.set(x, 0.06, z + d / 2 + 6);
          streak.material.opacity = 0;
          group.add(streak);
          streaks.push(streak);
        }
      }
      // Parked cars along the block edge, and sidewalk wander spots.
      for (let p = 0; p < 2; p++) {
        parkSpots.push({ x: bx + rand(-14, 14), z: bz + (rng() < 0.5 ? -7.6 : 7.6), angle: rng() < 0.5 ? 0 : Math.PI });
        parkSpots.push({ x: bx + (rng() < 0.5 ? -7.6 : 7.6), z: bz + rand(-14, 14), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
      }
      for (let s = 0; s < 3; s++) sidewalkSpots.push({ x: bx + rand(-16, 16), z: bz + rand(-16, 16) });
    }
  }

  // Solmar Tower: the landmark. Glass curtain tower on a plaza, spire on top.
  {
    const { map, emissiveMap } = facadeTextures('#7fb2c9', 777, 16, 8, false);
    const faceMat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.25, metalness: 0.55 });
    windowMats.push(faceMat);
    const tower = new THREE.Mesh(boxGeo(20, 72, 20), [faceMat, faceMat, roofMat, roofMat, faceMat, faceMat]);
    tower.position.set(22, 36, -22);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);
    colliders.push({ minX: 12, maxX: 32, minZ: -32, maxZ: -12 });
    const spire = new THREE.Mesh(cylGeo(0.5, 1.2, 14, 8), stdMat({ color: 0xdddddd, roughness: 0.4, metalness: 0.8 }));
    spire.position.set(22, 79, -22);
    group.add(spire);
    const beacon = glowSprite('#ff4444', 5, 0.9);
    beacon.position.set(22, 86, -22);
    group.add(beacon);
    towerTop = new THREE.Vector3(22, 86, -22);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), walkMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(22, 0.05, -22);
    plaza.receiveShadow = true;
    group.add(plaza);
  }

  // ---- Street furniture ----------------------------------------------------
  const lampPoleMat = stdMat({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffdf8a, emissiveIntensity: 0, roughness: 0.4 });
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      if (Math.abs(rx) > 176 || Math.abs(rz) > 176) continue;
      if ((rx + rz) % 88 !== 0) continue; // lamps at every other intersection
      for (const [dx, dz] of [[8.4, 8.4], [-8.4, -8.4]]) {
        const px = rx + dx;
        const pz = rz + dz;
        const pole = new THREE.Mesh(cylGeo(0.14, 0.18, 7, 8), lampPoleMat);
        pole.position.set(px, 3.5, pz);
        pole.castShadow = true;
        group.add(pole);
        const arm = new THREE.Mesh(boxGeo(2.2, 0.16, 0.16), lampPoleMat);
        arm.position.set(px - Math.sign(dx) * 1, 6.9, pz);
        group.add(arm);
        const head = new THREE.Mesh(boxGeo(0.9, 0.22, 0.4), lampHeadMat);
        head.position.set(px - Math.sign(dx) * 2, 6.85, pz);
        group.add(head);
        const glow = glowSprite('#ffd9a0', 6, 0);
        glow.position.set(px - Math.sign(dx) * 2, 6.7, pz);
        group.add(glow);
        lampHeads.push({ glow, base: 0.8 });
        const streak = makeStreak('#ffb45e', 9, 1.4);
        streak.position.set(px - Math.sign(dx) * 2, 0.06, pz);
        streak.material.opacity = 0;
        group.add(streak);
        streaks.push(streak);
      }
    }
  }

  // Traffic lights at the four busiest intersections, cycling green/amber/red.
  const lightPoleMat = stdMat({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
  for (const [ix, iz] of [[-44, -44], [44, 44], [-44, 88], [88, -44]]) {
    const pole = new THREE.Mesh(cylGeo(0.16, 0.2, 6.4, 8), lightPoleMat);
    pole.position.set(ix + 8.2, 3.2, iz + 8.2);
    pole.castShadow = true;
    group.add(pole);
    const housing = new THREE.Mesh(boxGeo(0.5, 1.5, 0.5), lightPoleMat);
    housing.position.set(ix + 8.2, 6.6, iz + 8.2);
    group.add(housing);
    const lamps = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: [0xff2222, 0xffaa00, 0x22ff66][i], emissiveIntensity: 0.15, roughness: 0.4 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m);
      bulb.position.set(ix + 8.2, 7.05 - i * 0.42, iz + 8.2 + 0.26);
      group.add(bulb);
      lamps.push(m);
    }
    trafficLights.push({ x: ix, z: iz, phase: rand(0, 8), lamps, nsGreen: true });
  }

  // Palm trees along the beach and the main avenues, plus benches and hydrants.
  const trunkMat = stdMat({ color: 0x7a5c38, roughness: 0.9 });
  const frondMat = stdMat({ color: 0x2f8f4e, roughness: 0.85, transparent: true, opacity: 0.95 });
  function palm(x, z, h = 7) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylGeo(0.16, 0.28, h, 7), trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = rand(-0.08, 0.08);
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), frondMat);
      const a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, h + 0.2, Math.sin(a) * 1.1);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      frond.rotation.y = -a;
      frond.castShadow = true;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let z = -176; z <= 176; z += 44) {
    palm(-186, z + 10, rand(6, 8));
    palm(-186, z - 12, rand(6, 8));
  }
  for (const [px, pz] of [[-40, 8], [8, -40], [48, 92], [92, 48], [-92, -92], [136, 8]]) palm(px, pz, rand(6, 8));
  const hydrantMat = stdMat({ color: 0xc22a1e, roughness: 0.5, metalness: 0.3 });
  for (const [hx, hz] of [[-36, 10], [10, 36], [52, -36], [-84, 52], [100, -84]]) {
    const hyd = new THREE.Mesh(cylGeo(0.28, 0.32, 0.8, 8), hydrantMat);
    hyd.position.set(hx, 0.4, hz);
    hyd.castShadow = true;
    group.add(hyd);
  }
  const benchMat = stdMat({ color: 0x6b4f2a, roughness: 0.85 });
  for (const [bx2, bz2] of [[-20, 8], [8, -20], [60, 8], [-60, -60]]) {
    const bench = new THREE.Mesh(boxGeo(2.2, 0.12, 0.7), benchMat);
    bench.position.set(bx2, 0.55, bz2);
    bench.castShadow = true;
    group.add(bench);
    for (const leg of [-0.9, 0.9]) {
      const l = new THREE.Mesh(boxGeo(0.12, 0.55, 0.6), lightPoleMat);
      l.position.set(bx2 + leg, 0.28, bz2);
      group.add(l);
    }
  }

  // ---- The bay: beach, piers, animated water ------------------------------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(26, 420), stdMat({ color: 0xffffff, map: sandTexture(), roughness: 0.95 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-199, 0.04, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const deckMat = stdMat({ color: 0x8a6a42, roughness: 0.85 });
  const pierLampMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffdf8a, emissiveIntensity: 0 });
  for (const pz of [-88, 0, 88]) {
    const deck = new THREE.Mesh(boxGeo(34, 0.5, 6), deckMat);
    deck.position.set(-206, 0.5, pz);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    for (let x = -222; x <= -192; x += 7.5) {
      const post = new THREE.Mesh(cylGeo(0.22, 0.22, 1.6, 7), deckMat);
      post.position.set(x, -0.3, pz + 2.6);
      group.add(post);
      const post2 = post.clone();
      post2.position.z = pz - 2.6;
      group.add(post2);
    }
    const end = new THREE.Mesh(boxGeo(8, 0.5, 12), deckMat);
    end.position.set(-224, 0.5, pz);
    end.castShadow = true;
    group.add(end);
    const pl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), pierLampMat);
    pl.position.set(-224, 3.4, pz + 4);
    group.add(pl);
    const pp = new THREE.Mesh(cylGeo(0.1, 0.12, 3.2, 7), lampPoleMat);
    pp.position.set(-224, 1.6, pz + 4);
    group.add(pp);
    const glow = glowSprite('#ffd9a0', 5, 0);
    glow.position.set(-224, 3.4, pz + 4);
    group.add(glow);
    lampHeads.push({ glow, base: 0.7 });
  }
  // Beach umbrellas.
  for (const [ux, uz, col] of [[-196, -40, 0xff2e88], [-196, 30, 0x00e5ff], [-196, 120, 0xffd319]]) {
    const pole = new THREE.Mesh(cylGeo(0.06, 0.06, 2.2, 6), stdMat({ color: 0xdddddd, roughness: 0.5 }));
    pole.position.set(ux, 1.1, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 8), stdMat({ color: col, roughness: 0.7 }));
    top.position.set(ux, 2.4, uz);
    top.castShadow = true;
    group.add(top);
  }

  const waterTex = waterTexture();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a9ab0, map: waterTex, roughness: 0.12, metalness: 0.35, envMapIntensity: 1.8, transparent: true, opacity: 0.94 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 560), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-340, 0.1, 0);
  group.add(water);

  // ---- Sky, sun, clouds ----------------------------------------------------
  const skyUniforms = {
    topColor: { value: new THREE.Color('#3d8fd1') },
    bottomColor: { value: new THREE.Color('#bfe3f0') },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color('#fff2cc') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(880, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor;
        void main(){
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 col = mix(bottomColor, topColor, pow(max(h, 0.0), 0.6));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 10.0) * 0.22);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff2cc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5e, 0.85);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xbfe3f0, 180, 720);

  // Environment map: a tiny painted equirect sky, baked once, so car paint,
  // glass and wet asphalt have something to reflect.
  {
    const envTex = canvasTexture(512, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2f7fc9');
      g.addColorStop(0.5, '#a8d8ee');
      g.addColorStop(0.62, '#e8d9b0');
      g.addColorStop(1, '#3a3230');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(150, 90, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(60, 150, 30, 8);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(320, 150, 30, 8);
      ctx.fillStyle = '#ffd319';
      ctx.fillRect(420, 150, 24, 8);
    }, { repeat: [1, 1] });
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;
  }

  const cloudTex = glowTexture('#ffffff');
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: rand(0.25, 0.5), depthWrite: false });
    const c = new THREE.Sprite(m);
    c.scale.set(rand(60, 130), rand(14, 26), 1);
    c.position.set(rand(-500, 500), rand(120, 220), rand(-500, 500));
    scene.add(c);
    clouds.push({ sprite: c, speed: rand(1, 3) });
  }

  // ---- Day / night ---------------------------------------------------------
  const DAY_LEN = 720; // one full day every 12 minutes
  const state = {
    hour: 13.5, colliders, parkSpots, sidewalkSpots, trafficLights,
    towerTop, water, waterTex, sun, hemi, sky, skyUniforms,
    lampHeads, neonMats, windowMats, streaks, clouds,
    update(dt, focus) {
      this.hour = (this.hour + (dt * 24) / DAY_LEN) % 24;
      const h = this.hour;
      const dayF = clamp(Math.sin(((h - 6) / 12) * Math.PI), 0, 1); // 1 at noon
      const duskF = clamp(1 - Math.abs(h - 18.6) / 1.4, 0, 1) + clamp(1 - Math.abs(h - 6.2) / 1.2, 0, 1);
      const nightF = 1 - clamp(dayF * 1.4 + duskF * 0.7, 0, 1);
      const az = ((h - 6) / 12) * Math.PI;
      const el = Math.sin(((h - 6) / 12) * Math.PI) * 1.1 + 0.08;
      const sunDir = V3(Math.cos(az) * 0.6, Math.max(el, -0.25), 0.55).normalize();
      skyUniforms.sunDir.value.copy(sunDir);
      sun.position.copy(focus).addScaledVector(sunDir, 320);
      sun.target.position.copy(focus);
      const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
      const top = lerpC('#060a1a', '#3d8fd1', dayF).lerp(lerpC('#060a1a', '#2c2a55', duskF), duskF);
      const bottom = lerpC('#0e1626', '#bfe3f0', dayF).lerp(lerpC('#0e1626', '#ff7e3d', duskF), duskF);
      skyUniforms.topColor.value.copy(top);
      skyUniforms.bottomColor.value.copy(bottom);
      skyUniforms.sunColor.value.copy(lerpC('#8899ff', '#fff2cc', dayF).lerp(lerpC('#8899ff', '#ff9a4d', duskF), duskF));
      sun.intensity = 0.25 + dayF * 2.5 + duskF * 0.9;
      sun.color.copy(lerpC('#7a8cff', '#fff2cc', dayF).lerp(lerpC('#7a8cff', '#ff9a4d', duskF), duskF));
      hemi.intensity = 0.2 + dayF * 0.45 + duskF * 0.2;
      hemi.color.copy(lerpC('#1a2440', '#bfd9ff', dayF));
      hemi.groundColor.copy(lerpC('#0c0e14', '#8a7a5e', dayF));
      scene.fog.color.copy(lerpC('#0b1220', '#bfe3f0', dayF).lerp(lerpC('#0b1220', '#e88a4d', duskF), duskF));
      scene.fog.near = 200 - nightF * 60;
      scene.fog.far = 760 - nightF * 220;
      for (const m of windowMats) m.emissiveIntensity = nightF * 1.15 + duskF * 0.5;
      for (const m of neonMats) m.emissiveIntensity = 0.25 + nightF * 1.6 + duskF * 0.7;
      for (const { glow, base } of lampHeads) glow.material.opacity = nightF * base + duskF * base * 0.5;
      for (const s of streaks) s.material.opacity = nightF * 0.5 + duskF * 0.25;
      waterMat.color.copy(lerpC('#0a3a4a', '#1a9ab0', dayF).lerp(lerpC('#0a3a4a', '#c96a3d', duskF), duskF));
      waterTex.offset.x += dt * 0.008;
      waterTex.offset.y += dt * 0.005;
      for (const c of clouds) {
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > 560) c.sprite.position.x = -560;
        c.sprite.material.color.copy(lerpC('#2a3450', '#ffffff', dayF).lerp(lerpC('#2a3450', '#ff9a7a', duskF), duskF));
        c.sprite.material.opacity = 0.14 + dayF * 0.3;
      }
      // Traffic lights cycle: 6 s green, 1.5 s amber, 6 s red per direction.
      for (const tl of trafficLights) {
        tl.phase = (tl.phase + dt) % 15;
        const ns = tl.phase < 6;
        const amber = tl.phase >= 6 && tl.phase < 7.5;
        tl.nsGreen = ns;
        tl.lamps[0].emissiveIntensity = !ns && !amber ? 1.6 : 0.12;
        tl.lamps[1].emissiveIntensity = amber ? 1.8 : 0.12;
        tl.lamps[2].emissiveIntensity = ns ? 1.6 : 0.12;
      }
      return { dayF, duskF, nightF };
    },
    setHour(h) { this.hour = h; },
    isNight() { return this.hour < 5.6 || this.hour > 18.8; },
  };

  function collides(x, z, r) {
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
    }
    return null;
  }
  function resolveCircle(p, r) {
    const c = collides(p.x, p.z, r);
    if (!c) return;
    const pushL = p.x - (c.minX - r);
    const pushR = c.maxX + r - p.x;
    const pushU = p.z - (c.minZ - r);
    const pushD = c.maxZ + r - p.z;
    const m = Math.min(pushL, pushR, pushU, pushD);
    if (m === pushL) p.x = c.minX - r;
    else if (m === pushR) p.x = c.maxX + r;
    else if (m === pushU) p.z = c.minZ - r;
    else p.z = c.maxZ + r;
  }
  function clampToCity(p) {
    p.x = clamp(p.x, -212, 198);
    p.z = clamp(p.z, -198, 198);
  }
  return { ...state, collides, resolveCircle, clampToCity, group };
}
