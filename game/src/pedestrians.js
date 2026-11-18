// Solmar City v4 — the pedestrians of Solmar: walkers on the sidewalks who go
// about their day and run when they hear gunfire or a car comes at them fast.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, dist2 } from './util.js';
import { ROADS_X, ROADS_Z } from './city.js';

const SHIRTS = [0xd86a4a, 0x4a7fb5, 0x6aa84f, 0xc2b280, 0x8e6cc2, 0xcccccc, 0x3a3f47, 0xe08aa0];

function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick([0xd9a986, 0xb98a68, 0x8a5f43, 0xe8c39a]), roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.28), shirt);
  body.position.y = 0.86; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  head.position.y = 1.38;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.5, 0.17), pants);
  legL.position.set(-0.12, 0.25, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.5, 0.17), pants);
  legR.position.set(0.12, 0.25, 0);
  g.add(body, head, legL, legR);
  g.userData = { legL, legR };
  return g;
}

export function createPeds(scene) {
  const list = [];
  for (let i = 0; i < 26; i++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = pick(axis === 'x' ? ROADS_Z : ROADS_X);
    const side = Math.random() < 0.5 ? -1 : 1;
    const mesh = makePedMesh(pick(SHIRTS));
    scene.add(mesh);
    const ped = {
      mesh,
      axis,
      road,
      side,
      coord: rand(-140, 140),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(0.9, 1.9),
      flee: 0,
      phase: rand(6),
      alive: true,
    };
    mesh.userData.isPed = true;
    mesh.userData.ref = ped;
    list.push(ped);
  }
  function fleeFrom(x, z, radius) {
    for (const p of list) {
      if (!p.alive) continue;
      const px = p.axis === 'x' ? p.coord : p.road + p.side * 9.5;
      const pz = p.axis === 'x' ? p.road + p.side * 9.5 : p.coord;
      if (dist2(px, pz, x, z) < radius) p.flee = 3;
    }
  }
  function update(dt) {
    for (const p of list) {
      if (!p.alive) continue;
      const spd = p.speed * (p.flee > 0 ? 3.0 : 1);
      p.flee = Math.max(0, p.flee - dt);
      p.coord += p.dir * spd * dt;
      if (p.coord > 145) { p.coord = 145; p.dir = -1; }
      if (p.coord < -145) { p.coord = -145; p.dir = 1; }
      const x = p.axis === 'x' ? p.coord : p.road + p.side * 9.5;
      const z = p.axis === 'x' ? p.road + p.side * 9.5 : p.coord;
      p.mesh.position.set(x, 0, z);
      p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? Math.PI : 0);
      p.phase += dt * spd * 3.4;
      const sw = Math.sin(p.phase) * 0.5;
      p.mesh.userData.legL.rotation.x = sw;
      p.mesh.userData.legR.rotation.x = -sw;
    }
  }
  function killAt(point, radius) {
    let killed = null;
    for (const p of list) {
      if (!p.alive) continue;
      const px = p.axis === 'x' ? p.coord : p.road + p.side * 9.5;
      const pz = p.axis === 'x' ? p.road + p.side * 9.5 : p.coord;
      if (dist2(px, pz, point.x, point.z) < radius) {
        p.alive = false;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.3;
        killed = p;
        break;
      }
    }
    return killed;
  }
  return { list, update, fleeFrom, killAt, aliveCount: () => list.filter((p) => p.alive).length };
}

export function nearestAlivePed(peds, x, z) {
  let best = null, bd = Infinity;
  for (const p of peds.list) {
    if (!p.alive) continue;
    const px = p.axis === 'x' ? p.coord : p.road + p.side * 9.5;
    const pz = p.axis === 'x' ? p.road + p.side * 9.5 : p.coord;
    const d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = { ped: p, x: px, z: pz, dist: d }; }
  }
  return best;
}
