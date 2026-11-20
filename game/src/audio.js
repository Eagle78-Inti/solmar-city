// audio.js — procedural radio and sound effects. Three named stations with
// track names shown in the HUD; everything is synthesized, nothing is loaded.

import { G } from './state.js';

/** The three stations, each with its track list. */
export const STATIONS = [
  { name: 'Vice FM 88.4', tracks: ['Sunset Drive', 'Palm Shadows', 'Neon Rain'], mood: 'chill' },
  { name: 'Neon Rock 101.7', tracks: ['Midnight Overdrive', 'Chrome Hearts', 'Gasoline Sky'], mood: 'rock' },
  { name: 'Wave FM 94.2', tracks: ['Tide Line', 'Salt Air', 'Low Tide Love'], mood: 'bass' },
];

/** The current track name on the current station. */
export function currentTrack() {
  const s = STATIONS[G.radio];
  if (!s) return '';
  return s.tracks[G.radioTrack % s.tracks.length];
}

let ctx = null;
let master = null;
let radioTimer = null;
let nextNoteAt = 0;
let step = 0;
let trackStartedAt = 0;

function midi(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Create the audio context on the first user gesture. */
export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** A short oscillator note. */
function note(freq, at, dur, type, vol) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol || 0.12, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  } catch (e) {
    // Audio is best-effort: never let it break the game.
  }
}

/** The radio scheduler: schedules the current station's pattern ahead. */
function scheduleRadio() {
  if (!ctx) return;
  resume();
  const station = STATIONS[G.radio];
  const ahead = ctx.currentTime + 0.35;
  while (nextNoteAt < ahead) {
    const s = step % 16;
    if (station.mood === 'chill') {
      // Slow pads: a chord every 4 steps, a high sparkle note sometimes.
      if (s % 4 === 0) {
        const root = [57, 60, 64][Math.floor(step / 4) % 3];
        note(midi(root), nextNoteAt, 1.6, 'triangle', 0.07);
        note(midi(root + 7), nextNoteAt, 1.6, 'triangle', 0.05);
        note(midi(root + 12), nextNoteAt, 1.4, 'sine', 0.04);
      }
      if (s === 6 || s === 14) note(midi(76 + (step % 3)), nextNoteAt, 0.5, 'sine', 0.05);
    } else if (station.mood === 'rock') {
      // Fast arpeggio over a driving bass.
      const arp = [57, 60, 64, 69, 64, 60];
      note(midi(arp[s % 6]), nextNoteAt, 0.16, 'square', 0.05);
      if (s % 4 === 0) note(midi(33), nextNoteAt, 0.3, 'sawtooth', 0.09);
      if (s % 2 === 0) note(midi(45), nextNoteAt, 0.12, 'square', 0.04);
    } else {
      // Bass pulse with a sparse melody.
      if (s % 4 === 0) note(midi(38), nextNoteAt, 0.5, 'sine', 0.16);
      if (s === 2 || s === 7 || s === 11) note(midi(69 + (s % 5)), nextNoteAt, 0.3, 'triangle', 0.05);
    }
    step++;
    nextNoteAt += 0.21;
  }
  // A new track every 24 seconds of radio.
  if (trackStartedAt === 0) trackStartedAt = performance.now() / 1000;
  if (performance.now() / 1000 - trackStartedAt > 24) {
    G.radioTrack = (G.radioTrack + 1) % STATIONS[G.radio].tracks.length;
    trackStartedAt = performance.now() / 1000;
  }
}

/** Start the radio (on the current station). */
export function startRadio() {
  initAudio();
  if (!ctx || radioTimer) return;
  nextNoteAt = ctx.currentTime + 0.1;
  step = 0;
  trackStartedAt = performance.now() / 1000;
  radioTimer = setInterval(scheduleRadio, 120);
}

/** Switch to the next station. */
export function cycleStation() {
  G.radio = (G.radio + 1) % STATIONS.length;
  G.radioTrack = 0;
  trackStartedAt = performance.now() / 1000;
  step = 0;
  return STATIONS[G.radio].name;
}

/** The name of the current station. */
export function stationName() {
  return STATIONS[G.radio].name;
}

/** A gunshot: a short burst of filtered noise. */
export function shootSound() {
  if (!ctx) return;
  resume();
  try {
    const dur = 0.09;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g);
    g.connect(master);
    src.start();
  } catch (e) {
    // Best effort only.
  }
}

/** The car horn: two tones, a quarter of a second. */
export function hornSound() {
  initAudio();
  if (!ctx) return;
  resume();
  const at = ctx.currentTime;
  note(440, at, 0.22, 'square', 0.1);
  note(554, at, 0.22, 'square', 0.1);
}

/** A pickup chime: two rising sine notes. */
export function pickupSound() {
  initAudio();
  if (!ctx) return;
  resume();
  const at = ctx.currentTime;
  note(660, at, 0.15, 'sine', 0.1);
  note(880, at + 0.09, 0.2, 'sine', 0.1);
}

/** A mission-complete jingle: three rising notes. */
export function missionSound() {
  initAudio();
  if (!ctx) return;
  resume();
  const at = ctx.currentTime;
  note(523, at, 0.18, 'triangle', 0.12);
  note(659, at + 0.12, 0.18, 'triangle', 0.12);
  note(784, at + 0.24, 0.3, 'triangle', 0.12);
}

/** A crash thud: a low sine drop. */
export function crashSound() {
  if (!ctx) return;
  resume();
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Best effort only.
  }
}
