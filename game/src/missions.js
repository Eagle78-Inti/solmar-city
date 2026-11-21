// missions.js — the 8-mission campaign "The Solmar Reign".
// Each mission has a briefing (every stage listed), scripted dialogue,
// a start point, a destination, and a payout. M5 is a timed survival,
// M7 is a 10-second vault crack, M8 ends with a choice of two endings.
import { dist2d, clamp } from './util.js';
import { addCash, addRespect, bumpDistrict, districtAt, setWanted, currentMission } from './state.js';
import { createCar } from './vehicles.js';

export function startMission(G, world) {
  const m = currentMission(G);
  if (!m || m.done) return false;
  G.missionActive = true;
  G.missionStage = 0;
  G.missionTimer = 0;
  G.vaultTimer = 0;
  G.briefing = m;
  G.briefingStage = 0;
  G.dialogue = m.dialogue.slice();
  G.dialogueIdx = 0;
  // Teleport the player to the mission start and place a mission car.
  G.pos.x = m.from[0]; G.pos.z = m.from[1];
  if (G.mode === 'car') { G.mode = 'foot'; G.car = null; }
  spawnMissionCar(G, world, m);
  if (m.id === 'M4') setWanted(G, 2);
  if (m.id === 'M5') setWanted(G, 4);
  return true;
}

export function spawnMissionCar(G, world, m) {
  // Remove any older mission car first.
  if (world.missionCar) {
    world.scene.remove(world.missionCar.group);
    const i = world.traffic.indexOf(world.missionCar);
    if (i >= 0) world.traffic.splice(i, 1);
    world.missionCar = null;
  }
  const kind = m.id === 'M4' ? 'sports' : 'car';
  const color = m.id === 'M4' ? 0xffc93a : 0xd83a2e;
  const car = createCar(world.scene, {
    x: m.from[0] + 4, z: m.from[1] + 2, color, kind,
    isMission: true, missionId: m.id,
  });
  world.traffic.push(car);
  world.missionCar = car;
  return car;
}

// Advance the mission each frame. Returns 'done' | 'stage' | null.
export function updateMission(G, world, dt) {
  if (!G.missionActive) return null;
  const m = currentMission(G);
  if (!m) return null;
  const px = G.pos.x, pz = G.pos.z;
  let advanced = false;

  if (m.id === 'M1' || m.id === 'M2' || m.id === 'M3' || m.id === 'M4' || m.id === 'M6') {
    // Stage 0: reach the start point (already there after teleport — auto-advance
    // once the player moves a little or the briefing is accepted).
    if (G.missionStage === 0) {
      G.missionStage = 1; advanced = true;
    } else if (G.missionStage === 1) {
      if (dist2d(px, pz, m.to[0], m.to[1]) < 12) {
        if (m.id === 'M4') {
          // M4 has a clear stage: lose the heat first.
          if (G.wanted <= 0) { completeMission(G, world, m); return 'done'; }
          G.missionHint = 'Lose the heat first — stay out of sight.';
        } else if (m.id === 'M6') {
          // M6: the destination is the buyer at the far pier; arriving by boat counts.
          completeMission(G, world, m); return 'done';
        } else {
          completeMission(G, world, m); return 'done';
        }
      }
    }
  } else if (m.id === 'M5') {
    if (G.missionStage === 0) {
      G.missionStage = 1; G.missionTimer = 18; advanced = true;
    } else if (G.missionStage === 1) {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) {
        setWanted(G, 0);
        completeMission(G, world, m); return 'done';
      }
      if (G.health <= 0) { failMission(G, world, m); return 'failed'; }
    }
  } else if (m.id === 'M7') {
    if (G.missionStage === 0) {
      G.missionStage = 1; advanced = true;
    } else if (G.missionStage === 1) {
      // Reach the vault under Downtown (the mission start point).
      if (dist2d(px, pz, m.from[0], m.from[1]) < 12) {
        G.missionStage = 2; G.vaultTimer = 10; advanced = true;
      }
    } else if (G.missionStage === 2) {
      G.vaultTimer -= dt;
      if (G.vaultTimer <= 0) {
        completeMission(G, world, m); return 'done';
      }
    }
  } else if (m.id === 'M8') {
    if (G.missionStage === 0) {
      G.missionStage = 1; advanced = true;
    } else if (G.missionStage === 1) {
      // Return to the vault (the mission start point).
      if (dist2d(px, pz, m.from[0], m.from[1]) < 12) {
        G.missionStage = 2; // choice stage — the UI offers two endings
        advanced = true;
      }
    }
  }
  return advanced ? 'stage' : null;
}

