import * as THREE from 'three';
// Solmar City — vehicles: detailed car meshes (clearcoat paint, glass
// cabins, hubbed wheels, emissive lights), arcade player-car physics and
// lane-following traffic. All cars are built from primitives, no assets.
import { mulberry32, clamp, lerp, lerpAngle, dist2d, pick, boxGeo, cylGeo, std, paint } from './util.js';
import { ROAD_XS, ROAD_ZS } from './city.js';

const GLASS = new THREE.MeshStandardMaterial({ color: '#0d1520', roughness: 0.12, metalness: 0.9 });
const TYRE = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.95 });
const HUB = new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.3, metalness: 0.9 });
const LIGHT_FRONT = new THREE.MeshStandardMaterial({ color: '#fff8d0', emissive: new THREE.Color('#ffedb0'), emissiveIntensity: 0.15 });
const LIGHT_REAR = new THREE.MeshStandardMaterial({ color: '#7a0d0d', emissive: new THREE.Color('#ff2020'), emissiveIntensity: 0.3 });

export const CAR_COLORS = [0xc22a2a, 0x2a5fc2, 0x222831, 0xd8d8d8, 0x3a7a3a, 0xc2a12a, 0x7a3ac2, 0x2a9a8a];

// Build one detailed car. opts: { police, taxi, sport, color }.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = opts.taxi
    ? paint(0xf2c200, 0.8)
    : paint(opts.color ?? color, opts.sport ? 1.0 : 0.85);
  const body = new THREE.Mesh(boxGeo(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(boxGeo(1.86, 0.34, 0.5), bodyMat);
  nose.position.set(0, 0.5, 2.15); g.add(nose);
  const cabin = new THREE.Mesh(boxGeo(1.66, 0.55, 2.1), GLASS);
  cabin.position.set(0, 1.18, -0.25); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(boxGeo(1.7, 0.09, 2.0), bodyMat);
  roof.position.set(0, 1.48, -0.25); g.add(roof);
  const bumperF = new THREE.Mesh(boxGeo(1.92, 0.22, 0.3), std('#1c1e22', 0.5, 0.4));
  bumperF.position.set(0, 0.38, 2.32); g.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.z = -2.32; g.add(bumperR);
  // Wheels with hubs.
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wg = new THREE.Group();
    const tyre = new THREE.Mesh(cylGeo(0.36, 0.36, 0.28, 14), TYRE);
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; wg.add(tyre);
    const hub = new THREE.Mesh(cylGeo(0.19, 0.19, 0.3, 10), HUB);
    hub.rotation.z = Math.PI / 2; wg.add(hub);
    wg.position.set(wx, 0.36, wz); g.add(wg); wheels.push(wg);
  }
  // Headlights and taillights.
  const headMat = LIGHT_FRONT.clone();
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(boxGeo(0.42, 0.16, 0.08), headMat);
    h.position.set(s * 0.6, 0.72, 2.42); g.add(h);
    const t = new THREE.Mesh(boxGeo(0.42, 0.14, 0.08), LIGHT_REAR.clone());
    t.position.set(s * 0.6, 0.72, -2.42); g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(boxGeo(1.1, 0.14, 0.4), std('#14161a', 0.5));
    bar.position.set(0, 1.58, -0.25); g.add(bar);
    const red = new THREE.Mesh(boxGeo(0.5, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: '#550000', emissive: new THREE.Color('#ff2020'), emissiveIntensity: 0.4 }));
    red.position.set(-0.28, 1.66, -0.25); g.add(red);
    const blue = new THREE.Mesh(boxGeo(0.5, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: '#000055', emissive: new THREE.Color('#2050ff'), emissiveIntensity: 0.4 }));
    blue.position.set(0.28, 1.66, -0.25); g.add(blue);
    g.userData.lightBar = [red.material, blue.material];
    const decal = new THREE.Mesh(boxGeo(1.92, 0.3, 0.1), std('#e8e8e8', 0.6));
    decal.position.set(0, 0.62, 0); g.add(decal);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(boxGeo(0.7, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: '#111111', emissive: new THREE.Color('#ffd23a'), emissiveIntensity: 0.7 }));
    sign.position.set(0, 1.56, -0.25); g.add(sign);
  }
  g.userData.headMat = headMat;
  return { group: g, wheels, headMat };
}

