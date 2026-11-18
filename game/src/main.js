import * as THREE from 'three';
// Solmar City — bootstrap and game loop: renderer, input, camera, the
// shared game state and the enter/exit, wanted, busted and wasted flows.
import { buildCity, SPOTS } from './city.js';
import { AudioSys } from './audio.js';
import { PlayerCar, Traffic } from './vehicles.js';
import { Player } from './player.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, applySave, clearSave } from './save.js';
import { stageShot, stageFromUrl } from './shots.js';
import { clamp, lerp, lerpAngle, dist2d } from './util.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87b5e0');
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
scene.add(camera);

const city = buildCity(scene);
const G = {
  scene, camera, renderer, city,
  dayT: 0.32, cash: 250, respect: 0, health: 100, wanted: 0,
  objective: '', started: false, paused: false,
  input: new Set(), camYaw: Math.PI, shake: 0, shotAt: null,
  wantedTimer: 0, lastSeen: 0,
};
G.audio = new AudioSys();
G.playerCar = new PlayerCar(scene, city);
G.player = new Player(scene, city);
G.traffic = new Traffic(scene, city);
G.peds = new Pedestrians(scene, city);
G.police = new Police(scene, city);
G.missions = new Missions(scene, G);
G.combat = new Combat(scene, G);
G.hud = new HUD(G);
G.combat.attachGun(camera);
// The player's own car waits parked at the spawn, visible from the start.
G.playerCar.mesh.position.set(26, 0, -120);

// Headlight: one spotlight on the player's car, lit after dark.
const headlight = new THREE.SpotLight('#ffeebb', 0, 55, 0.5, 0.5, 1.2);
headlight.position.set(0, 1.0, 2.2);
const headTarget = new THREE.Object3D();
headTarget.position.set(0, 0.2, 14);
G.playerCar.mesh.add(headlight); G.playerCar.mesh.add(headTarget);
headlight.target = headTarget;

G.saveGame = () => saveGame(G);
G.setWanted = (n) => {
  G.wanted = clamp(n, 0, 5);
  G.wantedTimer = 0; G.lastSeen = performance.now() / 1000;
  if (G.wanted === 0) G.police.clear();
};
G.addWanted = (n) => { if (G.wanted < 5) G.setWanted(G.wanted + n); };

