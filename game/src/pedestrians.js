// Solmar City — pedestrians: varied walkers who stroll the sidewalks and run
// when a gun goes off or a car comes at them too fast. They make the streets
// feel lived in, and they notice when you make trouble.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, angleLerp, dist2, boxGeo, stdMat } from './util.js';

const SKINS = [0xc98e6a, 0x8a5a3b, 0xe8b98d, 0x6b4423, 0xd9a077];
const SHIRTS = [0xd94f4f, 0x4f7dd9, 0x4fd97a, 0xe8d44f, 0x9a4fd9, 0xeeeeee, 0xff8c42, 0x2fb8a6];
const PANTS = [0x2c3e55, 0x3a3a3a, 0x5a4a3a, 0x445566, 0x777777];
const HAIRS = [0x1c1410, 0x4a2f18, 0x888888, 0x2a1a0c, 0xb8b8b8];

export function buildPedMesh() {
  const g = new THREE.Group();
  const skin = stdMat({ color: pick(SKINS), roughness: 0.75 });
  const shirt = stdMat({ color: pick(SHIRTS), roughness: 0.85 });
  const pants = stdMat({ color: pick(PANTS), roughness: 0.85 });
  const hair = stdMat({ color: pick(HAIRS), roughness: 0.9 });
  const parts = {};
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.13, 0.82, 0);
    const l = new THREE.Mesh(boxGeo(0.18, 0.78, 0.2), pants);
    l.position.y = -0.39;
    l.castShadow = true;
    leg.add(l);
    g.add(leg);
    parts[s > 0 ? 'legR' : 'legL'] = leg;
    const arm = new THREE.Group();
    arm.position.set(s * 0.3, 1.38, 0);
    const a = new THREE.Mesh(boxGeo(0.15, 0.62, 0.17), shirt);
    a.position.y = -0.31;
    a.castShadow = true;
    arm.add(a);
    const hand = new THREE.Mesh(boxGeo(0.13, 0.12, 0.14), skin);
    hand.position.y = -0.66;
    arm.add(hand);
    g.add(arm);
    parts[s > 0 ? 'armR' : 'armL'] = arm;
  }
  const torso = new THREE.Mesh(boxGeo(0.52, 0.58, 0.3), shirt);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Group();
  head.position.y = 1.56;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  skull.position.y = 0.1;
  skull.castShadow = true;
  head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
  cap.position.y = 0.13;
  head.add(cap);
  g.add(head);
  g.userData.parts = parts;
  return g;
}

export class Pedestrian {
  constructor(scene, city, x, z) {
    this.city = city;
    this.mesh = buildPedMesh();
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(x, 0, z);
    this.heading = rand(0, Math.PI * 2);
    this.speed = 0;
    this.cruise = rand(1.1, 2.0);
    this.state = 'walk'; // walk | flee | down
    this.target = null;
    this.phase = rand(0, 6);
    this.downT = 0;
    this.pickTarget();
  }
  pickTarget() {
    const spots = this.city.sidewalkSpots;
    const s = spots[Math.floor(Math.random() * spots.length)];
    this.target = { x: s.x + rand(-6, 6), z: s.z + rand(-6, 6) };
  }
  fleeFrom(x, z) {
    this.state = 'flee';
    const dx = this.pos.x - x;
    const dz = this.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.target = { x: this.pos.x + (dx / d) * 40, z: this.pos.z + (dz / d) * 40 };
  }
  knockDown() {
    if (this.state === 'down') return;
    this.state = 'down';
    this.downT = 0;
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = 0.2;
  }
  update(dt, threats) {
    if (this.state === 'down') {
      this.downT += dt;
      if (this.downT > 18) {
        // Get up far away and walk off: the street moves on.
        this.state = 'walk';
        this.mesh.rotation.z = 0;
        this.mesh.position.y = 0;
        this.pickTarget();
        const spots = this.city.sidewalkSpots;
        const s = spots[Math.floor(Math.random() * spots.length)];
        this.pos.set(s.x, 0, s.z);
      }
      return;
    }
    // A threat nearby (gunfire, or a car bearing down) makes them run.
    for (const t of threats) {
      const d = dist2(this.pos.x, this.pos.z, t.x, t.z);
      if (d < t.radius) { this.fleeFrom(t.x, t.z); break; }
    }
    // A fleeing ped who has put distance between themselves and the scare
    // slows back to a walk instead of sprinting forever.
    if (this.state === 'flee' && this.target && dist2(this.pos.x, this.pos.z, this.target.x, this.target.z) < 3) {
      this.state = 'walk';
    }
    const top = this.state === 'flee' ? 6.2 : this.cruise;
    if (!this.target || dist2(this.pos.x, this.pos.z, this.target.x, this.target.z) < 1.5) {
      if (this.state === 'flee') { this.state = 'walk'; }
      this.pickTarget();
    }
    const want = Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z);
    this.heading = angleLerp(this.heading, want, 1 - Math.exp(-4 * dt));
    this.speed = lerp(this.speed, top, 1 - Math.exp(-4 * dt));
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.city.clampToCity(this.pos);
    this.city.resolveCircle(this.pos, 0.5);
    this.phase += this.speed * dt * 2.2;
    const sw = clamp(this.speed / 6.2, 0.15, 1) * 0.55;
    const p = this.mesh.userData.parts;
    p.legL.rotation.x = Math.sin(this.phase) * sw;
    p.legR.rotation.x = -Math.sin(this.phase) * sw;
    p.armL.rotation.x = -Math.sin(this.phase) * sw * 0.8;
    p.armR.rotation.x = Math.sin(this.phase) * sw * 0.8;
    this.mesh.rotation.y = this.heading;
  }
}

export function createPedestrians(scene, city, count) {
  const peds = [];
  const spots = [...city.sidewalkSpots];
  for (let i = 0; i < count && spots.length; i++) {
    const s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    peds.push(new Pedestrian(scene, city, s.x, s.z));
  }
  return peds;
}

export function nearestPed(peds, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = dist2(x, z, p.pos.x, p.pos.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// When something violent happens, the whole street notices: every walker in
// earshot runs. Combat calls this after a shot lands.
export function witnessFlee(peds, x, z, radius = 26) {
  let count = 0;
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (dist2(p.pos.x, p.pos.z, x, z) < radius) {
      p.fleeFrom(x, z);
      count++;
    }
  }
  return count;
}
