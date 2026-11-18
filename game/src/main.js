// Solmar City — the entry point: renderer, scene assembly, input, and the
// game loop. Everything else is a module with one job; this file wires them
// together and keeps the frame budget honest.
import * as THREE from 'three';
import { clamp, rand } from './util.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { Car, createTraffic, createParkedCars, separateCars, nearestCar } from './vehicles.js';
import { Player } from './player.js';
import { createPedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave, applySave, autosave, saveSummary } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

// ---- Renderer: the AAA look lives here ------------------------------------
// ACES filmic tone mapping, sRGB output, soft shadows, a capped pixel ratio
// so SwiftShader and modest laptops still hold a frame rate.
// Adaptive quality: detect a software rasterizer (SwiftShader / llvmpipe, as
// in a headless test run) BEFORE creating the renderer, because MSAA in
// software is so slow the compositor can only present a few frames a second.
// Software GL gets no MSAA, a 1x pixel ratio and 1024 shadows; real GPUs
// keep MSAA, 1.75x and 2048 shadows.
function detectSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const ren = dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    const r = /swiftshader|llvmpipe|software/i.test(String(ren || ''));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch { return false; }
}
const softwareGL = detectSoftwareGL();
const renderer = new THREE.WebGLRenderer({ antialias: !softwareGL, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, softwareGL ? 1 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe3f0');
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(-16, 6, 16);

// ---- World -----------------------------------------------------------------
const city = buildCity(scene);
if (softwareGL) {
  city.sun.shadow.mapSize.set(1024, 1024);
  city.sun.shadow.camera.left = -130;
  city.sun.shadow.camera.right = 130;
  city.sun.shadow.camera.top = 130;
  city.sun.shadow.camera.bottom = -130;
  city.sun.shadow.camera.updateProjectionMatrix();
}
const audio = createAudio();
const player = new Player(scene, city);
const traffic = createTraffic(scene, city, 16);
const parkedCars = createParkedCars(scene, city, 14);
const peds = createPedestrians(scene, city, 26);
const police = new Police(scene, city);

const g = {
  scene, camera, renderer, city, audio, player, traffic, parkedCars, peds, police,
  missions: null, hud: null, combat: null,
  started: false, paused: false, fps: 0, errors: [],
  shotThreat: null, lastMissionIdx: 0,
};
g.hud = new HUD(g);
g.missions = new Missions(scene, city, g);
g.combat = new Combat(scene, camera, g);

police.onBusted = () => {
  const fine = Math.round(g.missions.cash * 0.15);
  g.missions.cash = Math.max(0, g.missions.cash - fine);
  audio.bust();
  g.hud.message(`BUSTED! The cops took $${fine.toLocaleString()}. You wake up at the hideout.`);
  police.clear();
  player.respawn(-8, 8, Math.PI * 0.75);
  g.hud.refresh();
  saveGame(g);
};
police.onShot = (dmg) => {
  if (player.damage(dmg)) onDeath();
  else g.hud.flashDamage();
};
function onDeath() {
  const lost = Math.round(g.missions.cash * 0.1);
  g.missions.cash = Math.max(0, g.missions.cash - lost);
  g.hud.message(`WASTED! You lost $${lost.toLocaleString()} and wake up at the hideout.`);
  audio.fail();
  police.clear();
  player.respawn(-8, 8, Math.PI * 0.75);
  g.hud.refresh();
  saveGame(g);
}

// ---- Input -----------------------------------------------------------------
const keys = {};
let mouseDown = null;
let dragging = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Escape') {
    if (g.started) {
      g.paused = !g.paused;
      g.hud.showPause(g.paused);
      audio.setEngine(0, false);
    }
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    g.hud.message(muted ? 'Sound muted (M to unmute).' : 'Sound on.');
  }
  if (e.code === 'KeyE' && g.started && !g.paused) {
    if (player.onFoot) {
      const car = nearestCar([...parkedCars, ...traffic, ...police.cars], player.pos.x, player.pos.z, 4.2);
      if (car) {
        if (car.parked || traffic.includes(car)) {
          // Stealing a car is a crime: the heat comes.
          police.addWanted(1);
          g.hud.message(car.parked ? 'You took the car. Wanted +1.' : 'You yanked the driver out. Wanted +1.');
        }
        if (car.marked) g.hud.message('That\'s the marked car. Go!');
        audio.engineStart();
        player.enterCar(car);
      }
    } else {
      player.exitCar();
    }
  }
  if (e.code === 'KeyR' && g.started && !g.paused && player.car) {
    player.car.speed = 0;
    player.car.pos.y = 0;
    g.hud.message('Car reset.');
  }
  if (e.code === 'KeyT' && g.started && !g.paused) {
    if (!g.missions.startTaxi()) g.hud.message('Taxi needs a car and a rider on the street.');
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', (e) => {
  mouseDown = { x: e.clientX, y: e.clientY };
  dragging = false;
});
addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  const dx = e.clientX - mouseDown.x;
  const dy = e.clientY - mouseDown.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragging = true;
  if (dragging && g.started && !g.paused) {
    player.camYaw -= dx * 0.004;
    player.camPitch = clamp(player.camPitch + dy * 0.002, -0.1, 0.7);
    mouseDown = { x: e.clientX, y: e.clientY };
  }
});
addEventListener('mouseup', (e) => {
  if (mouseDown && !dragging && g.started && !g.paused) {
    if (g.combat.shoot()) g.shotThreat = { x: player.pos.x, z: player.pos.z, t: 0 };
  }
  mouseDown = null;
  dragging = false;
});
addEventListener('error', (e) => g.errors.push(String(e.message || e.error)));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Start / continue --------------------------------------------------------
function startGame(useSave) {
  audio.unlock();
  audio.startMusic();
  if (useSave) {
    const data = loadGame();
    if (data) applySave(g, data);
  }
  g.started = true;
  g.paused = false;
  g.hud.hideStart();
  g.hud.message('Welcome to Solmar City. Mari Voss is waiting — follow the yellow marker.');
}
document.getElementById('btn-start').addEventListener('click', () => { audio.click(); startGame(false); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.click(); startGame(true); });
document.getElementById('btn-resume').addEventListener('click', () => {
  g.paused = false;
  g.hud.showPause(false);
});
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame(g);
  g.paused = false;
  g.started = false;
  g.hud.showPause(false);
  g.hud.showStart(hasSave());
});
const summary = saveSummary();
if (summary) document.getElementById('btn-continue').textContent = summary;
g.hud.showStart(hasSave());

