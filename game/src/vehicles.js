// Solmar City — cars: the factory that builds them, traffic that drives them,
// and the arcade physics of the player's own car.

import { clamp, lerp, rand, randInt, pick, turnToward, dist2d } from './util.js';
import { PITCH, HALF, ROAD_W } from './city.js';

const PAINTS = [0xc22e2e, 0x2e5fc2, 0xe8a020, 0x2e8a4a, 0x7a3ec2, 0xd8d8d8, 0x22252a, 0xc2702e, 0x3ec2b0];
const POLICE_PAINT = 0x14161a;

// Build a detailed car from primitives: body, cabin, dark glass, hubbed
// wheels, emissive headlights and taillights, night light beams.
export function makeCar(THREE, opts) {
  const color = opts.police ? POLICE_PAINT : (opts.color ?? pick(PAINTS));
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.25,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.08, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.7, metalness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 2.3), paint);
  roof.position.set(0, 1.48, -0.2);
  g.add(roof);
  // bumpers + grille
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 0.25), dark);
  front.position.set(0, 0.45, 2.28);
  g.add(front);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 0.25), dark);
  rear.position.set(0, 0.45, -2.28);
  g.add(rear);

  // wheels with hubs
  const wheels = [];
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.25, metalness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
    wheels.push(wheel);
  }

  // headlights + taillights (emissive), and soft beam cones for the night
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xffedb0, emissiveIntensity: 0.25 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0d0d, emissive: 0xff2020, emissiveIntensity: 0.7 });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    hl.position.set(sx, 0.72, 2.24);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    tl.position.set(sx, 0.72, -2.24);
    g.add(tl);
  }
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 12, 1, true), beamMat);
  beam.rotation.x = Math.PI / 2 + 0.32;
  beam.position.set(0, 0.55, 5.4);
  g.add(beam);

  if (opts.police) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), barMat);
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 1 }));
    red.position.set(-0.28, 1.62, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2040ff, emissiveIntensity: 1 }));
    blue.position.set(0.28, 1.62, -0.2);
    g.add(blue);
    g.userData.lightBar = { red, blue };
  }
  g.userData.headMat = headMat;
  g.userData.beamMat = beamMat;
  return { group: g, wheels, setNight(night) {
    headMat.emissiveIntensity = night ? 1.8 : 0.25;
    beamMat.opacity = night ? 0.10 : 0.0;
  } };
}

// The player's car: arcade physics — throttle, brake, steering, handbrake.
export function createPlayerCar(THREE, scene, city) {
  const built = makeCar(THREE, { color: 0xc22e2e });
  scene.add(built.group);
  const state = {
    x: 0, z: 40, heading: 0, speed: 0, steer: 0,
    group: built.group, wheels: built.wheels, setNight: built.setNight,
  };
  function update(dt, input, others) {
    const accel = input.up ? 15 : 0;
    const braking = input.down ? 22 : 0;
    if (input.up) state.speed += accel * dt;
    if (input.down) state.speed -= (state.speed > 0.5 ? braking : 10) * dt;
    if (!input.up && !input.down) state.speed -= Math.sign(state.speed) * 6 * dt;
    if (Math.abs(state.speed) < 0.15 && !input.up) state.speed = 0;
    const maxFwd = 40, maxRev = 12;
    state.speed = clamp(state.speed, -maxRev, maxFwd);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    state.steer = lerp(state.steer, steerTarget, Math.min(1, dt * 8));
    const grip = input.handbrake ? 0.45 : 1;
    const turnRate = 1.9 * Math.min(1, Math.abs(state.speed) / 9) * grip * (input.handbrake ? 1.7 : 1);
    state.heading += state.steer * turnRate * dt * Math.sign(state.speed || 1);
    const fx = Math.sin(state.heading), fz = Math.cos(state.heading);
    state.x += fx * state.speed * dt;
    state.z += fz * state.speed * dt;
    // slide a touch with the handbrake
    if (input.handbrake && Math.abs(state.speed) > 8) {
      state.x += -fz * state.steer * 2.2 * dt;
      state.z += fx * state.steer * 2.2 * dt;
    }
    const fixed = city.resolveCollision(state.x, state.z, 2.4);
    if (fixed.x !== state.x || fixed.z !== state.z) {
      state.x = fixed.x;
      state.z = fixed.z;
      state.speed *= 0.55;
    }
    // soft bumps against traffic
    for (const o of others) {
      const d = dist2d(state.x, state.z, o.x, o.z);
      if (d < 4.6 && d > 0.01) {
        const push = (4.6 - d) / 2;
        const nx = (state.x - o.x) / d, nz = (state.z - o.z) / d;
        state.x += nx * push;
        state.z += nz * push;
        state.speed *= 0.8;
      }
    }
    state.x = clamp(state.x, -340, 700);
    state.z = clamp(state.z, -340, 340);
    built.group.position.set(state.x, 0, state.z);
    built.group.rotation.y = state.heading;
    for (const w of built.wheels) w.rotation.x += (state.speed * dt) / 0.42;
    built.wheels[0].rotation.y = state.steer * 0.35;
    built.wheels[1].rotation.y = state.steer * 0.35;
  }
  function reset() {
    state.speed = 0;
    state.heading = 0;
    const p = city.randomStreetPos();
    state.x = p.x;
    state.z = p.z;
  }
  return { state, update, reset, group: built.group, setNight: built.setNight };
}

