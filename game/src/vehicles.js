// vehicles.js — cars, traffic, the helicopter and boats.
// createCar ALWAYS sets cruise to 12; updateTraffic guards NaN speeds.
import * as THREE from 'three';
import { clamp, rand, pick, dist2d, clampWorld } from './util.js';

const CAR_COLORS = [0xd83a2e, 0x2e6bff, 0xffc93a, 0x37c978, 0xe8e8e8, 0x222222, 0xff7a3c, 0x8a5cff];

export function createCar(scene, opts = {}) {
  const color = opts.color !== undefined ? opts.color : pick(CAR_COLORS);
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true;
  grp.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.2, metalness: 0.7 }));
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  grp.add(cabin);
  // Headlights (emissive front) and taillights (emissive rear).
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2211, emissiveIntensity: 3 });
  for (const s of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    h.position.set(s, 0.65, 2.22); grp.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    t.position.set(s, 0.65, -2.22); grp.add(t);
  }
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    grp.add(w); wheels.push(w);
  }
  grp.position.set(opts.x || 0, 0, opts.z || 0);
  grp.rotation.y = opts.yaw || 0;
  scene.add(grp);
  return {
    group: grp, wheels, color,
    x: opts.x || 0, z: opts.z || 0, yaw: opts.yaw || 0,
    speed: 0,
    cruise: 12, // default cruise speed — never leave this undefined
    isMission: !!opts.isMission, missionId: opts.missionId || null,
    kind: opts.kind || 'car', // car | taxi | sports | police
    condition: 100,
    steer: 0,
  };
}

export function syncCar(car) {
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.yaw;
}

export function spawnTraffic(scene, n) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const onXRoad = Math.random() < 0.5;
    const x = onXRoad ? Math.round(rand(-280, 280) / 80) * 80 + (Math.random() < 0.5 ? -4 : 4) : rand(-280, 280);
    const z = onXRoad ? rand(-200, 200) : Math.round(rand(-200, 200) / 80) * 80 + (Math.random() < 0.5 ? -4 : 4);
    const c = createCar(scene, { x, z, yaw: onXRoad ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) });
    c.cruise = rand(9, 14);
    c.speed = c.cruise;
    cars.push(c);
  }
  return cars;
}

// Traffic drives along the road grid; mission cars are never touched,
// and parked cars stay where they are.
export function updateTraffic(cars, dt, G) {
  for (const c of cars) {
    if (c.isMission || c.parked) continue;
    if (!Number.isFinite(c.speed)) c.speed = c.cruise || 12;
    if (!Number.isFinite(c.cruise)) c.cruise = 12;
    // Ease toward cruise speed.
    c.speed += (c.cruise - c.speed) * Math.min(1, dt * 0.8);
    if (!Number.isFinite(c.speed)) c.speed = 12;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    c.x += fx * c.speed * dt;
    c.z += fz * c.speed * dt;
    // Turn at intersections sometimes; wrap at the world edge.
    if (Math.random() < dt * 0.12) c.yaw += pick([Math.PI / 2, -Math.PI / 2]);
    const p = clampWorld(c.x, c.z);
    if (p.x !== c.x || p.z !== c.z) {
      c.x = p.x; c.z = p.z;
      c.yaw += Math.PI;
    }
    // Avoid piling onto the player.
    const d = dist2d(c.x, c.z, G.pos.x, G.pos.z);
    if (d < 7 && G.mode !== 'car') c.speed = Math.max(0, c.speed - 20 * dt);
    syncCar(c);
  }
}

