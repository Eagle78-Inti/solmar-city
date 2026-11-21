// main.js — Solmar City entrypoint: init, game loop, input, interactions,
// camera, and the window.SOL debug API the playtest harness drives.
import * as THREE from 'three';
import { clamp, dist2d } from './util.js';
import { createState, station, trackName, districtAt, setWanted, currentMission } from './state.js';
import { createGraphics, applyTimeOfDay } from './graphics.js';
import { buildCity, missionPylon } from './city.js';
import { createCar, spawnTraffic, updateTraffic, enterNearest, syncCar, createHeli, updateHeli, createBoat, updateBoat } from './vehicles.js';
import { makePlayerMesh, spawnPeds, updatePeds, swapPlayerMesh, animateWalk } from './people.js';
import { updateOnFoot, updateDriving, exitVehicle, enterVehicle, switchCharacter, honk } from './player.js';
import { createPoliceCar, updatePolice, createSearchlight, updateSearchlight, raiseWanted, clearWanted } from './police.js';
import { startMission, updateMission, chooseEnding, debugStart, missionProgressText } from './missions.js';
import { shoot, selectWeapon, cycleWeapon, buyWeapon, buyAmmo, buyArmour, weaponAmmoText } from './combat.js';
import { buildPackages, checkPackages, buildJumps, checkJumps, startTaxi, updateTaxi, startCourier, updateCourier, startRace, updateRace } from './activities.js';
import { buildHud, updateHud, renderMap, renderStats, renderStory, showBriefing, hideBriefing, showDialogue, advanceDialogue, showEndingChoice, hideChoice, togglePause, renderWheel } from './hud.js';
import { createAudio, setMuted } from './audio.js';
import { saveGame, loadGame, applySave, hasSave, quickSaveAtSafehouse } from './save.js';
import { applyShot } from './shots.js';

const G = createState();
const canvas = document.getElementById('game');
const gfx = createGraphics(canvas);
const city = buildCity(gfx.scene, G);
const world = {
  scene: gfx.scene, gfx, city,
  traffic: [], police: [], peds: [],
  heli: null, boat: null, missionCar: null,
  playerMesh: null,
  districtAt: (x, z) => districtAt(G, x, z),
  spawnPolice(n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      world.police.push(createPoliceCar(gfx.scene, G.pos.x + Math.sin(a) * 40, G.pos.z + Math.cos(a) * 40));
    }
  },
  startMissionId(id) { return debugStart(G, world, id); },
};

// --- world population ------------------------------------------------------
world.traffic = spawnTraffic(gfx.scene, 22);
// A taxi and a sports car parked near the start for the player.
// They are parked (not traffic) so the first car is always there.
const taxi = createCar(gfx.scene, { x: 8, z: -8, color: 0xffc93a, kind: 'taxi' });
taxi.parked = true;
world.traffic.push(taxi);
const sports = createCar(gfx.scene, { x: 56, z: 30, color: 0xff5a3c, kind: 'sports' });
sports.cruise = 16;
sports.parked = true;
world.traffic.push(sports);
world.peds = spawnPeds(gfx.scene, 26);
world.playerMesh = makePlayerMesh(gfx.scene, G.character);
world.heli = createHeli(gfx.scene, -238, 60);
world.boat = createBoat(gfx.scene, -292, -20, true);
world.searchlight = createSearchlight(gfx.scene);
buildPackages(gfx.scene, G);
buildJumps(gfx.scene, G);
buildHud(G);
G.camYaw = 0;
G.camPitch = 0.32;
G.camDist = 13;

// Restore a save if one exists.
if (hasSave()) {
  const d = loadGame();
  if (d) {
    applySave(G, d);
    world.playerMesh = swapPlayerMesh(gfx.scene, world.playerMesh, G.character);
  }
}

