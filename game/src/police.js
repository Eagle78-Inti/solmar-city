// Solmar City v8 — the wanted system: police cars that chase and ram, and a
// helicopter at 4+ stars. v8 makes the helicopter clearly visible at night: a
// lit white body, bright red/green nav lights, a blinking strobe, a rotor blur
// disc and its own under-light, so it reads against the night sky.
import * as THREE from 'three';
import { clamp, dist2, lerpAngle, mulberry32 } from './util.js';
import { makeCarMesh, stepCar } from './vehicles.js';
import { CITY } from './city.js';

function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 5.2), bodyMat);
  body.position.y = 0;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.8), new THREE.MeshLambertMaterial({ color: 0x101418, emissive: 0x223344, emissiveIntensity: 0.4 }));
  glass.position.set(0, 0.25, 2.0);
  g.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.2), bodyMat);
  boom.position.set(0, 0.3, -4.2);
  g.add(boom);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), new THREE.MeshLambertMaterial({ color: 0xd42a2a }));
  tailFin.position.set(0, 0.9, -6.0);
  g.add(tailFin);
  // Main rotor: a translucent blur disc that spins, plus two blade boxes.
  const blurMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), blurMat);
  blur.rotation.x = -Math.PI / 2;
  blur.position.y = 1.35;
  g.add(blur);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.08, 0.5), bladeMat);
  blade.position.y = 1.35;
  g.add(blade);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3), bladeMat);
  tailRotor.position.set(0.45, 0.9, -5.9);
  g.add(tailRotor);
  // Nav lights: red port, green starboard, white strobe on the tail.
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navRed.position.set(-1.45, -0.4, 0.5);
  g.add(navRed);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff44 }));
  navGreen.position.set(1.45, -0.4, 0.5);
  g.add(navGreen);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, -0.5, -6.2);
  g.add(strobe);
  // Searchlight: a real spotlight plus a translucent cone so the beam reads.
  const spot = new THREE.SpotLight(0xfff2c0, 0, 90, 0.32, 0.45, 1.2);
  spot.position.set(0, -0.9, 1.2);
  g.add(spot);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 26, 16, 1, true), coneMat);
  cone.position.set(0, -13.5, 1.2);
  cone.rotation.x = Math.PI;
  g.add(cone);
  // Under-light: a soft white point light so the body itself is visible at night.
  const under = new THREE.PointLight(0xffffff, 0, 26, 1.6);
  under.position.set(0, -1.2, 0);
  g.add(under);
  g.userData = { bodyMat, blur, blade, tailRotor, strobe, spot, cone, coneMat, under, navRed, navGreen };
  return g;
}

