// Solmar City v7 — save: progress in localStorage, restored on Continue.
const KEY = 'solmar-city-save-v7';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      cash: Math.round(p.cash), respect: p.respect, coins: p.coins,
      missionIndex: G.missions.index, missionStep: G.missions.step,
      missionsDone: G.missions.done, hours: G.hours, health: Math.round(p.health),
      coinsTaken: G.coins.map((c) => (c.taken ? 1 : 0)).join(''),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function applySave(G, d) {
  const p = G.player;
  p.cash = d.cash; p.respect = d.respect || 0; p.coins = d.coins || 0;
  p.health = d.health || 100;
  G.hours = typeof d.hours === 'number' ? d.hours : 15.5;
  G.missions.index = Math.min(d.missionIndex, 4);
  G.missions.step = d.missionStep || 0;
  G.missions.done = !!d.missionsDone;
  if (d.coinsTaken) {
    for (let i = 0; i < d.coinsTaken.length && i < G.coins.length; i++) {
      if (d.coinsTaken[i] === '1') { G.coins[i].taken = true; G.scene.remove(G.coins[i].mesh); }
    }
  }
  p.pos.set(-240, 0, 240); p.heading = Math.PI / 2;
  p.mesh.position.copy(p.pos);
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

export function saveLabel(d) {
  if (!d) return '';
  return `$${d.cash.toLocaleString('en-US')} · Mission ${Math.min(d.missionIndex + 1, 5)}/5 · ${d.coins || 0} coins`;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
