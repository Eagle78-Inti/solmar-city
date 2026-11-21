// hud.js — all DOM UI: HUD, minimap, full-screen map, pause menu,
// career stats, story list, mission briefings and dialogue.
import { fmtMoney, fmtClock, el, $ } from './util.js';
import { districtStandingLabel, districtsHeld, station, trackName, currentMission } from './state.js';
import { missionProgressText, briefingLines, actsSummary } from './missions.js';
import { weaponAmmoText, weaponWheelItems } from './combat.js';
import { activityText } from './activities.js';
import { wantedLabel } from './police.js';

export function buildHud(G) {
  const hud = $('hud');
  hud.innerHTML = '';
  // Top-left: money, respect, rank, district.
  const tl = el('div', 'hud-tl');
  tl.innerHTML = `<div class="money" id="hud-money"></div>
    <div class="sub" id="hud-respect"></div>
    <div class="sub" id="hud-rank"></div>
    <div class="sub" id="hud-district"></div>`;
  hud.appendChild(tl);
  // Top-right: wanted stars, day/clock, weather, radio.
  const tr = el('div', 'hud-tr');
  tr.innerHTML = `<div class="stars" id="hud-stars"></div>
    <div class="sub" id="hud-clock"></div>
    <div class="sub" id="hud-radio"></div>
    <div class="sub" id="hud-weather"></div>`;
  hud.appendChild(tr);
  // Bottom-right: health, armour, weapon, grip, condition.
  const br = el('div', 'hud-br');
  br.innerHTML = `<div class="sub" id="hud-health"></div>
    <div class="sub" id="hud-armour"></div>
    <div class="sub" id="hud-weapon"></div>
    <div class="bar"><span>GRIP</span><div class="barfill"><i id="hud-grip"></i></div></div>
    <div class="bar"><span>COND</span><div class="barfill"><i id="hud-cond"></i></div></div>`;
  hud.appendChild(br);
  // Bottom-centre: mission tracker.
  const bc = el('div', 'hud-bc');
  bc.innerHTML = `<div class="mission" id="hud-mission"></div><div class="sub" id="hud-activity"></div>`;
  hud.appendChild(bc);
  // Minimap (bottom-left canvas).
  const mm = document.createElement('canvas');
  mm.id = 'minimap'; mm.width = 180; mm.height = 180;
  hud.appendChild(mm);
  // Controls hint strip.
  const hint = el('div', 'hud-hint');
  hint.textContent = 'WASD move/drive · Mouse drag camera · E interact · F enter/exit · Click shoot · R reload · 1–5 weapons · Q wheel · C switch Jason/Lucia · V radio · T taxi · Y courier · M map · Esc pause';
  hud.appendChild(hint);
  return { tl, tr, br, bc, mm };
}

export function updateHud(G, world) {
  const set = (id, txt) => { const n = $(id); if (n) n.textContent = txt; };
  set('hud-money', fmtMoney(G.cash));
  set('hud-respect', `RESPECT ${G.respect}/100`);
  set('hud-rank', `Rank ${G.rank} · ${G.rp} RP`);
  const d = world.districtAt ? world.districtAt(G.pos.x, G.pos.z) : null;
  set('hud-district', d ? `${d.name} · ${districtStandingLabel(d)} · ${d.standing}` : '');
  const stars = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  set('hud-stars', stars);
  const st = $('hud-stars');
  if (st) st.style.color = G.wanted >= 4 ? '#ff2211' : G.wanted > 0 ? '#ffb02e' : '#e8e8e8';
  set('hud-clock', `Day ${G.day} · ${fmtClock(G.time)}`);
  set('hud-radio', `${station(G).name} — ${trackName(G)}`);
  set('hud-weather', G.rain > 0 ? 'Rain' : 'Clear');
  set('hud-health', `Health ${Math.round(G.health)}`);
  set('hud-armour', `Armour ${Math.round(G.armour)}`);
  set('hud-weapon', weaponAmmoText(G));
  const grip = $('hud-grip'); if (grip) grip.style.width = G.grip + '%';
  const cond = $('hud-cond'); if (cond) cond.style.width = G.condition + '%';
  set('hud-mission', missionProgressText(G));
  set('hud-activity', activityText(G).join('  ·  '));
  drawMinimap(G, world);
}

function drawMinimap(G, world) {
  const cv = $('minimap');
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.fillStyle = 'rgba(10,16,26,0.85)';
  g.fillRect(0, 0, W, H);
  const sx = (x) => (x + 320) / 640 * W;
  const sz = (z) => (z + 240) / 480 * H;
  // Roads.
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 2;
  for (let x = -280; x <= 280; x += 80) { g.beginPath(); g.moveTo(sx(x), 0); g.lineTo(sx(x), H); g.stroke(); }
  for (let z = -200; z <= 200; z += 80) { g.beginPath(); g.moveTo(0, sz(z)); g.lineTo(W, sz(z)); g.stroke(); }
  // Water.
  g.fillStyle = 'rgba(30,90,130,0.5)';
  g.fillRect(0, 0, sx(-310), H);
  // Markers: mission (gold), shop (pink), garage (cyan), police (red).
  const dot = (x, z, color, r) => {
    g.fillStyle = color;
    g.beginPath(); g.arc(sx(x), sz(z), r || 4, 0, Math.PI * 2); g.fill();
  };
  const m = currentMission(G);
  if (m && !m.done) dot(m.to[0], m.to[1], '#ffc93a', 5);
  dot(56, -48, '#ff2ea6', 4);
  dot(-56, 130, '#22e6ff', 4);
  dot(-238, 60, '#ffb02e', 4);
  for (const c of world.police || []) dot(c.x, c.z, '#ff2211', 3);
  for (const p of G.packages || []) if (!p.found) dot(p.x, p.z, '#ffc93a', 2);
  // Player arrow.
  g.save();
  g.translate(sx(G.pos.x), sz(G.pos.z));
  g.rotate(-G.pos.yaw);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
}

