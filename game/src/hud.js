// Solmar City v7 — HUD: cash, respect, coins, wanted stars, health,
// speed, objective, clock and the circular minimap with blips.
import { money, clockLabel, daypart } from './util.js';
import { currentMission } from './missions.js';

let el, mm, mmCtx, bannerTimer = null, toastTimer = null;

export function initHUD(G) {
  el = {
    cash: document.getElementById('cash'),
    respect: document.getElementById('respect'),
    coins: document.getElementById('coins'),
    stars: document.getElementById('stars'),
    clock: document.getElementById('clock'),
    mission: document.getElementById('mission'),
    objective: document.getElementById('objective'),
    health: document.getElementById('healthfill'),
    healthLabel: document.getElementById('healthlabel'),
    speed: document.getElementById('speed'),
    banner: document.getElementById('banner'),
    toast: document.getElementById('toast'),
  };
  mm = document.getElementById('minimap');
  mmCtx = mm.getContext('2d');
  G.banner = (title, sub) => {
    el.banner.innerHTML = title + (sub ? `<span class="sub">${sub}</span>` : '');
    el.banner.style.opacity = 1;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.banner.style.opacity = 0; }, 3200);
  };
  G.toast = (msg) => {
    el.toast.textContent = msg;
    el.toast.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = 0; }, 2600);
  };
}

export function updateHUD(G) {
  const p = G.player;
  el.cash.textContent = money(p.cash);
  el.respect.textContent = `RESPECT ${p.respect}`;
  el.coins.textContent = `COINS ${p.coins}/20`;
  el.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  el.clock.textContent = `${clockLabel(G.hours)} · ${daypart(G.hours)}`;
  const M = G.missions;
  el.mission.textContent = M.done ? 'ALL MISSIONS DONE' : `MISSION ${M.index + 1}/5`;
  el.objective.textContent = missionObjectiveText(G);
  el.health.style.width = `${Math.max(0, p.health)}%`;
  el.healthLabel.textContent = p.health < 30 ? 'HEALTH — CRITICAL' : G.wanted >= 2 ? 'HEALTH — UNDER FIRE' : 'HEALTH';
  el.speed.innerHTML = `${Math.round(p.speed)} <small>KM/H</small>`;
  drawMinimap(G);
}

function missionObjectiveText(G) {
  const M = G.missions;
  if (M.done) return 'Solmar City is yours, Rook';
  if (M.taxi) return M.taxi.picked ? 'Taxi: drive the passenger to the marker' : 'Taxi: pick up the passenger';
  const mis = currentMission(G);
  if (!mis) return '';
  const s = mis.steps[M.step];
  return `Mission ${M.index + 1}: ${mis.name} — ${s ? s.label : 'done'}`;
}

function drawMinimap(G) {
  const c = mmCtx, W = 150, H = 150, cx = W / 2, cy = H / 2;
  const scale = W / 620;
  const toMap = (x, z) => [cx + x * scale, cy + z * scale];
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#0b1220'; c.beginPath(); c.arc(cx, cy, 74, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, 74, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#123a5c'; c.fillRect(cx + 300 * scale, 0, 200, H);
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 5;
  const R = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
  for (const r of R) {
    c.beginPath(); c.moveTo(...toMap(r, -270)); c.lineTo(...toMap(r, 270)); c.stroke();
    c.beginPath(); c.moveTo(...toMap(-270, r)); c.lineTo(...toMap(270, r)); c.stroke();
  }
  c.fillStyle = '#d9c28a'; c.fillRect(cx + 285 * scale, 0, 12, H);
  const M = G.missions;
  if (!M.done) {
    const mis = M.index < 5 ? M : null;
    const s = mis && mis.steps ? mis.steps[M.step] : null;
    const t = M.taxi ? (M.taxi.picked ? M.taxi.dest : { x: M.taxi.ped.group.position.x, z: M.taxi.ped.group.position.z }) : (s ? { x: s.x, z: s.z } : null);
    if (t) {
      const [mx, my] = toMap(t.x, t.z);
      c.fillStyle = '#ffd23e'; c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23e'; c.beginPath(); c.arc(mx, my, 8 + Math.sin(G.elapsed * 4) * 2, 0, Math.PI * 2); c.stroke();
    }
  }
  for (const cp of G.police) {
    const [mx, my] = toMap(cp.group.position.x, cp.group.position.z);
    c.fillStyle = '#ff4040'; c.beginPath(); c.arc(mx, my, 3, 0, Math.PI * 2); c.fill();
  }
  if (G.heli) {
    const [mx, my] = toMap(G.heli.group.position.x, G.heli.group.position.z);
    c.fillStyle = '#ff8040'; c.beginPath(); c.arc(mx, my, 4, 0, Math.PI * 2); c.fill();
  }
  const p = G.player;
  const [px, py] = toMap(p.pos.x, p.pos.z);
  c.save();
  c.translate(px, py);
  c.rotate(p.heading);
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
  c.restore();
  c.restore();
}

export function hudReady() { return !!el; }
export function hudElements() { return el; }
