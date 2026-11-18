import * as THREE from 'three';
// Solmar City — pedestrians: walkers on the sidewalks who stroll, cross
// streets, and run from gunfire and fast cars. Simple articulated figures.
import { mulberry32, clamp, lerp, lerpAngle, dist2d, pick, boxGeo, sphGeo, std } from './util.js';
import { ROAD_XS, ROAD_ZS } from './city.js';
import { hitsBuilding } from './vehicles.js';

const SHIRTS = [0xd86a4a, 0x4a8ad8, 0x7ad84a, 0xd8c24a, 0xb44ad8, 0xe8e8e8, 0x4ad8c2];
const PANTS = [0x2a3242, 0x3a2a28, 0x222222, 0x4a4a3a];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = std(pick(rng, SHIRTS), 0.85);
  const pants = std(pick(rng, PANTS), 0.9);
  const skin = std(pick(rng, [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6e4426]), 0.7);
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, x] of [[legL, -0.13], [legR, 0.13]]) {
    const leg = new THREE.Mesh(boxGeo(0.17, 0.72, 0.19), pants);
    leg.position.y = -0.36; grp.add(leg);
    grp.position.set(x, 0.76, 0); g.add(grp);
  }
  const torso = new THREE.Mesh(boxGeo(0.5, 0.58, 0.3), shirt);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, x] of [[armL, -0.32], [armR, 0.32]]) {
    const arm = new THREE.Mesh(boxGeo(0.14, 0.52, 0.16), shirt);
    arm.position.y = -0.24; grp.add(arm);
    grp.position.set(x, 1.32, 0); g.add(grp);
  }
  const head = new THREE.Mesh(sphGeo(0.19, 12, 10), skin);
  head.position.y = 1.58; g.add(head);
  const hair = new THREE.Mesh(sphGeo(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(pick(rng, [0x1a1a1a, 0x4a2a12, 0x777777]), 0.9));
  hair.position.y = 1.62; g.add(hair);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city) {
    this.city = city; this.scene = scene;
    this.rng = mulberry32(4242);
    this.list = [];
    for (let i = 0; i < 26; i++) this.spawn(true);
  }
  spawn(anywhere) {
    const rng = this.rng;
    // Start on a sidewalk beside a road.
    const horizontal = rng() < 0.5;
    const x = horizontal ? -170 + rng() * 350 : pick(rng, ROAD_XS) + (rng() < 0.5 ? -6.5 : 6.5);
    const z = horizontal ? pick(rng, ROAD_ZS) + (rng() < 0.5 ? -6.5 : 6.5) : -170 + rng() * 350;
    const mesh = makePedMesh(rng);
    this.scene.add(mesh);
    const ped = {
      mesh, x, z, heading: rng() * Math.PI * 2,
      speed: 0.9 + rng() * 0.9, walkPhase: rng() * 6,
      hp: 50, dead: false, flee: 0, tx: x, tz: z,
    };
    mesh.position.set(x, 0, z);
    this.list.push(ped);
    return ped;
  }
  update(dt, playerPos, playerSpeed, gunshotAt) {
    for (const p of this.list) {
      if (p.dead) continue;
      // Flee gunfire and fast cars.
      let fx = 0, fz = 0, fleeing = false;
      if (gunshotAt && dist2d(p.x, p.z, gunshotAt.x, gunshotAt.z) < 26) {
        fx = p.x - gunshotAt.x; fz = p.z - gunshotAt.z; fleeing = true;
      } else if (playerSpeed > 6 && dist2d(p.x, p.z, playerPos.x, playerPos.z) < 10) {
        fx = p.x - playerPos.x; fz = p.z - playerPos.z; fleeing = true;
      }
      if (fleeing) {
        const d = Math.hypot(fx, fz) || 1;
        p.heading = lerpAngle(p.heading, Math.atan2(fx / d, fz / d), Math.min(1, dt * 6));
        p.speed = 5.2; p.flee = 2.5;
      } else if (p.flee > 0) {
        // Keep running a little after the scare, then slow back to a walk.
        p.flee -= dt; p.speed = 3.2;
      } else {
        p.speed = 1.1;
        // Wander: pick a new nearby target when the old one is reached.
        if (dist2d(p.x, p.z, p.tx, p.tz) < 2) {
          const horizontal = this.rng() < 0.5;
          p.tx = horizontal ? p.x + (this.rng() - 0.5) * 90 : pick(this.rng, ROAD_XS) + (this.rng() < 0.5 ? -6.5 : 6.5);
          p.tz = horizontal ? pick(this.rng, ROAD_ZS) + (this.rng() < 0.5 ? -6.5 : 6.5) : p.z + (this.rng() - 0.5) * 90;
          p.tx = clamp(p.tx, -180, 180); p.tz = clamp(p.tz, -180, 180);
        }
        p.heading = lerpAngle(p.heading, Math.atan2(p.tx - p.x, p.tz - p.z), Math.min(1, dt * 3));
      }
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      if (!hitsBuilding(nx, p.z, this.city.buildings, 0.4)) p.x = nx;
      if (!hitsBuilding(p.x, nz, this.city.buildings, 0.4)) p.z = nz;
      p.walkPhase += dt * p.speed * 2.2;
      const sw = Math.sin(p.walkPhase) * clamp(p.speed / 5, 0.15, 1) * 0.5;
      const u = p.mesh.userData;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}

  // Damage a pedestrian; returns true if this shot killed them.
  Pedestrians.prototype.damage = function (ped, dmg) {
    if (ped.dead) return false;
    ped.hp -= dmg;
    if (ped.hp <= 0) {
      ped.dead = true;
      ped.mesh.rotation.x = -Math.PI / 2; // fall flat
      ped.mesh.position.y = 0.25;
      return true;
    }
    return false;
  };

  // Nearest living pedestrian to a point, within radius r.
  Pedestrians.prototype.nearest = function (x, z, r) {
    let best = null, bd = r;
    for (const p of this.list) {
      if (p.dead) continue;
      const d = dist2d(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
