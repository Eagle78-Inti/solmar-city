// state.js — the one shared game state. Every system module imports G and
// mutates it; main.js creates the scene from it. SOL is the debug / test API
// the playtest harness drives (window.SOL in the browser).

/** The seven districts of Solmar City, with their map rectangles. */
export const DISTRICTS = [
  { name: 'Old Town', x0: -280, z0: -224, x1: -56, z1: -56, standing: 0, style: 'brick' },
  { name: 'Marina Bay', x0: -280, z0: -56, x1: -56, z1: 112, standing: 0, style: 'marina' },
  { name: 'Palms Suburb', x0: -280, z0: 112, x1: -56, z1: 224, standing: 0, style: 'suburb' },
  { name: 'Portside', x0: -56, z0: -224, x1: 168, z1: -112, standing: 0, style: 'industrial' },
  { name: 'Downtown', x0: -56, z0: -112, x1: 168, z1: 224, standing: 0, style: 'towers' },
  { name: 'Neon Mile', x0: 168, z0: -224, x1: 280, z1: 224, standing: 0, style: 'neon' },
  { name: 'Kumala Beach', x0: -320, z0: -224, x1: -280, z1: 224, standing: 0, style: 'beach' },
];

/** The campaign: three acts, eight missions, two endings. */
export const CAMPAIGN = {
  name: 'The Solmar Reign',
  acts: [
    { name: 'Act I — Off the Ferry', missions: [1, 2, 3] },
    { name: 'Act II — Rising', missions: [4, 5, 6] },
    { name: 'Act III — The Reign', missions: [7, 8] },
  ],
  endings: ['Take the Crown', 'Stay Loyal'],
};

/** Weapon slots: fists plus four bought/carried guns. */
export function freshWeapons() {
  return [
    { slot: 1, name: 'Fists', ammo: Infinity, reserve: Infinity, damage: 12, range: 2.2, owned: true },
    { slot: 2, name: '.38 Pistol', ammo: 12, reserve: 48, damage: 25, range: 42, owned: true },
    { slot: 3, name: 'SMG', ammo: 0, reserve: 0, damage: 16, range: 36, owned: false, price: 800 },
    { slot: 4, name: '12G Shotgun', ammo: 0, reserve: 0, damage: 55, range: 18, owned: false, price: 1200 },
    { slot: 5, name: 'AR-9 Rifle', ammo: 0, reserve: 0, damage: 34, range: 70, owned: false, price: 2000 },
  ];
}

/** A fresh game state. */
export function freshState() {
  return {
    ready: false,
    started: false,
    paused: false,
    time: 18.2, // in-game hours; dusk start, golden hour
    day: 1,
    timeScale: 1,
    weather: 'clear', // clear | rain
    rainAmount: 0,
    cash: 800,
    respect: 0,
    rank: 1,
    rp: 0,
    health: 100,
    armour: 40,
    wanted: 0,
    wantedHeat: 0,
    character: 'Jason', // Jason | Lucia
    act: 1,
    mission: 0, // 0 = none active, 1..8 = mission number
    missionStage: 0,
    missionDone: [false, false, false, false, false, false, false, false, false],
    ending: null,
    weapons: freshWeapons(),
    weaponSlot: 2,
    player: null, // filled by people.js: {mesh, pos, yaw, onFoot, vehicle, speed}
    cars: [], // traffic + mission cars
    peds: [],
    police: [], // police cars chasing
    cops: [], // foot cops
    heli: null, // police helicopter {mesh, pos, ...} when wanted >= 4
    flyHeli: null, // the flyable helicopter the player can enter
    boats: [],
    yachts: [],
    markers: [], // mission marker meshes
    district: 'Downtown',
    location: 'Downtown',
    missionText: '',
    missionSub: '',
    subtitle: '',
    subtitleUntil: 0,
    toast: '',
    toastUntil: 0,
    stats: { shots: 0, kills: 0, carsStolen: 0, taxiFares: 0, deliveries: 0, collectibles: 0, jumps: 0, racesWon: 0, bestWanted: 0 },
    grip: 50, // driving grip meter 0-100, shown while driving
    collectibles: [], // {x, z, district, found} — hidden packages, 3 per district
    jumps: [], // {x, z, done} — stunt jump ramps
    race: null, // {active, checkpoints, next, startTime} or null
    radioTrack: 0, // index into the current station's track list
    garage: { owned: false, cars: [] },
    shop: { open: false },
    mapOpen: false,
    briefing: null, // {mission, title, stages, current} or null
    radio: 0, // station index
    saveSlot: 'solmar-save-v10',
    errors: [],
  };
}

export const G = freshState();

/** The debug / test API main.js publishes as window.SOL. */
export const SOL = {};

/** Which district contains a ground position. */
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[4]; // Downtown fallback
}

/** A district's standing as a word: Wary / Neutral / Friendly. */
export function standingWord(v) {
  if (v <= -25) return 'Wary';
  if (v >= 25) return 'Friendly';
  return 'Neutral';
}

/** A district's standing as a short label with its number. */
export function standingLabel(v) {
  return standingWord(v) + ' · ' + (v > 0 ? '+' : '') + v;
}

/** Rank from RP: 300 RP per rank. */
export function rankForRp(rp) {
  return Math.floor(rp / 300) + 1;
}

/** Add RP and update rank. */
export function addRp(amount) {
  G.rp += amount;
  G.rank = rankForRp(G.rp);
}

/** Add respect, capped at 100. */
export function addRespect(amount) {
  G.respect = Math.min(100, G.respect + amount);
}

/** Add cash. */
export function addCash(amount) {
  G.cash += amount;
}

/** Move a district's standing by delta, clamped to [-100, 100]. */
export function moveStanding(name, delta) {
  const d = DISTRICTS.find((x) => x.name === name);
  if (d) d.standing = Math.max(-100, Math.min(100, d.standing + delta));
}

/** Show a toast line until a given game-time. */
export function toast(text, seconds) {
  G.toast = text;
  G.toastUntil = performance.now() / 1000 + (seconds || 3);
}

/** True while a toast is still showing. */
export function toastVisible() {
  return G.toast !== '' && performance.now() / 1000 < G.toastUntil;
}

/** A district counts as HELD when its standing reaches 25 (Friendly). */
export function districtHeld(d) {
  return d.standing >= 25;
}

/** How many of the 7 districts the player holds. */
export function countDistrictsHeld() {
  return DISTRICTS.filter(districtHeld).length;
}

/** The player's role tag from respect (and character at the top). */
export function roleFor(respect, character) {
  if (respect >= 100) return character === 'Lucia' ? 'Queenpin' : 'Kingpin';
  if (respect >= 80) return 'Made';
  if (respect >= 60) return 'Enforcer';
  if (respect >= 40) return 'Hustler';
  if (respect >= 25) return 'Wheelman';
  if (respect >= 10) return 'Runner';
  return 'Nobody';
}