// ---- Debug / test handle -----------------------------------------------------
// window.SOLMAR lets an automated play-test drive the live game: teleport,
// set the wanted level, jump between missions, and read the whole state back.
// It changes nothing about how a human plays.
window.SOLMAR = {
  g,
  version: 2,
  teleport(x, z) { player.respawn(x, z, player.heading); },
  giveCar(type = 'sedan', color = 0xc8102e) {
    const car = new Car(scene, { color, type, x: player.pos.x + 3, z: player.pos.z, heading: player.heading });
    parkedCars.push(car);
    player.enterCar(car);
    return car;
  },
  setWanted(n) { police.setWanted(n); },
  setHour(h) { city.setHour(h); },
  setMission(i, stage = 0) { g.missions.setMission(i, stage); },
  state() {
    return {
      started: g.started, paused: g.paused, fps: g.fps,
      cash: Math.round(g.missions.cash), respect: g.missions.respect,
      coins: g.missions.coinsGot, mission: g.missions.index, stage: g.missions.stage,
      done: g.missions.done, wanted: police.wanted, policeCars: police.cars.length,
      heli: !!police.heli, health: Math.round(player.health),
      onFoot: player.onFoot, pos: { x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1) },
      speed: +(player.onFoot ? player.speed : Math.abs(player.car ? player.car.speed : 0)).toFixed(1),
      hour: +city.hour.toFixed(2), traffic: traffic.length, peds: peds.length,
      errors: g.errors.slice(-5),
    };
  },
};

