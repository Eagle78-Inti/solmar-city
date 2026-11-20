// Solmar City v8 — screenshot staging: each shot name arranges the world
// (time of day, player vehicle, wanted level, police, helicopter) and picks a
// camera, so screenshots are real renders of the game, never composites.
import { CITY } from './city.js';

export const SHOT_NAMES = ['chase', 'drive', 'foot', 'mission'];

export function stageShot(name, ctx) {
  const { player, police, traffic, peds, setDayFrac } = ctx;
  // Clear any previous staging.
  police.clear();
  ctx.shotCamera = null;
  ctx.freezeTime = true;
  if (player.inCar) player.exitCar();
  if (player.onBoat) player.exitBoat();

  if (name === 'chase') {
    // Golden-hour dusk, car moving at speed, 3 stars, police on the tail.
    setDayFrac(0.74);
    ctx.spawnPlayerCar(0, -40, 0, 42);
    player.camYaw = 0;
    police.setWanted(3);
    police.update(0.01, player, false, null, null);
    // Place the pursuit cars behind the player's car — and two more AHEAD
    // of it, in the next lanes, so the chase reads in the frame: the follow
    // camera looks forward, and cars behind it are never seen.
    police.cars.forEach((c, i) => {
      if (i < 2) {
        c.x = -4 + i * 8;
        c.z = -40 + 26 + i * 16;
        c.heading = 0;
        c.speed = 34;
      } else {
        c.x = -6 + (i - 2) * 6;
        c.z = -40 - 22 - (i - 2) * 9;
        c.heading = 0;
        c.speed = 30;
      }
    });
    ctx.shotCamera = null; // follow camera behind the car
    return 'chase staged: golden hour, 3 stars, pursuit behind';
  }

  if (name === 'drive') {
    // Bright midday drive through Downtown with traffic around.
    setDayFrac(0.42);
    ctx.spawnPlayerCar(60, 60, Math.PI / 2, 30);
    player.camYaw = Math.PI / 2;
    police.setWanted(0);
    return 'drive staged: midday Downtown, traffic';
  }

  if (name === 'foot') {
    // On foot in Neon Mile at dusk: neon signs lit, pedestrians around.
    setDayFrac(0.72);
    player.x = 180;
    player.z = 20;
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    police.setWanted(0);
    for (let i = 0; i < 6; i++) {
      const ped = peds.peds[i];
      if (ped) {
        ped.x = 168 + i * 5;
        ped.z = 14 + (i % 3) * 6;
      }
    }
    // Wide camera: Leo centre-frame with the neon towers behind him.
    ctx.shotCamera = {
      pos: [164, 7, 2],
      look: [192, 2, 26],
    };
    return 'foot staged: Neon Mile at dusk, on foot';
  }

  if (name === 'mission') {
    // Night, 4 stars, helicopter overhead with its searchlight on the player.
    setDayFrac(0.95);
    ctx.spawnPlayerCar(-190, 250, Math.PI, 0);
    player.camYaw = Math.PI;
    police.setWanted(4);
    police.update(0.01, player, true, null, null);
    const heli = police.helis[0];
    if (heli) {
      heli.angle = Math.PI * 0.75;
      heli.radius = 24;
      heli.height = 22;
      heli.x = player.pos.x + Math.sin(heli.angle) * heli.radius;
      heli.z = player.pos.z + Math.cos(heli.angle) * heli.radius;
      heli.group.position.set(heli.x, heli.height, heli.z);
      // Wide camera: the player car below, the lit helicopter above it.
      ctx.shotCamera = {
        pos: [player.pos.x + 26, 20, player.pos.z - 34],
        look: [(player.pos.x + heli.x) / 2, 8, (player.pos.z + heli.z) / 2],
      };
    }
    // A couple of police cars closing in on the docks road.
    police.cars.forEach((c, i) => {
      c.x = -190 + (i - 1) * 12;
      c.z = 250 - 30 - i * 8;
      c.heading = 0;
      c.speed = 24;
    });
    return 'mission staged: night, 4 stars, helicopter searchlight';
  }

  return 'unknown shot: ' + name;
}

// The screenshot presets used by the local playtest: file names and the
// staging name each one uses, in the order they appear in screenshots/.
export const SHOT_FILES = [
  { file: 'chase.jpg', shot: 'chase' },
  { file: 'drive.jpg', shot: 'drive' },
  { file: 'foot.jpg', shot: 'foot' },
  { file: 'mission.jpg', shot: 'mission' },
];
