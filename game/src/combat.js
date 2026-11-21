// combat.js — weapons, shooting, the weapon wheel, drive-by.
import { clamp, dist2d } from './util.js';

export function currentWeapon(G) {
  return G.weapons[G.activeWeapon];
}
export function weaponAmmoText(G) {
  const w = currentWeapon(G);
  if (!w) return '';
  if (w.ammo === Infinity) return `${w.name} ∞`;
  return `${w.name} ${w.ammo}/${w.reserve}`;
}
export function selectWeapon(G, slot) {
  const i = G.weapons.findIndex(w => w.slot === slot);
  if (i >= 0) { G.activeWeapon = i; return true; }
  return false;
}
export function cycleWeapon(G) {
  G.activeWeapon = (G.activeWeapon + 1) % G.weapons.length;
  return currentWeapon(G);
}
export function buyWeapon(G, slot) {
  // Kelo Arms prices: SMG $800, Shotgun $1,200, AR-9 $2,000.
  const prices = { 3: 800, 4: 1200, 5: 2000 };
  const price = prices[slot];
  if (!price) return false;
  if (G.cash < price) return false;
  const w = G.weapons.find(x => x.slot === slot);
  if (!w) return false;
  G.cash -= price;
  if (slot === 3) { w.ammo = 32; w.reserve = 128; }
  if (slot === 4) { w.ammo = 6; w.reserve = 24; }
  if (slot === 5) { w.ammo = 30; w.reserve = 120; }
  G.activeWeapon = G.weapons.indexOf(w);
  return true;
}
// Fire the current weapon. Returns a hit record or null.
// Shooting is hitscan against peds and police cars near the aim line.
export function shoot(G, world, targetX, targetZ) {
  const w = currentWeapon(G);
  if (!w) return null;
  if (w.ammo !== Infinity) {
    if (w.ammo <= 0) {
      // Auto-reload from reserve.
      if (w.reserve > 0) {
        const need = w.slot === 3 ? 32 : w.slot === 4 ? 6 : w.slot === 5 ? 30 : 12;
        const take = Math.min(need, w.reserve);
        w.reserve -= take; w.ammo = take;
      } else return { fired: false, reason: 'no ammo' };
    }
    w.ammo -= 1;
  }
  G.lastShotAt = Date.now();
  // Find the closest ped or police car within a cone of the aim point.
  let best = null, bd = 1e9;
  for (const p of world.peds) {
    const d = dist2d(p.x, p.z, targetX, targetZ);
    if (d < 6 && d < bd) { bd = d; best = { kind: 'ped', obj: p }; }
  }
  for (const c of world.police) {
    const d = dist2d(c.x, c.z, targetX, targetZ);
    if (d < 7 && d < bd) { bd = d; best = { kind: 'police', obj: c }; }
  }
  if (best) {
    if (best.kind === 'ped') {
      best.obj.health = (best.obj.health || 100) - w.damage;
      if (best.obj.health <= 0) {
        // The ped falls and stays down.
        best.obj.down = true;
        best.obj.group.rotation.x = Math.PI / 2;
        best.obj.group.position.y = 0.3;
      }
    } else {
      best.obj.condition = clamp((best.obj.condition || 100) - w.damage, 0, 100);
      if (best.obj.condition <= 0) best.obj.speed = 0;
    }
    return { fired: true, hit: best.kind, damage: w.damage };
  }
  return { fired: true, hit: null };
}
export function weaponWheelItems(G) {
  return G.weapons.map((w, i) => ({
    slot: w.slot, name: w.name,
    ammo: w.ammo === Infinity ? '∞' : `${w.ammo}/${w.reserve}`,
    active: i === G.activeWeapon,
    owned: w.ammo > 0 || w.ammo === Infinity || w.reserve > 0,
  }));
}
// Damage the player (used by police rams and falls).
export function damagePlayer(G, n) {
  if (G.armour > 0) {
    const absorbed = Math.min(G.armour, n * 0.6);
    G.armour -= absorbed;
    G.health = clamp(G.health - (n - absorbed), 0, 100);
  } else {
    G.health = clamp(G.health - n, 0, 100);
  }
  return G.health;
}

// Ammo top-up at the shop (not a weapon purchase).
export function buyAmmo(G, slot, amount) {
  const w = G.weapons.find(x => x.slot === slot);
  if (!w || w.ammo === Infinity) return false;
  const cost = amount * 2;
  if (G.cash < cost) return false;
  G.cash -= cost;
  w.reserve += amount;
  return true;
}
// Armour top-up at the shop: $100 for 25 armour.
export function buyArmour(G) {
  if (G.cash < 100) return false;
  G.cash -= 100;
  G.armour = clamp(G.armour + 25, 0, 100);
  return true;
}
