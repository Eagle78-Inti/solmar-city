// hud.js — every screen around the game: the HUD, the minimap, the full
// map, the pause menu with its career stats and story list, the briefing
// panel, the shop panel and the weapon wheel.

import { DISTRICTS, G, countDistrictsHeld, roleFor, standingLabel } from './state.js';
import { stageTarget, storyList } from './missions.js';
import { SHOP_ITEMS, RACE } from './activities.js';
import { STATIONS, currentTrack } from './audio.js';
import { clockText, money } from './util.js';
import { weaponLabel } from './combat.js';

const el = (id) => document.getElementById(id);
const WORLD = { x0: -340, x1: 340, z0: -280, z1: 280 };

/** Cache the HUD elements once the page is built. */
export function initHud() {
  const mm = el('minimap');
  if (mm) mm.width = 180;
  const map = el('mapCanvas');
  if (map) {
    map.width = 760;
    map.height = 560;
  }
}

/** Write a text into an element, when it exists. */
function setText(id, text) {
  const e = el(id);
  if (e) e.textContent = text;
}

/** Stars for the wanted level: filled gold, empty grey. */
function stars(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

/** Per-frame HUD refresh (cheap text writes only). */
export function updateHud() {
  setText('cash', money(G.cash));
  setText('respect', 'RESPECT ' + G.respect + '/100');
  setText('rank', 'Rank ' + G.rank + ' · ' + G.rp + ' RP');
  setText('role', roleFor(G.respect, G.character));
  setText('clock', 'Day ' + G.day + ' · ' + clockText(G.time));
  setText('weather', G.weather === 'rain' ? 'Rain' : 'Clear');
  setText('radio', STATIONS[G.radio] ? STATIONS[G.radio].name + ' — ' + currentTrack() : '');
  setText('wanted', stars(G.wanted));
  setText('health', 'Health ' + Math.round(G.health));
  setText('armour', 'Armour ' + Math.round(G.armour));
  setText('weapon', weaponLabel());
  setText('district', G.district + ' · ' + standingLabel(DISTRICTS.find((d) => d.name === G.district)?.standing || 0));
  setText('missionTitle', G.missionText || '');
  setText('missionSub', G.missionSub || '');
  const p = G.player;
  if (p && !p.onFoot && p.vehicle) {
    setText('gripRow', 'GRIP ' + Math.round(G.grip) + ' · Condition ' + Math.round(p.vehicle.condition || 100) + '%');
    const grip = el('gripBar');
    if (grip) grip.style.width = G.grip + '%';
    const cond = el('condBar');
    if (cond) cond.style.width = (p.vehicle.condition || 100) + '%';
    const row = el('driveRow');
    if (row) row.style.display = 'block';
  } else {
    const row = el('driveRow');
    if (row) row.style.display = 'none';
  }
  const sub = el('subtitle');
  if (sub) {
    const show = G.subtitle && performance.now() / 1000 < G.subtitleUntil;
    sub.style.display = show ? 'block' : 'none';
    if (show) sub.textContent = G.subtitle;
  }
  const tst = el('toast');
  if (tst) {
    const show = G.toast && performance.now() / 1000 < G.toastUntil;
    tst.style.display = show ? 'block' : 'none';
    if (show) tst.textContent = G.toast;
  }
  drawMinimap();
  if (G.mapOpen) drawMap();
  if (G.shop.open) drawShop();
}

/** The minimap: districts, roads, the player, the mission marker, police. */
export function drawMinimap() {
  const c = el('minimap');
  if (!c) return;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const px = (wx) => ((wx - WORLD.x0) / (WORLD.x1 - WORLD.x0)) * W;
  const py = (wz) => ((wz - WORLD.z0) / (WORLD.z1 - WORLD.z0)) * H;
  x.fillStyle = '#12261a';
  x.fillRect(0, 0, W, H);
  // Water on the west.
  x.fillStyle = '#1a5a8a';
  x.fillRect(0, 0, px(-300), H);
  // District blocks.
  for (const d of DISTRICTS) {
    x.fillStyle = 'rgba(255,255,255,0.05)';
    x.fillRect(px(d.x0), py(d.z0), px(d.x1) - px(d.x0), py(d.z1) - py(d.z0));
  }
  // Roads.
  x.strokeStyle = '#3a3d44';
  x.lineWidth = 2;
  for (let gx = -280; gx <= 280; gx += 56) {
    x.beginPath();
    x.moveTo(px(gx), 0);
    x.lineTo(px(gx), H);
    x.stroke();
  }
  for (let gz = -224; gz <= 224; gz += 56) {
    x.beginPath();
    x.moveTo(0, py(gz));
    x.lineTo(W, py(gz));
    x.stroke();
  }
  // Mission marker.
  const t = stageTarget();
  if (t && t.kind !== 'choice') {
    x.fillStyle = '#ffd23e';
    x.beginPath();
    x.arc(px(t.x), py(t.z), 5, 0, Math.PI * 2);
    x.fill();
  }
  // Police.
  x.fillStyle = '#ff4444';
  for (const car of G.police) {
    x.beginPath();
    x.arc(px(car.mesh.position.x), py(car.mesh.position.z), 3, 0, Math.PI * 2);
    x.fill();
  }
  // Player arrow.
  const p = G.player;
  if (p) {
    x.save();
    x.translate(px(p.pos.x), py(p.pos.z));
    x.rotate(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) + Math.PI);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.moveTo(0, -6);
    x.lineTo(4, 5);
    x.lineTo(-4, 5);
    x.closePath();
    x.fill();
    x.restore();
  }
}

