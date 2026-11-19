// Solmar City v7 — story: five missions for the fixer Mari Voss, with
// cash and respect payouts and a twist in the last one, plus taxi jobs,
// pier street races and 20 hidden coins.
import * as THREE from 'three';
import { clamp, rand, dist2 } from './util.js';

export const MISSIONS = [
  { name: 'First Job', brief: 'Pick up the package at the pier and bring it to the garage.', pay: 550, respect: 10, steps: [{ x: 330, z: 0, r: 12, label: 'Reach the pier' }, { x: -60, z: -60, r: 12, label: 'Deliver to the garage' }] },
  { name: 'The Bank Job', brief: 'Grab the getaway car, then lose the heat and reach the safehouse.', pay: 1350, respect: 15, steps: [{ x: 120, z: 120, r: 12, label: 'Steal the getaway car' }, { x: -240, z: 240, r: 14, label: 'Lose the cops — reach the safehouse' }] },
  { name: 'Night Run', brief: 'Move the goods across town after dark. Stay fast, stay quiet.', pay: 1800, respect: 15, steps: [{ x: 240, z: -120, r: 12, label: 'Collect the goods' }, { x: -180, z: 180, r: 12, label: 'Deliver across town' }] },
  { name: 'Pier Race', brief: 'Beat the rival crew down the pier road. Win and the crew pays.', pay: 2200, respect: 20, steps: [{ x: 300, z: -120, r: 14, label: 'Get to the start line' }, { x: 300, z: 120, r: 14, label: 'Race to the far pier' }] },
  { name: 'The Setup', brief: 'Mari tipped the cops. It is a setup — run!', pay: 3000, respect: 20, twist: true, steps: [{ x: 0, z: 0, r: 12, label: 'Meet Mari downtown' }, { x: -240, z: 240, r: 14, label: "IT'S A SETUP — RUN!" }] },
];

export function initMissions(G) {
  G.missions = { index: 0, step: 0, done: false, marker: null, taxi: null, race: null };
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 20);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.75 });
  const marker = new THREE.Mesh(geo, mat);
  G.scene.add(marker);
  G.missions.marker = marker;
  spawnCoins(G);
}

function spawnCoins(G) {
  G.coins = [];
  const geo = new THREE.TorusGeometry(0.7, 0.22, 10, 20);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xcc8800, emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.25 });
  for (let i = 0; i < 20; i++) {
    const c = new THREE.Mesh(geo, mat);
    const onRoad = i % 2 === 0;
    c.position.set(onRoad ? (Math.floor(rand(-4, 5)) * 60) + rand(-4, 4) : rand(-250, 250), 1.2, onRoad ? rand(-250, 250) : (Math.floor(rand(-4, 5)) * 60) + rand(-4, 4));
    G.scene.add(c);
    G.coins.push({ mesh: c, taken: false });
  }
}

export function currentMission(G) { return MISSIONS[G.missions.index]; }
export function missionLabel(G) {
  const m = currentMission(G);
  if (!m) return 'All missions complete';
  const s = m.steps[G.missions.step];
  return s ? s.label : m.name;
}

export function updateMissions(G, dt) {
  const M = G.missions;
  const p = G.player;
  // taxi jobs keep working even after the story is done
  if (M.taxi) updateTaxi(G, dt);
  if (M.done) { M.marker.visible = false; return; }
  const m = currentMission(G);
  const s = m.steps[M.step];
  if (s) {
    M.marker.visible = true;
    M.marker.position.set(s.x, 0.4, s.z);
    M.marker.rotation.y += dt * 1.5;
    const d = dist2(p.pos.x, p.pos.z, s.x, s.z);
    if (d < s.r * s.r) {
      M.step++;
      G.audio.step();
      if (m.twist && M.step === 1) {
        G.wanted = 4;
        G.banner("IT'S A SETUP — RUN!", 'Mari tipped the cops');
        G.audio.sirenBlip();
      } else {
        G.toast(s.label + ' — done');
      }
      if (M.step >= m.steps.length) completeMission(G);
    }
  }
  // coins
  for (const c of G.coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1.2 + Math.sin(G.elapsed * 2 + c.mesh.position.x) * 0.15;
    if (dist2(p.pos.x, p.pos.z, c.mesh.position.x, c.mesh.position.z) < 4) {
      c.taken = true; G.scene.remove(c.mesh);
      p.cash += 50; p.coins++;
      G.audio.coin(); G.toast('Coin +$50');
      G.save();
    }
  }
}

