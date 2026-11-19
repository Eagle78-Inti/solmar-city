// Solmar City — the game itself: bootstrap, input, camera, the main loop,
// and the wiring that holds every system together.

import * as THREE from 'three';
import { clamp, lerp, wrapHours, turnToward } from './util.js';
import { buildCity, DAY_LENGTH } from './city.js';
import { createPlayerCar, createTraffic, createParkedCars } from './vehicles.js';
import { createPlayer, placeOnFoot } from './player.js';
import { createPolice } from './police.js';
import { createPedestrians, scatterNear } from './pedestrians.js';
import { createMissions, createTaxi, createCoins, createPierRace } from './missions.js';
import { createCombat, inFirefight } from './combat.js';
import { createHud, showSaveLine } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, saveSummary } from './save.js';
import { initShots } from './shots.js';

const G = {
  cash: 250, respect: 0, coins: 0, wanted: 0, health: 100,
  hours: 10.0, missionIndex: 0, missionDone: false,
  autoDrive: false, objectiveOverride: '', shot: null,
  started: false, paused: false,
};

// --- renderer, scene, camera ---
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9ee);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);

// --- world ---
const city = buildCity(THREE, scene);
const playerCar = createPlayerCar(THREE, scene, city);
const traffic = createTraffic(THREE, scene, city, 16);
const parked = createParkedCars(THREE, scene, city, 10);
const player = createPlayer(THREE, scene, city);
const police = createPolice(THREE, scene, city);
const peds = createPedestrians(THREE, scene, city, 26);
const hud = createHud(document);
const audio = createAudio();

function playerPos() {
  if (player.state.onFoot) return { x: player.state.x, z: player.state.z };
  return { x: playerCar.state.x, z: playerCar.state.z };
}
function playerSpeed() {
  return player.state.onFoot ? player.state.speed : Math.abs(playerCar.state.speed);
}
function playerHeading() {
  return player.state.onFoot ? player.state.heading : playerCar.state.heading;
}

function addWanted(n) {
  police.setWanted(police.state.wanted + n, playerPos());
  G.wanted = police.state.wanted;
  audio.siren(G.wanted > 0);
}
function coolWanted(n) {
  police.setWanted(Math.max(0, police.state.wanted - n), playerPos());
  G.wanted = police.state.wanted;
  if (G.wanted === 0) audio.siren(false);
}

const missions = createMissions(G, {
  onStep: (text) => hud.toast(text),
  onComplete: () => { audio.missionDone(); saveNow(); },
  onTwist: () => { hud.banner("IT'S A SETUP", 'Mari tipped the cops — run!'); },
  setWanted: (n) => addWanted(n - police.state.wanted),
  coolWanted,
  banner: (t, s) => hud.banner(t, s),
});
const taxi = createTaxi(G, city, {
  toast: (m) => hud.toast(m),
  banner: (t, s) => hud.banner(t, s),
  onFare: () => audio.coin(),
});
const coins = createCoins(THREE, scene, city);
const pierRace = createPierRace(G, {
  toast: (m) => hud.toast(m),
  banner: (t, s) => hud.banner(t, s),
});
const combat = createCombat(THREE, scene, G, {
  onShot: () => audio.shot(),
  onHitPed: () => {},
  onPlayerHit: () => {},
  onDeath: () => onBusted('You got dropped. The crew drags you to the hideout.'),
  addWanted,
});

function onBusted(msg) {
  G.cash = Math.max(0, G.cash - 200);
  G.wanted = 0;
  police.setWanted(0, playerPos());
  police.clearBusted();
  audio.siren(false);
  audio.busted();
  G.health = 100;
  placeOnFoot(player, -222, 222, 0);
  hud.banner('BUSTED', msg + '  −$200');
  saveNow();
}

function saveNow() {
  const pos = playerPos();
  return saveGame(G, { px: pos.x, pz: pos.z, heading: playerHeading() });
}

// --- input ---
const keys = {};
const input = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
function refreshInput() {
  input.up = !!(keys.KeyW || keys.ArrowUp) || G.autoDrive;
  input.down = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.sprint = !!keys.ShiftLeft || !!keys.ShiftRight;
  input.handbrake = !!keys.Space;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  refreshInput();
  if (!G.started || G.paused) return;
  if (e.code === 'KeyE') {
    const r = player.tryEnterCar(parked, playerCar, addWanted);
    if (r === 'stole') hud.toast('Car stolen — the cops are on their way');
    else if (r === 'entered') hud.toast('Back behind the wheel');
    else if (r === 'exited') hud.toast('On foot');
  }
  if (e.code === 'KeyM') missions.start();
  if (e.code === 'KeyT') taxi.toggle(playerPos());
  if (e.code === 'KeyR' && !player.state.onFoot) playerCar.reset();
  if (e.code === 'KeyF' || e.code === 'KeyC') firePistol();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  refreshInput();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && G.started) {
    setPaused(!G.paused);
  }
});
window.addEventListener('mousedown', (e) => {
  if (!G.started || G.paused || e.target.closest('button')) return;
  firePistol();
});
let mouseDown = false;
let mouseX = 0;
window.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  camYawOffset += (e.clientX - mouseX) * 0.004;
  mouseX = e.clientX;
});
window.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; });
window.addEventListener('mouseup', () => { mouseDown = false; });

function firePistol() {
  const pos = playerPos();
  combat.shoot(pos, camHeading, peds, police.cars);
  threats.push({ x: pos.x + Math.sin(camHeading) * 10, z: pos.z + Math.cos(camHeading) * 10, ttl: 2 });
}

