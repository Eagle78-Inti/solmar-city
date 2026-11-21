// people.js — the player character mesh and wandering pedestrians.
import * as THREE from 'three';
import { rand, pick, clampWorld } from './util.js';

const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6b4423];
const SHIRTS = [0x2e6bff, 0xd83a2e, 0x37c978, 0xffc93a, 0x8a5cff, 0x22e6ff, 0xff7a3c];
const PANTS = [0x222831, 0x3a3a4a, 0x5a4632, 0x1a2a3a];

export function makePerson(scene, opts = {}) {
  const skin = opts.skin || pick(SKINS);
  const shirt = opts.shirt || pick(SHIRTS);
  const pants = opts.pants || pick(PANTS);
  const grp = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  // Legs
  for (const s of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), pantsMat);
    leg.position.set(s, 0.42, 0);
    leg.castShadow = true;
    grp.add(leg);
  }
  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.45), shirtMat);
  torso.position.y = 1.3; torso.castShadow = true;
  grp.add(torso);
  // Arms
  const arms = [];
  for (const s of [-0.55, 0.55]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.26), shirtMat);
    arm.position.set(s, 1.3, 0);
    arm.castShadow = true;
    grp.add(arm); arms.push(arm);
  }
  // Head + hair
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), skinMat);
  head.position.y = 2.0; head.castShadow = true;
  grp.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.22, 0.49),
    new THREE.MeshStandardMaterial({ color: opts.hair || 0x181410, roughness: 1 }));
  hair.position.y = 2.3;
  grp.add(hair);
  // Lucia gets a ponytail so the two characters read differently.
  if (opts.ponytail) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 1 }));
    tail.position.set(0, 2.05, -0.32);
    grp.add(tail);
  }
  grp.position.set(opts.x || 0, 0, opts.z || 0);
  scene.add(grp);
  return { group: grp, arms, x: opts.x || 0, z: opts.z || 0, yaw: opts.yaw || 0, walkPhase: 0 };
}

export function makePlayerMesh(scene, character) {
  // Jason: teal shirt. Lucia: magenta shirt + ponytail.
  if (character === 'Lucia') {
    return makePerson(scene, { shirt: 0xff2ea6, skin: 0xe8b88a, pants: 0x222831, ponytail: true });
  }
  return makePerson(scene, { shirt: 0x22e6ff, skin: 0xc98a5e, pants: 0x222831, hair: 0x2a1a10 });
}

export function spawnPeds(scene, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const p = makePerson(scene, { x: rand(-280, 280), z: rand(-200, 200) });
    p.speed = rand(1.2, 2.4);
    p.dir = rand(0, Math.PI * 2);
    peds.push(p);
  }
  return peds;
}

export function updatePeds(peds, dt, playerPos) {
  for (const p of peds) {
    // Flee a little from a nearby car or player.
    const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 4 && d > 0.01) {
      p.dir = Math.atan2(dx, dz);
      p.speed = 3.4;
    } else {
      p.speed = 1.6;
      if (Math.random() < dt * 0.1) p.dir += rand(-1, 1);
    }
    p.x += Math.sin(p.dir) * p.speed * dt;
    p.z += Math.cos(p.dir) * p.speed * dt;
    const c = clampWorld(p.x, p.z);
    if (c.x !== p.x || c.z !== p.z) { p.x = c.x; p.z = c.z; p.dir += Math.PI; }
    p.walkPhase += dt * p.speed * 3;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.dir;
    p.arms[0].rotation.x = Math.sin(p.walkPhase) * 0.5;
    p.arms[1].rotation.x = -Math.sin(p.walkPhase) * 0.5;
  }
}

// Walk-cycle helper shared by the player update in main.js.
export function animateWalk(person, dt, moving) {
  if (!moving) {
    person.arms[0].rotation.x *= 0.8;
    person.arms[1].rotation.x *= 0.8;
    return;
  }
  person.walkPhase += dt * 9;
  person.arms[0].rotation.x = Math.sin(person.walkPhase) * 0.6;
  person.arms[1].rotation.x = -Math.sin(person.walkPhase) * 0.6;
}
// Swap the player mesh when the character changes.
export function swapPlayerMesh(scene, oldMesh, character) {
  if (oldMesh) scene.remove(oldMesh.group);
  const m = character === 'Lucia'
    ? makePerson(scene, { shirt: 0xff2ea6, skin: 0xe8b88a, pants: 0x222831, ponytail: true })
    : makePerson(scene, { shirt: 0x22e6ff, skin: 0xc98a5e, pants: 0x222831, hair: 0x2a1a10 });
  return m;
}
// A pedestrian runs away from the given point (used by police chases).
export function scatterPeds(peds, x, z, radius) {
  for (const p of peds) {
    const dx = p.x - x, dz = p.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < radius && d > 0.01) p.dir = Math.atan2(dx, dz);
  }
}
