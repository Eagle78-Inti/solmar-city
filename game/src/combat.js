// Solmar City — combat: a hitscan pistol. Click to fire from the crosshair;
// the ray hits pedestrians, police cruisers and traffic, with a tracer and a
// muzzle flash. Every shot has consequences: killing a pedestrian or shooting
// a cruiser raises the wanted level, and the street runs.
import * as THREE from 'three';
import { clamp, dist2, glowSprite } from './util.js';
import { witnessFlee } from './pedestrians.js';

export class Combat {
  constructor(scene, camera, game) {
    this.scene = scene;
    this.camera = camera;
    this.g = game;
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 140;
    this.flash = new THREE.PointLight(0xffe9a8, 0, 18, 1.5);
    scene.add(this.flash);
    this.flashSprite = glowSprite('#ffe9a8', 2.2, 0);
    scene.add(this.flashSprite);
    // A small pool of tracer lines, reused so firing never allocates.
    this.tracers = [];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.tracerIdx = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.sparks = new Sparks(scene);
  }

  shoot() {
    if (this.cooldown > 0 || this.g.paused || !this.g.started) return false;
    this.cooldown = 0.25;
    this.shotsFired++;
    this.g.audio.shoot();
    const dir = this.g.player.aimDirection(this.camera);
    this.raycaster.set(this.camera.position, dir);
    // Muzzle flash at the camera, tracer from the camera to the hit point.
    this.flash.position.copy(this.camera.position).addScaledVector(dir, 1.2);
    this.flash.intensity = 60;
    this.flashSprite.position.copy(this.flash.position);
    this.flashSprite.material.opacity = 0.95;
    const targets = [];
    for (const p of this.g.peds) if (p.state !== 'down') targets.push({ obj: p.mesh, kind: 'ped', ref: p });
    for (const c of this.g.police.cars) targets.push({ obj: c.mesh, kind: 'police', ref: c });
    for (const c of this.g.traffic) targets.push({ obj: c.mesh, kind: 'traffic', ref: c });
    for (const c of this.g.parkedCars) targets.push({ obj: c.mesh, kind: 'parked', ref: c });
    const meshes = targets.map((t) => t.obj);
    const hits = this.raycaster.intersectObjects(meshes, true);
    let end = this.camera.position.clone().addScaledVector(dir, 120);
    if (hits.length) {
      const hit = hits[0];
      end = hit.point.clone();
      // Walk up to the registered root object.
      let node = hit.object;
      let entry = null;
      while (node) {
        entry = targets.find((t) => t.obj === node);
        if (entry) break;
        node = node.parent;
      }
      if (entry) this.applyHit(entry, hit.point);
    }
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, this.flash.position.x, this.flash.position.y, this.flash.position.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    t.line.material.opacity = 0.9;
    t.life = 0.09;
    return true;
  }

  applyHit(entry, point) {
    const g = this.g;
    this.hits++;
    this.sparks.burst(point, 10);
    if (entry.kind === 'ped') {
      entry.ref.knockDown();
      witnessFlee(g.peds, point.x, point.z, 30);
      g.police.addWanted(1);
      g.audio.hit();
      g.hud.message('A pedestrian is down. The street saw it — wanted +1.');
    } else if (entry.kind === 'police') {
      entry.ref.health -= 34;
      g.audio.hit();
      if (entry.ref.health <= 0 && !entry.ref.dead) {
        entry.ref.dead = true;
        entry.ref.speed = 0;
        g.police.addWanted(1);
        g.hud.message('Cruiser disabled. Wanted +1.');
      }
    } else if (entry.kind === 'traffic' || entry.kind === 'parked') {
      entry.ref.health -= 34;
      g.audio.hit();
      if (entry.ref.health <= 0) entry.ref.dead = true;
      g.police.addWanted(1);
      g.hud.message('You shot a civilian car. Wanted +1.');
    }
    g.hud.refresh();
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sparks.update(dt);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 700);
    this.flashSprite.material.opacity = Math.max(0, this.flashSprite.material.opacity - dt * 9);
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      }
    }
  }
}

// Impact sparks: a handful of additive sprites that burst from a hit point
// and fade in a quarter of a second. Cheap, and it makes every hit read.
export class Sparks {
  constructor(scene, count = 24) {
    this.scene = scene;
    this.parts = [];
    const mat = new THREE.SpriteMaterial({ map: glowSprite('#ffd9a0', 1, 1).material.map, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.visible = false;
      scene.add(s);
      this.parts.push({ s, vel: new THREE.Vector3(), life: 0 });
    }
    this.idx = 0;
  }
  burst(point, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.idx++ % this.parts.length];
      p.s.position.copy(point);
      p.vel.set((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6);
      p.life = 0.28;
      p.s.visible = true;
      p.s.scale.set(0.5, 0.5, 1);
      p.s.material.opacity = 1;
    }
  }
  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.vel.y -= 9 * dt;
      p.s.material.opacity = Math.max(0, p.life / 0.28);
      if (p.life <= 0) p.s.visible = false;
    }
  }
}
