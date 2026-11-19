// Solmar City v7 — entrypoint: boots the renderer, builds the city,
// wires every system together and runs the game loop.
import * as THREE from 'three';
import { clamp, rand } from './util.js';
import { buildCity, updateCity } from './city.js';
import { makeRook, updatePlayer, tryEnterCar, setWanted } from './player.js';
import { spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice, clearPolice } from './police.js';
import { shoot, updateCombat } from './combat.js';
import { initMissions, updateMissions, startTaxi, checkPierSprint, currentMission, debugSetMission } from './missions.js';
import { initHUD, updateHUD } from './hud.js';
import { audio } from './audio.js';
import { saveGame, loadGame, applySave, saveLabel } from './save.js';
import { applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 5, -12);

const G = {
  scene, camera, renderer,
  hours: 15.5, elapsed: 0, nightF: 0, dayF: 1,
  keys: {}, camAngle: 0, shake: 0,
  wanted: 0, wantedTimer: 0,
  traffic: [], parked: [], peds: [], police: [], heli: null, coins: [],
  flashes: [], shootCooldown: 0, fireTimer: 0,
  lastShot: { x: 0, z: 0 },
  player: null, missions: null, colliders: [],
  audio, save: () => saveGame(G),
};
window.__solmar = G;

buildCity(G);
G.player = {
  mesh: makeRook(), pos: new THREE.Vector3(0, 0, 0), heading: 0,
  speed: 0, health: 100, cash: 250, respect: 0, coins: 0, car: null, walkPhase: 0,
};
G.player.mesh.position.set(0, 0, 0);
scene.add(G.player.mesh);
spawnTraffic(G);
spawnPeds(G);
initMissions(G);
initHUD(G);

// headlights for the player's car at night
const headlight = new THREE.SpotLight(0xfff2c8, 0, 55, 0.5, 0.45, 1.1);
scene.add(headlight); scene.add(headlight.target);
G.headlight = headlight;

