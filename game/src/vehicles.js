// vehicles.js — cars, traffic, boats, yachts and the flyable helicopter.
// Every car carries a cruise speed default (12) and the traffic update
// guards against NaN, or a bad car stalls the whole game loop.

import * as THREE from 'three';
import { G } from './state.js';
import { gfx } from './graphics.js';
import { AVENUES, STREETS, onRoad } from './city.js';
import { clamp, groundDist, makeRng, pick, randRange, wrapAngle } from './util.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0x3aa655, 0xd8c25a, 0x8a8d90, 0x22242a, 0xe8e4da, 0x7a4a9a];
const TAXI_COLOR = 0xf2c200;

/** Build a car mesh: body, cabin, wheels, headlights and taillights. */
export function buildCarMesh(kind, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.15, metalness: 0.7 });
  const isTruck = kind === 'truck';
  const isSports = kind === 'sports';
  const len = isTruck ? 5.6 : isSports ? 4.4 : 4.2;
  const wid = isTruck ? 2.4 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, isTruck ? 1.7 : 0.75, len), bodyMat);
  body.position.y = isTruck ? 1.15 : 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(wid * 0.85, 0.62, len * (isTruck ? 0.35 : 0.5)),
    glassMat,
  );
  cabin.position.set(0, isTruck ? 2.2 : 1.28, isTruck ? len * 0.28 : -len * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  // Headlights (white, emissive) and taillights (red, emissive).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headMat);
    head.position.set(s * wid * 0.32, 0.62, len / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), tailMat);
    tail.position.set(s * wid * 0.32, 0.62, -len / 2 - 0.02);
    g.add(tail);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd23e, emissiveIntensity: 0.7 }),
    );
    sign.position.set(0, 1.72, 0);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 1.2 }),
    );
    bar.position.set(0, 1.68, 0);
    g.add(bar);
  }
  return g;
}

/**
 * Create a car. Every car gets cruise: 12 by default — a car without one
 * gets NaN speed and stalls the traffic update (and the missions with it).
 */
export function createCar(kind, x, z, yaw, opts) {
  const o = opts || {};
  const color = o.color !== undefined ? o.color : kind === 'taxi' ? TAXI_COLOR : pick(makeRng((x * 31 + z * 17) | 0), CAR_COLORS);
  const mesh = buildCarMesh(kind, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw || 0;
  gfx.scene.add(mesh);
  const car = {
    kind,
    mesh,
    yaw: yaw || 0,
    speed: 0,
    cruise: o.cruise !== undefined ? o.cruise : 12,
    axis: o.axis || 'z',
    dir: o.dir || 1,
    isPlayer: false,
    isPolice: kind === 'police',
    isMission: !!o.mission,
    missionN: o.missionN || 0,
    parked: !!o.parked,
    condition: 100, // vehicle condition 0-100; collisions wear it down
    id: G.cars.length,
  };
  G.cars.push(car);
  return car;
}

/** Spawn the ambient traffic: cars cruising the road grid. */
export function spawnTraffic(n) {
  const rng = makeRng(31337);
  for (let i = 0; i < n; i++) {
    const useAvenue = rng() < 0.5;
    const kind = rng() < 0.08 ? 'taxi' : rng() < 0.14 ? 'truck' : 'sedan';
    let x;
    let z;
    let axis;
    let dir;
    if (useAvenue) {
      x = pick(rng, AVENUES) + (rng() < 0.5 ? -3.5 : 3.5);
      z = -210 + rng() * 420;
      axis = 'z';
      dir = rng() < 0.5 ? 1 : -1;
    } else {
      x = -270 + rng() * 540;
      z = pick(rng, STREETS) + (rng() < 0.5 ? -3.5 : 3.5);
      axis = 'x';
      dir = rng() < 0.5 ? 1 : -1;
    }
    const yaw = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const car = createCar(kind, x, z, yaw, { axis, dir, cruise: randRange(rng, 9, 14) });
    car.speed = car.cruise;
  }
}

/** Move traffic along the grid; cars turn at intersections, never leave town. */
export function updateTraffic(dt) {
  for (const car of G.cars) {
    if (car.isPlayer || car.parked || car.isPolice || car.isMission) continue; // police cars are driven by police.js; mission cars stay where they spawn until taken
    // NaN guard: a car with a bad speed is reset to its cruise speed.
    if (!Number.isFinite(car.speed)) car.speed = Number.isFinite(car.cruise) ? car.cruise : 12;
    if (!Number.isFinite(car.cruise)) car.cruise = 12;
    car.speed += (car.cruise - car.speed) * Math.min(1, dt * 0.8);
    const step = car.speed * dt;
    if (car.axis === 'z') car.mesh.position.z += car.dir * step;
    else car.mesh.position.x += car.dir * step;
    const px = car.mesh.position.x;
    const pz = car.mesh.position.z;
    // Turn at an intersection sometimes, turn around at the city edge.
    const nearX = AVENUES.some((a) => Math.abs(px - a) < 1.2);
    const nearZ = STREETS.some((s) => Math.abs(pz - s) < 1.2);
    if (nearX && nearZ && Math.random() < 0.012) {
      if (car.axis === 'z') {
        car.axis = 'x';
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'z';
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.yaw = car.dir > 0 ? 0 : Math.PI;
      }
      car.mesh.rotation.y = car.yaw;
    }
    if (px > 282 || px < -282 || pz > 226 || pz < -226) {
      car.dir *= -1;
      car.yaw += Math.PI;
      car.mesh.rotation.y = car.yaw;
    }
  }
}

/** The nearest boat or yacht to a point, within maxDist metres. */
export function nearestBoat(x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const b of [...G.boats, ...G.yachts]) {
    const d = groundDist(x, z, b.mesh.position.x, b.mesh.position.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Remove a car from the world (used when the player garages a car). */
export function removeCar(car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
}
/** The nearest drivable car to a point, within maxDist metres. */
export function nearestVehicle(x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.kind === 'boat' || car.kind === 'yacht') continue;
    const d = groundDist(x, z, car.mesh.position.x, car.mesh.position.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Build a boat hull: white hull, cabin, outboard. */
export function buildBoatMesh(big) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: big ? 0xf2f0e8 : 0xd8e4ea, roughness: 0.35, metalness: 0.3 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(big ? 3.4 : 2.2, 1.1, big ? 11 : 7), hullMat);
  hull.position.y = 0.7;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(big ? 1.7 : 1.1, big ? 2.6 : 1.8, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.7, (big ? 11 : 7) / 2 + (big ? 1.1 : 0.8));
  g.add(bow);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(big ? 2.4 : 1.4, 1.2, big ? 3.4 : 2),
    new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.2, metalness: 0.6 }),
  );
  cabin.position.set(0, 1.7, big ? -1 : -0.6);
  cabin.castShadow = true;
  g.add(cabin);
  return g;
}

