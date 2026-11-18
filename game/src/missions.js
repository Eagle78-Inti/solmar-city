// Solmar City v4 — the story: five missions for fixer Mari Voss, from a first
// pickup to a double-cross, plus the taxi jobs that pay between missions.
import * as THREE from 'three';
import { clamp, rand, randInt, pick, dist2 } from './util.js';
import { ROADS_X, ROADS_Z } from './city.js';

export const MISSION_DEFS = [
  {
    name: 'First Job', payout: 550, respect: 10,
    steps: [{ x: -140, z: 0, r: 9, text: 'Meet the contact at Pier 7' }],
  },
  {
    name: 'Bank Job', payout: 1350, respect: 15,
    steps: [
      { x: 60, z: -60, r: 9, text: 'Hit the bank on Meridian Ave' },
      { x: -100, z: -100, r: 12, text: 'Lose the heat — get to the hideout', wanted: 2 },
    ],
  },
  {
    name: 'Repo Man', payout: 1800, respect: 15,
    steps: [
      { x: 30, z: -30, r: 6, text: 'Take the black SUV on Harbor Row', needCar: true },
      { x: -60, z: 60, r: 10, text: 'Deliver the SUV to the garage' },
    ],
  },
  {
    name: 'Pier Run', payout: 2200, respect: 20, time: 80,
    steps: [
      { x: 0, z: 0, r: 9, text: 'Race! Checkpoint 1 of 4 — Solmar Plaza' },
      { x: 60, z: 60, r: 9, text: 'Race! Checkpoint 2 of 4 — Meridian' },
      { x: -60, z: 120, r: 9, text: 'Race! Checkpoint 3 of 4 — Southside' },
      { x: 0, z: -120, r: 9, text: 'Race! Final checkpoint — Northgate' },
    ],
  },
  {
    name: 'The Setup', payout: 3000, respect: 20,
    steps: [
      { x: 90, z: 90, r: 12, text: 'Meet Mari at Solmar Tower' },
      { x: -100, z: -100, r: 12, text: "IT'S A SETUP — RUN!", wanted: 4 },
    ],
  },
];

function makeBeacon(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 14, 1, true), mat);
  cyl.position.y = 8;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.2, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(cyl, ring);
  g.visible = false;
  return g;
}

export function createMissions(world) {
  const beacon = makeBeacon(0xffd23c);
  world.scene.add(beacon);
  const M = {
    index: 0,
    step: 0,
    timeLeft: 0,
    done: false,
    override: null,
    hintAt: 0,
    current() { return MISSION_DEFS[M.index] || null; },
    currentStep() {
      const m = M.current();
      return m ? m.steps[M.step] : null;
    },
    objective() {
      if (M.override) return M.override;
      if (M.done) return 'ALL MISSIONS DONE — Solmar is yours, Rook.';
      const s = M.currentStep();
      if (!s) return 'Talk to Mari Voss.';
      const m = M.current();
      let t = `${m.name}: ${s.text}`;
      if (m.time) t += ` — ${Math.ceil(M.timeLeft)}s`;
      return t;
    },
    target() {
      const s = M.currentStep();
      return s ? { x: s.x, z: s.z, r: s.r } : null;
    },
    start(i) {
      M.index = i; M.step = 0; M.done = false; M.override = null;
      const m = M.current();
      M.timeLeft = m && m.time ? m.time : 0;
      world.toast(`Mission ${i + 1}: ${m.name}`);
    },
    update(dt) {
      const m = M.current();
      if (!m || M.done) { beacon.visible = false; return; }
      const s = m.steps[M.step];
      beacon.visible = true;
      beacon.position.set(s.x, 0, s.z);
      beacon.position.y = Math.sin(world.elapsed * 2) * 0.4;
      beacon.rotation.y += dt * 0.8;
      if (m.time) {
        M.timeLeft -= dt;
        if (M.timeLeft <= 0) {
          world.toast('Too slow — the Pier Run restarts.');
          world.audio.sting(false);
          M.step = 0;
          M.timeLeft = m.time;
          return;
        }
      }
      const p = world.playerPos();
      const d = dist2(p.x, p.z, s.x, s.z);
      if (d < s.r) {
        if (s.needCar && !world.inCar) {
          if (world.elapsed - M.hintAt > 3) {
            M.hintAt = world.elapsed;
            world.toast('You need to be in the SUV — press E near it.');
          }
          return;
        }
        if (s.wanted) world.setWanted(s.wanted);
        M.step++;
        world.audio.click();
        if (M.step >= m.steps.length) {
          world.addCash(m.payout);
          world.addRespect(m.respect);
          world.audio.sting(true);
          world.banner(`MISSION COMPLETE`, `${m.name} — +$${m.payout.toLocaleString('en-US')}`);
          world.toast(`${m.name} complete: +$${m.payout.toLocaleString('en-US')}`);
          world.save();
          M.index++;
          if (M.index >= MISSION_DEFS.length) {
            M.done = true;
            beacon.visible = false;
          } else {
            M.start(M.index);
          }
        }
      }
    },
  };
  return M;
}

export function createTaxi(world) {
  const beacon = makeBeacon(0x2fd8ff);
  world.scene.add(beacon);
  const T = {
    active: false,
    phase: '',
    px: 0, pz: 0, dx: 0, dz: 0,
    fare: 0,
    start() {
      if (T.active) return false;
      const p = world.playerPos();
      let ax = pick(ROADS_X), az = rand(-120, 120);
      if (Math.random() < 0.5) { az = pick(ROADS_Z); ax = rand(-120, 120); }
      T.px = ax; T.pz = az;
      T.phase = 'pickup';
      T.active = true;
      beacon.visible = true;
      beacon.position.set(ax, 0, az);
      world.toast('Taxi job: pick up the fare at the blue marker.');
      return true;
    },
    update(dt) {
      if (!T.active) { beacon.visible = false; return; }
      const p = world.playerPos();
      const tx = T.phase === 'pickup' ? T.px : T.dx;
      const tz = T.phase === 'pickup' ? T.pz : T.dz;
      beacon.position.set(tx, 0, tz);
      beacon.position.y = Math.sin(world.elapsed * 2) * 0.4;
      if (dist2(p.x, p.z, tx, tz) < 7) {
        if (T.phase === 'pickup') {
          T.phase = 'drop';
          let ax = pick(ROADS_X), az = rand(-120, 120);
          if (Math.random() < 0.5) { az = pick(ROADS_Z); ax = rand(-120, 120); }
          T.dx = ax; T.dz = az;
          T.fare = Math.round(110 + dist2(T.px, T.pz, ax, az) * 0.9);
          world.toast('Passenger aboard — take them to the blue marker.');
          world.audio.click();
        } else {
          world.addCash(T.fare);
          world.audio.coin();
          world.toast(`Fare paid: +$${T.fare}`);
          T.active = false;
          beacon.visible = false;
        }
      }
    },
    target() {
      if (!T.active) return null;
      return T.phase === 'pickup' ? { x: T.px, z: T.pz } : { x: T.dx, z: T.dz };
    },
  };
  return T;
}

export function totalPayout() {
  return MISSION_DEFS.reduce((n, m) => n + m.payout, 0);
}
export function totalRespect() {
  return MISSION_DEFS.reduce((n, m) => n + m.respect, 0);
}
