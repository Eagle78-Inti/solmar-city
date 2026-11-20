// combat.js — weapons, shooting (including drive-by from a car), damage and
// getting wasted. Five slots: fists plus four guns with ammo and reserves.

import { G, addRp, toast } from './state.js';
import { clamp, groundDist } from './util.js';
import { addWanted } from './police.js';
import { shootSound } from './audio.js';

const MAG_SIZE = { 2: 12, 3: 30, 4: 6, 5: 30 };

/** The currently selected weapon. */
export function currentWeapon() {
  return G.weapons[G.weaponSlot - 1];
}

/** Fire the current weapon at what the camera points at. */
export function fire() {
  const p = G.player;
  if (!p || G.paused || !G.started) return false;
  const w = currentWeapon();
  if (!w || !w.owned) return false;
  if (w.slot !== 1 && w.ammo <= 0) {
    toast('Click — ' + w.name + ' is empty. Press R to reload.', 2);
    return false;
  }
  if (w.slot !== 1) w.ammo--;
  G.stats.shots++;
  shootSound();
  const driveBy = !p.onFoot && p.vehicle && (p.vehicle.kind === 'car' || p.vehicle.kind === 'sedan' || p.vehicle.kind === 'taxi' || p.vehicle.kind === 'truck' || p.vehicle.kind === 'sports' || p.vehicle.kind === 'police');
  const ox = p.pos.x;
  const oz = p.pos.z;
  const dir = G.camDir || { x: 0, z: 1 };
  const range = driveBy ? w.range * 0.7 : w.range;
  // Nearest person roughly in front of the aim direction.
  let best = null;
  let bestD = range;
  for (const ped of [...G.peds, ...G.cops]) {
    if (ped.health <= 0) continue;
    const dx = ped.mesh.position.x - ox;
    const dz = ped.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d > range || d < 0.5) continue;
    const dot = (dx * dir.x + dz * dir.z) / d;
    if (dot < 0.86) continue; // about 30 degrees of aim
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  if (best) {
    best.health -= w.damage;
    if (best.health <= 0) {
      best.health = 0;
      if (best.mesh.parent) best.mesh.parent.remove(best.mesh);
      const i = G.peds.indexOf(best);
      if (i >= 0) G.peds.splice(i, 1);
      const j = G.cops.indexOf(best);
      if (j >= 0) G.cops.splice(j, 1);
      G.stats.kills++;
      addRp(10);
      addWanted(1);
    }
    return true;
  }
  // Otherwise, check police cars in the line of fire.
  for (const car of G.police) {
    const dx = car.mesh.position.x - ox;
    const dz = car.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d > range || d < 1) continue;
    const dot = (dx * dir.x + dz * dir.z) / d;
    if (dot < 0.86) continue;
    car.condition = Math.max(0, (car.condition || 100) - w.damage);
    if (car.condition <= 0) {
      car.cruise = 0;
      car.speed = 0;
      toast('Police car disabled', 2);
    }
    return true;
  }
  return true;
}

/** Reload the current weapon from its reserve. */
export function reload() {
  const w = currentWeapon();
  if (!w || w.slot === 1) return;
  const mag = MAG_SIZE[w.slot] || 12;
  const need = mag - w.ammo;
  const take = Math.min(need, w.reserve);
  if (take <= 0) {
    toast('No reserve ammo for the ' + w.name, 2);
    return;
  }
  w.ammo += take;
  w.reserve -= take;
}

/** The player takes damage: armour absorbs first, then health. */
export function takeDamage(amount) {
  if (!G.player) return;
  let left = amount;
  if (G.armour > 0) {
    const absorbed = Math.min(G.armour, left);
    G.armour -= absorbed;
    left -= absorbed;
  }
  G.health = Math.max(0, G.health - left);
  if (G.health <= 0) wasted();
}

/** Wasted: the hospital patches the player up, minus 10% of the cash. */
export function wasted() {
  const p = G.player;
  if (!p) return;
  if (p.vehicle) {
    p.vehicle.isPlayer = false;
    p.vehicle = null;
    p.onFoot = true;
    p.mesh.visible = true;
  }
  G.cash = Math.floor(G.cash * 0.9);
  G.health = 100;
  G.armour = 0;
  G.wanted = 0;
  p.pos.set(0, 0, 84);
  p.mesh.position.copy(p.pos);
  toast('WASTED — the hospital patched you up. The city took 10% of your cash.', 5);
}

/** Heal the player (pickups, safehouse rest). */
export function heal(amount) {
  G.health = clamp(G.health + amount, 0, 100);
}

/** Select a weapon slot from the weapon wheel (only owned weapons). */
export function selectWeaponSlot(slot) {
  const w = G.weapons[slot - 1];
  if (w && w.owned) {
    G.weaponSlot = slot;
    return true;
  }
  return false;
}

/** Give ammo to a weapon slot (shop purchases, pickups). */
export function giveAmmo(slot, amount) {
  const w = G.weapons[slot - 1];
  if (!w) return;
  w.owned = true;
  w.reserve += amount;
  if (w.ammo === 0) {
    const mag = MAG_SIZE[slot] || 12;
    const take = Math.min(mag, w.reserve);
    w.ammo += take;
    w.reserve -= take;
  }
}

/** Buy armour: $300 for 50 armour. */
export function buyArmour() {
  if (G.cash < 300) return false;
  if (G.armour >= 100) return false;
  G.cash -= 300;
  G.armour = Math.min(100, G.armour + 50);
  return true;
}

/** The player's current weapon as a HUD label, e.g. "SMG 24/90". */
export function weaponLabel() {
  const w = currentWeapon();
  if (!w) return '';
  if (w.slot === 1) return 'Fists ∞';
  return w.name + ' ' + w.ammo + '/' + w.reserve;
}
