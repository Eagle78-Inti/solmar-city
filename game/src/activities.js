// activities.js — taxi, courier, the Neon Mile Sprint race, stunt jumps,
// and the 21 hidden packages (3 per district).
import * as THREE from 'three';
import { dist2d, rand, clamp } from './util.js';
import { addCash, bumpDistrict, districtAt } from './state.js';

export function packagePositions() {
  // 21 fixed spots, 3 per district, spread across the map.
  return [
    [-20, -60], [30, -20], [-60, -90],           // Downtown
    [120, -30], [150, 20], [90, 30],             // Neon Mile
    [-140, -100], [-100, -50], [-160, -40],      // Old Town
    [-240, 20], [-200, 70], [-260, -10],         // Marina Bay
    [-220, 160], [-160, 200], [-280, 190],       // Kumala Beach
    [60, 120], [110, 160], [40, 170],            // Portside
    [220, -120], [260, -160], [190, -170],       // Palms Suburb
  ];
}

export function buildPackages(scene, G) {
  const spots = packagePositions();
  const pkgs = [];
  const geo = new THREE.BoxGeometry(1.1, 0.8, 1.1);
  for (let i = 0; i < spots.length; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc93a, emissiveIntensity: 2.2 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(spots[i][0], 0.7, spots[i][1]);
    m.castShadow = true;
    scene.add(m);
    pkgs.push({ mesh: m, x: spots[i][0], z: spots[i][1], found: false, idx: i });
  }
  G.packages = pkgs;
  return pkgs;
}

export function checkPackages(G) {
  let found = 0;
  for (const p of G.packages) {
    if (!p.found && dist2d(G.pos.x, G.pos.z, p.x, p.z) < 4) {
      p.found = true;
      p.mesh.visible = false;
      G.packagesFound += 1;
      addCash(G, 150);
      const d = districtAt(G, p.x, p.z);
      bumpDistrict(G, d.name, 5);
      G.lastPackage = p.idx;
    }
    if (p.found) found += 1;
  }
  return found;
}

// --- stunt jumps -----------------------------------------------------------
export function jumpPositions() {
  return [
    [-40, 0, 0], [40, -80, 1], [120, 80, 2], [-200, 120, 3], [200, -60, 0],
  ];
}
export function buildJumps(scene, G) {
  const jumps = [];
  const geo = new THREE.BoxGeometry(8, 1.2, 4);
  for (const [x, z, ry] of jumpPositions()) {
    const ramp = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffc93a, roughness: 0.6 }));
    ramp.position.set(x, 0.6, z);
    ramp.rotation.y = ry;
    ramp.castShadow = true;
    scene.add(ramp);
    jumps.push({ mesh: ramp, x, z, done: false });
  }
  G.jumps = jumps;
  return jumps;
}
export function checkJumps(G) {
  for (const j of G.jumps) {
    if (!j.done && G.mode === 'car' && dist2d(G.pos.x, G.pos.z, j.x, j.z) < 5 && Math.abs(G.speed) > 18) {
      j.done = true;
      G.jumpsDone += 1;
      addCash(G, 250);
      const d = districtAt(G, j.x, j.z);
      bumpDistrict(G, d.name, 5);
      G.lastJump = true;
    }
  }
  return G.jumpsDone;
}

// --- taxi ------------------------------------------------------------------
export function startTaxi(G) {
  // A fare appears at a random spot; drive there, then to the destination.
  const fx = rand(-200, 200), fz = rand(-160, 160);
  const tx = rand(-200, 200), tz = rand(-160, 160);
  G.taxi = { stage: 'pickup', from: [fx, fz], to: [tx, tz], fare: 0 };
  return G.taxi;
}
export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return null;
  if (t.stage === 'pickup' && dist2d(G.pos.x, G.pos.z, t.from[0], t.from[1]) < 8) {
    t.stage = 'dropoff';
    return 'picked';
  }
  if (t.stage === 'dropoff' && dist2d(G.pos.x, G.pos.z, t.to[0], t.to[1]) < 8) {
    const fare = 60 + Math.round(dist2d(t.from[0], t.from[1], t.to[0], t.to[1]) * 0.12);
    addCash(G, fare);
    G.taxiFares += 1;
    G.taxi = null;
    return { done: true, fare };
  }
  return null;
}

// --- courier ---------------------------------------------------------------
export function startCourier(G) {
  const dx = rand(-200, 200), dz = rand(-160, 160);
  G.courier = { to: [dx, dz], timeLeft: 45 };
  return G.courier;
}
export function updateCourier(G, dt) {
  const c = G.courier;
  if (!c) return null;
  c.timeLeft -= dt;
  if (dist2d(G.pos.x, G.pos.z, c.to[0], c.to[1]) < 8) {
    const fast = c.timeLeft > 15;
    const pay = fast ? 90 : 60;
    addCash(G, pay);
    G.courierJobs += 1;
    G.courier = null;
    return { done: true, pay, fast };
  }
  if (c.timeLeft <= 0) {
    G.courier = null;
    return { done: false, reason: 'too slow' };
  }
  return null;
}

// --- race: Neon Mile Sprint -----------------------------------------------
export function raceCheckpoints() {
  return [[80, -40], [160, 0], [160, 60], [80, 80], [40, 20]];
}
export function startRace(G) {
  G.race = { cp: 0, cps: raceCheckpoints(), time: 0, active: true };
  return G.race;
}
export function updateRace(G, dt) {
  const r = G.race;
  if (!r || !r.active) return null;
  r.time += dt;
  const [cx, cz] = r.cps[r.cp];
  if (dist2d(G.pos.x, G.pos.z, cx, cz) < 12) {
    r.cp += 1;
    if (r.cp >= r.cps.length) {
      r.active = false;
      const bonus = r.time < 75 ? 500 : 300;
      addCash(G, bonus);
      G.racesWon += 1;
      bumpDistrict(G, 'Neon Mile', 10);
      G.race = null;
      return { done: true, time: r.time, pay: bonus };
    }
    return 'checkpoint';
  }
  return null;
}

// Side-activity status text for the HUD.
export function activityText(G) {
  const out = [];
  if (G.taxi) {
    const t = G.taxi;
    const tgt = t.stage === 'pickup' ? t.from : t.to;
    out.push(t.stage === 'pickup' ? `Taxi: pick up the fare (${Math.round(tgt[0])}, ${Math.round(tgt[1])})` : `Taxi: drop off the fare (${Math.round(tgt[0])}, ${Math.round(tgt[1])})`);
  }
  if (G.courier) out.push(`Courier: deliver in ${Math.ceil(G.courier.timeLeft)}s`);
  if (G.race && G.race.active) out.push(`Race: checkpoint ${G.race.cp + 1}/${G.race.cps.length} — ${G.race.time.toFixed(1)}s`);
  if (G.packagesFound < G.packagesTotal) out.push(`Packages: ${G.packagesFound}/${G.packagesTotal}`);
  return out;
}
// The debug harness uses these to verify side jobs pay out.
export function debugTaxiFare(G) { return G.taxiFares; }
export function debugCourierJobs(G) { return G.courierJobs; }
