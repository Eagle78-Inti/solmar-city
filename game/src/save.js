// Solmar City v4 — save and load through localStorage. One small versioned slot.
const KEY = 'solmar-city-save-v4';
export function saveGame(state) {
  try {
    const data = {
      v: 4,
      cash: state.cash,
      respect: state.respect,
      coins: state.coins,
      health: state.health,
      missionIndex: state.missionIndex,
      hours: state.hours,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 4) return null;
    return data;
  } catch (e) { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
export function hasSave() {
  try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; }
}
