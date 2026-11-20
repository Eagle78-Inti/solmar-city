// player.js — the player on foot, behind the wheel, at the helm and in the
// air: movement, driving, entering and stealing vehicles, interactions.

import * as THREE from 'three';
import { G, addRp, toast } from './state.js';
import { insideBuilding } from './city.js';
import { clamp, groundDist, wrapAngle } from './util.js';
import { nearestBoat, nearestVehicle, updateFlyHeli } from './vehicles.js';
import { addWanted } from './police.js';
import { openShop, storeCarAtGarage, tryQuickSave, tryRespray } from './activities.js';
import { hornSound } from './audio.js';

export const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
  run: false,
  camYaw: 0,
  camPitch: 0.32,
};

/** Attach keyboard + mouse listeners; main.js reads `input` each frame. */
export function initInput(canvas) {
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    syncKeys(keys);
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyF') {
      if (G.player && !G.player.onFoot) exitVehicle();
      else enterNearest();
    }
    if (e.code === 'KeyH') horn();
    if (e.code === 'Digit1') selectWeapon(1);
    if (e.code === 'Digit2') selectWeapon(2);
    if (e.code === 'Digit3') selectWeapon(3);
    if (e.code === 'Digit4') selectWeapon(4);
    if (e.code === 'Digit5') selectWeapon(5);
    if (e.code === 'KeyR') window.SOL && window.SOL.reload && window.SOL.reload();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    syncKeys(keys);
  });
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.camYaw -= (e.clientX - lastX) * 0.005;
    input.camPitch = clamp(input.camPitch + (e.clientY - lastY) * 0.003, 0.05, 1.1);
    lastX = e.clientX;
    lastY = e.clientY;
  });
}

function syncKeys(keys) {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.up = !!keys.Space;
  input.down = !!keys.KeyC;
  input.run = !!keys.ShiftLeft || !!keys.ShiftRight;
}

function selectWeapon(slot) {
  const w = G.weapons[slot - 1];
  if (w && w.owned) G.weaponSlot = slot;
}

/** The horn: a short beep that turns nearby heads. */
export function horn() {
  hornSound();
  for (const ped of G.peds) {
    if (groundDist(G.player.pos.x, G.player.pos.z, ped.mesh.position.x, ped.mesh.position.z) < 10) {
      ped.yaw = Math.atan2(G.player.pos.x - ped.mesh.position.x, G.player.pos.z - ped.mesh.position.z);
    }
  }
}

/** Enter the nearest vehicle, boat or helicopter. */
export function enterNearest() {
  const p = G.player;
  if (!p || !p.onFoot) return false;
  // Flyable helicopter first (it sits on the helipad).
  if (G.flyHeli && groundDist(p.pos.x, p.pos.z, G.flyHeli.mesh.position.x, G.flyHeli.mesh.position.z) < 6) {
    p.vehicle = G.flyHeli;
    G.flyHeli.isPlayer = true;
    p.onFoot = false;
    p.mesh.visible = false;
    toast('Helicopter — Space climbs, C descends, W/S pitch', 4);
    return true;
  }
  const boat = nearestBoat(p.pos.x, p.pos.z, 6);
  if (boat) {
    p.vehicle = boat;
    boat.isPlayer = true;
    p.onFoot = false;
    p.mesh.visible = false;
    toast('Boat — W throttle, A/D steer', 3);
    return true;
  }
  // A mission car is the objective: prefer this mission's car over the car
  // the player just left parked beside it (an older mission car may be
  // sitting in the same spot).
  const missionCar =
    G.cars.find(
      (c) => c.isMission && c.missionN === G.mission && !c.isPlayer && c.kind !== 'boat' && c.kind !== 'yacht' && groundDist(p.pos.x, p.pos.z, c.mesh.position.x, c.mesh.position.z) < 6,
    ) ||
    G.cars.find(
      (c) => c.isMission && !c.isPlayer && c.kind !== 'boat' && c.kind !== 'yacht' && groundDist(p.pos.x, p.pos.z, c.mesh.position.x, c.mesh.position.z) < 6,
    );
  const car = missionCar || nearestVehicle(p.pos.x, p.pos.z, 4.5);
  if (car) {
    p.vehicle = car;
    car.isPlayer = true;
    p.onFoot = false;
    p.mesh.visible = false;
    if (!car.parked && !car.isMission) {
      G.stats.carsStolen++;
      addWanted(1);
      toast('Car stolen — the law is coming', 3);
    }
    return true;
  }
  return false;
}

/** Step out of the current vehicle. */
export function exitVehicle() {
  const p = G.player;
  if (!p || p.onFoot || !p.vehicle) return;
  const v = p.vehicle;
  v.isPlayer = false;
  if (v.kind === 'heli' && v.altitude > 1) return; // must land first
  const side = { x: v.mesh.position.x + Math.cos(v.yaw) * 3, z: v.mesh.position.z - Math.sin(v.yaw) * 3 };
  p.pos.set(side.x, 0, side.z);
  p.mesh.position.copy(p.pos);
  p.mesh.visible = true;
  p.onFoot = true;
  p.vehicle = null;
  p.yaw = v.yaw;
}

/** E key: shop, garage, safehouse save, respray, or enter a vehicle. */
export function interact() {
  const p = G.player;
  if (!p || !p.onFoot) return;
  const x = p.pos.x;
  const z = p.pos.z;
  if (groundDist(x, z, 56, -48) < 6) {
    openShop();
    return;
  }
  if (groundDist(x, z, -56, 130) < 6) {
    storeCarAtGarage();
    return;
  }
  if (groundDist(x, z, -292, 90) < 6) {
    tryQuickSave();
    return;
  }
  if (groundDist(x, z, 168, -56) < 6) {
    tryRespray();
    return;
  }
  enterNearest();
}

