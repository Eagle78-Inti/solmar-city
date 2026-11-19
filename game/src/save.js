// Solmar City — saving: one localStorage slot for the whole game state.
// Saved on pause and on mission completion; loaded from the start screen.

const KEY = 'solmar-city-save-v6';

export function saveGame(G, extra) {
  try {
    const data = {
      cash: G.cash,
      respect: G.respect,
      coins: G.coins,
      missionIndex: G.missionIndex,
      missionDone: G.missionDone,
      hours: G.hours,
      health: G.health,
      px: extra.px,
      pz: extra.pz,
      heading: extra.heading,
      wanted: 0, // a loaded game always starts clean
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* best effort */ }
}

// One-line summary of a save for the start screen's Continue button.
export function saveSummary(data) {
  if (!data) return '';
  const mission = data.missionDone ? 'story complete' : 'mission ' + (data.missionIndex + 1) + '/5';
  return 'Saved game: $' + Math.round(data.cash).toLocaleString() + ' · ' + mission + ' · ' + data.coins + ' coins';
}