export function chooseEnding(G, world, choice) {
  const m = currentMission(G);
  if (!m || m.id !== 'M8' || G.missionStage !== 2) return false;
  G.ending = choice; // 'Take the Crown' | 'Stay Loyal'
  completeMission(G, world, m);
  return true;
}

export function completeMission(G, world, m) {
  m.done = true;
  G.missionActive = false;
  G.missionStage = 0;
  addCash(G, m.pay);
  // Respect per mission: 10, 15, 15, 20, 10, 10, 10, 10 → 100 total.
  const respectGain = { M1: 10, M2: 15, M3: 15, M4: 20, M5: 10, M6: 10, M7: 10, M8: 10 }[m.id] || 10;
  addRespect(G, respectGain);
  const d = districtAt(G, m.to[0], m.to[1]);
  bumpDistrict(G, d.name, 35);
  // The start district is won too: the crew's name spreads at both ends.
  const ds = districtAt(G, m.from[0], m.from[1]);
  if (ds.name !== d.name) bumpDistrict(G, ds.name, 35);
  if (m.id === 'M6') bumpDistrict(G, 'Marina Bay', 20);
  if (m.id === 'M7') bumpDistrict(G, 'Downtown', 20);
  G.missionComplete = { id: m.id, name: m.name, pay: m.pay, at: Date.now() };
  // Advance to the next mission.
  const next = G.missions.find(x => !x.done);
  G.missionIdx = next ? G.missions.indexOf(next) : G.missions.length;
  if (world.missionCar) {
    world.scene.remove(world.missionCar.group);
    const i = world.traffic.indexOf(world.missionCar);
    if (i >= 0) world.traffic.splice(i, 1);
    world.missionCar = null;
  }
}

export function failMission(G, world, m) {
  G.missionActive = false;
  G.missionStage = 0;
  G.health = 50;
  G.pos.x = m.from[0]; G.pos.z = m.from[1];
  G.missionFailed = { id: m.id, name: m.name };
}

// Briefing text helpers for the HUD.
export function briefingLines(G) {
  const m = G.briefing;
  if (!m) return [];
  return [
    `${m.id} · ${m.name} — ${'$' + m.pay.toLocaleString()}`,
    `Act ${m.act} of 3`,
    m.brief,
    ...m.stages.map((s, i) => `${i + 1}. ${s}`),
  ];
}
export function missionProgressText(G) {
  const m = currentMission(G);
  if (!m) return 'All missions complete — Solmar is yours.';
  if (!G.missionActive) return `${m.id} · ${m.name} — press E to start`;
  if (m.id === 'M5' && G.missionStage === 1) {
    return `${m.id} · ${m.name} — Survive the ambush — ${Math.ceil(G.missionTimer)}s`;
  }
  if (m.id === 'M7' && G.missionStage === 2) {
    return `${m.id} · ${m.name} — Cracking the vault — ${Math.ceil(G.vaultTimer)}s`;
  }
  if (m.id === 'M8' && G.missionStage === 2) {
    return `${m.id} · ${m.name} — Choose your ending`;
  }
  const stage = m.stages[Math.min(G.missionStage, m.stages.length - 1)];
  return `${m.id} · ${m.name} — ${stage}`;
}
export function actsSummary(G) {
  const acts = [1, 2, 3].map(a => {
    const ms = G.missions.filter(m => m.act === a);
    const done = ms.filter(m => m.done).length;
    return { act: a, done, total: ms.length };
  });
  return acts;
}
// The debug harness drives missions through these three calls.
export function debugStart(G, world, id) {
  const i = G.missions.findIndex(m => m.id === id);
  if (i < 0) return false;
  G.missionIdx = i;
  return startMission(G, world);
}
