// save.js — save/load round-trip via localStorage.
// Only plain progress data is stored; runtime objects are rebuilt.
const KEY = 'solmar-city-save-v10';

export function saveGame(G) {
  const data = {
    v: 10,
    cash: G.cash, respect: G.respect, rank: G.rank, rp: G.rp,
    health: G.health, armour: G.armour,
    character: G.character, role: G.role,
    day: G.day, time: G.time,
    wanted: G.wanted, bestWanted: G.bestWanted,
    weapons: G.weapons.map(w => ({ slot: w.slot, ammo: w.ammo === Infinity ? 'inf' : w.ammo, reserve: w.reserve === Infinity ? 'inf' : w.reserve })),
    activeWeapon: G.activeWeapon,
    missions: G.missions.map(m => ({ id: m.id, done: m.done })),
    missionIdx: G.missionIdx,
    districts: G.districts.map(d => ({ name: d.name, standing: d.standing, held: d.held })),
    packagesFound: G.packagesFound,
    jumpsDone: G.jumpsDone, racesWon: G.racesWon, carsStolen: G.carsStolen,
    taxiFares: G.taxiFares, courierJobs: G.courierJobs,
    garageOwned: G.garageOwned, garageCar: G.garageCar,
    pos: { x: G.pos.x, z: G.pos.z, yaw: G.pos.yaw },
    ending: G.ending,
    radioIdx: G.radioIdx, trackIdx: G.trackIdx,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 10) return null;
    return d;
  } catch (e) { return null; }
}

export function applySave(G, d) {
  if (!d) return false;
  G.cash = d.cash; G.respect = d.respect; G.rank = d.rank; G.rp = d.rp;
  G.health = d.health; G.armour = d.armour;
  G.character = d.character; G.role = d.role;
  G.day = d.day; G.time = d.time;
  G.wanted = d.wanted; G.bestWanted = d.bestWanted;
  for (const w of d.weapons) {
    const mine = G.weapons.find(x => x.slot === w.slot);
    if (mine) {
      mine.ammo = w.ammo === 'inf' ? Infinity : w.ammo;
      mine.reserve = w.reserve === 'inf' ? Infinity : w.reserve;
    }
  }
  G.activeWeapon = d.activeWeapon;
  for (const m of d.missions) {
    const mine = G.missions.find(x => x.id === m.id);
    if (mine) mine.done = m.done;
  }
  G.missionIdx = d.missionIdx;
  for (const dd of d.districts) {
    const mine = G.districts.find(x => x.name === dd.name);
    if (mine) { mine.standing = dd.standing; mine.held = dd.held; }
  }
  G.packagesFound = d.packagesFound;
  G.jumpsDone = d.jumpsDone; G.racesWon = d.racesWon; G.carsStolen = d.carsStolen;
  G.taxiFares = d.taxiFares; G.courierJobs = d.courierJobs;
  G.garageOwned = d.garageOwned; G.garageCar = d.garageCar;
  G.pos.x = d.pos.x; G.pos.z = d.pos.z; G.pos.yaw = d.pos.yaw;
  G.ending = d.ending;
  G.radioIdx = d.radioIdx; G.trackIdx = d.trackIdx;
  return true;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
// The safehouse location (the loft on Neon Mile) for the HUD prompt.
export const SAFEHOUSE = { x: 56, z: 84 };

// Save slot helpers for the pause menu.
export function saveSummary() {
  const d = loadGame();
  if (!d) return null;
  return `Day ${d.day} · ${'$' + d.cash.toLocaleString()} · ${d.missions.filter(m => m.done).length}/8 missions · saved ${d.savedAt}`;
}
export function quickSaveAtSafehouse(G) {
  // Quick save only counts near the safehouse (the loft on Neon Mile).
  const dx = G.pos.x - 56, dz = G.pos.z - 84;
  if (Math.sqrt(dx * dx + dz * dz) > 14) return { ok: false, reason: 'not at the safehouse' };
  const ok = saveGame(G);
  return { ok, reason: ok ? 'saved' : 'storage unavailable' };
}
