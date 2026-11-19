// Solmar City v7 — screenshot staging: URL presets (?shot=chase|drive|
// foot|mission) that set time of day, wanted level, positions and the
// helicopter so each screenshot shows several systems at once.
import { setWanted } from './player.js';
import { debugSetMission, MISSIONS } from './missions.js';
import { spawnHeli, spawnPolice } from './police.js';

export const SHOT_PRESETS = {
  chase: { hours: 17.6, wanted: 3, mission: 1, step: 1, car: true, pos: [0, -40], heading: 0, speed: 9 },
  drive: { hours: 15.5, wanted: 0, mission: 0, step: 0, car: true, pos: [60, 120], heading: 0, speed: 7 },
  foot: { hours: 12, wanted: 0, mission: 0, step: 0, car: false, pos: [-30, 60], heading: Math.PI * 0.75 },
  mission: { hours: 23.2, wanted: 4, mission: 4, step: 1, car: true, pos: [-60, 60], heading: Math.PI, speed: 4 },
};

export function applyShotPreset(G, name) {
  const pr = SHOT_PRESETS[name];
  if (!pr) return false;
  G.hours = pr.hours;
  debugSetMission(G, pr.mission, pr.step);
  const _mis = MISSIONS[pr.mission];
  if (_mis && _mis.steps[pr.step] && _mis.steps[pr.step].twist) {
    G.banner("IT'S A SETUP — RUN!", 'Mari sold you out — lose the cops and reach the hideout');
  }
  const p = G.player;
  if (pr.car) {
    if (!p.car) {
      // stage a car under the player: take the nearest parked one
      let best = null, bd = Infinity;
      for (const pk of G.parked) {
        if (pk.stolen) continue;
        const d = (pk.x - pr.pos[0]) ** 2 + (pk.z - pr.pos[1]) ** 2;
        if (d < bd) { bd = d; best = pk; }
      }
      if (best) {
        best.stolen = true;
        p.car = { group: best.group, speed: pr.speed || 0, heading: pr.heading };
        p.mesh.visible = false;
        G.ownCar = p.car;
      }
    }
    if (p.car) {
      p.car.group.position.set(pr.pos[0], 0, pr.pos[1]);
      p.car.heading = pr.heading;
      p.car.speed = pr.speed || 0;
      p.car.group.rotation.y = pr.heading;
      p.pos.copy(p.car.group.position);
      p.heading = pr.heading;
    }
  } else {
    p.pos.set(pr.pos[0], 0, pr.pos[1]);
    p.heading = pr.heading;
    p.mesh.position.copy(p.pos);
    p.mesh.visible = true;
  }
  setWanted(G, pr.wanted);
  // police cruisers in frame for the chase / mission shots
  if (pr.wanted >= 1) {
    spawnPolice(G, pr.wanted >= 4 ? 6 : 3);
    G.police.forEach((c, i) => {
      const a = (i / G.police.length) * Math.PI * 2 + 0.4;
      c.group.position.set(p.pos.x + Math.sin(a) * 14, 0, p.pos.z + Math.cos(a) * 14);
      c.heading = Math.atan2(p.pos.x - c.group.position.x, p.pos.z - c.group.position.z);
      c.group.rotation.y = c.heading;
    });
  }
  if (pr.wanted >= 4 && !G.heli) spawnHeli(G);
  // stage the heli ahead of the player, low, so it is clearly in frame
  if (G.heli && name === 'mission') {
    G.heli.angle = -Math.PI / 2;
    G.heli.orbitR = 30;
    G.heli.height = 10;
  }
  G.camAngle = p.heading;
  return true;
}

export function shotNames() { return Object.keys(SHOT_PRESETS); }
export function shotPreset(name) { return SHOT_PRESETS[name] || null; }
