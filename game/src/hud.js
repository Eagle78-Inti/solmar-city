// Solmar City — the HUD: cash, respect, coins, wanted stars, health, speed,
// objective, clock, the circular minimap, toasts, banners, start and pause.

import { fmtMoney, fmtClock, daypart } from './util.js';

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const money = el('money');
  const respectLine = el('respect-line');
  const coinLine = el('coin-line');
  const starRow = el('star-row');
  const clockLine = el('clock-line');
  const missionLine = el('mission-line');
  const objectiveBar = el('objective-bar');
  const healthFill = el('health-fill');
  const healthLabel = el('health-label');
  const speedNum = el('speed-num');
  const toastBox = el('toast');
  const bannerBox = el('banner');
  const bannerHead = el('banner-head');
  const bannerSub = el('banner-sub');
  const startScreen = el('screen-start');
  const pauseScreen = el('screen-pause');
  const continueBtn = el('btn-continue');
  const minimap = el('minimap');
  const mm = minimap ? minimap.getContext('2d') : null;
  let toastTimer = null;
  let bannerTimer = null;

  function starText(wanted) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '☆';
    return s;
  }

  function update(G, ctx) {
    money.textContent = fmtMoney(G.cash);
    respectLine.textContent = 'RESPECT ' + G.respect;
    coinLine.textContent = 'COINS ' + G.coins + '/20';
    starRow.textContent = starText(G.wanted);
    starRow.style.color = G.wanted > 0 ? '#ffd23c' : 'rgba(255,255,255,0.35)';
    clockLine.textContent = fmtClock(G.hours) + ' · ' + daypart(G.hours);
    missionLine.textContent = G.missionDone
      ? 'STORY COMPLETE'
      : 'MISSION ' + (G.missionIndex + 1) + '/5';
    objectiveBar.textContent = ctx.objective || '';
    healthFill.style.width = Math.max(0, G.health) + '%';
    healthLabel.textContent = 'HEALTH' + (ctx.firefight ? ' — UNDER FIRE' : '');
    healthLabel.style.color = ctx.firefight ? '#ff6b6b' : '#ffffff';
    const kmh = Math.round(Math.abs(ctx.speed || 0) * 3.6);
    speedNum.textContent = ctx.onFoot ? '—' : String(kmh);
    drawMinimap(G, ctx);
  }

  function toast(msg) {
    toastBox.textContent = msg;
    toastBox.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.style.opacity = '0'; }, 2600);
  }

  function banner(title, sub) {
    bannerHead.textContent = title;
    bannerSub.textContent = sub || '';
    bannerBox.style.opacity = '1';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { bannerBox.style.opacity = '0'; }, 3400);
  }

  function showStart(hasSave) {
    startScreen.style.display = 'flex';
    pauseScreen.style.display = 'none';
    continueBtn.style.display = hasSave ? 'inline-block' : 'none';
  }
  function hideStart() {
    startScreen.style.display = 'none';
  }
  function showPause(show) {
    pauseScreen.style.display = show ? 'flex' : 'none';
  }

  function drawMinimap(G, ctx) {
    if (!mm) return;
    const S = 150, C = S / 2;
    const scale = S / 760; // world -380..380 maps onto the circle
    const toX = (x) => C + x * scale;
    const toY = (z) => C + z * scale;
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.beginPath();
    mm.arc(C, C, C - 2, 0, Math.PI * 2);
    mm.clip();
    mm.fillStyle = '#10181f';
    mm.fillRect(0, 0, S, S);
    // water east
    mm.fillStyle = '#1d6f9e';
    mm.fillRect(toX(260), 0, S, S);
    mm.fillStyle = '#d9c08a';
    mm.fillRect(toX(240), 0, toX(260) - toX(240), S);
    // roads
    mm.strokeStyle = '#4a5058';
    mm.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      const c = i * 74;
      mm.beginPath(); mm.moveTo(toX(c), 0); mm.lineTo(toX(c), S); mm.stroke();
      mm.beginPath(); mm.moveTo(0, toY(c)); mm.lineTo(S, toY(c)); mm.stroke();
    }
    // mission waypoint
    if (ctx.waypoint) {
      mm.fillStyle = '#ffd23c';
      mm.beginPath();
      mm.moveTo(toX(ctx.waypoint.x), toY(ctx.waypoint.z) - 6);
      mm.lineTo(toX(ctx.waypoint.x) + 5, toY(ctx.waypoint.z));
      mm.lineTo(toX(ctx.waypoint.x), toY(ctx.waypoint.z) + 6);
      mm.lineTo(toX(ctx.waypoint.x) - 5, toY(ctx.waypoint.z));
      mm.closePath();
      mm.fill();
    }
    // taxi waypoint
    if (ctx.taxiWaypoint) {
      mm.fillStyle = '#3ec2b0';
      mm.beginPath();
      mm.arc(toX(ctx.taxiWaypoint.x), toY(ctx.taxiWaypoint.z), 4, 0, Math.PI * 2);
      mm.fill();
    }
    // police blips
    mm.fillStyle = '#ff4d4d';
    for (const p of ctx.police || []) {
      mm.beginPath();
      mm.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
      mm.fill();
    }
    // player arrow, rotated to the heading
    mm.save();
    mm.translate(toX(ctx.px), toY(ctx.pz));
    mm.rotate(Math.PI - ctx.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 5);
    mm.lineTo(-5, 5);
    mm.closePath();
    mm.fill();
    mm.restore();
    mm.restore();
  }

  return {
    update, toast, banner, showStart, hideStart, showPause,
    onStart(fn) { el('btn-start').addEventListener('click', fn); },
    onContinue(fn) { continueBtn.addEventListener('click', fn); },
    onResume(fn) { el('btn-resume').addEventListener('click', fn); },
    onSave(fn) { el('btn-save').addEventListener('click', fn); },
  };
}

// Show the saved-game summary line on the start screen (cash, mission).
export function showSaveLine(doc, text) {
  const line = doc.getElementById('save-line');
  if (line) line.textContent = text;
}
