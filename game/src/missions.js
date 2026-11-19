// Solmar City — the story: five missions for Rook, getaway driver for the
// fixer Mari Voss, plus taxi jobs, Solmar coins and pier street races.

import { dist2d } from './util.js';

export const HIDEOUT = { x: -222, z: 222 };
// Meet point beside Solmar Tower — outside its footprint, so the player can
// actually stand on it (the tower itself is solid).
export const TOWER = { x: 37, z: -62 };

export const MISSIONS = [
  {
    name: 'First Job',
    brief: 'Mari Voss needs a driver. Pick up the package at the pier.',
    payout: 550, respect: 10,
    steps: [
      { text: 'Pick up the package at the pier', x: 262, z: 0, radius: 16 },
      { text: 'Deliver it to the hideout', x: HIDEOUT.x, z: HIDEOUT.z, radius: 12 },
    ],
  },
  {
    name: 'The Bank Job',
    brief: 'Grab the bag from the bank on Meridian Row, then lose the heat.',
    payout: 1350, respect: 15,
    steps: [
      { text: 'Reach the bank on Meridian Row', x: 111, z: 37, radius: 12 },
      { text: 'Grab the bag — the cops are coming', x: 111, z: 37, radius: 10, wanted: 2 },
      { text: 'Lose the heat — reach the hideout', x: HIDEOUT.x, z: HIDEOUT.z, radius: 12 },
    ],
  },
  {
    name: 'The Courier',
    brief: 'Three drops across the city. No questions, no stops.',
    payout: 1800, respect: 15,
    steps: [
      { text: 'Drop 1: the north market', x: -148, z: -148, radius: 12 },
      { text: 'Drop 2: the marina flats', x: 148, z: 74, radius: 12 },
      { text: 'Drop 3: the south docks', x: -74, z: 222, radius: 12 },
      { text: 'Report back to the tower', x: TOWER.x, z: TOWER.z, radius: 12 },
    ],
  },
  {
    name: 'Pier Pressure',
    brief: 'A street race down the pier road. Beat the checkpoints.',
    payout: 2200, respect: 20,
    steps: [
      { text: 'Race checkpoint 1', x: 148, z: -148, radius: 14 },
      { text: 'Race checkpoint 2', x: 148, z: 148, radius: 14 },
      { text: 'Race checkpoint 3 — finish line', x: -148, z: 148, radius: 14 },
    ],
  },
  {
    name: 'The Setup',
    brief: 'Meet Mari at the tower for the big one. Something feels wrong.',
    payout: 3000, respect: 20,
    steps: [
      { text: 'Meet Mari at Solmar Tower', x: TOWER.x, z: TOWER.z, radius: 12 },
      { text: "IT'S A SETUP — RUN!", x: HIDEOUT.x, z: HIDEOUT.z, radius: 12, wanted: 4 },
    ],
  },
];

export function createMissions(G, hooks) {
  // hooks: { onStep(text), onComplete(mission), onTwist(), setWanted(n), banner(title, sub) }
  const state = { index: 0, step: 0, active: false, done: false, waypoint: null, objective: '' };

  function current() {
    return MISSIONS[state.index] || null;
  }

  function start() {
    const m = current();
    if (!m || state.active) return;
    state.active = true;
    state.step = 0;
    applyStep();
    hooks.banner('Mission ' + (state.index + 1) + ': ' + m.name, m.brief);
  }

  function applyStep() {
    const m = current();
    const s = m.steps[state.step];
    state.waypoint = { x: s.x, z: s.z, radius: s.radius };
    state.objective = s.text;
    if (s.wanted) hooks.setWanted(s.wanted);
    hooks.onStep(s.text);
  }

  function update(playerPos) {
    if (!state.active || state.done) return;
    const m = current();
    if (!m || !state.waypoint) return;
    if (dist2d(playerPos.x, playerPos.z, state.waypoint.x, state.waypoint.z) < state.waypoint.radius) {
      state.step++;
      if (state.step >= m.steps.length) {
        complete(m);
      } else {
        if (state.index === 4 && state.step === 1) hooks.onTwist();
        applyStep();
      }
    }
  }

  function complete(m) {
    state.active = false;
    G.cash += m.payout;
    G.respect += m.respect;
    // finishing a job cools the heat a little
    if (hooks.coolWanted) hooks.coolWanted(1);
    hooks.banner('Mission complete: ' + m.name, '+$' + m.payout.toLocaleString() + '  ·  +' + m.respect + ' respect');
    hooks.onComplete(m);
    state.index++;
    state.waypoint = null;
    state.objective = state.index < MISSIONS.length ? 'Press M to start: ' + MISSIONS[state.index].name : 'Story complete — Solmar is yours.';
    if (state.index >= MISSIONS.length) state.done = true;
  }

  function objectiveText() {
    if (state.active) return state.objective;
    if (state.done) return 'Story complete — Solmar is yours.';
    return 'Press M to start: ' + MISSIONS[state.index].name;
  }

  return { state, current, start, update, objectiveText };
}

