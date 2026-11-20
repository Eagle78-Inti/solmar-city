// shots.js — the four screenshot presets. Each one stages the game into a
// moment worth judging: the chase, the drive, the beach on foot, the mission.
// The mission shot is the M5 night ambush at wanted 4 with the heli up;
// the foot shot is the beach at golden hour, looking west over the bay.

import { G } from './state.js';
import { input } from './player.js';
import { setTimeOfDay, setWeather } from './graphics.js';
import { createCar } from './vehicles.js';
import { beginStage, startMission } from './missions.js';
import { setWanted } from './police.js';

/** Put the player in a car at a spot, facing a direction. */
function stageDrive(x, z, yaw, kind) {
  const p = G.player;
  const car = createCar(kind || 'taxi', x, z, yaw, { cruise: 12 });
  car.isPlayer = true;
  p.vehicle = car;
  p.onFoot = false;
  p.mesh.visible = false;
  p.pos.copy(car.mesh.position);
  p.yaw = yaw;
  input.camYaw = yaw + Math.PI;
  return car;
}

/** Stage a named shot. Returns a short description for the log. */
export function shot(name) {
  const p = G.player;
  if (!p) return 'no player';
  // Reset to a clean on-foot state first.
  if (p.vehicle) {
    p.vehicle.isPlayer = false;
    p.vehicle = null;
  }
  p.onFoot = true;
  p.mesh.visible = true;
  G.mapOpen = false;
  G.paused = false;
  G.shop.open = false;
  G.briefing = null;
  if (name === 'chase') {
    // Night, five stars, the heli's searchlight, a police car ramming.
    setTimeOfDay(22.5);
    setWeather('clear');
    const car = stageDrive(10, 0, 0, 'taxi');
    car.speed = 12;
    setWanted(5);
    const cop = createCar('police', 6, -8, 0, { cruise: 18 });
    cop.isPolice = true;
    G.police.push(cop);
    G.missionText = 'First Wheels';
    G.missionSub = 'Go see Marta at the corner';
    input.camYaw = Math.PI + 0.4;
    return 'chase: night 22:30, wanted 5, heli up, police ramming the taxi';
  }
  if (name === 'drive') {
    // Golden-hour dusk drive down the main avenue, lit facades.
    setTimeOfDay(18.2);
    setWeather('clear');
    setWanted(0);
    const car = stageDrive(0, 100, 0, 'taxi');
    car.speed = 14;
    G.missionText = 'First Wheels';
    G.missionSub = 'Go see Marta at the corner';
    input.camYaw = Math.PI;
    return 'drive: dusk 18:12, taxi at 36 mph, lit facades';
  }
  if (name === 'foot') {
    // The beach at golden hour, looking west over the bay: palms, yachts,
    // umbrellas, the sun low over the water.
    setTimeOfDay(17.6);
    setWeather('clear');
    setWanted(0);
    p.pos.set(-305, 0, 40);
    p.mesh.position.copy(p.pos);
    p.yaw = -Math.PI / 2; // face west, out over the bay
    input.camYaw = -Math.PI / 2 + Math.PI; // camera behind, looking west
    input.camPitch = 0.15;
    G.missionText = 'First Wheels';
    G.missionSub = 'Go see Marta at the corner';
    return 'foot: beach at golden hour, looking west at the bay';
  }
  if (name === 'mission') {
    // The M5 ambush: night, wanted 4, the heli up, the player on foot in
    // Old Town with police closing in.
    setTimeOfDay(22.5);
    setWeather('clear');
    startMission(5);
    if (G.briefing) {
      G.briefing = null;
      G.missionStage = 1;
      beginStage();
      G.missionText = 'Set Up';
      G.missionSub = 'Survive the ambush — 18s';
    }
    p.pos.set(-56, 0, -112);
    p.mesh.position.copy(p.pos);
    p.yaw = Math.PI;
    setWanted(4);
    // Two police cars already closing in, so the ambush reads in frame.
    const cop1 = createCar('police', -40, -100, Math.PI / 2, { cruise: 16 });
    cop1.isPolice = true;
    G.police.push(cop1);
    const cop2 = createCar('police', -72, -126, -Math.PI / 2, { cruise: 16 });
    cop2.isPolice = true;
    G.police.push(cop2);
    input.camYaw = 0.6;
    input.camPitch = 0.34;
    return 'mission: M5 ambush, night 22:30, wanted 4, heli up';
  }
  return 'unknown shot: ' + name;
}
