// Solmar City — combat: the player's pistol, police return fire, car damage
// and explosions. Hitscan raycasts; no projectiles to simulate.
import * as THREE from 'three';
import { rand } from './util.js';

export class Combat {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.raycaster = new THREE.Raycaster();
    this.fireCooldown = 0;
    this.policeFireTimer = 0;
    this.explosions = [];
  }
  // camera: THREE.Camera; dir: normalized Vector3 (camera forward)
  shoot(camera, targets, onHit) {
    if (this.fireCooldown > 0) return false;
    this.fireCooldown = 0.28;
    this.raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
    this.raycaster.far = 90;
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.target) obj = obj.parent;
      if (obj && obj.userData.target) {
        onHit(obj.userData.target, hits[0].point);
        return true;
      }
    }
    return false;
  }
  // register a mesh subtree as a shootable target of kind 'ped'|'car'|'police'
  tagTarget(root, target) {
    root.traverse((o) => { o.userData.target = target; });
  }
  explode(x, z, onDone) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), mat);
    m.position.set(x, 1.5, z);
    this.scene.add(m);
    this.explosions.push({ mesh: m, mat, t: 0, onDone });
  }
  update(dt, player, police, audio) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    // explosions animate
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.t += dt;
      const s = 1 + e.t * 5;
      e.mesh.scale.set(s, s, s);
      e.mat.opacity = Math.max(0, 0.9 - e.t * 1.4);
      if (e.t > 0.7) {
        this.scene.remove(e.mesh);
        this.explosions.splice(i, 1);
        if (e.onDone) e.onDone();
      }
    }
    // police return fire at 2+ stars
    if (police.wanted >= 2 && police.cars.length > 0) {
      this.policeFireTimer -= dt;
      if (this.policeFireTimer <= 0) {
        this.policeFireTimer = rand(0.9, 1.6);
        const pos = player.pos();
        const near = police.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - pos.x, c.z - pos.z)), 9999);
        if (near < 42 && Math.random() < 0.4) {
          const dmg = rand(3, 7);
          let dead = false;
          if (player.inCar) player.inCar.damage(dmg);
          else dead = player.damage(dmg);
          audio.noiseBurst(0.08, 0.2, 2500);
          if (dead) return 'wasted';
        }
      }
    }
    return null;
  }
}
