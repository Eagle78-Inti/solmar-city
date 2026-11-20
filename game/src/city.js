// city.js — Solmar City itself: the road grid, seven districts, buildings,
// palms, streetlights, neon, the beach, the bay and the marina piers.

import * as THREE from 'three';
import { DISTRICTS, G } from './state.js';
import { gfx } from './graphics.js';
import { clamp, makeRng, paintNeon, pick, randRange } from './util.js';

/** Road centrelines: avenues run north-south, streets east-west. */
export const AVENUES = [-280, -224, -168, -112, -56, 0, 56, 112, 168, 224, 280];
export const STREETS = [-224, -168, -112, -56, 0, 56, 112, 168, 224];
export const ROAD_W = 14;
export const WALK_W = 4;

export const city = {
  group: null,
  buildings: [],
  streetlights: [],
  neons: [],
  water: null,
  helipad: null,
  colliders: [], // {x0,z0,x1,z1} solid building footprints
};

/** True when a ground point sits on a road or sidewalk band. */
export function onRoad(x, z) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2 + WALK_W) return true;
  for (const sz of STREETS) if (Math.abs(z - sz) <= ROAD_W / 2 + WALK_W) return true;
  return false;
}

/** True when a ground point is inside a solid building footprint. */
export function insideBuilding(x, z) {
  for (const c of city.colliders) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
  }
  return false;
}

/** Build the whole city into the scene. */
export function initCity() {
  const scene = gfx.scene;
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  city.group = group;
  const rng = makeRng(987654);
  buildGround();
  buildRoads();
  buildBuildings(rng);
  buildPalms(rng);
  buildStreetlights();
  buildTrafficLights();
  buildSigns();
  buildBeachAndBay(rng);
  buildHelipad();
  buildLandmarks();
  return city;
}

/** Base ground: a big concrete slab under the whole city. */
function buildGround() {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(680, 560),
    new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.95 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.position.set(0, 0, 0);
  g.receiveShadow = true;
  city.group.add(g);
}

/** Road strips (asphalt) with sidewalk bands beside them. */
function buildRoads() {
  const tex = gfx.textures.asphalt;
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  roadMat.map.repeat.set(1, 1);
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.95 });
  // Avenues: north-south strips.
  for (const ax of AVENUES) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 460), roadMat.clone());
    road.material.map = tex.clone();
    road.material.map.repeat.set(1, 16);
    road.material.map.needsUpdate = true;
    road.rotation.x = -Math.PI / 2;
    road.position.set(ax, 0.03, 0);
    road.receiveShadow = true;
    city.group.add(road);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(WALK_W, 460), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(ax + side * (ROAD_W / 2 + WALK_W / 2), 0.02, 0);
      walk.receiveShadow = true;
      city.group.add(walk);
    }
  }
  // Streets: east-west strips.
  for (const sz of STREETS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(580, ROAD_W), roadMat.clone());
    road.material.map = tex.clone();
    road.material.map.repeat.set(20, 1);
    road.material.map.needsUpdate = true;
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.035, sz);
    road.receiveShadow = true;
    city.group.add(road);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(580, WALK_W), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.025, sz + side * (ROAD_W / 2 + WALK_W / 2));
      walk.receiveShadow = true;
      city.group.add(walk);
    }
  }
}

/** One building box with a textured facade and a dark roof. */
function addBuilding(cx, cz, w, d, h, tex, rng) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
  const mats = [mat, mat, roofMat, roofMat, mat, mat];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  city.group.add(mesh);
  city.buildings.push(mesh);
  city.colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
  // A rooftop box (AC unit / stair house) for silhouette variety.
  if (rng() < 0.6) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, 2.2, d * 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.95 }),
    );
    box.position.set(cx + w * 0.18, h + 1.1, cz - d * 0.15);
    box.castShadow = true;
    city.group.add(box);
  }
  return mesh;
}

/** Fill every block with buildings, by district style. */
function buildBuildings(rng) {
  const t = gfx.textures;
  const facades = [t.facadeCream, t.facadePink, t.facadeBlue, t.facadeDark, t.facadeGold];
  // Blocks sit between neighbouring avenues and streets.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + WALK_W;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - WALK_W;
      const z0 = STREETS[si] + ROAD_W / 2 + WALK_W;
      const z1 = STREETS[si + 1] - ROAD_W / 2 - WALK_W;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const bw = x1 - x0;
      const bd = z1 - z0;
      // The helipad block stays open (see buildHelipad).
      if (cx > -280 && cx < -224 && cz > 28 && cz < 84) continue;
      // The shop, garage and bank blocks get their landmark buildings instead.
      if (cx > 56 && cx < 112 && cz > -56 && cz < 0) continue;
      if (cx > -112 && cx < -56 && cz > 112 && cz < 168) continue;
      if (cx > 0 && cx < 56 && cz > -56 && cz < 0) continue;
      const d = DISTRICTS.find((dd) => cx >= dd.x0 && cx < dd.x1 && cz >= dd.z0 && cz < dd.z1);
      const style = d ? d.style : 'towers';
      const n = style === 'suburb' ? 2 : style === 'towers' ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = bw / n - 4;
        const dd2 = bd - 6;
        const px = x0 + (bw / n) * (i + 0.5);
        let h;
        if (style === 'towers') h = randRange(rng, 28, 68);
        else if (style === 'neon') h = randRange(rng, 16, 46);
        else if (style === 'marina') h = randRange(rng, 10, 24);
        else if (style === 'brick') h = randRange(rng, 8, 18);
        else if (style === 'suburb') h = randRange(rng, 6, 11);
        else h = randRange(rng, 8, 15);
        const tex = style === 'brick' ? (rng() < 0.6 ? t.brick : t.brick2) : pick(rng, facades);
        const m = addBuilding(px, cz, w, dd2, h, tex, rng);
        // Scale the facade texture to the building's height.
        if (m.material[0].map) {
          m.material[0].map = tex.clone();
          m.material[0].map.repeat.set(Math.max(1, Math.round(w / 22)), Math.max(1, Math.round(h / 26)));
          m.material[0].map.needsUpdate = true;
        }
      }
    }
  }
}

