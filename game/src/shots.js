// Solmar City — screenshot staging: deterministic setups for the four
// screenshots, driven by window.SOLMAR.stage(name) or ?shot=name in the URL.
// Each one shows several systems at once: the chase, the drive, on foot at
// dusk, and the final mission with the helicopter.
import { SPOTS } from './city.js';

export function stageShot(G, name) {
  const P = G.player;
  // Clear any live wanted/police first so each shot starts clean.
  G.setWanted(0);
  G.police.clear();
  if (name === 'chase') {
    G.dayT = 0.72; // deep night
    G.missions.index = 1; G.missions.phase = 'escape';
    G.missions.setObjective();
    P.teleport(20, -40, Math.PI);
    G.enterCar(G.playerCar, true);
    G.playerCar.speed = 9;
    G.setWanted(3);
    G.police.stageChase(20, -40, Math.PI, 4);
    G.camYaw = Math.PI; G.snapCamera();
  } else if (name === 'drive') {
    G.dayT = 0.3; // bright late morning
    G.missions.index = 0; G.missions.phase = 'go';
    G.missions.setObjective();
    P.teleport(60, -100, 0);
    G.enterCar(G.playerCar, true);
    G.playerCar.speed = 10;
    G.camYaw = 0; G.snapCamera();
  } else if (name === 'foot') {
    G.dayT = 0.52; // dusk, sun setting over the bay to the west
    G.missions.index = 0; G.missions.phase = 'go';
    G.missions.setObjective();
    P.teleport(-138, 20, -Math.PI / 2); // face west, into the sunset; taxi ahead-left
    P.onFoot = true; P.mesh.visible = true;
    G.playerCar.mesh.visible = false;
    G.camYaw = -Math.PI / 2; G.snapCamera();
  } else if (name === 'mission') {
    G.dayT = 0.78; // night
    G.missions.index = 4; G.missions.phase = 'escape';
    G.missions.setObjective();
    P.teleport(100, 40, Math.PI);
    G.enterCar(G.playerCar, true);
    G.playerCar.speed = 8;
    G.setWanted(4);
    G.police.stageChase(100, 40, Math.PI, 5);
    G.camYaw = Math.PI; G.snapCamera();
  }
  G.hud.update();
}

  // Stage from the URL (?shot=chase) once the game has booted.
  export function stageFromUrl(G) {
    const name = new URLSearchParams(location.search).get('shot');
    if (name && ['chase', 'drive', 'foot', 'mission'].includes(name)) {
      G.started = true;
      G.hud.hideMenu();
      stageShot(G, name);
      return name;
    }
    return null;
  }
