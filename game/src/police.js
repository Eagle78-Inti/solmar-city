// police.js — the wanted level and the law that answers it: police cars
// that ram, foot cops that chase, and a helicopter with a searchlight at
// four stars and above.

import * as THREE from 'three';
import { G, toast } from './state.js';
import { gfx } from './graphics.js';
import { AVENUES, STREETS } from './city.js';
import { clamp, groundDist, makeRng, pick } from './util.js';
import { createCar } from './vehicles.js';
import { takeDamage } from './combat.js';

let lastCrimeAt = 0;
let decayAt = 0;

/** Raise the wanted level (0-5) and remember the best for the stats screen. */
export function addWanted(n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.stats.bestWanted = Math.max(G.stats.bestWanted, G.wanted);
  lastCrimeAt = performance.now() / 1000;
  decayAt = lastCrimeAt + 20;
}

/** Clear the wanted level entirely. */
export function clearWanted() {
  G.wanted = 0;
}

/** Set the wanted level directly (staging screenshots and tests). */
export function setWanted(n) {
  G.wanted = clamp(n, 0, 5);
  G.stats.bestWanted = Math.max(G.stats.bestWanted, G.wanted);
  lastCrimeAt = performance.now() / 1000;
  decayAt = lastCrimeAt + 20;
}

/** Spawn a police car on a road near the player. */
function spawnPoliceCar() {
  const p = G.player;
  if (!p) return null;
  const rng = makeRng((performance.now() | 0) + G.police.length * 977);
  const ax = pick(rng, AVENUES);
  const sz = pick(rng, STREETS);
  const useAvenue = rng() < 0.5;
  const x = useAvenue ? ax : p.pos.x + (rng() < 0.5 ? -45 : 45);
  const z = useAvenue ? p.pos.z + (rng() < 0.5 ? -45 : 45) : sz;
  const car = createCar('police', clamp(x, -275, 275), clamp(z, -220, 220), 0, { cruise: 16 });
  car.isPolice = true;
  G.police.push(car);
  return car;
}

/** Spawn a foot cop near the player. */
function spawnCop() {
  const p = G.player;
  if (!p) return null;
  const a = Math.random() * Math.PI * 2;
  const x = p.pos.x + Math.cos(a) * 18;
  const z = p.pos.z + Math.sin(a) * 18;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.9, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1a2a5a, roughness: 0.85 }),
  );
  mesh.position.set(x, 0.95, z);
  mesh.castShadow = true;
  gfx.scene.add(mesh);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }),
  );
  head.position.y = 1.15;
  mesh.add(head);
  const cop = { mesh, health: 60, punchAt: 0 };
  G.cops.push(cop);
  return cop;
}

/** Build the police helicopter with its searchlight cone and ground pool. */
function spawnHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 5.2), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  g.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x111214 }));
  rotor.position.y = 1.2;
  rotor.name = 'rotor';
  g.add(rotor);
  // Searchlight cone pointing down, and the pool of light on the ground.
  // The cone's apex is at the helicopter, its base on the ground below.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(5, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -21;
  cone.name = 'cone';
  g.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -41;
  pool.name = 'pool';
  g.add(pool);
  g.position.set(G.player.pos.x + 20, 42, G.player.pos.z - 20);
  gfx.scene.add(g);
  const heli = { mesh: g, rotor, cone, pool, yaw: 0 };
  G.heli = heli;
  return heli;
}

/** Per-frame police update: wanted decay, chases, the heli. */
export function updatePolice(dt) {
  const p = G.player;
  if (!p) return;
  const now = performance.now() / 1000;
  // Wanted decays when the player stays clean.
  if (G.wanted > 0 && now > decayAt) {
    G.wanted--;
    decayAt = now + 8;
    if (G.wanted === 0) toast('You lost the cops', 3);
  }
  // Police cars: one per wanted star, up to five.
  const wantCars = Math.min(G.wanted, 5);
  while (G.police.length < wantCars) spawnPoliceCar();
  while (G.police.length > wantCars) {
    const car = G.police.pop();
    if (car) {
      const i = G.cars.indexOf(car);
      if (i >= 0) G.cars.splice(i, 1);
      if (car.mesh.parent) car.mesh.parent.remove(car.mesh);
    }
  }
  // Chase: steer toward the player, ram on contact.
  for (const car of G.police) {
    const dx = p.pos.x - car.mesh.position.x;
    const dz = p.pos.z - car.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) continue;
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += clamp(dy, -1.8 * dt, 1.8 * dt);
    car.speed = 13 + G.wanted * 2.2;
    car.mesh.position.x += Math.sin(car.yaw) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.yaw) * car.speed * dt;
    car.mesh.rotation.y = car.yaw;
    if (d < 3.2) {
      // Ram: damage the player's car or the player.
      if (p.vehicle) {
        p.vehicle.condition = Math.max(0, p.vehicle.condition - 2);
        p.vehicle.speed *= 0.7;
      } else if (now - (car.lastHit || 0) > 1) {
        car.lastHit = now;
        takeDamage(5);
      }
    }
  }
  // Foot cops at two stars and above.
  const wantCops = G.wanted >= 2 ? Math.min(G.wanted - 1, 3) : 0;
  while (G.cops.length < wantCops) spawnCop();
  while (G.cops.length > wantCops) {
    const cop = G.cops.pop();
    if (cop && cop.mesh.parent) cop.mesh.parent.remove(cop.mesh);
  }
  for (const cop of G.cops) {
    const dx = p.pos.x - cop.mesh.position.x;
    const dz = p.pos.z - cop.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      cop.mesh.position.x += (dx / d) * 4.6 * dt;
      cop.mesh.position.z += (dz / d) * 4.6 * dt;
      cop.mesh.rotation.y = Math.atan2(dx, dz);
    }
    if (d < 1.8 && now - cop.punchAt > 1) {
      cop.punchAt = now;
      takeDamage(4);
    }
  }
  // The helicopter comes out at four stars.
  if (G.wanted >= 4 && !G.heli) spawnHeli();
  if (G.wanted < 4 && G.heli) {
    if (G.heli.mesh.parent) G.heli.mesh.parent.remove(G.heli.mesh);
    G.heli = null;
  }
  if (G.heli) {
    const h = G.heli;
    // Hover directly above the player so the cone and its pool line up.
    const tx = p.pos.x;
    const tz = p.pos.z;
    h.mesh.position.x += (tx - h.mesh.position.x) * Math.min(1, dt * 0.7);
    h.mesh.position.z += (tz - h.mesh.position.z) * Math.min(1, dt * 0.7);
    h.mesh.position.y = 42;
    h.rotor.rotation.y += dt * 24;
    // The searchlight pool sits on the player.
    h.pool.position.x = p.pos.x - h.mesh.position.x;
    h.pool.position.z = p.pos.z - h.mesh.position.z;
    h.pool.position.y = -41.5;
  }
}