/** A low-poly palm: curved trunk, radial fronds, coconuts. */
export function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 7), trunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = (rng() - 0.5) * 0.12;
  trunk.castShadow = true;
  palm.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.9, side: THREE.DoubleSide });
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.4), frondMat);
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
    frond.position.set(Math.cos(a) * 1.2, 7.1, Math.sin(a) * 1.2);
    frond.rotation.y = -a;
    frond.rotation.x = 0.55 + rng() * 0.2;
    frond.castShadow = true;
    palm.add(frond);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }),
  );
  nut.position.set(0.3, 6.8, 0.2);
  palm.add(nut);
  return palm;
}

/** Palms along the beach, the marina and Neon Mile. */
function buildPalms(rng) {
  const spots = [];
  for (let z = -200; z <= 200; z += 28) {
    spots.push([-292 + (rng() - 0.5) * 8, z + (rng() - 0.5) * 10]);
    spots.push([-306 + (rng() - 0.5) * 6, z + 14 + (rng() - 0.5) * 8]);
  }
  for (let x = -260; x <= 260; x += 56) {
    if (rng() < 0.5) spots.push([x + (rng() - 0.5) * 20, 100 + (rng() - 0.5) * 8]);
    if (rng() < 0.5) spots.push([x + (rng() - 0.5) * 20, -100 + (rng() - 0.5) * 8]);
  }
  for (const [x, z] of spots) {
    const palm = makePalm(rng);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * Math.PI * 2;
    city.group.add(palm);
  }
}

/** Streetlights on every other corner; lamps glow at night. */
function buildStreetlights() {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd98a, emissiveIntensity: 0.25 });
  for (const ax of AVENUES) {
    for (const sz of STREETS) {
      if ((ax + sz) % 112 !== 0) continue;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.y = 3.5;
      pole.castShadow = true;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), poleMat);
      arm.position.set(1.1, 6.9, 0);
      g.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampMat.clone());
      lamp.position.set(2.2, 6.8, 0);
      g.add(lamp);
      city.streetlights.push(lamp);
      g.position.set(ax + 12, 0, sz + 12);
      g.rotation.y = Math.PI / 4;
      city.group.add(g);
    }
  }
}

/** Traffic lights at four big intersections, cycling red/yellow/green. */
function buildTrafficLights() {
  city.trafficLights = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.5 });
  for (const [ax, sz] of [[0, 0], [112, 56], [-112, -56], [56, 112]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), poleMat);
    pole.position.y = 3.2;
    pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.5), poleMat);
    head.position.set(0, 6.6, 0);
    g.add(head);
    const mk = (color, y) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 6),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
      );
      m.position.set(0, y, 0.28);
      g.add(m);
      return m;
    };
    const lights = { red: mk(0xff2222, 7.3), yellow: mk(0xffd23e, 6.6), green: mk(0x22dd44, 5.9) };
    city.trafficLights.push(lights);
    g.position.set(ax + 11, 0, sz - 11);
    city.group.add(g);
  }
}

