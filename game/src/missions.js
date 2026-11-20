// Solmar City v8 — story missions, taxi fares and courier deliveries.
// Six missions take Leo Marlow from a $800 nobody to a $12,500 legend of
// Solmar City; the first five match v7's measured payouts, the sixth is new.
import * as THREE from 'three';
import { clamp, dist2, money } from './util.js';

const MISSIONS = [
  {
    id: 1, title: 'First Wheels', giver: 'Marta Reyes',
    brief: 'Marta needs wheels. Steal any car and bring it to her garage in Neon Mile.',
    payout: 1350, respect: 10,
    steps: [
      { text: 'Steal a car — press E near one', kind: 'getCar' },
      { text: "Drive to Marta's garage in Neon Mile", kind: 'goto', x: 180, z: 0, r: 6 },
    ],
  },
  {
    id: 2, title: 'The Pickup', giver: 'Marta Reyes',
    brief: 'A package is waiting at the Harbor. Grab it and deliver it downtown. The cops will notice.',
    payout: 1800, respect: 15,
    steps: [
      { text: 'Drive to the package at the Harbor', kind: 'goto', x: -180, z: 210, r: 6 },
      { text: 'Pick up the package on foot', kind: 'collect', x: -180, z: 210, r: 3.5 },
      { text: 'Deliver the package downtown', kind: 'goto', x: 0, z: 0, r: 6, wanted: 2 },
    ],
  },
  {
    id: 3, title: 'Harbor Run', giver: 'Marta Reyes',
    brief: 'Three crates are floating in the bay. Take a boat from the marina and fish them out.',
    payout: 2200, respect: 15,
    steps: [
      { text: 'Take a boat from the marina', kind: 'getBoat' },
      { text: 'Collect crate 1 of 3', kind: 'collect', x: -300, z: -120, r: 6 },
      { text: 'Collect crate 2 of 3', kind: 'collect', x: -320, z: 40, r: 6 },
      { text: 'Collect crate 3 of 3', kind: 'collect', x: -290, z: 180, r: 6 },
      { text: 'Return to the marina pier', kind: 'goto', x: -210, z: 240, r: 8 },
    ],
  },
  {
    id: 4, title: 'Neon Heist', giver: 'Marta Reyes',
    brief: 'The casino vault in Neon Mile is light tonight. Walk in, grab the cash, and run.',
    payout: 3000, respect: 20,
    steps: [
      { text: 'Reach the casino in Neon Mile', kind: 'goto', x: 180, z: 30, r: 6 },
      { text: 'Grab the vault cash', kind: 'collect', x: 180, z: 30, r: 4 },
      { text: 'Lose the heat — reach the safehouse', kind: 'goto', x: 120, z: 180, r: 7, wanted: 3 },
    ],
  },
  {
    id: 5, title: 'The Setup', giver: 'Marta Reyes',
    brief: 'Meet Marta at the docks after dark. It is a trap — the whole department is coming, helicopter and all.',
    payout: 3000, respect: 20, night: true,
    steps: [
      { text: 'Meet Marta at the docks after dark', kind: 'goto', x: -190, z: 260, r: 6 },
      { text: 'Ambush! Survive the setup', kind: 'wait', seconds: 8, wanted: 4 },
      { text: 'Escape the helicopter — reach the safehouse', kind: 'goto', x: 120, z: 180, r: 7 },
    ],
  },
  {
    id: 6, title: 'Harbor Lights', giver: 'Marta Reyes',
    brief: 'One last job: steal the white yacht from the marina and sail it to the buyer at the far pier. Four stars, no mistakes.',
    payout: 3350, respect: 20, night: true,
    steps: [
      { text: 'Steal the yacht from the marina', kind: 'getBoat', x: -268, z: -60, r: 10 },
      { text: 'Sail the yacht to the buyer at the far pier', kind: 'goto', x: -280, z: 60, r: 9, wanted: 4 },
      { text: 'Hand over the yacht', kind: 'collect', x: -280, z: 60, r: 6 },
    ],
  },
];