// --- input ------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'KeyE') tryEnterCar(G);
  if (e.code === 'KeyT') startTaxi(G);
  if (e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') audio.startMusic();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !G.started || G.paused) return;
  const rect = canvas.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  const p = G.player;
  p.heading = Math.atan2(nx * 0.9 + Math.sin(p.heading) * 0.4, Math.cos(p.heading) * 0.4 - ny * 0.9);
  G.camAngle = p.heading;
  shoot(G);
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) G.camAngle -= e.movementX * 0.0022;
});
canvas.addEventListener('click', () => { if (G.started && !G.paused && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let paused = false;
function togglePause() {
  if (!G.started) return;
  paused = !paused;
  G.paused = paused;
  document.getElementById('pause').style.display = paused ? 'flex' : 'none';
  if (paused) saveGame(G);
}
document.getElementById('resumeBtn').addEventListener('click', togglePause);

// --- start / continue ---------------------------------------------------------
const saved = loadGame();
if (saved) {
  const btn = document.getElementById('continueBtn');
  btn.classList.remove('hidden');
  document.getElementById('continueLabel').textContent = saveLabel(saved);
  btn.addEventListener('click', () => { applySave(G, saved); startGame(); });
}
document.getElementById('playBtn').addEventListener('click', () => startGame());

function startGame() {
  audio.unlock();
  audio.startMusic();
  document.getElementById('start').style.display = 'none';
  G.started = true;
  G.banner('SOLMAR CITY', 'Welcome back, Rook — Mari has work for you');
}

// --- screenshot presets -------------------------------------------------------
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
if (shotName) {
  setTimeout(() => {
    applyShotPreset(G, shotName);
    startGame();
    document.getElementById('banner').style.opacity = 0;
  }, 600);
}

// --- game loop ------------------------------------------------------------------
const clock = new THREE.Clock();
let lastSave = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.started || G.paused) { renderer.render(scene, camera); return; }
  G.elapsed += dt;
  updateCity(G, dt);
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  checkPierSprint(G);
  const night = G.nightF > 0.4;
  const car = G.player.car;
  if (car && night) {
    const h = car.heading;
    headlight.position.set(car.group.position.x + Math.sin(h) * 2, 1.4, car.group.position.z + Math.cos(h) * 2);
    headlight.target.position.set(car.group.position.x + Math.sin(h) * 30, 0, car.group.position.z + Math.cos(h) * 30);
    headlight.intensity = 600;
    car.group.userData.headMat.emissiveIntensity = 1.6;
  } else {
    headlight.intensity = 0;
    if (car) car.group.userData.headMat.emissiveIntensity = 0.25;
  }
  audio.engine(car ? Math.abs(car.speed) / 42 : 0);
  updateHUD(G);
  if (G.elapsed - lastSave > 20) { lastSave = G.elapsed; saveGame(G); }
  renderer.render(scene, camera);
}
loop();

// --- debug / test hooks -----------------------------------------------------------
window.__solmar.debug = {
  state: () => ({ cash: G.player.cash, respect: G.player.respect, coins: G.player.coins, mission: G.missions.index, step: G.missions.step, done: G.missions.done, wanted: G.wanted, health: G.player.health, hours: G.hours, peds: G.peds.length, traffic: G.traffic.length, police: G.police.length, heli: !!G.heli, speed: Math.round(G.player.speed), inCar: !!G.player.car, px: G.player.pos.x, pz: G.player.pos.z, heading: G.player.heading, onFoot: !G.player.car, taxiWaypoint: G.missions.taxi ? (G.missions.taxi.picked ? { x: G.missions.taxi.dest.x, z: G.missions.taxi.dest.z } : { x: G.missions.taxi.ped.group.position.x, z: G.missions.taxi.ped.group.position.z }) : null }),
  completeMission: () => { const M = G.missions; if (M.done) return 'done'; const m = currentMission(G); G.player.cash += m.pay; G.player.respect += m.respect; M.index++; M.step = 0; if (M.index >= 5) M.done = true; saveGame(G); return 'ok'; },
  setWanted: (n) => setWanted(G, n),
  setHours: (h) => { G.hours = h; },
  teleport: (x, z) => { G.player.pos.set(x, 0, z); if (G.player.car) G.player.car.group.position.set(x, 0, z); G.player.mesh.position.copy(G.player.pos); },
  giveCar: () => { if (!G.player.car) tryEnterCar(G); return !!G.player.car; },
  startTaxi: () => { startTaxi(G); return !!G.missions.taxi; },
  shoot: () => { shoot(G); return G.peds.length; },
  setMission: (i, s) => debugSetMission(G, i, s || 0),
  applyShot: (name) => applyShotPreset(G, name),
  start: () => startGame(),
  missionStep: () => { const M = G.missions; if (M.done || M.taxi) return null; const m = currentMission(G); const s = m.steps[M.step]; return s ? { x: s.x, z: s.z, label: s.label } : null; },
  startMission: () => { return G.missions.done ? 'done' : 'active'; },
  nearestParked: () => { let best = null, bd = Infinity; for (const pk of G.parked) { if (pk.stolen) continue; const d = (pk.x - G.player.pos.x) ** 2 + (pk.z - G.player.pos.z) ** 2; if (d < bd) { bd = d; best = pk; } } return best ? { x: best.x, z: best.z } : null; },
  scatter: (x, z, n) => { let c = 0; for (const ped of G.peds) { if (c >= n) break; ped.group.position.set(x + (c % 3) * 2 - 2, 0, z + Math.floor(c / 3) * 2 - 1); ped.heading = Math.random() * Math.PI * 2; c++; } return c; },
  saveNow: () => saveGame(G),
  errors: () => G.errors || [],
};
G.errors = [];
window.addEventListener('error', (e) => { G.errors.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', (e) => { G.errors.push('rejection: ' + String(e.reason)); });
