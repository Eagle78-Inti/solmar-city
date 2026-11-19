// Solmar City v7 — the player: Rook, a detailed on-foot character, plus
// arcade driving, entering/exiting cars, camera follow and collisions.
import * as THREE from 'three';
import { clamp, lerp, rand, angleLerp, dist2 } from './util.js';
import { collideCircle } from './util.js';
import { ROAD_COORDS } from './city.js';

export function makeRook() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), jacket);
  torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.06), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
  chest.position.set(0, 1.18, 0.17); g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), hair);
  cap.position.y = 1.66; g.add(cap);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.24), jeans);
    leg.position.set(s * 0.14, 0.39, 0); leg.castShadow = true; g.add(leg); legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.18), jacket);
    arm.position.set(s * 0.34, 1.14, 0); arm.castShadow = true; g.add(arm);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.3, metalness: 0.8 }));
  gun.position.set(0.34, 0.86, 0.18); g.add(gun);
  g.userData.legs = legs;
  return g;
}

// Drive one car with arcade physics. car = {group, speed, heading}.
// Returns distance moved this frame.
export function driveCar(G, car, dt) {
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 0.7 : 0);
  const steer = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const brake = k['Space'] ? 1 : 0;
  const maxSpeed = 42;
  if (fwd > 0) car.speed += 26 * dt * fwd;
  else if (fwd < 0) car.speed += 18 * dt * fwd;
  else car.speed -= Math.sign(car.speed) * 10 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 40 * dt;
  car.speed = clamp(car.speed, -12, maxSpeed);
  if (Math.abs(car.speed) < 0.05) car.speed = 0;
  const turn = steer * 1.9 * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += turn;
  const nx = car.group.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.group.position.z + Math.cos(car.heading) * car.speed * dt;
  const p = { x: nx, z: nz };
  collideCircle(p, 1.4, G.colliders);
  const moved = Math.hypot(p.x - car.group.position.x, p.z - car.group.position.z);
  if (moved < Math.abs(car.speed) * dt * 0.5 && Math.abs(car.speed) > 4) { car.speed *= 0.4; G.shake = Math.min(0.5, (G.shake || 0) + 0.25); }
  car.group.position.x = clamp(p.x, -268, 268);
  car.group.position.z = clamp(p.z, -268, 268);
  car.group.rotation.y = car.heading;
  for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt / 0.34;
  const front = car.group.userData.wheels[0];
  if (front) front.rotation.y = steer * 0.32;
  return moved;
}

// --- on-foot movement, entering/exiting cars, camera -------------------------
export function updatePlayer(G, dt) {
  const p = G.player;
  const k = G.keys;
  if (p.car) {
    const moved = driveCar(G, p.car, dt);
    p.speed = Math.abs(p.car.speed) * 3.6;
    p.pos.copy(p.car.group.position);
    p.heading = p.car.heading;
    if (k['KeyR']) { p.car.group.position.set(0, 0, 0); p.car.group.rotation.y = 0; p.car.heading = 0; p.car.speed = 0; }
  } else {
    const sprint = k['ShiftLeft'] || k['ShiftRight'];
    const sp = sprint ? 9 : 5;
    let fx = 0, fz = 0;
    const camA = G.camAngle;
    if (k['KeyW'] || k['ArrowUp']) { fx += Math.sin(camA); fz += Math.cos(camA); }
    if (k['KeyS'] || k['ArrowDown']) { fx -= Math.sin(camA); fz -= Math.cos(camA); }
    if (k['KeyA'] || k['ArrowLeft']) { fx -= Math.cos(camA); fz += Math.sin(camA); }
    if (k['KeyD'] || k['ArrowRight']) { fx += Math.cos(camA); fz -= Math.sin(camA); }
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len; fz /= len;
      p.heading = Math.atan2(fx, fz);
      const np = { x: p.pos.x + fx * sp * dt, z: p.pos.z + fz * sp * dt };
      collideCircle(np, 0.6, G.colliders);
      p.pos.x = clamp(np.x, -268, 268); p.pos.z = clamp(np.z, -268, 268);
      p.speed = sp * 3.6;
      p.walkPhase = (p.walkPhase || 0) + dt * (sprint ? 13 : 9);
      const sw = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legs[0].rotation.x = sw; p.mesh.userData.legs[1].rotation.x = -sw;
    } else {
      p.speed = 0;
      p.mesh.userData.legs[0].rotation.x = 0; p.mesh.userData.legs[1].rotation.x = 0;
    }
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
  }
  updateCamera(G, dt);
}

