// Solmar City — the city itself: grid roads, buildings, waterfront, palms,
// streetlights, neon signs, and the day/night lighting rig.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, makeRng } from './util.js';

export const BLOCK = 52;          // distance between road centres
export const ROAD_W = 14;         // road width
export const GRID = 4;            // roads at -4..4 * BLOCK
export const CITY_R = GRID * BLOCK + 30; // ~238

const PALETTE = [0xd8a06a, 0xc98f7a, 0x9fb4c7, 0xe0cfa8, 0xb7a6d6, 0x8fb8a0, 0xd6d6d6, 0xe8b4b8, 0x7fa8c9, 0xf0d9a0];
const NEON_WORDS = ['SOLMAR', 'HOTEL', 'BAR', 'PIER 9', 'TAXI', 'CLUB NEON', 'DINER', 'CASINO', 'SURF', '24H'];

function windowTexture(rng, base, litRatio) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) for (let x = 6; x < 58; x += 12) {
    const lit = rng() < litRatio;
    g.fillStyle = lit ? '#ffe9a8' : '#20242e';
    g.fillRect(x, y, 8, 9);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function neonTexture(word, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#101018'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
  g.fillText(word, 128, 34);
  g.shadowBlur = 4; g.fillStyle = '#ffffff'; g.fillText(word, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.group = new THREE.Group();
    this.colliders = [];   // {minX,maxX,minZ,maxZ}
    this.neonMats = [];
    this.lampMats = [];
    this.buildings = [];
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBuildings();
    this.buildWaterfront();
    this.buildPalmsAndLights();
    // Sun + sky rig
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -260; this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260; this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 700;
    scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget); this.sun.target = this.sunTarget;
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f26, 0.9);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fb0ff, 0.0);
    this.moon.position.set(-80, 140, -100);
    scene.add(this.moon);
    this.night = 0; // 0 = day, 1 = night
  }

  buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_R * 2 + 320, CITY_R * 2 + 320),
      new THREE.MeshLambertMaterial({ color: 0x5d6b52 }));
    g.rotation.x = -Math.PI / 2; g.position.set(-120, -0.05, 0);
    g.receiveShadow = true;
    this.group.add(g);
    // Bay water (west side)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(320, CITY_R * 2 + 320),
      new THREE.MeshPhongMaterial({ color: 0x14506e, shininess: 120, specular: 0x88bbdd }));
    water.rotation.x = -Math.PI / 2; water.position.set(-CITY_R - 160, 0.1, 0);
    water.name = 'water';
    this.group.add(water);
    this.water = water;
    // Beach strip
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(26, CITY_R * 2),
      new THREE.MeshLambertMaterial({ color: 0xe0c98f }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(-CITY_R - 13, 0.02, 0);
    beach.receiveShadow = true;
    this.group.add(beach);
  }

  buildRoads() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x41464f });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0x8d8578 });
    for (let i = -GRID; i <= GRID; i++) {
      const c = i * BLOCK;
      const roadX = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_R * 2), mat);
      roadX.rotation.x = -Math.PI / 2; roadX.position.set(c, 0.06, 0); roadX.receiveShadow = true;
      this.group.add(roadX);
      const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2, ROAD_W), mat);
      roadZ.rotation.x = -Math.PI / 2; roadZ.position.set(0, 0.06, c); roadZ.receiveShadow = true;
      this.group.add(roadZ);
      // centre dashes
      for (let d = -CITY_R; d < CITY_R; d += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), lineMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.09, d);
        this.group.add(dash);
        const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), lineMat);
        dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.09, c);
        this.group.add(dash2);
      }
      // sidewalks
      const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 8, CITY_R * 2), walkMat);
      sw1.rotation.x = -Math.PI / 2; sw1.position.set(c, 0.03, 0);
      this.group.add(sw1);
      const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2, ROAD_W + 8), walkMat);
      sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, 0.03, c);
      this.group.add(sw2);
    }
  }

  buildBuildings() {
    const rng = this.rng;
    const texes = PALETTE.slice(0, 5).map((c) => {
      const hex = '#' + c.toString(16).padStart(6, '0');
      return windowTexture(rng, hex, 0.45);
    });
    for (let ix = -GRID; ix < GRID; ix++) {
      for (let iz = -GRID; iz < GRID; iz++) {
        const bx = ix * BLOCK + BLOCK / 2, bz = iz * BLOCK + BLOCK / 2;
        // waterfront blocks on the west edge stay open (beach / pier plaza)
        if (ix === -GRID) continue;
        // the (0,0) block is the Solmar Tower plaza
        if (ix === 0 && iz === 0) continue;
        // the (0,1) block is Palm Row plaza: Rook's spawn and starter car
        if (ix === 0 && iz === 1) continue;
        const n = randInt(1, 3);
        for (let k = 0; k < n; k++) {
          // buildings stay inside the block interior, clear of roads/sidewalks
          const w = rand(12, 20), d = rand(12, 20), h = rand(9, 58);
          const px = bx + rand(-4, 4), pz = bz + rand(-4, 4);
          const tex = pick(texes);
          const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15 });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(px, h / 2, pz);
          b.castShadow = true; b.receiveShadow = true;
          this.group.add(b);
          this.buildings.push(b);
          this.colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
          // roof trim
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1),
            new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
          roof.position.set(px, h + 0.4, pz);
          this.group.add(roof);
          // neon sign on some buildings
          if (rng() < 0.4 && h > 14) {
            const word = pick(NEON_WORDS);
            const color = pick(['#ff4fd8', '#38e1ff', '#ffe14d', '#7dff6a', '#ff7a3c']);
            const nmat = new THREE.MeshBasicMaterial({ map: neonTexture(word, color), transparent: true });
            nmat.userData.neon = true;
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), nmat);
            sign.position.set(px, Math.min(h - 3, 22), pz + d / 2 + 0.15);
            this.group.add(sign);
            this.neonMats.push(nmat);
          }
        }
      }
    }
    // Landmark: the Solmar Tower on the (0,0) block plaza
    const towerTex = windowTexture(rng, '#7fa8c9', 0.6);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(30, 96, 30),
      new THREE.MeshLambertMaterial({ map: towerTex, emissive: 0xffffff, emissiveMap: towerTex, emissiveIntensity: 0.2 }));
    tower.position.set(26, 48, 26); tower.castShadow = true;
    this.group.add(tower);
    this.buildings.push(tower);
    this.colliders.push({ minX: 11, maxX: 41, minZ: 11, maxZ: 41 });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8 }));
    beacon.position.set(26, 100, 26);
    this.group.add(beacon);
  }

  buildWaterfront() {
    // Three piers jutting into the bay, with posts and lamps
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    for (const z of [-104, 0, 104]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 10), pierMat);
      pier.position.set(-CITY_R - 30, 0.8, z);
      pier.castShadow = true; pier.receiveShadow = true;
      this.group.add(pier);
      for (let x = -CITY_R - 55; x < -CITY_R - 5; x += 12) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
          new THREE.MeshLambertMaterial({ color: 0x5a4028 }));
        post.position.set(x, 0.2, z + 5);
        this.group.add(post);
      }
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), lampMat);
      lamp.position.set(-CITY_R - 56, 4.4, z);
      this.group.add(lamp);
      this.lampMats.push(lampMat);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      pole.position.set(-CITY_R - 56, 2.2, z);
      this.group.add(pole);
    }
  }

  buildPalmsAndLights() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    for (let i = 0; i < 90; i++) {
      // palms along sidewalks and the beach
      const onBeach = rng() < 0.3;
      let x, z;
      if (onBeach) { x = rand(-CITY_R - 22, -CITY_R - 2); z = rand(-CITY_R, CITY_R); }
      else {
        const road = randInt(-GRID, GRID) * BLOCK;
        const along = rand(-CITY_R, CITY_R);
        if (rng() < 0.5) { x = road + pick([-11, 11]); z = along; }
        else { x = along; z = road + pick([-11, 11]); }
      }
      const h = rand(5, 8);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
      trunk.position.set(x, h / 2, z);
      trunk.castShadow = true;
      this.group.add(trunk);
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 5), leafMat);
        const a = (k / 5) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.1, h + 0.6, z + Math.sin(a) * 1.1);
        leaf.rotation.z = Math.cos(a) * 0.9;
        leaf.rotation.x = -Math.sin(a) * 0.9;
        this.group.add(leaf);
      }
    }
    // Streetlights along roads
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    for (let i = -GRID; i <= GRID; i++) {
      for (let d = -CITY_R + 20; d < CITY_R; d += 52) {
        const lm = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), lm);
        lamp.position.set(i * BLOCK + 8, 6.4, d);
        this.group.add(lamp);
        this.lampMats.push(lm);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.5, 6), poleMat);
        pole.position.set(i * BLOCK + 8, 3.2, d);
        this.group.add(pole);
      }
    }
  }

  // ---- queries used by gameplay ----
  isOnRoad(x, z) {
    const rx = ((x % BLOCK) + BLOCK) % BLOCK, rz = ((z % BLOCK) + BLOCK) % BLOCK;
    return Math.min(rx, BLOCK - rx) < ROAD_W / 2 + 2 || Math.min(rz, BLOCK - rz) < ROAD_W / 2 + 2;
  }
  nearestRoadPoint(x, z) {
    // snap to the closest road centre line
    const snap = (v) => Math.round(v / BLOCK) * BLOCK;
    const dx = Math.abs(x - snap(x)), dz = Math.abs(z - snap(z));
    return dx < dz ? { x: snap(x), z } : { x, z: snap(z) };
  }
  collideCircle(x, z, r) {
    // Push a circle out of building AABBs; returns corrected {x, z}
    for (const c of this.colliders) {
      const cx = clamp(x, c.minX, c.maxX), cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; z = cz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest penetration
          const pl = x - (c.minX - r), pr = (c.maxX + r) - x;
          const pt = z - (c.minZ - r), pb = (c.maxZ + r) - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
        }
      }
    }
    x = clamp(x, -CITY_R - 40, CITY_R + 20);
    z = clamp(z, -CITY_R - 20, CITY_R + 20);
    return { x, z };
  }
  inWater(x, z) { return x < -CITY_R - 2; }

  // ---- day / night ----
  // timeOfDay in hours 0..24. Returns nothing; mutates lights/sky.
  updateLighting(timeOfDay) {
    const t = timeOfDay;
    // sun elevation: peaks at noon, below horizon 19:00..06:00
    const sunAngle = ((t - 6) / 12) * Math.PI; // 0 at 6:00, PI at 18:00
    const elev = Math.sin(sunAngle);
    const dayF = clamp(elev * 2.2, 0, 1);
    const duskF = clamp(1 - Math.abs(elev) * 3, 0, 1) * (t > 6 && t < 20 ? 1 : 0);
    this.night = 1 - dayF;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x0b1026), new THREE.Color(0x87b5e0), dayF);
    if (duskF > 0.2) sky.lerp(new THREE.Color(0xff8c4a), duskF * 0.45);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky.getHex(), 180, 620);
    this.sun.intensity = 0.4 + dayF * 2.1;
    this.sun.color.setHex(duskF > 0.3 ? 0xffb070 : 0xfff2d8);
    const az = sunAngle * 0.9;
    this.sun.position.set(Math.cos(az) * 200, Math.max(20, elev * 220), 80);
    this.moon.intensity = this.night * 0.5;
    this.hemi.intensity = 0.45 + dayF * 0.65;
    // neon signs are unlit MeshBasicMaterial: they already glow; lamps switch on at night
    for (const m of this.lampMats) { m.color.setHex(this.night > 0.4 ? 0xffe9a8 : 0x8a8578); }
    // building window glow at night
    for (const b of this.buildings) b.material.emissiveIntensity = 0.12 + this.night * 0.55;
    if (this.water) this.water.material.color.setHex(this.night > 0.5 ? 0x0a2438 : 0x14506e);
  }
}

