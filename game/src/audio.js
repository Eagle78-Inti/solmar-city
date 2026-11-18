// Solmar City — all sound is synthesized with WebAudio: engine, sirens,
// gunshots, chimes and a small bass-and-pad music loop. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.musicTimer = null;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
    this.musicStep = 0;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startSiren();
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 400;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speedKmh, inCar) {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(0.09, speedKmh / 1400) : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(45 + speedKmh * 1.1, t, 0.1);
  }
  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    // two-tone wail
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 260;
    this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
    this.sirenLfo.start();
  }
  setSiren(on, dist) {
    if (!this.sirenGain) return;
    const t = this.ctx.currentTime;
    const vol = on ? Math.max(0.015, 0.09 - dist * 0.0006) : 0;
    this.sirenGain.gain.setTargetAtTime(vol, t, 0.2);
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noiseBurst(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 3000;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  gunshot() { this.noiseBurst(0.12, 0.3, 1800); this.blip(90, 0.08, 'sine', 0.2); }
  crash() { this.noiseBurst(0.3, 0.35, 700); }
  coin() { this.blip(880, 0.09, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.15), 80); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.18), i * 110));
  }
  fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sawtooth', 0.1), i * 140)); }
  // Simple loop: Am – F – C – G pad + bass, one chord per bar.
  startMusic() {
    const chords = [[110, 220, 261.6, 329.6], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6], [98, 196, 246.9, 293.7]];
    const stepDur = 2400;
    const playBar = () => {
      if (!this.ctx || this.muted) { this.musicTimer = setTimeout(playBar, stepDur); return; }
      const ch = chords[this.musicStep % 4]; this.musicStep++;
      for (const f of ch) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + stepDur / 1000);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(this.ctx.currentTime + stepDur / 1000);
      }
      // bass pulse on the beat
      for (let b = 0; b < 4; b++) {
        setTimeout(() => { if (this.ctx) this.blip(ch[0] / 2, 0.22, 'sine', 0.12); }, b * (stepDur / 4));
      }
      this.musicTimer = setTimeout(playBar, stepDur);
    };
    playBar();
  }
}
