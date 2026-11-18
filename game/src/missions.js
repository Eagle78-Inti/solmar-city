// Solmar City — missions and side work. Rook, a getaway driver new to Solmar,
// works five jobs for the fixer Mari Voss: a first drive, a bank getaway, a
// repo job, a neon street race, and a final score that ends in betrayal.
// Between jobs: taxi fares, pier races and 20 Solmar coins hidden around town.
import * as THREE from 'three';
import { clamp, rand, randInt, pick, dist2, boxGeo, cylGeo, stdMat, glowSprite } from './util.js';
import { Car } from './vehicles.js';

const HIDEOUT = { x: -8, z: 8 };
const GARAGE = { x: -44, z: -44 };
const OFFICE = { x: 44, z: 44 };
const BANK = { x: -88, z: 88 };
const SAFEHOUSE = { x: 132, z: -88 };
const IMPOUND = { x: 88, z: 132 };
const DOCKS = { x: -176, z: -132 };
const PIER_START = { x: -190, z: 0 };
const CASINO = { x: 88, z: -44 };

function buildMarker() {
  const g = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd319, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(cylGeo(1.6, 1.6, 60, 12, true), beamMat);
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd319 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: 0xffd319, emissive: 0xffb300, emissiveIntensity: 1.6, roughness: 0.3 }));
  diamond.position.y = 6;
  g.add(diamond);
  const glow = glowSprite('#ffd319', 10, 0.7);
  glow.position.y = 6;
  g.add(glow);
  g.userData = { beam, diamond, glow, t: 0 };
  return g;
}

