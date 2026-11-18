// Solmar City — screenshot staging. The screenshots are real renders of the
// game, but the game can be asked (with ?shot=chase&seed=1 in the URL) to set
// a scene first: time of day, wanted level, police and traffic placed in
// frame, the right mission objective on the HUD. Nothing is faked: the scene
// is the live game, staged, then played for a few seconds before the shot.
import * as THREE from 'three';
import { Car } from './vehicles.js';

function putPlayerInCar(g, x, z, heading, color, type = 'sedan') {
  const car = new Car(g.scene, { color, type, x, z, heading });
  car.parked = false;
  g.parkedCars.push(car);
  g.player.enterCar(car);
  g.player.camYaw = heading + Math.PI;
  return car;
}

function placeTrafficNear(g, x, z, heading, count = 4) {
  const f = { x: Math.sin(heading), z: Math.cos(heading) };
  const r = { x: f.z, z: -f.x };
  for (let i = 0; i < count; i++) {
    const t = g.traffic[i % g.traffic.length];
    const ahead = 14 + i * 11;
    const side = (i % 2 === 0 ? 2.4 : -2.4) + (i % 3 === 0 ? 0 : 0);
    t.pos.set(x + f.x * ahead + r.x * side, 0, z + f.z * ahead + r.z * side);
    t.heading = heading;
    t.along = 0;
    t.speed = 6 + i;
  }
}

function stagePolice(g, x, z, heading, count) {
  const f = { x: Math.sin(heading), z: Math.cos(heading) };
  const r = { x: f.z, z: -f.x };
  // NOTE: do not clear() here — clear() resets the wanted level to 0, and
  // the caller sets the wanted level BEFORE staging the cruisers. Callers
  // that need a clean slate call g.police.clear() before setWanted().
  for (let i = 0; i < count; i++) {
    const ahead = 16 + i * 9;
    const side = i % 2 === 0 ? 2.4 : -2.4;
    const car = new Car(g.scene, { color: 0xf0f0ee, type: 'police', x: x + f.x * ahead + r.x * side, z: z + f.z * ahead + r.z * side, heading: heading + Math.PI });
    g.police.cars.push(car);
  }
}

export function stageShot(g, name) {
  const p = g.player;
  g.started = true;
  g.paused = false;
  g.hud.hideStart();
  g.audio.unlock();
  if (name === 'chase') {
    // Night chase: 3 stars, cruisers cutting you off ahead, "The Getaway".
    g.city.setHour(21.4);
    const x = 0, z = -44, heading = 0; // heading north up Coral Way (x = 0 road)
    putPlayerInCar(g, x, z, heading, 0xc8102e, 'coupe');
    g.player.car.speed = 19;
    g.missions.setMission(1, 2);
    g.missions.setObjective('The Getaway — Lose the heat — reach the safehouse — 2 stars and climbing. Drive!');
    g.police.clear();
    g.police.setWanted(3);
    stagePolice(g, x, z, heading, 3);
    placeTrafficNear(g, x, z, heading, 3);
    g.missions.cash = 4820;
    g.missions.respect = 34;
    p.camYaw = heading + Math.PI;
  } else if (name === 'drive') {
    // Sun-soaked day drive: blue car, traffic, downtown towers.
    g.city.setHour(13.5);
    const x = 44, z = -44, heading = Math.PI / 2; // east along 44th (not the office, so the mission does not complete mid-shot)
    putPlayerInCar(g, x, z, heading, 0x1c4fd6, 'sedan');
    g.player.car.speed = 15;
    g.missions.setObjective('Free roam — Solmar City');
    g.missions.setMission(0, 2);
    g.missions.setObjective('Mission 1 — First Wheels: drive to Mari\'s office');
    placeTrafficNear(g, x, z, heading, 5);
    p.camYaw = heading + Math.PI;
  }

  else if (name === 'foot') {
    // Dusk on foot on Bay Avenue: Rook on the sidewalk facing the bay and
    // the setting sun, taxi waiting at the kerb, neon coming on, palms and
    // the water ahead. Rook faces WEST so the third-person camera sits over
    // the open road to the east — facing east put the camera inside the
    // beach-side buildings and the shot was a wall.
    g.city.setHour(18.4);
    const x = -176, z = -20, heading = -Math.PI / 2; // facing west, bay ahead
    p.respawn(x, z, heading);
    p.camYaw = heading + Math.PI;
    // A taxi idling at the kerb beside Rook, in frame ahead-left.
    const taxi = new Car(g.scene, { color: 0xf2c200, type: 'taxi', x: x - 4, z: z + 3.4, heading: -Math.PI / 2 });
    g.parkedCars.push(taxi);
    // A couple of walkers on the sidewalk for life, ahead of Rook.
    for (let i = 0; i < 3; i++) {
      const ped = g.peds[i];
      ped.pos.set(x - 3 - i * 2.5, 0, z - 2 - i);
      ped.heading = heading;
      ped.state = 'walk';
    }
    g.missions.setObjective('On foot — Bay Avenue. Press E near a car to take it.');
    g.missions.cash = 391;
    g.missions.respect = 12;
  } else if (name === 'mission') {
    // The Setup: 4 stars, the helicopter and its searchlight over the casino,
    // neon everywhere, "IT'S A SETUP — RUN!".
    g.city.setHour(23.4);
    const x = 88, z = -88, heading = Math.PI; // south on the casino road
    putPlayerInCar(g, x, z, heading, 0x7a1fa2, 'sport');
    g.player.car.speed = 14;
    g.missions.setMission(4, 2);
    g.missions.setObjective('The Setup — IT\'S A SETUP — RUN! — Mari tipped the cops. Lose them and get to the hideout!');
    g.police.clear();
    g.police.setWanted(4);
    stagePolice(g, x, z, heading, 4);
    g.police.ensureHeli();
    g.police.heliAngle = 4.5; // heli AHEAD of the player, beam sweeping down to the car — behind the camera it put the cone straight across the frame
    g.police.heliRadius = 40; // further out and lower so the heli itself reads in frame (overhead at 42 m it is above the camera's view)
    g.police.heliHeight = 26;
    placeTrafficNear(g, x, z, heading, 2);
    g.missions.cash = 9100;
    g.missions.respect = 61;
    p.camYaw = heading + Math.PI;
  }
  g.hud.refresh();
}
