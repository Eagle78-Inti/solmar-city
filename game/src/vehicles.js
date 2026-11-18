// Solmar City — vehicles: car meshes, arcade driving physics, traffic AI,
// parked cars you can steal. No physics engine; everything is hand-rolled.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, angleDiff } from './util.js';
import { BLOCK, GRID, CITY_R } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3fae6a, 0x8a5fc2, 0xe8e8e8, 0x22262c, 0xd97b2e, 0x4ec9c2, 0xb03a6b];

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x18242e, shininess: 90 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), bodyMat);
  body.position.y = 0.65; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 1.8), glassMat);
  cabin.position.set(-0.25, 1.4, 0); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  g.userData.wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); g.userData.wheels.push(w);
  }
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const z of [0.7, -0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), hl);
    h.position.set(2.22, 0.7, z); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), tl);
    t.position.set(-2.22, 0.7, z); g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(-0.25, 1.9, 0); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.25, 2.02, 0.35); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.set(-0.25, 2.02, -0.35); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.rotation.y = Math.PI / 2; door.position.set(0.2, 0.8, 1.02); g.add(door);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(-0.25, 1.95, 0); g.add(sign);
  }
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, opts = {}) {
    this.scene = scene;
    this.mesh = makeCarMesh(color, opts);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.maxSpeed = opts.maxSpeed || 38;
    this.accel = opts.accel || 15;
    this.health = 100;
    this.color = color;
    this.opts = opts;
    this.smokeTimer = 0;
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  // input: {throttle (-1..1), steer (-1..1), handbrake}
  drive(dt, input, city) {
    const maxF = this.maxSpeed, maxR = 10;
    if (input.throttle > 0) this.speed += this.accel * input.throttle * dt;
    else if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= 26 * dt; // brake
      else this.speed -= 9 * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * 6 * dt;
      if (Math.abs(this.speed) < 0.3) this.speed = 0;
    }
    if (input.handbrake) this.speed -= Math.sign(this.speed) * 18 * dt;
    this.speed = clamp(this.speed, -maxR, maxF);
    const steerAuthority = clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += input.steer * steerAuthority * (input.handbrake ? 2.6 : 1.9) * Math.sign(this.speed || 1) * dt;
    const f = this.forward();
    const nx = this.x + f.x * this.speed * dt;
    const nz = this.z + f.z * this.speed * dt;
    // collide at front and rear circles
    const front = city.collideCircle(nx + f.x * 1.6, nz + f.z * 1.6, 1.5);
    const rear = city.collideCircle(nx - f.x * 1.6, nz - f.z * 1.6, 1.5);
    const hit = Math.abs(front.x - (nx + f.x * 1.6)) > 0.01 || Math.abs(front.z - (nz + f.z * 1.6)) > 0.01 ||
      Math.abs(rear.x - (nx - f.x * 1.6)) > 0.01 || Math.abs(rear.z - (nz - f.z * 1.6)) > 0.01;
    if (hit) {
      if (Math.abs(this.speed) > 12) this.health -= (Math.abs(this.speed) - 12) * 0.6;
      this.speed *= 0.35;
    }
    this.x = (front.x + rear.x) / 2; this.z = (front.z + rear.z) / 2;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin + body lean
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.y += spin;
    this.mesh.rotation.z = -input.steer * 0.05 * clamp(Math.abs(this.speed) / 20, 0, 1);
    this.mesh.rotation.x = clamp(-input.throttle * 0.02, -0.03, 0.03);
    return hit;
  }
  damage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
  dispose() { this.scene.remove(this.mesh); }
}

