// Solmar City — sound: everything is synthesized with WebAudio, no audio
// files. A low synthwave loop for the radio, an engine hum tied to speed, and
// one-shot effects for gunfire, sirens, coins and mission payouts.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOscA = null;
  let sirenOscB = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: two detuned saws through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp);
      engineOsc2.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      engineOsc._sub = engineOsc2;
      // Siren: two tones alternating by an LFO.
      sirenOscA = ctx.createOscillator();
      sirenOscA.type = 'sine';
      sirenOscA.frequency.value = 720;
      sirenOscB = ctx.createOscillator();
      sirenOscB.type = 'sine';
      sirenOscB.frequency.value = 960;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenGain.gain);
      sirenOscA.connect(sirenGain);
      sirenOscB.connect(sirenGain);
      sirenGain.connect(master);
      sirenOscA.start();
      sirenOscB.start();
      sirenLfo.start();
      // City wash: looped brown noise through a low-pass, the distant hum of
      // traffic that never repeats audibly.
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.94 + white * 0.06;
        d[i] = last * 2.2;
      }
      const wash = ctx.createBufferSource();
      wash.buffer = buf;
      wash.loop = true;
      const washLp = ctx.createBiquadFilter();
      washLp.type = 'lowpass';
      washLp.frequency.value = 240;
      const washGain = ctx.createGain();
      washGain.gain.value = 0.05;
      wash.connect(washLp);
      washLp.connect(washGain);
      washGain.connect(master);
      wash.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.3, when = 0, slideTo = null } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, { gain = 0.4, freq = 1200, when = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t0);
  }

  // A slow synthwave loop: Am – F – C – G pads under a driving bass line,
  // scheduled a bar ahead so it never stutters.
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]];
  const BASS = [55, 43.65, 65.4, 49];
  let chordIdx = 0;
  function scheduleBar() {
    if (!ctx || !musicOn) return;
    const barLen = 2.2;
    const t0 = ctx.currentTime + 0.05;
    const chord = CHORDS[chordIdx % 4];
    const bass = BASS[chordIdx % 4];
    for (const f of chord) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.4);
      g.gain.linearRampToValueAtTime(0.32, t0 + barLen - 0.2);
      g.gain.linearRampToValueAtTime(0, t0 + barLen);
      o.connect(g);
      g.connect(musicGain);
      o.start(t0);
      o.stop(t0 + barLen + 0.05);
    }
    for (let b = 0; b < 8; b++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = bass * (b % 4 === 3 ? 1.5 : 1);
      const g = ctx.createGain();
      const bt = t0 + (b * barLen) / 8;
      g.gain.setValueAtTime(0.9, bt);
      g.gain.exponentialRampToValueAtTime(0.001, bt + barLen / 8);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      o.connect(lp);
      lp.connect(g);
      g.connect(musicGain);
      o.start(bt);
      o.stop(bt + barLen / 8 + 0.02);
    }
    chordIdx++;
    musicTimer = setTimeout(scheduleBar, barLen * 1000 - 80);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      chordIdx = 0;
      scheduleBar();
    },
    stopMusic() { musicOn = false; if (musicTimer) clearTimeout(musicTimer); },
    setEngine(speedFrac, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speedFrac * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + speedFrac * 130, ctx.currentTime, 0.08);
      engineOsc._sub.frequency.setTargetAtTime(26 + speedFrac * 65, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
    },
    shoot() { noiseBurst(0.14, { gain: 0.5, freq: 900 }); tone(180, 0.1, { type: 'square', gain: 0.2, slideTo: 60 }); },
    crash(strength = 1) { noiseBurst(0.25, { gain: 0.35 * strength, freq: 300 }); tone(90, 0.2, { type: 'sine', gain: 0.3 * strength, slideTo: 45 }); },
    horn() { tone(370, 0.28, { type: 'square', gain: 0.12 }); tone(466, 0.28, { type: 'square', gain: 0.12 }); },
    hit() { tone(140, 0.12, { type: 'triangle', gain: 0.3, slideTo: 90 }); },
    coin() { tone(988, 0.09, { gain: 0.25 }); tone(1319, 0.16, { gain: 0.25, when: 0.08 }); },
    payout() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { gain: 0.28, when: i * 0.11 })); },
    fail() { tone(220, 0.35, { type: 'sawtooth', gain: 0.2, slideTo: 110 }); },
    click() { tone(660, 0.06, { gain: 0.2 }); },
    bust() { tone(392, 0.3, { type: 'square', gain: 0.2 }); tone(311, 0.5, { type: 'square', gain: 0.2, when: 0.28 }); },
    engineStart() { tone(70, 0.5, { type: 'sawtooth', gain: 0.22, slideTo: 160 }); },
    gull() {
      // A gull cry over the bay: two quick descending glides.
      if (!ensure()) return;
      const t0 = ctx.currentTime;
      for (const [f, when] of [[880, 0], [740, 0.16]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t0 + when);
        o.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + when + 0.22);
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(0, t0 + when);
        gg.gain.linearRampToValueAtTime(0.05, t0 + when + 0.04);
        gg.gain.exponentialRampToValueAtTime(0.001, t0 + when + 0.24);
        o.connect(gg);
        gg.connect(master);
        o.start(t0 + when);
        o.stop(t0 + when + 0.3);
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}

// City ambience: a low traffic wash plus distant gulls over the bay, built
// from filtered noise so it costs almost nothing and never repeats audibly.
export function createAmbience() {
  let ctx = null;
  let master = null;
  let started = false;

  function ensure(parentCtx, parentMaster) {
    if (started) return true;
    try {
      ctx = parentCtx;
      master = parentMaster;
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.94 + white * 0.06; // brown-ish rumble
        d[i] = last * 2.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(lp);
      lp.connect(g);
      g.connect(master);
      src.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  // A gull cry: two quick descending sine glides. Called at random by main.
  function gull(parentCtx, parentMaster) {
    if (!parentCtx) return;
    const t0 = parentCtx.currentTime;
    for (const [f, when] of [[880, 0], [740, 0.16]]) {
      const o = parentCtx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t0 + when);
      o.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + when + 0.22);
      const g = parentCtx.createGain();
      g.gain.setValueAtTime(0, t0 + when);
      g.gain.linearRampToValueAtTime(0.05, t0 + when + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + when + 0.24);
      o.connect(g);
      g.connect(parentMaster);
      o.start(t0 + when);
      o.stop(t0 + when + 0.3);
    }
  }

  return { ensure, gull, get active() { return started; } };
}
