// shots.js — screenshot presets for the 4 dossier shots.
// Each preset puts the game in a known state through the debug API and
// returns a label the harness writes into the shot filename.
import { setWanted } from './state.js';

export const SHOT_PRESETS = {
  chase: {
    label: 'Night chase — 5 stars, heli searchlight, police car',
    apply(G, world) {
      G.time = 22.5; G.rain = 0;
      setWanted(G, 5);
      // Mid-block on a Neon Mile street so lit facades fill the frame.
      G.pos.x = 40; G.pos.z = -2; G.pos.yaw = 0.35;
      const car = world.traffic.find(c => c.kind === 'taxi') || world.missionCar;
      if (car) {
        car.x = 40; car.z = -2; car.yaw = 0.35;
        G.mode = 'car'; G.car = car;
        G.pos.x = car.x; G.pos.z = car.z;
        if (world.playerMesh) world.playerMesh.group.visible = false;
      }
      // Heli up, searchlight on the player.
      if (world.heli) {
        world.heli.x = 46; world.heli.z = -8; world.heli.altitude = 26;
      }
      // A police car ahead in the frame.
      if (world.police.length === 0 && world.spawnPolice) world.spawnPolice(1);
      if (world.police[0]) { world.police[0].x = 44; world.police[0].z = 24; world.police[0].yaw = Math.PI; }
      G.camYaw = 0.35;
    },
  },
  drive: {
    label: 'Dusk drive — lit facades, red sky',
    apply(G, world) {
      G.time = 18.2; G.rain = 0;
      setWanted(G, 0);
      const car = world.traffic.find(c => c.kind === 'taxi') || world.missionCar;
      if (car) {
        car.x = 40; car.z = 0; car.yaw = Math.PI / 2;
        G.mode = 'car'; G.car = car;
        G.pos.x = car.x; G.pos.z = car.z;
        if (world.playerMesh) world.playerMesh.group.visible = false;
      }
      G.camYaw = Math.PI / 2;
    },
  },
  foot: {
    label: 'Golden-hour beach — Jason on the sand, bay to the west',
    apply(G, world) {
      G.time = 17.4; G.rain = 0;
      setWanted(G, 0);
      G.mode = 'foot'; G.car = null;
      // Out on the sand, looking west-northwest at the sun over the bay.
      G.pos.x = -280; G.pos.z = 160; G.pos.yaw = Math.PI;
      // Face west toward the bay and the setting sun.
      G.camYaw = -2.36;
      if (world.playerMesh) world.playerMesh.group.visible = true;
    },
  },
  mission: {
    label: 'M5 ambush — night, wanted 4, heli up, survive the ambush',
    apply(G, world) {
      G.time = 22.5; G.rain = 0;
      // Re-open M5 for the shot even if the playtest already finished it.
      const m5 = G.missions.find(m => m.id === 'M5');
      if (m5) { m5.done = false; G.missionIdx = G.missions.indexOf(m5); }
      // Start M5 fresh so the banner and timer show.
      if (world.startMissionId) world.startMissionId('M5');
      setWanted(G, 4);
      G.pos.x = -56; G.pos.z = -112; G.pos.yaw = 0;
      G.mode = 'foot'; G.car = null;
      if (world.playerMesh) world.playerMesh.group.visible = true;
      if (world.heli) {
        world.heli.x = -50; world.heli.z = -118; world.heli.altitude = 24;
      }
      if (world.police.length === 0 && world.spawnPolice) world.spawnPolice(2);
      if (world.police[0]) { world.police[0].x = -48; world.police[0].z = -96; world.police[0].yaw = Math.PI; }
      G.camYaw = 0;
      // Keep the briefing hidden so the mission banner reads.
      G.briefing = null;
    },
  },
};

export function applyShot(G, world, name) {
  const p = SHOT_PRESETS[name];
  if (!p) return null;
  p.apply(G, world);
  return p.label;
}

// Shot bookkeeping: which shots exist and their sizes (used by main.ts).
export function shotList() { return ['chase', 'drive', 'foot', 'mission']; }
export function shotMeta(name) {
  return { name, file: `screenshots/${name}.jpg`, width: 1280, height: 800, maxBytes: 256 * 1024 };
}
// A shot is "weak" if the canvas is mostly one flat colour — the harness
// re-shoots in that case.
export function shotIsFlat(pixels) {
  if (!pixels || pixels.length === 0) return true;
  let sum = 0, sum2 = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    sum += v; sum2 += v * v;
  }
  const n = pixels.length / 4;
  const mean = sum / n;
  const variance = sum2 / n - mean * mean;
  return variance < 120;
}
