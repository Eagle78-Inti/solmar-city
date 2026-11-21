// city.js — builds Solmar City: districts, buildings, roads, signs, props.
// Every dynamic object is added to the scene here or by its own module.
import * as THREE from 'three';
import { clamp, rand, randi, pick, mixHex } from './util.js';
import { brickTex, windowsTex, asphaltTex, neonSignTex, sandTex, waterTex, makeWetSheen } from './graphics.js';

const BRICKS = ['#7a3b2e', '#8a4a35', '#5e3a4a', '#6b4a2f', '#4a3a5e', '#3e5a6b'];
const NEONS = ['#ff2ea6', '#22e6ff', '#ffb02e', '#7dff5a', '#ff5a3c'];

export function buildCity(scene, G) {
  const city = { buildings: [], signs: [], lamps: [], props: [], wetSheen: null, boats: [], palms: [] };

  // Ground: big asphalt base + sand beach + water bay to the west.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 520),
    new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.9, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 220),
    new THREE.MeshStandardMaterial({ map: sandTex(), roughness: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-225, 0.04, 130);
  beach.receiveShadow = true;
  scene.add(beach);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 520),
    new THREE.MeshStandardMaterial({ map: waterTex(), roughness: 0.35, metalness: 0.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-420, 0.02, 0);
  water.receiveShadow = true;
  scene.add(water);

  city.wetSheen = makeWetSheen();
  scene.add(city.wetSheen);

  // Roads: darker strips along the block grid.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.85 });
  for (let x = -280; x <= 280; x += 80) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(14, 520), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0);
    r.receiveShadow = true; scene.add(r);
  }
  for (let z = -200; z <= 200; z += 80) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(700, 14), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z);
    r.receiveShadow = true; scene.add(r);
  }

  // Buildings: per-district blocks with lit-window facades.
  const winA = windowsTex('#2a2430', 0.5);
  const winB = windowsTex('#33262a', 0.62);
  const winC = windowsTex('#232c3a', 0.4);
  for (const d of G.districts) {
    const count = d.name === 'Kumala Beach' ? 5 : 11;
    for (let i = 0; i < count; i++) {
      const bx = d.cx + rand(-d.w / 2 + 22, d.w / 2 - 22);
      const bz = d.cz + rand(-d.h / 2 + 18, d.h / 2 - 18);
      if (Math.abs(bx % 80) < 12 || Math.abs(bz % 80) < 12) continue; // keep roads clear
      const w = rand(16, 30), dep = rand(14, 24), h = rand(14, 64);
      const brick = brickTex(pick(BRICKS), '#1c1410');
      const mats = [
        new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: pick([winA, winB, winC]), roughness: 0.7, emissive: 0x554411, emissiveIntensity: 0.9 }),
        new THREE.MeshStandardMaterial({ map: pick([winA, winB, winC]), roughness: 0.7, emissive: 0x554411, emissiveIntensity: 0.9 }),
        new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85 }),
      ];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mats);
      b.position.set(bx, h / 2, bz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      city.buildings.push(b);
      // Roof neon strip on taller towers.
      if (h > 40) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, dep + 0.6),
          new THREE.MeshStandardMaterial({ color: 0x111111, emissive: pick(NEONS), emissiveIntensity: 2.2 }));
        strip.position.set(bx, h + 0.3, bz);
        scene.add(strip);
      }
    }
  }

  // Readable shop signs (canvas textures, emissive so they glow at night).
  function sign(text, color, x, z, y, w, ry) {
    const tex = neonSignTex(text, color, '#120a18');
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1, transparent: true }));
    s.position.set(x, y, z);
    s.rotation.y = ry || 0;
    scene.add(s); city.signs.push(s);
    return s;
  }
  sign('KELO ARMS', '#ff2ea6', 56, -44, 7, 26);
  sign('SUNSET GARAGE', '#22e6ff', -56, 126, 6, 30);
  sign('CAFE PALM', '#ffb02e', -120, 150, 6, 22, 0.6);
  sign('NEON MILE', '#ff5a3c', 120, -6, 9, 34);
  sign('HOTEL CORAL', '#7dff5a', -180, 90, 8, 26, -0.5);
  sign('TOMO LOFT', '#ff2ea6', 56, 88, 6, 22);
  sign('PIER 9', '#22e6ff', -300, -116, 6, 20, 1.57);
  sign('HELIPAD', '#ffb02e', -238, 64, 5, 18, 1.57);

  // Street lamps with warm pools of light.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 2.5 });
  for (let x = -280; x <= 280; x += 80) {
    for (let z = -200; z <= 200; z += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), lampMat);
      pole.position.set(x + 8, 3.5, z + 8);
      pole.castShadow = true;
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bulbMat);
      bulb.position.set(x + 8, 7.2, z + 8);
      scene.add(bulb);
      city.lamps.push(pole);
    }
  }
  // Traffic lights at the main intersections.
  const tlRed = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2211, emissiveIntensity: 2 });
  const tlGreen = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22ff66, emissiveIntensity: 2 });
  for (const [x, z] of [[0, 0], [80, 0], [-80, 80], [0, -80], [160, 80]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), lampMat);
    post.position.set(x + 9, 3, z + 9);
    scene.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x181818 }));
    head.position.set(x + 9, 6.4, z + 9);
    scene.add(head);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), Math.random() < 0.5 ? tlRed : tlGreen);
    lamp.position.set(x + 9, 6.9, z + 9.4);
    scene.add(lamp);
  }

  // Helipad at (-238, 60): marked circle + H.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(-238, 0.07, 60);
  pad.receiveShadow = true;
  scene.add(pad);
  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(9.5, 10.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc93a }));
  padRing.rotation.x = -Math.PI / 2; padRing.position.set(-238, 0.09, 60);
  scene.add(padRing);

  // Pier reaching into the bay at x -300..-310, z -120.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }));
  pier.position.set(-302, 0.6, -120);
  pier.castShadow = true; pier.receiveShadow = true;
  scene.add(pier);

  // Boats and yachts in the bay.
  function boat(x, z, big, color) {
    const grp = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(big ? 16 : 9, 2.2, big ? 5 : 3),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }));
    hull.position.y = 0.8; hull.castShadow = true;
    grp.add(hull);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(big ? 7 : 4, 2, big ? 3.4 : 2),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
    cab.position.set(-1, 2.8, 0); cab.castShadow = true;
    grp.add(cab);
    grp.position.set(x, 0, z);
    grp.rotation.y = rand(0, Math.PI * 2);
    scene.add(grp);
    city.boats.push(grp);
    return grp;
  }
  boat(-292, -20, true, 0xffffff); // the white yacht for M6
  boat(-330, 30, true, 0x2e6bff);
  boat(-350, -80, false, 0xff7a3c);
  boat(-310, 90, false, 0x37c978);
  boat(-370, 140, true, 0xe8e8e8);

  // Palm trees along the beach.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const x = rand(-300, -140), z = rand(95, 215);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, rand(7, 11), 6), trunkMat);
    trunk.position.set(x, 4, z);
    trunk.rotation.z = rand(-0.12, 0.12);
    trunk.castShadow = true;
    scene.add(trunk);
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.5, 4), leafMat);
      const a = (k / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.6, 8.6, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      leaf.castShadow = true;
      scene.add(leaf);
    }
    city.palms.push(trunk);
  }

  // District boundary markers on the ground (subtle coloured strips).
  for (const d of G.districts) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.18 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(d.cx, 0.08, d.cz - d.h / 2);
    scene.add(strip);
  }
  // Mission marker posts: a small glowing pylon at each mission start.
  return city;
}
export function missionPylon(scene, x, z, color) {
  const p = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color || 0xffc93a, emissiveIntensity: 2.4 }));
  p.position.set(x, 2.5, z);
  scene.add(p);
  return p;
}
