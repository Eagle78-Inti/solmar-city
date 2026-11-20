// missions.js — "The Solmar Reign": three acts, eight missions, two endings.
// Named characters talk: Marta Voss runs the garage, her brother Dario owes
// Rook fifty grand, and the player works the debt off — or takes the crown.

import * as THREE from 'three';
import { G, addCash, addRespect, addRp, moveStanding, toast } from './state.js';
import { gfx } from './graphics.js';
import { groundDist } from './util.js';
import { createCar } from './vehicles.js';
import { addWanted, clearWanted } from './police.js';
import { saveGame } from './save.js';

/**
 * The story. Payouts are the cash the mission pays; totals run
 * $800 → $2,150 → $3,950 → $6,150 → $9,150 → $12,150 → $15,500 → $25,000 → $50,000.
 */
export const MISSIONS = [
  {
    n: 1, title: 'First Wheels', act: 1, district: 'Downtown', payout: 1350, respect: 10,
    brief: [
      { who: 'Marta', text: "Jason. My brother Dario owes Rook fifty grand, and Rook's boys just took Dario's car as a down payment." },
      { who: 'Marta', text: "It's parked up on Bintu Street. Take it back. Quietly if you can. Loudly if you must." },
      { who: 'Jason', text: 'And if Rook’s boys are watching it?' },
      { who: 'Marta', text: 'Then they learn my name. Bring the car to my garage on the west side.' },
    ],
    stages: [
      { text: 'Go see Marta at the corner', kind: 'goto', x: -8, z: -8 },
      { text: "Take Dario's car back", kind: 'enter', x: 56, z: 84, car: 'sedan' },
      { text: "Bring it to Marta's garage", kind: 'drive', x: -56, z: 130 },
    ],
    lines: {
      1: [{ who: 'Dario', text: "That's my car! Tell Marta I said thanks — and tell Rook I'm good for it." }],
      2: [{ who: 'Marta', text: 'Good. One car back, forty-nine thousand to go.' }],
    },
  },
  {
    n: 2, title: 'Neon Nights', act: 1, district: 'Neon Mile', payout: 1800, respect: 15,
    brief: [
      { who: 'Lucia', text: "Rook's tail has been on me all night. Drive me through Neon Mile and lose him." },
      { who: 'Marta', text: "Don't stop for anything. Neon Mile's cameras belong to Rook too." },
    ],
    stages: [
      { text: 'Pick up Lucia', kind: 'goto', x: 56, z: -28 },
      { text: 'Drive through Neon Mile', kind: 'drive', x: 112, z: 28 },
      { text: 'Lose the tail', kind: 'survive', seconds: 6, wanted: 1 },
    ],
    lines: {
      1: [{ who: 'Lucia', text: 'There he is. Black sedan, two cars back. Drive like you mean it.' }],
      2: [{ who: 'Lucia', text: 'Gone. You drive almost as well as you talk, Jason.' }],
    },
  },
  {
    n: 3, title: 'Harbor Run', act: 1, district: 'Portside', payout: 2200, respect: 15,
    brief: [
      { who: 'Marta', text: "Crates in the Portside warehouse. Rook's men count them at midnight — be gone by then." },
      { who: 'Dario', text: "They're heavy. And they tick. Don't ask." },
      { who: 'Jason', text: "I wasn't going to." },
    ],
    stages: [
      { text: 'Reach the Portside warehouse', kind: 'goto', x: -168, z: 180 },
      { text: 'Take the truck', kind: 'enter', x: -168, z: 180, car: 'truck' },
      { text: 'Deliver the crates to the marina', kind: 'drive', x: -56, z: 120 },
    ],
    lines: {
      1: [{ who: 'Dario', text: 'Careful with the crates. Rook checks the seals.' }],
      2: [{ who: 'Marta', text: 'Delivered. The marina owes us one now.' }],
    },
  },
  {
    n: 4, title: 'The Getaway', act: 1, district: 'Downtown', payout: 3000, respect: 20,
    brief: [
      { who: 'Lucia', text: "The sports car on 56 North. Rook's prize. Take it, and take it fast." },
      { who: 'Marta', text: "Two stars the moment you touch it. Don't stop till the garage." },
    ],
    stages: [
      { text: "Take Rook's sports car", kind: 'enter', x: 56, z: 28, car: 'sports', wanted: 2 },
      { text: 'Outrun the law to the garage', kind: 'drive', x: -56, z: 130 },
    ],
    lines: {
      0: [{ who: 'Lucia', text: 'That engine. Rook polishes it more than his shoes.' }],
      1: [{ who: 'Marta', text: 'Beautiful. Rook is going to be furious. I love it.' }],
    },
  },
  {
    n: 5, title: 'Set Up', act: 2, district: 'Old Town', payout: 3000, respect: 10,
    brief: [
      { who: 'Kade', text: "Rook paid me to bring you in, Jason. Four stars, no backup. Just you and me and the night." },
      { who: 'Marta', text: "It's a trap. Walk in anyway — and walk out." },
      { who: 'Jason', text: 'Tell Rook the trap needs a bigger cage.' },
    ],
    stages: [
      { text: 'Walk into the ambush', kind: 'goto', x: -56, z: -112 },
      { text: 'Survive the ambush', kind: 'survive', seconds: 18, wanted: 4 },
      { text: 'Lose them — reach the garage', kind: 'drive', x: -56, z: 130 },
    ],
    lines: {
      1: [{ who: 'Kade', text: 'Nobody walks out of Old Town tonight!' }],
      2: [{ who: 'Marta', text: 'You walked out. Rook just lost a lot of men and a lot of face.' }],
    },
  },
  {
    n: 6, title: 'Harbor Lights', act: 2, district: 'Marina Bay', payout: 3350, respect: 10,
    brief: [
      { who: 'Marta', text: "Rook's white yacht. It sails tonight with his money on it. Take the yacht, sail it to the buyer at the south pier." },
      { who: 'Lucia', text: 'A yacht. You finally get a boat, Jason. Try not to sink it.' },
    ],
    stages: [
      { text: 'Reach the yacht at the north pier', kind: 'goto', x: -292, z: -20 },
      { text: 'Board the yacht', kind: 'boat', x: -292, z: -20 },
      { text: 'Sail it to the buyer at the south pier', kind: 'boat', x: -300, z: -120 },
    ],
    lines: {
      1: [{ who: 'Lucia', text: 'Cast off. Rook’s money is in the cabin — don’t open it.' }],
      2: [{ who: 'Marta', text: 'The buyer paid. Rook’s yacht is ours now.' }],
    },
  },
  {
    n: 7, title: 'The Big One', act: 3, district: 'Downtown', payout: 9500, respect: 10,
    brief: [
      { who: 'Lucia', text: 'Solmar Bank. The vault. Ten seconds on the drill and we are rich — or we are dead.' },
      { who: 'Marta', text: "Rook keeps his ledger in that vault. Take the money and the ledger." },
    ],
    stages: [
      { text: 'Reach Solmar Bank', kind: 'goto', x: 0, z: -28 },
      { text: 'Crack the vault — stay close', kind: 'hold', x: 0, z: -28, seconds: 10, wanted: 3 },
      { text: 'Escape to the garage', kind: 'drive', x: -56, z: 130 },
    ],
    lines: {
      1: [{ who: 'Lucia', text: 'Drill’s in. Ten seconds. Don’t move.' }],
      2: [{ who: 'Marta', text: 'The ledger is ours. Rook doesn’t own this city anymore — we do.' }],
    },
  },
  {
    n: 8, title: 'The Choice', act: 3, district: 'Kumala Beach', payout: 25000, respect: 10,
    brief: [
      { who: 'Rook', text: 'Fifty grand, Jason. Take the crown — keep the money, take my city. Or stay loyal — pay Dario’s debt and walk away a nobody.' },
      { who: 'Marta', text: 'Your call. Either way, this ends tonight.' },
      { who: 'Dario', text: "Don't do it for me, Jason. Do it for the city." },
    ],
    stages: [
      { text: 'Choose: Take the Crown, or Stay Loyal', kind: 'choice', crown: { x: 0, z: -28 }, loyal: { x: -292, z: 90 } },
    ],
    lines: {},
  },
];

