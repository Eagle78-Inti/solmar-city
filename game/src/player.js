// Solmar City — Rook on foot: third-person walking, sprinting, entering and
// exiting cars. Camera-relative movement; the camera lives in main.js.
import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './util.js';

export class Player {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.x = 26; this.z = 60; this.heading = 0;
    this.speed = 0; this.health = 100;
    this.inCar = null;      // a Car instance when driving
    this.walkPhase = 0;
    this.mesh = this.buildMesh();
    scene.add(this.mesh);
    this.mesh.position.set(this.x, 0, this.z);
  }
  buildMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
    torso.position.y = 1.15; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.82; head.castShadow = true; g.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), hair);
    hairM.position.y = 2.05; g.add(hairM);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), pants);
    this.legL.position.set(-0.18, 0.4, 0); this.legL.geometry.translate(0, -0.4, 0);
    this.legL.position.y = 0.8; g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), pants);
    this.legR.position.set(0.18, 0.4, 0); this.legR.geometry.translate(0, -0.4, 0);
    this.legR.position.y = 0.8; g.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), skin);
    this.armL.position.set(-0.48, 1.5, 0); this.armL.geometry.translate(0, -0.35, 0);
    g.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), skin);
    this.armR.position.set(0.48, 1.5, 0); this.armR.geometry.translate(0, -0.35, 0);
    g.add(this.armR);
    return g;
  }
  // input: {mx, mz} camera-relative move axes, sprint; camYaw is the camera yaw.
  update(dt, input, camYaw) {
    if (this.inCar) return;
    const mx = input.mx, mz = input.mz;
    const moving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;
    const targetSpeed = moving ? (input.sprint ? 8.5 : 4.6) : 0;
    this.speed = lerp(this.speed, targetSpeed, Math.min(1, dt * 8));
    if (moving) {
      // camera-relative direction: camera looks along -Z rotated by camYaw
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = fx * mz + rx * mx;
      const dz = fz * mz + rz * mx;
      const len = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx / len, dz / len);
      this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 12));
      const nx = this.x + (dx / len) * this.speed * dt;
      const nz = this.z + (dz / len) * this.speed * dt;
      const p = this.city.collideCircle(nx, nz, 0.6);
      this.x = p.x; this.z = p.z;
      this.walkPhase += dt * this.speed * 1.6;
      const swing = Math.sin(this.walkPhase) * (this.speed > 0.5 ? 0.55 : 0);
      this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8; this.armR.rotation.x = swing * 0.8;
    } else {
      this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8; this.armR.rotation.x *= 0.8;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;
  }
  enterCar(car) {
    this.inCar = car;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.inCar) return null;
    const car = this.inCar;
    this.inCar = null;
    const f = car.forward();
    // step out on the left side
    const sx = car.x + -f.z * 2.2, sz = car.z + f.x * 2.2;
    const p = this.city.collideCircle(sx, sz, 0.6);
    this.x = p.x; this.z = p.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    return car;
  }
  pos() { return this.inCar ? { x: this.inCar.x, z: this.inCar.z } : { x: this.x, z: this.z }; }
  speedKmh() { return this.inCar ? Math.abs(this.inCar.speed) * 3.6 : Math.abs(this.speed) * 3.6; }
  damage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
}