/** Move the player: on foot, driving, boating or flying. */
export function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  if (!p.onFoot && p.vehicle) {
    updateVehicle(dt);
    return;
  }
  // On foot: WASD relative to the camera yaw.
  const speed = input.run ? 8.5 : 5;
  let mx = 0;
  let mz = 0;
  if (input.forward) {
    mx -= Math.sin(input.camYaw);
    mz -= Math.cos(input.camYaw);
  }
  if (input.back) {
    mx += Math.sin(input.camYaw);
    mz += Math.cos(input.camYaw);
  }
  if (input.left) {
    mx -= Math.cos(input.camYaw);
    mz += Math.sin(input.camYaw);
  }
  if (input.right) {
    mx += Math.cos(input.camYaw);
    mz -= Math.sin(input.camYaw);
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    p.speed = speed;
    const nx = p.pos.x + mx * speed * dt;
    const nz = p.pos.z + mz * speed * dt;
    // Slide along buildings instead of walking through them.
    if (!insideBuilding(nx, p.pos.z)) p.pos.x = nx;
    if (!insideBuilding(p.pos.x, nz)) p.pos.z = nz;
    p.yaw = Math.atan2(mx, mz);
  } else {
    p.speed = 0;
  }
  p.pos.x = clamp(p.pos.x, -335, 285);
  p.pos.z = clamp(p.pos.z, -228, 228);
}

/** Drive the current vehicle (car, boat or helicopter). */
function updateVehicle(dt) {
  const p = G.player;
  const v = p.vehicle;
  if (v.kind === 'heli') {
    updateFlyHeli(dt, input);
    p.pos.copy(v.mesh.position);
    p.yaw = v.yaw;
    return;
  }
  if (v.kind === 'boat' || v.kind === 'yacht') {
    const target = input.forward ? 16 : input.back ? -5 : 0;
    v.speed += (target - v.speed) * Math.min(1, dt * 1.2);
    if (input.left) v.yaw += dt * 0.9 * Math.sign(v.speed || 1);
    if (input.right) v.yaw -= dt * 0.9 * Math.sign(v.speed || 1);
    v.mesh.position.x += Math.sin(v.yaw) * v.speed * dt;
    v.mesh.position.z += Math.cos(v.yaw) * v.speed * dt;
    v.mesh.position.x = clamp(v.mesh.position.x, -420, -276);
    v.mesh.position.z = clamp(v.mesh.position.z, -230, 230);
    v.mesh.rotation.y = v.yaw;
    v.mesh.position.y = 0.1 + Math.sin(performance.now() / 700) * 0.08;
    p.pos.copy(v.mesh.position);
    p.yaw = v.yaw;
    return;
  }
  // Car: arcade driving with steering, building and traffic bumps.
  const maxSpeed = 26;
  if (input.forward) v.speed = Math.min(maxSpeed, v.speed + 15 * dt);
  else if (input.back) v.speed = Math.max(-8, v.speed - 18 * dt);
  else v.speed *= Math.max(0, 1 - dt * 1.4);
  if (Number.isFinite(v.speed) === false) v.speed = 0;
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const gripFactor = 0.6 + (G.grip / 100) * 0.6;
  v.yaw += steer * dt * 1.9 * clamp(Math.abs(v.speed) / 10, 0, 1) * Math.sign(v.speed || 1) * gripFactor;
  const nx = v.mesh.position.x + Math.sin(v.yaw) * v.speed * dt;
  const nz = v.mesh.position.z + Math.cos(v.yaw) * v.speed * dt;
  if (insideBuilding(nx, nz)) {
    // Bounce off the wall: lose speed and condition.
    v.speed *= -0.25;
    v.condition = Math.max(0, v.condition - 4);
    G.grip = Math.max(0, G.grip - 4);
  } else {
    v.mesh.position.x = nx;
    v.mesh.position.z = nz;
  }
  // Bump into traffic cars.
  for (const other of G.cars) {
    if (other === v || other.isPlayer) continue;
    const d = groundDist(v.mesh.position.x, v.mesh.position.z, other.mesh.position.x, other.mesh.position.z);
    if (d < 3.4 && Math.abs(v.speed) > 3) {
      v.speed *= 0.5;
      v.condition = Math.max(0, v.condition - 3);
      G.grip = Math.max(0, G.grip - 3);
    }
  }
  // Stunt jump lift: a ramp launch raises the car briefly.
  if (v.jumpT && v.jumpT > 0) {
    v.jumpT -= dt;
    v.mesh.position.y = Math.sin((1 - v.jumpT / 1.2) * Math.PI) * 3.2;
  } else {
    v.mesh.position.y = 0;
  }
  // Grip grows with clean fast driving.
  if (Math.abs(v.speed) > 15) G.grip = Math.min(100, G.grip + dt * 2);
  v.mesh.position.x = clamp(v.mesh.position.x, -310, 282);
  v.mesh.position.z = clamp(v.mesh.position.z, -222, 226);
  v.mesh.rotation.y = v.yaw;
  p.pos.copy(v.mesh.position);
  p.yaw = v.yaw;
  p.speed = Math.abs(v.speed);
}

/** Where the camera looks: the player, or the vehicle they are in. */
export function cameraTarget() {
  const p = G.player;
  if (!p) return { x: 0, y: 1.5, z: 0, yaw: 0 };
  return { x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z, yaw: p.yaw };
}
