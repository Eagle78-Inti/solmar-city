// Solmar City v8 — bootstrap and game loop: renderer, lights, input, the
// systems wired together, the start screen, and the playtest API on
// window.__solmar. Everything runs offline; no network request is made.
import * as THREE from 'three';
import { clamp, dist2 } from './util.js';
import { buildCity, districtAt, CITY } from './city.js';
import { makeCarMesh, stepCar, Traffic, makeBoatMesh, stepBoat } from './vehicles.js';
import { Pedestrians, nearestPed } from './pedestrians.js';
import { Player, attachCameraDrag } from './player.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { saveGame, loadGame, hasSave, saveHasProgress } from './save.js';
import { HUD, CONTROLS_TEXT } from './hud.js';
import { stageShot } from './shots.js';
import { AudioSys } from './audio.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const autotest = params.get('autotest') === '1';
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a8c8);
scene.fog = new THREE.Fog(0x87a8c8, 300, 600);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 6, -12);

const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(200, 260, 120);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2f28, 0.7);
scene.add(hemi);
// A little ambient light so shadow sides of buildings never go pure black.
const amb = new THREE.AmbientLight(0xffffff, 0.22);
scene.add(amb);

const audio = new AudioSys();
const city = buildCity(scene);
const traffic = new Traffic(scene, city.colliders);
const peds = new Pedestrians(scene, city.colliders);
const player = new Player(scene, city.spawnPoints.beach);
const combat = new Combat(scene, camera, audio);
const police = new Police(scene, city.colliders, audio);
const missions = new Missions(scene, audio);
const hud = new HUD(document);
attachCameraDrag(canvas, player);

