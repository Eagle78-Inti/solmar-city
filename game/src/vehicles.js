// Solmar City — vehicles: detailed cars built from primitives with clearcoat
// paint, dark glass cabins, real wheels and working headlights, plus arcade
// driving physics and a traffic system that follows the road grid.
import * as THREE from 'three';
import {
  clamp, lerp, rand, randInt, pick, angleLerp, wrapAngle, dist2, boxGeo,
  cylGeo, stdMat, paintMat, glassMat, glowSprite, PALETTE, V3,
} from './util.js';
import { ROADS } from './city.js';

const TIRE = stdMat({ color: 0x141414, roughness: 0.95 });
const HUB = stdMat({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.85 });
const BUMPER = stdMat({ color: 0x1a1a1c, roughness: 0.6, metalness: 0.4 });
const TRIM = stdMat({ color: 0x0c0c0e, roughness: 0.5, metalness: 0.5 });
const PLATE = stdMat({ color: 0xf2f2e8, roughness: 0.6 });

// Build one detailed car. type: 'sedan' | 'coupe' | 'taxi' | 'van' | 'sport' | 'police'.
export function buildCarMesh(color, type = 'sedan') {
  const g = new THREE.Group();
  const paint = type === 'taxi' ? paintMat(0xf2c200) : type === 'police' ? paintMat(0xf0f0ee) : paintMat(color);
  const isLong = type === 'van';
  const L = isLong ? 5.2 : type === 'coupe' || type === 'sport' ? 4.2 : 4.5;
  const W = 1.95;
  const body = new THREE.Mesh(boxGeo(L, 0.62, W), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  // A slightly narrower, lower nose and tail so the silhouette is not a brick.
  const nose = new THREE.Mesh(boxGeo(0.7, 0.42, W - 0.18), paint);
  nose.position.set(L / 2 - 0.1, 0.48, 0);
  nose.castShadow = true;
  g.add(nose);
  const tail = new THREE.Mesh(boxGeo(0.5, 0.46, W - 0.14), paint);
  tail.position.set(-L / 2 + 0.05, 0.5, 0);
  g.add(tail);
  // Cabin: dark glass with a painted roof panel and pillars.
  const cabin = new THREE.Mesh(boxGeo(L * 0.48, 0.55, W - 0.3), glassMat(0x0e1418));
  cabin.position.set(-L * 0.05, 1.12, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(boxGeo(L * 0.42, 0.09, W - 0.34), paint);
  roof.position.set(-L * 0.05, 1.43, 0);
  roof.castShadow = true;
  g.add(roof);
  // Bumpers, grille, mirrors, plate.
  for (const sx of [1, -1]) {
    const bump = new THREE.Mesh(boxGeo(0.22, 0.3, W - 0.1), BUMPER);
    bump.position.set(sx * (L / 2 + 0.02), 0.34, 0);
    g.add(bump);
  }
  const grille = new THREE.Mesh(boxGeo(0.08, 0.22, 1.1), TRIM);
  grille.position.set(L / 2 + 0.26, 0.55, 0);
  g.add(grille);
  for (const sz of [1, -1]) {
    const mirror = new THREE.Mesh(boxGeo(0.16, 0.1, 0.22), paint);
    mirror.position.set(L * 0.22, 1.05, sz * (W / 2 + 0.06));
    g.add(mirror);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), PLATE);
  plate.position.set(-L / 2 - 0.24, 0.42, 0);
  plate.rotation.y = -Math.PI / 2;
  g.add(plate);
  // Wheels with hubs and a dark arch shadow behind each.
  const wheels = [];
  const wheelR = type === 'sport' ? 0.4 : 0.37;
  for (const [wx, wz] of [[L * 0.32, W / 2 - 0.08], [L * 0.32, -W / 2 + 0.08], [-L * 0.32, W / 2 - 0.08], [-L * 0.32, -W / 2 + 0.08]]) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(cylGeo(wheelR, wheelR, 0.28, 14), TIRE);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);
    const hub = new THREE.Mesh(cylGeo(wheelR * 0.55, wheelR * 0.55, 0.3, 10), HUB);
    hub.rotation.x = Math.PI / 2;
    wg.add(hub);
    // A spoke bar across the hub face so the spin is actually visible.
    const spoke = new THREE.Mesh(boxGeo(wheelR * 1.1, 0.14, 0.32), stdMat({ color: 0x2a2d31, roughness: 0.5, metalness: 0.6 }));
    wg.add(spoke);
    const spoke2 = spoke.clone();
    spoke2.rotation.z = Math.PI / 2;
    wg.add(spoke2);
    wg.position.set(wx, wheelR, wz);
    g.add(wg);
    wheels.push(wg);
  }
  // Headlights: emissive lenses plus a faint glow sprite; taillights red.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xffedb0, emissiveIntensity: 0.25, roughness: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa0a0a, emissive: 0xff1a1a, emissiveIntensity: 0.3, roughness: 0.3 });
  for (const sz of [1, -1]) {
    const hl = new THREE.Mesh(boxGeo(0.1, 0.18, 0.42), headMat);
    hl.position.set(L / 2 + 0.24, 0.62, sz * 0.62);
    g.add(hl);
    const tl = new THREE.Mesh(boxGeo(0.08, 0.16, 0.5), tailMat);
    tl.position.set(-L / 2 - 0.22, 0.62, sz * 0.6);
    g.add(tl);
  }
  // Headlight beams: additive cones that only show at night.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beams = [];
  for (const sz of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 12, 1, true), beamMat);
    cone.rotation.z = -Math.PI / 2 - 0.12;
    cone.position.set(L / 2 + 4.6, 0.5, sz * 0.62);
    g.add(cone);
    beams.push(cone);
  }
  // Type extras.
  if (type === 'taxi') {
    const sign = new THREE.Mesh(boxGeo(0.7, 0.24, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd319, emissiveIntensity: 0.9 }));
    sign.position.set(-L * 0.05, 1.62, 0);
    g.add(sign);
  }
  let lightBar = null;
  if (type === 'police') {
    // Black doors on a white body, plus a flashing light bar.
    for (const sz of [1, -1]) {
      const door = new THREE.Mesh(boxGeo(L * 0.42, 0.5, 0.04), stdMat({ color: 0x14161a, roughness: 0.35, metalness: 0.4 }));
      door.position.set(-L * 0.02, 0.62, sz * (W / 2 + 0.01));
      g.add(door);
    }
    const barBase = new THREE.Mesh(boxGeo(0.5, 0.12, 1.1), TRIM);
    barBase.position.set(-L * 0.05, 1.52, 0);
    g.add(barBase);
    lightBar = { red: null, blue: null };
    const redMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2244ff, emissiveIntensity: 2 });
    const r = new THREE.Mesh(boxGeo(0.4, 0.14, 0.5), redMat);
    r.position.set(-L * 0.05, 1.62, 0.28);
    g.add(r);
    const b = new THREE.Mesh(boxGeo(0.4, 0.14, 0.5), blueMat);
    b.position.set(-L * 0.05, 1.62, -0.28);
    g.add(b);
    lightBar = { red: redMat, blue: blueMat };
    const glowR = glowSprite('#ff2222', 3, 0);
    glowR.position.set(-L * 0.05, 1.7, 0.3);
    g.add(glowR);
    const glowB = glowSprite('#2244ff', 3, 0);
    glowB.position.set(-L * 0.05, 1.7, -0.3);
    g.add(glowB);
    lightBar.glowR = glowR;
    lightBar.glowB = glowB;
  }
  if (type === 'sport') {
    const wing = new THREE.Mesh(boxGeo(0.5, 0.07, 1.7), TRIM);
    wing.position.set(-L / 2 + 0.1, 1.02, 0);
    wing.rotation.z = 0.12;
    g.add(wing);
  }
  g.userData = { wheels, headMat, tailMat, beamMat, lightBar, length: L, width: W, wheelR };
  return g;
}

