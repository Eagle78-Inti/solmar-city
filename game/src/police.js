// Solmar City v7 — police: pursuit cars that chase, ram and bust, plus
// the police helicopter with a searchlight cone and ground pool at 4–5
// stars. Wanted level 0–5 drives how many units are out.
import * as THREE from 'three';
import { clamp, lerp, rand, randi, angleLerp, dist2 } from './util.js';
import { makeCar } from './vehicles.js';

export function spawnPolice(G, n) {
  while (G.police.length < n) {
    const group = makeCar({ type: 'sedan', color: 0x181a20, police: true });
    const a = rand(Math.PI * 2);
    group.position.set(G.player.pos.x + Math.sin(a) * 45, 0, G.player.pos.z + Math.cos(a) * 45);
    G.scene.add(group);
    G.police.push({ group, speed: 0, heading: 0, bust: 0, siren: rand(Math.PI * 2) });
  }
}

export function updatePolice(G, dt) {
  const want = G.wanted;
  const target = want === 0 ? 0 : want <= 1 ? 2 : want === 2 ? 3 : want === 3 ? 4 : 6;
  if (G.police.length < target) spawnPolice(G, target);
  const p = G.player;
  for (let i = G.police.length - 1; i >= 0; i--) {
    const c = G.police[i];
    if (G.police.length > target) { G.scene.remove(c.group); G.police.splice(i, 1); continue; }
    const dx = p.pos.x - c.group.position.x, dz = p.pos.z - c.group.position.z;
    const d = Math.hypot(dx, dz);
    const wantH = Math.atan2(dx, dz);
    c.heading = angleLerp(c.heading, wantH, Math.min(1, dt * 2.4));
    c.speed = lerp(c.speed, d > 6 ? 30 : 14, Math.min(1, dt * 1.2));
    c.group.position.x += Math.sin(c.heading) * c.speed * dt;
    c.group.position.z += Math.cos(c.heading) * c.speed * dt;
    c.group.position.x = clamp(c.group.position.x, -268, 268);
    c.group.position.z = clamp(c.group.position.z, -268, 268);
    c.group.rotation.y = c.heading;
    for (const w of c.group.userData.wheels) w.rotation.x += c.speed * dt / 0.34;
    c.siren += dt * 9;
    const bar = c.group.userData.lightBar;
    if (bar) { bar[0].material.emissiveIntensity = Math.sin(c.siren) > 0 ? 2.4 : 0.15; bar[1].material.emissiveIntensity = Math.sin(c.siren) > 0 ? 0.15 : 2.4; }
    // ram the player's car
    if (p.car && d < 3.4) {
      p.car.speed = Math.max(6, p.car.speed * 0.92);
      p.car.group.position.x += Math.sin(c.heading) * 2.2 * dt;
      p.car.group.position.z += Math.cos(c.heading) * 2.2 * dt;
      G.shake = Math.min(0.6, (G.shake || 0) + 0.3);
      G.audio.thud();
    }
    // bust: close to a slow or on-foot player for 3 seconds
    const slow = !p.car || Math.abs(p.car.speed) < 3;
    if (d < 4.5 && slow) {
      c.bust += dt;
      if (c.bust > 3) { G.audio.busted(); respawnBusted(G); return; }
    } else c.bust = 0;
  }
  updateHeli(G, dt);
}

function respawnBusted(G) {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 120);
  p.car = null; p.mesh.visible = true;
  p.pos.set(-240, 0, 240); p.heading = Math.PI / 2;
  p.mesh.position.copy(p.pos);
  p.health = 100;
  G.wanted = 0;
  for (const c of G.police) G.scene.remove(c.group);
  G.police.length = 0;
  if (G.heli) { G.scene.remove(G.heli.group); G.heli = null; }
  G.toast('Busted — $120 bail, dropped at the safehouse');
  G.save();
}

export function spawnHeli(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6), bodyMat);
  body.castShadow = true; group.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.1, metalness: 0.9 }));
  nose.position.set(0, -0.1, 2.4); nose.scale.set(1, 0.8, 0.9); group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.2); group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.9), bodyMat);
  fin.position.set(0, 0.9, -6.2); group.add(fin);
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.1; group.add(rotor);
  const nav = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.4 }));
  nav.position.set(0, -0.9, 1.4); group.add(nav);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 18, 1, true), coneMat);
  cone.position.y = -13.5; group.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -25.4; group.add(pool);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 60, 0.42, 0.5, 1.2);
  spot.position.set(0, -0.8, 0); group.add(spot); group.add(spot.target);
  spot.target.position.set(0, -26, 0);
  group.userData = { rotor, nav, cone, pool, spot };
  group.position.set(G.player.pos.x + 20, 26, G.player.pos.z - 18);
  G.scene.add(group);
  G.heli = { group, angle: 0.6, orbitR: 26, height: 14 };
}

// --- helicopter orbit + searchlight -----------------------------------------
export function updateHeli(G, dt) {
  if (G.wanted >= 4 && !G.heli) spawnHeli(G);
  if (G.wanted < 4 && G.heli) { G.scene.remove(G.heli.group); G.heli = null; return; }
  if (!G.heli) return;
  const h = G.heli;
  const p = G.player;
  h.angle += dt * 0.55;
  const hx = p.pos.x + Math.cos(h.angle) * h.orbitR;
  const hz = p.pos.z + Math.sin(h.angle) * h.orbitR;
  h.group.position.x = hx;
  h.group.position.z = hz;
  h.group.position.y = (h.height || 26) + Math.sin(G.elapsed * 0.7) * 1.5;
  h.group.lookAt(p.pos.x, h.group.position.y, p.pos.z);
  h.group.userData.rotor.rotation.y += dt * 22;
  h.group.userData.nav.material.emissiveIntensity = Math.sin(G.elapsed * 6) > 0 ? 2.6 : 0.2;
  // aim the beam + pool at the player
  const dx = p.pos.x - hx, dz = p.pos.z - hz;
  const beamDir = new THREE.Vector3(dx, -h.group.position.y, dz).normalize();
  h.group.userData.cone.lookAt(h.group.position.x + beamDir.x * 10, h.group.position.y + beamDir.y * 10, h.group.position.z + beamDir.z * 10);
  h.group.userData.cone.rotation.x = Math.PI;
  h.group.userData.pool.position.set(p.pos.x - hx, -25.4, p.pos.z - hz);
  h.group.userData.pool.position.y = -h.group.position.y + 0.4;
  h.group.userData.spot.target.position.set(dx, -h.group.position.y, dz);
}

export function clearPolice(G) {
  for (const c of G.police) G.scene.remove(c.group);
  G.police.length = 0;
  if (G.heli) { G.scene.remove(G.heli.group); G.heli = null; }
}

// How many police units the current wanted level should have out.
export function policeTargetFor(wanted) {
  return wanted === 0 ? 0 : wanted <= 1 ? 2 : wanted === 2 ? 3 : wanted === 3 ? 4 : 6;
}
