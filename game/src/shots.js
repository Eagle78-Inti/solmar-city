// Solmar City — screenshot staging and the debug API the headless
// play-test uses. A shot is chosen with ?shot=chase|drive|foot|mission
// and stages the whole game: time of day, wanted level, police, helicopter,
// the player's place, and the objective line on the HUD.

import { placeOnFoot } from './player.js';

export const SHOT_NAMES = ['chase', 'drive', 'foot', 'mission'];

function putPlayerInCar(api, x, z, heading) {
  const car = api.playerCar.state;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = 0;
  api.player.state.onFoot = false;
  api.player.group.visible = false;
  api.G.autoDrive = false;
}

function setObjective(api, text, missionIndex) {
  api.G.objectiveOverride = text;
  if (missionIndex !== undefined) api.G.missionIndex = missionIndex;
}

export function applyShot(name, api) {
  const G = api.G;
  G.shot = name;
  if (name === 'chase') {
    // COVER: bright afternoon, car MOVING, police in pursuit, 3 stars
    api.setTime(15.5);
    putPlayerInCar(api, 0, -120, 0);
    api.playerCar.state.speed = 16;
    G.autoDrive = true; // keep W held so the speedometer reads above 0
    api.police.placeCars([
      { x: -10, z: -95 }, { x: 10, z: -100 }, { x: 0, z: -82 },
    ], { x: 0, z: -120 });
    // police placed AHEAD of the player (in the camera's view) so the
    // chase reads in a single still: they are converging on the player
    setObjective(api, 'The Getaway — lose the cops', 1);
    api.setCameraMode('chase');
  } else if (name === 'drive') {
    api.setTime(10.0);
    putPlayerInCar(api, -74, 60, 0);
    api.playerCar.state.speed = 14;
    G.autoDrive = true;
    api.police.setWanted(0, { x: -74, z: 60 });
    setObjective(api, 'Mission 1: First Job', 0);
    api.setCameraMode('chase');
  } else if (name === 'foot') {
    api.setTime(12.0);
    placeOnFoot(api.player, 20, -20, Math.PI * 0.8);
    api.police.setWanted(0, { x: 20, z: -20 });
    api.pedsScatter(20, -20, 6);
    setObjective(api, 'Mission 1: First Job — on foot in Solmar', 0);
    api.setCameraMode('foot');
  } else if (name === 'mission') {
    // NIGHT, 4 stars, helicopter low and visible, no black tower in frame
    api.setTime(23.25);
    putPlayerInCar(api, 148, 60, Math.PI);
    api.playerCar.state.speed = 12;
    G.autoDrive = true;
    api.police.setWanted(4, { x: 148, z: 60 });
    api.police.setHeliAngle(-Math.PI / 2); // heli ahead of the player, in frame
    setObjective(api, "IT'S A SETUP — RUN!", 4);
    api.setCameraMode('high');
  }
  api.hud.toast('');
}

// Read ?shot= from the URL, stage it, and publish the debug API the
// headless play-test drives the game through.
export function initShots(api) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && SHOT_NAMES.includes(shot)) {
    // stage after the first frame so every system exists
    setTimeout(() => applyShot(shot, api), 120);
  }
  window.__solmar = {
    G: api.G,
    shot: shot || null,
    state() {
      const G = api.G;
      return {
        cash: G.cash, respect: G.respect, coins: G.coins, wanted: G.wanted,
        health: G.health, hours: G.hours, missionIndex: G.missionIndex,
        missionDone: G.missionDone, objective: G.objectiveOverride || '',
        onFoot: api.player.state.onFoot,
        px: api.player.state.onFoot ? api.player.state.x : api.playerCar.state.x,
        pz: api.player.state.onFoot ? api.player.state.z : api.playerCar.state.z,
        heading: api.player.state.onFoot ? api.player.state.heading : api.playerCar.state.heading,
        speed: api.player.state.onFoot ? api.player.state.speed : api.playerCar.state.speed,
        police: api.police.cars.length,
        heli: api.police.state.wanted >= 4,
        peds: api.peds.countStanding(),
        traffic: api.traffic.cars.length,
        taxiWaypoint: api.taxi.state.waypoint,
        missionWaypoint: api.missions.state.waypoint,
      };
    },
    nearestParked() {
      const pos = api.playerPos();
      let best = null, bestD = 1e9;
      for (const p of api.parked.list) {
        if (p.taken) continue;
        const d = Math.hypot(p.x - pos.x, p.z - pos.z);
        if (d < bestD) { best = p; bestD = d; }
      }
      return best ? { x: best.x, z: best.z, dist: bestD } : null;
    },
    teleport(x, z) {
      if (api.player.state.onFoot) {
        placeOnFoot(api.player, x, z, api.player.state.heading);
      } else {
        api.playerCar.state.x = x;
        api.playerCar.state.z = z;
        api.playerCar.state.speed = 0;
      }
    },
    setTime(h) { api.setTime(h); },
    setWanted(n) { api.police.setWanted(n, api.playerPos()); },
    startMission() { api.missions.start(); },
    missionStep() {
      // walk the current mission's steps by teleporting to each waypoint
      const m = api.missions;
      const st = m.state;
      if (!st.active || !st.waypoint) return null;
      return { x: st.waypoint.x, z: st.waypoint.z, radius: st.waypoint.radius };
    },
    giveCar() {
      putPlayerInCar(api, api.player.state.x, api.player.state.z, api.player.state.heading);
    },
    start() { api.startGame(false); },
    pause(v) { api.setPaused(v); },
    saveNow() { return api.saveNow(); },
    scatter(x, z, n) { return api.pedsScatter(x, z, n); },
    errors: [],
  };
  window.addEventListener('error', (e) => {
    window.__solmar.errors.push(String(e.message || e.error));
  });
  window.addEventListener('unhandledrejection', (e) => {
    window.__solmar.errors.push(String(e.reason));
  });
}