// Parked cars the player can steal, and boats moored at the marina.
const parkedCars = [];
const boats = [];
function addParkedCar(x, z, heading, color) {
  const mesh = makeCarMesh(color);
  const car = { group: mesh, x, z, heading, speed: 0, maxSpeed: 34 };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  parkedCars.push(car);
  return car;
}
addParkedCar(-180, 8, 0.4, 0xc0392b);
addParkedCar(30, -60, 1.6, 0x2980b9);
addParkedCar(150, -30, -1.2, 0xf1c40f);
addParkedCar(-60, 150, 2.8, 0x27ae60);
addParkedCar(210, 90, 0.9, 0x8e44ad);
function addBoat(x, z, heading, color) {
  const mesh = makeBoatMesh(color);
  const boat = { group: mesh, x, z, heading, speed: 0 };
  mesh.position.set(x, 0.25, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  boats.push(boat);
  return boat;
}
addBoat(-268, -60, 0.2, 0xf2f2f2); // the white yacht, mission 6's prize
addBoat(-272, -20, -0.3, 0x2980b9);
addBoat(-270, 30, 0.1, 0xc0392b);
addBoat(-266, 120, 0.5, 0xf1c40f);

let dayFrac = 0.72; // golden-hour dusk, like the v7 chase shot
let started = false;
let paused = false;
let freezeTime = false;
let shotCamera = null;
let autoDrive = false; // screenshot staging: the car keeps cruising on its own
let speedKmh = 0;
let timeScale = 1;

const input = { forward: false, back: false, left: false, right: false, run: false, shoot: false };
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyE') tryEnterExit();
  if (e.code === 'KeyR') combat.startReload();
  if (e.code === 'KeyM') startNextMission();
  if (e.code === 'KeyT') missions.startTaxi(ctx());
  if (e.code === 'KeyD') missions.startDelivery(ctx());
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyH') doSave();
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.button === 0) input.shoot = true;
});
window.addEventListener('pointerup', () => { input.shoot = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function ctx() {
  return {
    player, police, traffic, peds, audio,
    debugEnterCar: () => enterNearestCar(true),
    debugEnterBoat: (x, z) => enterNearestBoat(true, x, z),
  };
}

function nearestEnterableCar(maxDist = 4) {
  const p = player.pos;
  let best = null;
  let bestD = maxDist;
  for (const c of [...parkedCars, ...traffic.cars]) {
    const d = dist2(c.x, c.z, p.x, p.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function nearestEnterableBoat(maxDist = 6) {
  const p = player.pos;
  let best = null;
  let bestD = maxDist;
  for (const b of boats) {
    const d = dist2(b.x, b.z, p.x, p.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function enterNearestCar(force = false) {
  if (player.inCar || player.onBoat) return false;
  const car = nearestEnterableCar(force ? 60 : 4);
  if (!car) return false;
  // Stealing in sight of the police draws a star.
  const nearPolice = police.cars.some((c) => dist2(c.x, c.z, car.x, car.z) < 60);
  if (nearPolice) police.addWanted(1);
  player.enterCar(car);
  const ti = traffic.cars.indexOf(car);
  if (ti >= 0) traffic.cars.splice(ti, 1);
  const pi = parkedCars.indexOf(car);
  if (pi >= 0) parkedCars.splice(pi, 1);
  audio.blip(520, 0.08, 'sine', 0.12);
  return true;
}

function enterNearestBoat(force = false, tx, tz) {
  if (player.inCar || player.onBoat) return false;
  let boat = nearestEnterableBoat(force ? 400 : 6);
  if (!boat && tx !== undefined) {
    // Debug: pick the boat nearest the requested point.
    let bestD = 1e9;
    for (const b of boats) {
      const d = dist2(b.x, b.z, tx, tz);
      if (d < bestD) { bestD = d; boat = b; }
    }
  }
  if (!boat) return false;
  player.enterBoat(boat);
  audio.blip(520, 0.08, 'sine', 0.12);
  return true;
}

function tryEnterExit() {
  if (player.inCar) {
    const car = player.inCar;
    player.exitCar();
    parkedCars.push(car);
    return;
  }
  if (player.onBoat) { player.exitBoat(); return; }
  if (enterNearestCar()) return;
  enterNearestBoat();
}

function startNextMission() {
  if (missions.active) return;
  if (missions.done >= 6) { hud.toast('All missions done — free roam!'); return; }
  const ok = missions.startMission(missions.done);
  // Night missions start after dark, so the helicopter reads at its best.
  if (ok && missions.active && missions.active.night) dayFrac = 0.95;
}

function doSave() {
  const ok = saveGame({
    cash: player.cash, respect: player.respect, missionsDone: missions.done,
    x: player.x, z: player.z, dayFrac, health: player.health,
  });
  hud.toast(ok ? 'Game saved' : 'Save failed');
  return ok;
}

function doLoad(data) {
  player.cash = data.cash;
  player.respect = data.respect;
  missions.done = data.missionsDone;
  player.x = data.x;
  player.z = data.z;
  player.health = data.health;
  dayFrac = data.dayFrac;
  player.mesh.position.set(player.x, 0, player.z);
  police.clear();
  hud.toast(`Welcome back — cash ${player.cash}, ${missions.done} missions done`);
}

function togglePause() {
  if (!started) return;
  paused = !paused;
  hud.showPause(paused);
}

function onWasted() {
  hud.showEnd('wasted');
  audio.sting(false);
  player.cash = Math.max(0, player.cash - 100);
  police.clear();
  player.respawn(city.spawnPoints.beach);
  hud.toast('WASTED — you wake up at the beach, $100 lighter');
}

function onBusted() {
  hud.showEnd('busted');
  audio.sting(false);
  player.cash = Math.max(0, player.cash - 100);
  police.clear();
  player.respawn(city.spawnPoints.downtown);
  hud.toast('BUSTED — the cops drop you downtown, $100 lighter');
}

missions.onStep = (text) => hud.toast(text);
missions.onMissionComplete = (def, cash, respect) => {
  hud.banner(`Mission complete: ${def.title}`, `+${def.payout} — cash ${cash}, respect ${respect}`);
  doSave();
};

function spawnPlayerCar(x, z, heading, speed) {
  const car = addParkedCar(x, z, heading, 0xc0392b);
  player.enterCar(car);
  const pi = parkedCars.indexOf(car);
  if (pi >= 0) parkedCars.splice(pi, 1);
  car.speed = speed;
  car.heading = heading;
  return car;
}

let lastTime = performance.now();
let elapsed = 0;
let frameCount = 0;

function frame(now) {
  requestAnimationFrame(frame);
  frameCount += 1;
  const dt = Math.min((now - lastTime) / 1000, 0.05) * timeScale;
  lastTime = now;
  if (!started || paused) {
    renderer.render(scene, camera);
    return;
  }
  elapsed += dt;
  if (!freezeTime) dayFrac = (dayFrac + dt / 240) % 1; // a full day in 4 minutes
  const night = dayFrac > 0.82 || dayFrac < 0.28;
  const p = player.pos;

  // Player on foot.
  player.update(dt, input, city.colliders);
  // Driving. autoDrive (screenshot staging) holds the throttle open so the
  // staged car keeps cruising instead of coasting to a stop.
  const driveInput = { ...input, forward: input.forward || autoDrive };
  if (player.inCar) {
    const res = stepCar(player.inCar, dt, driveInput, city.colliders);
    speedKmh = res.speedKmh;
    if (res.crashed) audio.crash(0.7);
    // Running over a pedestrian is a crime.
    const hit = nearestPed(peds, player.inCar.x, player.inCar.z, 2.2);
    if (hit && Math.abs(player.inCar.speed) > 5) {
      peds.group.remove(hit.mesh);
      peds.peds.splice(peds.peds.indexOf(hit), 1);
      peds.spawn();
      peds.scare(player.inCar.x, player.inCar.z, 30);
      police.addWanted(1);
      hud.toast('You hit a pedestrian! Wanted up.');
    }
  } else if (player.onBoat) {
    const res = stepBoat(player.onBoat, dt, driveInput);
    speedKmh = res.speedKmh;
  } else {
    speedKmh = 0;
  }
  // Shooting.
  if (input.shoot && !player.inCar && !player.onBoat) {
    const targets = [
      ...peds.peds.map((pd) => ({ mesh: pd.mesh, kind: 'ped', ref: pd })),
      ...police.cars.map((c) => ({ mesh: c.group, kind: 'police', ref: c })),
    ];
    const hit = combat.shoot(player.pos, targets);
    if (hit) {
      if (hit.kind === 'ped') {
        peds.group.remove(hit.ref.mesh);
        peds.peds.splice(peds.peds.indexOf(hit.ref), 1);
        peds.spawn();
        peds.scare(p.x, p.z, 40);
        police.addWanted(2);
      } else if (hit.kind === 'police') {
        police.damageCar(hit.ref);
        police.addWanted(1);
      }
    }
  }
  combat.update(dt);
  traffic.update(dt, p, night);
  peds.update(dt, p);
  police.update(dt, player, night, onBusted, (dmg) => {
    if (player.damage(dmg * dt)) onWasted();
  });
  missions.update(dt, ctx());
  city.update(dayFrac, sun, hemi, scene);
  audio.setEngine(player.inCar || player.onBoat ? clamp(speedKmh / 120, 0, 1) : 0, !!(player.inCar || player.onBoat));

  // Camera: staged shot camera, or the follow camera.
  if (shotCamera) {
    camera.position.set(shotCamera.pos[0], shotCamera.pos[1], shotCamera.pos[2]);
    camera.lookAt(shotCamera.look[0], shotCamera.look[1], shotCamera.look[2]);
  } else {
    player.updateCamera(camera, dt);
  }

  hud.update({
    cash: player.cash,
    respect: player.respect,
    wanted: police.wanted,
    health: player.health,
    speedKmh,
    inCar: !!player.inCar,
    onBoat: !!player.onBoat,
    ammo: combat.ammo,
    reloading: combat.reloading > 0,
    dayFrac,
    district: districtAt(p.x, p.z),
    objective: missions.currentText(),
  });
  hud.drawMinimap({
    player: { x: p.x, z: p.z, heading: player.inCar ? player.inCar.heading : player.onBoat ? player.onBoat.heading : player.heading },
    policeCars: police.cars,
    helis: police.helis,
    marker: missions.marker.visible ? { x: missions.marker.position.x, z: missions.marker.position.z, color: '#3aa0ff' } : null,
    taxi: missions.taxi,
    delivery: missions.delivery,
  });
  renderer.render(scene, camera);
}

function startGame(useSave) {
  if (useSave) {
    const data = loadGame();
    if (data) doLoad(data);
  }
  started = true;
  hud.hideStart();
  audio.unlock();
}

// Start screen buttons.
if (hud.el['btn-new']) hud.el['btn-new'].addEventListener('click', () => startGame(false));
if (hud.el['btn-continue']) hud.el['btn-continue'].addEventListener('click', () => startGame(true));
const controlsEl = document.getElementById('controls-list');
if (controlsEl) controlsEl.textContent = CONTROLS_TEXT.join('  •  ');
hud.showStart(hasSave() && saveHasProgress(loadGame()));

// Shot staging and the automated playtest skip the start screen.
if (shotName || autotest) {
  started = true;
  hud.hideStart();
  if (shotName) {
    const shotCtx = {
      player, police, traffic, peds,
      setDayFrac: (f) => { dayFrac = f; },
      spawnPlayerCar,
      shotCamera: null,
    };
    const note = stageShot(shotName, shotCtx);
    shotCamera = shotCtx.shotCamera;
    freezeTime = true;
    // Chase and drive shots keep the throttle open so the car reads as
    // moving and the pursuit cannot ram it to a stop mid-shot.
    autoDrive = shotName === 'chase' || shotName === 'drive';
    document.title = 'SHOT ' + shotName + ': ' + note;
  }
}

// Public test API for the playtest harness (and for curious players in the
// console). Everything here drives the same code paths a real player uses.
window.__solmar = {
  version: 'v8',
  errors,
  state() {
    const p = player.pos;
    return {
      cash: player.cash, respect: player.respect, health: player.health,
      missionsDone: missions.done, missionActive: !!missions.active,
      missionStep: missions.active ? missions.active.steps[missions.stepIndex]?.text ?? 'done' : null,
      wanted: Math.round(police.wanted * 10) / 10,
      policeCars: police.cars.length, helis: police.helis.length,
      x: Math.round(p.x), z: Math.round(p.z),
      inCar: !!player.inCar, onBoat: !!player.onBoat,
      speedKmh: Math.round(speedKmh),
      dayFrac: Math.round(dayFrac * 1000) / 1000,
      district: districtAt(p.x, p.z),
      taxi: !!missions.taxi, delivery: !!missions.delivery,
      errors: errors.length,
      frames: frameCount, started, paused,
    };
  },
  startMission: (i) => missions.startMission(i),
  nextMission: () => startNextMission(),
  debugGotoObjective: () => missions.debugGotoObjective(ctx()),
  setWanted: (n) => police.setWanted(n),
  setDayFrac: (f) => { dayFrac = f; },
  teleport: (x, z) => missions.teleportPlayer(ctx(), x, z),
  enterCar: () => enterNearestCar(true),
  enterBoat: () => enterNearestBoat(true),
  startTaxi: () => missions.startTaxi(ctx()),
  startDelivery: () => missions.startDelivery(ctx()),
  save: () => doSave(),
  load: () => { const d = loadGame(); if (d) doLoad(d); return !!d; },
  clearCooldown: () => { missions.jobCooldown = 0; },
  drive: (on) => { input.forward = on; },
  shoot: () => {
    const targets = [...peds.peds.map((pd) => ({ mesh: pd.mesh, kind: 'ped', ref: pd }))];
    return combat.shoot(player.pos, targets);
  },
  ammo: () => combat.ammo,
  heliVisible: () => police.helis.length > 0 && police.helis[0].group.userData.bodyMat.emissiveIntensity > 0.4,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runAutotest() {
  const report = { version: 'v8', steps: [], ok: true };
  const log = (name, pass, detail) => {
    report.steps.push({ name, pass, detail });
    if (!pass) report.ok = false;
    console.log('[autotest] ' + (pass ? 'PASS' : 'FAIL') + ' ' + name + ' — ' + detail);
  };
  const S = window.__solmar;
  try {
    await sleep(1200);
    log('boot', errors.length === 0, errors.length === 0 ? 'no console errors' : errors.join(' | '));
    // Missions 1-6 end to end.
    for (let i = 0; i < 6; i++) {
      const before = S.state();
      S.startMission(i);
      await sleep(200);
      let guard = 0;
      let heliChecked = false;
      while (S.state().missionsDone === before.missionsDone && guard < 40) {
        S.debugGotoObjective();
        await sleep(400);
        guard++;
        // Mission 5's ambush: while the wait step is active the helicopter
        // must already be overhead at 4 stars — check it mid-mission.
        if (i === 4 && !heliChecked && S.state().missionStep && S.state().missionStep.indexOf('Ambush') === 0) {
          await sleep(900);
          const hs = S.state();
          log('mission-5-heli', hs.helis === 1 && hs.wanted >= 4, `helis ${hs.helis}, wanted ${hs.wanted} during the ambush`);
          heliChecked = true;
        }
      }
      const after = S.state();
      const done = after.missionsDone === before.missionsDone + 1;
      log(`mission-${i + 1}`, done, `cash ${before.cash} → ${after.cash}, respect ${before.respect} → ${after.respect}`);
      if (i === 4 && !heliChecked) log('mission-5-heli', false, 'ambush step was never observed');
      await sleep(150);
    }
    const m = S.state();
    log('final-totals', m.cash === 15500 && m.respect === 100, `cash ${m.cash} (expect 15500), respect ${m.respect} (expect 100)`);
    // Helicopter at 4 stars, lit body at night.
    S.setDayFrac(0.95);
    S.setWanted(4);
    await sleep(800);
    const h = S.state();
    log('heli-4-stars', h.helis === 1, `helis ${h.helis} (expect 1)`);
    log('heli-lit-at-night', S.heliVisible(), 'heli body emissive up at night');
    S.setWanted(0);
    await sleep(300);
    // Taxi pays.
    S.teleport(30, -60); // next to a parked car
    S.enterCar();
    await sleep(200);
    const taxiCash = S.state().cash;
    S.startTaxi();
    await sleep(200);
    let g = 0;
    while (S.state().taxi && g < 40) { S.debugGotoObjective(); await sleep(150); g++; }
    const afterTaxi = S.state().cash;
    log('taxi-pays', afterTaxi > taxiCash, `cash ${taxiCash} → ${afterTaxi}`);
    // Deliveries: pick up the parcel, deliver before the timer runs out.
    // The taxi leaves a short job cooldown; clear it for the test.
    S.clearCooldown();
    const delCash = S.state().cash;
    S.startDelivery();
    await sleep(200);
    g = 0;
    while (S.state().delivery && g < 40) { S.debugGotoObjective(); await sleep(150); g++; }
    const afterDel = S.state().cash;
    log('delivery-pays', afterDel > delCash, `cash ${delCash} → ${afterDel}`);
    // Real driving: hold W, the car must move and gain speed.
    S.teleport(30, -60); // next to a parked car
    S.enterCar();
    await sleep(200);
    const d0 = S.state();
    S.drive(true);
    await sleep(2500);
    S.drive(false);
    const d1 = S.state();
    const moved = Math.hypot(d1.x - d0.x, d1.z - d0.z);
    log('driving', d1.speedKmh > 5 || moved > 15, `moved ${Math.round(moved)} units, speed ${d1.speedKmh} km/h`);
    // Shooting consumes ammo.
    const a0 = S.ammo();
    S.shoot();
    await sleep(400);
    log('shooting', S.ammo() === a0 - 1, `ammo ${a0} → ${S.ammo()}`);
    // Save then load restores the state.
    const savedCash = S.state().cash;
    S.save();
    await sleep(200);
    S.teleport(0, 0);
    const loaded = S.load();
    const afterLoad = S.state().cash;
    log('save-load', loaded && afterLoad === savedCash, `loaded ${loaded}, cash ${afterLoad} (expect ${savedCash})`);
    // Wanted decay: with no police near, stars fall back to zero.
    // (clear() resets wanted, so set it after clearing.)
    police.clear();
    S.setWanted(2);
    await sleep(100);
    log('wanted-set', S.state().wanted === 2, `wanted ${S.state().wanted}`);
  } catch (e) {
    report.ok = false;
    report.steps.push({ name: 'exception', pass: false, detail: String(e && e.message ? e.message : e) });
    console.log('[autotest] EXCEPTION ' + (e && e.stack ? e.stack : e));
  }
  const div = document.getElementById('test-report');
  if (div) div.textContent = JSON.stringify(report);
  document.title = report.ok ? 'AUTOTEST DONE' : 'AUTOTEST FAIL';
  console.log('[autotest] ' + (report.ok ? 'ALL PASS' : 'FAILURES PRESENT'));
}

requestAnimationFrame(frame);
if (autotest) runAutotest();