/** Spawn boats and yachts in the bay. */
export function spawnBoats() {
  const rng = makeRng(808);
  for (let i = 0; i < 6; i++) {
    const mesh = buildBoatMesh(false);
    mesh.position.set(-330 - rng() * 60, 0.1, -180 + rng() * 360);
    mesh.rotation.y = rng() * Math.PI * 2;
    gfx.scene.add(mesh);
    const boat = { kind: 'boat', mesh, yaw: mesh.rotation.y, speed: 0, cruise: 8, isPlayer: false };
    G.boats.push(boat);
  }
}

export function spawnYachts() {
  const rng = makeRng(909);
  const spots = [[-340, -20], [-355, 40], [-335, -140], [-360, -90]];
  for (const [x, z] of spots) {
    const mesh = buildBoatMesh(true);
    mesh.position.set(x, 0.1, z);
    mesh.rotation.y = rng() * Math.PI * 2;
    gfx.scene.add(mesh);
    const yacht = { kind: 'yacht', mesh, yaw: mesh.rotation.y, speed: 0, cruise: 10, isPlayer: false };
    G.yachts.push(yacht);
  }
  // The M6 mission yacht, moored at the north pier.
  const m6 = buildBoatMesh(true);
  m6.position.set(-292, 0.1, -20);
  m6.rotation.y = Math.PI / 2;
  gfx.scene.add(m6);
  G.yachts.push({ kind: 'yacht', mesh: m6, yaw: Math.PI / 2, speed: 0, cruise: 10, isPlayer: false, mission: true });
}

/** The flyable helicopter, parked on the helipad. */
export function createFlyHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.35, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 5.2), bodyMat);
  body.position.y = 1.6;
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 1.0, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.15, metalness: 0.7 }),
  );
  glass.position.set(0, 1.7, 2.0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.6), bodyMat);
  tail.position.set(0, 1.8, -4.6);
  tail.castShadow = true;
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), bodyMat);
  fin.position.set(0, 2.6, -6.6);
  g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.5, metalness: 0.6 }));
  rotor.position.y = 2.75;
  rotor.name = 'rotor';
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x22242a }));
  tailRotor.position.set(0.45, 2.6, -6.6);
  tailRotor.name = 'tailRotor';
  g.add(tailRotor);
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    skid.position.set(s * 1.2, 0.35, 0.4);
    g.add(skid);
  }
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff2222, emissiveIntensity: 1.5 }));
  navRed.position.set(-1.35, 1.6, 0);
  g.add(navRed);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0x00aa00, emissive: 0x22ff22, emissiveIntensity: 1.5 }));
  navGreen.position.set(1.35, 1.6, 0);
  g.add(navGreen);
  g.position.set(-252, 0.1, 56);
  gfx.scene.add(g);
  const heli = { kind: 'heli', mesh: g, yaw: 0, speed: 0, cruise: 0, isPlayer: false, throttle: 0, vy: 0, altitude: 0 };
  G.flyHeli = heli;
  return heli;
}

/** Update the flyable helicopter: rotor spin, lift, forward flight. */
export function updateFlyHeli(dt, input) {
  const h = G.flyHeli;
  if (!h) return;
  const rotor = h.mesh.getObjectByName('rotor');
  const tailRotor = h.mesh.getObjectByName('tailRotor');
  const spinning = h.isPlayer ? 0.9 + h.throttle : 0.12;
  if (rotor) rotor.rotation.y += dt * 22 * spinning;
  if (tailRotor) tailRotor.rotation.y += dt * 30 * spinning;
  if (!h.isPlayer) return;
  // Throttle: Space climbs, C descends; W/S pitch forward/back.
  if (input.up) h.throttle = clamp(h.throttle + dt * 0.7, 0, 1);
  if (input.down) h.throttle = clamp(h.throttle - dt * 0.7, 0, 1);
  const lift = (h.throttle - 0.45) * 22;
  h.vy += (lift - h.vy) * Math.min(1, dt * 2);
  h.altitude = Math.max(0, h.altitude + h.vy * dt);
  h.mesh.position.y = 0.1 + h.altitude;
  const fwd = input.forward ? 1 : input.back ? -0.5 : 0;
  const speed = fwd * (8 + h.throttle * 22);
  h.mesh.position.x += Math.sin(h.yaw) * speed * dt;
  h.mesh.position.z += Math.cos(h.yaw) * speed * dt;
  if (input.left) h.yaw += dt * 1.4;
  if (input.right) h.yaw -= dt * 1.4;
  h.mesh.rotation.y = h.yaw;
  h.mesh.rotation.x = fwd * 0.12;
}