export class Police {
  constructor(scene, colliders, audio) {
    this.scene = scene;
    this.colliders = colliders;
    this.audio = audio;
    this.wanted = 0;
    this.lastCrimeAt = -100;
    this.cars = [];
    this.helis = [];
    this.rng = mulberry32(99);
    this.bustTimer = 0;
    this.time = 0;
  }

  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.lastCrimeAt = this.time;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.lastCrimeAt = this.time;
  }

  spawnCarNear(playerPos) {
    const mesh = makeCarMesh(0x111111, { police: true });
    const ang = this.rng() * Math.PI * 2;
    const car = {
      group: mesh,
      x: clamp(playerPos.x + Math.sin(ang) * 55, CITY.minX, CITY.maxX),
      z: clamp(playerPos.z + Math.cos(ang) * 55, CITY.minZ, CITY.maxZ),
      heading: ang + Math.PI,
      speed: 0,
      hp: 3,
      maxSpeed: 38,
    };
    mesh.position.set(car.x, 0, car.z);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  spawnHeli(playerPos) {
    const mesh = makeHeliMesh();
    const heli = {
      group: mesh,
      angle: this.rng() * Math.PI * 2,
      radius: 26,
      height: 24,
      x: playerPos.x,
      z: playerPos.z,
    };
    mesh.position.set(heli.x, heli.height, heli.z);
    this.scene.add(mesh);
    // The spotlight target lives in world space (not under the heli group),
    // so its position is the player's real position each frame.
    this.scene.add(mesh.userData.spot.target);
    this.helis.push(heli);
    return heli;
  }

  update(dt, player, night, onBusted, onPlayerDamage) {
    this.time += dt;
    const p = player.pos;
    // Wanted decays after 25 crime-free seconds with no police close by.
    const nearestPolice = this.cars.length ? Math.min(...this.cars.map((c) => dist2(c.x, c.z, p.x, p.z))) : 999;
    if (this.wanted > 0 && this.time - this.lastCrimeAt > 25 && nearestPolice > 45 && this.helis.length === 0) {
      this.wanted = Math.max(0, this.wanted - dt * 0.25);
      if (this.wanted < 0.5) this.wanted = 0;
    }
    const want = Math.round(this.wanted);
    // Police cars: 1 per star up to 4, plus one more at 5 stars.
    const wantCars = want === 0 ? 0 : Math.min(2 + want, 6);
    while (this.cars.length < wantCars) this.spawnCarNear(p);
    while (this.cars.length > wantCars) {
      const c = this.cars.pop();
      this.scene.remove(c.group);
    }
    // Helicopters: one at 4 stars, two at 5.
    const wantHelis = want >= 5 ? 2 : want >= 4 ? 1 : 0;
    while (this.helis.length < wantHelis) this.spawnHeli(p);
    while (this.helis.length > wantHelis) {
      const h = this.helis.pop();
      this.scene.remove(h.group);
    }
    // Chase: steer toward the player, ram when close.
    for (const car of this.cars) {
      const targetHeading = Math.atan2(p.x - car.x, p.z - car.z);
      const input = {
        forward: true,
        back: false,
        left: false,
        right: false,
      };
      const diff = lerpAngle(car.heading, targetHeading, 1);
      if (diff > 0.12) input.left = true;
      if (diff < -0.12) input.right = true;
      const before = car.speed;
      const res = stepCar(car, dt, input, this.colliders);
      if (res.crashed && Math.abs(before) > 8) this.audio.crash(0.6);
      const d = dist2(car.x, car.z, p.x, p.z);
      if (d < 3.4) {
        // Ram: shove the player's car and hurt the player.
        if (player.inCar) {
          player.inCar.speed *= 0.55;
          player.inCar.heading += (Math.random() - 0.5) * 0.3;
        }
        if (onPlayerDamage) onPlayerDamage(4 * dt * 10);
        this.audio.crash(0.3);
      }
      // Flash the light bar.
      const phase = Math.floor(this.time * 6) % 2 === 0;
      if (car.group.userData.lightRed) car.group.userData.lightRed.material.emissiveIntensity = phase ? 2.2 : 0.2;
      if (car.group.userData.lightBlue) car.group.userData.lightBlue.material.emissiveIntensity = phase ? 0.2 : 2.2;
    }
    // Helicopters: orbit the player, spotlight tracking them.
    for (const heli of this.helis) {
      heli.angle += dt * 0.32;
      heli.x = p.x + Math.sin(heli.angle) * heli.radius;
      heli.z = p.z + Math.cos(heli.angle) * heli.radius;
      heli.group.position.set(heli.x, heli.height, heli.z);
      heli.group.rotation.y = Math.atan2(p.x - heli.x, p.z - heli.z);
      const u = heli.group.userData;
      u.blade.rotation.y += dt * 22;
      u.tailRotor.rotation.x += dt * 30;
      // Strobe blinks on and off; nav lights stay bright; body glow and
      // under-light keep the helicopter visible against the night sky.
      const blink = Math.sin(this.time * 7) > 0.6;
      u.strobe.visible = blink;
      u.bodyMat.emissiveIntensity = night ? 0.55 : 0.12;
      u.under.intensity = night ? 26 : 4;
      u.spot.intensity = night ? 900 : 220;
      u.coneMat.opacity = night ? 0.2 : 0.07;
      u.spot.target.position.set(p.x, 0, p.z);
      u.spot.target.updateMatrixWorld();
    }
    this.audio.setSiren(want > 0);
    // Busted: on foot, a police car within 2.5 units for 3 seconds.
    if (!player.inCar && !player.onBoat && want > 0) {
      if (nearestPolice < 2.5) {
        this.bustTimer += dt;
        if (this.bustTimer > 3 && onBusted) onBusted();
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
  }

  // A pistol hit on a police car: 3 hits disable it.
  damageCar(car) {
    car.hp -= 1;
    if (car.hp <= 0) {
      car.disabled = true;
      car.group.userData.headMat.emissiveIntensity = 0;
      const idx = this.cars.indexOf(car);
      if (idx >= 0) {
        this.scene.remove(car.group);
        this.cars.splice(idx, 1);
      }
      return true;
    }
    return false;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.group);
    for (const h of this.helis) this.scene.remove(h.group);
    this.cars = [];
    this.helis = [];
    this.wanted = 0;
    this.bustTimer = 0;
  }
}
