// Solmar City v8 — pedestrians: simple people who stroll the sidewalks, cross
// roads, and run from gunfire. They keep the streets alive and give the wanted
// system something to react to.
import * as THREE from 'three';
import { clamp, dist2, mulberry32, pick } from './util.js';
import { CITY } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22, 0x2ecc71];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a1a1a];

export class Pedestrians {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = mulberry32(4242);
    this.peds = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let i = 0; i < 30; i++) this.spawn(true);
  }

  makeMesh() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rng, SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: pick(this.rng, PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0]) });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), pants);
    legs.position.y = 0.4;
    g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
    torso.position.y = 1.1;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
    head.position.y = 1.6;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: pick(this.rng, [0x1a1a1a, 0x4a2c0a, 0x888888, 0x2c1a0a]) }));
    hair.position.y = 1.8;
    g.add(hair);
    g.userData.legs = legs;
    return g;
  }

  spawn(anywhere = false) {
    const rng = this.rng;
    const mesh = this.makeMesh();
    const onRoad = rng() < 0.5;
    const line = Math.round((-240 + rng() * 480) / 60) * 60;
    const along = -240 + rng() * 480;
    const ped = {
      mesh,
      x: onRoad ? along : line + (rng() < 0.5 ? 8 : -8),
      z: onRoad ? line + (rng() < 0.5 ? 8 : -8) : along,
      heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.9,
      walkPhase: rng() * 10,
      flee: 0,
      targetHeading: null,
    };
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.heading;
    this.group.add(mesh);
    this.peds.push(ped);
    return ped;
  }

  scare(x, z, radius = 40) {
    for (const p of this.peds) {
      if (dist2(p.x, p.z, x, z) < radius) {
        p.flee = 4 + Math.random() * 3;
        p.targetHeading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt, playerPos, dangerPos) {
    for (const p of this.peds) {
      if (p.flee > 0) {
        p.flee -= dt;
        p.heading = p.targetHeading;
        p.speed = 3.4;
      } else {
        p.speed = 1.4;
        if (Math.random() < dt * 0.08) p.targetHeading = Math.random() * Math.PI * 2;
        if (p.targetHeading !== null) {
          p.heading += clamp(p.targetHeading - p.heading, -dt * 2, dt * 2);
          if (Math.abs(p.targetHeading - p.heading) < 0.1) p.targetHeading = null;
        }
      }
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      // Stay on land and out of buildings.
      let blocked = nx < CITY.waterX + 4 || nx > CITY.maxX || nz < CITY.minZ || nz > CITY.maxZ;
      if (!blocked) {
        for (const b of this.colliders) {
          if (nx > b.minX - 0.5 && nx < b.maxX + 0.5 && nz > b.minZ - 0.5 && nz < b.maxZ + 0.5) { blocked = true; break; }
        }
      }
      if (!blocked) { p.x = nx; p.z = nz; }
      else { p.heading += Math.PI / 2; p.targetHeading = null; }
      p.walkPhase += dt * p.speed * 4;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.legs.rotation.x = Math.sin(p.walkPhase) * 0.3;
      // Recycle far-away peds near the player so the streets stay populated.
      // Respawn them ahead of the player's view, not on top of the player.
      if (playerPos && dist2(p.x, p.z, playerPos.x, playerPos.z) > 320) {
        this.group.remove(p.mesh);
        const idx = this.peds.indexOf(p);
        if (idx >= 0) this.peds.splice(idx, 1);
        this.spawn();
      }
    }
  }
}

// Nearest pedestrian to a point, for the "run over" check and the taxi pickup.
export function nearestPed(peds, x, z, maxDist = 6) {
  let best = null;
  let bestD = maxDist;
  for (const p of peds.peds) {
    const d = dist2(p.x, p.z, x, z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