/** The full-screen map: districts with standings, roads, legend, markers. */
export function drawMap() {
  const c = el('mapCanvas');
  if (!c) return;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const px = (wx) => ((wx - WORLD.x0) / (WORLD.x1 - WORLD.x0)) * W;
  const py = (wz) => ((wz - WORLD.z0) / (WORLD.z1 - WORLD.z0)) * H;
  x.fillStyle = '#0e1a14';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#1a5a8a';
  x.fillRect(0, 0, px(-300), H);
  // District fills.
  const cols = ['#8a4a38', '#2a6a8a', '#4a7a3a', '#6a6a6a', '#3a4a7a', '#7a3a6a', '#c9a24a'];
  DISTRICTS.forEach((d, i) => {
    x.fillStyle = cols[i % cols.length] + '55';
    x.fillRect(px(d.x0), py(d.z0), px(d.x1) - px(d.x0), py(d.z1) - py(d.z0));
    x.strokeStyle = 'rgba(255,255,255,0.25)';
    x.strokeRect(px(d.x0), py(d.z0), px(d.x1) - px(d.x0), py(d.z1) - py(d.z0));
    x.fillStyle = '#ffffff';
    x.font = 'bold 13px Arial';
    x.textAlign = 'center';
    x.fillText(d.name, (px(d.x0) + px(d.x1)) / 2, (py(d.z0) + py(d.z1)) / 2 - 4);
    x.font = '11px Arial';
    x.fillText(standingLabel(d.standing) + (d.standing >= 25 ? ' · HELD' : ''), (px(d.x0) + px(d.x1)) / 2, (py(d.z0) + py(d.z1)) / 2 + 12);
  });
  // Roads.
  x.strokeStyle = '#888888';
  x.lineWidth = 2;
  for (let gx = -280; gx <= 280; gx += 56) {
    x.beginPath();
    x.moveTo(px(gx), 0);
    x.lineTo(px(gx), H);
    x.stroke();
  }
  for (let gz = -224; gz <= 224; gz += 56) {
    x.beginPath();
    x.moveTo(0, py(gz));
    x.lineTo(W, py(gz));
    x.stroke();
  }
  // Legend markers.
  const marks = [
    { label: 'Mission', color: '#ffd23e', x: stageTarget() && stageTarget().kind !== 'choice' ? stageTarget().x : null, z: stageTarget() && stageTarget().kind !== 'choice' ? stageTarget().z : null },
    { label: 'Police', color: '#ff4444', x: G.police[0] ? G.police[0].mesh.position.x : null, z: G.police[0] ? G.police[0].mesh.position.z : null },
    { label: 'Respray', color: '#b06aff', x: 168, z: -56 },
    { label: 'Kelo Arms', color: '#ff6a3e', x: 56, z: -48 },
    { label: 'Safehouse', color: '#ff5ad0', x: -292, z: 90 },
    { label: 'Car Export', color: '#3ec6ff', x: 168, z: -168 },
    { label: 'Side Job', color: '#7dff6a', x: G.taxi && G.taxi.active ? G.taxi.x : 224, z: G.taxi && G.taxi.active ? G.taxi.z : 0 },
    { label: 'Garage', color: '#c8ff3e', x: -56, z: 130 },
  ];
  x.font = '12px Arial';
  x.textAlign = 'left';
  marks.forEach((m, i) => {
    const ly = 24 + i * 20;
    x.fillStyle = m.color;
    x.beginPath();
    x.arc(18, ly - 4, 5, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#ffffff';
    x.fillText(m.label, 30, ly);
    if (m.x !== null && m.x !== undefined) {
      x.fillStyle = m.color;
      x.beginPath();
      x.arc(px(m.x), py(m.z), 6, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#ffffff';
      x.stroke();
    }
  });
  // Race start.
  x.fillStyle = '#7dff6a';
  x.font = 'bold 12px Arial';
  x.fillText('RACE', px(RACE.start.x) + 8, py(RACE.start.z));
  // Player.
  const p = G.player;
  if (p) {
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.arc(px(p.pos.x), py(p.pos.z), 6, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#000000';
    x.stroke();
  }
}

/** Open or close the full map. */
export function toggleMap() {
  G.mapOpen = !G.mapOpen;
  const m = el('mapOverlay');
  if (m) m.style.display = G.mapOpen ? 'block' : 'none';
  G.paused = G.mapOpen;
}

/** The pause menu: career stats and the story list. */
export function openPause() {
  G.paused = true;
  const p = el('pauseMenu');
  if (p) p.style.display = 'block';
  showStats();
}

export function closePause() {
  G.paused = false;
  const p = el('pauseMenu');
  if (p) p.style.display = 'none';
}

export function showStats() {
  const s = el('statsBody');
  if (!s) return;
  const rows = [
    ['Cash', money(G.cash)],
    ['Respect', G.respect + ' / 100'],
    ['Rank', G.rank + ' (' + G.rp + ' RP)'],
    ['Role', roleFor(G.respect, G.character)],
    ['Day', 'Day ' + G.day],
    ['Districts held', countDistrictsHeld() + ' / 7'],
    ['Hidden packages', G.stats.collectibles + ' / 21'],
    ['Stunt jumps', G.stats.jumps + ' / 5'],
    ['Races won', G.stats.racesWon],
    ['Cars stolen', G.stats.carsStolen],
    ['Best wanted level', '★'.repeat(G.stats.bestWanted) || '—'],
    ['Shots fired', G.stats.shots],
    ['Takedowns', G.stats.kills],
    ['Taxi fares', G.stats.taxiFares],
    ['Deliveries', G.stats.deliveries],
  ];
  s.innerHTML = rows.map(([k, v]) => `<div class="statRow"><span>${k}</span><b>${v}</b></div>`).join('');
}

export function showStory() {
  const s = el('storyBody');
  if (!s) return;
  const acts = ['Act I — Off the Ferry', 'Act II — Rising', 'Act III — The Reign'];
  let html = '<div class="storyTitle">The Solmar Reign — 3 acts, 8 missions, 2 endings</div>';
  let currentAct = 0;
  for (const m of storyList()) {
    if (m.act !== currentAct) {
      currentAct = m.act;
      html += `<div class="storyAct">${acts[currentAct - 1]}</div>`;
    }
    html += `<div class="storyRow"><span>${m.done ? '✓' : '·'} M${m.n} ${m.title} <i>${m.district}</i></span><b>$${m.payout.toLocaleString('en-US')}</b></div>`;
  }
  html += '<div class="storyAct">Endings: Take the Crown / Stay Loyal' + (G.ending ? ' — chose: ' + G.ending : '') + '</div>';
  s.innerHTML = html;
}

/** The mission briefing panel: title, dialogue, stages, accept button. */
export function showBriefing() {
  const b = el('briefing');
  if (!b || !G.briefing) return;
  const br = G.briefing;
  let html = `<div class="briefTitle">M${br.mission} — ${br.title}</div><div class="briefAct">${['', 'Act I — Off the Ferry', 'Act II — Rising', 'Act III — The Reign'][br.act]}</div>`;
  for (const line of br.brief) {
    html += `<div class="briefLine"><b>${line.who}:</b> ${line.text}</div>`;
  }
  html += '<div class="briefStages">Stages:</div>';
  br.stages.forEach((s, i) => {
    html += `<div class="briefStage">${i + 1}. ${s}</div>`;
  });
  html += '<button id="briefAccept">Begin mission</button>';
  b.innerHTML = html;
  b.style.display = 'block';
  const btn = el('briefAccept');
  if (btn) btn.onclick = () => window.SOL && window.SOL.acceptBriefing && window.SOL.acceptBriefing();
}

export function hideBriefingPanel() {
  const b = el('briefing');
  if (b) b.style.display = 'none';
}

/** The shop panel: items with prices, click to buy. */
export function drawShop() {
  const s = el('shopPanel');
  if (!s) return;
  if (!G.shop.open) {
    s.style.display = 'none';
    return;
  }
  s.style.display = 'block';
  let html = '<div class="shopTitle">KELO ARMS — Ammu-Nation</div>';
  for (const item of SHOP_ITEMS) {
    const owned = (item.id === 'smg' && G.weapons[2].owned) || (item.id === 'shotgun' && G.weapons[3].owned) || (item.id === 'rifle' && G.weapons[4].owned);
    html += `<div class="shopRow"><span>${item.name} <i>${item.desc}</i></span><button data-buy="${item.id}" ${owned && item.id !== 'ammo' ? 'disabled' : ''}>$${item.price}${owned && item.id !== 'ammo' ? ' ✓' : ''}</button></div>`;
  }
  html += '<button id="shopClose">Close (E)</button>';
  s.innerHTML = html;
  s.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.onclick = () => window.SOL && window.SOL.shopBuy && window.SOL.shopBuy(btn.getAttribute('data-buy'));
  });
  const close = el('shopClose');
  if (close) close.onclick = () => window.SOL && window.SOL.closeShop && window.SOL.closeShop();
}

/** The weapon wheel: five slots in a row, shown while Q is held. */
export function showWheel() {
  const w = el('wheel');
  if (!w) return;
  let html = '';
  G.weapons.forEach((we, i) => {
    html += `<div class="wheelSlot${G.weaponSlot === i + 1 ? ' active' : ''}${we.owned ? '' : ' locked'}">${i + 1}<br>${we.name}<br>${we.slot === 1 ? '∞' : we.ammo + '/' + we.reserve}</div>`;
  });
  w.innerHTML = html;
  w.style.display = 'flex';
}

export function hideWheel() {
  const w = el('wheel');
  if (w) w.style.display = 'none';
}

/** Keep the overlay panels in sync with the game state, once a frame. */
export function updatePanels() {
  if (G.briefing) showBriefing();
  else hideBriefingPanel();
  if (!G.started) showTitle();
  else hideTitle();
}

/** The title screen: game name, campaign, New Game / Continue. */
export function showTitle() {
  const t = el('titleScreen');
  if (t) t.style.display = 'block';
}

export function hideTitle() {
  const t = el('titleScreen');
  if (t) t.style.display = 'none';
}
