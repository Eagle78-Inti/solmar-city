// Solmar City v4 — boot, game loop, input, camera and the debug hooks the
// play-test drives. One open world, five missions, all original.
import * as THREE from 'three';
import { clamp, lerp, angleLerp, rand, pick } from './util.js';
import { createCity, ROADS_X, ROADS_Z, HIDEOUT } from './city.js';
import { createTraffic, createPlayerCar, createParkedCars, setBeams } from './vehicles.js';
import { createPlayer, teleportPlayer } from './player.js';
import { createPeds, nearestAlivePed } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions, createTaxi } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { SoundEngine } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const G = {
  state: 'menu', inCar: false, cash: 250, respect: 0, coins: 0, health: 100,
  wanted: 0, hours: 13.5, elapsed: 0, camYaw: 0, shake: 0, nightF: 0, started: false,
};
G.audio = new SoundEngine();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x79aede);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-100, 30, 60);
G.scene = scene;
G.camera = camera;
G.renderer = renderer;
G.city = createCity(scene);
G.traffic = createTraffic(scene);
G.car = createPlayerCar(scene);
G.parked = createParkedCars(scene);
G.player = createPlayer(scene);
G.peds = createPeds(scene);
G.police = createPolice(scene, {
  audio: G.audio,
  playerPos: () => G.playerPos(),
  onRam: (dx, dz, push) => {
    if (G.inCar) {
      G.car.pos.x += dx * push;
      G.car.pos.z += dz * push;
      G.car.speed *= 0.85;
      G.shake = 0.5;
    }
  },
  onBusted: () => G.busted(),
});
G.missions = createMissions(G);
G.taxi = createTaxi(G);
G.combat = createCombat(G);
G.hud = createHud(G);
G.keys = {};
G.playerPos = () => (G.inCar ? { x: G.car.pos.x, z: G.car.pos.z } : { x: G.player.pos.x, z: G.player.pos.z });
G.heading = () => (G.inCar ? G.car.heading : G.player.heading);
G.speed = () => (G.inCar ? G.car.speed : G.player.speed);
G.setWanted = (n) => { G.police.setWanted(n); G.wanted = G.police.wanted; };
G.addWanted = (n) => G.setWanted(G.wanted + n);
G.addCash = (n) => { G.cash += n; };
G.addRespect = (n) => { G.respect += n; };
G.setTime = (h) => { G.hours = h; };
G.toast = (m) => G.hud.toast(m);
G.banner = (t, s) => G.hud.banner(t, s);
G.save = () => saveGame({ cash: G.cash, respect: G.respect, coins: G.coins, missionIndex: G.missions.index, hours: G.hours, health: G.health });
G.damage = (n) => {
  G.health = Math.max(0, G.health - n);
  if (G.health <= 0) {
    G.health = 100;
    G.cash = Math.max(0, G.cash - 100);
    G.setWanted(0);
    G.teleportPlayer(HIDEOUT.x, HIDEOUT.z, 0);
    G.hud.showBusted('WASTED', 'You woke up at the hideout — $100 gone.');
    G.state = 'busted';
  }
};
G.busted = () => {
  G.cash = Math.max(0, G.cash - 150);
  G.setWanted(0);
  G.health = 100;
  G.teleportPlayer(HIDEOUT.x, HIDEOUT.z, 0);
  G.hud.showBusted('BUSTED', 'The cops took you in — $150 gone. Click to walk free.');
  G.state = 'busted';
};
G.teleportCar = (x, z, h) => {
  G.car.pos.set(x, 0, z);
  G.car.heading = h;
  G.car.speed = 0;
  G.car.group.position.set(x, 0, z);
  G.car.group.rotation.y = h;
  G.inCar = true;
  G.player.group.visible = false;
  G.camYaw = h;
};
G.teleportPlayer = (x, z, h) => {
  teleportPlayer(G.player, x, z, h);
  G.inCar = false;
  G.player.group.visible = true;
  G.camYaw = h;
};
G.exitCar = () => {
  if (!G.inCar) return;
  const fx = -Math.sin(G.car.heading), fz = -Math.cos(G.car.heading);
  G.teleportPlayer(G.car.pos.x + fz * 2.4, G.car.pos.z - fx * 2.4, G.car.heading);
};
G.enterCar = () => {
  if (G.state !== 'playing') return;
  if (G.inCar) { G.exitCar(); return; }
  const p = G.player.pos;
  const spot = G.parked.nearest(p.x, p.z, 5);
  if (!spot) { G.toast('No car close enough — walk up to one and press E.'); return; }
  spot.taken = true;
  spot.group.visible = false;
  G.car.group.userData.paint.color.set(spot.color);
  G.teleportCar(spot.x, spot.z, spot.heading);
  G.audio.click();
  if (!spot.taxi) {
    G.addWanted(1);
    G.toast('You stole a car — the cops are coming.');
  } else {
    G.toast('Taxi taken — press T for a fare.');
  }
};

// Coins scattered around the city: 20 gold coins, +$50 each.
const coinGeo = new THREE.TorusGeometry(0.55, 0.2, 10, 18);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.8, roughness: 0.25, emissive: 0xaa7700, emissiveIntensity: 0.4 });
G.coinList = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(coinGeo, coinMat);
  const onX = Math.random() < 0.5;
  const road = pick(onX ? ROADS_Z : ROADS_X);
  const coord = rand(-130, 130);
  m.position.set(onX ? coord : road + 8, 1.0, onX ? road + 8 : coord);
  scene.add(m);
  G.coinList.push({ mesh: m, taken: false });
}

