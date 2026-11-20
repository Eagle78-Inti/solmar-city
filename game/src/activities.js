// activities.js — everything to do besides the story: the Ammu-Nation shop,
// the Sunset Garage, taxi fares, courier runs, hidden packages, stunt jumps
// and the Neon Mile Sprint race.

import * as THREE from 'three';
import { DISTRICTS, G, addCash, addRp, moveStanding, toast } from './state.js';
import { AVENUES, STREETS } from './city.js';
import { gfx } from './graphics.js';
import { groundDist, makeRng, pick } from './util.js';
import { buyArmour, giveAmmo } from './combat.js';
import { createCar, removeCar } from './vehicles.js';
import { saveGame } from './save.js';

export const SHOP_ITEMS = [
  { id: 'smg', name: 'SMG', price: 800, desc: 'Fast, close quarters' },
  { id: 'shotgun', name: '12G Shotgun', price: 1200, desc: 'Huge damage, short range' },
  { id: 'rifle', name: 'AR-9 Rifle', price: 2000, desc: 'Long range, precise' },
  { id: 'ammo', name: 'Pistol ammo (48)', price: 150, desc: 'Top up the .38' },
  { id: 'armour', name: 'Armour +50', price: 300, desc: 'Wear it before a fight' },
  { id: 'respray', name: 'Respray — full condition', price: 200, desc: 'Your car, like new' },
];

/** Open the shop panel (Kelo Arms / Ammu-Nation). */
export function openShop() {
  G.shop.open = true;
}

/** Buy a shop item by id. Returns true when the purchase lands. */
export function shopBuy(id) {
  if (!G.shop.open) return false;
  const item = SHOP_ITEMS.find((x) => x.id === id);
  if (!item) return false;
  if (G.cash < item.price) {
    toast('Not enough cash for the ' + item.name, 2);
    return false;
  }
  if (id === 'smg') giveAmmo(3, 90);
  else if (id === 'shotgun') giveAmmo(4, 18);
  else if (id === 'rifle') giveAmmo(5, 90);
  else if (id === 'ammo') giveAmmo(2, 48);
  else if (id === 'armour') {
    if (!buyArmour()) return false;
  } else if (id === 'respray') {
    const v = G.player && G.player.vehicle;
    if (v) v.condition = 100;
  }
  G.cash -= item.price;
  toast('Bought: ' + item.name + ' — $' + item.price, 3);
  return true;
}

export function closeShop() {
  G.shop.open = false;
}

/**
 * The garage at (-56, 130): buy it for $4,000, then store the car you are
 * driving in it, or take a stored car back out.
 */
export function storeCarAtGarage() {
  if (!G.garage.owned) {
    if (G.cash < 4000) {
      toast('Sunset Garage costs $4,000 — come back with the cash', 3);
      return false;
    }
    G.cash -= 4000;
    G.garage.owned = true;
    toast('Sunset Garage is yours — park a car here to store it', 4);
    return true;
  }
  const p = G.player;
  if (p && !p.onFoot && p.vehicle && p.vehicle.kind !== 'heli' && p.vehicle.kind !== 'boat' && p.vehicle.kind !== 'yacht') {
    const v = p.vehicle;
    G.garage.cars.push(v.kind);
    removeCar(v);
    p.vehicle = null;
    p.onFoot = true;
    p.mesh.visible = true;
    p.pos.set(-56, 0, 124);
    p.mesh.position.copy(p.pos);
    toast('Car stored in the garage (' + G.garage.cars.length + ' stored)', 3);
    return true;
  }
  if (G.garage.cars.length > 0) {
    const kind = G.garage.cars.pop();
    const car = createCar(kind, -52, 130, Math.PI / 2, { cruise: 12 });
    toast('Took the ' + kind + ' out of the garage', 3);
    return true;
  }
  toast('Garage is empty — drive a car here to store it', 3);
  return false;
}

/** Quick save at Marta's Loft, the safehouse. */
export function tryQuickSave() {
  saveGame();
  toast('Saved at Marta’s Loft', 3);
  return true;
}

/** Respray at the Portside shop: full condition for $200. */
export function tryRespray() {
  const p = G.player;
  if (!p || p.onFoot || !p.vehicle) {
    toast('Drive a car in to respray it', 2);
    return false;
  }
  if (G.cash < 200) {
    toast('Respray costs $200', 2);
    return false;
  }
  G.cash -= 200;
  p.vehicle.condition = 100;
  toast('Resprayed — condition 100', 3);
  return true;
}

/** Taxi work: press T, drive the fare to the marker, get paid. */
export function startTaxi() {
  const rng = makeRng((performance.now() | 0) + 11);
  const x = pick(rng, AVENUES);
  const z = pick(rng, STREETS);
  G.taxi = { x, z, active: true, fare: 40 + Math.floor(rng() * 50) };
  toast('Taxi fare — drive to the marker ($' + G.taxi.fare + ')', 3);
  return true;
}

/** Courier work: press Y, deliver fast for a bonus. */
export function startCourier() {
  const rng = makeRng((performance.now() | 0) + 23);
  const x = pick(rng, AVENUES);
  const z = pick(rng, STREETS);
  G.courier = { x, z, active: true, startedAt: performance.now() / 1000 };
  toast('Courier — deliver the package to the marker', 3);
  return true;
}

