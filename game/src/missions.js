// Solmar City — missions, side jobs and collectibles. The story: Rook, a new
// getaway driver, works for the fixer Mari Voss — until the final job reveals
// the twist. Side work: taxi fares, pier street races, and 20 Solmar coins.
import * as THREE from 'three';
import { clamp, rand, randInt, pick, angleDiff } from './util.js';
import { BLOCK, GRID, CITY_R } from './city.js';
import { Car } from './vehicles.js';

const MISSION_LIST = [
  {
    id: 'm1', name: 'First Day on the Job', giver: 'Mari Voss',
    briefing: 'Rook. Welcome to Solmar. I need a driver who keeps his mouth shut and his foot down. First job is easy: take the car, pick up my client at the marina hotel, drop him at the pier. Don’t scratch the paint.',
    reward: 300, respect: 10,
    steps: [
      { type: 'goto', x: 26, z: 78, r: 6, title: 'Get to the car', sub: 'Mari left you a ride on Palm Row' },
      { type: 'enter', title: 'Get in the car', sub: 'Press E near the car' },
      { type: 'goto', x: 104, z: 52, r: 8, title: 'Pick up the client', sub: 'Marina Hotel, Bay Avenue' },
      { type: 'goto', x: -208, z: 26, r: 8, title: 'Drop the client at the pier', sub: 'Drive him to Pier 9' },
    ],
  },
  {
    id: 'm2', name: 'The Getaway', giver: 'Mari Voss',
    briefing: 'A friend of mine is making a withdrawal. You drive. Get to the bank, wait for my signal, then get us to the safehouse — and Rook, the cops will not be far behind.',
    reward: 800, respect: 15,
    steps: [
      { type: 'goto', x: -52, z: -104, r: 8, title: 'Get to the bank', sub: 'Solmar Trust, Coral Street' },
      { type: 'wait', x: -52, z: -104, r: 8, secs: 4, title: 'Wait for the bag', sub: 'Hold position…' },
      { type: 'escape', x: -156, z: 156, r: 9, title: 'Lose the heat — reach the safehouse', sub: '2 stars and climbing. Drive!' },
    ],
  },
  {
    id: 'm3', name: 'Repo Run', giver: 'Mari Voss',
    briefing: 'Somebody stopped paying for his gold ride. Take it back — gently. Bring the car to my garage in one piece and I’ll make it worth your while. Wreck it and you pay for it.',
    reward: 600, respect: 12,
    steps: [
      { type: 'goto', x: 208, z: 104, r: 8, title: 'Find the gold car', sub: 'Parked on Sunset Row' },
      { type: 'enterSpecific', title: 'Take the gold car', sub: 'Press E to get in — it’s yours now' },
      { type: 'deliver', x: -104, z: 208, r: 9, title: 'Deliver it to the garage', sub: 'Keep the damage light!' },
    ],
  },
  {
    id: 'm4', name: 'Night Run', giver: 'Deke (street racer)',
    briefing: 'Mari says you can drive. Prove it. Six checkpoints through the city at night, two of my boys on your tail. Win and the pot is yours. Lose and you walk home.',
    reward: 1000, respect: 18,
    steps: [
      { type: 'goto', x: -208, z: -26, r: 8, title: 'Get to the start line', sub: 'Pier 9, after dark' },
      { type: 'race', title: 'Race! Hit every checkpoint', sub: 'Beat Deke and his crew to the finish' },
    ],
  },
  {
    id: 'm5', name: 'The Setup', giver: 'Mari Voss',
    briefing: 'Last job, Rook. One package, Pier 9, midnight. No questions. After this we’re square — I promise.',
    reward: 2500, respect: 25,
    steps: [
      { type: 'goto', x: -208, z: 0, r: 8, title: 'Pick up the package', sub: 'Pier 9, midnight' },
      { type: 'escape', x: 208, z: -156, r: 9, title: 'IT’S A SETUP — RUN!', sub: 'Mari tipped the cops. Lose them and get to the hideout!' },
    ],
  },
];

