// Solmar City v4 — cars: detailed meshes with clearcoat paint, glass cabins and
// headlights, the traffic that fills the roads, the player's arcade car, and
// the parked cars waiting to be stolen.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, angleLerp, moveToward } from './util.js';
import { ROADS_X, ROADS_Z, onRoad, nearestRoadCoord } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xdad8ce, 0x22242a, 0x3f8f5f, 0xd8a13c, 0x7a4a9e, 0x4a6a72];
const GLASS = new THREE.MeshStandardMaterial({ color: 0x0e1622, metalness: 0.9, roughness: 0.08 });
const TYRE = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const HUB = new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.85, roughness: 0.3 });
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), paint);
  body.position.y = 0.62; body.castShadow = true;
  group.add(body);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 4.1), dark);
  skirt.position.y = 0.36;
  group.add(skirt);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 2.1), opts.police ? paint : GLASS);
  cabin.position.set(0, 1.12, -0.2); cabin.castShadow = true;
  group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.38, wz);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14), TYRE);
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10), HUB);
    hub.rotation.z = Math.PI / 2;
    pivot.add(tyre); pivot.add(hub);
    group.add(pivot);
    wheels.push(pivot);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.4 });
  for (const hx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
    h.position.set(hx, 0.72, -2.21);
    group.add(h);
  }
  const beams = [];
  for (const hx of [-0.62, 0.62]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 5, 12, 1, true), BEAM_MAT.clone());
    cone.rotation.x = Math.PI / 2 + 0.07;
    cone.position.set(hx, 0.5, -4.7);
    group.add(cone);
    beams.push(cone);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 0.7 });
  for (const hx of [-0.62, 0.62]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    t.position.set(hx, 0.72, 2.21);
    group.add(t);
  }
  let barRed = null, barBlue = null;
  if (opts.police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), dark);
    barBase.position.set(0, 1.46, -0.2);
    group.add(barBase);
    barRed = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1 }));
    barRed.position.set(-0.28, 1.5, -0.2);
    group.add(barRed);
    barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2266ff, emissiveIntensity: 1 }));
    barBlue.position.set(0.28, 1.5, -0.2);
    group.add(barBlue);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.44), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc93c, emissiveIntensity: 0.9 }));
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }
  group.userData = { wheels, beams, barRed, barBlue, headMat, paint };
  return group;
}
export function setBeams(mesh, nightF) {
  for (const b of mesh.userData.beams) b.material.opacity = nightF > 0.35 ? 0.03 + nightF * 0.03 : 0;
  mesh.userData.headMat.emissiveIntensity = 0.4 + nightF * 2.2;
}

