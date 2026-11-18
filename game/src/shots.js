// Solmar City — screenshot mode: deterministic scene setups chosen by the
// ?shot= query (?shot=chase|foot|drive|mission&seed=N). The game auto-starts,
// the scene is staged, and the capture script screenshots the live render.
// Every shot shows the HUD, the minimap and several systems at once.
import { Car } from './vehicles.js';

// Place pursuit cars at fixed offsets behind the player for a chase frame.
function stagePolice(game, wanted, offsets) {
  const police = game.police;
  police.clear();
  police.wanted = wanted;
  police.heat = wanted * 18 + 10;
  const pos = game.player.pos();
  for (const [ox, oz] of offsets) {
    const car = new Car(game.scene, pos.x + ox, pos.z + oz, game.player.inCar ? game.player.inCar.heading : 0,
      0xf2f2f2, { police: true, maxSpeed: 34, accel: 17 });
    police.cars.push(car);
  }
}

function spawnPlayerCar(game, x, z, heading, color, speed) {
  const car = new Car(game.scene, x, z, heading, color, { maxSpeed: 40, accel: 16 });
  car.speed = speed || 0;
  game.playerCar = car;
  game.player.enterCar(car);
  return car;
}

export function applyShot(name, game) {
  const P = game.player;
  game.shotMode = true;
  if (name === 'chase') {
    // Cover: night chase, 3 stars, police cutting you off ahead, getaway objective.
    game.setTimeOfDay(21.4);
    spawnPlayerCar(game, 0, -60, 0, 0xc23b2e, 24);
    game.missions.active = { def: game.missions.defs[1], step: 2, waitT: 0 };
    // police staged AHEAD of the player (in frame, cutting across), frozen
    stagePolice(game, 3, [[-7, 30], [8, 40], [0, 52]]);
    game.police.frozen = true;
    game.cash = 4820; game.respect = 34;
    game.hud.setObjective('The Getaway', 'Lose the heat — reach the safehouse');
  } else if (name === 'foot') {
    // Dusk on foot, standing on Bay Avenue looking north down the street:
    // neon, taxi waiting, peds, mission marker ahead.
    game.setTimeOfDay(18.6);
    P.x = 52; P.z = -40; P.heading = 0;
    P.mesh.position.set(52, 0, -40);
    game.camYaw = 0;
    game.cash = 1250; game.respect = 12;
    game.hud.setObjective('First Day on the Job', 'Go to the yellow marker to start · Mari Voss');
    // a taxi waits nearby
    const taxi = new Car(game.scene, 59, -28, Math.PI / 2, 0xe0b93c, { taxi: true, maxSpeed: 12, accel: 6 });
    game.shotExtras = [taxi];
  } else if (name === 'drive') {
    // Daytime cruise through traffic on Bay Avenue.
    game.setTimeOfDay(13.5);
    spawnPlayerCar(game, 104, -104, Math.PI / 2, 0x2e6fc2, 18);
    game.cash = 2340; game.respect = 21;
    game.hud.setObjective('Free roam', 'Taxi fares (T), pier races, 20 coins to find');
  } else if (name === 'mission') {
    // Midnight setup: 4 stars, helicopter overhead ahead, escape to the hideout.
    game.setTimeOfDay(23.4);
    spawnPlayerCar(game, -190, 0, Math.PI / 2, 0x8a5fc2, 20);
    game.missions.active = { def: game.missions.defs[4], step: 1, waitT: 0 };
    // police staged ahead (in frame), heli held ahead of the player, frozen
    stagePolice(game, 4, [[30, -7], [40, 7]]);
    game.police.frozen = true;
    game.police.heliAngle = Math.PI / 2; // heli sits ahead (+x) of the player
    game.cash = 9100; game.respect = 61;
    game.hud.setObjective('IT’S A SETUP — RUN!', 'Mari tipped the cops. Lose them and get to the hideout!');
  }
  game.hud.show();
  game.hud.setCash(game.cash);
  game.hud.setRespect(game.respect);
  game.hud.setStars(game.police.wanted);
  game.hud.setHealth(P.health / 100);
  game.hud.setSpeed(P.speedKmh(), !!P.inCar);
}
