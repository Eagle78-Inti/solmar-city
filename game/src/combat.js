// Solmar City v8 — combat: pistol shooting with a raycast, tracers, muzzle
// flash, a 12-round magazine and reload. Police damage to the player is in
// police.js; this file is the player's own shooting.
import * as THREE from 'three';
import { clamp } from './util.js';

export class Combat {
  constructor(scene, camera, audio) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
    this.ammo = 12;
    this.reloading = 0;
    this.flash = new THREE.PointLight(0xffd27a, 0, 18);
    this.scene.add(this.flash);
    this.flashTimer = 0;
    // Tracer: a thin stretched box from the camera to the hit point.
    this.tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }),
    );
    this.scene.add(this.tracer);
    this.tracerTimer = 0;
  }

  // targets: [{ mesh, kind, ref }] — kind 'ped' | 'police' | 'car'.
  // Returns the hit target or null. origin is the player's position.
  shoot(origin, targets) {
    if (this.cooldown > 0 || this.reloading > 0) return null;
    if (this.ammo <= 0) {
      this.startReload();
      return null;
    }
    this.cooldown = 0.28;
    this.ammo -= 1;
    this.audio.shot();
    // Aim from the camera, but start the ray just ahead of the player so the
    // player's own car never blocks the shot when driving.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const rayOrigin = this.camera.position.clone().add(dir.clone().multiplyScalar(0.5));
    this.raycaster.set(rayOrigin, dir);
    this.raycaster.far = 140;
    const meshes = targets.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    let end = this.camera.position.clone().add(dir.clone().multiplyScalar(120));
    let hitTarget = null;
    if (hits.length > 0) {
      const h = hits[0];
      end = h.point.clone();
      let node = h.object;
      while (node && !targets.some((t) => t.mesh === node)) node = node.parent;
      if (node) hitTarget = targets.find((t) => t.mesh === node);
    }
    // Muzzle flash at the camera, tracer to the hit point.
    this.flash.position.copy(this.camera.position).add(dir.clone().multiplyScalar(1.2));
    this.flash.intensity = 14;
    this.flashTimer = 0.06;
    const mid = this.camera.position.clone().add(end).multiplyScalar(0.5);
    const len = this.camera.position.distanceTo(end);
    this.tracer.position.copy(mid);
    this.tracer.scale.set(1, 1, len);
    this.tracer.lookAt(end);
    this.tracer.material.opacity = 0.9;
    this.tracerTimer = 0.09;
    return hitTarget;
  }

  startReload() {
    if (this.reloading > 0 || this.ammo === 12) return;
    this.reloading = 1.1;
    this.audio.blip(300, 0.12, 'square', 0.1);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.ammo = 12;
        this.audio.blip(660, 0.08, 'sine', 0.12);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.material.opacity = 0;
    }
  }
}

// Aim assist for the playtest harness and for gamepad-style play: returns the
// target whose screen-space centre is closest to the crosshair.
export function bestTargetForCrosshair(combat, targets) {
  const dir = new THREE.Vector3();
  combat.camera.getWorldDirection(dir);
  let best = null;
  let bestScore = 0.12; // cos of ~83 degrees: must be roughly ahead
  const camPos = combat.camera.position;
  for (const t of targets) {
    const to = new THREE.Vector3();
    t.mesh.getWorldPosition(to);
    to.sub(camPos).normalize();
    const score = to.dot(dir);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}
