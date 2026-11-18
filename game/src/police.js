// Solmar City — the law: wanted stars, police pursuit cars, bust logic,
// and the police helicopter that circles at 4–5 stars.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, angleDiff } from './util.js';
import { BLOCK, GRID, CITY_R } from './city.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.wanted = 0;         // 0..5 stars
    this.heat = 0;           // 0..100, builds with crimes
    this.calmTimer = 0;
    this.cars = [];          // pursuing Car instances
    this.bustTimer = 0;
    this.heli = null;
    this.heliAngle = 0;
    this.flashT = 0;
    this.frozen = false;     // screenshot mode: hold staged positions
  }
  addCrime(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = this.heat < 12 ? 0 : this.heat < 28 ? 1 : this.heat < 45 ? 2 : this.heat < 62 ? 3 : this.heat < 82 ? 4 : 5;
    if (stars > this.wanted) this.wanted = stars;
    this.calmTimer = 0;
  }
  spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
    tail.position.set(-3, 0.2, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.0; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tailRotor.position.set(-4.4, 0.4, 0); g.add(tailRotor);
    // searchlight cone (additive so it glows against the night sky)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    cone.rotation.x = Math.PI; cone.position.y = -16; g.add(cone);
    const spot = new THREE.PointLight(0xfff2b0, 60, 60, 1.6);
    spot.position.y = -2; g.add(spot);
    this.scene.add(g);
    this.heli = { mesh: g, rotor, cone };
  }
  update(dt, player, audio) {
    const pos = player.pos();
    const inCar = !!player.inCar;
    this.flashT += dt;
    // ---- wanted decay when the heat is off ----
    if (this.wanted > 0) {
      const nearest = this.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - pos.x, c.z - pos.z)), 9999);
      if (nearest > 70) this.calmTimer += dt; else this.calmTimer = 0;
      if (this.calmTimer > 9) {
        this.wanted--; this.calmTimer = 0;
        if (this.wanted === 0) this.heat = 0;
      }
    }
    // ---- spawn / despawn pursuit cars ----
    const want = this.wanted === 0 ? 0 : this.wanted + 1;
    while (this.cars.length < want) {
      const a = rand(0, Math.PI * 2);
      const x = clamp(pos.x + Math.sin(a) * 90, -CITY_R, CITY_R);
      const z = clamp(pos.z + Math.cos(a) * 90, -CITY_R, CITY_R);
      const snap = this.city.nearestRoadPoint(x, z);
      const car = new Car(this.scene, snap.x, snap.z, rand(0, Math.PI * 2), 0xf2f2f2,
        { police: true, maxSpeed: 30 + this.wanted * 1.6, accel: 17 });
      this.cars.push(car);
    }
    while (this.cars.length > want) this.cars.pop().dispose();
    // ---- pursuit ----
    let nearestDist = 9999;
    for (const c of this.cars) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      if (!this.frozen) {
        const targetHeading = Math.atan2(dx, dz);
        const steer = clamp(angleDiff(c.heading, targetHeading) * 1.6, -1, 1);
        const throttle = dist > 4 ? 1 : 0.4;
        c.drive(dt, { throttle, steer, handbrake: false }, this.city);
      }
      // flash the light bar
      const on = Math.sin(this.flashT * 14) > 0;
      if (c.mesh.userData.lightRed) c.mesh.userData.lightRed.material.color.setHex(on ? 0xff2020 : 0x551010);
      if (c.mesh.userData.lightBlue) c.mesh.userData.lightBlue.material.color.setHex(on ? 0x102050 : 0x2050ff);
      // ramming the player's car
      if (inCar && dist < 3.6) {
        const pc = player.inCar;
        pc.health -= dt * 14;
        pc.speed *= 0.92;
        if (pc.health <= 0) { /* car wrecked — handled by main */ }
      }
    }
    // ---- bust: slow + close police on foot or in a dead car ----
    const playerSlow = inCar ? Math.abs(player.inCar.speed) < 3 : true;
    if (this.wanted > 0 && nearestDist < 6 && playerSlow) {
      this.bustTimer += dt;
    } else this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    // ---- helicopter at 4+ stars ----
    if (this.wanted >= 4 && !this.heli) this.spawnHeli();
    if (this.wanted < 4 && this.heli) {
      this.scene.remove(this.heli.mesh);
      this.heli = null;
    }
    if (this.heli) {
      if (!this.frozen) this.heliAngle += dt * 0.45;
      let hx, hz, hy;
      if (this.frozen) {
        // staged for the camera: ahead and to the side, low enough to see
        const heading = player.inCar ? player.inCar.heading : player.heading;
        const fx = Math.sin(heading), fz = Math.cos(heading);
        hx = pos.x + fx * 30 - fz * 14;
        hz = pos.z + fz * 30 + fx * 14;
        hy = 16;
      } else {
        hx = pos.x + Math.sin(this.heliAngle) * 26;
        hz = pos.z + Math.cos(this.heliAngle) * 26;
        hy = 42 + Math.sin(this.heliAngle * 2) * 2;
      }
      this.heli.mesh.position.set(hx, hy, hz);
      this.heli.mesh.rotation.y = Math.atan2(pos.x - hx, pos.z - hz);
      this.heli.rotor.rotation.y += dt * 22;
    }
    if (audio) audio.setSiren(this.wanted > 0, nearestDist);
    return this.bustTimer > 3;
  }
  clear() {
    this.wanted = 0; this.heat = 0; this.bustTimer = 0;
    for (const c of this.cars) c.dispose();
    this.cars = [];
    if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
  }
}