/** Neon signs on Neon Mile, the shop, the garage and the hotel. */
function buildSigns() {
  const t = gfx.textures;
  const spots = [
    { tex: t.neonNeon, x: 200, y: 26, z: -40, ry: -Math.PI / 2 },
    { tex: t.neonCasino, x: 240, y: 20, z: 60, ry: -Math.PI / 2 },
    { tex: t.neonPalms, x: 190, y: 18, z: 140, ry: Math.PI },
    { tex: t.neonHotel, x: 40, y: 30, z: -100, ry: 0 },
    { tex: t.neonAmmu, x: 66, y: 7, z: -48, ry: -Math.PI / 2 },
    { tex: t.neonGarage, x: -66, y: 7, z: 130, ry: Math.PI / 2 },
  ];
  for (const s of spots) {
    const mat = new THREE.MeshBasicMaterial({ map: s.tex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = s.ry;
    city.group.add(sign);
    city.neons.push(sign);
  }
}

/** The beach, the bay water and the two marina piers. */
function buildBeachAndBay(rng) {
  const t = gfx.textures;
  // Sand strip along the west edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 460),
    new THREE.MeshStandardMaterial({ map: t.sand, roughness: 1 }),
  );
  sand.material.map.repeat.set(2, 20);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-301, 0.015, 0);
  sand.receiveShadow = true;
  city.group.add(sand);
  // Bay water west of the beach.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 700),
    new THREE.MeshStandardMaterial({ color: 0x1a5a8a, roughness: 0.22, metalness: 0.55, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-470, 0.05, 0);
  city.group.add(water);
  city.water = water;
  // Beach umbrellas and towels so the foot shot is busy.
  const umbCols = [0xff5a7a, 0x3ec6ff, 0xffd23e, 0x7dff6a];
  for (let i = 0; i < 10; i++) {
    const ux = -312 + rng() * 22;
    const uz = -190 + rng() * 380;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8 }),
    );
    pole.position.set(ux, 1.2, uz);
    city.group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: umbCols[i % umbCols.length], roughness: 0.85 }),
    );
    top.position.set(ux, 2.9, uz);
    top.castShadow = true;
    city.group.add(top);
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.9),
      new THREE.MeshStandardMaterial({ color: umbCols[(i + 2) % umbCols.length], roughness: 0.95 }),
    );
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = rng() * Math.PI;
    towel.position.set(ux + 2.5, 0.06, uz + 1);
    city.group.add(towel);
  }
  // Marta's Loft, the safehouse: a small beach house on the sand.
  const loft = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5, 7),
    new THREE.MeshStandardMaterial({ map: gfx.textures.facadePink, roughness: 0.85 }),
  );
  loft.position.set(-292, 2.5, 90);
  loft.castShadow = true;
  loft.receiveShadow = true;
  city.group.add(loft);
  city.colliders.push({ x0: -296.5, z0: 86.5, x1: -287.5, z1: 93.5 });
  const loftSign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(paintNeon(512, 128, "MARTA'S LOFT", '#ff5ad0', rng)) }),
  );
  loftSign.position.set(-292, 6.2, 86.4);
  loftSign.rotation.y = 0;
  city.group.add(loftSign);
  city.neons.push(loftSign);
  // Two wooden piers reaching into the bay.
  for (const pz of [-20, -120]) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(52, 0.6, 9),
      new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 0.95 }),
    );
    deck.position.set(-306, 0.9, pz);
    deck.castShadow = true;
    deck.receiveShadow = true;
    city.group.add(deck);
    for (let px = -326; px <= -284; px += 10) {
      for (const off of [-3.6, 3.6]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.95 }),
        );
        post.position.set(px, 0, pz + off);
        city.group.add(post);
      }
    }
  }
}

/** The helipad plaza: open block with a marked pad. */
function buildHelipad() {
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-252, 0.06, 56);
  pad.receiveShadow = true;
  city.group.add(pad);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(9.4, 10.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-252, 0.08, 56);
  city.group.add(ring);
  const hBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.1, 7),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  hBar.position.set(-252, 0.09, 56);
  city.group.add(hBar);
  const hBar2 = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.1, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  hBar2.position.set(-252, 0.09, 56);
  city.group.add(hBar2);
  city.helipad = { x: -252, z: 56 };
}

/** Landmark buildings: Ammu-Nation shop, Sunset Garage, Solmar Bank. */
function buildLandmarks() {
  const rng = makeRng(555);
  const t = gfx.textures;
  // Ammu-Nation: east of the x=56 road at z=-48, door on the road.
  addBuilding(84, -28, 30, 30, 9, t.brick, rng);
  // Sunset Garage: west of the x=-56 road at z=130.
  const garage = addBuilding(-84, 140, 30, 30, 8, t.brick2, rng);
  garage.material[0].map = t.brick2;
  // Solmar Bank (the vault): east of the x=0 road at z=-28.
  addBuilding(28, -28, 30, 30, 14, t.facadeGold, rng);
}

/** Per-frame city life: water shimmer, neon flicker, lamps at night. */
export function updateCity(dt, timeNow) {
  if (city.water) {
    city.water.position.y = 0.05 + Math.sin(timeNow * 0.7) * 0.06;
  }
  const night = timeNow < 6 || timeNow >= 19.5;
  for (const lamp of city.streetlights) {
    lamp.material.emissiveIntensity = night ? 1.6 : 0.25;
  }
  for (let i = 0; i < city.neons.length; i++) {
    const n = city.neons[i];
    n.material.opacity = 0.92 + Math.sin(timeNow * 3 + i * 1.7) * 0.08;
    n.material.transparent = true;
  }
  // Traffic lights cycle on a 12-second loop (green 5, yellow 1, red 6).
  if (city.trafficLights) {
    const phase = (performance.now() / 1000) % 12;
    for (const l of city.trafficLights) {
      l.green.material.emissiveIntensity = phase < 5 ? 1.8 : 0.12;
      l.yellow.material.emissiveIntensity = phase >= 5 && phase < 6 ? 1.8 : 0.12;
      l.red.material.emissiveIntensity = phase >= 6 ? 1.8 : 0.12;
    }
  }
  void dt;
}