// --- input -----------------------------------------------------------------
const input = { w: false, a: false, s: false, d: false, shift: false, space: false, keyC: false };
let mouseDown = false, lastMX = 0, lastMY = 0;
const keys = {};
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'w') input.w = true;
  if (k === 'a') input.a = true;
  if (k === 's') input.s = true;
  if (k === 'd') input.d = true;
  if (k === 'shift') input.shift = true;
  if (k === ' ') { input.space = true; e.preventDefault(); }
  if (k === 'c' && !e.repeat) input.keyC = true;
  if (e.repeat) return;
  if (k === 'e') onInteract();
  if (k === 'f') onEnterExit();
  if (k === 'm') toggleMap();
  if (k === 'escape') onEscape();
  if (k === 'v') cycleRadio();
  if (k === 'q') { G.weaponWheel = !G.weaponWheel; renderWheel(G); }
  if (k === 'r') reloadWeapon();
  if (k === 'h') honk(G);
  if (k === 't') onTaxi();
  if (k === 'y') onCourier();
  if (k === 'c' && e.shiftKey) onSwitchCharacter();
  if (k === 'f9') { const r = quickSaveAtSafehouse(G); G.saveMsg = r.ok ? 'Game saved at the safehouse' : r.reason; }
  if (['1', '2', '3', '4', '5'].includes(k)) selectWeapon(G, parseInt(k, 10));
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if (k === 'w') input.w = false;
  if (k === 'a') input.a = false;
  if (k === 's') input.s = false;
  if (k === 'd') input.d = false;
  if (k === 'shift') input.shift = false;
  if (k === ' ') input.space = false;
  if (k === 'c') input.keyC = false;
});
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true; lastMX = e.clientX; lastMY = e.clientY;
  if (e.button === 0) onShoot(e);
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  G.camYaw -= (e.clientX - lastMX) * 0.005;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastMY) * 0.003, 0.08, 1.1);
  lastMX = e.clientX; lastMY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  G.camDist = clamp(G.camDist + Math.sign(e.deltaY) * 1.5, 7, 26);
});