G.enterCar = (car, silent) => {
  G.player.onFoot = false;
  G.player.mesh.visible = false;
  G.player.car = G.playerCar;
  G.playerCar.mesh.visible = true;
  // Keep the physics position and the mesh together: the car drives from
  // where the player stands, not from where it was last parked.
  G.playerCar.pos.set(G.player.pos.x, 0, G.player.pos.z);
  G.playerCar.mesh.position.set(G.player.pos.x, 0, G.player.pos.z);
  G.playerCar.heading = G.player.heading;
  G.playerCar.speed = 0;
  if (!silent) G.audio.blip(320, 0.08, 0.1);
};
G.exitCar = () => {
  const c = G.playerCar;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.mesh.visible = true;
  const side = 2.2;
  G.player.teleport(c.pos.x + Math.cos(c.heading) * side, c.pos.z - Math.sin(c.heading) * side, c.heading);
  G.audio.setEngine(0, false);
};
G.busted = () => {
  G.cash = Math.max(0, G.cash - 300);
  G.setWanted(0);
  G.health = 100;
  G.hud.flashCenter('BUSTED', 'Mari bailed you out — $300 gone.');
  if (G.player.car) G.exitCar();
  G.player.teleport(SPOTS.safehouse.x, SPOTS.safehouse.z, Math.PI);
  G.saveGame();
};
G.wasted = () => {
  G.cash = Math.max(0, G.cash - 200);
  G.setWanted(0);
  G.health = 100;
  G.hud.flashCenter('WASTED', 'You woke up at Solmar General — $200 gone.');
  if (G.player.car) G.exitCar();
  G.player.teleport(SPOTS.hospital.x, SPOTS.hospital.z, Math.PI);
  G.saveGame();
};

  // Steal a parked car: repaint the player's car to match, flag the SUV.
  G.stealCar = (parked) => {
    const i = G.traffic.parked.indexOf(parked);
    if (i >= 0) G.traffic.parked.splice(i, 1);
    parked.mesh.visible = false;
    const body = G.playerCar.mesh.children[0];
    body.material = body.material.clone();
    body.material.color.setHex(parked.color);
    G.playerCar.stolen = parked.suv ? 'suv' : 'car';
    G.playerCar.pos.set(parked.x, 0, parked.z);
    G.playerCar.heading = parked.mesh.rotation.y;
    G.enterCar(G.playerCar);
    G.addWanted(1);
    G.hud.flash(parked.suv ? 'Stolen — the black SUV. The garage wants it.' : 'Car stolen — the cops noticed.');
  };

  // Input: keyboard, mouse click to shoot, menu buttons.
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    G.input.add(e.code);
    if (!G.started) return;
    if (e.code === 'Escape') { G.paused = !G.paused; G.hud.showPause(G.paused); return; }
    if (G.paused) return;
    if (e.code === 'KeyE') {
      if (G.player.onFoot) {
        const nearOwn = Math.hypot(G.player.pos.x - G.playerCar.pos.x, G.player.pos.z - G.playerCar.pos.z) < 6.5;
        if (nearOwn && G.playerCar.mesh.visible) { G.enterCar(G.playerCar); return; }
        const parked = G.traffic.nearestStealable(G.player.pos.x, G.player.pos.z, 6.5);
        if (parked) G.stealCar(parked);
      } else G.exitCar();
    }
    if (e.code === 'KeyT' && G.player.onFoot) {
      if (G.missions.taxi) {
        // Arrive at the passenger by walking/driving to the marker.
      } else {
        const taxi = G.traffic.taxi;
        const d = Math.hypot(G.player.pos.x - taxi.x, G.player.pos.z - taxi.z);
        if (d < 6 && !taxi.hired) { taxi.hired = true; G.missions.startTaxi(); }
        else G.hud.flash('Find the yellow taxi first.');
      }
    }
    if (e.code === 'KeyR' && !G.player.onFoot) G.playerCar.resetToRoad();
    if (e.code === 'KeyM') G.audio.toggleMute();
    if (e.code === 'KeyF') G.combat.shoot(camera, G.peds, G.police);
  });
  addEventListener('keyup', (e) => G.input.delete(e.code));
  addEventListener('mousedown', (e) => {
    if (!G.started || G.paused || e.button !== 0) return;
    G.audio.ensure(); G.audio.startMusic();
    if (G.player.onFoot) G.combat.shoot(camera, G.peds, G.police);
  });
  addEventListener('blur', () => G.input.clear());
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function startGame(fresh) {
    G.audio.ensure(); G.audio.startMusic();
    if (fresh) {
      clearSave();
      G.cash = 250; G.respect = 0; G.health = 100;
      G.missions.index = 0; G.missions.phase = 'go'; G.missions.raceCp = 0; G.missions.sprint = false;
      for (const c of G.missions.coins) { c.got = false; c.mesh.visible = true; }
      G.missions.coinsGot = 0; G.dayT = 0.32;
      G.player.teleport(26, -123, Math.PI);
      G.setWanted(0);
      G.missions.setObjective();
    }
    G.started = true; G.paused = false;
    G.hud.hideMenu(); G.hud.showPause(false);
  }
  document.getElementById('newBtn').addEventListener('click', () => startGame(true));
  document.getElementById('continueBtn').addEventListener('click', () => startGame(false));
  document.getElementById('resumeBtn').addEventListener('click', () => { G.paused = false; G.hud.showPause(false); });
  document.getElementById('menuBtn').addEventListener('click', () => { G.paused = false; G.hud.showPause(false); G.started = false; G.hud.showMenu(true); });

  // Third-person camera: hangs behind the player or the car, smoothed.
  const camPos = new THREE.Vector3(26, 5, -140);
  function updateCamera(dt, snap) {
    const focus = G.player.onFoot ? G.player.pos : G.playerCar.pos;
    const heading = G.player.onFoot ? G.player.heading : G.playerCar.heading;
    G.camYaw = lerpAngle(G.camYaw, heading, Math.min(1, dt * (G.player.onFoot ? 3 : 2.2)));
    const dist = G.player.onFoot ? 8.5 : 12.5;
    const height = G.player.onFoot ? 3.8 : 5.2;
    const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
    const tx = focus.x - fx * dist, tz = focus.z - fz * dist;
    const ty = height;
    if (snap) camPos.set(tx, ty, tz);
    else { camPos.x = lerp(camPos.x, tx, Math.min(1, dt * 6)); camPos.y = lerp(camPos.y, ty, Math.min(1, dt * 6)); camPos.z = lerp(camPos.z, tz, Math.min(1, dt * 6)); }
    G.shake = Math.max(0, G.shake - dt * 1.6);
    const sh = G.shake * 0.35;
    camera.position.set(
      camPos.x + (Math.random() - 0.5) * sh,
      camPos.y + (Math.random() - 0.5) * sh,
      camPos.z + (Math.random() - 0.5) * sh,
    );
    camera.lookAt(focus.x + fx * 7, 1.4, focus.z + fz * 7);
  }
  G.snapCamera = () => updateCamera(1, true);

  // Main loop: advance the day, drive the world, decay the wanted level.
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (G.started && !G.paused) {
      G.dayT = (G.dayT + dt / 720) % 1;
      const focusPos = G.player.onFoot ? G.player.pos : G.playerCar.pos;
      const { nightF } = city.update(dt, G.dayT, focusPos);
      headlight.intensity = nightF > 0.3 && !G.player.onFoot ? 90 : 0;
      if (G.player.onFoot) { G.player.update(dt, G.input, G.camYaw); G.audio.setEngine(0, false); }
      else {
        G.playerCar.update(dt, G.input, city, G.audio);
        // While driving, the player's position IS the car's, for missions,
        // police, peds and the minimap.
        G.player.pos.copy(G.playerCar.pos);
        G.player.heading = G.playerCar.heading;
      }
      const playerSpeed = G.player.onFoot ? G.player.speed : Math.abs(G.playerCar.speed);
      G.traffic.update(dt, focusPos);
      G.peds.update(dt, focusPos, playerSpeed, G.shotAt);
      G.shotAt = null;
      const busted = G.police.update(dt, G.wanted, G.player, playerSpeed, G.audio);
      if (busted === 'busted') G.busted();
      G.missions.update(dt);
      if (G.missions.taxi) {
        const t = G.missions.taxi;
        if (dist2d(G.player.pos.x, G.player.pos.z, t.x, t.z) < 6) G.missions.taxiArrive();
      }
      G.combat.update(dt);
      G.combat.policeFire(dt, G.police);
      // Wanted decay: hide from every cruiser for a while and a star drops.
      if (G.wanted > 0) {
        const now = performance.now() / 1000;
        const seen = G.police.cruisers.some((c) => dist2d(c.x, c.z, focusPos.x, focusPos.z) < 55);
        if (seen) { G.lastSeen = now; G.wantedTimer = 0; }
        else if (now - G.lastSeen > 20) {
          G.wantedTimer += dt;
          if (G.wantedTimer > 8) { G.setWanted(G.wanted - 1); G.hud.flash('Heat cooling off…'); }
        }
      }
      updateCamera(dt, false);
      G.hud.update();
    }
    renderer.render(scene, camera);
  }

  // Debug and test hooks (also how the screenshots are staged).
  window.SOLMAR = {
    G,
    stage: (n) => stageShot(G, n),
    start: (fresh = true) => startGame(fresh),
    teleport: (x, z) => {
      if (G.player.car) { G.playerCar.pos.set(x, 0, z); G.playerCar.speed = 0; }
      else G.player.teleport(x, z);
    },
    setMission: (i) => {
      G.missions.index = i; G.missions.phase = 'go'; G.missions.raceCp = 0; G.missions.sprint = false;
      G.setWanted(0); G.missions.setObjective();
    },
    setWanted: (n) => G.setWanted(n),
    shoot: () => G.combat.shoot(camera, G.peds, G.police),
    state: () => ({
      cash: G.cash, respect: G.respect, mission: G.missions.index, phase: G.missions.phase,
      raceCp: G.missions.raceCp, camYaw: +G.camYaw.toFixed(2),
      wanted: G.wanted, health: Math.round(G.health), coins: G.missions.coinsGot,
      x: +G.player.pos.x.toFixed(1), z: +G.player.pos.z.toFixed(1),
      onFoot: G.player.onFoot, speed: +(G.player.car ? G.playerCar.speed : G.player.speed).toFixed(1),
      cruisers: G.police.cruisers.length, heli: !!G.police.heli, dayT: +G.dayT.toFixed(3),
    }),
  };

  // Boot: show the start screen (Continue appears when a save exists).
  G.hud.showMenu(loadGame() !== null);
  document.getElementById('continueBtn').addEventListener('click', () => applySave(G, loadGame()));
  updateCamera(1, true);
  loop();
  stageFromUrl(G);