/** The mission list for the pause menu: title, act, payout, done. */
export function storyList() {
  return MISSIONS.map((m) => ({
    n: m.n,
    title: m.title,
    act: m.act,
    payout: m.payout,
    done: G.missionDone[m.n] || false,
    district: m.district,
  }));
}

/** Total cash the campaign pays if every mission is finished. */
export function campaignTotal() {
  return 800 + MISSIONS.reduce((n, m) => n + m.payout, 0);
}

/** A mission marker: a light beam and a ground ring at a target. */
function makeMarker(x, z, color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 21;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.6, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  group.position.set(x, 0, z);
  gfx.scene.add(group);
  G.markers.push(group);
  return group;
}

function clearMarkers() {
  for (const m of G.markers) {
    if (m.parent) m.parent.remove(m);
  }
  G.markers = [];
}

/** The current stage's target, for the HUD, the map and the test harness. */
export function stageTarget() {
  const m = MISSIONS[G.mission - 1];
  if (!m || G.missionStage >= m.stages.length) return null;
  const s = m.stages[G.missionStage];
  if (s.kind === 'choice') return { kind: 'choice', crown: s.crown, loyal: s.loyal };
  return { kind: s.kind, x: s.x, z: s.z, text: s.text };
}

/** Start a mission: show its briefing with the dialogue. */
export function startMission(n) {
  const m = MISSIONS[n - 1];
  if (!m) return false;
  if (G.missionDone[n]) return false;
  G.mission = n;
  G.missionStage = 0;
  G.act = m.act;
  G.briefing = { mission: n, title: m.title, act: m.act, brief: m.brief, stages: m.stages.map((s) => s.text) };
  G.missionText = m.title;
  G.missionSub = 'Read the briefing — press Enter to begin';
  clearMarkers();
  // Spawn the mission's car, if it has one.
  if (n === 1) createCar('sedan', 56, 84, Math.PI / 2, { mission: true, missionN: 1, cruise: 12 });
  if (n === 3) createCar('truck', -168, 180, 0, { mission: true, missionN: 3, cruise: 11 });
  if (n === 4) createCar('sports', 56, 28, Math.PI, { mission: true, missionN: 4, cruise: 14 });
  return true;
}