// --- full-screen map, pause menu, stats, story list -------------------------
export function renderMap(G, world) {
  const box = $('map-panel');
  if (!box) return;
  let html = '<h2>SOLMAR CITY — MAP</h2><div class="map-grid">';
  for (const d of G.districts) {
    html += `<div class="map-district"><b>${d.name}</b><span>${districtStandingLabel(d)} · ${d.standing}</span>${d.held ? '<i>HELD</i>' : ''}</div>`;
  }
  html += '</div><div class="map-legend"><b>Legend</b><span>★ Mission</span><span>◆ Police</span><span>● Respray</span><span>▲ Kelo Arms</span><span>■ Safehouse</span><span>⬢ Car Export</span><span>✦ Side Job</span><span>⬡ Garage</span></div>';
  html += `<div class="map-held">Districts held: ${districtsHeld(G)}/7 · Packages ${G.packagesFound}/${G.packagesTotal} · Jumps ${G.jumpsDone}/${G.jumpsTotal} · Races won ${G.racesWon}</div>`;
  box.innerHTML = html;
}

export function renderStats(G) {
  const box = $('stats-panel');
  if (!box) return;
  const rows = [
    ['Cash', fmtMoney(G.cash)],
    ['Respect', `${G.respect}/100`],
    ['Rank', `${G.rank} · ${G.rp} RP`],
    ['Districts held', `${districtsHeld(G)}/7`],
    ['Hidden packages', `${G.packagesFound}/${G.packagesTotal}`],
    ['Stunt jumps', `${G.jumpsDone}/${G.jumpsTotal}`],
    ['Races won', String(G.racesWon)],
    ['Cars stolen', String(G.carsStolen)],
    ['Best wanted', `${G.bestWanted} star${G.bestWanted === 1 ? '' : 's'} (${wantedLabel(G.bestWanted)})`],
    ['Taxi fares', String(G.taxiFares)],
    ['Courier jobs', String(G.courierJobs)],
    ['Ending', G.ending || '—'],
  ];
  box.innerHTML = '<h2>CAREER STATS</h2>' + rows.map(r => `<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}

export function renderStory(G) {
  const box = $('story-panel');
  if (!box) return;
  let html = '<h2>THE SOLMAR REIGN — STORY</h2>';
  for (const a of actsSummary(G)) {
    html += `<div class="act-row">Act ${a.act} — ${a.done}/${a.total} missions</div>`;
  }
  for (const m of G.missions) {
    html += `<div class="story-row ${m.done ? 'done' : ''}"><span>${m.id} · ${m.name}</span><b>${m.done ? 'DONE' : fmtMoney(m.pay)}</b></div><div class="story-brief">${m.brief}</div>`;
  }
  box.innerHTML = html;
}

export function showBriefing(G) {
  const box = $('briefing-panel');
  if (!box || !G.briefing) return;
  box.innerHTML = '<h2>MISSION BRIEFING</h2>' + briefingLines(G).map(l => `<div class="brief-line">${l}</div>`).join('') +
    '<div class="brief-hint">Press E to accept · Esc to close</div>';
  box.style.display = 'block';
}
export function hideBriefing(G) {
  const box = $('briefing-panel');
  if (box) box.style.display = 'none';
  G.briefing = null;
}
export function showDialogue(G) {
  const box = $('dialogue-panel');
  if (!box) return;
  const line = G.dialogue && G.dialogue[G.dialogueIdx];
  if (!line) { box.style.display = 'none'; G.dialogue = null; return; }
  box.innerHTML = `<b>${line[0]}:</b> ${line[1]}<div class="dialogue-hint">E to continue</div>`;
  box.style.display = 'block';
}
export function advanceDialogue(G) {
  if (!G.dialogue) return false;
  G.dialogueIdx += 1;
  if (G.dialogueIdx >= G.dialogue.length) {
    G.dialogue = null;
    const box = $('dialogue-panel');
    if (box) box.style.display = 'none';
    return false;
  }
  showDialogue(G);
  return true;
}
export function showEndingChoice(G) {
  const box = $('choice-panel');
  if (!box) return;
  box.innerHTML = '<h2>THE CHOICE</h2><div class="brief-line">The vault is open. The crown is yours — or the crew is.</div>' +
    '<button id="choice-crown">Take the Crown — $25,000</button>' +
    '<button id="choice-loyal">Stay Loyal — $25,000</button>';
  box.style.display = 'block';
}
export function hideChoice() {
  const box = $('choice-panel');
  if (box) box.style.display = 'none';
}
export function togglePause(G, show) {
  const box = $('pause-panel');
  if (!box) return;
  G.paused = show;
  box.style.display = show ? 'block' : 'none';
  if (show) { renderMap(G, null); renderStats(G); renderStory(G); }
}
// Weapon wheel overlay (Q).
export function renderWheel(G) {
  const box = $('wheel-panel');
  if (!box) return;
  const items = weaponWheelItems(G);
  box.innerHTML = '<h2>WEAPONS</h2>' + items.map(w =>
    `<div class="wheel-row ${w.active ? 'active' : ''} ${w.owned ? '' : 'locked'}"><span>${w.slot} · ${w.name}</span><b>${w.ammo}</b></div>`).join('');
  box.style.display = G.weaponWheel ? 'block' : 'none';
}
