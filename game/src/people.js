// people.js — the people of Solmar City: the player (Jason or Lucia) and
// the pedestrians who walk its sidewalks.

import * as THREE from 'three';
import { G } from './state.js';
import { gfx } from './graphics.js';
import { AVENUES, STREETS, insideBuilding } from './city.js';
import { clamp, groundDist, makeRng, pick, randRange } from './util.js';

const SKINS = [0xe8b88a, 0xc98a5e, 0x8a5a3a, 0xf0c8a0];
const SHIRTS = [0x2e8f8a, 0xc23b2e, 0x3a6ac2, 0xd8c25a, 0x7a4a9a, 0x3aa655, 0xe8e4da, 0xff7a3c];
const PANTS = [0x22242a, 0x3a4258, 0x5a4a3a, 0x2a3a2a];

/** Build a blocky person mesh: head, hair, torso, arms, legs. */
export function makePersonMesh(character, rng) {
  const g = new THREE.Group();
  const isJason = character === 'Jason';
  const skin = isJason ? 0xe8b88a : 0xf0c8a0;
  const shirt = isJason ? 0x2e8f8a : 0xc23b2e;
  const hairC = isJason ? 0x222222 : 0x3a1a0a;
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.95 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), hairMat);
  hair.position.y = 1.86;
  g.add(hair);
  if (!isJason) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.12), hairMat);
    back.position.set(0, 1.55, -0.22);
    g.add(back);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  torso.name = 'torso';
  g.add(torso);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.set(s * 0.4, 1.05, 0);
    arm.castShadow = true;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.2), pantsMat);
    leg.position.set(s * 0.16, 0.34, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  g.userData.character = character;
  return g;
}

/** Create the player at a ground position. */
export function createPlayer(x, z, character) {
  const mesh = makePersonMesh(character || 'Jason', makeRng(1));
  mesh.position.set(x, 0, z);
  gfx.scene.add(mesh);
  const player = {
    mesh,
    pos: mesh.position,
    yaw: 0,
    onFoot: true,
    vehicle: null,
    speed: 0,
    walkPhase: 0,
    character: character || 'Jason',
  };
  G.player = player;
  return player;
}

/** Swap the player's character model (Jason <-> Lucia), keeping progress. */
export function switchCharacter() {
  if (!G.player) return G.character;
  const other = G.character === 'Jason' ? 'Lucia' : 'Jason';
  const old = G.player.mesh;
  const mesh = makePersonMesh(other, makeRng(2));
  mesh.position.copy(old.position);
  mesh.rotation.y = old.rotation.y;
  if (old.parent) old.parent.add(mesh);
  if (old.parent) old.parent.remove(old);
  G.player.mesh = mesh;
  G.player.pos = mesh.position;
  G.player.character = other;
  G.character = other;
  return other;
}

/** Spawn pedestrians wandering the sidewalks. */
export function spawnPeds(n) {
  const rng = makeRng(60606);
  for (let i = 0; i < n; i++) {
    const useAvenue = rng() < 0.5;
    let x;
    let z;
    if (useAvenue) {
      x = pick(rng, AVENUES) + (rng() < 0.5 ? -9.5 : 9.5);
      z = -210 + rng() * 420;
    } else {
      x = -270 + rng() * 540;
      z = pick(rng, STREETS) + (rng() < 0.5 ? -9.5 : 9.5);
    }
    if (insideBuilding(x, z)) continue;
    const mesh = makePersonMesh(rng() < 0.5 ? 'Jason' : 'Lucia', rng);
    // Recolour the torso for variety.
    const torso = mesh.getObjectByName('torso');
    if (torso) torso.material = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.85 });
    mesh.position.set(x, 0, z);
    gfx.scene.add(mesh);
    const ped = {
      mesh,
      yaw: rng() * Math.PI * 2,
      speed: randRange(rng, 1.2, 2.2),
      axis: useAvenue ? 'z' : 'x',
      dir: rng() < 0.5 ? 1 : -1,
      fleeing: false,
      health: 100,
    };
    G.peds.push(ped);
  }
}

/** Move pedestrians along the sidewalks; they flee from gunfire. */
export function updatePeds(dt) {
  const px = G.player ? G.player.pos.x : 0;
  const pz = G.player ? G.player.pos.z : 0;
  for (const ped of G.peds) {
    const d = groundDist(px, pz, ped.mesh.position.x, ped.mesh.position.z);
    ped.fleeing = d < 14 && G.wanted > 0;
    const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
    if (ped.fleeing) {
      // Run directly away from the player.
      const a = Math.atan2(px - ped.mesh.position.x, pz - ped.mesh.position.z);
      ped.mesh.position.x -= Math.sin(a) * speed * dt;
      ped.mesh.position.z -= Math.cos(a) * speed * dt;
      ped.yaw = a + Math.PI;
    } else {
      if (ped.axis === 'z') ped.mesh.position.z += ped.dir * speed * dt;
      else ped.mesh.position.x += ped.dir * speed * dt;
      // Turn around at the city edge or a random intersection.
      const x = ped.mesh.position.x;
      const z = ped.mesh.position.z;
      if (x > 278 || x < -278 || z > 222 || z < -222 || Math.random() < 0.001) {
        ped.dir *= -1;
      }
    }
    ped.mesh.rotation.y = ped.yaw;
    // Walk bob.
    ped.mesh.position.y = Math.abs(Math.sin(performance.now() / 90 + ped.speed * 40)) * 0.06;
  }
}

/** Animate the player's walk bob and face the movement yaw. */
export function updatePlayerMesh(dt) {
  const p = G.player;
  if (!p || !p.onFoot) return;
  p.walkPhase += dt * (p.speed > 0.5 ? 9 : 0);
  p.mesh.position.y = p.speed > 0.5 ? Math.abs(Math.sin(p.walkPhase)) * 0.07 : 0;
  p.mesh.rotation.y = p.yaw;
}