// --- interactions ----------------------------------------------------------
function onInteract() {
  if (G.titleOpen) { startGame(); return; }
  if (G.dialogue) { advanceDialogue(G); return; }
  if (G.briefing) { hideBriefing(G); return; }
  if (G.missionActive && currentMission(G) && currentMission(G).id === 'M8' && G.missionStage === 2) {
    showEndingChoice(G); return;
  }
  // Shop: Kelo Arms at (56,-48).
  if (dist2d(G.pos.x, G.pos.z, 56, -48) < 10) { openShop('arms'); return; }
  // Garage: Sunset Garage at (-56,130).
  if (dist2d(G.pos.x, G.pos.z, -56, 130) < 10) { openShop('garage'); return; }
  // Race start at the Neon Mile Sprint line (80,-40).
  if (dist2d(G.pos.x, G.pos.z, 80, -40) < 10) { startRace(G); G.raceMsg = 'Race started — hit all 5 checkpoints'; return; }
  // Mission start: near the current mission's start point.
  const m = currentMission(G);
  if (m && !m.done && !G.missionActive && dist2d(G.pos.x, G.pos.z, m.from[0], m.from[1]) < 12) {
    startMission(G, world);
    showBriefing(G);
    return;
  }
  // Safehouse quick save.
  if (dist2d(G.pos.x, G.pos.z, 56, 84) < 10) {
    const r = quickSaveAtSafehouse(G);
    G.saveMsg = r.ok ? 'Game saved at the safehouse' : r.reason;
    return;
  }
}
function onEnterExit() {
  if (G.titleOpen || G.paused) return;
  if (G.mode === 'foot') {
    const car = enterNearest(world.traffic, G.pos.x, G.pos.z, G.missionActive ? currentMission(G).id : null);
    if (car) enterVehicle(G, world.playerMesh, car);
  } else if (G.mode === 'car') {
    exitVehicle(G, world.playerMesh);
  } else if (G.mode === 'heli') {
    G.mode = 'foot'; world.playerMesh.group.visible = true;
    G.pos.y = 0;
  } else if (G.mode === 'boat') {
    G.mode = 'foot'; world.playerMesh.group.visible = true;
  }
}
function onEscape() {
  if (G.briefing) { hideBriefing(G); return; }
  if (G.mapOpen) { toggleMap(); return; }
  if (G.weaponWheel) { G.weaponWheel = false; renderWheel(G); return; }
  togglePause(G, !G.paused);
}
function toggleMap() {
  G.mapOpen = !G.mapOpen;
  const p = document.getElementById('map-panel');
  if (p) {
    p.style.display = G.mapOpen ? 'block' : 'none';
    if (G.mapOpen) renderMap(G, world);
  }
}
function cycleRadio() {
  G.radioIdx = (G.radioIdx + 1) % 3;
  G.trackIdx = (G.trackIdx + 1) % 4;
}
function reloadWeapon() {
  const w = G.weapons[G.activeWeapon];
  if (!w || w.ammo === Infinity || w.reserve <= 0) return;
  const need = w.slot === 3 ? 32 : w.slot === 4 ? 6 : w.slot === 5 ? 30 : 12;
  const take = Math.min(need - w.ammo, w.reserve);
  if (take > 0) { w.ammo += take; w.reserve -= take; }
}
function onTaxi() {
  if (G.mode !== 'car') { G.taxiMsg = 'Take a car first, then press T'; return; }
  if (!G.taxi) startTaxi(G);
}
function onCourier() {
  if (!G.courier) startCourier(G);
}
function onSwitchCharacter() {
  switchCharacter(G, gfx.scene, world.playerMesh);
  world.playerMesh = swapPlayerMesh(gfx.scene, world.playerMesh, G.character);
  world.playerMesh.group.position.set(G.pos.x, 0, G.pos.z);
}
function onShoot(e) {
  if (G.titleOpen || G.paused || G.mapOpen) return;
  const w = G.weapons[G.activeWeapon];
  if (!w) return;
  // Aim at the point under the cursor: use the camera ray at screen centre-ish.
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, gfx.camera);
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  const tx = ray.ray.origin.x + ray.ray.direction.x * Math.max(t, 10);
  const tz = ray.ray.origin.z + ray.ray.direction.z * Math.max(t, 10);
  const res = shoot(G, world, tx, tz);
  if (res && res.fired && res.hit) raiseWanted(G, 1);
}
function openShop(type) {
  G.shopOpen = true; G.shopType = type;
  const box = document.getElementById('shop-panel');
  if (!box) return;
  if (type === 'arms') {
    box.innerHTML = '<h2>KELO ARMS</h2>' +
      '<div class="shop-row"><span>SMG — $800</span><button data-buy="3">Buy</button></div>' +
      '<div class="shop-row"><span>12G Shotgun — $1,200</span><button data-buy="4">Buy</button></div>' +
      '<div class="shop-row"><span>AR-9 — $2,000</span><button data-buy="5">Buy</button></div>' +
      '<div class="shop-row"><span>Armour +25 — $100</span><button data-armour="1">Buy</button></div>' +
      '<div class="shop-hint">Esc to close · Cash: ' + fmtMoney(G.cash) + '</div>';
  } else {
    const owned = G.garageOwned;
    box.innerHTML = '<h2>SUNSET GARAGE</h2>' +
      (owned
        ? '<div class="shop-row"><span>Store current car</span><button data-store="1">Store</button></div>' +
          '<div class="shop-row"><span>Retrieve stored car</span><button data-retrieve="1">Retrieve</button></div>'
        : '<div class="shop-row"><span>Buy the garage — $4,000</span><button data-garage="1">Buy</button></div>') +
      '<div class="shop-hint">Esc to close · Cash: ' + fmtMoney(G.cash) + '</div>';
  }
  box.style.display = 'block';
  box.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
    if (!G.shopOpen) return;
    const ok = buyWeapon(G, parseInt(b.dataset.buy, 10));
    G.shopMsg = ok ? 'Weapon bought' : 'Not enough cash';
    openShop('arms');
  }));
  box.querySelectorAll('[data-armour]').forEach(b => b.addEventListener('click', () => {
    if (!G.shopOpen) return;
    const ok = buyArmour(G);
    G.shopMsg = ok ? 'Armour bought' : 'Not enough cash';
    openShop('arms');
  }));
  box.querySelectorAll('[data-garage]').forEach(b => b.addEventListener('click', () => {
    if (!G.shopOpen || G.cash < 4000) { G.shopMsg = 'Not enough cash'; return; }
    G.cash -= 4000; G.garageOwned = true;
    G.shopMsg = 'Garage bought — Sunset Garage is yours';
    openShop('garage');
  }));
  box.querySelectorAll('[data-store]').forEach(b => b.addEventListener('click', () => {
    if (!G.shopOpen || G.mode !== 'car' || !G.car) return;
    G.garageCar = { color: G.car.color, kind: G.car.kind };
    G.shopMsg = 'Car stored in the garage';
  }));
  box.querySelectorAll('[data-retrieve]').forEach(b => b.addEventListener('click', () => {
    if (!G.shopOpen || !G.garageCar) return;
    const car = createCar(gfx.scene, { x: -56, z: 124, color: G.garageCar.color, kind: G.garageCar.kind });
    world.traffic.push(car);
    G.shopMsg = 'Stored car is outside';
  }));
}
export function closeShop() {
  G.shopOpen = false; G.shopType = null;
  const box = document.getElementById('shop-panel');
  if (box) box.style.display = 'none';
}
function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function startGame() {
  G.titleOpen = false;
  const t = document.getElementById('title-screen');
  if (t) t.style.display = 'none';
  const m = currentMission(G);
  if (m && !G.missionActive) { startMission(G, world); showBriefing(G); }
}

