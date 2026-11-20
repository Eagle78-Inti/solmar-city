// Solmar City v8 — vehicles: procedural car/boat meshes, arcade driving physics,
// traffic that follows the road grid, and drivable boats on the bay.
import * as THREE from 'three';
import { clamp, lerp, lerpAngle, mulberry32, pick, circleHitsBox } from './util.js';
import { CITY } from './city.js';

const BODY_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400];

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 2.3), darkMat);
  cabin.position.set(0, 1.12, -0.25);
  g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.7), bodyMat);
  nose.position.set(0, 0.5, 2.35);
  g.add(nose);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0xfff2a0, emissiveIntensity: 0.25 });
  for (const hx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    h.position.set(hx, 0.62, 2.72);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 0.35 });
  for (const tx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), tailMat);
    t.position.set(tx, 0.62, -2.24);
    g.add(t);
  }
  if (opts.police) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), barMat);
    bar.position.set(0, 1.5, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.52), new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 }));
    red.position.set(-0.3, 1.52, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.52), new THREE.MeshLambertMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1 }));
    blue.position.set(0.3, 1.52, -0.25);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.headMat = headMat;
  g.userData.tailMat = tailMat;
  g.userData.wheels = wheels;
  return g;
}

// Arcade car physics: speed along heading, steering that bites with speed,
// simple circle-vs-building collision. Returns { crashed, speedKmh }.
export function stepCar(car, dt, input, colliders) {
  const maxSpeed = car.maxSpeed ?? 34;
  const maxReverse = 10;
  const accel = 22;
  const brake = 34;
  if (input.forward) car.speed += accel * dt;
  if (input.back) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= accel * 0.55 * dt;
  }
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * 9 * dt;
  if (Math.abs(car.speed) < 0.15 && !input.forward && !input.back) car.speed = 0;
  car.speed = clamp(car.speed, -maxReverse, maxSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  const dir = car.speed >= 0 ? 1 : -1;
  if (input.left) car.heading += steerAuthority * dt * dir;
  if (input.right) car.heading -= steerAuthority * dt * dir;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  let crashed = false;
  const inWater = nx < CITY.waterX + 2;
  const outOfBounds = nx < CITY.minX - 4 || nx > CITY.maxX + 4 || nz < CITY.minZ - 4 || nz > CITY.maxZ + 4;
  let hit = inWater || outOfBounds;
  if (!hit) {
    for (const b of colliders) {
      if (circleHitsBox(nx, nz, 1.7, b)) { hit = true; break; }
    }
  }
  if (hit) {
    if (Math.abs(car.speed) > 6) crashed = true;
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.2;
  for (const w of car.group.userData.wheels) w.rotation.x += spin;
  return { crashed, speedKmh: Math.abs(car.speed) * 3.6 };
}

// Traffic: cars that cruise the road grid, turning at intersections, slowing
// for the car ahead. They despawn far from the player and respawn nearby.
export class Traffic {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = mulberry32(777);
    this.cars = [];
    this.roads = [];
    for (let v = -240; v <= 240; v += 60) this.roads.push(v);
    for (let i = 0; i < 22; i++) this.spawnCar(true);
  }

  spawnCar(anywhere = false) {
    const rng = this.rng;
    const horizontal = rng() < 0.5;
    const line = pick(rng, this.roads);
    const along = -240 + rng() * 480;
    const color = pick(rng, BODY_COLORS);
    const mesh = makeCarMesh(color);
    const car = {
      group: mesh,
      x: horizontal ? along : line + (rng() < 0.5 ? 3 : -3),
      z: horizontal ? line + (rng() < 0.5 ? 3 : -3) : along,
      heading: horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      speed: 8 + rng() * 6,
      horizontal,
      line,
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  update(dt, playerPos, night) {
    for (const car of this.cars) {
      // Slow down for a car directly ahead — traffic or the player's own car.
      let blocked = false;
      if (playerPos) {
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
        const side = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
        if (ahead > 0 && ahead < 10 && side < 2.6) blocked = true;
      }
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
        const side = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.speed;
      const cur = car.cruise ?? car.speed;
      car.cruise = lerp(cur, target, clamp(dt * 2, 0, 1));
      car.x += Math.sin(car.heading) * car.cruise * dt;
      car.z += Math.cos(car.heading) * car.cruise * dt;
      // Turn at intersections when the road ends or at random.
      const atEnd = car.horizontal
        ? (car.x > 288 || car.x < -228)
        : (car.z > 288 || car.z < -288);
      const atJunction = Math.abs((car.horizontal ? car.x : car.z) % 60) < 1.5;
      if ((atEnd || (atJunction && this.rng() < 0.004)) && !car.turning) {
        car.turning = true;
        const turnLeft = this.rng() < 0.5;
        car.targetHeading = car.heading + (turnLeft ? Math.PI / 2 : -Math.PI / 2);
        const cross = car.horizontal ? car.z : car.x;
        const snapped = Math.round(cross / 60) * 60;
        if (car.horizontal) car.z = snapped + (turnLeft ? 3 : -3);
        else car.x = snapped + (turnLeft ? -3 : 3);
        car.horizontal = !car.horizontal;
      }
      if (car.turning) {
        car.heading = lerpAngle(car.heading, car.targetHeading, clamp(dt * 3, 0, 1));
        if (Math.abs(car.heading - car.targetHeading) < 0.05) {
          car.heading = car.targetHeading;
          car.turning = false;
        }
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      car.group.userData.headMat.emissiveIntensity = night ? 1.6 : 0.25;
      // Recycle cars that drifted far from the player.
      if (playerPos && Math.hypot(car.x - playerPos.x, car.z - playerPos.z) > 340) {
        this.scene.remove(car.group);
        const idx = this.cars.indexOf(car);
        if (idx >= 0) this.cars.splice(idx, 1);
        this.spawnCar();
      }
    }
  }
}

export function makeBoatMesh(color = 0xf2f2f2) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 8.5), hullMat);
  hull.position.y = 0.55;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.55, 5.2);
  bow.scale.set(1, 1, 0.7);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.2), new THREE.MeshLambertMaterial({ color: 0x14324a }));
  cabin.position.set(0, 1.6, -0.6);
  g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.25, 8.6), new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.3 }));
  stripe.position.y = 1.12;
  g.add(stripe);
  return g;
}

