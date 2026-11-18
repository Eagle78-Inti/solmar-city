// Solmar City — the HUD: cash, respect, coins, wanted stars, health, speed,
// objective banner, clock, a circular minimap, start and pause screens, and
// a message feed. All DOM, drawn over the 3D canvas.
import { clamp } from './util.js';

export class HUD {
  constructor(game) {
    this.g = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      cash: $('hud-cash'), respect: $('hud-respect'), coins: $('hud-coins'),
      stars: $('hud-stars'), health: $('hud-health-fill'), healthWrap: $('hud-health'),
      speed: $('hud-speed'), objective: $('hud-objective'), clock: $('hud-clock'),
      feed: $('hud-feed'), map: $('hud-map'), start: $('screen-start'),
      startBtn: $('btn-start'), continueBtn: $('btn-continue'), pause: $('screen-pause'),
      cross: $('hud-crosshair'), bust: $('hud-bust'), damage: $('hud-damage'),
      mission: $('hud-mission'), vignette: $('hud-vignette'),
    };
    this.mapCtx = this.el.map.getContext('2d');
    this.feedItems = [];
  }

  money(n) { return '$' + Math.round(n).toLocaleString(); }

  refresh() {
    const m = this.g.missions;
    this.el.cash.textContent = this.money(m.cash);
    this.el.respect.textContent = 'RESPECT ' + m.respect;
    this.el.coins.textContent = `COINS ${m.coinsGot}/20`;
    const w = this.g.police.wanted;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < w ? 'star on' : 'star'}">★</span>`;
    this.el.stars.innerHTML = stars;
    const hp = Math.round(this.g.player.health);
    this.el.health.style.width = hp + '%';
    this.el.health.style.background = hp > 55 ? '#ff5a4e' : hp > 25 ? '#ff8c1a' : '#ff2222';
    const sp = this.g.player.onFoot
      ? Math.round(this.g.player.speed * 3.6)
      : Math.round(Math.abs(this.g.player.car ? this.g.player.car.speed : 0) * 3.6);
    this.el.speed.innerHTML = `<b>${sp}</b><span>km/h · ${this.g.player.onFoot ? 'on foot' : 'driving'}</span>`;
    const bustFrac = this.g.police.bustT / 3;
    this.el.bust.style.opacity = bustFrac > 0.05 ? String(0.35 + bustFrac * 0.65) : '0';
    this.el.bust.textContent = bustFrac > 0.66 ? 'BUSTED!' : 'THE COPS HAVE YOU — BREAK AWAY!';
  }

  setClock(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    const label = hour < 5.5 || hour > 19 ? 'NIGHT' : hour < 7.5 ? 'DAWN' : hour < 17.5 ? 'DAY' : hour < 19 ? 'DUSK' : 'NIGHT';
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${label}`;
  }

  setObjective(text) { this.el.objective.textContent = text; }
  setMission(i, done) {
    this.el.mission.textContent = done ? 'ALL MISSIONS COMPLETE' : `MISSION ${Math.min(i + 1, 5)}/5`;
  }
  message(text) {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.textContent = text;
    this.el.feed.prepend(div);
    this.feedItems.push(div);
    while (this.feedItems.length > 4) {
      const old = this.feedItems.shift();
      old.remove();
    }
    setTimeout(() => { div.classList.add('fade'); }, 5200);
    setTimeout(() => { div.remove(); }, 6200);
  }
  flashDamage() {
    this.el.damage.style.opacity = '0.55';
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 140);
  }

  // Circular minimap: the bay on the west edge, the road grid, the mission
  // marker, police in red, traffic in white, and the player's arrow.
  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 460;
    const toMap = (x, z) => [90 + (x + 20) * scale, 90 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(90, 90, 88, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d3320';
    ctx.fillRect(0, 0, S, S);
    // Bay water and beach on the west.
    ctx.fillStyle = '#0f7f8c';
    ctx.fillRect(0, 0, 90 + (-188 + 20) * scale, S);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(90 + (-212 + 20) * scale, 0, 24 * scale, S);
    // Roads.
    ctx.strokeStyle = 'rgba(200,200,200,0.55)';
    ctx.lineWidth = 2.4;
    for (const r of [-176, -132, -88, -44, 0, 44, 88, 132, 176]) {
      const [x1] = toMap(r, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(0, r);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      const [mx, mz] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
    };
    // Mission marker.
    const m = this.g.missions.markerPos;
    if (m && this.g.missions.marker.visible) {
      const [mx, mz] = toMap(m.x, m.z);
      ctx.fillStyle = '#ffd319';
      ctx.beginPath();
      ctx.moveTo(mx, mz - 7); ctx.lineTo(mx + 6, mz); ctx.lineTo(mx, mz + 7); ctx.lineTo(mx - 6, mz);
      ctx.closePath(); ctx.fill();
    }
    for (const c of this.g.traffic) dot(c.pos.x, c.pos.z, 'rgba(255,255,255,0.75)', 2);
    for (const c of this.g.police.cars) dot(c.pos.x, c.pos.z, '#ff4444', 3);
    if (this.g.police.heli) dot(this.g.police.heli.position.x, this.g.police.heli.position.z, '#ff8844', 4);
    // Taxi rider waits in green.
    if (this.g.missions.taxi) dot(this.g.missions.taxi.pickup.x, this.g.missions.taxi.pickup.z, '#39ff88', 3);
    // Player arrow.
    const [px, pz] = toMap(this.g.player.pos.x, this.g.player.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-this.g.player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(90, 90, 88, 0, Math.PI * 2);
    ctx.stroke();
  }

  showStart(hasSave) {
    this.el.start.style.display = 'flex';
    this.el.continueBtn.style.display = hasSave ? 'block' : 'none';
    this.el.cross.style.display = 'none';
  }
  hideStart() {
    this.el.start.style.display = 'none';
    this.el.cross.style.display = 'block';
  }
  showPause(show) {
    this.el.pause.style.display = show ? 'flex' : 'none';
    if (!show) this.el.cross.style.display = 'block';
    else this.el.cross.style.display = 'none';
  }
  setVignette(nightF) {
    // The cinematic frame deepens at night so the neon reads.
    this.el.vignette.style.opacity = String(0.35 + nightF * 0.45);
  }
}
