// Solmar City v7 — sound: everything synthesized with WebAudio. No audio
// files. Engine hum, sirens, gunfire, coins, jingles and a bassline.
let ctx = null, engineOsc = null, engineGain = null, musicTimer = null, musicStep = 0;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    ctx._master = master;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(c._master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) { /* audio unavailable — the game plays on silently */ }
}

function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(c._master);
    src.start(t0);
  } catch (e) { /* audio unavailable */ }
}

export const audio = {
  unlock() { try { ac(); } catch (e) { /* audio stays off */ } },
  engine(speed01) {
    if (!ctx) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(ctx._master);
      engineOsc.start();
    }
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
  },
  engineOff() { if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); },
  shot() { noise(0.12, 0.5, 900); tone(160, 0.1, 'square', 0.22, 60); },
  echo() { noise(0.3, 0.1, 500, 0.05); },
  incoming() { tone(1200, 0.08, 'square', 0.08, 900); },
  thud() { noise(0.15, 0.4, 220); tone(70, 0.16, 'sine', 0.3, 40); },
  busted() { tone(660, 0.18, 'square', 0.16); tone(440, 0.3, 'square', 0.16, null, 0.18); },
  coin() { tone(990, 0.09, 'sine', 0.2); tone(1320, 0.16, 'sine', 0.2, null, 0.09); },
  step() { tone(520, 0.12, 'sine', 0.18); tone(780, 0.18, 'sine', 0.18, null, 0.1); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, null, i * 0.11)); },
  taxi() { tone(880, 0.1, 'sine', 0.18); tone(1175, 0.14, 'sine', 0.18, null, 0.1); },
  sirenBlip() { tone(950, 0.16, 'square', 0.1, 1250); tone(1250, 0.16, 'square', 0.1, 950, 0.16); },
  startMusic() {
    if (!ctx || musicTimer) return;
    const bass = [55, 55, 65.4, 49];
    musicTimer = setInterval(() => {
      if (!ctx) return;
      const f = bass[musicStep % 4];
      tone(f, 0.5, 'triangle', 0.12);
      if (musicStep % 2 === 0) noise(0.04, 0.05, 6000);
      musicStep++;
    }, 320);
  },
  stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
};

export function setMasterVolume(v) {
  try { if (ctx && ctx._master) ctx._master.gain.value = Math.max(0, Math.min(1, v)); } catch (e) { /* ignore */ }
}