// ---- Game loop ---------------------------------------------------------------
// The per-frame update is factored out of frame() so an automated play-test
// can step the simulation deterministically (window.SOLMAR.step) instead of
// waiting on the display's refresh rate. The game itself always runs on
// requestAnimationFrame.
const clock = new THREE.Clock();
let frames = 0;
let fpsT = 0;
let gullT = 12;

function update(dt) {
  const night = city.update(dt, player.pos);
  const nightF = night.nightF;
  if (g.started && !g.paused) {
    // Player: on foot or driving.
    if (player.onFoot) {
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      player.updateOnFoot({ f, s, sprint: !!keys.ShiftLeft || !!keys.ShiftRight }, dt);
      audio.setEngine(0, false);
    } else {
      const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
      player.car.drive({ throttle, steer, handbrake: !!keys.Space }, dt, city, () => {
        player.shake = Math.min(player.shake + 0.5, 1);
        audio.crash(0.8);
      });
      player.pos.copy(player.car.pos);
      player.heading = player.car.heading;
      audio.setEngine(Math.abs(player.car.speed) / player.car.topSpeed, true);
    }
    // Traffic, pedestrians, police, missions, combat.
    const playerCar = player.onFoot ? null : player.car;
    for (const t of traffic) t.update(dt, traffic, playerCar);
    separateCars([...traffic, ...parkedCars, ...police.cars, ...(playerCar ? [playerCar] : [])]);
    const threats = [];
    if (g.shotThreat) {
      g.shotThreat.t += dt;
      if (g.shotThreat.t < 1.2) threats.push({ x: g.shotThreat.x, z: g.shotThreat.z, radius: 26 });
      else g.shotThreat = null;
    }
    if (playerCar && Math.abs(playerCar.speed) > 12) threats.push({ x: player.pos.x, z: player.pos.z, radius: 8 });
    for (const p of peds) p.update(dt, threats);
    police.update(dt, player, traffic);
    g.missions.update(dt);
    g.combat.update(dt);
    // Headlight state for every car, once per frame.
    for (const c of [...traffic, ...parkedCars, ...police.cars]) c.setLights(nightF);
    if (playerCar) playerCar.setLights(nightF);
    audio.setSiren(police.wanted > 0);
    // Ambience: gulls over the bay now and then.
    gullT -= dt;
    if (gullT <= 0) {
      gullT = rand(14, 30);
      if (player.pos.x < -60) audio.gull();
    }
    // Mission progress autosaves itself.
    if (g.missions.index !== g.lastMissionIdx) {
      g.lastMissionIdx = g.missions.index;
      saveGame(g);
    }
    autosave(g, performance.now());
    player.heal(dt * 1.2);
  }
  player.updateCamera(camera, dt, nightF);
  g.hud.setClock(city.hour);
  g.hud.setVignette(nightF);
  if (frames % 2 === 0) g.hud.drawMinimap();
  if (g.started) g.hud.refresh();
  return nightF;
}

function frame() {
  requestAnimationFrame(frame);
  g.framesTotal = (g.framesTotal || 0) + 1;
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;
  fpsT += dt;
  if (fpsT >= 1) { g.fps = frames; frames = 0; fpsT = 0; }
  update(dt);
  renderer.render(scene, camera);
}

// Deterministic single step for automated play-tests: advance the simulation
// by dt seconds and render once, without waiting on the display. Pass
// doRender=false to advance the simulation without rendering (much faster in
// a software rasterizer); the logic is identical either way.
window.SOLMAR.step = (dt = 0.05, doRender = true) => {
  frames++;
  g.framesTotal = (g.framesTotal || 0) + 1;
  update(dt);
  if (doRender) renderer.render(scene, camera);
  return g.framesTotal;
};

// Screenshot staging: ?shot=chase|drive|foot|mission — start the game, stage
// the scene, and let it settle for a couple of seconds before the shot.
if (shotName) {
  startGame(false);
  stageShot(g, shotName);
  window.__shotReady = false;
  setTimeout(() => { window.__shotReady = true; }, 2500);
} else {
  window.__shotReady = true;
}
frame();
