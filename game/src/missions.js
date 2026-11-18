import * as THREE from 'three';
// Solmar City — story missions, taxi jobs, coins and the pier race.
// Rook is a getaway driver working for the fixer Mari Voss; her five jobs
// pay cash and respect, and the last one ends with a twist.
import { clamp, dist2d, boxGeo, cylGeo, sphGeo, std } from './util.js';
import { SPOTS } from './city.js';

const MISSION_DEFS = [
  { name: 'First Run', pay: 550, respect: 10, text: 'Mari Voss has a job. Drive to the marker on Marlin Street.', target: SPOTS.start, radius: 6 },
  { name: 'The Bank Job', pay: 1350, respect: 15, text: 'Hit the Solmar Bank, then lose the heat — reach the safehouse.', target: SPOTS.bank, radius: 7, escapeTo: SPOTS.safehouse, escapeWanted: 2 },
  { name: 'Repo Run', pay: 1800, respect: 15, text: 'Steal the black SUV on Coral Row and bring it to the garage.', target: SPOTS.garage, radius: 7, needsCar: 'suv' },
  { name: 'Pier Race', pay: 2200, respect: 20, text: 'Night race from the pier: hit all 5 checkpoints before time runs out.', target: SPOTS.pier, radius: 8, race: true },
  { name: 'The Setup', pay: 3000, respect: 20, text: "Meet Mari at the casino. IT'S A SETUP — RUN! Lose them and get to the hideout!", target: SPOTS.casino, radius: 7, escapeTo: SPOTS.safehouse, escapeWanted: 4 },
];

