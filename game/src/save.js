// Solmar City — save / load via localStorage. Progress, cash, respect,
// coins, time of day and the player's spot in the world.
const KEY = 'solmar-city-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number') return null;
    return s;
  } catch (e) { return null; }
}
export function hasSave() { return loadGame() !== null; }
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