export function tryEnterCar(G) {
  const p = G.player;
  if (p.car) { exitCar(G); return; }
  // re-enter your own car — no wanted level for your own ride
  if (G.ownCar) {
    const oc = G.ownCar.group.position;
    if (dist2(p.pos.x, p.pos.z, oc.x, oc.z) < 6.5 * 6.5) {
      p.car = G.ownCar; p.mesh.visible = false; p.pos.copy(oc); return;
    }
  }
  let best = null, bestD = 6.5 * 6.5;
  for (const pk of G.parked) {
    if (pk.stolen) continue;
    const d = dist2(p.pos.x, p.pos.z, pk.x, pk.z);
    if (d < bestD) { bestD = d; best = pk; }
  }
  if (!best) return;
  best.stolen = true;
  const car = { group: best.group, speed: 0, heading: best.heading };
  p.car = car;
  p.mesh.visible = false;
  p.pos.copy(best.group.position);
  G.ownCar = car;
  setWanted(G, 1);
  G.toast('Car stolen — the police are coming!');
  G.audio.sirenBlip();
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const h = p.car.heading;
  p.pos.set(p.car.group.position.x - Math.sin(h) * 2.5, 0, p.car.group.position.z - Math.cos(h) * 2.5);
  p.car = null; p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
}

export function setWanted(G, n) {
  G.wanted = clamp(n, 0, 5);
  G.wantedTimer = 0;
  if (G.wanted >= 1) G.audio.sirenBlip();
}

export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  const behind = p.car ? 11 : 7;
  const height = p.car ? 4.6 : 3.4;
  const tx = p.pos.x - Math.sin(p.heading) * behind;
  const tz = p.pos.z - Math.cos(p.heading) * behind;
  const lx = p.pos.x + Math.sin(p.heading) * 6;
  const lz = p.pos.z + Math.cos(p.heading) * 6;
  const k = Math.min(1, dt * 4.5);
  cam.position.x = lerp(cam.position.x, tx, k);
  cam.position.y = lerp(cam.position.y, height, k);
  cam.position.z = lerp(cam.position.z, tz, k);
  if (G.shake > 0) {
    cam.position.x += rand(-1, 1) * G.shake * 0.3;
    cam.position.y += rand(-1, 1) * G.shake * 0.2;
    G.shake = Math.max(0, G.shake - dt * 1.4);
  }
  cam.lookAt(lx, 1.2, lz);
}

export function respawnAtSafehouse(G) {
  const p = G.player;
  p.car = null; p.mesh.visible = true;
  p.pos.set(-240, 0, 240); p.heading = Math.PI / 2;
  p.mesh.position.copy(p.pos);
  p.health = 100;
  setWanted(G, 0);
  G.toast('Busted — dropped at the safehouse');
}

// Park the player's car neatly at the nearest road centre and face it
// along the road, used when a mission step needs a clean getaway.
export function parkPlayerCar(G) {
  const p = G.player;
  if (!p.car) return;
  const rx = ROAD_COORDS.reduce((a, b) => (Math.abs(b - p.pos.x) < Math.abs(a - p.pos.x) ? b : a), 0);
  p.car.group.position.set(rx, 0, p.pos.z);
  p.car.heading = 0; p.car.speed = 0; p.car.group.rotation.y = 0;
}
