// Solmar City v4 — the HUD: cash, respect, coins, wanted stars, clock, health,
// speed and objective, plus the circular minimap and the menu/pause overlays.
import { clamp, fmtClock, daypart } from './util.js';
import { ROADS_X, ROADS_Z } from './city.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const respectEl = el('hud-respect');
  const coinsEl = el('hud-coins');
  const starsEl = el('hud-stars');
  const clockEl = el('hud-clock');
  const missionEl = el('hud-mission');
  const objectiveEl = el('hud-objective');
  const speedEl = el('hud-speed');
  const speedUnit = el('hud-speed-unit');
  const healthFill = el('hud-health-fill');
  const toastEl = el('hud-toast');
  const bannerEl = el('hud-banner');
  const bannerTitle = el('hud-banner-title');
  const bannerSub = el('hud-banner-sub');
  const map = el('hud-minimap');
  const mctx = map.getContext('2d');
  const crosshair = el('hud-crosshair');
  const startOverlay = el('overlay-start');
  const pauseOverlay = el('overlay-pause');
  const bustedOverlay = el('overlay-busted');
  const bustedTitle = el('overlay-busted-title');
  const bustedSub = el('overlay-busted-sub');
  let toastTimer = 0;
  let bannerTimer = 0;
  const H = {
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.style.opacity = '1';
      toastTimer = 3.0;
    },
    banner(title, sub) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      bannerEl.style.opacity = '1';
      bannerTimer = 3.0;
    },
    showStart() { startOverlay.style.display = 'flex'; },
    hideStart() { startOverlay.style.display = 'none'; },
    showPause() { pauseOverlay.style.display = 'flex'; },
    hidePause() { pauseOverlay.style.display = 'none'; },
    showBusted(title, sub) {
      bustedTitle.textContent = title;
      bustedSub.textContent = sub;
      bustedOverlay.style.display = 'flex';
    },
    hideBusted() { bustedOverlay.style.display = 'none'; },
    drawMinimap() {
      const W = map.width, Hh = map.height;
      const toMap = (x, z) => [((x + 165) / 330) * W, ((z + 165) / 330) * Hh];
      mctx.clearRect(0, 0, W, Hh);
      mctx.fillStyle = '#10181f';
      mctx.fillRect(0, 0, W, Hh);
      mctx.fillStyle = '#1d5f8a';
      const [wx0] = toMap(-165, 0);
      mctx.fillRect(0, 0, Math.max(2, (( -150 + 165) / 330) * W), Hh);
      mctx.fillStyle = '#d9c08a';
      mctx.fillRect((( -150 + 165) / 330) * W, 0, 3, Hh);
      mctx.strokeStyle = '#565b60';
      mctx.lineWidth = 4;
      for (const r of ROADS_X) {
        const [x0, y0] = toMap(r, -160);
        const [, y1] = toMap(r, 160);
        mctx.beginPath(); mctx.moveTo(x0, y0); mctx.lineTo(x0, y1); mctx.stroke();
      }
      for (const r of ROADS_Z) {
        const [x0, y0] = toMap(-160, r);
        const [x1] = toMap(160, r);
        mctx.beginPath(); mctx.moveTo(x0, y0); mctx.lineTo(x1, y0); mctx.stroke();
      }
      const t = G.missions.target();
      if (t) {
        const [mx, my] = toMap(t.x, t.z);
        const pulse = 5 + Math.sin(G.elapsed * 5) * 2;
        mctx.fillStyle = '#ffd23c';
        mctx.beginPath();
        mctx.moveTo(mx, my - pulse); mctx.lineTo(mx + pulse, my); mctx.lineTo(mx, my + pulse); mctx.lineTo(mx - pulse, my);
        mctx.closePath(); mctx.fill();
      }
      const tt = G.taxi.target();
      if (tt) {
        const [mx, my] = toMap(tt.x, tt.z);
        mctx.fillStyle = '#2fd8ff';
        mctx.beginPath(); mctx.arc(mx, my, 4, 0, Math.PI * 2); mctx.fill();
      }
      for (const c of G.police.cars) {
        const [mx, my] = toMap(c.group.position.x, c.group.position.z);
        mctx.fillStyle = '#ff3344';
        mctx.beginPath(); mctx.arc(mx, my, 3.5, 0, Math.PI * 2); mctx.fill();
      }
      if (G.police.heli) {
        const [mx, my] = toMap(G.police.heli.position.x, G.police.heli.position.z);
        mctx.fillStyle = '#ff8844';
        mctx.beginPath(); mctx.arc(mx, my, 4, 0, Math.PI * 2); mctx.fill();
      }
      const p = G.playerPos();
      const [px, py] = toMap(p.x, p.z);
      mctx.save();
      mctx.translate(px, py);
      mctx.rotate(-G.heading());
      mctx.fillStyle = '#ffffff';
      mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill();
      mctx.restore();
    },
    update(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.style.opacity = '0';
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.style.opacity = '0';
      }
      cashEl.textContent = '$' + G.cash.toLocaleString('en-US');
      respectEl.textContent = 'RESPECT ' + G.respect;
      coinsEl.textContent = 'COINS ' + G.coins + '/20';
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
      starsEl.innerHTML = stars.split('').map((s, i) => `<span style="color:${i < G.wanted ? '#ffcf3c' : '#5a6a80'}">${s}</span>`).join('');
      clockEl.textContent = fmtClock(G.hours) + ' · ' + daypart(G.hours);
      missionEl.textContent = 'MISSION ' + (G.missions.done ? '5/5' : Math.min(G.missions.index + 1, 5) + '/5');
      objectiveEl.textContent = G.missions.objective();
      const kmh = Math.round(Math.abs(G.speed()) * 3.6);
      speedEl.textContent = String(kmh);
      speedUnit.textContent = 'km/h · ' + (G.inCar ? 'driving' : 'on foot');
      healthFill.style.width = clamp(G.health, 0, 100) + '%';
      healthFill.style.background = G.health > 50 ? '#e5484d' : '#ff8a3c';
      crosshair.style.display = (!G.inCar && G.state === 'playing') ? 'block' : 'none';
      H.drawMinimap();
    },
  };
  return H;
}

export function starsText(wanted) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '☆';
  return s;
}