export const MISSION_TOTALS = {
  startCash: 800,
  finalCash: 15500,
  finalRespect: 100,
};

export class Missions {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.done = 0; // missions completed
    this.active = null; // mission def
    this.stepIndex = 0;
    this.waitTimer = 0;
    this.marker = this.makeMarker(0x3aa0ff);
    this.marker.visible = false;
    scene.add(this.marker);
    this.taxi = null;
    this.delivery = null;
    this.jobCooldown = 0;
    this.onMissionComplete = null;
    this.onStep = null;
  }

  makeMarker(color) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 26, 18, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 13;
    g.add(cyl);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    g.userData.cyl = cyl;
    g.userData.ring = ring;
    return g;
  }

  setMarker(x, z, color) {
    this.marker.visible = true;
    this.marker.position.set(x, 0, z);
    this.marker.userData.cyl.material.color.setHex(color);
    this.marker.userData.ring.material.color.setHex(color);
  }

  hideMarker() {
    this.marker.visible = false;
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.steps[this.stepIndex] || null;
  }

  currentText() {
    const s = this.currentStep();
    if (s) return s.text;
    if (this.taxi) return this.taxi.text;
    if (this.delivery) return this.delivery.text;
    if (this.done >= MISSIONS.length) return 'Solmar City is yours. Free roam — taxi and deliveries still pay.';
    return `See Marta — mission ${this.done + 1}: ${MISSIONS[this.done].title} (press M)`;
  }

  startMission(index) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.active = def;
    this.stepIndex = 0;
    this.waitTimer = 0;
    this.audio.sting(true);
    if (this.onStep) this.onStep(`Mission ${def.id}: ${def.title} — ${def.brief}`);
    this.placeMarkerForStep();
    return true;
  }

  placeMarkerForStep() {
    const s = this.currentStep();
    if (!s) { this.hideMarker(); return; }
    if (s.kind === 'goto' || s.kind === 'collect') this.setMarker(s.x, s.z, 0x3aa0ff);
    else if (s.kind === 'getCar') this.setMarker(0, 0, 0x3aa0ff); // marker follows nearest car (see update)
    else if (s.kind === 'getBoat') this.setMarker(s.x ?? -268, s.z ?? -60, 0x3aa0ff);
    else this.hideMarker();
  }

  completeStep(ctx) {
    const s = this.currentStep();
    if (!s) return;
    this.audio.blip(990, 0.1, 'sine', 0.15);
    this.stepIndex += 1;
    // A step's `wanted` applies when the step STARTS — the heat arrives for
    // the drive ahead, not after it is over.
    const next = this.currentStep();
    if (next && next.wanted !== undefined && ctx.police) ctx.police.setWanted(next.wanted);
    if (this.stepIndex >= this.active.steps.length) {
      this.completeMission(ctx);
    } else {
      this.placeMarkerForStep();
      if (this.onStep) this.onStep(this.currentStep().text);
    }
  }

  completeMission(ctx) {
    const def = this.active;
    ctx.player.cash += def.payout;
    ctx.player.respect = clamp(ctx.player.respect + def.respect, 0, 100);
    this.done += 1;
    this.active = null;
    this.hideMarker();
    this.audio.sting(true);
    if (ctx.police) ctx.police.setWanted(0);
    if (this.onMissionComplete) this.onMissionComplete(def, ctx.player.cash, ctx.player.respect);
    if (this.onStep) this.onStep(`Mission complete: ${def.title} +${money(def.payout)} — cash ${money(ctx.player.cash)}, respect ${ctx.player.respect}`);
  }

  update(dt, ctx) {
    this.jobCooldown = Math.max(0, this.jobCooldown - dt);
    if (this.marker.visible) {
      const pulse = 0.16 + Math.sin(performance.now() * 0.005) * 0.07;
      this.marker.userData.cyl.material.opacity = pulse;
      this.marker.rotation.y += dt * 0.8;
    }
    const p = ctx.player.pos;
    // Mission steps.
    if (this.active) {
      const s = this.currentStep();
      if (s) {
        if (s.kind === 'goto') {
          if (dist2(p.x, p.z, s.x, s.z) < s.r) this.completeStep(ctx);
        } else if (s.kind === 'collect') {
          const onFoot = !ctx.player.inCar && !ctx.player.onBoat;
          if (onFoot && dist2(p.x, p.z, s.x, s.z) < s.r) this.completeStep(ctx);
          else if (ctx.player.onBoat && dist2(p.x, p.z, s.x, s.z) < s.r) this.completeStep(ctx);
        } else if (s.kind === 'getCar') {
          if (ctx.player.inCar) this.completeStep(ctx);
        } else if (s.kind === 'getBoat') {
          if (ctx.player.onBoat) this.completeStep(ctx);
        } else if (s.kind === 'wait') {
          this.waitTimer += dt;
          if (this.waitTimer >= s.seconds) this.completeStep(ctx);
        }
      }
    }
    // Taxi: pick up the waiting passenger, then drive them to the destination.
    if (this.taxi) {
      const t = this.taxi;
      if (!t.pickedUp) {
        if (ctx.player.inCar && dist2(p.x, p.z, t.px, t.pz) < 4) {
          t.pickedUp = true;
          t.text = `Taxi: drive the passenger to ${t.destName}`;
          this.setMarker(t.dx, t.dz, 0xf2c200);
          this.audio.blip(760, 0.1, 'sine', 0.15);
          if (this.onStep) this.onStep(t.text);
        }
      } else if (dist2(p.x, p.z, t.dx, t.dz) < 5) {
        const fare = t.fare;
        ctx.player.cash += fare;
        this.audio.sting(true);
        if (this.onStep) this.onStep(`Taxi fare +${money(fare)} — cash ${money(ctx.player.cash)}`);
        this.taxi = null;
        this.hideMarker();
        this.jobCooldown = 4;
      }
    }
    // Deliveries: pick up the parcel, deliver before the timer runs out.
    if (this.delivery) {
      const d = this.delivery;
      d.timeLeft -= dt;
      if (d.timeLeft <= 0) {
        if (this.onStep) this.onStep('Delivery failed — too slow. No pay.');
        this.delivery = null;
        this.hideMarker();
        this.jobCooldown = 4;
      } else if (!d.pickedUp) {
        if (dist2(p.x, p.z, d.px, d.pz) < 4) {
          d.pickedUp = true;
          d.text = `Delivery: ${Math.ceil(d.timeLeft)}s left — get it to ${d.destName}`;
          this.setMarker(d.dx, d.dz, 0x2ecc71);
          this.audio.blip(760, 0.1, 'sine', 0.15);
          if (this.onStep) this.onStep(d.text);
        }
      } else if (dist2(p.x, p.z, d.dx, d.dz) < 5) {
        const bonus = d.timeLeft > 45 ? 30 : 0;
        const pay = d.pay + bonus;
        ctx.player.cash += pay;
        this.audio.sting(true);
        if (this.onStep) this.onStep(`Delivery done +${money(pay)}${bonus ? ' (fast bonus!)' : ''} — cash ${money(ctx.player.cash)}`);
        this.delivery = null;
        this.hideMarker();
        this.jobCooldown = 4;
      }
    }
  }

  startTaxi(ctx) {
    if (this.taxi || this.delivery || this.jobCooldown > 0 || !ctx.player.inCar) return false;
    const p = ctx.player.pos;
    const spots = [
      { x: 60, z: 0, name: 'Downtown' }, { x: 180, z: 60, name: 'Neon Mile' },
      { x: -180, z: -120, name: 'Beachside' }, { x: 0, z: 180, name: 'South Solmar' },
      { x: -60, z: -180, name: 'Old Town' }, { x: 240, z: -60, name: 'East End' },
    ];
    const pick = spots[Math.floor(Math.random() * spots.length)];
    const dest = spots[Math.floor(Math.random() * spots.length)];
    const fare = 40 + Math.round(dist2(pick.x, pick.z, dest.x, dest.z) * 0.35);
    this.taxi = {
      px: pick.x, pz: pick.z, dx: dest.x, dz: dest.z,
      destName: dest.name, fare,
      text: `Taxi: pick up the passenger at ${pick.name}`,
    };
    this.setMarker(pick.x, pick.z, 0xf2c200);
    if (this.onStep) this.onStep(this.taxi.text);
    return true;
  }

  startDelivery(ctx) {
    if (this.delivery || this.taxi || this.jobCooldown > 0) return false;
    const p = ctx.player.pos;
    const shops = [
      { x: 120, z: -60, name: 'Neon Mile shop' }, { x: -60, z: 60, name: 'Downtown deli' },
      { x: -180, z: 120, name: 'Harbor store' }, { x: 60, z: -180, name: 'Old Town bakery' },
    ];
    const homes = [
      { x: 240, z: 180, name: 'East End house' }, { x: -120, z: -240, name: 'Beachside flat' },
      { x: 0, z: 240, name: 'South Solmar house' }, { x: 180, z: -180, name: 'Neon Mile loft' },
    ];
    const shop = shops[Math.floor(Math.random() * shops.length)];
    const home = homes[Math.floor(Math.random() * homes.length)];
    this.delivery = {
      px: shop.x, pz: shop.z, dx: home.x, dz: home.z,
      destName: home.name, pay: 60, timeLeft: 90, pickedUp: false,
      text: `Delivery: pick up the parcel at the ${shop.name}`,
    };
    this.setMarker(shop.x, shop.z, 0x2ecc71);
    if (this.onStep) this.onStep(this.delivery.text);
    return true;
  }

  // Debug helper for the playtest harness: teleport the player (or their car)
  // to the current objective and let the normal proximity checks fire.
  debugGotoObjective(ctx) {
    const s = this.currentStep();
    if (this.taxi) {
      const t = this.taxi;
      const tx = t.pickedUp ? t.dx : t.px;
      const tz = t.pickedUp ? t.dz : t.pz;
      this.teleportPlayer(ctx, tx, tz);
      return 'taxi';
    }
    if (this.delivery) {
      const d = this.delivery;
      const tx = d.pickedUp ? d.dx : d.px;
      const tz = d.pickedUp ? d.dz : d.pz;
      this.teleportPlayer(ctx, tx, tz);
      return 'delivery';
    }
    if (!s) return 'none';
    if (s.kind === 'goto' || s.kind === 'collect') {
      if (s.kind === 'collect') {
        // Collecting needs the player on foot: leave the car or boat behind
        // before teleporting to the pickup point.
        if (ctx.player.inCar) ctx.player.exitCar();
        else if (ctx.player.onBoat) ctx.player.exitBoat();
      }
      this.teleportPlayer(ctx, s.x, s.z);
      return s.kind;
    }
    if (s.kind === 'getCar') {
      if (!ctx.player.inCar && ctx.debugEnterCar) ctx.debugEnterCar();
      return 'getCar';
    }
    if (s.kind === 'getBoat') {
      // Boarding a boat needs the player on foot: leave the car behind.
      if (ctx.player.inCar) ctx.player.exitCar();
      if (!ctx.player.onBoat && ctx.debugEnterBoat) ctx.debugEnterBoat(s.x, s.z);
      return 'getBoat';
    }
    if (s.kind === 'wait') {
      this.waitTimer = s.seconds;
      return 'wait';
    }
    return 'none';
  }

  teleportPlayer(ctx, x, z) {
    // Teleport moves the player and whatever they are driving: a car rides
    // along (so a taxi pickup still finds the player in the car), while a
    // boat is left behind — boats cannot drive onto dry land.
    const pl = ctx.player;
    if (pl.inCar) { pl.inCar.x = x; pl.inCar.z = z; }
    else if (pl.onBoat) {
      pl.exitBoat();
      pl.x = x;
      pl.z = z;
      pl.mesh.position.set(x, 0, z);
    } else {
      pl.x = x;
      pl.z = z;
      pl.mesh.position.set(x, 0, z);
    }
  }
}
