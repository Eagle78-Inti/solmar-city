// save.js — saving and loading the game in localStorage, including the
// quick save at Marta's Loft and the auto-save after every mission.

import { DISTRICTS, G, toast } from './state.js';

/** Collect everything worth keeping into one plain object. */
function snapshot() {
  const p = G.player;
  return {
    version: 10,
    cash: G.cash,
    respect: G.respect,
    rp: G.rp,
    rank: G.rank,
    health: G.health,
    armour: G.armour,
    day: G.day,
    time: G.time,
    weather: G.weather,
    character: G.character,
    act: G.act,
    missionDone: G.missionDone,
    ending: G.ending,
    weapons: G.weapons.map((w) => ({ slot: w.slot, ammo: w.ammo, reserve: w.reserve, owned: w.owned })),
    weaponSlot: G.weaponSlot,
    garage: { owned: G.garage.owned, cars: G.garage.cars },
    stats: G.stats,
    standings: DISTRICTS.map((d) => ({ name: d.name, standing: d.standing })),
    collectibles: G.collectibles.map((c) => c.found),
    jumps: G.jumps.map((j) => j.done),
    player: p ? { x: p.pos.x, z: p.pos.z, yaw: p.yaw } : null,
  };
}

/** Write the snapshot to localStorage. */
export function saveGame() {
  try {
    localStorage.setItem(G.saveSlot, JSON.stringify(snapshot()));
    return true;
  } catch (e) {
    return false;
  }
}

/** Read a save back and apply it. Returns true when a save was loaded. */
export function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(G.saveSlot);
  } catch (e) {
    return false;
  }
  if (!raw) return false;
  let s = null;
  try {
    s = JSON.parse(raw);
  } catch (e) {
    return false;
  }
  if (!s || s.version !== 10) return false;
  G.cash = s.cash;
  G.respect = s.respect;
  G.rp = s.rp;
  G.rank = s.rank;
  G.health = s.health;
  G.armour = s.armour;
  G.day = s.day;
  G.time = s.time;
  G.weather = s.weather;
  G.character = s.character;
  G.act = s.act;
  G.missionDone = s.missionDone;
  G.ending = s.ending;
  s.weapons.forEach((w, i) => {
    if (G.weapons[i]) {
      G.weapons[i].ammo = w.ammo;
      G.weapons[i].reserve = w.reserve;
      G.weapons[i].owned = w.owned;
    }
  });
  G.weaponSlot = s.weaponSlot;
  G.garage = s.garage;
  G.stats = s.stats;
  s.standings.forEach((st) => {
    const d = DISTRICTS.find((x) => x.name === st.name);
    if (d) d.standing = st.standing;
  });
  s.collectibles.forEach((found, i) => {
    if (G.collectibles[i]) {
      G.collectibles[i].found = found;
      if (found && G.collectibles[i].mesh && G.collectibles[i].mesh.parent) {
        G.collectibles[i].mesh.parent.remove(G.collectibles[i].mesh);
      }
    }
  });
  s.jumps.forEach((done, i) => {
    if (G.jumps[i]) G.jumps[i].done = done;
  });
  if (s.player && G.player) {
    G.player.pos.set(s.player.x, 0, s.player.z);
    G.player.mesh.position.copy(G.player.pos);
    G.player.yaw = s.player.yaw;
  }
  return true;
}

/** Does a save exist? (The title screen's Continue button.) */
export function hasSave() {
  try {
    return localStorage.getItem(G.saveSlot) !== null;
  } catch (e) {
    return false;
  }
}

/** Wipe the save slot (a fresh start from the title screen). */
export function clearSave() {
  try {
    localStorage.removeItem(G.saveSlot);
    return true;
  } catch (e) {
    return false;
  }
}

/** A one-line summary of the save for the title screen. */
export function saveSummary() {
  try {
    const raw = localStorage.getItem(G.saveSlot);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return 'Day ' + s.day + ' · $' + s.cash.toLocaleString('en-US') + ' · Rank ' + s.rank;
  } catch (e) {
    return null;
  }
}