// --- audio -----------------------------------------------------------------
const audio = createAudio();
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });

// --- game loop --------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0;
const audio2 = audio;
window.addEventListener('error', (e) => { G.errors.push(String(e.message || e.error)); });

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames += 1;
  if (G.paused || G.titleOpen) {
    gfx.renderer.render(gfx.scene, gfx.camera);
    return;
  }
  // Game clock: one game hour per ~50 seconds of play.
  G.time += dt * 0.02;
  if (G.time >= 24) { G.time -= 24; G.day += 1; }
  applyTimeOfDay(gfx, G);
  if (city.wetSheen) city.wetSheen.material.opacity = G.rain > 0 ? 0.35 : 0;

  // Player / vehicle movement.
  let moving = false;
  if (G.mode === 'foot') {
    moving = updateOnFoot(G, world.playerMesh, input, dt);
    animateWalk(world.playerMesh, dt, moving);
  } else if (G.mode === 'car' && G.car) {
    updateDriving(G, G.car, input, dt);
  } else if (G.mode === 'heli' && world.heli) {
    updateHeli(world.heli, dt, input);
    G.pos.x = world.heli.x; G.pos.z = world.heli.z;
    G.speed = world.heli.speed;
  } else if (G.mode === 'boat' && world.boat) {
    updateBoat(world.boat, dt, input);
    G.pos.x = world.boat.x; G.pos.z = world.boat.z;
  }

  // World systems.
  updateTraffic(world.traffic, dt, G);
  updatePeds(world.peds, dt, G.pos);
  updatePolice(gfx.scene, world.police, G, dt);
  const heliUp = world.heli && world.heli.altitude > 1 && G.wanted >= 3;
  updateSearchlight(world.searchlight, world.heli, G.pos, heliUp);
  updateMission(G, world, dt);
  checkPackages(G);
  checkJumps(G);
  updateTaxi(G, dt);
  updateCourier(G, dt);
  updateRace(G, dt);

  // Heli follows the player when wanted is high (it hunts).
  if (world.heli && G.wanted >= 3 && G.mode !== 'heli') {
    const dx = G.pos.x - world.heli.x, dz = G.pos.z - world.heli.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 20) {
      world.heli.x += (dx / d) * 18 * dt;
      world.heli.z += (dz / d) * 18 * dt;
    }
    world.heli.altitude = Math.max(world.heli.altitude, 22);
    world.heli.group.position.set(world.heli.x, world.heli.altitude + 1.2, world.heli.z);
    world.heli.rotor.rotation.y += dt * 28;
  }

  // Health regen out of combat; death respawns at Downtown.
  if (G.wanted === 0 && G.health < 100) G.health = clamp(G.health + 2 * dt, 0, 100);
  if (G.health <= 0) {
    G.health = 100; G.wanted = 0; G.cash = Math.max(0, G.cash - 200);
    G.pos.x = -8; G.pos.z = -8; G.mode = 'foot'; G.car = null;
    world.playerMesh.group.visible = true;
    world.playerMesh.group.position.set(G.pos.x, 0, G.pos.z);
  }

  // Camera: third-person chase behind the camera yaw.
  const camTarget = { x: G.pos.x, z: G.pos.z, y: G.mode === 'heli' ? world.heli.altitude + 1 : 1.6 };
  const cd = G.camDist;
  const cx = camTarget.x - Math.sin(G.camYaw) * Math.cos(G.camPitch) * cd;
  const cz = camTarget.z - Math.cos(G.camYaw) * Math.cos(G.camPitch) * cd;
  const cy = camTarget.y + Math.sin(G.camPitch) * cd;
  gfx.camera.position.set(cx, Math.max(cy, 2.2), cz);
  gfx.camera.lookAt(camTarget.x, camTarget.y, camTarget.z);

  audio2.setEngine(G.speed, G.mode === 'car' || G.mode === 'heli');
  updateHud(G, world);
  gfx.renderer.render(gfx.scene, gfx.camera);
}

