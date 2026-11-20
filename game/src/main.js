// main.js — Solmar City's bootstrap, game loop and window.SOL debug API.
// Everything is wired here: graphics, the city, the people, the cars, the
// police, the missions, the activities, the HUD, the radio and the save.

import * as THREE from 'three';
import { G, SOL, countDistrictsHeld, districtAt } from './state.js';
import { gfx, initGraphics, setTimeOfDay, setWeather, updateGraphics } from './graphics.js';
import { city, initCity, updateCity } from './city.js';
import { createCar, createFlyHeli, spawnBoats, spawnTraffic, spawnYachts, updateTraffic } from './vehicles.js';
import { createPlayer, spawnPeds, switchCharacter, updatePlayerMesh, updatePeds } from './people.js';
import { cameraTarget, enterNearest, exitVehicle, initInput, input, interact, updatePlayer } from './player.js';
import { currentWeapon, fire, reload, selectWeaponSlot } from './combat.js';
import { addWanted, clearWanted, setWanted, updatePolice } from './police.js';
import { acceptBriefing, hideBriefing, stageTarget, startMission, updateMissions } from './missions.js';
import { closeShop, openShop, shopBuy, startCourier, startRace, startTaxi, storeCarAtGarage, updateActivities } from './activities.js';
import { initCollectibles, initJumps } from './activities.js';
import { currentTrack, cycleStation, initAudio, startRadio, stationName } from './audio.js';
import { closePause, drawMap, hideWheel, initHud, openPause, showStats, showStory, showWheel, toggleMap, updateHud, updatePanels } from './hud.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { shot } from './shots.js';

const canvas = document.getElementById('game');
let clock = null;

/** Build the world and wire the UI. Runs once at page load. */
export function init() {
  initGraphics(canvas);
  initCity();
  createPlayer(-8, -8, 'Jason');
  spawnTraffic(26);
  spawnPeds(40);
  spawnBoats();
  spawnYachts();
  createFlyHeli();
  initCollectibles();
  initJumps();
  // A few parked cars for the player to steal near the start, all on roads.
  createCar('sedan', 0, 20, 0, { parked: true, cruise: 12 });
  createCar('taxi', 56, -20, Math.PI, { parked: true, cruise: 12 });
  createCar('sports', 112, 40, 0, { parked: true, cruise: 14 });
  initHud();
  initInput(canvas);
  setTimeOfDay(G.time);
  setWeather('clear');
  wireKeys();
  wireClicks();
  wireTitle();
  window.addEventListener('error', (e) => G.errors.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => G.errors.push('rejection: ' + String(e.reason)));
  clock = new THREE.Clock();
  G.ready = true;
  window.SOL = SOL;
  // Debug handle for the harness: the scene, the camera and the input.
  window.__DBG = { gfx, city, G, input };
  requestAnimationFrame(loop);
}

/** Keyboard shortcuts that live outside the driving input. */
function wireKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'Escape') {
      if (G.mapOpen) toggleMap();
      else if (G.shop.open) closeShop();
      else if (G.paused) closePause();
      else openPause();
    }
    if (e.code === 'KeyQ') showWheel();
    if (e.code === 'KeyV') cycleStation();
    if (e.code === 'KeyT') startTaxi();
    if (e.code === 'KeyY') startCourier();
    if (e.code === 'Enter') {
      if (!G.started) startGame();
      else if (G.briefing) acceptBriefing();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyQ') hideWheel();
  });
}

/** A quick click (not a camera drag) fires the current weapon. */
function wireClicks() {
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  canvas.addEventListener('mousedown', (e) => {
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener('mouseup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (performance.now() - downAt < 250 && moved < 6 && G.started && !G.paused) {
      initAudio();
      fire();
    }
  });
}

/** Title screen buttons: New Game and Continue. */
function wireTitle() {
  const ng = document.getElementById('btnNew');
  if (ng) ng.onclick = () => startGame();
  const ct = document.getElementById('btnContinue');
  if (ct) {
    ct.style.display = hasSave() ? 'block' : 'none';
    ct.onclick = () => {
      loadGame();
      startGame();
    };
  }
  const bs = document.getElementById('btnStats');
  if (bs) bs.onclick = () => { showStats(); const sb = document.getElementById('storyBody'); if (sb) sb.innerHTML = ''; };
  const bso = document.getElementById('btnStory');
  if (bso) bso.onclick = () => { showStory(); const st = document.getElementById('statsBody'); if (st) st.innerHTML = ''; };
  const br = document.getElementById('btnResume');
  if (br) br.onclick = () => closePause();
}

/** Leave the title screen and start playing. */
export function startGame() {
  G.started = true;
  G.paused = false;
  startRadio();
}

