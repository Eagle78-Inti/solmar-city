import * as THREE from 'three';
// Solmar City — Rook, the player character: an articulated figure (not a
// box) with camera-relative on-foot movement, sprinting and car entry.
import { clamp, lerp, lerpAngle, dist2d, boxGeo, cylGeo, sphGeo, std } from './util.js';
import { hitsBuilding } from './vehicles.js';

export function makeRookMesh() {
  const g = new THREE.Group();
  const skin = std('#c98d64', 0.7);
  const jacket = std('#1d4e5e', 0.85);
  const jeans = std('#2a3242', 0.9);
  const shoe = std('#1a1a1a', 0.6);
  // Legs with a walk swing.
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, x] of [[legL, -0.16], [legR, 0.16]]) {
    const leg = new THREE.Mesh(boxGeo(0.2, 0.78, 0.22), jeans);
    leg.position.y = -0.39; grp.add(leg);
    const foot = new THREE.Mesh(boxGeo(0.22, 0.1, 0.36), shoe);
    foot.position.set(0, -0.78, 0.06); grp.add(foot);
    grp.position.set(x, 0.82, 0); g.add(grp);
  }
  const torso = new THREE.Mesh(boxGeo(0.56, 0.62, 0.32), jacket);
  torso.position.y = 1.16; torso.castShadow = true; g.add(torso);
  const vest = new THREE.Mesh(boxGeo(0.58, 0.3, 0.34), std('#31424e', 0.85));
  vest.position.y = 1.08; g.add(vest);
  // Arms.
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, x] of [[armL, -0.36], [armR, 0.36]]) {
    const arm = new THREE.Mesh(boxGeo(0.16, 0.6, 0.18), jacket);
    arm.position.y = -0.28; grp.add(arm);
    const hand = new THREE.Mesh(sphGeo(0.09, 8, 6), skin);
    hand.position.y = -0.6; grp.add(hand);
    grp.position.set(x, 1.42, 0); g.add(grp);
  }
  const head = new THREE.Mesh(sphGeo(0.21, 14, 12), skin);
  head.position.y = 1.72; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(cylGeo(0.22, 0.23, 0.09, 12), std('#c22a2a', 0.7));
  cap.position.y = 1.9; g.add(cap);
  const brim = new THREE.Mesh(boxGeo(0.3, 0.04, 0.22), std('#c22a2a', 0.7));
  brim.position.set(0, 1.87, 0.26); g.add(brim);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, city) {
    this.mesh = makeRookMesh(); scene.add(this.mesh);
    this.city = city;
    this.pos = new THREE.Vector3(26, 0, -123); // parked beside the own car
    this.heading = Math.PI; this.speed = 0;
    this.onFoot = true; this.car = null;
    this.walkPhase = 0;
  }
  update(dt, input, camYaw) {
    if (!this.onFoot) return;
    const f = (input.has('KeyW') || input.has('ArrowUp') ? 1 : 0) - (input.has('KeyS') || input.has('ArrowDown') ? 1 : 0);
    const s = (input.has('KeyD') || input.has('ArrowRight') ? 1 : 0) - (input.has('KeyA') || input.has('ArrowLeft') ? 1 : 0);
    const sprint = input.has('ShiftLeft') || input.has('ShiftRight');
    const maxSpeed = sprint ? 8.5 : 4.6;
    const moving = f !== 0 || s !== 0;
    const targetSpeed = moving ? maxSpeed : 0;
    this.speed = lerp(this.speed, targetSpeed, Math.min(1, dt * 8));
    if (moving) {
      // Camera-relative movement: forward is where the camera looks.
      // atan2(s, f) rotates the camera's forward by the input direction.
      const moveAng = camYaw + Math.atan2(s, f);
      this.heading = lerpAngle(this.heading, moveAng, Math.min(1, dt * 10));
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      if (!hitsBuilding(nx, this.pos.z, this.city.buildings)) this.pos.x = nx;
      if (!hitsBuilding(this.pos.x, nz, this.city.buildings)) this.pos.z = nz;
      this.pos.x = clamp(this.pos.x, -185, 185); this.pos.z = clamp(this.pos.z, -185, 185);
      this.walkPhase += dt * this.speed * 1.6;
    }
    // Walk-cycle limb swing, scaled by speed.
    const amp = clamp(this.speed / 8.5, 0, 1) * 0.55;
    const sw = Math.sin(this.walkPhase);
    const u = this.mesh.userData;
    u.legL.rotation.x = sw * amp; u.legR.rotation.x = -sw * amp;
    u.armL.rotation.x = -sw * amp * 0.7; u.armR.rotation.x = sw * amp * 0.7;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }
}

  // Teleport the player (used by mission staging and the debug hooks).
  Player.prototype.teleport = function (x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) this.heading = heading;
    this.speed = 0;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  };
