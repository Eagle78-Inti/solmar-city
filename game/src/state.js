// state.js — the single game state object G and its factory.
// Everything the game, the HUD and the debug API read or write lives here.
import { clamp } from './util.js';

export const DISTRICTS = [
  // Ordered so the first match wins in overlaps; rectangles tile the map
  // so every mission start/destination sits inside a real district.
  // Old Town is checked before Downtown: (-56,-112) lies in both.
  { name: 'Neon Mile', cx: 130, cz: 30, w: 180, h: 160, standing: 0, held: false },
  { name: 'Old Town', cx: -130, cz: -100, w: 180, h: 140, standing: 0, held: false },
  { name: 'Downtown', cx: 0, cz: -40, w: 200, h: 160, standing: 0, held: false },
  { name: 'Marina Bay', cx: -230, cz: 0, w: 180, h: 260, standing: 0, held: false },
  { name: 'Kumala Beach', cx: -180, cz: 180, w: 200, h: 110, standing: 0, held: false },
  { name: 'Portside', cx: 40, cz: 140, w: 220, h: 130, standing: 0, held: false },
  { name: 'Palms Suburb', cx: 230, cz: -150, w: 180, h: 140, standing: 0, held: false },
];

export const STATIONS = [
  { name: 'Vice FM 88.4', tracks: ['Sunset Drive', 'Neon Rain', 'Palms at Midnight', 'Vice City Lights'] },
  { name: 'Neon Rock 101.7', tracks: ['Midnight Overdrive', 'Chrome Hearts', 'Gasoline Sunset'] },
  { name: 'Wave FM 94.2', tracks: ['Tide and Chrome', 'Salt Air', 'Boardwalk Static'] },
];

export const WEAPONS = [
  { slot: 1, name: 'Fists', ammo: Infinity, reserve: Infinity, damage: 12, rate: 0.45 },
  { slot: 2, name: '.38 Pistol', ammo: 12, reserve: 48, damage: 22, rate: 0.32 },
  { slot: 3, name: 'SMG', ammo: 0, reserve: 0, damage: 14, rate: 0.09 },
  { slot: 4, name: '12G Shotgun', ammo: 0, reserve: 0, damage: 55, rate: 0.8 },
  { slot: 5, name: 'AR-9', ammo: 0, reserve: 0, damage: 30, rate: 0.13 },
];

export function missionDefs() {
  return [
    { id: 'M1', act: 1, name: 'First Wheels', pay: 1350, from: [-8, -8], to: [56, 84],
      brief: 'Marta needs a runner. Take the corner car to the loft on Neon Mile.',
      stages: ['Meet Marta at the corner', 'Drive to the loft on Neon Mile'],
      dialogue: [
        ['Marta', 'You look hungry, Jason. Hungry people drive fast. Take the car.'],
        ['Jason', 'One job, Marta. Then we talk about Rook.'],
        ['Marta', 'Rook can wait. The loft cannot. Go.'],
      ] },
    { id: 'M2', act: 1, name: 'Neon Nights', pay: 1800, from: [56, -28], to: [112, 28],
      brief: 'A package for the Neon Mile. Do not stop for anyone in a suit.',
      stages: ['Pick up the package at the Neon Mile', 'Deliver it to the club on the strip'],
      dialogue: [
        ['Dario', 'The package is light. The people watching it are not.'],
        ['Lucia', 'Then we are lighter on our feet. Drive.'],
      ] },
    { id: 'M3', act: 2, name: 'Harbor Run', pay: 2200, from: [-168, 180], to: [-56, 120],
      brief: 'The yacht deal is on the water. Get to the Marina and keep it quiet.',
      stages: ['Reach the Marina docks', 'Meet the buyer at the pier'],
      dialogue: [
        ['Rook', 'You owe me, kid. The harbor pays your debt — or you do.'],
        ['Jason', 'I pay my debts. Not my soul.'],
      ] },
    { id: 'M4', act: 2, name: 'The Getaway', pay: 3000, from: [56, 28], to: [-56, 130],
      brief: 'A sports car, a two-star tail, and a garage that owes us a favour.',
      stages: ['Take the sports car', 'Lose the heat, then reach the garage'],
      dialogue: [
        ['Lucia', 'Two stars and counting. Drive like the city is on fire.'],
        ['Jason', 'It is. That is why I love it.'],
      ] },
    { id: 'M5', act: 2, name: 'Set Up', pay: 3000, from: [-56, -112], to: [-56, 130],
      brief: 'It is an ambush. Rook set it. Survive eighteen seconds at four stars.',
      stages: ['Reach the ambush point', 'Survive the ambush — 18s'],
      dialogue: [
        ['Rook', 'You walked into it smiling. I respect that.'],
        ['Marta', 'Eighteen seconds, Jason. Count them and stay breathing.'],
      ] },
    { id: 'M6', act: 2, name: 'Harbor Lights', pay: 3350, from: [-292, -20], to: [-300, -120],
      brief: 'Steal the white yacht from the Marina and sail it to the buyer.',
      stages: ['Board the white yacht', 'Sail it to the buyer at the far pier'],
      dialogue: [
        ['Dario', 'A yacht is just a car that cannot lie about where it has been.'],
        ['Lucia', 'Then we will make it lie beautifully.'],
      ] },
    { id: 'M7', act: 3, name: 'The Big One', pay: 9500, from: [0, -28], to: [-56, 130],
      brief: 'The vault under Downtown. Ten seconds on the crack, then run.',
      stages: ['Reach the vault under Downtown', 'Crack the vault — 10s', 'Escape to the garage'],
      dialogue: [
        ['Marta', 'Ten seconds between you and the biggest score this city has seen.'],
        ['Jason', 'Ten seconds. Then Solmar is ours.'],
      ] },
    { id: 'M8', act: 3, name: 'The Choice', pay: 25000, from: [0, -28], to: [-56, 130],
      brief: 'The crown or the crew. Choose at the vault — then live with it.',
      stages: ['Return to the vault', 'Choose: Take the Crown or Stay Loyal'],
      dialogue: [
        ['Rook', 'Take the crown, Jason. Crowns do not ask permission.'],
        ['Lucia', 'Loyalty is the only thing in this city that is not for sale.'],
      ] },
  ];
}

