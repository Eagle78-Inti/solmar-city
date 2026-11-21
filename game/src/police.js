// police.js — wanted level, police pursuit cars and the heli searchlight.
import * as THREE from 'three';
import { clamp, dist2d, clampWorld } from './util.js';
import { createCar, syncCar } from './vehicles.js';

export function createPoliceCar(scene, x, z) {
  const c = createCar(scene, { x, z, color: 0x111418, kind: 'police' });
  c.cruise = 20;
  c.speed = 12;
  // White doors + light bar read as "police" at a glance.
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.4 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.5, 1.4), doorMat);
  door.position.set(0, 0.7, 0.4);
  c.group.add(door);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2233ff, emissiveIntensity: 3 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), barMat);
  bar.position.set(0, 1.75, -0.2);
  c.group.add(bar);
  c.lightBar = bar;
  return c;
}

// How many police cars the wanted level calls for.
export function policeTarget(wanted) {
  return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 5;
}

export function updatePolice(scene, police, G, dt) {
  const want = policeTarget(G.wanted);
  // Spawn up to the target, near the player but not on top of them.
  while (police.length < want) {
    const a = Math.random() * Math.PI * 2;
    const x = G.pos.x + Math.sin(a) * 55, z = G.pos.z + Math.cos(a) * 55;
    const c = clampWorld(x, z);
    police.push(createPoliceCar(scene, c.x, c.z));
  }
  // Remove extras when the heat drops.
  while (police.length > want) {
    const c = police.pop();
    scene.remove(c.group);
  }
  // Chase: steer toward the player, ram on contact.
  for (const c of police) {
    const d = dist2d(c.x, c.z, G.pos.x, G.pos.z);
    const wantYaw = Math.atan2(G.pos.x - c.x, G.pos.z - c.z);
    let dy = wantYaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.yaw += clamp(dy, -1.9 * dt, 1.9 * dt);
    const target = d > 6 ? 24 : 10;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.2);
    c.x += Math.sin(c.yaw) * c.speed * dt;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    const p = clampWorld(c.x, c.z);
    c.x = p.x; c.z = p.z;
    if (d < 3.2) {
      // A ram: the player takes damage and the car loses condition.
      G.health = clamp(G.health - 12 * dt, 0, 100);
      if (G.mode === 'car') G.condition = clamp(G.condition - 6 * dt, 0, 100);
    }
    // Flashing light bar.
    c.lightBar.material.emissive.setHex(Math.floor(Date.now() / 250) % 2 ? 0xff2211 : 0x2233ff);
    syncCar(c);
  }
  // Wanted decays slowly when the player stays out of sight (low speed, no crime).
  if (G.wanted > 0) {
    G.heat += dt;
    if (G.heat > 26) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.heat = 0;
    }
  }
}

// The searchlight: a SpotLight from the heli plus a visible pool on the road.
export function createSearchlight(scene) {
  const spot = new THREE.SpotLight(0xfff6d8, 900, 90, 0.32, 0.5, 1.2);
  spot.castShadow = false;
  scene.add(spot);
  scene.add(spot.target);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.32 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.1;
  scene.add(pool);
  return { spot, pool };
}

export function updateSearchlight(sl, heli, target, active) {
  if (!active || !heli || heli.altitude < 1) {
    sl.spot.intensity = 0;
    sl.pool.material.opacity = 0;
    return;
  }
  sl.spot.position.set(heli.x, heli.altitude + 2, heli.z);
  sl.spot.target.position.set(target.x, 0, target.z);
  sl.spot.intensity = 900;
  sl.pool.position.set(target.x, 0.1, target.z);
  sl.pool.material.opacity = 0.32;
  // The pool follows the target; the heli hovers above it.
}

// Wanted-level helpers used by missions and the debug API.
export function raiseWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  if (G.wanted > G.bestWanted) G.bestWanted = G.wanted;
  G.heat = 0;
}
export function clearWanted(G) { G.wanted = 0; G.heat = 0; }
export function wantedLabel(w) {
  return w === 0 ? 'CLEAN' : w <= 2 ? 'WANTED' : w <= 4 ? 'HOT' : 'MOST WANTED';
}
// A police car far from the player is despawned by updatePolice naturally
// (it only removes extras); this helper lets the harness clear the board.
export function clearPolice(scene, police) {
  for (const c of police) scene.remove(c.group);
  police.length = 0;
}