export function nearestCar(cars, x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of cars) {
    const d = dist2d(c.x, c.z, x, z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
// Prefer the current mission's car, then any nearby car.
export function enterNearest(cars, x, z, missionId) {
  if (missionId) {
    const mc = cars.find(c => c.missionId === missionId);
    if (mc && dist2d(mc.x, mc.z, x, z) < 14) return mc;
  }
  return nearestCar(cars, x, z, 9);
}
// Remove a car from the world (used when a mission car is delivered).
export function removeCar(scene, cars, car) {
  scene.remove(car.group);
  const i = cars.indexOf(car);
  if (i >= 0) cars.splice(i, 1);
}

// --- helicopter ------------------------------------------------------------
export function createHeli(scene, x, z) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd83a2e, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2), bodyMat);
  body.position.y = 1.4; body.castShadow = true;
  grp.add(body);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x0a1a2a, roughness: 0.15, metalness: 0.8 }));
  glass.position.set(0, 1.5, 2.0);
  grp.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat);
  tail.position.set(0, 1.6, -4.4);
  grp.add(tail);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.6 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), rotorMat);
  rotor.position.y = 2.6;
  grp.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.4), rotorMat);
  tailRotor.position.set(0.4, 1.8, -6.4);
  grp.add(tailRotor);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2211, emissiveIntensity: 3 }));
  light.position.set(0, 0.6, 2.7);
  grp.add(light);
  grp.position.set(x, 0, z);
  scene.add(grp);
  return { group: grp, rotor, tailRotor, x, z, y: 0, yaw: 0, speed: 0, altitude: 0 };
}
export function updateHeli(heli, dt, input) {
  // Space climbs, C descends, WASD steers.
  if (input.space) heli.altitude = Math.min(60, heli.altitude + 14 * dt);
  if (input.keyC) heli.altitude = Math.max(0, heli.altitude - 14 * dt);
  const fx = Math.sin(heli.yaw), fz = Math.cos(heli.yaw);
  let thrust = 0;
  if (input.w) thrust += 1;
  if (input.s) thrust -= 0.6;
  if (input.a) heli.yaw += 1.4 * dt;
  if (input.d) heli.yaw -= 1.4 * dt;
  heli.speed = thrust * (heli.altitude > 0.5 ? 22 : 0);
  heli.x += fx * heli.speed * dt;
  heli.z += fz * heli.speed * dt;
  const p = clampWorld(heli.x, heli.z);
  heli.x = p.x; heli.z = p.z;
  heli.group.position.set(heli.x, heli.altitude + 1.2, heli.z);
  heli.group.rotation.y = heli.yaw;
  heli.rotor.rotation.y += dt * 28;
  heli.tailRotor.rotation.x += dt * 28;
  return heli;
}
// --- boats -----------------------------------------------------------------
export function createBoat(scene, x, z, big) {
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(big ? 16 : 9, 2.2, big ? 5 : 3),
    new THREE.MeshStandardMaterial({ color: big ? 0xffffff : 0x2e6bff, roughness: 0.45, metalness: 0.3 }));
  hull.position.y = 0.8; hull.castShadow = true;
  grp.add(hull);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(big ? 7 : 4, 2, big ? 3.4 : 2),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
  cab.position.set(-1, 2.8, 0);
  grp.add(cab);
  grp.position.set(x, 0, z);
  scene.add(grp);
  return { group: grp, x, z, yaw: 0, speed: 0, big: !!big };
}
export function updateBoat(boat, dt, input) {
  const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
  if (input.w) boat.speed = Math.min(18, boat.speed + 8 * dt);
  if (input.s) boat.speed = Math.max(-4, boat.speed - 10 * dt);
  if (input.a) boat.yaw += 0.9 * dt;
  if (input.d) boat.yaw -= 0.9 * dt;
  boat.speed *= (1 - Math.min(1, dt * 0.4));
  boat.x += fx * boat.speed * dt;
  boat.z += fz * boat.speed * dt;
  boat.x = clamp(boat.x, -420, -160);
  boat.z = clamp(boat.z, -240, 240);
  boat.group.position.set(boat.x, Math.sin(Date.now() * 0.001) * 0.15, boat.z);
  boat.group.rotation.y = boat.yaw;
  boat.group.rotation.z = Math.sin(Date.now() * 0.0007) * 0.02;
  return boat;
}
