// Solmar City — bootstrap, game loop, camera, input, menus, save/load.
// An original open-world crime game: drive, steal, run from the law, work
// jobs for the fixer Mari Voss — and find out who she really works for.
import * as THREE from 'three';
import { clamp, lerp, angleLerp, makeRng, fmtCash } from './util.js';
import { City } from './city.js';
import { AudioEngine } from './audio.js';
import { Player } from './player.js';
import { Traffic, ParkedCars, Car, makeCarMesh } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10);

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5e0);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
    this.rng = makeRng(SEED);
    this.city = new City(this.scene, this.rng);
    this.audio = new AudioEngine();
    this.hud = new Hud();
    this.player = new Player(this.scene, this.city);
    this.traffic = new Traffic(this.scene, this.city, 16);
    this.parked = new ParkedCars(this.scene, this.city, 14);
    this.peds = new Pedestrians(this.scene, this.city, 26);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this.scene, this.city);
    this.missions = new Missions(this.scene, this.city, this.missionHooks());
    this.playerCar = null;      // the car Rook currently owns/drives
    this.cash = 250; this.respect = 0;
    this.timeOfDay = 17.5;
    this.camYaw = 0; this.camPitch = 0;
    this.state = 'menu';        // menu | playing | paused | busted | wasted
    this.keys = {};
    this.danger = null;
    this.shotMode = false;
    this.shotExtras = [];
    this.lastT = performance.now();
    this.wastedCar = false;
    // a guaranteed starter car for mission 1, parked on Palm Row
    const starterMesh = makeCarMesh(0xc23b2e);
    starterMesh.position.set(26, 0, 78); starterMesh.rotation.y = 0;
    this.scene.add(starterMesh);
    this.parked.list.push({ mesh: starterMesh, x: 26, z: 78, heading: 0, color: 0xc23b2e, health: 100 });
    this.bindInput();
    this.bindMenus();
    this.resize();
    addEventListener('resize', () => this.resize());
    if (SHOT) this.startShotMode();
    this.loop();
  }

  missionHooks() {
    return {
      addCash: (n) => { this.cash += n; this.hud.setCash(this.cash); },
      addRespect: (n) => { this.respect += n; this.hud.setRespect(this.respect); this.hud.setCoins(this.missions.coinCount); },
      setObjective: (t, s) => this.hud.setObjective(t, s),
      toast: (t) => this.hud.toast(t),
      bigMsg: (t, s, ms) => this.hud.bigMsg(t, s, ms),
      audio: this.audio,
    };
  }

  bindInput() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.state !== 'playing') return;
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyT') this.taxiJob();
      if (e.code === 'KeyR') this.resetCar();
      if (e.code === 'KeyM') { this.audio.setMuted(!this.audio.muted); this.hud.toast(this.audio.muted ? 'Sound off' : 'Sound on'); }
      if (e.code === 'KeyP' || e.code === 'Escape') this.pause();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'playing' && !this.player.inCar && e.button === 0) this.shoot();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindMenus() {
    document.getElementById('btn-new').onclick = () => { this.audio.ensure(); this.newGame(); };
    document.getElementById('btn-continue').onclick = () => { this.audio.ensure(); this.continueGame(); };
    document.getElementById('btn-resume').onclick = () => this.resume();
    document.getElementById('btn-save').onclick = () => { this.doSave(); this.hud.toast('Game saved'); };
    document.getElementById('btn-menu').onclick = () => this.toMenu();
    document.getElementById('btn-retry').onclick = () => this.retryAfterEnd();
    document.getElementById('btn-endmenu').onclick = () => this.toMenu();
    const cont = document.getElementById('btn-continue');
    if (!hasSave()) { cont.style.opacity = 0.45; }
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---- state transitions ----
  newGame() {
    this.cash = 250; this.respect = 0;
    this.timeOfDay = 17.5;
    this.player.health = 100;
    this.player.x = 26; this.player.z = 60; this.player.heading = 0;
    this.police.clear();
    this.missions.index = 0; this.missions.active = null;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('end').style.display = 'none';
    this.state = 'playing';
    this.hud.show();
    this.hud.setCash(this.cash); this.hud.setRespect(this.respect);
    this.hud.bigMsg('WELCOME TO SOLMAR CITY', 'Mari Voss has work for you. Follow the yellow marker.', 4200);
  }
  continueGame() {
    const s = loadGame();
    if (!s) { this.newGame(); return; }
    this.cash = s.cash; this.respect = s.respect || 0;
    this.timeOfDay = s.timeOfDay ?? 17.5;
    this.player.health = 100;
    this.player.x = s.x ?? 26; this.player.z = s.z ?? 60;
    this.missions.index = s.missionIndex || 0;
    this.missions.coinCount = s.coins || 0;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('end').style.display = 'none';
    this.state = 'playing';
    this.hud.show();
    this.hud.setCash(this.cash); this.hud.setRespect(this.respect);
    this.hud.bigMsg('WELCOME BACK, ROOK', 'Solmar missed you. The marker shows your next job.', 3600);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause-stats').textContent =
      `Cash ${fmtCash(this.cash)} · Respect ${this.respect} · Missions done ${this.missions.index}/5 · Coins ${this.missions.coinCount}/20 · Wanted ${this.police.wanted}★`;
    document.getElementById('pause').style.display = 'flex';
  }
  resume() {
    document.getElementById('pause').style.display = 'none';
    this.state = 'playing';
  }
  toMenu() {
    document.getElementById('pause').style.display = 'none';
    document.getElementById('end').style.display = 'none';
    document.getElementById('menu').style.display = 'flex';
    this.hud.hide();
    this.state = 'menu';
  }
  doSave() {
    const p = this.player.pos();
    saveGame({
      cash: this.cash, respect: this.respect, missionIndex: this.missions.index,
      coins: this.missions.coinCount, timeOfDay: this.timeOfDay, x: p.x, z: p.z,
    });
  }
  endGame(kind) {
    this.state = kind; // 'busted' | 'wasted'
    this.missions.failMission(kind === 'busted' ? 'The cops got you.' : 'You got flatlined.');
    document.getElementById('end-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    document.getElementById('end-text').textContent = kind === 'busted'
      ? 'Solmar PD hauled you in. Bail cost you $200 — and the job is blown.'
      : 'Solmar is a rough town. The hospital patched you up — for $200.';
    document.getElementById('end').style.display = 'flex';
    this.audio.fail();
    if (kind === 'busted') this.cash = Math.max(0, this.cash - 200);
  }
  retryAfterEnd() {
    document.getElementById('end').style.display = 'none';
    this.police.clear();
    this.player.health = 100;
    this.player.x = 26; this.player.z = 60;
    if (this.player.inCar) { this.player.exitCar(); }
    if (this.playerCar) { this.playerCar.dispose(); this.playerCar = null; }
    this.state = 'playing';
    this.hud.setCash(this.cash);
  }
  setTimeOfDay(h) { this.timeOfDay = h; this.city.updateLighting(h); }

  // ---- actions ----
  interact() {
    const p = this.player;
    if (p.inCar) {
      const car = p.exitCar();
      this.playerCar = car;
      if (car !== this.missions.repoCar) this.parked.addCar(car);
      return;
    }
    // enter the nearest parked car / own car / repo car
    const pos = p.pos();
    const near = this.parked.nearest(pos.x, pos.z, 4.5);
    const repo = this.missions.repoCar;
    const repoNear = repo && Math.hypot(repo.x - pos.x, repo.z - pos.z) < 4.5 ? repo : null;
    const own = this.playerCar && Math.hypot(this.playerCar.x - pos.x, this.playerCar.z - pos.z) < 4.5 ? this.playerCar : null;
    const target = repoNear || own || near;
    if (target) {
      if (target === repo) {
        // repo car is a live Car already
        p.enterCar(target);
        this.playerCar = target;
        return;
      }
      if (target === own) {
        // remove it from the parked list and drive it
        this.parked.list = this.parked.list.filter((q) => q.mesh !== own.mesh);
        p.enterCar(own);
        return;
      }
      // steal a parked car: it becomes a live Car (and a crime)
      this.parked.remove(near);
      const car = new Car(this.scene, near.x, near.z, near.heading, near.color, { maxSpeed: 36, accel: 15 });
      car.health = near.health;
      p.enterCar(car);
      this.playerCar = car;
      this.police.addCrime(14);
      this.hud.toast('You stole a car — the cops noticed (+1★)');
    }
  }
  taxiJob() {
    if (this.missions.maybeStartTaxi(this.player)) this.hud.toast('Taxi fare accepted');
    else if (!this.player.inCar) this.hud.toast('Get in a car first');
    else this.hud.toast('No fares right now');
  }
  resetCar() {
    if (!this.player.inCar) return;
    const car = this.player.inCar;
    const snap = this.city.nearestRoadPoint(car.x, car.z);
    car.x = snap.x; car.z = snap.z; car.speed = 0;
    car.mesh.position.set(car.x, 0, car.z);
    this.hud.toast('Car reset to the road');
  }
  shoot() {
    const targets = [];
    const tag = (mesh, kind) => { mesh.userData.target = { kind, mesh }; targets.push(mesh); };
    for (const pp of this.peds.list) if (pp.alive) tag(pp.mesh, 'ped');
    for (const c of this.traffic.cars) tag(c.mesh, 'car');
    for (const c of this.police.cars) tag(c.mesh, 'police');
    if (this.missions.repoCar) tag(this.missions.repoCar.mesh, 'car');
    this.combat.shoot(this.camera, targets, (target, point) => {
      const kind = target.kind;
      if (kind === 'ped') {
        const ped = this.peds.list.find((q) => q.mesh === target.mesh);
        if (ped && ped.alive) { this.peds.kill(ped); this.police.addCrime(16); this.danger = { x: point.x, z: point.z, radius: 40 }; }
      } else if (kind === 'car' || kind === 'police') {
        const all = [...this.traffic.cars, ...this.police.cars, this.missions.repoCar].filter(Boolean);
        const car = all.find((q) => q.mesh === target.mesh);
        if (car) {
          if (car.damage(34)) {
            this.combat.explode(car.x, car.z);
            this.audio.crash();
            this.police.addCrime(20);
            if (this.police.cars.includes(car)) {
              this.police.cars.splice(this.police.cars.indexOf(car), 1);
              car.dispose();
            }
          }
        }
      }
    });
    this.audio.gunshot();
  }
  startShotMode() {
    this.state = 'playing';
    document.getElementById('menu').style.display = 'none';
    applyShot(SHOT, this);
  }

  // ---- main loop ----
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.state !== 'playing') { this.renderer.render(this.scene, this.camera); return; }

    // clock
    if (!this.shotMode) {
      this.timeOfDay = (this.timeOfDay + dt / 30) % 24; // a full day in 12 minutes
      this.city.updateLighting(this.timeOfDay);
    }

    const k = this.keys;
    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const str = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const p = this.player;

    if (p.inCar) {
      const car = p.inCar;
      const hit = car.drive(dt, { throttle: fwd, steer: str, handbrake: !!k.Space }, this.city);
      if (hit && Math.abs(car.speed) > 10) { this.audio.crash(); this.hud.flashDamage(); }
      if (car.health <= 0 && !this.wastedCar) {
        this.wastedCar = true;
        this.combat.explode(car.x, car.z);
        this.audio.crash();
        p.exitCar();
        car.dispose();
        this.playerCar = null;
        this.hud.bigMsg('YOUR CAR IS WRECKED', 'Get out of there!', 2600);
        setTimeout(() => { this.wastedCar = false; }, 2000);
      }
      this.audio.setEngine(Math.abs(car.speed) * 3.6, true);
      this.camYaw = angleLerp(this.camYaw, car.heading, Math.min(1, dt * 3.2));
    } else {
      p.update(dt, { mx: str, mz: fwd, sprint: !!k.ShiftLeft || !!k.ShiftRight }, this.camYaw);
      this.audio.setEngine(0, false);
      if (Math.abs(p.speed) > 0.5) this.camYaw = angleLerp(this.camYaw, p.heading, Math.min(1, dt * 5));
    }

    // world systems
    this.traffic.update(dt, p.inCar, p.pos());
    this.peds.update(dt, this.danger);
    this.danger = null;
    const busted = this.police.update(dt, p, this.audio);
    const combatResult = this.combat.update(dt, p, this.police, this.audio);
    if (combatResult === 'wasted') { this.endGame('wasted'); return; }
    this.missions.update(dt, p, this.police, this.audio);

    // health / bust / wasted
    if (p.health <= 0) { this.endGame('wasted'); return; }
    if (busted) { this.endGame('busted'); return; }
    if (this.missions.repoCar && this.player.inCar === this.missions.repoCar && this.missions.repoCar.health <= 0) {
      this.missions.failMission('You wrecked the repo car.');
    }

    // camera: third person behind the subject
    const pos = p.pos();
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const dist = p.inCar ? 8.5 : 6;
    const height = p.inCar ? 3.6 : 3.0;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const tx = pos.x + fx * 6, tz = pos.z + fz * 6;
    const cx = pos.x - fx * dist, cz = pos.z - fz * dist;
    this.camera.position.set(lerp(this.camera.position.x, cx, Math.min(1, dt * 6)), lerp(this.camera.position.y, height, Math.min(1, dt * 6)), lerp(this.camera.position.z, cz, Math.min(1, dt * 6)));
    this.camera.lookAt(tx, 1.6, tz);

    // HUD
    this.hud.setCash(this.cash);
    this.hud.setRespect(this.respect);
    this.hud.setCoins(this.missions.coinCount);
    this.hud.setStars(this.police.wanted);
    this.hud.setClock(this.timeOfDay);
    this.hud.setHealth(p.health / 100);
    this.hud.setSpeed(p.speedKmh(), !!p.inCar);
    this.hud.setCrosshair(!p.inCar);
    const blips = [];
    const mt = this.missions.targetPos();
    if (mt) blips.push({ x: mt.x, z: mt.z, color: '#ffd75e', size: 8 });
    const tt = this.missions.taxiTarget();
    if (tt) blips.push({ x: tt.x, z: tt.z, color: '#4ec9c2', size: 7 });
    for (const c of this.police.cars) blips.push({ x: c.x, z: c.z, color: '#ff4040', size: 5 });
    if (this.police.heli) blips.push({ x: this.police.heli.mesh.position.x, z: this.police.heli.mesh.position.z, color: '#ff4040', size: 7 });
    for (const c of this.traffic.cars.slice(0, 8)) blips.push({ x: c.x, z: c.z, color: '#ffffff', size: 3 });
    this.hud.drawMinimap(pos.x, pos.z, heading, blips);

    this.renderer.render(this.scene, this.camera);
  }
}

window.__solmar = new Game();
