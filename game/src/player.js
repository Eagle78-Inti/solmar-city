// player.js — on-foot movement, driving, entering/exiting vehicles,
// and the Jason/Lucia character switch.
import { clamp, clampWorld, dist2d } from './util.js';
import { syncCar } from './vehicles.js';

export function updateOnFoot(G, mesh, input, dt) {
  const speed = input.shift ? 9 : 5.2;
  let mx = 0, mz = 0;
  if (input.w) mz += 1;
  if (input.s) mz -= 1;
  if (input.a) mx -= 1;
  if (input.d) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    // Movement is relative to the camera yaw.
    const cy = G.camYaw || 0;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const rx = Math.cos(cy), rz = -Math.sin(cy);
    const dx = fx * mz + rx * mx;
    const dz = fz * mz + rz * mx;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    G.pos.x += (dx / len) * speed * dt;
    G.pos.z += (dz / len) * speed * dt;
    G.pos.yaw = Math.atan2(dx, dz);
    const c = clampWorld(G.pos.x, G.pos.z);
    G.pos.x = c.x; G.pos.z = c.z;
    G.speed = speed;
  } else {
    G.speed = 0;
  }
  mesh.group.position.set(G.pos.x, 0, G.pos.z);
  mesh.group.rotation.y = G.pos.yaw;
  return moving;
}

export function updateDriving(G, car, input, dt) {
  // Arcade handling: W accelerates, S brakes/reverses, A/D steer.
  // GRIP falls while steering hard at speed; condition falls on hits.
  const maxSpeed = 34;
  if (input.w) car.speed = Math.min(maxSpeed, car.speed + 22 * dt);
  else if (input.s) car.speed = Math.max(-8, car.speed - 26 * dt);
  else car.speed *= (1 - Math.min(1, dt * 0.9));
  const steerInput = (input.a ? 1 : 0) - (input.d ? 1 : 0);
  const spd = car.speed;
  if (Math.abs(spd) > 0.5) {
    car.yaw += steerInput * 1.7 * dt * clamp(Math.abs(spd) / 12, 0.3, 1) * (spd >= 0 ? 1 : -1);
    if (steerInput !== 0 && Math.abs(spd) > 14) {
      G.grip = clamp(G.grip - 14 * dt, 0, 100);
    } else {
      G.grip = clamp(G.grip + 8 * dt, 0, 100);
    }
  }
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  car.x += fx * spd * dt;
  car.z += fz * spd * dt;
  const c = clampWorld(car.x, car.z);
  if (c.x !== car.x || c.z !== car.z) {
    car.x = c.x; car.z = c.z;
    car.speed *= -0.3;
    G.condition = clamp(G.condition - 4, 0, 100);
  }
  G.pos.x = car.x; G.pos.z = car.z; G.pos.yaw = car.yaw;
  G.speed = spd;
  syncCar(car);
  return car;
}

export function exitVehicle(G, mesh) {
  // Step out to the driver's side.
  const side = Math.PI / 2;
  G.pos.x = G.pos.x + Math.sin(G.pos.yaw + side) * 2.5;
  G.pos.z = G.pos.z + Math.cos(G.pos.yaw + side) * 2.5;
  const c = clampWorld(G.pos.x, G.pos.z);
  G.pos.x = c.x; G.pos.z = c.z;
  G.mode = 'foot';
  G.car = null;
  G.speed = 0;
  mesh.group.position.set(G.pos.x, 0, G.pos.z);
  mesh.group.visible = true;
}

export function enterVehicle(G, mesh, car) {
  G.mode = 'car';
  G.car = car;
  G.pos.x = car.x; G.pos.z = car.z; G.pos.yaw = car.yaw;
  mesh.group.visible = false;
  if (car.kind !== 'police') G.carsStolen += 1;
}

export function switchCharacter(G, scene, mesh) {
  G.character = G.character === 'Jason' ? 'Lucia' : 'Jason';
  G.role = G.character === 'Lucia' ? 'DRIVER' : 'RUNNER';
  return G.character;
}

// Horn: a short blip flag the HUD can show, plus the audio hook.
export function honk(G) {
  G.hornAt = Date.now();
  return true;
}
// Drive-by shooting is only possible from a vehicle with a gun out.
export function canDriveBy(G) {
  return G.mode === 'car' && G.activeWeapon > 0;
}
// Repair the current car at a respray (costs $150, restores condition).
export function respray(G) {
  if (G.cash < 150) return false;
  G.cash -= 150;
  G.condition = 100;
  return true;
}