export function createState() {
  return {
    // Identity / progression
    cash: 800, respect: 0, rank: 1, rp: 0,
    health: 100, armour: 40,
    character: 'Jason', // or 'Lucia'
    role: 'RUNNER',
    // Clock and weather
    day: 1, time: 18.0, rain: 0,
    // Wanted / police
    wanted: 0, bestWanted: 0, heat: 0,
    // Weapons
    weapons: WEAPONS.map(w => ({ ...w })),
    activeWeapon: 1, // index into weapons (0 fists, 1 pistol)
    weaponWheel: false,
    // Missions
    missions: missionDefs().map(m => ({ ...m, done: false })),
    missionIdx: 0, missionActive: false, missionStage: 0,
    missionTimer: 0, vaultTimer: 0, ending: null,
    // Districts
    districts: DISTRICTS.map(d => ({ ...d })),
    // Collectibles / side content
    packages: [], packagesFound: 0, packagesTotal: 21,
    jumps: [], jumpsDone: 0, jumpsTotal: 5,
    racesWon: 0, carsStolen: 0,
    taxiFares: 0, courierJobs: 0,
    // World / vehicle state
    mode: 'foot', // foot | car | heli | boat
    car: null, heli: null, boat: null,
    garageOwned: false, garageCar: null,
    shopOpen: false, shopType: null,
    // UI
    paused: false, mapOpen: false, statsOpen: false, storyOpen: false,
    briefing: null, briefingStage: 0, dialogue: null, dialogueIdx: 0,
    radioIdx: 0, trackIdx: 0,
    titleOpen: true,
    // Runtime (not saved)
    pos: { x: -8, z: -8, y: 0, yaw: 0 },
    speed: 0, grip: 50, condition: 100,
    errors: [],
    startedAt: Date.now(),
  };
}

export function districtAt(G, x, z) {
  for (const d of G.districts) {
    if (Math.abs(x - d.cx) <= d.w / 2 && Math.abs(z - d.cz) <= d.h / 2) return d;
  }
  return G.districts[0];
}
export function districtStandingLabel(d) {
  if (d.held) return 'Held';
  if (d.standing >= 60) return 'Loyal';
  if (d.standing >= 30) return 'Warm';
  if (d.standing >= 10) return 'Neutral';
  return 'Wary';
}
export function addRespect(G, n) {
  G.respect = clamp(G.respect + n, 0, 100);
  G.rp += n * 10;
  G.rank = 1 + Math.floor(G.rp / 300);
}
export function addCash(G, n) { G.cash = Math.max(0, G.cash + n); }
export function setWanted(G, n) {
  G.wanted = clamp(Math.round(n), 0, 5);
  if (G.wanted > G.bestWanted) G.bestWanted = G.wanted;
}
export function districtsHeld(G) { return G.districts.filter(d => d.held).length; }
export function bumpDistrict(G, name, n) {
  const d = G.districts.find(x => x.name === name);
  if (!d) return;
  d.standing = clamp(d.standing + n, 0, 100);
  // One story mission in a district (+35) wins it: held at 30.
  if (d.standing >= 30) d.held = true;
}
export function currentMission(G) { return G.missions[G.missionIdx] || null; }
export function nextMission(G) {
  const m = G.missions.find(x => !x.done);
  return m || null;
}
export function station(G) { return STATIONS[G.radioIdx % STATIONS.length]; }
export function trackName(G) {
  const s = station(G);
  return s.tracks[G.trackIdx % s.tracks.length];
}
