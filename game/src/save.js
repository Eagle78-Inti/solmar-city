// Solmar City — saving: the player's cash, respect, mission progress,
// collected coins and time of day persist in localStorage.
const KEY = 'solmar-city-save-v3';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, respect: G.respect, mission: G.missions.index,
      coins: G.missions.coins.filter((c) => c.got).map((c) => `${c.x},${c.z}`),
      dayT: G.dayT,
      px: G.player.pos.x, pz: G.player.pos.z, heading: G.player.heading,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch { return null; }
}

export function applySave(G, data) {
  if (!data) return false;
  G.cash = data.cash ?? 250;
  G.respect = data.respect ?? 0;
  G.missions.index = data.mission ?? 0;
  G.missions.phase = 'go'; G.missions.raceCp = 0; G.missions.sprint = false;
  const got = new Set(data.coins || []);
  for (const c of G.missions.coins) {
    if (got.has(`${c.x},${c.z}`)) { c.got = true; c.mesh.visible = false; G.missions.coinsGot++; }
  }
  G.dayT = data.dayT ?? 0.32;
  G.player.teleport(data.px ?? 26, data.pz ?? -123, data.heading ?? Math.PI);
  G.missions.setObjective();
  return true;
}

  export function clearSave() {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  }
