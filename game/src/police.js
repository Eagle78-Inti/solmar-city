import * as THREE from 'three';
// Solmar City — the wanted system: police cruisers that chase, ram and
// bust, plus a helicopter with a searchlight cone at 4–5 stars.
import { clamp, lerp, lerpAngle, dist2d, boxGeo, cylGeo, sphGeo, std } from './util.js';
import { makeCarMesh, hitsBuilding } from './vehicles.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.cruisers = [];
    this.heli = null; this.heliAngle = 0;
    this.bustTimer = 0;
    this.sirenPhase = 0;
  }
  wantedCount(wanted) { return Math.min(wanted * 2, 8); }
  clear() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    if (this.heli) { this.scene.remove(this.heli.group); this.heli = null; }
    this.bustTimer = 0;
  }
  spawnCruiser(x, z) {
    const { group } = makeCarMesh(0x1a1d22, { police: true });
    group.position.set(x, 0, z);
    this.scene.add(group);
    const c = { mesh: group, x, z, heading: 0, speed: 0, bar: group.userData.lightBar };
    this.cruisers.push(c);
    return c;
  }
  ensureCount(wanted, px, pz, heading) {
    const want = this.wantedCount(wanted);
    while (this.cruisers.length < want) {
      const a = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 25;
      const x = clamp(px + Math.sin(a) * r, -180, 180);
      const z = clamp(pz + Math.cos(a) * r, -180, 180);
      this.spawnCruiser(x, z);
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    if (wanted >= 4 && !this.heli) this.spawnHeli(px, pz, heading);
    if (wanted < 4 && this.heli) { this.scene.remove(this.heli.group); this.heli = null; }
  }
  // Spawn ahead of the player (along their heading) so the heli and its
  // beam read in frame at once, low enough to see from the chase camera.
  spawnHeli(px, pz, heading) {
    const g = new THREE.Group();
    const bodyMat = std('#20242a', 0.5, 0.5);
    const body = new THREE.Mesh(boxGeo(3.4, 1.3, 1.6), bodyMat);
    body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(boxGeo(1.2, 0.8, 1.5), new THREE.MeshStandardMaterial({ color: '#0d1520', roughness: 0.1, metalness: 0.9 }));
    glass.position.set(1.4, 0.1, 0); g.add(glass);
    const tail = new THREE.Mesh(boxGeo(3.2, 0.4, 0.4), bodyMat);
    tail.position.set(-2.8, 0.3, 0); g.add(tail);
    const rotor = new THREE.Group();
    const blade = new THREE.Mesh(boxGeo(8.5, 0.06, 0.5), std('#14161a', 0.6));
    rotor.add(blade);
    const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
    rotor.position.y = 0.95; g.add(rotor);
    const skids = new THREE.Mesh(boxGeo(2.6, 0.1, 1.8), std('#14161a', 0.6));
    skids.position.y = -0.85; g.add(skids);
    // Searchlight: a translucent cone + a bright pool where it lands.
    const coneMat = new THREE.MeshBasicMaterial({
      color: '#fff6c0', transparent: true, opacity: 0.18,
      side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 20, 1, true), coneMat);
    cone.position.y = -8.5; cone.rotation.x = Math.PI; g.add(cone);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24), new THREE.MeshBasicMaterial({
      color: '#fff2b0', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = -15.4; g.add(pool);
    this.heliAngle = heading;
    g.position.set(px + Math.sin(heading) * 24, 16, pz + Math.cos(heading) * 24);
    this.scene.add(g);
    this.heli = { group: g, rotor, coneMat, pool };
  }

  // Chase the player, ram them, and bust them if caught slow for 3 seconds.
  // Returns 'busted' when the bust completes, otherwise null.
  update(dt, wanted, player, playerSpeed, audio) {
    if (wanted <= 0) { if (this.cruisers.length) this.clear(); if (audio) audio.setSiren(false); return null; }
    this.ensureCount(wanted, player.pos.x, player.pos.z, player.heading);
    if (audio) audio.setSiren(true);
    this.sirenPhase += dt;
    const px = player.pos.x, pz = player.pos.z;
    let busted = null;
    for (const c of this.cruisers) {
      const d = dist2d(c.x, c.z, px, pz);
      const wantHeading = Math.atan2(px - c.x, pz - c.z);
      c.heading = lerpAngle(c.heading, wantHeading, Math.min(1, dt * 2.2));
      const targetSpeed = d > 60 ? 30 : d > 14 ? 26 : 15;
      c.speed = lerp(c.speed, targetSpeed, Math.min(1, dt * 1.5));
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      if (!hitsBuilding(nx, c.z, this.city.buildings, 0.4)) c.x = nx;
      if (!hitsBuilding(c.x, nz, this.city.buildings, 0.4)) c.z = nz;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Flashing light bar, alternating red and blue.
      const ph = Math.floor(this.sirenPhase * 4) % 2;
      if (c.bar) { c.bar[0].emissiveIntensity = ph === 0 ? 2.2 : 0.15; c.bar[1].emissiveIntensity = ph === 1 ? 2.2 : 0.15; }
      // Ram: slow the player on contact and shake their camera.
      if (d < 3.4 && player.car) { player.car.speed *= 0.86; player.shake = Math.max(player.shake || 0, 0.5); }
      // Bust: police close by while the player is slow, on foot or driving.
      if (d < 4.5 && playerSpeed < 2.5) {
        this.bustTimer += dt;
        if (this.bustTimer > 3) { busted = 'busted'; break; }
      }
    }
    if (busted === null) this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    // Helicopter circles overhead, beam sweeping the streets.
    if (this.heli) {
      this.heliAngle += dt * 0.35;
      const hx = px + Math.sin(this.heliAngle) * 24;
      const hz = pz + Math.cos(this.heliAngle) * 24;
      this.heli.group.position.set(hx, 16, hz);
      this.heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heli.rotor.rotation.y += dt * 28;
      this.heli.coneMat.opacity = 0.16 + Math.sin(this.sirenPhase * 3) * 0.03;
    }
    return busted;
  }

  // Stage a fixed chase for a screenshot: cruisers placed around the player.
  stageChase(px, pz, heading, count) {
    this.clear();
    for (let i = 0; i < count; i++) {
      const a = heading + (i - (count - 1) / 2) * 0.5;
      const d = 14 + (i % 2) * 6;
      this.spawnCruiser(px + Math.sin(a) * d, pz + Math.cos(a) * d);
    }
  }
}