// --- camera ---
let camHeading = 0;
let camYawOffset = 0;
let camMode = 'chase';
let shake = 0;
let prevSpeed = 0;
function updateCamera(dt) {
  const pos = playerPos();
  const targetHeading = playerHeading();
  camHeading = turnToward(camHeading, targetHeading + camYawOffset, 3.2 * dt);
  camYawOffset = lerp(camYawOffset, 0, dt * 0.4);
  const dist = camMode === 'high' ? 14 : camMode === 'foot' ? 8.5 : 11.5;
  const height = camMode === 'high' ? 7 : camMode === 'foot' ? 3.2 : 4.6;
  const bx = pos.x - Math.sin(camHeading) * dist;
  const bz = pos.z - Math.cos(camHeading) * dist;
  const lookX = pos.x + Math.sin(camHeading) * 7;
  const lookZ = pos.z + Math.cos(camHeading) * 7;
  const lookY = camMode === 'high' ? 5 : 1.6; // high mode tilts up so the heli is in frame
  const sp = playerSpeed();
  if (prevSpeed - sp > 9) shake = 0.35;
  prevSpeed = sp;
  shake = Math.max(0, shake - dt * 1.4);
  const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shY = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
  camera.position.set(bx + shX, height + shY, bz);
  camera.lookAt(lookX, lookY, lookZ);
}

// --- day / night ---
let nightMode = false;
function updateDayNight() {
  const night = G.hours < 6 || G.hours >= 17.5;
  if (night !== nightMode) {
    nightMode = night;
    playerCar.setNight(night);
    traffic.setNight(night);
    parked.setNight(night);
    police.setNight(night);
  }
}

// --- game flow ---
const threats = [];
function setPaused(v) {
  G.paused = v;
  hud.showPause(v);
  audio.pad(!v && G.started);
  if (v) saveNow();
}
function startGame(fromSave) {
  audio.unlock();
  audio.pad(true);
  if (fromSave) {
    const data = loadGame();
    if (data) {
      G.cash = data.cash;
      G.respect = data.respect;
      G.coins = data.coins;
      G.missionIndex = data.missionIndex;
      G.missionDone = !!data.missionDone;
      G.hours = data.hours;
      G.health = data.health;
      placeOnFoot(player, data.px, data.pz, data.heading);
      // the mission system owns the story state — restore it too, or the
      // per-frame sync back to G would clobber the loaded mission index
      missions.state.index = data.missionIndex;
      missions.state.done = !!data.missionDone;
      missions.state.active = false;
      missions.state.waypoint = null;
      hud.toast('Save loaded — welcome back to Solmar');
    }
  }
  G.started = true;
  hud.hideStart();
  hud.toast('Welcome to Solmar City — press M for your first job');
}
hud.onStart(() => startGame(false));
hud.onContinue(() => startGame(true));
hud.onResume(() => setPaused(false));
hud.onSave(() => { saveNow(); hud.toast('Game saved'); });

// --- the loop ---
const clock = new THREE.Clock();
let hudTick = 0;
let wantedDecay = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.started || G.paused) {
    renderer.render(scene, camera);
    return;
  }
  G.hours = wrapHours(G.hours + (dt * 24) / DAY_LENGTH);
  city.update(dt, G.hours);
  updateDayNight();
  const pos = playerPos();
  // threats decay
  for (let i = threats.length - 1; i >= 0; i--) {
    threats[i].ttl -= dt;
    if (threats[i].ttl <= 0) threats.splice(i, 1);
  }
  if (player.state.onFoot) player.update(dt, input, camHeading, city);
  else playerCar.update(dt, input, traffic.cars);
  traffic.update(dt, playerPos());
  peds.update(dt, threats);
  police.update(dt, playerPos(), playerSpeed(), () => onBusted('Busted. The crew drags you to the hideout.'));
  G.wanted = police.state.wanted;
  if (G.wanted > 0) {
    wantedDecay += dt;
    if (wantedDecay > 45) {
      wantedDecay = 0;
      coolWanted(1);
    }
  } else wantedDecay = 0;
  missions.update(playerPos());
  // keep the HUD's mission counter in step with the mission system
  G.missionIndex = missions.state.index;
  G.missionDone = missions.state.done;
  taxi.update(playerPos());
  coins.update(dt, playerPos(), (n) => {
    G.coins++;
    G.cash += n;
    audio.coin();
    hud.toast('Solmar coin +$' + n);
  });
  pierRace.update(playerPos());
  combat.update(dt, playerPos(), police.cars);
  audio.engine(!player.state.onFoot, Math.abs(playerCar.state.speed) / 40);
  updateCamera(dt);
  hudTick += dt;
  if (hudTick > 0.12) {
    hudTick = 0;
    hud.update(G, {
      objective: G.objectiveOverride || missions.objectiveText(),
      speed: playerCar.state.speed,
      onFoot: player.state.onFoot,
      px: pos.x, pz: pos.z, heading: playerHeading(),
      waypoint: missions.state.waypoint || taxi.state.waypoint || pierRace.state.waypoint,
      taxiWaypoint: taxi.state.waypoint,
      police: police.cars.map((c) => ({ x: c.x, z: c.z })),
      firefight: inFirefight(G, police.cars, pos),
    });
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot ---
const params = new URLSearchParams(window.location.search);
const api = {
  G, player, playerCar, police, peds, traffic, missions, taxi, parked, hud,
  setTime: (h) => { G.hours = h; },
  setCameraMode: (m) => { camMode = m; },
  playerPos,
  startGame, setPaused, saveNow,
  pedsScatter: (x, z, n) => scatterNear(peds, x, z, n),
};
initShots(api);
if (params.get('shot') || params.get('autostart')) {
  startGame(false);
  hud.hideStart();
} else {
  const data = hasSave() ? loadGame() : null;
  hud.showStart(!!data);
  if (data) showSaveLine(document, saveSummary(data));
}
animate();
