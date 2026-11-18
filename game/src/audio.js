// Solmar City v4 — all sound is synthesized live with WebAudio: engine hum,
// sirens, gunshots, coins, mission stings and a slow ambient pad. No audio files.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', gain = 0.2, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  noise(dur, gain = 0.3, low = 400) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = low;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) {}
  }
  shot() { this.noise(0.14, 0.5, 1800); this.tone(160, 0.1, 'square', 0.12, 60); }
  coin() { this.tone(880, 0.09, 'sine', 0.2); setTimeout(() => this.tone(1318, 0.14, 'sine', 0.2), 70); }
  click() { this.tone(660, 0.05, 'square', 0.1); }
  sting(good = true) {
    const notes = good ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', 0.22), i * 90));
  }

  engineSet(running, speedNorm) {
    if (!this.ctx || this.muted) return;
    try {
      if (running && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;
        this.engineGain.gain.value = 0.0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (this.engineOsc) {
        this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(running ? 0.05 + speedNorm * 0.06 : 0, this.ctx.currentTime, 0.1);
      }
    } catch (e) {}
  }
  sirenSet(on) {
    if (!this.ctx || this.muted) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.frequency.value = 0.8;
        const lg = this.ctx.createGain(); lg.gain.value = 220;
        this.sirenLfo.connect(lg); lg.connect(this.sirenOsc.frequency);
        this.sirenLfo.start();
      } else if (!on && this.sirenOsc) {
        try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
        this.sirenOsc = null; this.sirenLfo = null;
      }
    } catch (e) {}
  }
  musicStart() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49];
    let i = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      this.tone(bass[i % bass.length], 1.8, 'triangle', 0.07);
      this.tone(bass[i % bass.length] * 2, 1.2, 'sine', 0.04);
      i++;
    }, 900);
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
}