export class Car {
  constructor(scene, { color = 0xc8102e, type = 'sedan', x = 0, z = 0, heading = 0 } = {}) {
    this.scene = scene;
    this.type = type;
    this.mesh = buildCarMesh(color, type);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.topSpeed = type === 'sport' ? 46 : type === 'van' ? 30 : 38;
    this.accel = type === 'sport' ? 18 : 14;
    this.health = 100;
    this.dead = false;
    this.flashT = Math.random() * 2;
  }
  forward() { return V3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  setLights(nightF) {
    const u = this.mesh.userData;
    u.headMat.emissiveIntensity = 0.25 + nightF * 2.2;
    u.beamMat.opacity = nightF * 0.14;
    u.tailMat.emissiveIntensity = 0.3 + nightF * 1.2;
  }
  updateVisual(dt) {
    const u = this.mesh.userData;
    this.mesh.rotation.y = this.heading;
    // Wheel spin around the axle (group Z) and front-wheel steering (group Y).
    const spin = (this.speed * dt) / u.wheelR;
    for (let i = 0; i < 4; i++) u.wheels[i].rotation.z += spin;
    for (const i of [0, 1]) u.wheels[i].rotation.y = this.steer * 0.42;
    // Body roll and pitch sell the speed.
    this.mesh.rotation.z = -this.steer * clamp(Math.abs(this.speed) / 30, 0, 1) * 0.05;
    this.mesh.rotation.x = clamp(-this.speed * 0.0006, -0.02, 0.03);
    if (u.lightBar) {
      this.flashT += dt * 6;
      const on = Math.sin(this.flashT) > 0;
      u.lightBar.red.emissiveIntensity = on ? 3 : 0.2;
      u.lightBar.blue.emissiveIntensity = on ? 0.2 : 3;
      u.lightBar.glowR.material.opacity = on ? 0.85 : 0.05;
      u.lightBar.glowB.material.opacity = on ? 0.05 : 0.85;
    }
  }
  // Arcade driving. input: { throttle -1..1, steer -1..1, handbrake }.
  // Returns true if it hit a building (for shake / sound).
  drive(input, dt, city, onCrash) {
    const grip = input.handbrake ? 0.55 : 1;
    if (input.throttle > 0) this.speed += this.accel * input.throttle * dt;
    else if (input.throttle < 0) this.speed += (this.speed > 0.5 ? -26 : -10) * dt * -input.throttle;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    if (input.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 14 * dt);
    this.speed = clamp(this.speed, -9, this.topSpeed);
    const turnRate = input.steer * clamp(Math.abs(this.speed) / 7, 0, 1) * (input.handbrake ? 2.6 : 1.9) * grip;
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    this.steer = lerp(this.steer, input.steer, 1 - Math.exp(-8 * dt));
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    city.clampToCity(this.pos);
    const before = { x: this.pos.x, z: this.pos.z };
    city.resolveCircle(this.pos, 1.7);
    if (this.pos.x !== before.x || this.pos.z !== before.z) {
      this.speed *= 0.35;
      if (onCrash && Math.abs(this.speed) > 3) onCrash();
    }
  }
}

// ---- Traffic ----------------------------------------------------------------
// Traffic cars own a road: an axis ('x' runs east-west along a z line, 'z'
// runs north-south along an x line), a line coordinate, a position along it
// and a direction. At each intersection they may turn; they slow for the car
// ahead and stop at red lights, so the streets feel alive instead of scripted.
function laneOffset(axis, dir) {
  // Right-hand traffic: offset to the right of the direction of travel.
  if (axis === 'x') return dir > 0 ? 2.4 : -2.4;
  return dir > 0 ? -2.4 : 2.4;
}

export class TrafficCar extends Car {
  constructor(scene, city, rng) {
    const color = pick(PALETTE.carPaint);
    super(scene, { color, type: pick(['sedan', 'sedan', 'coupe', 'van']), x: 0, z: 0, heading: 0 });
    this.city = city;
    this.axis = rng() < 0.5 ? 'x' : 'z';
    this.line = pick(ROADS);
    this.along = rand(-176, 176);
    this.dir = rng() < 0.5 ? 1 : -1;
    this.cruise = rand(8, 13);
    this.lastJunction = null;
    this.waitT = 0;
    this.sync();
  }
  sync() {
    const off = laneOffset(this.axis, this.dir);
    if (this.axis === 'x') {
      this.pos.x = this.along;
      this.pos.z = this.line + off;
      this.heading = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      this.pos.x = this.line + off;
      this.pos.z = this.along;
      this.heading = this.dir > 0 ? Math.PI : 0;
    }
  }
  update(dt, others, playerCar) {
    const f = this.forward();
    // Car ahead? Slow down or stop.
    let target = this.cruise;
    const all = playerCar ? [...others, playerCar] : others;
    for (const o of all) {
      if (o === this || o.dead) continue;
      const dx = o.pos.x - this.pos.x;
      const dz = o.pos.z - this.pos.z;
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 15 && side < 3.2) {
        target = Math.min(target, ahead < 7 ? 0 : (o.speed ?? 0) * 0.9);
      }
    }
    // Red light ahead at a signalled intersection?
    for (const tl of this.city.trafficLights) {
      const dx = tl.x - this.pos.x;
      const dz = tl.z - this.pos.z;
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 13 && side < 9) {
        const needsNs = this.axis === 'z';
        const green = needsNs ? tl.nsGreen : !tl.nsGreen;
        if (!green) target = 0;
      }
    }
    this.speed = lerp(this.speed, target, 1 - Math.exp(-1.6 * dt));
    this.along += this.speed * this.dir * dt;
    // Junction decision: when crossing a road line, maybe turn.
    const near = ROADS.find((r) => Math.abs(this.along - r) < 1.2);
    if (near !== undefined && near !== this.lastJunction && this.speed > 1) {
      this.lastJunction = near;
      const roll = Math.random();
      if (roll < 0.26) {
        // Turn onto the crossing road.
        const newAxis = this.axis === 'x' ? 'z' : 'x';
        const newLine = near;
        const newAlong = this.line;
        this.axis = newAxis;
        this.line = newLine;
        this.along = newAlong;
        this.dir = Math.random() < 0.5 ? 1 : -1;
      } else if (roll < 0.32) {
        this.dir *= -1; // U-turn, rarely
      }
    }
    if (Math.abs(this.along) > 196) { this.dir *= -1; this.along = clamp(this.along, -196, 196); }
    this.sync();
    this.updateVisual(dt);
  }
}

export function createTraffic(scene, city, count, rng = Math.random) {
  const cars = [];
  for (let i = 0; i < count; i++) cars.push(new TrafficCar(scene, city, rng));
  return cars;
}

export function createParkedCars(scene, city, count) {
  const cars = [];
  const spots = [...city.parkSpots];
  for (let i = 0; i < count && spots.length; i++) {
    const s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const car = new Car(scene, { color: pick(PALETTE.carPaint), type: pick(['sedan', 'coupe', 'sport', 'van']), x: s.x, z: s.z, heading: s.angle });
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

// Push overlapping cars apart so traffic never fuses into one blob.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.4) {
        const push = (4.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        a.speed *= 0.85;
        b.speed *= 0.85;
      }
    }
  }
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (c.dead) continue;
    const d = dist2(x, z, c.pos.x, c.pos.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
