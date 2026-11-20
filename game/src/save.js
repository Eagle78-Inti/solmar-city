// Solmar City v8 — save and load through localStorage: cash, respect,
// missions finished, the player's position and the time of day.
export const SAVE_KEY = 'solmar-city-v8-save-v1';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: Math.round(state.cash),
      respect: Math.round(state.respect),
      missionsDone: state.missionsDone,
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      dayFrac: state.dayFrac,
      health: Math.round(state.health),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    if (typeof data.cash !== 'number' || typeof data.missionsDone !== 'number') return null;
    // Clamp every field into its sane range so a hand-edited save cannot
    // break the game (negative cash, respect over 100, off-map position).
    data.cash = Math.max(0, Math.min(999999, data.cash));
    data.respect = Math.max(0, Math.min(100, data.respect || 0));
    data.missionsDone = Math.max(0, Math.min(6, data.missionsDone));
    data.x = Math.max(-260, Math.min(320, data.x || 0));
    data.z = Math.max(-320, Math.min(320, data.z || 0));
    data.dayFrac = ((data.dayFrac || 0.72) % 1 + 1) % 1;
    data.health = Math.max(1, Math.min(100, data.health || 100));
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage may be unavailable */ }
}

// A save is only worth offering to continue from if it holds real progress:
// some cash beyond the start, or at least one mission done.
export function saveHasProgress(data) {
  if (!data) return false;
  return data.missionsDone > 0 || data.cash > 800;
}