export class Missions {
  constructor(scene, G) {
    this.G = G; this.scene = scene;
    this.index = 0; this.phase = 'go'; // go | escape | race | done
    this.raceCp = 0; this.raceTime = 0;
    this.taxi = null; this.taxiFare = 0;
    this.coinsGot = 0;
    // Waypoint beacon: a column of light plus a floating ring.
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
    this.beacon = new THREE.Mesh(cylGeo(1.6, 1.6, 60, 12, 1, true), beamMat);
    this.beacon.position.y = 30; scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 24), ringMat);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 1.2; scene.add(this.ring);
    this.beacon.visible = false; this.ring.visible = false;
    // 20 Solmar coins scattered around the map.
    this.coins = [];
    const coinMat = new THREE.MeshStandardMaterial({ color: '#f2c200', metalness: 0.9, roughness: 0.25, emissive: new THREE.Color('#a88400'), emissiveIntensity: 0.4 });
    const spots = [
      [26, -100], [-60, -60], [100, -100], [140, 20], [20, 100], [-100, 60], [60, 140],
      [-140, -100], [180, 100], [100, 180], [-20, -160], [-160, 40], [160, -60],
      [-100, 160], [40, -60], [140, 140], [-60, 20], [20, 180], [180, -140], [-150, -30],
    ];
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(cylGeo(0.55, 0.55, 0.12, 18), coinMat);
      m.rotation.x = Math.PI / 2; m.position.set(x, 1.1, z);
      scene.add(m);
      this.coins.push({ mesh: m, x, z, got: false });
    }
    // Race checkpoints for mission 4 and the repeatable pier sprint.
    this.racePoints = [
      { x: -152, z: 0 }, { x: -100, z: -100 }, { x: 20, z: -140 },
      { x: 140, z: -60 }, { x: 100, z: 100 }, { x: -60, z: 140 },
    ];
    this.setObjective();
  }
  def() { return MISSION_DEFS[this.index]; }
  currentTarget() {
    const d = this.def();
    if (!d) return null;
    if (this.phase === 'escape') return d.escapeTo;
    if (this.phase === 'race') return this.racePoints[this.raceCp];
    return d.target;
  }
  setObjective() {
    const d = this.def();
    const G = this.G;
    if (!d) { G.objective = 'All missions done — Solmar is yours, Rook.'; this.beacon.visible = false; this.ring.visible = false; return; }
    const t = this.currentTarget();
    G.objective = `${d.name} — ${this.phase === 'escape' ? 'Lose the heat — reach the safehouse.' : this.phase === 'race' ? `Checkpoint ${this.raceCp + 1}/5 — ${Math.max(0, Math.ceil(this.raceTime))}s left.` : d.text}`;
    this.beacon.position.set(t.x, 30, t.z);
    this.ring.position.set(t.x, 1.2, t.z);
    this.beacon.visible = true; this.ring.visible = true;
  }

  update(dt) {
    const G = this.G;
    const t = this.currentTarget();
    // Beacon pulse.
    this.beacon.material.opacity = 0.22 + Math.sin(performance.now() / 300) * 0.08;
    this.ring.rotation.z += dt * 1.2;
    // Coins: spin, bob, collect on touch.
    for (const c of this.coins) {
      if (c.got) continue;
      c.mesh.rotation.z += dt * 2;
      c.mesh.position.y = 1.1 + Math.sin(performance.now() / 400 + c.x) * 0.15;
      if (dist2d(G.player.pos.x, G.player.pos.z, c.x, c.z) < 2.2) {
        c.got = true; c.mesh.visible = false;
        G.cash += 50; this.coinsGot++;
        G.audio.blip(1200, 0.12, 0.15);
        G.hud.flash('+$50  Solmar coin');
      }
    }
    // Race timer.
    if (this.phase === 'race') {
      this.raceTime -= dt;
      if (this.raceTime <= 0) { // out of time: restart the race
        this.raceCp = 0; this.raceTime = 90;
        G.hud.flash('Too slow — race restarted');
        this.setObjective();
        return;
      }
    }
    if (!t) return;
    const d = dist2d(G.player.pos.x, G.player.pos.z, t.x, t.z);
    const radius = this.phase === 'race' ? 7 : (this.def()?.radius ?? 6);
    if (d < radius) this.arrive();
  }
  arrive() {
    const G = this.G;
    const d = this.def();
    if (!d) return;
    if (this.phase === 'race') {
      this.raceCp++;
      G.audio.blip(980, 0.1, 0.14);
      if (this.raceCp >= 5) {
        if (this.sprint) {
          this.sprint = false; this.phase = 'go'; this.raceCp = 0;
          G.cash += 400; G.audio.jingle();
          G.hud.flash('Pier sprint complete  +$400');
          this.setObjective(); G.saveGame();
          return;
        }
        return this.completeMission();
      }
      this.setObjective();
      return;
    }
    if (this.phase === 'go' && d.race) {
      this.phase = 'race';
      // Checkpoint 0 is the pier start line the player is standing on — it
      // counts at once, so the race never waits on a second frame here.
      this.raceCp = 1; this.raceTime = 90;
      G.hud.flash('Race started — 5 checkpoints, 90 seconds!');
      this.setObjective();
      return;
    }
    if (this.phase === 'go' && d.escapeTo) {
      this.phase = 'escape';
      G.setWanted(d.escapeWanted);
      G.hud.flash(d.name === 'The Setup' ? "IT'S A SETUP — RUN!" : 'Heat is on — lose them!');
      this.setObjective();
      return;
    }
    if (this.phase === 'go' && d.needsCar) {
      if (!G.player.car || G.player.car.stolen !== 'suv') {
        // Flash once every few seconds, not every frame while parked here.
        const now = performance.now();
        if (!this.noCarAt || now - this.noCarAt > 4000) {
          this.noCarAt = now;
          G.hud.flash('You need the black SUV for this job.');
        }
        return;
      }
    }
    this.completeMission();
  }
  completeMission() {
    const G = this.G;
    const d = this.def();
    G.cash += d.pay; G.respect += d.respect;
    // Reaching the safehouse means the heat is lost.
    if (d.escapeTo) G.setWanted(0);
    G.audio.jingle();
    G.hud.flash(`${d.name} complete  +$${d.pay}`);
    this.index++;
    this.phase = 'go'; this.raceCp = 0;
    if (this.index >= MISSION_DEFS.length) {
      G.setWanted(0);
      G.hud.flash('All missions done — Solmar is yours, Rook.');
    }
    this.setObjective();
    G.saveGame();
  }
  // Taxi: hail with T, drive the passenger to the dropoff for a fare.
  startTaxi() {
    const G = this.G;
    if (this.taxi) return false;
    const spots = [[100, -60], [-20, 140], [140, 60], [-100, -140], [60, 20]];
    const s = spots[Math.floor(Math.random() * spots.length)];
    this.taxi = { x: s[0], z: s[1] };
    this.taxiFare = 120 + Math.floor(Math.random() * 130);
    G.hud.flash(`Taxi job — pick up the passenger (fare $${this.taxiFare})`);
    return true;
  }
  taxiTarget() { return this.taxi; }
  taxiArrive() {
    const G = this.G;
    if (!this.taxi) return;
    G.cash += this.taxiFare;
    G.audio.jingle();
    G.hud.flash(`Taxi fare paid  +$${this.taxiFare}`);
    this.taxi = null;
    G.saveGame();
  }
  // Repeatable pier sprint: 4 checkpoints, $400 on completion.
  startSprint() {
    if (this.phase === 'race') return false;
    this.sprint = true;
    this.phase = 'race'; this.raceCp = 1; this.raceTime = 75; // skip the pier itself
    this.G.hud.flash('Pier sprint — 4 checkpoints, 75 seconds, $400!');
    this.setObjective();
    return true;
  }
}