export function createTraffic(scene) {
  const cars = [];
  for (let i = 0; i < 16; i++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = pick(axis === 'x' ? ROADS_Z : ROADS_X);
    const lane = Math.random() < 0.5 ? -1 : 1;
    const mesh = makeCarMesh(pick(CAR_COLORS));
    scene.add(mesh);
    cars.push({
      mesh, axis, road, lane,
      coord: rand(-140, 140),
      dir: lane > 0 ? 1 : -1,
      speed: rand(7, 13),
      cruise: rand(7, 13),
    });
  }
  function update(dt) {
    for (const c of cars) {
      let target = c.cruise;
      for (const o of cars) {
        if (o === c || o.axis !== c.axis || o.road !== c.road || o.lane !== c.lane) continue;
        const ahead = (o.coord - c.coord) * c.dir;
        if (ahead > 0 && ahead < 13) target = Math.min(target, o.speed * 0.85);
      }
      c.speed = moveToward(c.speed, target, 6 * dt);
      c.coord += c.dir * c.speed * dt;
      if (c.coord > 146 || c.coord < -146) {
        if (Math.random() < 0.5) {
          const other = c.axis === 'x' ? 'z' : 'x';
          const fixed = c.axis === 'x' ? c.road + c.lane * 3.5 : c.coord;
          c.axis = other;
          c.road = nearestRoadCoord(fixed);
          c.coord = clamp(fixed, -140, 140);
          c.dir = c.lane > 0 ? 1 : -1;
        } else {
          c.coord = c.dir > 0 ? -146 : 146;
        }
      }
      const x = c.axis === 'x' ? c.coord : c.road + c.lane * 3.5;
      const z = c.axis === 'x' ? c.road + c.lane * 3.5 : c.coord;
      c.mesh.position.set(x, 0, z);
      c.mesh.rotation.y = c.axis === 'x' ? (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (c.dir > 0 ? Math.PI : 0);
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt / 0.38;
    }
  }
  return { cars, update };
}

export function createPlayerCar(scene) {
  const mesh = makeCarMesh(0xc23b2e);
  scene.add(mesh);
  const car = {
    group: mesh,
    pos: new THREE.Vector3(-120, 0, 40),
    heading: 0,
    speed: 0,
    update(dt, keys, nightF) {
      const handbrake = !!(keys.Space);
      const accel = keys.KeyW ? 16 : 0;
      const braking = keys.KeyS ? 24 : 0;
      if (keys.KeyS && car.speed <= 0.5) car.speed -= 9 * dt;
      car.speed += (accel - braking) * dt;
      car.speed -= car.speed * 0.35 * dt;
      if (handbrake) car.speed *= Math.max(0, 1 - 2.0 * dt);
      car.speed = clamp(car.speed, -10, 40);
      const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
      const grip = clamp(Math.abs(car.speed) / 9, 0, 1);
      car.heading += steer * grip * 1.9 * dt * (car.speed >= 0 ? 1 : -1) * (handbrake ? 1.7 : 1);
      const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      if (!onRoad(car.pos.x, car.pos.z)) car.speed *= Math.max(0, 1 - 0.9 * dt);
      if (car.pos.x > 156) { car.pos.x = 156; car.speed *= 0.5; }
      if (car.pos.x < -156) { car.pos.x = -156; car.speed *= 0.5; }
      if (car.pos.z > 156) { car.pos.z = 156; car.speed *= 0.5; }
      if (car.pos.z < -156) { car.pos.z = -156; car.speed *= 0.5; }
      mesh.position.copy(car.pos);
      mesh.rotation.y = car.heading;
      for (const w of mesh.userData.wheels) w.rotation.x += car.speed * dt / 0.38;
      setBeams(mesh, nightF);
    },
    reset() {
      car.pos.set(nearestRoadCoord(car.pos.x), 0, nearestRoadCoord(car.pos.z));
      car.heading = 0;
      car.speed = 0;
    },
  };
  return car;
}

export function createParkedCars(scene) {
  const spots = [];
  const defs = [
    { x: -111.5, z: -100, h: Math.PI / 2, color: 0x2e6fc2 },
    { x: -51.5, z: -40, h: -Math.PI / 2, color: 0xdad8ce },
    { x: 8.5, z: 20, h: Math.PI / 2, color: 0xd8a13c, taxi: true },
    { x: 68.5, z: 100, h: -Math.PI / 2, color: 0x3f8f5f },
    { x: 128.5, z: -20, h: Math.PI / 2, color: 0x7a4a9e },
    { x: -128.5, z: 60, h: -Math.PI / 2, color: 0x22242a },
    { x: 30, z: -30, h: 0, color: 0x111114, suv: true },
    { x: -68.5, z: 120, h: Math.PI / 2, color: 0x4a6a72 },
  ];
  for (const d of defs) {
    const mesh = makeCarMesh(d.color, { taxi: !!d.taxi });
    mesh.position.set(d.x, 0, d.z);
    mesh.rotation.y = d.h;
    scene.add(mesh);
    spots.push({ group: mesh, x: d.x, z: d.z, heading: d.h, taken: false, suv: !!d.suv, taxi: !!d.taxi, color: d.color });
  }
  function nearest(x, z, r) {
    let best = null, bd = r;
    for (const s of spots) {
      if (s.taken) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  return { spots, nearest };
}
