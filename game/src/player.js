// Solmar City — the player: Rook, a getaway driver. A detailed articulated
// figure (jacket, shirt, jeans, hair, shoes) with a walk cycle, camera-relative
// movement on foot, and a smooth third-person camera with a speed FOV kick.
import * as THREE from 'three';
import { clamp, lerp, damp, angleLerp, boxGeo, cylGeo, stdMat, V3 } from './util.js';

const SKIN = stdMat({ color: 0xc98e6a, roughness: 0.7 });
const HAIR = stdMat({ color: 0x1c1410, roughness: 0.9 });
const JACKET = stdMat({ color: 0x0f6f6a, roughness: 0.75 });
const SHIRT = stdMat({ color: 0xf0ece2, roughness: 0.85 });
const JEANS = stdMat({ color: 0x2c3e55, roughness: 0.85 });
const SHOES = stdMat({ color: 0x1a1a1a, roughness: 0.6 });

export function buildRookMesh() {
  const g = new THREE.Group();
  const parts = {};
  // Legs: jeans with shoes, pivoting at the hip for the walk cycle.
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.86, 0);
    const thigh = new THREE.Mesh(boxGeo(0.2, 0.44, 0.24), JEANS);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);
    const shin = new THREE.Mesh(boxGeo(0.18, 0.42, 0.22), JEANS);
    shin.position.y = -0.62;
    shin.castShadow = true;
    leg.add(shin);
    const shoe = new THREE.Mesh(boxGeo(0.2, 0.1, 0.36), SHOES);
    shoe.position.set(0, -0.84, 0.06);
    shoe.castShadow = true;
    leg.add(shoe);
    g.add(leg);
    parts[s > 0 ? 'legR' : 'legL'] = leg;
  }
  // Torso: teal jacket over a white shirt, with a collar and belt.
  const torso = new THREE.Group();
  torso.position.y = 0.86;
  const chest = new THREE.Mesh(boxGeo(0.56, 0.62, 0.32), JACKET);
  chest.position.y = 0.31;
  chest.castShadow = true;
  torso.add(chest);
  const shirt = new THREE.Mesh(boxGeo(0.2, 0.5, 0.06), SHIRT);
  shirt.position.set(0, 0.32, 0.17);
  torso.add(shirt);
  const belt = new THREE.Mesh(boxGeo(0.58, 0.07, 0.34), SHOES);
  belt.position.y = 0.02;
  torso.add(belt);
  g.add(torso);
  parts.torso = torso;
  // Arms: jacket sleeves with skin hands, pivoting at the shoulder.
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.33, 1.42, 0);
    const upper = new THREE.Mesh(boxGeo(0.17, 0.36, 0.2), JACKET);
    upper.position.y = -0.18;
    upper.castShadow = true;
    arm.add(upper);
    const fore = new THREE.Mesh(boxGeo(0.15, 0.32, 0.18), JACKET);
    fore.position.y = -0.5;
    arm.add(fore);
    const hand = new THREE.Mesh(boxGeo(0.14, 0.14, 0.16), SKIN);
    hand.position.y = -0.7;
    arm.add(hand);
    g.add(arm);
    parts[s > 0 ? 'armR' : 'armL'] = arm;
  }
  // Head: skin, dark swept hair, simple shaded eyes.
  const head = new THREE.Group();
  head.position.y = 1.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), SKIN);
  skull.position.y = 0.1;
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR);
  hair.position.y = 0.13;
  head.add(hair);
  const hairBack = new THREE.Mesh(boxGeo(0.3, 0.16, 0.12), HAIR);
  hairBack.position.set(0, 0.08, -0.14);
  head.add(hairBack);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), stdMat({ color: 0x111111, roughness: 0.4 }));
    eye.position.set(s * 0.07, 0.12, 0.17);
    head.add(eye);
  }
  g.add(head);
  parts.head = head;
  g.userData.parts = parts;
  return g;
}

