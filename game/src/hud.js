// Solmar City v8 — the HUD: cash, respect, wanted stars, health, speed,
// ammo, clock, district and objective, plus a live minimap, mission banners
// and the start screen. All DOM lives in index.html; this file drives it.
import { money, clockText, clamp } from './util.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of ['cash', 'respect-fill', 'respect-num', 'stars', 'health-fill', 'health-num', 'speed', 'ammo', 'clock', 'district', 'objective', 'banner', 'banner-title', 'banner-sub', 'toast', 'minimap', 'start-screen', 'btn-new', 'btn-continue', 'pause-screen', 'wasted-screen', 'busted-screen']) {
      this.el[id] = doc.getElementById(id);
    }
    this.minimap = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.bannerTimer = null;
    this.toastTimer = null;
  }

  showStart(hasSave) {
    if (this.el['start-screen']) this.el['start-screen'].style.display = 'flex';
    if (this.el['btn-continue']) this.el['btn-continue'].style.display = hasSave ? 'block' : 'none';
  }

  hideStart() {
    if (this.el['start-screen']) this.el['start-screen'].style.display = 'none';
  }

  showPause(show) {
    if (this.el['pause-screen']) this.el['pause-screen'].style.display = show ? 'flex' : 'none';
  }

  showEnd(kind) {
    const id = kind === 'wasted' ? 'wasted-screen' : 'busted-screen';
    if (this.el[id]) this.el[id].style.display = 'flex';
    setTimeout(() => { if (this.el[id]) this.el[id].style.display = 'none'; }, 2600);
  }

  banner(title, sub = '') {
    if (!this.el.banner) return;
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.style.opacity = '1';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.el.banner.style.opacity = '0'; }, 3200);
  }

  toast(text) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, 2600);
  }

  update(state) {
    if (this.el.cash) this.el.cash.textContent = money(state.cash);
    if (this.el['respect-fill']) this.el['respect-fill'].style.width = clamp(state.respect, 0, 100) + '%';
    if (this.el['respect-num']) this.el['respect-num'].textContent = Math.round(state.respect);
    if (this.el.stars) {
      const filled = Math.round(state.wanted);
      this.el.stars.textContent = '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled));
      this.el.stars.style.color = filled > 0 ? '#ffd21f' : '#888888';
    }
    if (this.el['health-fill']) {
      this.el['health-fill'].style.width = clamp(state.health, 0, 100) + '%';
      this.el['health-fill'].style.background = state.health > 50 ? '#2ecc71' : state.health > 25 ? '#f39c12' : '#e74c3c';
    }
    if (this.el['health-num']) this.el['health-num'].textContent = Math.round(state.health);
    if (this.el.speed) this.el.speed.textContent = state.inCar || state.onBoat ? Math.round(state.speedKmh) + ' km/h' : '';
    if (this.el.ammo) this.el.ammo.textContent = state.reloading ? 'RELOADING' : `AMMO ${state.ammo}/12`;
    if (this.el.clock) this.el.clock.textContent = clockText(state.dayFrac);
    if (this.el.district) this.el.district.textContent = state.district;
    if (this.el.objective) this.el.objective.textContent = state.objective;
  }

  drawMinimap(world) {
    const g = this.minimap;
    if (!g) return;
    const S = 180;
    const toMap = (x, z) => [((x + 300) / 620) * S, ((z + 300) / 620) * S];
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20262b';
    g.fillRect(0, 0, S, S);
    // Bay water on the west edge.
    const [wx] = toMap(-244, 0);
    g.fillStyle = '#14506e';
    g.fillRect(0, 0, wx, S);
    // Roads.
    g.strokeStyle = '#565b62';
    g.lineWidth = 2;
    for (let v = -240; v <= 300; v += 60) {
      const [x1] = toMap(v, -300);
      const [, z1] = toMap(0, v);
      g.beginPath(); g.moveTo(x1, 0); g.lineTo(x1, S); g.stroke();
      g.beginPath(); g.moveTo(0, z1); g.lineTo(S, z1); g.stroke();
    }
    // Mission / job markers.
    const dot = (x, z, color, r = 4) => {
      const [mx, my] = toMap(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
    };
    if (world.marker) dot(world.marker.x, world.marker.z, world.marker.color || '#3aa0ff', 5);
    if (world.taxi) dot(world.taxi.pickedUp ? world.taxi.dx : world.taxi.px, world.taxi.pickedUp ? world.taxi.dz : world.taxi.pz, '#f2c200', 4);
    if (world.delivery) dot(world.delivery.pickedUp ? world.delivery.dx : world.delivery.px, world.delivery.pickedUp ? world.delivery.dz : world.delivery.pz, '#2ecc71', 4);
    // Police as red dots.
    for (const c of world.policeCars || []) dot(c.x, c.z, '#ff3333', 3);
    for (const h of world.helis || []) dot(h.x, h.z, '#ff8800', 3);
    // Player arrow: white triangle pointing along the heading, with a dark
    // outline so it reads over both roads and water.
    const [px, py] = toMap(world.player.x, world.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(world.player.heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111111';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

// Controls text for the start screen and pause menu, kept in one place so
// the game and the help text can never disagree.
export const CONTROLS_TEXT = [
  'W A S D — move / drive',
  'Mouse drag — look around',
  'E — enter / leave car or boat',
  'Click — shoot (R reloads)',
  'Shift — run',
  'M — next mission',
  'T — taxi fare, D — delivery job',
  'P — pause, H — save game',
];