// --- traffic: lane-following cars that turn at intersections, slow for the
// car ahead, and stop at red lights.
export function createTraffic(THREE, scene, city, count) {
  const cars = [];
  const roadIdx = [];
  for (let i = -HALF; i <= HALF; i++) roadIdx.push(i * PITCH);

  function newTarget(car) {
    // pick a neighbouring intersection on the grid, never straight back
    const options = [];
    const ix = Math.round(car.x / PITCH), iz = Math.round(car.z / PITCH);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx, nz = iz + dz;
      if (nx < -HALF || nx > HALF || nz < -HALF || nz > HALF) continue;
      if (dx === -car.dirX && dz === -car.dirZ && Math.random() < 0.85) continue;
      options.push([nx, nz, dx, dz]);
    }
    const t = pick(options);
    car.targetX = t[0] * PITCH;
    car.targetZ = t[1] * PITCH;
    car.dirX = t[2];
    car.dirZ = t[3];
    // right-hand lane offset
    car.laneX = car.dirX === 0 ? (car.dirZ > 0 ? -4 : 4) : 0;
    car.laneZ = car.dirZ === 0 ? (car.dirX > 0 ? 4 : -4) : 0;
  }

  for (let k = 0; k < count; k++) {
    const built = makeCar(THREE, {});
    scene.add(built.group);
    const start = city.randomStreetPos();
    const car = {
      built, x: start.x, z: start.z, heading: rand(0, Math.PI * 2),
      speed: rand(7, 11), cruise: rand(7, 11), dirX: 1, dirZ: 0,
      targetX: 0, targetZ: 0, laneX: 0, laneZ: 4, stopped: false,
    };
    newTarget(car);
    car.x = car.targetX - car.dirX * rand(20, 120);
    car.z = car.targetZ - car.dirZ * rand(20, 120);
    cars.push(car);
  }

  function update(dt, playerPos) {
    for (const car of cars) {
      const tx = car.targetX + car.laneX;
      const tz = car.targetZ + car.laneZ;
      const dx = tx - car.x, dz = tz - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      car.heading = turnToward(car.heading, wantHeading, 2.6 * dt);
      // slow for the car ahead in the same lane
      let wantSpeed = car.cruise;
      for (const o of cars) {
        if (o === car) continue;
        const ox = o.x - car.x, oz = o.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 15 && side < 3.5) wantSpeed = Math.min(wantSpeed, Math.max(0, o.speed - 1.5));
      }
      // stop at a red light when close to the intersection
      if (dist < 13 && city.lightIsRedAt(car.targetX, car.targetZ)) wantSpeed = 0;
      // ease off when the player is right in front
      if (playerPos) {
        const pd = dist2d(car.x, car.z, playerPos.x, playerPos.z);
        if (pd < 8) wantSpeed = Math.min(wantSpeed, 2);
      }
      car.speed = lerp(car.speed, wantSpeed, Math.min(1, dt * 2.2));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (dist < 3.5) newTarget(car);
      car.built.group.position.set(car.x, 0, car.z);
      car.built.group.rotation.y = car.heading;
      // front wheels track the turn so the car reads as steering
      const steerAngle = Math.sin(car.heading - wantHeading) * -0.4;
      car.built.wheels[0].rotation.y = steerAngle;
      car.built.wheels[1].rotation.y = steerAngle;
      for (const w of car.built.wheels) w.rotation.x += (car.speed * dt) / 0.42;
    }
  }

  function setNight(night) {
    for (const c of cars) c.built.setNight(night);
  }
  return { cars, update, setNight };
}

// Parked cars the player can steal with E.
export function createParkedCars(THREE, scene, city, count) {
  const list = [];
  for (let k = 0; k < count; k++) {
    const built = makeCar(THREE, {});
    scene.add(built.group);
    const alongRoad = Math.random() < 0.5;
    const road = pick([-222, -148, -74, 0, 74, 148, 222]);
    const along = rand(-230, 230);
    const x = alongRoad ? along : road + 6.5;
    const z = alongRoad ? road + 6.5 : along;
    const heading = alongRoad ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading;
    list.push({ built, x, z, heading, taken: false });
  }
  function setNight(night) {
    for (const p of list) p.built.setNight(night);
  }
  return { list, setNight };
}