export class Player {
  constructor(scene, city) {
    this.city = city;
    this.mesh = buildRookMesh();
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(-8, 0, 8);
    this.heading = Math.PI * 0.75;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.health = 100;
    this.walkPhase = 0;
    this.shake = 0;
    this.camYaw = this.heading;
    this.camPitch = 0.32;
    this.camDist = 6;
    this.fovKick = 0;
    // One real spotlight for the player's headlights at night.
    this.spot = new THREE.SpotLight(0xffe9a8, 0, 60, 0.5, 0.45, 1.2);
    this.spotTarget = new THREE.Object3D();
    scene.add(this.spot);
    scene.add(this.spotTarget);
    this.spot.target = this.spotTarget;
  }
  forward() { return V3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.parked = false;
    this.mesh.visible = false;
    this.pos.copy(car.pos);
    this.heading = car.heading;
    this.speed = 0;
  }
  exitCar() {
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    this.onFoot = true;
    this.mesh.visible = true;
    const side = V3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.pos.set(car.pos.x + side.x * 2.4, 0, car.pos.z + side.z * 2.4);
    this.city.resolveCircle(this.pos, 0.6);
    this.heading = car.heading;
  }
  damage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    this.shake = Math.min(this.shake + 0.4, 1);
    return this.health <= 0;
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  // On-foot movement, camera-relative. Returns nothing; input: { f, s, sprint }.
  updateOnFoot(input, dt) {
    const camF = V3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const camR = V3(camF.z, 0, -camF.x);
    let mx = camF.x * input.f + camR.x * input.s;
    let mz = camF.z * input.f + camR.z * input.s;
    const len = Math.hypot(mx, mz);
    const top = input.sprint ? 8.5 : 5.2;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.speed = lerp(this.speed, top, 1 - Math.exp(-8 * dt));
      this.heading = angleLerp(this.heading, Math.atan2(mx, mz), 1 - Math.exp(-10 * dt));
    } else {
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-10 * dt));
    }
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.city.clampToCity(this.pos);
    this.city.resolveCircle(this.pos, 0.55);
    // Walk cycle: legs and arms swing opposite, torso bobs.
    this.walkPhase += this.speed * dt * 1.9;
    const sw = clamp(this.speed / top, 0, 1) * 0.62;
    const p = this.mesh.userData.parts;
    p.legL.rotation.x = Math.sin(this.walkPhase) * sw;
    p.legR.rotation.x = -Math.sin(this.walkPhase) * sw;
    p.armL.rotation.x = -Math.sin(this.walkPhase) * sw * 0.85;
    p.armR.rotation.x = Math.sin(this.walkPhase) * sw * 0.85;
    p.torso.position.y = 0.86 + Math.abs(Math.sin(this.walkPhase)) * 0.045 * clamp(this.speed / top, 0, 1);
    p.torso.rotation.x = clamp(this.speed / top, 0, 1) * 0.09;
    this.mesh.rotation.y = this.heading;
    this.mesh.position.y = 0;
  }

  // Third-person camera: sits behind the player or the car, eased toward its
  // target so it never snaps, with a speed FOV kick and a collision shake.
  updateCamera(camera, dt, nightF) {
    const targetDist = this.onFoot ? 5.6 : 9.2;
    const targetH = this.onFoot ? 2.7 : 3.6;
    this.camDist = damp(this.camDist, targetDist, 4, dt);
    // The camera looks past the player, down the direction they face, so the
    // crosshair actually points at what is ahead — at chest height, not at
    // the player's feet. Without this, a pistol shot at anything more than a
    // couple of metres away sails over it or into the ground.
    const facing = this.onFoot ? V3(Math.sin(this.heading), 0, Math.cos(this.heading)) : this.car.forward();
    const lookAt = (this.onFoot ? this.pos.clone() : this.car.pos.clone())
      .addScaledVector(facing, this.onFoot ? 6 : 10)
      .add(V3(0, this.onFoot ? 1.4 : 1.3, 0));
    const yaw = this.onFoot ? this.camYaw : this.heading + Math.PI;
    // When driving, the camera follows behind the car; on foot it follows the
    // mouse orbit yaw, which the player steers with the mouse.
    const camYaw = this.onFoot ? this.camYaw : angleLerp(this.camYaw, yaw, 1 - Math.exp(-3.2 * dt));
    this.camYaw = camYaw;
    const back = V3(Math.sin(camYaw), 0, Math.cos(camYaw));
    // The camera hangs BEHIND the player/car by camDist, at targetH up, and
    // looks ahead past them. (The old code placed the camera relative to the
    // lookAt point, which put it almost directly above the car — the car was
    // cropped out of the bottom of every driving shot.)
    const anchor = this.onFoot ? this.pos : this.car.pos;
    const desired = anchor.clone()
      .addScaledVector(back, this.camDist)
      .add(V3(0, targetH, 0));
    desired.y = Math.max(desired.y, 1.2);
    camera.position.x = damp(camera.position.x, desired.x, 7, dt);
    camera.position.y = damp(camera.position.y, desired.y, 7, dt);
    camera.position.z = damp(camera.position.z, desired.z, 7, dt);
    if (this.shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.25;
      this.shake = damp(this.shake, 0, 5, dt);
    }
    camera.lookAt(lookAt);
    const speedFrac = this.onFoot ? this.speed / 8.5 : Math.abs(this.car ? this.car.speed : 0) / 40;
    this.fovKick = damp(this.fovKick, speedFrac * 9, 3, dt);
    if (Math.abs(camera.fov - (62 + this.fovKick)) > 0.1) {
      camera.fov = 62 + this.fovKick;
      camera.updateProjectionMatrix();
    }
    // Headlight spotlight: only when driving at night.
    const driving = !this.onFoot && this.car;
    this.spot.intensity = driving ? nightF * 900 : 0;
    if (driving) {
      const f = this.car.forward();
      this.spot.position.set(this.car.pos.x + f.x * 2.2, 0.9, this.car.pos.z + f.z * 2.2);
      this.spotTarget.position.set(this.car.pos.x + f.x * 26, 0.4, this.car.pos.z + f.z * 26);
    }
  }

  // Where the crosshair points: the camera's forward ray, used by combat so
  // a click hits what the player is actually looking at.
  aimDirection(camera) {
    const dir = V3();
    camera.getWorldDirection(dir);
    return dir;
  }

  respawn(x, z, heading) {
    if (this.car) {
      this.car.speed = 0;
      this.car = null;
    }
    this.onFoot = true;
    this.mesh.visible = true;
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.health = 100;
    this.camYaw = heading;
  }
}