window.addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'Escape' && G.state === 'playing') { G.state = 'paused'; G.hud.showPause(); }
  else if (e.code === 'Escape' && G.state === 'paused') { G.state = 'playing'; G.hud.hidePause(); }
  if (e.code === 'KeyE' && G.state === 'playing') G.enterCar();
  if (e.code === 'KeyT' && G.state === 'playing' && !G.inCar) G.taxi.start();
  if (e.code === 'KeyR' && G.state === 'playing' && G.inCar) G.car.reset();
  if (e.code === 'KeyM') G.audio.setMuted(!G.audio.muted);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', () => {
  if (G.state === 'playing' && !G.inCar) G.combat.shoot();
});
document.getElementById('play-button').addEventListener('click', startGame);
document.getElementById('busted-button').addEventListener('click', () => {
  G.hud.hideBusted();
  if (G.state === 'busted') G.state = 'playing';
});

function startGame() {
  if (G.started) { G.hud.hideStart(); G.state = 'playing'; return; }
  G.started = true;
  G.audio.ensure();
  G.audio.musicStart();
  const saved = loadGame();
  if (saved) {
    G.cash = saved.cash; G.respect = saved.respect; G.coins = saved.coins || 0;
    G.hours = saved.hours || 13.5;
    if ((saved.missionIndex || 0) >= 5) {
      G.missions.index = 5; G.missions.done = true;
    } else {
      G.missions.start(Math.min(saved.missionIndex || 0, 4));
    }
    for (let i = 0; i < Math.min(G.coins, 20); i++) {
      G.coinList[i].mesh.visible = false;
      G.coinList[i].taken = true;
    }
    G.toast('Welcome back, Rook. Save loaded.');
  } else {
    G.missions.start(0);
  }
  G.hud.hideStart();
  G.state = 'playing';
}

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(-100, 30, 60);
function updateCamera(dt) {
  const p = G.playerPos();
  const heading = G.heading();
  if (G.state === 'menu') {
    const a = G.elapsed * 0.05;
    camera.position.set(Math.cos(a) * 180, 70, Math.sin(a) * 180);
    camera.lookAt(0, 10, 0);
    return;
  }
  const targetYaw = G.inCar ? heading : (G.player.speed > 0.5 ? heading : G.camYaw);
  G.camYaw = angleLerp(G.camYaw, targetYaw, clamp(dt * 3, 0, 1));
  const dist = G.inCar ? 12 : 8.5;
  const height = G.inCar ? 4.4 : 3.6;
  const fx = -Math.sin(G.camYaw), fz = -Math.cos(G.camYaw);
  const tx = p.x - fx * dist, tz = p.z - fz * dist;
  camPos.x = lerp(camPos.x, tx, clamp(dt * 5, 0, 1));
  camPos.y = lerp(camPos.y, height, clamp(dt * 5, 0, 1));
  camPos.z = lerp(camPos.z, tz, clamp(dt * 5, 0, 1));
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt);
    camPos.x += rand(-1, 1) * G.shake * 0.4;
    camPos.y += rand(-1, 1) * G.shake * 0.3;
  }
  camera.position.copy(camPos);
  camTarget.set(p.x + fx * 8, 1.4 + (G.camLift || 0), p.z + fz * 8);
  camera.lookAt(camTarget);
}

const clock = new THREE.Clock();
let firstFrame = true;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.elapsed += dt;
  if (G.state === 'playing') {
    G.hours = (G.hours + dt / 30) % 24;
    const sky = G.city.update(dt, G.hours);
    G.nightF = sky.nightF;
    G.traffic.update(dt);
    if (G.inCar) G.car.update(dt, G.keys, G.nightF);
    else G.player.update(dt, G.keys, G.camYaw);
    G.peds.update(dt);
    G.police.update(dt, G.elapsed);
    G.missions.update(dt);
    G.taxi.update(dt);
    G.combat.update(dt);
    for (const c of G.coinList) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      const p = G.playerPos();
      if (Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 2.2) {
        c.taken = true; c.mesh.visible = false;
        G.coins++; G.addCash(50); G.audio.coin();
      }
    }
    G.audio.engineSet(G.inCar, Math.abs(G.car.speed) / 40);
  } else if (G.state === 'menu') {
    G.city.update(dt, G.hours);
    G.traffic.update(dt);
    G.peds.update(dt);
  }
  updateCamera(dt);
  G.hud.update(dt);
  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; window.__ready = true; }
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__solmar = {
  G,
  start: startGame,
  getState: () => ({
    cash: G.cash, respect: G.respect, coins: G.coins,
    missionIndex: G.missions.index, missionStep: G.missions.step,
    wanted: G.wanted, health: G.health, inCar: G.inCar,
    speed: Math.abs(G.speed()), x: G.playerPos().x, z: G.playerPos().z,
    pedsAlive: G.peds.aliveCount(), police: G.police.cars.length,
    heli: !!G.police.heli, state: G.state, hours: G.hours,
  }),
  teleport: (x, z) => G.teleportPlayer(x, z, 0),
  teleportCar: (x, z, h = 0) => G.teleportCar(x, z, h),
  setTime: (h) => G.setTime(h),
  setWanted: (n) => G.setWanted(n),
  shootAt: (x, y, z) => G.combat.shootAt(x, y, z),
  startTaxi: () => G.taxi.start(),
  save: () => G.save(),
  aimAtPed: () => {
    const n = nearestAlivePed(G.peds, G.playerPos().x, G.playerPos().z);
    return n;
  },
};
if (params.has('shot')) {
  startGame();
  stageShot(G, params.get('shot'));
} else if (params.has('playtest')) {
  startGame();
}
animate();
