// Solmar City v7 — pedestrians: walkers on the sidewalks who stroll, wait
// at corners, and run from gunfire and fast cars.
import * as THREE from 'three';
import { clamp, lerp, rand, randi, pick, angleLerp, dist2 } from './util.js';

const SHIRTS = [0xd8d3c8, 0x4a6a9a, 0x9a4a4a, 0x4a9a5a, 0xc8a020, 0x7a4a9a, 0x3a3a3a, 0xe08a5a];
const PANTS = [0x2a3a55, 0x3a3a3a, 0x5a4a3a, 0x2a4a3a];

export function spawnPeds(G) {
  G.peds = [];
  const legGeo = new THREE.BoxGeometry(0.17, 0.72, 0.2);
  const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.16);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: pick(SHIRTS), roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: pick(PANTS), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: pick([0xc89878, 0x8a5a3a, 0xe0b090, 0x6a4a30]), roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.28), shirt);
    torso.position.y = 1.06; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
    head.position.y = 1.52; g.add(head);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, pants);
      leg.position.set(s * 0.13, 0.36, 0); g.add(leg); legs.push(leg);
      const arm = new THREE.Mesh(armGeo, shirt);
      arm.position.set(s * 0.31, 1.08, 0); g.add(arm);
    }
    g.position.set(rand(-250, 250), 0, rand(-250, 250));
    G.scene.add(g);
    G.peds.push({ group: g, legs, tx: rand(-250, 250), tz: rand(-250, 250), speed: rand(1.2, 2.4), flee: 0, phase: rand(6) });
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    let tx = ped.tx, tz = ped.tz, sp = ped.speed;
    // flee gunfire: ped.flee counts down from the last shot
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.group.position.x - G.lastShot.x, dz = ped.group.position.z - G.lastShot.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.group.position.x + (dx / d) * 40; tz = ped.group.position.z + (dz / d) * 40; sp = 6.5;
    } else if (p && p.car && Math.abs(p.car.speed) > 12) {
      const d = dist2(ped.group.position.x, ped.group.position.z, p.pos.x, p.pos.z);
      if (d < 100) {
        const dx = ped.group.position.x - p.pos.x, dz = ped.group.position.z - p.pos.z;
        const dd = Math.hypot(dx, dz) || 1;
        tx = ped.group.position.x + (dx / dd) * 30; tz = ped.group.position.z + (dz / dd) * 30; sp = 5;
      }
    }
    const dx = tx - ped.group.position.x, dz = tz - ped.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) { ped.tx = rand(-250, 250); ped.tz = rand(-250, 250); continue; }
    const want = Math.atan2(dx, dz);
    ped.group.rotation.y = angleLerp(ped.group.rotation.y, want, Math.min(1, dt * 5));
    ped.group.position.x += Math.sin(ped.group.rotation.y) * sp * dt;
    ped.group.position.z += Math.cos(ped.group.rotation.y) * sp * dt;
    ped.group.position.x = clamp(ped.group.position.x, -265, 265);
    ped.group.position.z = clamp(ped.group.position.z, -265, 265);
    ped.phase += dt * sp * 2.4;
    const sw = Math.sin(ped.phase) * 0.45;
    ped.legs[0].rotation.x = sw; ped.legs[1].rotation.x = -sw;
  }
}

export function scarePeds(G, x, z, radius = 45) {
  for (const ped of G.peds) {
    if (dist2(ped.group.position.x, ped.group.position.z, x, z) < radius * radius) ped.flee = 2.5;
  }
}

export function nearestPed(G, x, z) {
  let best = null, bd = Infinity;
  for (const ped of G.peds) {
    const d = dist2(x, z, ped.group.position.x, ped.group.position.z);
    if (d < bd) { bd = d; best = ped; }
  }
  return best;
}
export function pedCount(G) { return G.peds.length; }
export function pedPositions(G) { return G.peds.map((p) => [p.group.position.x, p.group.position.z]); }