const RACE_POINTS = [
  { x: -156, z: -104 }, { x: -52, z: -208 }, { x: 104, z: -156 },
  { x: 208, z: -52 }, { x: 156, z: 104 }, { x: 0, z: 208 },
];

export class Missions {
  constructor(scene, city, hooks) {
    this.scene = scene; this.city = city; this.hooks = hooks;
    this.defs = MISSION_LIST;
    this.index = 0;               // next story mission
    this.active = null;           // {def, step, waitT, ...}
    this.started = false;
    this.coins = [];
    this.coinCount = 0;
    this.taxi = null;             // {state, passenger, dest, fare}
    this.taxiCooldown = 0;
    this.race = null;
    this.repoCar = null;
    // marker: glowing beacon + floating diamond
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), mat);
    this.marker.position.y = 20;
    scene.add(this.marker);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    dia.position.y = 9;
    this.marker.add(dia);
    this.markerDiamond = dia;
    this.marker.visible = false;
    this.spawnCoins();
  }
  spawnCoins() {
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd75e });
    for (let i = 0; i < 20; i++) {
      const road = randInt(-GRID, GRID) * BLOCK;
      const along = rand(-CITY_R + 20, CITY_R - 20);
      const x = Math.random() < 0.5 ? road + pick([-11, 11]) : along;
      const z = Math.random() < 0.5 ? along : road + pick([-11, 11]);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 1.2, z);
      m.rotation.x = Math.PI / 2;
      this.scene.add(m);
      this.coins.push({ mesh: m, x, z, taken: false });
    }
  }
  currentDef() { return MISSION_LIST[this.index] || null; }
  // position the start marker for the next story mission (or the active target)
  targetPos() {
    if (this.active) {
      const s = this.active.def.steps[this.active.step];
      if (s && (s.type === 'goto' || s.type === 'wait' || s.type === 'escape' || s.type === 'deliver')) return { x: s.x, z: s.z };
      if (s && s.type === 'race' && this.race) return this.race.points[this.race.playerCp] || null;
      return null;
    }
    const d = this.currentDef();
    if (!d) return null;
    const s = d.steps[0];
    return { x: s.x, z: s.z };
  }
  startMission(def) {
    this.active = { def, step: 0, waitT: 0, racePlaced: false };
    this.hooks.toast(`MISSION: ${def.name}`);
    this.hooks.bigMsg(`${def.name}`, `${def.giver}: “${def.briefing}”`, 5200);
    this.hooks.audio.missionDone();
  }
  completeMission() {
    const def = this.active.def;
    this.hooks.addCash(def.reward);
    this.hooks.addRespect(def.respect);
    this.hooks.bigMsg('MISSION COMPLETE', `+${def.reward} · +${def.respect} respect`, 3600);
    this.hooks.audio.missionDone();
    this.active = null;
    this.index++;
    if (def.id === 'm5') {
      this.hooks.bigMsg('SOLMAR CITY — END OF THE LINE', 'Mari set you up. You kept the package, lost the fixer, and kept the city. Rook drives for Rook now. Free roam: taxi fares, races and coins still pay.', 8000);
    }
  }
  failMission(reason) {
    if (!this.active) return;
    this.hooks.bigMsg('MISSION FAILED', reason, 3600);
    this.hooks.audio.fail();
    this.active = null;
    this.cleanupRace();
  }
  cleanupRace() {
    if (this.race) {
      for (const r of this.race.rivals) r.dispose();
      this.race = null;
    }
  }
  // --- taxi ---
  maybeStartTaxi(player) {
    if (this.taxi || this.taxiCooldown > 0 || !player.inCar) return false;
    // a fare appears near the player
    const pos = player.pos();
    const a = rand(0, Math.PI * 2);
    const x = pos.x + Math.sin(a) * rand(20, 45);
    const z = pos.z + Math.cos(a) * rand(20, 45);
    const snap = this.city.nearestRoadPoint(x, z);
    const dest = this.city.nearestRoadPoint(rand(-CITY_R, CITY_R), rand(-CITY_R, CITY_R));
    this.taxi = { state: 'pickup', x: snap.x, z: snap.z, dx: dest.x, dz: dest.z, fare: 0 };
    this.hooks.toast('TAXI FARE: pick up the passenger at the marker');
    return true;
  }
  // --- race ---
  startRace(player) {
    const rivals = [];
    for (let i = 0; i < 2; i++) {
      const c = new Car(this.scene, -208 + i * 6, -26 + (i - 0.5) * 8, -Math.PI / 2, i === 0 ? 0xd94f3d : 0x3d7bd9, { maxSpeed: 33, accel: 14 });
      c.cp = 0; c.raceSpeed = 30 + i;
      rivals.push(c);
    }
    this.race = { points: RACE_POINTS, playerCp: 0, rivals, startT: performance.now(), done: false };
    this.hooks.bigMsg('STREET RACE', 'Six checkpoints. Beat Deke’s crew. First: $500.', 3200);
  }
  update(dt, player, police, audio) {
    const pos = player.pos();
    const t = performance.now();
    // marker bob + position
    this.markerDiamond.rotation.y += dt * 2;
    this.markerDiamond.position.y = 9 + Math.sin(t / 300) * 1.2;
    const target = this.targetPos();
    if (target) {
      this.marker.visible = true;
      this.marker.position.set(target.x, 20, target.z);
    } else this.marker.visible = false;

    // --- story mission logic ---
    if (!this.active) {
      const d = this.currentDef();
      if (d) {
        this.hooks.setObjective(d.name, 'Go to the yellow marker to start · ' + d.giver);
        const s = d.steps[0];
        if (Math.hypot(pos.x - s.x, pos.z - s.z) < (s.r || 8)) {
          if (d.id === 'm3') this.spawnRepoCar();
          this.startMission(d);
        }
      } else {
        this.hooks.setObjective('Free roam', 'Taxi fares (T), pier races, 20 coins to find');
      }
    } else {
      const m = this.active, s = m.def.steps[m.step];
      if (!s) { this.completeMission(); return; }
      this.hooks.setObjective(m.def.name, s.title + (s.sub ? ' — ' + s.sub : ''));
      if (s.type === 'goto' || s.type === 'escape' || s.type === 'deliver') {
        if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.r) {
          if (s.type === 'escape' && m.def.id === 'm2') { /* reached safehouse */ }
          if (s.type === 'deliver' && player.inCar && player.inCar.health < 40) {
            this.failMission('The car was too wrecked to sell.');
            return;
          }
          m.step++;
          // the m5 pickup is a trap: Mari tipped the cops — the ambush starts here
          if (m.def.id === 'm5' && m.step === 1) police.addCrime(60);
          if (m.step >= m.def.steps.length) { this.completeMission(); return; }
          const ns = m.def.steps[m.step];
          if (ns && ns.type === 'race') this.startRace(player);
        }
      } else if (s.type === 'enter') {
        if (player.inCar) { m.step++; }
      } else if (s.type === 'enterSpecific') {
        if (player.inCar === this.repoCar) { m.step++; }
      } else if (s.type === 'wait') {
        if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.r) {
          m.waitT += dt;
          this.hooks.setObjective(m.def.name, `Wait for the bag… ${Math.ceil(s.secs - m.waitT)}s`);
          if (m.waitT >= s.secs) {
            m.step++;
            if (m.def.id === 'm2') police.addCrime(26); // the getaway begins
            if (m.def.id === 'm5') police.addCrime(60); // the ambush
          }
        } else m.waitT = 0;
      } else if (s.type === 'race') {
        // race progress handled below; mission completes when race ends
        if (this.race && this.race.done) {
          const place = this.race.place;
          const bonus = place === 1 ? 500 : place === 2 ? 200 : 50;
          this.hooks.addCash(bonus);
          this.hooks.bigMsg(place === 1 ? 'YOU WON THE RACE' : 'RACE OVER', `Finished ${place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'} · +$${bonus}`, 3200);
          this.cleanupRace();
          m.step++;
          if (m.step >= m.def.steps.length) { this.completeMission(); return; }
        }
      }
    }
    // --- race rivals + player checkpoints ---
    if (this.race && !this.race.done) {
      const r = this.race;
      const cp = r.points[r.playerCp];
      if (cp && Math.hypot(pos.x - cp.x, pos.z - cp.z) < 10) {
        r.playerCp++;
        audio.coin();
        if (r.playerCp >= r.points.length) this.finishRace(1 + (r.finishedRivals || 0));
      }
      for (const rv of r.rivals) {
        if (rv.cp >= r.points.length) continue;
        const p = r.points[rv.cp];
        const dx = p.x - rv.x, dz = p.z - rv.z;
        const dist = Math.hypot(dx, dz);
        const targetHeading = Math.atan2(dx, dz);
        const steer = clamp(angleDiff(rv.heading, targetHeading) * 1.4, -1, 1);
        rv.drive(dt, { throttle: 1, steer, handbrake: false }, this.city);
        if (dist < 10) {
          rv.cp++;
          if (rv.cp >= r.points.length && !r.done) {
            r.finishedRivals = (r.finishedRivals || 0) + 1;
            this.finishRace(r.playerCp >= r.points.length ? 1 : r.finishedRivals + 1);
          }
        }
      }
    }
    // --- taxi ---
    this.taxiCooldown = Math.max(0, this.taxiCooldown - dt);
    if (this.taxi) {
      const tx = this.taxi;
      if (tx.state === 'pickup') {
        this.hooks.setObjective('Taxi fare', 'Pick up the passenger at the marker');
        if (Math.hypot(pos.x - tx.x, pos.z - tx.z) < 6) {
          tx.state = 'dropoff';
          this.hooks.toast('Passenger aboard — take them to the marker');
          audio.coin();
        }
      } else if (tx.state === 'dropoff') {
        this.hooks.setObjective('Taxi fare', 'Drop the passenger at the marker');
        if (Math.hypot(pos.x - tx.dx, pos.z - tx.dz) < 8) {
          const fare = Math.round(40 + Math.hypot(tx.dx - tx.x, tx.dz - tx.z) * 0.35);
          this.hooks.addCash(fare);
          this.hooks.toast(`Fare paid: $${fare}`);
          audio.missionDone();
          this.taxi = null;
          this.taxiCooldown = 20;
        }
      }
    }
    // --- coins ---
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.2 + Math.sin(t / 300 + c.x) * 0.3;
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < 2.4) {
        c.taken = true;
        this.scene.remove(c.mesh);
        this.coinCount++;
        this.hooks.addCash(50);
        this.hooks.addRespect(1);
        this.hooks.toast(`Solmar coin ${this.coinCount}/20 · +$50`);
        audio.coin();
      }
    }
  }
  finishRace(playerPlace) {
    if (!this.race || this.race.done) return;
    this.race.done = true;
    this.race.place = playerPlace;
  }
  spawnRepoCar() {
    if (this.repoCar) return;
    const car = new Car(this.scene, 208, 104, 0, 0xe0b93c, { maxSpeed: 40, accel: 16 });
    car.health = 100;
    this.repoCar = car;
  }
  taxiTarget() {
    if (!this.taxi) return null;
    return this.taxi.state === 'pickup' ? { x: this.taxi.x, z: this.taxi.z } : { x: this.taxi.dx, z: this.taxi.dz };
  }
}