/** Accept the briefing and begin the first stage. */
export function acceptBriefing() {
  if (!G.briefing) return false;
  G.briefing = null;
  beginStage();
  return true;
}

export function hideBriefing() {
  G.briefing = null;
  G.mission = 0;
  G.missionStage = 0;
  G.missionText = '';
  clearMarkers();
}

/** Set up the current stage: its marker, its wanted level, its line. */
export function beginStage() {
  const m = MISSIONS[G.mission - 1];
  if (!m) return;
  const s = m.stages[G.missionStage];
  if (!s) return;
  clearMarkers();
  G.missionText = m.title;
  G.missionSub = s.text;
  if (s.kind === 'choice') {
    makeMarker(s.crown.x, s.crown.z, 0xffd23e);
    makeMarker(s.loyal.x, s.loyal.z, 0x3ec6ff);
    sayLine({ who: 'Rook', text: 'Gold is the crown. Blue is the debt. Choose.' });
    return;
  }
  makeMarker(s.x, s.z, 0xffd23e);
  if (s.wanted) addWanted(s.wanted);
  if (s.kind === 'survive' || s.kind === 'hold') s.left = s.seconds;
  const lines = m.lines[G.missionStage];
  if (lines) for (const line of lines) sayLine(line);
}

/** Show a line of dialogue as a subtitle. */
function sayLine(line) {
  G.subtitle = line.who + ': ' + line.text;
  G.subtitleUntil = performance.now() / 1000 + 5;
  toast(line.who + ': ' + line.text, 5);
}

/** Per-frame mission logic: advance stages, pay out, end the campaign. */
export function updateMissions(dt) {
  if (!G.mission || G.briefing) return;
  const m = MISSIONS[G.mission - 1];
  if (!m) return;
  const s = m.stages[G.missionStage];
  if (!s) return;
  const p = G.player;
  if (!p) return;
  const px = p.pos.x;
  const pz = p.pos.z;
  let done = false;
  if (s.kind === 'goto') {
    done = groundDist(px, pz, s.x, s.z) < 6;
  } else if (s.kind === 'enter') {
    done = !p.onFoot && p.vehicle && p.vehicle.isMission;
  } else if (s.kind === 'drive') {
    done = !p.onFoot && groundDist(px, pz, s.x, s.z) < 8;
  } else if (s.kind === 'boat') {
    done = !p.onFoot && (p.vehicle.kind === 'boat' || p.vehicle.kind === 'yacht') && groundDist(px, pz, s.x, s.z) < 9;
  } else if (s.kind === 'survive') {
    s.left -= dt;
    G.missionSub = s.text + ' — ' + Math.max(0, Math.ceil(s.left)) + 's';
    done = s.left <= 0;
  } else if (s.kind === 'hold') {
    if (groundDist(px, pz, s.x, s.z) < 7) {
      s.left -= dt;
      G.missionSub = s.text + ' — ' + Math.max(0, Math.ceil(s.left)) + 's';
      done = s.left <= 0;
    } else {
      G.missionSub = s.text + ' — stay close to the vault';
    }
  } else if (s.kind === 'choice') {
    if (groundDist(px, pz, s.crown.x, s.crown.z) < 7) {
      completeMission(m, 'Take the Crown');
      return;
    }
    if (groundDist(px, pz, s.loyal.x, s.loyal.z) < 7) {
      completeMission(m, 'Stay Loyal');
      return;
    }
  }
  if (done) {
    G.missionStage++;
    if (G.missionStage >= m.stages.length) {
      completeMission(m, null);
    } else {
      beginStage();
    }
  }
}

/** Pay out a mission, raise standing and respect, save the game. */
export function completeMission(m, ending) {
  addCash(m.payout);
  addRespect(m.respect);
  addRp(100);
  moveStanding(m.district, 35);
  G.missionDone[m.n] = true;
  clearMarkers();
  if (ending) {
    G.ending = ending;
    if (ending === 'Take the Crown') {
      toast('ENDING — Take the Crown: the $50,000 is yours. Solmar City has a new king.', 8);
    } else {
      toast('ENDING — Stay Loyal: the debt is paid. Dario is free. The garage stands.', 8);
    }
  } else {
    toast('Mission complete: ' + m.title + ' — +$' + m.payout.toLocaleString('en-US'), 5);
  }
  G.mission = 0;
  G.missionStage = 0;
  G.missionText = '';
  G.missionSub = '';
  clearWanted();
  saveGame();
}
