// Solmar City — sound: everything is synthesized with WebAudio. No audio
// files, no network. Every call is guarded so a headless run never breaks.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let padNodes = null;
  let ready = false;

  function ensure() {
    if (ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
      ready = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    } catch (e) { /* audio is best-effort */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    click() { blip(660, 0.07, 'square', 0.12); },
    shot() { noiseBurst(0.12, 0.6, 2400); blip(140, 0.1, 'sine', 0.5); },
    coin() { blip(1318, 0.1, 'sine', 0.25); blip(1760, 0.22, 'sine', 0.25, 0.09); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.28, i * 0.11));
    },
    busted() { blip(220, 0.5, 'sawtooth', 0.25); blip(165, 0.6, 'sawtooth', 0.25, 0.15); },
    engine(on, speed01) {
      if (!ensure()) return;
      try {
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 420;
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.0;
          engineOsc.connect(f);
          f.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        if (engineOsc) {
          engineOsc.frequency.value = 52 + speed01 * 130;
          engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
        }
        if (!on && engineOsc) {
          engineOsc.stop();
          engineOsc = null;
          engineGain = null;
        }
      } catch (e) { /* audio is best-effort */ }
    },
    siren(on) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 750;
          sirenLfo = ctx.createOscillator();
          sirenLfo.type = 'square';
          sirenLfo.frequency.value = 1.4;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 220;
          sirenLfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenLfo.start();
        }
        if (!on && sirenOsc) {
          sirenOsc.stop();
          sirenLfo.stop();
          sirenOsc = null;
          sirenLfo = null;
          sirenGain = null;
        }
      } catch (e) { /* audio is best-effort */ }
    },
    // A soft two-note ambient pad that hums under the game.
    pad(on) {
      if (!ensure()) return;
      try {
        if (on && !padNodes) {
          const g = ctx.createGain();
          g.gain.value = 0.035;
          g.connect(master);
          const oscs = [110, 164.8, 220].map((f) => {
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = f;
            o.connect(g);
            o.start();
            return o;
          });
          padNodes = { g, oscs };
        }
        if (!on && padNodes) {
          for (const o of padNodes.oscs) o.stop();
          padNodes.g.disconnect();
          padNodes = null;
        }
      } catch (e) { /* audio is best-effort */ }
    },
  };
}

// (The ambient pad lives on the audio object itself as pad(on).)