export class Traffic {
  constructor(scene, city, count = 16) {
    this.scene = scene; this.city = city;
    this.cars = [];
    for (let i = 0; i < count; i++) this.cars.push(this.spawnRandom());
  }
  spawnRandom() {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = randInt(-GRID, GRID) * BLOCK;
    const along = rand(-CITY_R, CITY_R);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 3.5 : -3.5;
    const x = axis === 'x' ? road + lane : along;
    const z = axis === 'x' ? along : road + lane;
    const heading = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    const car = new Car(this.scene, x, z, heading, pick(CAR_COLORS), { maxSpeed: rand(10, 16), accel: 8 });
    car.axis = axis; car.road = road; car.dir = dir; car.cruise = rand(10, 16);
    car.targetSpeed = car.cruise;
    return car;
  }
  update(dt, playerCar, playerPos) {
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      // slow for the car ahead on the same lane
      let want = c.cruise;
      for (const o of this.cars) {
        if (o === c || o.axis !== c.axis || o.road !== c.road || o.dir !== c.dir) continue;
        const ahead = c.axis === 'x' ? (o.z - c.z) * c.dir : (o.x - c.x) * c.dir;
        const lateral = c.axis === 'x' ? Math.abs(o.x - c.x) : Math.abs(o.z - c.z);
        if (ahead > 0 && ahead < 14 && lateral < 5) { want = Math.min(want, Math.max(0, (ahead - 8))); break; }
      }
      // slow for the player's car ahead
      if (playerCar) {
        const dx = playerCar.x - c.x, dz = playerCar.z - c.z;
        const f = c.forward();
        const ahead = dx * f.x + dz * f.z;
        const lat = Math.abs(dx * -f.z + dz * f.x);
        if (ahead > 0 && ahead < 12 && lat < 4) want = 0;
      }
      // gentle steering toward the lane line
      const f = c.forward();
      const pos = c.axis === 'x' ? c.x : c.z;
      const laneTarget = c.road + (c.dir > 0 ? 3.5 : -3.5);
      const err = laneTarget - pos;
      const steer = clamp(err * 0.08, -0.5, 0.5);
      const throttle = c.speed < want ? 1 : (c.speed > want + 1 ? -0.5 : 0);
      c.drive(dt, { throttle, steer, handbrake: false }, this.city);
      // maybe turn at an intersection
      const along = c.axis === 'x' ? c.z : c.x;
      const nearCross = Math.abs(along - Math.round(along / BLOCK) * BLOCK) < 2;
      if (nearCross && Math.random() < dt * 0.25) {
        const cross = Math.round(along / BLOCK) * BLOCK;
        if (Math.abs(cross) <= GRID * BLOCK && Math.random() < 0.4) {
          // turn onto the crossing road
          const newAxis = c.axis === 'x' ? 'z' : 'x';
          const newDir = Math.random() < 0.5 ? 1 : -1;
          const newRoad = cross;
          const newLane = newDir > 0 ? 3.5 : -3.5;
          if (newAxis === 'x') { c.x = newRoad + newLane; }
          else { c.z = newRoad + newLane; }
          c.axis = newAxis; c.road = newRoad; c.dir = newDir;
          c.heading = newAxis === 'x' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
      }
      // respawn if out of bounds
      if (Math.abs(c.x) > CITY_R + 30 || Math.abs(c.z) > CITY_R + 30) {
        const repl = this.spawnRandom();
        c.dispose();
        this.cars[i] = repl;
      }
    }
  }
}

export class ParkedCars {
  constructor(scene, city, count = 14) {
    this.scene = scene; this.city = city;
    this.list = [];
    for (let i = 0; i < count; i++) {
      const road = randInt(-GRID, GRID) * BLOCK;
      const along = rand(-CITY_R + 20, CITY_R - 20);
      const side = Math.random() < 0.5 ? 1 : -1;
      const horizontal = Math.random() < 0.5;
      const x = horizontal ? road + side * 8.5 : along;
      const z = horizontal ? along : road + side * 8.5;
      const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const mesh = makeCarMesh(pick(CAR_COLORS));
      mesh.position.set(x, 0, z); mesh.rotation.y = heading;
      scene.add(mesh);
      this.list.push({ mesh, x, z, heading, color: mesh.children[0].material.color.getHex(), health: 100 });
    }
  }
  // nearest parked car within radius of a point
  nearest(x, z, r) {
    let best = null, bd = r;
    for (const p of this.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  remove(p) {
    this.scene.remove(p.mesh);
    this.list.splice(this.list.indexOf(p), 1);
  }
  addCar(car) {
    this.list.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, color: car.color, health: car.health });
  }
}
