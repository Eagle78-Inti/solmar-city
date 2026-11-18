// Solmar City v4 — screenshot staging: each named shot puts the player, the
// time of day, the wanted level and the police exactly where the frame needs
// them, so one load of the page is one finished screenshot.
export function stageShot(G, name) {
  if (name === 'chase') {
    G.setTime(21.4);
    G.teleportCar(0, 40, 0);
    G.setWanted(3);
    const pp = G.playerPos();
    G.police.cars.forEach((c, i) => {
      const a = i * 1.7 + 0.6;
      c.group.position.set(pp.x + Math.cos(a) * 26, 0, pp.z + Math.sin(a) * 26 - 18);
      c.speed = 12;
    });
    G.missions.override = 'The Getaway — lose the cops';
  } else if (name === 'drive') {
    G.setTime(13.5);
    G.teleportCar(-120, 60, 0);
    G.car.speed = 12;
    G.setWanted(0);
    G.missions.override = 'Cruise Bay Avenue';
  } else if (name === 'foot') {
    G.setTime(18.4);
    G.exitCar();
    G.teleportPlayer(-128, 10, Math.PI / 2);
    G.setWanted(0);
    G.missions.override = 'On foot — Bay Avenue. Press E near a car to take it.';
  } else if (name === 'mission') {
    G.setTime(23.2);
    G.teleportCar(60, 60, -Math.PI * 0.75);
    G.setWanted(4);
    G.police.orbit = Math.PI * 0.25;
    G.camLift = 5;
    G.missions.override = "IT'S A SETUP — RUN!";
  }
  G.state = 'playing';
  G.hud.hideStart();
}

export const SHOT_NAMES = ['chase', 'drive', 'foot', 'mission'];