function completeMission(G) {
  const M = G.missions;
  const m = currentMission(G);
  const p = G.player;
  p.cash += m.pay; p.respect += m.respect;
  G.banner(`MISSION COMPLETE — ${m.name}`, `+$${m.pay.toLocaleString('en-US')}  ·  +${m.respect} respect`);
  G.audio.win();
  M.index++;
  M.step = 0;
  if (M.index >= MISSIONS.length) {
    M.done = true;
    G.banner('ALL MISSIONS COMPLETE', 'Solmar City is yours, Rook');
  }
  G.save();
}

export function startTaxi(G) {
  const M = G.missions;
  const p = G.player;
  if (M.taxi) { G.toast('Taxi job cancelled'); M.taxi = null; return; }
  let best = null, bd = 30 * 30;
  for (const ped of G.peds) {
    const d = dist2(p.pos.x, p.pos.z, ped.group.position.x, ped.group.position.z);
    if (d < bd) { bd = d; best = ped; }
  }
  if (!best) { G.toast('No passenger nearby — drive closer to the sidewalk'); return; }
  const dest = { x: (Math.floor(rand(-4, 5)) * 60), z: (Math.floor(rand(-4, 5)) * 60) };
  M.taxi = { ped: best, dest, fare: 0, picked: false };
  G.toast('Taxi job: pick up the passenger');
  G.audio.taxi();
}

function updateTaxi(G, dt) {
  const M = G.missions;
  const t = M.taxi;
  const p = G.player;
  const target = t.picked ? t.dest : { x: t.ped.group.position.x, z: t.ped.group.position.z };
  M.marker.visible = true;
  M.marker.position.set(target.x, 0.4, target.z);
  M.marker.rotation.y += dt * 1.5;
  const d = dist2(p.pos.x, p.pos.z, target.x, target.z);
  if (!t.picked && d < 36) {
    t.picked = true;
    G.toast('Passenger in — drive to the marker');
  } else if (t.picked && d < 100) {
    const fare = 120 + Math.floor(rand(60, 220));
    p.cash += fare;
    G.banner(`FARE PAID +$${fare}`, 'Nice driving, Rook');
    G.audio.win();
    M.taxi = null;
    G.save();
  }
}

// Pier sprint: outside missions, driving the full pier road (z -120 to
// z +120 at x 300) in under 25 seconds pays a $150 bonus.
export function checkPierSprint(G) {
  const p = G.player;
  if (!p.car) return;
  const x = p.pos.x, z = p.pos.z;
  if (!G.sprint) {
    if (x > 295 && Math.abs(z + 120) < 12 && Math.abs(p.car.speed) > 5) G.sprint = { t: 0, from: -120 };
  } else {
    G.sprint.t += 1 / 60;
    if (x > 295 && Math.abs(z - 120) < 12) {
      if (G.sprint.t < 25) {
        p.cash += 150;
        G.banner('PIER SPRINT +$150', `${G.sprint.t.toFixed(1)}s down the pier road`);
        G.audio.win();
        G.save();
      } else G.toast('Pier sprint too slow — try again');
      G.sprint = null;
    } else if (x < 280 || G.sprint.t > 40) G.sprint = null;
  }
}

export function missionProgress(G) {
  const M = G.missions;
  if (M.done) return '5/5 complete';
  return `Mission ${M.index + 1}/5 — step ${M.step + 1}/${currentMission(G).steps.length}`;
}

// Jump straight to a mission (debug / screenshot staging only).
export function debugSetMission(G, index, step = 0) {
  G.missions.index = Math.max(0, Math.min(MISSIONS.length - 1, index));
  G.missions.step = step;
  G.missions.done = false;
}
