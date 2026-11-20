// Solmar City — radio: three procedural stations, sequenced live with
// WebAudio. No audio files, no network. Everything is guarded so the game
// keeps playing even where audio is blocked.
(function () {
  var SOL = window.SOL;

  var STATIONS = [
    { name: 'Vice Radio', bpm: 100, wave: 'sawtooth', roots: [55, 43.65, 65.41, 49],
      arp: [0, 1, 2, 1, 0, 2, 1, 2], bass: [0, 0, 1, 0, 2, 0, 3, 2] },
    { name: 'Neon Rock', bpm: 132, wave: 'square', roots: [82.41, 98, 110, 98],
      arp: [0, 0, 2, 0, 1, 2, 1, 0], bass: [0, 0, 0, 1, 0, 2, 0, 3] },
    { name: 'Ocean FM', bpm: 76, wave: 'triangle', roots: [130.81, 110, 87.31, 98],
      arp: [0, 2, 1, 2, 0, 1, 2, 1], bass: [0, 3, 2, 1, 0, 2, 1, 0] },
  ];
  var SCALES = [1, 1.189, 1.335, 1.498, 1.782, 2]; // minor-ish steps for the arp

  var radio = { ctx: null, station: 0, muted: false, step: 0, nextT: 0, timer: null, started: false };
  SOL.radio = radio;
  SOL.stationName = function () { return STATIONS[radio.station].name; };

  function ensureAudio() {
    if (radio.ctx) {
      if (radio.ctx.state === 'suspended') { try { radio.ctx.resume(); } catch (e) { /* audio blocked */ } }
      return radio.ctx;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      radio.ctx = new AC();
      radio.master = radio.ctx.createGain();
      radio.master.gain.value = radio.muted ? 0 : 0.16;
      radio.master.connect(radio.ctx.destination);
    } catch (e) { radio.ctx = null; }
    return radio.ctx;
  }
  SOL.ensureAudio = ensureAudio;

  function note(freq, t, dur, type, vol) {
    if (!radio.ctx || !radio.master) return;
    try {
      var o = radio.ctx.createOscillator();
      var g = radio.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(radio.master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* a failed note never stops the music */ }
  }

  function scheduleStep() {
    var st = STATIONS[radio.station];
    var spb = 60 / st.bpm / 2; // eighth notes
    var bar = Math.floor(radio.step / 8) % st.roots.length;
    var root = st.roots[bar];
    var s = radio.step % 8;
    var t = radio.nextT;
    // bass on the beat
    note(root / 2, t, spb * 1.8, 'triangle', 0.5);
    // arpeggio sparkle
    var arpNote = root * SCALES[st.arp[s] % SCALES.length] * 2;
    note(arpNote, t, spb * 0.9, st.wave, 0.16);
    if (s === 0 || s === 4) note(root * 2, t, spb * 1.4, 'sine', 0.12);
    // a soft hat tick on off-beats
    if (s % 2 === 1) note(6000 + Math.random() * 1500, t, 0.03, 'square', 0.03);
    radio.nextT += spb;
    radio.step++;
  }

  function startRadio() {
    if (!ensureAudio() || radio.started) return;
    radio.started = true;
    radio.nextT = radio.ctx.currentTime + 0.1;
    radio.timer = setInterval(function () {
      if (!radio.ctx || radio.muted) return;
      while (radio.nextT < radio.ctx.currentTime + 0.15) scheduleStep();
    }, 30);
  }
  SOL.startRadio = startRadio;

  function cycleStation() {
    radio.station = (radio.station + 1) % STATIONS.length;
    radio.step = 0;
    if (radio.ctx) radio.nextT = radio.ctx.currentTime + 0.05;
    SOL.hudToast(STATIONS[radio.station].name, 'Now playing on the radio');
    return STATIONS[radio.station].name;
  }
  SOL.cycleStation = cycleStation;

  function toggleMute() {
    radio.muted = !radio.muted;
    if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.16;
    return radio.muted;
  }
  SOL.toggleMute = toggleMute;
})();

  // A short three-note station ident that plays when the driver changes
  // station, so the switch is audible as well as visible.
  (function () {
    var SOL = window.SOL;
    function playJingle() {
      var radio = SOL.radio;
      if (!radio.ctx || radio.muted || !radio.master) return;
      try {
        var t0 = radio.ctx.currentTime + 0.02;
        var notes = [523.25, 659.25, 783.99];
        notes.forEach(function (f, i) {
          var o = radio.ctx.createOscillator();
          var g = radio.ctx.createGain();
          o.type = 'square'; o.frequency.value = f;
          var t = t0 + i * 0.09;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.08, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g); g.connect(radio.master);
          o.start(t); o.stop(t + 0.2);
        });
      } catch (e) { /* a failed jingle never stops the game */ }
    }
    SOL.playJingle = playJingle;
    var origCycle = SOL.cycleStation;
    SOL.cycleStation = function () {
      var name = origCycle();
      playJingle();
      return name;
    };
  })();
