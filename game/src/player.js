// Solmar City v8 — the player on foot: movement, camera, entering and leaving
// cars and boats, and health. Driving itself lives in vehicles.js.
import * as THREE from 'three';
import { clamp, lerpAngle, circleHitsBox } from './util.js';
import { CITY } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x1c2833 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.26), jeans);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), jacket);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.94;
  g.add(cap);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), jacket);
  armL.position.set(-0.36, 1.2, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), jacket);
  armR.position.set(0.36, 1.2, 0);
  g.add(armR);
  g.userData.legs = legs;
  g.userData.armR = armR;
  return g;
}

export class Player {
  constructor(scene, spawn) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = Math.PI;
    this.health = 100;
    this.cash = 800;
    this.respect = 0;
    this.inCar = null;
    this.onBoat = null;
    this.walkPhase = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.dead = false;
  }

  get pos() {
    return this.inCar ? { x: this.inCar.x, z: this.inCar.z } : this.onBoat ? { x: this.onBoat.x, z: this.onBoat.z } : { x: this.x, z: this.z };
  }

  update(dt, input, colliders, onStep) {
    if (this.dead) return;
    if (this.inCar || this.onBoat) return; // driving is handled by vehicles.js
    const speed = input.run ? 6.4 : 3.4;
    let mx = 0;
    let mz = 0;
    if (input.forward) { mx += Math.sin(this.camYaw); mz += Math.cos(this.camYaw); }
    if (input.back) { mx -= Math.sin(this.camYaw); mz -= Math.cos(this.camYaw); }
    if (input.left) { mx -= Math.cos(this.camYaw); mz += Math.sin(this.camYaw); }
    if (input.right) { mx += Math.cos(this.camYaw); mz -= Math.sin(this.camYaw); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = lerpAngle(this.heading, targetHeading, clamp(dt * 10, 0, 1));
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      let blocked = nx < CITY.waterX + 1.5 || nx > CITY.maxX || nz < CITY.minZ || nz > CITY.maxZ;
      if (!blocked) {
        for (const b of colliders) {
          if (circleHitsBox(nx, nz, 0.5, b)) { blocked = true; break; }
        }
      }
      if (!blocked) { this.x = nx; this.z = nz; }
      this.walkPhase += dt * speed * 2.2;
      this.mesh.userData.legs.rotation.x = Math.sin(this.walkPhase) * 0.5;
    } else {
      this.mesh.userData.legs.rotation.x *= 0.8;
    }
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.04, this.z);
    this.mesh.rotation.y = this.heading;
    if (onStep) onStep(this.x, this.z);
  }

  enterCar(car) {
    this.inCar = car;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    this.x = car.x + Math.cos(car.heading) * 2.4;
    this.z = car.z - Math.sin(car.heading) * 2.4;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  enterBoat(boat) {
    this.onBoat = boat;
    this.mesh.visible = false;
  }

  exitBoat() {
    if (!this.onBoat) return;
    const boat = this.onBoat;
    this.onBoat = null;
    this.x = boat.x + 4;
    this.z = boat.z;
    if (this.x > CITY.waterX) this.x = CITY.waterX - 2;
    this.heading = boat.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  damage(amount) {
    if (this.dead) return false;
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  respawn(spawn) {
    this.dead = false;
    this.health = 100;
    this.inCar = null;
    this.onBoat = null;
    this.x = spawn.x;
    this.z = spawn.z;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  updateCamera(camera, dt, target) {
    const t = target || this.pos;
    const yaw = this.inCar ? this.inCar.heading : this.onBoat ? this.onBoat.heading : this.camYaw;
    const dist = this.inCar || this.onBoat ? 13 : this.camDist;
    // Pitch lifts the camera: higher pitch, higher and closer view.
    const height = (this.inCar || this.onBoat ? 5.2 : 4.2) + (this.camPitch - 0.32) * 8;
    const cx = t.x - Math.sin(yaw) * dist * Math.cos(this.camPitch);
    const cz = t.z - Math.cos(yaw) * dist * Math.cos(this.camPitch);
    camera.position.set(cx, height, cz);
    camera.lookAt(t.x, 1.4, t.z);
  }
}

// Mouse-drag camera orbit: drag left/right to swing the camera around the
// player, drag up/down to change the pitch. Touch drag works the same way.
export function attachCameraDrag(canvas, player) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    player.camYaw -= dx * 0.005;
    player.camPitch = clamp(player.camPitch + dy * 0.003, 0.12, 0.9);
  });
  window.addEventListener('pointerup', () => { dragging = false; });
}
