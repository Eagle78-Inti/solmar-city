// Solmar City — the HUD: cash, respect, coins, wanted stars, health,
// speed, objective banner, clock and a circular minimap, plus the start
// screen, pause menu and toast messages. All DOM, drawn over the canvas.
export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {};
    for (const id of ['cash', 'respect', 'coins', 'stars', 'health', 'speed', 'objective', 'clock', 'mission', 'toast', 'menu', 'pause', 'crosshair']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mctx = this.map.getContext('2d');
    this.toastTimer = null;
  }
  flash(text) {
    const t = this.el.toast;
    t.textContent = text; t.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  }
  showMenu(hasSave) {
    this.el.menu.style.display = 'flex';
    document.getElementById('continueBtn').style.display = hasSave ? 'inline-block' : 'none';
  }
  hideMenu() { this.el.menu.style.display = 'none'; }
  showPause(on) { this.el.pause.style.display = on ? 'flex' : 'none'; }
  fmtClock(dayT) {
    const mins = Math.floor(dayT * 24 * 60);
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    // dayT: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight.
    const part = dayT < 0.08 || dayT >= 0.97 ? 'DAWN' : dayT < 0.5 ? 'DAY' : dayT < 0.63 ? 'DUSK' : 'NIGHT';
    return `${h}:${m} · ${part}`;
  }
  update() {
    const G = this.G;
    this.el.cash.textContent = '$' + G.cash.toLocaleString('en-US');
    this.el.respect.textContent = 'RESPECT ' + G.respect;
    this.el.coins.textContent = `COINS ${G.missions.coinsGot}/20`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.className = G.wanted > 0 ? 'hot' : '';
    this.el.health.style.width = G.health + '%';
    this.el.health.style.background = G.health > 50 ? '#e05252' : G.health > 25 ? '#e08a52' : '#e05252';
    const kmh = Math.round((G.player.car ? Math.abs(G.player.car.speed) : G.player.speed) * 3.6);
    this.el.speed.innerHTML = `${kmh}<span> km/h · ${G.player.onFoot ? 'on foot' : 'driving'}</span>`;
    this.el.objective.textContent = G.objective;
    this.el.clock.textContent = this.fmtClock(G.dayT);
    this.el.mission.textContent = `MISSION ${Math.min(G.missions.index + 1, 5)}/5`;
    this.el.crosshair.style.display = G.player.onFoot && G.started && !G.paused ? 'block' : 'none';
    this.drawMinimap();
  }
  drawMinimap() {
    const G = this.G;
    const ctx = this.mctx, S = 150, R = S / 2;
    const scale = S / 420;
    const px = (x) => R + (x - G.player.pos.x) * scale * 3;
    const pz = (z) => R + (z - G.player.pos.z) * scale * 3;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0e1a12'; ctx.fillRect(0, 0, S, S);
    // Bay water on the west side.
    ctx.fillStyle = '#1d5f7a';
    ctx.fillRect(0, 0, Math.max(0, R + (-170 - G.player.pos.x) * scale * 3), S);
    // Roads.
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 5;
    for (const x of [-140, -100, -60, -20, 20, 60, 100, 140, 180]) {
      ctx.beginPath(); ctx.moveTo(px(x), -10); ctx.lineTo(px(x), S + 10); ctx.stroke();
    }
    for (const z of [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180]) {
      ctx.beginPath(); ctx.moveTo(-10, pz(z)); ctx.lineTo(S + 10, pz(z)); ctx.stroke();
    }
    // Mission / taxi target.
    const tgt = G.missions.taxi ? G.missions.taxiTarget() : G.missions.currentTarget();
    if (tgt) {
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(px(tgt.x), pz(tgt.z), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(tgt.x), pz(tgt.z), 9, 0, Math.PI * 2); ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#5ea8ff';
    for (const c of G.police.cruisers) {
      ctx.beginPath(); ctx.arc(px(c.x), pz(c.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(R, R); ctx.rotate(-G.player.heading + Math.PI);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.stroke();
  }
}

  // Big centre-screen message for BUSTED / WASTED / mission complete.
  HUD.prototype.flashCenter = function (text, sub) {
    let el = document.getElementById('centerMsg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'centerMsg';
      el.style.cssText = 'position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;color:#fff;font-family:inherit;pointer-events:none;z-index:30;text-shadow:0 2px 12px rgba(0,0,0,0.8);opacity:0;transition:opacity 0.3s;';
      el.innerHTML = '<div id="centerTitle" style="font-size:52px;font-weight:800;letter-spacing:2px;"></div><div id="centerSub" style="font-size:18px;opacity:0.85;"></div>';
      document.body.appendChild(el);
    }
    document.getElementById('centerTitle').textContent = text;
    document.getElementById('centerSub').textContent = sub || '';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2400);
  };
