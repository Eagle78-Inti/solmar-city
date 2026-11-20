// Solmar City v8 — all sound is synthesized with WebAudio: engine hum, sirens,
// gunshots, pickups and mission stings. No audio files, no network.
import { clamp } from './util.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }

  // Browsers only allow audio after a user gesture; call from any key/click.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      g.connect(this.ctx.destination);
      this.master = g;
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two-tone square wave, toggled by a timer.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc || !this.sirenGain) return;
        const on = this.sirenGain.gain.value > 0.01;
        this.sirenOsc.frequency.value = on ? 880 : 660;
      }, 420);
    } catch (e) {
      this.ctx = null;
    }
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.045 : 0, this.ctx.currentTime, 0.1);
  }

  blip(freq = 880, dur = 0.09, type = 'sine', vol = 0.16) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (e) { /* audio is cosmetic; never break the game */ }
  }

  shot() {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.22;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch (e) { /* cosmetic */ }
  }

  sting(good = true) {
    if (!this.ctx || this.muted) return;
    const notes = good ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110);
    });
  }

  // Crash thud: short filtered noise burst, quieter than a gunshot.
  crash(intensity = 1) {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.18);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.7;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.18 * clamp(intensity, 0.2, 1);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch (e) { /* cosmetic */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }
}
