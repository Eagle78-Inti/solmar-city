// Solmar City — all sound is synthesized with WebAudio: no audio files,
// no network. Engine hum, sirens, gunshots, UI blips and a low ambient loop.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.musicTimer = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const g = this.ctx.createGain(); g.gain.value = 0.5; g.connect(this.ctx.destination);
      this.master = g;
      // Engine: a sawtooth through a low-pass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(g);
      this.engineOsc.start();
      // Siren: a triangle that wails between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      const sg = this.ctx.createGain(); sg.gain.value = 0.0;
      this.sirenOsc.connect(sg); sg.connect(g); this.sirenGain = sg;
      this.sirenOsc.start();
      this.sirenOn = false;
    } catch { this.ctx = null; }
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const target = on ? 0.05 + speed01 * 0.09 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, this.ctx.currentTime, 0.08);
  }
  setSiren(on) {
    if (!this.ctx || this.sirenOn === on) return;
    this.sirenOn = on;
    this.sirenGain.gain.value = on ? 0.045 : 0.0;
    if (on && !this.sirenLfo) {
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      this.sirenLfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenLfo.start();
    }
  }
  blip(freq = 880, dur = 0.09, vol = 0.12, type = 'sine') {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  gunshot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.14;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.value = 0.4;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.blip(140, 0.08, 0.2, 'square');
  }
  jingle() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 0.14, 'triangle'), i * 110);
    });
  }

  // A slow ambient loop: soft pad chords and a deep bass pulse, scheduled
  // ahead so it never stutters. Starts once, on the first user gesture.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [146.8, 220, 293.7]];
    let step = 0;
    const playChord = () => {
      if (this.muted) return;
      const ch = chords[step % chords.length]; step++;
      for (const f of ch) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 0.6);
        g.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 3.6);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(this.ctx.currentTime + 3.8);
      }
      const b = this.ctx.createOscillator(), bg = this.ctx.createGain();
      b.type = 'sine'; b.frequency.value = ch[0] / 2;
      bg.gain.setValueAtTime(0.05, this.ctx.currentTime);
      bg.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 3.6);
      b.connect(bg); bg.connect(this.master); b.start(); b.stop(this.ctx.currentTime + 3.8);
    };
    playChord();
    this.musicTimer = setInterval(playChord, 3800);
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