// Boat physics: slower, driftier than a car, and only on water.
export function stepBoat(boat, dt, input) {
  const accel = 10;
  if (input.forward) boat.speed += accel * dt;
  if (input.back) boat.speed -= accel * 0.6 * dt;
  if (!input.forward && !input.back) boat.speed -= Math.sign(boat.speed) * 4 * dt;
  if (Math.abs(boat.speed) < 0.1 && !input.forward && !input.back) boat.speed = 0;
  boat.speed = clamp(boat.speed, -6, 22);
  const steer = clamp(Math.abs(boat.speed) / 8, 0, 1) * 1.1;
  const dir = boat.speed >= 0 ? 1 : -1;
  if (input.left) boat.heading += steer * dt * dir;
  if (input.right) boat.heading -= steer * dt * dir;
  boat.x += Math.sin(boat.heading) * boat.speed * dt;
  boat.z += Math.cos(boat.heading) * boat.speed * dt;
  // Stay in the bay and off the beach: push back onto the water.
  if (boat.x > CITY.waterX + 4) { boat.x = CITY.waterX + 4; boat.speed *= 0.5; }
  if (boat.x < -420 || boat.z < -330 || boat.z > 330) { boat.speed *= -0.3; }
  boat.group.position.set(boat.x, 0.25 + Math.sin(performance.now() * 0.0012) * 0.08, boat.z);
  boat.group.rotation.y = boat.heading;
  boat.group.rotation.z = Math.sin(performance.now() * 0.0009) * 0.02;
  return { speedKmh: Math.abs(boat.speed) * 3.6 };
}