export class Missions {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.g = game; // { player, police, audio, hud, traffic, parkedCars }
    this.index = 0; // 0..4, 5 = all done
    this.stage = 0;
    this.done = false;
    this.waitT = 0;
    this.raceT = 0;
    this.raceCp = 0;
    this.raceRivals = [78, 86, 94];
    this.taxi = null;
    this.cash = 250;
    this.respect = 0;
    this.coinsGot = 0;
    this.marker = buildMarker();
    this.marker.visible = false;
    scene.add(this.marker);
    this.markedCar = null;
    this.raceCar = null;
    this.buildCoins();
    this.setMission(0, 0);
  }

  buildCoins() {
    this.coins = [];
    const spots = [
      [-190, -44], [-190, 44], [-196, 120], [22, -66], [-66, 22], [110, 110], [154, -154],
      [-154, 154], [66, -110], [-110, -66], [0, 132], [132, 0], [-22, 154], [176, 66],
      [-132, -176], [44, -132], [-44, 176], [88, 66], [-66, -132], [22, 22],
    ];
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd319, emissive: 0xa87800, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.9 });
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 10, 20), mat);
      m.position.set(x, 1.4, z);
      m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      this.scene.add(m);
      this.coins.push({ mesh: m, x, z, got: false });
    }
  }

  setObjective(text) { this.g.hud.setObjective(text); }
  say(text) { this.g.hud.message(text); }

  setMarker(x, z, visible = true) {
    this.marker.visible = visible;
    this.marker.position.set(x, 0, z);
    this.markerPos = { x, z };
  }
  hideMarker() { this.marker.visible = false; this.markerPos = null; }

  setMission(i, stage) {
    this.index = i;
    this.stage = stage;
    this.waitT = 0;
    const g = this.g;
    if (i === 0) {
      this.setObjective('Mission 1 — First Wheels: get to the garage');
      this.say('Mari Voss: "Rook. New in Solmar? Prove you can drive. Get to my garage."');
      this.setMarker(GARAGE.x, GARAGE.z);
    } else if (i === 1) {
      this.setObjective('Mission 2 — The Getaway: drive to the bank');
      this.say('Mari: "Bank on Coral Way. Pick up the crew. Then lose the heat."');
      this.setMarker(BANK.x, BANK.z);
    } else if (i === 2) {
      this.setObjective('Mission 3 — Repo Run: steal the SUV from the impound lot');
      this.say('Mari: "A client skipped payments. His SUV is in the impound lot. Bring it to the docks."');
      this.setMarker(IMPOUND.x, IMPOUND.z);
      this.markedCar = new Car(this.scene, { color: 0x2e6f8e, type: 'van', x: IMPOUND.x + 4, z: IMPOUND.z + 4, heading: Math.PI / 2 });
      this.markedCar.marked = true;
      g.parkedCars.push(this.markedCar); // enterable with E, like any parked car
    } else if (i === 3) {
      this.setObjective('Mission 4 — Neon Nights: get to the pier and take the race car');
      this.say('Mari: "Pier 9, midnight race. Beat my boys and the purse is yours."');
      this.setMarker(PIER_START.x, PIER_START.z);
      this.raceCar = new Car(this.scene, { color: 0xc8102e, type: 'sport', x: PIER_START.x + 6, z: PIER_START.z + 2, heading: Math.PI });
      this.raceCar.marked = true;
      g.parkedCars.push(this.raceCar); // enterable with E, like any parked car
    } else if (i === 4) {
      this.setObjective('Mission 5 — The Setup: drive to the casino');
      this.say('Mari: "One last score. The casino vault, midnight. Don\'t be late."');
      this.setMarker(CASINO.x, CASINO.z);
    } else {
      this.done = true;
      this.hideMarker();
      this.setObjective('Solmar is yours. Free roam — taxi jobs, coins and races pay.');
      this.say('Mari is gone. The city is yours, Rook.');
    }
    g.hud.setMission(i, this.done);
  }

  payout(amount, respect) {
    this.cash += amount;
    this.respect += respect;
    this.g.audio.payout();
    this.say(`Paid $${amount.toLocaleString()}  •  Respect +${respect}`);
    this.g.hud.refresh();
  }
  completeMission(amount, respect) {
    this.payout(amount, respect);
    this.setMission(this.index + 1, 0);
  }

  // Taxi: press T in a car to take a fare. Pick up the waiting rider, then
  // drop them off. Fare scales with the trip length.
  startTaxi() {
    const g = this.g;
    if (this.taxi || !g.player.car) return false;
    const rider = g.peds.find((p) => p.state === 'walk');
    if (!rider) return false;
    const drop = pick(g.city.sidewalkSpots);
    this.taxi = { rider, pickup: { x: rider.pos.x, z: rider.pos.z }, drop: { x: drop.x, z: drop.z }, phase: 'pickup', fare: 0 };
    this.setMarker(this.taxi.pickup.x, this.taxi.pickup.z);
    this.setObjective('Taxi: pick up the rider');
    this.say('Taxi job: pick up the rider waiting on the sidewalk.');
    return true;
  }
  updateTaxi(dt) {
    const g = this.g;
    if (!this.taxi) return;
    const t = this.taxi;
    if (t.phase === 'pickup') {
      if (dist2(g.player.pos.x, g.player.pos.z, t.pickup.x, t.pickup.z) < 6) {
        t.phase = 'dropoff';
        t.rider.pos.set(g.player.pos.x, 0, g.player.pos.z);
        t.rider.state = 'down'; // rider rides along (hidden in the car)
        t.rider.mesh.visible = false;
        this.setMarker(t.drop.x, t.drop.z);
        this.setObjective('Taxi: drop the rider off');
        this.say('Rider aboard. Get them to the marker.');
      }
    } else if (dist2(g.player.pos.x, g.player.pos.z, t.drop.x, t.drop.z) < 6) {
      const fare = Math.round(60 + dist2(t.pickup.x, t.pickup.z, t.drop.x, t.drop.z) * 0.55);
      t.rider.mesh.visible = true;
      t.rider.state = 'walk';
      t.rider.pickTarget();
      this.cash += fare;
      this.g.audio.coin();
      this.say(`Taxi fare paid: $${fare}`);
      this.taxi = null;
      this.hideMarker();
      if (!this.done) this.restoreMissionMarker();
      g.hud.refresh();
    }
  }
  restoreMissionMarker() {
    const targets = [GARAGE, BANK, IMPOUND, PIER_START, CASINO];
    if (this.index < 5) this.setMarker(targets[this.index].x, targets[this.index].z);
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    // Marker animation: spinning diamond, pulsing beam.
    if (this.marker.visible) {
      const u = this.marker.userData;
      u.t += dt;
      u.diamond.rotation.y += dt * 2;
      u.diamond.position.y = 6 + Math.sin(u.t * 2.4) * 0.7;
      u.beam.material.opacity = 0.2 + Math.sin(u.t * 3) * 0.08;
    }
    // Coins spin and get collected.
    for (const c of this.coins) {
      if (c.got) continue;
      c.mesh.rotation.y += dt * 2.2;
      c.mesh.position.y = 1.4 + Math.sin(performance.now() * 0.002 + c.x) * 0.15;
      if (dist2(p.pos.x, p.pos.z, c.x, c.z) < 2.6) {
        c.got = true;
        c.mesh.visible = false;
        this.coinsGot++;
        this.cash += 50;
        g.audio.coin();
        this.say(`Solmar coin +$50 (${this.coinsGot}/20)`);
        g.hud.refresh();
      }
    }
    this.updateTaxi(dt);
    if (this.done) return;
    const near = (x, z, r = 7) => dist2(p.pos.x, p.pos.z, x, z) < r;

    if (this.index === 0) {
      if (this.stage === 0 && near(GARAGE.x, GARAGE.z, 8)) {
        this.stage = 1;
        this.setObjective('Mission 1 — First Wheels: get in the coupe');
        this.say('There she is. Get in and drive to Mari\'s office.');
        this.markedCar = new Car(this.scene, { color: 0x1c4fd6, type: 'coupe', x: GARAGE.x + 6, z: GARAGE.z, heading: Math.PI / 2 });
        this.markedCar.marked = true;
        g.parkedCars.push(this.markedCar); // enterable with E, like any parked car
        this.setMarker(GARAGE.x + 6, GARAGE.z);
      } else if (this.stage === 1 && p.car === this.markedCar) {
        this.stage = 2;
        this.setObjective('Mission 1 — First Wheels: drive to Mari\'s office');
        this.setMarker(OFFICE.x, OFFICE.z);
      } else if (this.stage === 2 && near(OFFICE.x, OFFICE.z, 8)) {
        this.say('Mari: "Not bad, Rook. You drive clean. More work soon."');
        this.completeMission(550, 10);
      }
    } else if (this.index === 1) {
      if (this.stage === 0 && near(BANK.x, BANK.z, 8)) {
        this.stage = 1;
        this.waitT = 0;
        this.setObjective('Mission 2 — The Getaway: the crew is loading in…');
        this.say('Crew: "Go go go — we\'re in!"');
      } else if (this.stage === 1) {
        this.waitT += dt;
        if (this.waitT > 3) {
          this.stage = 2;
          g.police.addWanted(2);
          this.setObjective('Mission 2 — The Getaway: lose the heat, then reach the safehouse');
          this.say('Sirens. Lose them, then get to the safehouse on the east side.');
          this.setMarker(SAFEHOUSE.x, SAFEHOUSE.z);
        }
      } else if (this.stage === 2 && g.police.wanted === 0 && near(SAFEHOUSE.x, SAFEHOUSE.z, 8)) {
        this.say('Mari: "Clean getaway. The crew is impressed."');
        this.completeMission(1350, 15);
      }
    } else if (this.index === 2) {
      if (this.stage === 0 && p.car === this.markedCar) {
        this.stage = 1;
        g.police.addWanted(1);
        this.setObjective('Mission 3 — Repo Run: deliver the SUV to the docks');
        this.say('That SUV is hot now. Get it to the docks, fast.');
        this.setMarker(DOCKS.x, DOCKS.z);
      } else if (this.stage === 1 && near(DOCKS.x, DOCKS.z, 8)) {
        this.say('Mari: "Client paid up. The SUV is ours now."');
        this.completeMission(1800, 15);
      }
    } else if (this.index === 3) {
      if (this.stage === 0 && p.car === this.raceCar) {
        this.stage = 1;
        this.raceT = 0;
        this.raceCp = 0;
        this.setObjective('Mission 4 — Neon Nights: race the circuit — 4 checkpoints');
        this.say('Race! Beat the rival crews through all 4 checkpoints.');
        this.setRaceMarker();
      } else if (this.stage === 1) {
        this.raceT += dt;
        const cps = [[132, -88], [132, 88], [-88, 88], [-88, -88]];
        const [cx, cz] = cps[this.raceCp];
        if (near(cx, cz, 9)) {
          this.raceCp++;
          g.audio.coin();
          if (this.raceCp >= 4) {
            const won = this.raceT < this.raceRivals[0];
            if (won) {
              this.say(`You won the race in ${this.raceT.toFixed(1)}s — the pier goes wild!`);
              this.completeMission(2200, 20);
            } else {
              this.say(`Too slow (${this.raceT.toFixed(1)}s). The rivals take the purse — try again.`);
              g.audio.fail();
              this.stage = 0;
              this.setMarker(PIER_START.x, PIER_START.z);
              this.setObjective('Mission 4 — Neon Nights: get back in the race car');
            }
          } else {
            this.setRaceMarker();
          }
        } else if (this.raceT > 120) {
          this.say('Race over — too slow. Get back to the pier and try again.');
          this.stage = 0;
          this.setMarker(PIER_START.x, PIER_START.z);
        }
      }
    } else if (this.index === 4) {
      if (this.stage === 0 && near(CASINO.x, CASINO.z, 8)) {
        this.stage = 1;
        this.waitT = 0;
        this.setObjective('Mission 5 — The Setup: grabbing the score…');
        this.say('Inside. The vault crew is working. Thirty seconds…');
      } else if (this.stage === 1) {
        this.waitT += dt;
        if (this.waitT > 3) {
          this.stage = 2;
          g.police.setWanted(4);
          this.setObjective('Mission 5 — The Setup: IT\'S A SETUP — RUN! Mari tipped the cops!');
          this.say('Mari, on the radio: "Sorry, Rook. Business." The cops are everywhere. RUN to the hideout!');
          this.setMarker(HIDEOUT.x, HIDEOUT.z);
        }
      } else if (this.stage === 2 && near(HIDEOUT.x, HIDEOUT.z, 8)) {
        this.say('You made it. Mari sold you out — Solmar will hear about it. The city is yours now.');
        this.completeMission(3000, 20);
      }
    }
  }

  setRaceMarker() {
    const cps = [[132, -88], [132, 88], [-88, 88], [-88, -88]];
    const [cx, cz] = cps[this.raceCp];
    this.setMarker(cx, cz);
    this.setObjective(`Mission 4 — Neon Nights: checkpoint ${this.raceCp + 1}/4 — ${this.raceT.toFixed(1)}s`);
  }
}