// --- side activities: taxi jobs, Solmar coins, repeatable pier races ---

export function createTaxi(G, city, hooks) {
  const state = { active: false, phase: 0, px: 0, pz: 0, dx: 0, dz: 0, fare: 0, waypoint: null, objective: '' };
  function toggle(playerPos) {
    if (state.active) {
      state.active = false;
      state.waypoint = null;
      hooks.toast('Taxi job cancelled');
      return;
    }
    const p = city.randomStreetPos();
    state.px = p.x;
    state.pz = p.z;
    state.phase = 0;
    state.active = true;
    state.waypoint = { x: p.x, z: p.z, radius: 12 };
    state.objective = 'Taxi: pick up the fare';
    hooks.toast('Taxi job: pick up the passenger');
  }
  function update(playerPos) {
    if (!state.active || !state.waypoint) return;
    if (dist2d(playerPos.x, playerPos.z, state.waypoint.x, state.waypoint.z) < state.waypoint.radius) {
      if (state.phase === 0) {
        const d = city.randomStreetPos();
        state.dx = d.x;
        state.dz = d.z;
        const trip = Math.round(dist2d(state.px, state.pz, state.dx, state.dz));
        state.fare = 120 + Math.round(trip * 0.35);
        state.phase = 1;
        state.waypoint = { x: state.dx, z: state.dz, radius: 12 };
        state.objective = 'Taxi: drop off the passenger';
        hooks.toast('Passenger aboard — take them to the marker');
      } else {
        G.cash += state.fare;
        hooks.banner('Taxi fare paid', '+$' + state.fare);
        hooks.onFare(state.fare);
        state.active = false;
        state.waypoint = null;
        state.objective = '';
      }
    }
  }
  return { state, toggle, update };
}

// 20 glowing coins scattered around the city, $50 each.
export function createCoins(THREE, scene, city) {
  const coins = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0xffb020, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25 });
  const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 18);
  const spots = [];
  for (let k = 0; k < 20; k++) {
    const p = city.randomStreetPos();
    spots.push(p);
  }
  for (const p of spots) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, 1.1, p.z);
    scene.add(m);
    coins.push({ mesh: m, x: p.x, z: p.z, taken: false, spin: Math.random() * 6 });
  }
  function update(dt, playerPos, onCoin) {
    for (const c of coins) {
      if (c.taken) continue;
      c.spin += dt * 2.4;
      c.mesh.rotation.y = c.spin;
      c.mesh.position.y = 1.1 + Math.sin(c.spin * 1.6) * 0.25;
      if (dist2d(playerPos.x, playerPos.z, c.x, c.z) < 2.2) {
        c.taken = true;
        c.mesh.visible = false;
        onCoin(50);
      }
    }
  }
  function countTaken() {
    return coins.filter((c) => c.taken).length;
  }
  return { coins, update, countTaken };
}

// A quick repeatable race: drive onto the pier start marker, then hit the
// three pier checkpoints in order for a $300 payout.
export function createPierRace(G, hooks) {
  const state = { active: false, step: 0, waypoint: null, objective: '' };
  const START = { x: 300, z: -120 };
  const CHECKS = [
    { x: 380, z: -120, radius: 10 },
    { x: 380, z: 120, radius: 10 },
    { x: 300, z: 120, radius: 10 },
  ];
  function update(playerPos) {
    if (!state.active) {
      if (dist2d(playerPos.x, playerPos.z, START.x, START.z) < 10) {
        state.active = true;
        state.step = 0;
        state.waypoint = CHECKS[0];
        state.objective = 'Pier race: checkpoint 1';
        hooks.toast('Pier race started — hit the checkpoints!');
      }
      return;
    }
    if (dist2d(playerPos.x, playerPos.z, state.waypoint.x, state.waypoint.z) < state.waypoint.radius) {
      state.step++;
      if (state.step >= CHECKS.length) {
        G.cash += 300;
        hooks.banner('Pier race won', '+$300');
        state.active = false;
        state.waypoint = null;
        state.objective = '';
      } else {
        state.waypoint = CHECKS[state.step];
        state.objective = 'Pier race: checkpoint ' + (state.step + 1);
      }
    }
  }
  return { state, update, startPos: START };
}
