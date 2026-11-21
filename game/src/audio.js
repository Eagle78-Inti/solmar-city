// audio.js — tiny procedural WebAudio: engine hum, blips, radio static.
// No audio files are loaded; everything is synthesized so the game
// stays fully offline.
export function createAudio() {
  const A = { ctx: null, engine: null, engineGain: null, muted: false };
  A.ensure = function () {
    if (A.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      A.ctx = new Ctx();
      const osc = A.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const g = A.ctx.createGain();
      g.gain.value = 0;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      osc.connect(filt); filt.connect(g); g.connect(A.ctx.destination);
      osc.start();
      A.engine = osc; A.engineGain = g;
    } catch (e) { /* audio unavailable — the game runs silent */ }
  };
  A.setEngine = function (speed, on) {
    if (!A.ctx || !A.engineGain) return;
    const target = on ? 0.03 + Math.min(0.09, Math.abs(speed) * 0.002) : 0;
    A.engineGain.gain.setTargetAtTime(A.muted ? 0 : target, A.ctx.currentTime, 0.1);
    if (A.engine) A.engine.frequency.setTargetAtTime(50 + Math.abs(speed) * 2.2, A.ctx.currentTime, 0.1);
  };
  A.blip = function (freq, dur) {
    if (!A.ctx || A.muted) return;
    try {
      const o = A.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = freq || 660;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.08, A.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(A.ctx.destination);
      o.start(); o.stop(A.ctx.currentTime + (dur || 0.12));
    } catch (e) { /* ignore */ }
  };
  A.cash = function () { A.blip(880, 0.1); setTimeout(() => A.blip(1320, 0.16), 90); };
  A.siren = function () {
    if (!A.ctx || A.muted) return;
    try {
      const o = A.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(700, A.ctx.currentTime);
      o.frequency.linearRampToValueAtTime(1100, A.ctx.currentTime + 0.5);
      o.frequency.linearRampToValueAtTime(700, A.ctx.currentTime + 1.0);
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.04, A.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.001, A.ctx.currentTime + 1.0);
      o.connect(g); g.connect(A.ctx.destination);
      o.start(); o.stop(A.ctx.currentTime + 1.0);
    } catch (e) { /* ignore */ }
  };
  return A;
}

// Radio station data: the HUD shows the station and the current track;
// the audio itself is a soft synth pad so the game stays offline.
export const RADIO_TRACKS = {
  'Vice FM 88.4': ['Sunset Drive', 'Neon Rain', 'Palms at Midnight', 'Vice City Lights'],
  'Neon Rock 101.7': ['Midnight Overdrive', 'Chrome Hearts', 'Gasoline Sunset'],
  'Wave FM 94.2': ['Tide and Chrome', 'Salt Air', 'Boardwalk Static'],
};
export function stationTracks(name) { return RADIO_TRACKS[name] || []; }
export function nextTrack(A, stationName, idx) {
  const tracks = stationTracks(stationName);
  return tracks[idx % tracks.length] || '';
}
// Mute toggle for the V key / the debug API.
export function setMuted(A, muted) {
  A.muted = !!muted;
  if (A.engineGain) A.engineGain.gain.value = 0;
  return A.muted;
}