// Point-in-building test used by cars, peds and the player.
export function hitsBuilding(x, z, buildings, margin = 0.6) {
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return true;
  }
  return false;
}

// The player's car: arcade handling with handbrake and a road reset.
export class PlayerCar {
  constructor(scene, city) {
    const { group } = makeCarMesh(0xc22a2a, { sport: true });
    this.mesh = group; scene.add(group);
    this.city = city;
    this.pos = new THREE.Vector3(26, 0, -120);
    this.heading = Math.PI; this.speed = 0; this.steer = 0;
    this.parked = false;
  }
  resetToRoad() {
    const n = this.city.nearestRoad(this.pos.x, this.pos.z);
    this.pos.set(n.x, 0, n.z);
    this.heading = n.axis === 'z' ? 0 : Math.PI / 2;
    this.speed = 0;
  }
  update(dt, input, city, audio) {
    const up = input.has('KeyW') || input.has('ArrowUp');
    const down = input.has('KeyS') || input.has('ArrowDown');
    const left = input.has('KeyA') || input.has('ArrowLeft');
    const right = input.has('KeyD') || input.has('ArrowRight');
    const brake = input.has('Space');
    const maxSpeed = 38, maxRev = -11;
    if (up) this.speed += 26 * dt;
    if (down) this.speed -= this.speed > 0.5 ? 34 * dt : 14 * dt;
    if (brake) this.speed *= Math.max(0, 1 - 3.2 * dt);
    this.speed -= this.speed * 0.55 * dt; // drag + rolling resistance
    this.speed = clamp(this.speed, maxRev, maxSpeed);
    const steerTarget = (left ? 1 : 0) + (right ? -1 : 0);
    const steerAmt = steerTarget * (0.55 + (brake ? 0.5 : 0)) * clamp(Math.abs(this.speed) / 8, 0, 1);
    this.steer = lerp(this.steer, steerAmt, Math.min(1, dt * 7));
    if (Math.abs(this.speed) > 0.4) this.heading += this.steer * dt * (this.speed > 0 ? 1 : -1) * 1.9;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    // Slide along building faces instead of stopping dead.
    if (!hitsBuilding(nx, this.pos.z, city.buildings)) this.pos.x = nx;
    else this.speed *= 0.55;
    if (!hitsBuilding(this.pos.x, nz, city.buildings)) this.pos.z = nz;
    else this.speed *= 0.55;
    this.pos.x = clamp(this.pos.x, -185, 185); this.pos.z = clamp(this.pos.z, -185, 185);
    if (this.pos.x < -168) { this.pos.x = -168; this.speed *= 0.6; } // bay edge
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt * 2.8;
    // Wheel spin is visual only; wheels are children, spin their local x.
    this.mesh.children.forEach((c) => { if (c.type === 'Group' && c.children.length === 2) c.rotation.x += spin; });
    if (audio) audio.setEngine(Math.abs(this.speed) / maxSpeed, true);
    return Math.abs(this.speed) > 0.4;
  }
}

  // Traffic: cars that follow the road grid, turn at intersections and slow
  // for the car ahead. They wrap around the map so the streets stay alive.
  export class Traffic {
    constructor(scene, city) {
      this.city = city; this.scene = scene;
      this.rng = mulberry32(777);
      this.cars = [];
      this.parked = [];
      for (let i = 0; i < 16; i++) this.spawnTraffic(true);
      this.spawnParked();
    }
    randomRoadPoint() {
      const horizontal = this.rng() < 0.5;
      if (horizontal) return { x: -170 + this.rng() * 350, z: pick(this.rng, ROAD_ZS), axis: 'x', dir: this.rng() < 0.5 ? 1 : -1 };
      return { x: pick(this.rng, ROAD_XS), z: -170 + this.rng() * 350, axis: 'z', dir: this.rng() < 0.5 ? 1 : -1 };
    }
    spawnTraffic(anywhere) {
      const p = this.randomRoadPoint();
      const { group } = makeCarMesh(pick(this.rng, CAR_COLORS));
      this.scene.add(group);
      const car = {
        mesh: group, x: p.x, z: p.z, axis: p.axis, dir: p.dir,
        speed: 8 + this.rng() * 4, cruise: 8 + this.rng() * 4,
        lane: (this.rng() < 0.5 ? -1 : 1) * 2.4,
      };
      this.positionCar(car);
      this.cars.push(car);
      return car;
    }
    positionCar(car) {
      const off = car.axis === 'x' ? { x: car.x, z: car.z + car.lane * car.dir } : { x: car.x + car.lane * car.dir, z: car.z };
      car.mesh.position.set(off.x, 0, off.z);
      car.mesh.rotation.y = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    }
    nearestRoadLine(v, list) {
      let best = list[0], bd = 1e9;
      for (const l of list) { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } }
      return best;
    }
    update(dt, playerPos) {
      for (const car of this.cars) {
        // Slow for the car ahead on the same lane.
        let ahead = 99;
        for (const o of this.cars) {
          if (o === car || o.axis !== car.axis || o.dir !== car.dir) continue;
          const along = car.axis === 'x' ? (o.x - car.x) * car.dir : (o.z - car.z) * car.dir;
          const side = car.axis === 'x' ? Math.abs(o.z - car.z) : Math.abs(o.x - car.x);
          if (along > 0 && along < ahead && side < 4) ahead = along;
        }
        const want = ahead < 11 ? 0 : car.cruise;
        // Never rear-end the player's car either.
        const pd = dist2d(car.x, car.z, playerPos.x, playerPos.z);
        const target = pd < 9 ? 0 : want;
        car.speed = lerp(car.speed, target, Math.min(1, dt * 2.2));
        const step = car.speed * car.dir * dt;
        if (car.axis === 'x') car.x += step; else car.z += step;
        // At an intersection, sometimes turn onto the cross street.
        const onX = this.nearestRoadLine(car.x, ROAD_XS);
        const onZ = this.nearestRoadLine(car.z, ROAD_ZS);
        const atX = Math.abs(car.x - onX) < 1.2, atZ = Math.abs(car.z - onZ) < 1.2;
        if (atX && atZ && this.rng() < dt * 0.35) {
          if (car.axis === 'x') { car.axis = 'z'; car.z = onZ; car.dir = this.rng() < 0.5 ? 1 : -1; }
          else { car.axis = 'x'; car.x = onX; car.dir = this.rng() < 0.5 ? 1 : -1; }
          car.lane = (this.rng() < 0.5 ? -1 : 1) * 2.4;
        }
        // Wrap far away from the player so traffic never thins out.
        if (Math.abs(car.x) > 195 || Math.abs(car.z) > 195 || dist2d(car.x, car.z, playerPos.x, playerPos.z) > 260) {
          const p = this.randomRoadPoint();
          car.x = p.x; car.z = p.z; car.axis = p.axis; car.dir = p.dir;
        }
        this.positionCar(car);
      }
    }
    spawnParked() {
      // The black SUV for the Repo Run mission waits at Coral Row.
      const { group: suv } = makeCarMesh(0x111111, { sport: true });
      suv.position.set(140, 0, 100); suv.rotation.y = Math.PI / 2;
      this.scene.add(suv);
      this.parked.push({ mesh: suv, x: 140, z: 100, color: 0x111111, suv: true });
      for (let i = 0; i < 9; i++) {
        const horizontal = this.rng() < 0.5;
        const x = horizontal ? -160 + this.rng() * 330 : pick(this.rng, ROAD_XS) + 7.5;
        const z = horizontal ? pick(this.rng, ROAD_ZS) + 7.5 : -160 + this.rng() * 330;
        const { group } = makeCarMesh(pick(this.rng, CAR_COLORS));
        group.position.set(x, 0, z);
        group.rotation.y = horizontal ? Math.PI / 2 : 0;
        this.scene.add(group);
        this.parked.push({ mesh: group, x, z, color: group.children[0].material.color.getHex() });
      }
      // One yellow taxi idles near the beach road.
      const { group } = makeCarMesh(0xf2c200, { taxi: true });
      group.position.set(-142, 0, 24); group.rotation.y = Math.PI / 2;
      this.scene.add(group);
      this.taxi = { mesh: group, x: -142, z: 24, hired: false };
    }
    nearestStealable(x, z, r = 5) {
      let best = null, bd = r;
      for (const p of this.parked) {
        const d = dist2d(x, z, p.x, p.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }
  }