// --- debug API (the playtest harness drives the game through this) ---------
function snapshot() {
  return {
    cash: G.cash, respect: G.respect, rank: G.rank, rp: G.rp,
    health: Math.round(G.health), armour: Math.round(G.armour),
    wanted: G.wanted, bestWanted: G.bestWanted,
    day: G.day, time: +G.time.toFixed(2), rain: G.rain,
    character: G.character, role: G.role,
    mode: G.mode, x: +G.pos.x.toFixed(1), z: +G.pos.z.toFixed(1),
    speed: +G.speed.toFixed(1), grip: Math.round(G.grip), condition: Math.round(G.condition),
    missions: G.missions.map(m => ({ id: m.id, name: m.name, done: m.done, pay: m.pay })),
    missionIdx: G.missionIdx, missionActive: G.missionActive, missionStage: G.missionStage,
    missionTimer: +G.missionTimer.toFixed(1), vaultTimer: +G.vaultTimer.toFixed(1),
    ending: G.ending,
    districts: G.districts.map(d => ({ name: d.name, standing: d.standing, held: d.held })),
    packagesFound: G.packagesFound, jumpsDone: G.jumpsDone,
    racesWon: G.racesWon, carsStolen: G.carsStolen,
    taxiFares: G.taxiFares, courierJobs: G.courierJobs,
    garageOwned: G.garageOwned, garageCar: G.garageCar,
    weapon: weaponAmmoText(G), activeWeapon: G.activeWeapon,
    station: station(G).name, track: trackName(G),
    shopOpen: G.shopOpen, shopType: G.shopType,
    frames, errors: G.errors.slice(),
  };
}
G.debug = {
  state: snapshot,
  start: () => { startGame(); return snapshot(); },
  teleport: (x, z) => {
    G.pos.x = x; G.pos.z = z;
    if (G.mode === 'car' && G.car) { G.car.x = x; G.car.z = z; syncCar(G.car); }
    if (G.mode === 'foot') world.playerMesh.group.position.set(x, 0, z);
    return snapshot();
  },
  enterNearest: () => {
    const car = enterNearest(world.traffic, G.pos.x, G.pos.z, G.missionActive ? currentMission(G).id : null);
    if (car) { enterVehicle(G, world.playerMesh, car); return { ok: true, kind: car.kind }; }
    return { ok: false };
  },
  exit: () => { if (G.mode === 'car') exitVehicle(G, world.playerMesh); return snapshot(); },
  setWanted: (n) => { setWanted(G, n); return snapshot(); },
  clearWanted: () => { clearWanted(G); return snapshot(); },
  setTime: (t) => { G.time = t; applyTimeOfDay(gfx, G); return snapshot(); },
  setRain: (v) => { G.rain = clamp(v, 0, 1); return snapshot(); },
  setCash: (n) => { G.cash = n; return snapshot(); },
  save: () => ({ ok: saveGame(G) }),
  startMission: (id) => ({ ok: debugStart(G, world, id), state: snapshot() }),
  setCamYaw: (y) => { G.camYaw = y; return snapshot(); },
  acceptBriefing: () => { hideBriefing(G); return snapshot(); },
  hideBriefing: () => { hideBriefing(G); return snapshot(); },
  tryInteract: () => { onInteract(); return snapshot(); },
  isShopOpen: () => G.shopOpen,
  shopBuy: (slot) => {
    if (slot === 'garage') {
      if (G.cash < 4000) return { ok: false, reason: 'not enough cash' };
      G.cash -= 4000; G.garageOwned = true;
      return { ok: true };
    }
    if (slot === 'armour') return { ok: buyArmour(G) };
    return { ok: buyWeapon(G, slot) };
  },
  closeShop: () => { closeShop(); return snapshot(); },
  switchCharacter: () => { onSwitchCharacter(); return snapshot(); },
  stationName: () => station(G).name,
  cycleStation: () => { cycleRadio(); return station(G).name; },
  shot: (name) => ({ label: applyShot(G, world, name), state: snapshot() }),
  chooseEnding: (choice) => ({ ok: chooseEnding(G, world, choice), state: snapshot() }),
  taxi: () => { if (!G.taxi) startTaxi(G); return snapshot(); },
  courier: () => { if (!G.courier) startCourier(G); return snapshot(); },
  race: () => { startRace(G); return snapshot(); },
  heli: () => {
    G.mode = 'heli';
    world.heli.x = G.pos.x; world.heli.z = G.pos.z; world.heli.altitude = 8;
    world.playerMesh.group.visible = false;
    return snapshot();
  },
  boat: () => {
    G.mode = 'boat';
    world.boat.x = G.pos.x; world.boat.z = G.pos.z;
    world.playerMesh.group.visible = false;
    return snapshot();
  },
  frames: () => frames,
  world: () => world,
};
window.SOL = G;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && G.shopOpen) closeShop();
});
// Expose the world for the harness and for shot presets.
G.world = world;

tick();
