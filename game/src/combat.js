// Solmar City v4 — combat: a hitscan pistol with a muzzle flash, pedestrians
// who drop when hit, police cruisers that take damage, and return fire when
// the heat is on.
import * as THREE from 'three';
import { rand } from './util.js';

export function createCombat(world) {
  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const flash = new THREE.PointLight(0xffe9a0, 0, 18, 1.6);
  world.scene.add(flash);
  const C = {
    cooldown: 0,
    fireTimer: 1,
    flashT: 0,
    targets() {
      const list = [];
      for (const p of world.peds.list) if (p.alive) list.push(p.mesh);
      for (const c of world.police.cars) if (!c.disabled) list.push(c.group);
      return list;
    },
    shoot() {
      if (C.cooldown > 0 || world.state !== 'playing') return false;
      C.cooldown = 0.28;
      world.audio.shot();
      const cam = world.camera;
      ray.setFromCamera(center, cam);
      const hits = ray.intersectObjects(C.targets(), true);
      flash.position.copy(cam.position).add(new THREE.Vector3(0, -0.2, 0));
      flash.intensity = 26;
      C.flashT = 0.06;
      if (!hits.length) return true;
      const hit = hits[0];
      const targetSet = new Set(C.targets());
      let obj = hit.object, ent = null, kind = null;
      while (obj) {
        if (targetSet.has(obj)) {
          if (obj.userData && obj.userData.isPed) { ent = obj.userData.ref; kind = 'ped'; }
          else { ent = obj.userData.ref; kind = 'police'; }
          break;
        }
        obj = obj.parent;
      }
      if (kind === 'ped' && ent) {
        world.peds.killAt({ x: hit.point.x, z: hit.point.z }, 2.5);
        world.peds.fleeFrom(hit.point.x, hit.point.z, 22);
        world.addWanted(1);
        world.toast('You shot a pedestrian — the cops are coming.');
      } else if (kind === 'police' && ent) {
        ent.hits = (ent.hits || 0) + 1;
        if (ent.hits >= 3) {
          ent.disabled = true;
          ent.speed = 0;
          world.toast('Cruiser disabled.');
        }
        world.addWanted(1);
      }
      return true;
    },
    shootAt(x, y, z) {
      if (C.cooldown > 0) return false;
      C.cooldown = 0.28;
      world.audio.shot();
      const cam = world.camera;
      const dir = new THREE.Vector3(x - cam.position.x, y - cam.position.y, z - cam.position.z).normalize();
      ray.set(cam.position, dir);
      const hits = ray.intersectObjects(C.targets(), true);
      if (!hits.length) return true;
      const hit = hits[0];
      const targetSet = new Set(C.targets());
      let obj = hit.object;
      while (obj) {
        if (targetSet.has(obj) && obj.userData && obj.userData.isPed) {
          world.peds.killAt({ x: hit.point.x, z: hit.point.z }, 2.5);
          world.peds.fleeFrom(hit.point.x, hit.point.z, 22);
          world.addWanted(1);
          return true;
        }
        obj = obj.parent;
      }
      return true;
    },
    update(dt) {
      C.cooldown = Math.max(0, C.cooldown - dt);
      if (C.flashT > 0) {
        C.flashT -= dt;
        if (C.flashT <= 0) flash.intensity = 0;
      }
      if (world.police.wanted >= 2 && world.state === 'playing') {
        C.fireTimer -= dt;
        if (C.fireTimer <= 0) {
          C.fireTimer = rand(0.9, 1.6);
          const pp = world.playerPos();
          const near = world.police.cars.some((c) => {
            const d = Math.hypot(c.group.position.x - pp.x, c.group.position.z - pp.z);
            return d < 42;
          });
          if (near && Math.random() < 0.4) {
            world.audio.shot();
            world.damage(8);
          }
        }
      }
    },
  };
  return C;
}

export function combatHelpText() {
  return 'Click to shoot the pistol. Police shoot back at 2 stars or more.';
}
