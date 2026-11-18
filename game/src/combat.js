import * as THREE from 'three';
// Solmar City — combat: a hitscan pistol with a tracer and muzzle flash,
// police who shoot back at 2+ stars, and player health with slow regen.
import { dist2d, sphGeo, std } from './util.js';

export class Combat {
  constructor(scene, G) {
    this.G = G; this.scene = scene;
    this.cooldown = 0;
    this.enemyFire = 0;
    // Tracer: a thin glowing line shown for a blink after each shot.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0 }));
    this.scene.add(this.tracer);
    this.flash = new THREE.Mesh(sphGeo(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffdf6a', transparent: true, opacity: 0 }));
    this.scene.add(this.flash);
    // The pistol in the player's hand (visible in first-person-ish foot view).
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), std('#1c1e22', 0.4, 0.7));
    gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), std('#2a2018', 0.7));
    grip.position.set(0, -0.12, -0.14); gun.add(grip);
    gun.position.set(0.32, -0.28, -0.7);
    this.gun = gun;
  }
  attachGun(camera) { camera.add(this.gun); this.gun.visible = false; }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.enemyFire = Math.max(0, this.enemyFire - dt);
    this.tracer.material.opacity = Math.max(0, this.tracer.material.opacity - dt * 9);
    this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 10);
    // Player health regenerates slowly out of combat.
    const G = this.G;
    if (G.wanted === 0 && G.health < 100) G.health = Math.min(100, G.health + dt * 2);
  }
  // Fire from the camera through the crosshair. Returns what was hit.
  shoot(camera, peds, police) {
    const G = this.G;
    if (this.cooldown > 0 || !G.player.onFoot) return null;
    this.cooldown = 0.32;
    G.audio.gunshot();
    G.shotAt = { x: G.player.pos.x, z: G.player.pos.z };
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = 90;
    // Aim at the nearest living ped or cruiser near the ray. The crosshair
    // sits at screen centre, so a hit only counts close to the ray line.
    let best = null, bestD = 90;
    const test = (x, z, y, ref) => {
      const v = new THREE.Vector3(x, y, z);
      const to = v.clone().sub(camera.position);
      const along = to.dot(ray.ray.direction);
      if (along < 1 || along > bestD) return;
      const perp = to.clone().addScaledVector(ray.ray.direction, -along).length();
      if (perp < 1.6) { bestD = along; best = { ref, point: v, along }; }
    };
    for (const p of peds.list) if (!p.dead) test(p.x, p.z, 1.2, { kind: 'ped', ped: p });
    for (const c of police.cruisers) test(c.x, c.z, 1.0, { kind: 'cop', cop: c });
    const from = camera.position.clone();
    const to = best ? best.point : from.clone().addScaledVector(ray.ray.direction, 60);
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z); pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.95;
    this.flash.position.copy(from).addScaledVector(ray.ray.direction, 1.1);
    this.flash.material.opacity = 0.95;
    if (!best) return { kind: 'miss' };
    if (best.ref.kind === 'ped') {
      const killed = peds.damage(best.ref.ped, 50);
      G.addWanted(killed ? 2 : 1);
      return { kind: 'ped', killed };
    }
    // Shooting a cruiser dents it and draws heat.
    G.addWanted(1);
    return { kind: 'cop' };
  }

  // Police return fire when the player is wanted and in range.
  policeFire(dt, police) {
    const G = this.G;
    if (G.wanted < 2 || this.enemyFire > 0 || G.player.car) return;
    let nearest = null, bd = 42;
    for (const c of police.cruisers) {
      const d = dist2d(c.x, c.z, G.player.pos.x, G.player.pos.z);
      if (d < bd) { bd = d; nearest = c; }
    }
    if (!nearest) return;
    this.enemyFire = 0.9;
    G.audio.gunshot();
    G.health = Math.max(0, G.health - 9);
    G.hud.flash('Taking fire!');
    if (G.health <= 0) G.wasted();
  }
}
