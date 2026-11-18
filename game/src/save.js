// Solmar City — saving: the whole campaign state in one localStorage slot,
// written after every mission and every minute of play, read back on the
// start screen's Continue button.
const KEY = 'solmar-city-save-v2';

export function saveGame(g) {
  try {
    const m = g.missions;
    const data = {
      v: 2,
      cash: m.cash,
      respect: m.respect,
      coinsGot: m.coinsGot,
      coins: m.coins.filter((c) => c.got).map((c) => `${c.x},${c.z}`),
      mission: m.index,
      stage: m.stage,
      hour: g.city.hour,
      health: g.player.health,
      pos: { x: g.player.pos.x, z: g.player.pos.z },
      heading: g.player.heading,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable in a sandboxed frame; the game plays on.
  }
}

// Apply a loaded save to a fresh game: restore the economy and the mission,
// put Rook back where he was, and re-hide the coins he already found.
export function applySave(g, data) {
  const m = g.missions;
  m.cash = data.cash;
  m.respect = data.respect;
  m.coinsGot = data.coinsGot;
  const gotSet = new Set(data.coins || []);
  for (const c of m.coins) {
    if (gotSet.has(`${c.x},${c.z}`)) {
      c.got = true;
      c.mesh.visible = false;
    }
  }
  g.city.setHour(data.hour ?? 13.5);
  g.player.health = data.health ?? 100;
  g.player.respawn(data.pos.x, data.pos.z, data.heading ?? 0);
  if (data.mission > 0 && data.mission < 5) {
    m.setMission(data.mission, 0);
  } else if (data.mission >= 5) {
    m.setMission(5, 0);
  }
  g.hud.refresh();
}

// One line for the Continue button: what the save holds, so the player knows
// what they are coming back to.
export function saveSummary() {
  const data = loadGame();
  if (!data) return '';
  const when = new Date(data.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Continue — $${Math.round(data.cash).toLocaleString()} · Mission ${Math.min(data.mission + 1, 5)}/5 · ${when}`;
}

// Autosave: call once a second from the main loop; it writes at most once a
// minute (and always right after a mission pays out, via saveGame directly).
let lastAuto = 0;
export function autosave(g, now) {
  if (now - lastAuto > 60000) {
    lastAuto = now;
    saveGame(g);
  }
}