/** The frame loop. */
function loop() {
  requestAnimationFrame(loop);
  const rawDt = clock ? Math.min(clock.getDelta(), 0.1) : 0.016;
  const dt = rawDt * G.timeScale;
  const playing = G.started && !G.paused && !G.mapOpen && !G.shop.open && !G.briefing;
  if (playing) {
    // The in-game clock: one game hour per two real minutes.
    G.time += dt / 120;
    if (G.time >= 24) {
      G.time -= 24;
      G.day++;
    }
    setTimeOfDay(G.time);
    updatePlayer(dt);
    updatePlayerMesh(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    updateActivities();
    // District tracking for the HUD and the map.
    if (G.player) G.district = districtAt(G.player.pos.x, G.player.pos.z).name;
  }
  // Traffic always moves, even on the title screen, so the city feels alive.
  updateTraffic(dt);
  updateCity(dt, G.time);
  updateGraphics(dt, gfx.camera ? gfx.camera.position : null);
  updateCamera(dt);
  updateHud();
  updatePanels();
  if (gfx.renderer && gfx.scene && gfx.camera) gfx.renderer.render(gfx.scene, gfx.camera);
}

/** Third-person camera: behind the player, orbiting with the mouse. */
function updateCamera() {
  const cam = gfx.camera;
  if (!cam) return;
  const t = cameraTarget();
  const p = G.player;
  const inVehicle = p && !p.onFoot && p.vehicle;
  const dist = inVehicle ? 13 : 9.5;
  const height = 2.2 + input.camPitch * 7;
  const cx = t.x + Math.sin(input.camYaw) * dist;
  const cz = t.z + Math.cos(input.camYaw) * dist;
  cam.position.set(cx, t.y + height - 1.6, cz);
  cam.lookAt(t.x, t.y, t.z);
  // Aim direction on the ground, for shooting.
  G.camDir = { x: -Math.sin(input.camYaw), z: -Math.cos(input.camYaw) };
}

// ---------------------------------------------------------------- SOL API

/** A snapshot of the game for the test harness. */
SOL.state = function state() {
  const p = G.player;
  const t = stageTarget();
  return {
    ready: G.ready,
    started: G.started,
    cash: G.cash,
    respect: G.respect,
    rank: G.rank,
    rp: G.rp,
    health: Math.round(G.health),
    armour: Math.round(G.armour),
    wanted: G.wanted,
    time: +G.time.toFixed(2),
    day: G.day,
    weather: G.weather,
    mission: G.mission,
    missionStage: G.missionStage,
    missionText: G.missionText,
    missionSub: G.missionSub,
    stageTarget: t,
    character: G.character,
    district: G.district,
    ending: G.ending,
    pos: p ? { x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1) } : null,
    speed: p ? +Math.abs(p.speed || 0).toFixed(1) : 0,
    onFoot: p ? p.onFoot : true,
    vehicle: p && p.vehicle ? p.vehicle.kind : null,
    vehicleCondition: p && p.vehicle ? Math.round(p.vehicle.condition || 100) : null,
    garage: { owned: G.garage.owned, cars: G.garage.cars.slice() },
    shopOpen: G.shop.open,
    mapOpen: G.mapOpen,
    briefing: !!G.briefing,
    stats: { ...G.stats },
    districtsHeld: countDistrictsHeld(),
    collectibles: G.stats.collectibles,
    jumps: G.stats.jumps,
    racesWon: G.stats.racesWon,
    collectiblesAt: G.collectibles.map((c) => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), found: c.found })),
    jumpsAt: G.jumps.map((j) => ({ x: +j.x.toFixed(1), z: +j.z.toFixed(1), done: j.done })),
    race: G.race ? { active: G.race.active, cp: G.race.next, started: G.race.startTime } : null,
    taxi: G.taxi ? { active: G.taxi.active, x: +G.taxi.x.toFixed(1), z: +G.taxi.z.toFixed(1), fare: G.taxi.fare } : null,
    courier: G.courier ? { active: G.courier.active, x: +G.courier.x.toFixed(1), z: +G.courier.z.toFixed(1) } : null,
    radio: stationName(),
    radioTrack: currentTrack(),
    heliUp: !!G.heli,
    flyHeliAlt: G.flyHeli ? +G.flyHeli.altitude.toFixed(1) : 0,
    weapons: G.weapons.map((w) => ({ slot: w.slot, name: w.name, ammo: w.ammo, reserve: w.reserve, owned: w.owned })),
    weaponSlot: G.weaponSlot,
    cars: G.cars.map((c) => ({ kind: c.kind, x: +c.mesh.position.x.toFixed(1), z: +c.mesh.position.z.toFixed(1) })),
    errors: G.errors.slice(),
  };
};

SOL.start = function start() {
  startGame();
  return true;
};

SOL.teleport = function teleport(x, z) {
  const p = G.player;
  if (!p) return false;
  if (p.vehicle) {
    p.vehicle.mesh.position.set(x, p.vehicle.mesh.position.y, z);
    p.pos.copy(p.vehicle.mesh.position);
  } else {
    p.pos.set(x, 0, z);
    p.mesh.position.copy(p.pos);
  }
  return true;
};

SOL.enterNearest = enterNearest;
SOL.exit = exitVehicle;
SOL.interact = interact;
SOL.setWanted = setWanted;
SOL.clearWanted = clearWanted;
SOL.addWanted = addWanted;
SOL.setTime = function setTime(h) {
  setTimeOfDay(h);
  return G.time;
};
SOL.setRain = function setRain(on) {
  setWeather(on ? 'rain' : 'clear');
  return G.weather;
};
SOL.setCash = function setCash(n) {
  G.cash = n;
  return G.cash;
};
SOL.save = saveGame;
SOL.load = loadGame;
SOL.startMission = startMission;
SOL.acceptBriefing = acceptBriefing;
SOL.hideBriefing = hideBriefing;
SOL.isShopOpen = function isShopOpen() {
  return G.shop.open;
};
SOL.shopBuy = shopBuy;
SOL.closeShop = closeShop;
SOL.switchCharacter = switchCharacter;
SOL.stationName = stationName;
SOL.cycleStation = cycleStation;
SOL.setTimeScale = function setTimeScale(s) {
  G.timeScale = s;
  return G.timeScale;
};
SOL.shot = shot;
SOL.reload = reload;
SOL.openMap = function openMap() {
  if (!G.mapOpen) toggleMap();
  return G.mapOpen;
};
SOL.closeMap = function closeMap() {
  if (G.mapOpen) toggleMap();
  return G.mapOpen;
};
SOL.startRace = startRace;
SOL.storeCar = storeCarAtGarage;
SOL.openShop = openShop;
SOL.setCamYaw = function setCamYaw(yaw) {
  input.camYaw = yaw;
  return input.camYaw;
};
SOL.tryInteract = interact;