/** Hidden packages: three per district, glowing amber, worth $250 each. */
export function initCollectibles() {
  const rng = makeRng(1357);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffb52e, emissive: 0xff9a00, emissiveIntensity: 1.4 });
  for (const d of DISTRICTS) {
    if (d.name === 'Kumala Beach') {
      // Packages on the sand, near the waterline.
      for (let i = 0; i < 3; i++) {
        addPackage(-312 + rng() * 14, -160 + i * 160 + rng() * 20, d, mat, rng);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) {
      // On a road band inside the district: pick an avenue and a street.
      const avenues = AVENUES.filter((a) => a >= d.x0 + 20 && a < d.x1 - 10);
      const streets = STREETS.filter((s) => s >= d.z0 + 20 && s < d.z1 - 10);
      const x = (avenues.length ? pick(rng, avenues) : (d.x0 + d.x1) / 2) + (rng() < 0.5 ? -9 : 9);
      const z = (streets.length ? pick(rng, streets) : (d.z0 + d.z1) / 2) + (rng() < 0.5 ? -9 : 9);
      addPackage(x, z, d, mat, rng);
    }
  }
}

function addPackage(x, z, district, mat, rng) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
  mesh.position.set(x, 0.9, z);
  mesh.rotation.y = rng() * Math.PI;
  gfx.scene.add(mesh);
  G.collectibles.push({ x, z, district: district.name, found: false, mesh });
}

/** Pick up any package the player walks or drives close to. */
function checkCollectibles() {
  const p = G.player;
  if (!p) return;
  for (const c of G.collectibles) {
    if (c.found) continue;
    if (groundDist(p.pos.x, p.pos.z, c.x, c.z) < 3.5) {
      c.found = true;
      if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
      G.stats.collectibles++;
      addCash(250);
      addRp(5);
      moveStanding(c.district, 5);
      toast('Hidden package found in ' + c.district + ' — +$250 (' + G.stats.collectibles + '/21)', 3);
    }
  }
}

/** Stunt jump ramps: five around the city, hit one fast in a car. */
export function initJumps() {
  const spots = [[112, 196], [-112, -196], [224, 196], [-224, 196], [56, -196]];
  const districts = ['Downtown', 'Old Town', 'Neon Mile', 'Palms Suburb', 'Portside'];
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.7 }),
    );
    ramp.position.set(x, 0.4, z);
    ramp.rotation.x = -0.32;
    ramp.castShadow = true;
    gfx.scene.add(ramp);
    const chevron = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }),
    );
    chevron.rotation.x = -Math.PI / 2 - 0.32;
    chevron.position.set(x, 0.95, z - 1);
    gfx.scene.add(chevron);
    G.jumps.push({ x, z, district: districts[i], done: false });
  }
}

function checkJumps() {
  const p = G.player;
  if (!p || p.onFoot || !p.vehicle) return;
  for (const j of G.jumps) {
    if (j.done) continue;
    if (groundDist(p.pos.x, p.pos.z, j.x, j.z) < 5 && Math.abs(p.vehicle.speed || 0) > 14) {
      j.done = true;
      p.vehicle.jumpT = 1.2;
      G.stats.jumps++;
      addCash(500);
      addRp(10);
      moveStanding(j.district, 5);
      toast('STUNT JUMP! +$500 (' + G.stats.jumps + '/5)', 3);
    }
  }
}

/** The Neon Mile Sprint: a checkpoint race around the east side. */
export const RACE = {
  start: { x: 224, z: 0 },
  checkpoints: [{ x: 224, z: 112 }, { x: 280, z: 112 }, { x: 280, z: -112 }, { x: 224, z: -112 }],
  finish: { x: 224, z: 0 },
};

export function startRace() {
  const p = G.player;
  if (!p || p.onFoot) {
    toast('Get in a car first — the race starts at Neon Mile', 3);
    return false;
  }
  G.race = { active: true, next: 0, startTime: performance.now() / 1000 };
  toast('Neon Mile Sprint — hit every checkpoint, back to the start!', 4);
  return true;
}

function checkRace() {
  if (!G.race || !G.race.active) return;
  const p = G.player;
  if (!p || p.onFoot) return;
  const target = G.race.next < RACE.checkpoints.length ? RACE.checkpoints[G.race.next] : RACE.finish;
  if (groundDist(p.pos.x, p.pos.z, target.x, target.z) < 9) {
    G.race.next++;
    if (G.race.next > RACE.checkpoints.length) {
      const secs = (performance.now() / 1000 - G.race.startTime).toFixed(1);
      G.race.active = false;
      G.stats.racesWon++;
      addCash(1500);
      addRp(50);
      moveStanding('Neon Mile', 10);
      toast('Race won in ' + secs + 's — +$1,500', 5);
    } else {
      toast('Checkpoint ' + G.race.next + '/' + (RACE.checkpoints.length + 1), 2);
    }
  }
}

/** Taxi and courier completions. */
function checkJobs() {
  const p = G.player;
  if (!p || p.onFoot) return;
  if (G.taxi && G.taxi.active && groundDist(p.pos.x, p.pos.z, G.taxi.x, G.taxi.z) < 7) {
    G.taxi.active = false;
    addCash(G.taxi.fare);
    G.stats.taxiFares++;
    addRp(10);
    toast('Fare complete — +$' + G.taxi.fare, 3);
  }
  if (G.courier && G.courier.active && groundDist(p.pos.x, p.pos.z, G.courier.x, G.courier.z) < 7) {
    G.courier.active = false;
    const fast = performance.now() / 1000 - G.courier.startedAt < 45;
    const pay = fast ? 90 : 60;
    addCash(pay);
    G.stats.deliveries++;
    addRp(10);
    toast('Delivery complete — +$' + pay + (fast ? ' (fast bonus!)' : ''), 3);
  }
}

/** Per-frame activity checks. */
export function updateActivities() {
  checkCollectibles();
  checkJumps();
  checkRace();
  checkJobs();
}
