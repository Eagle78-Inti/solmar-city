// Solmar City — pedestrians: sidewalk walkers who stroll, chat, and flee
// from gunfire, speeding cars and police chases.
import * as THREE from 'three';
import { rand, randInt, pick, clamp } from './util.js';
import { BLOCK, GRID, CITY_R } from './city.js';

const SHIRTS = [0xd94f3d, 0x3d7bd9, 0x4fc23d, 0xe0b93c, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1, 0x2c3e50, 0xfd79a8];

export class Pedestrians {
  constructor(scene, city, count = 26) {
    this.scene = scene; this.city = city;
    this.list = [];
    for (let i = 0; i < count; i++) this.list.push(this.spawnRandom());
  }
  spawnRandom(near) {
    let x, z;
    if (near) { x = near.x + rand(-30, 30); z = near.z + rand(-30, 30); }
    else {
      const road = randInt(-GRID, GRID) * BLOCK;
      const along = rand(-CITY_R, CITY_R);
      if (Math.random() < 0.5) { x = road + pick([-11, 11]); z = along; }
      else { x = along; z = road + pick([-11, 11]); }
    }
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick([0xc98d64, 0x8d5a3b, 0xe8b98d, 0x6b4226]) });
    const pants = new THREE.MeshLambertMaterial({ color: pick([0x2a2d33, 0x4a3b2a, 0x33455e]) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirt);
    torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.y = 1.72; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
    legL.position.set(-0.15, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return {
      mesh: g, legL, legR, x, z,
      heading: rand(0, Math.PI * 2), speed: rand(1.0, 1.8),
      axis: Math.random() < 0.5 ? 'x' : 'z',
      state: 'walk', phase: rand(0, 6), alive: true, fear: 0,
    };
  }
  // danger: {x, z, radius} to flee from (gunfire, fast car)
  update(dt, danger) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if (danger) {
        const d = Math.hypot(p.x - danger.x, p.z - danger.z);
        if (d < danger.radius) { p.state = 'flee'; p.fear = 1; }
      }
      if (p.state === 'flee') {
        p.fear -= dt * 0.25;
        if (p.fear <= 0) p.state = 'walk';
        // run away from danger
        const dx = p.x - (danger ? danger.x : p.x), dz = p.z - (danger ? danger.z : p.z);
        const len = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / len, dz / len);
        p.speed = 5.2;
      } else {
        p.speed = 1.4;
      }
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      const hit = this.city.collideCircle(nx, nz, 0.5);
      // turn around at city edge or randomly at intersections
      if (Math.abs(hit.x) > CITY_R + 10 || Math.abs(hit.z) > CITY_R + 10 || Math.random() < dt * 0.02) {
        p.heading += Math.PI + rand(-0.6, 0.6);
      }
      p.x = hit.x; p.z = hit.z;
      p.phase += dt * p.speed * 2.2;
      const swing = Math.sin(p.phase) * 0.5;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
    // keep the crowd topped up
    if (this.list.filter((p) => p.alive).length < 18) {
      this.list.push(this.spawnRandom());
    }
  }
  kill(p) {
    p.alive = false;
    p.mesh.rotation.x = -Math.PI / 2; // fall over
    p.mesh.position.y = 0.3;
    setTimeout(() => { this.scene.remove(p.mesh); }, 4000);
  }
  nearestAlive(x, z, r) {
    let best = null, bd = r;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
