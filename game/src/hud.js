// Solmar City — HUD: DOM readouts (cash, stars, objective, health, speed,
// clock) and the circular minimap drawn on a 2D canvas.
import { fmtCash, fmtClock, clamp } from './util.js';
import { BLOCK, GRID, CITY_R } from './city.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cash'),
      respect: document.getElementById('respect'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      objTitle: document.getElementById('obj-title'),
      objSub: document.getElementById('obj-sub'),
      healthFill: document.getElementById('healthfill'),
      speed: document.getElementById('speed'),
      msg: document.getElementById('msg'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage'),
      minimap: document.getElementById('minimap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.msgTimer = null;
    this.toastTimer = null;
  }
  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }
  setCash(n) { this.el.cash.textContent = fmtCash(n); }
  setRespect(n) { this.el.respect.textContent = 'RESPECT ' + n + '  ·  COINS ' + (this.coins || 0) + '/20'; }
  setCoins(n) { this.coins = n; }
  setStars(n) {
    const spans = this.el.stars.querySelectorAll('span');
    spans.forEach((s, i) => s.classList.toggle('lit', i < n));
  }
  setClock(hours) { this.el.clock.textContent = fmtClock(hours) + (hours >= 19 || hours < 6 ? ' · NIGHT' : hours >= 17 ? ' · DUSK' : ' · DAY'); }
  setObjective(title, sub) {
    this.el.objTitle.textContent = title;
    this.el.objSub.textContent = sub || '';
  }
  setHealth(frac) { this.el.healthFill.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; }
  setSpeed(kmh, inCar) {
    this.el.speed.innerHTML = Math.round(kmh) + '<small>km/h · ' + (inCar ? 'driving' : 'on foot') + '</small>';
  }
  bigMsg(text, sub, ms) {
    const m = this.el.msg;
    m.innerHTML = text + (sub ? '<br><span style="font-size:14px;font-weight:normal">' + sub + '</span>' : '');
    m.style.opacity = 1;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { m.style.opacity = 0; }, ms || 3000);
  }
  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2600);
  }
  flashDamage() {
    this.el.damage.style.opacity = 1;
    setTimeout(() => { this.el.damage.style.opacity = 0; }, 180);
  }
  setCrosshair(on) { this.el.crosshair.style.display = on ? 'block' : 'none'; }
  // Minimap: player-centred, north-up, roads + water + blips.
  drawMinimap(px, pz, heading, blips) {
    const ctx = this.mm, S = 360, R = 150; // world units visible radius
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    // ground
    ctx.fillStyle = '#1d2b1f'; ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + ((x - px) / R) * (S / 2), S / 2 + ((z - pz) / R) * (S / 2)];
    // water (west)
    const [wx] = toMap(-CITY_R - 2, 0);
    ctx.fillStyle = '#14506e';
    ctx.fillRect(0, 0, Math.max(0, wx), S);
    // roads
    ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 7;
    for (let i = -GRID; i <= GRID; i++) {
      const c = i * BLOCK;
      let [x1, y1] = toMap(c, pz - R), [x2, y2] = toMap(c, pz + R);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      [x1, y1] = toMap(px - R, c); [x2, y2] = toMap(px + R, c);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // blips: {x, z, color, size}
    for (const b of blips || []) {
      const [bx, by] = toMap(b.x, b.z);
      if (bx < 0 || bx > S || by < 0 || by > S) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(bx, by, b.size || 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // player arrow (centre)
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.restore();
    // ring
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }
}
