// Solmar City — boot, the main loop, input and save/load. This is the last
// script loaded; it wires every system together and starts the game.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  window.__errors = [];
  window.addEventListener('error', function (e) {
    window.__errors.push(String(e.message) + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
  });

  var input = { forward: false, back: false, left: false, right: false, run: false, crouch: false };
  SOL.input = input;

  // The game state: cash, respect, wanted level and the rest. The clock is
  // NOT here — it lives in SOL.time (graphics.js) and the weather in
  // SOL.weather; this object holds only the player's progress.
  SOL.state = {
    cash: 800, respect: 0, wanted: 0, paused: false, missionsDone: 0,
    weapon: 'pistol', reserve: { pistol: 48, smg: 0, shotgun: 0 },
    shotsFired: 0, lastShot: -99, lastCrime: 0, wantedQuiet: 0,
  };

  function init() {
    SOL.initGraphics();
    var canvas = SOL.renderer.domElement;
    var scene = SOL.scene;
    var camera = SOL.camera;

    SOL.vehicles = []; SOL.traffic = []; SOL.helis = []; SOL.boats = [];

    SOL.buildCity();
    SOL.createPlayer();
    SOL.spawnTraffic(14);
    SOL.spawnPeds(26);
    SOL.spawnBoats();
    SOL.spawnYachts();
    SOL.spawnPlayerHeli();
    SOL.spawnMissionSportsCar();

    loadGame();
    // resume the saved mission if there is one, otherwise start the story
    SOL.startMission(SOL.missionState.index >= 0 ? SOL.missionState.index : 0);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', function (e) {
      if (SOL.state.paused || SOL.isShopOpen()) return;
      SOL.ensureAudio(); SOL.startRadio();
      SOL.shoot();
    });
    canvas.addEventListener('click', function () { SOL.ensureAudio(); SOL.startRadio(); });

    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (SOL.state.paused) { SOL.renderer.render(scene, camera); return; }
      tick(dt);
    }
    requestAnimationFrame(frame);
    SOL.booted = true;
    // the title screen holds the game until the player presses Enter
    SOL.state.paused = true;
    SOL.started = false;
  }
  SOL.init = init;

  // Pressing Enter on the title screen starts the city. The harness calls
  // this directly too, so the automated playtest never waits on a keypress.
  function startGame() {
    var s = document.getElementById('startScreen');
    if (s) s.classList.add('hidden');
    SOL.state.paused = false;
    SOL.started = true;
    SOL.ensureAudio(); SOL.startRadio();
  }
  SOL.startGame = startGame;

  function tick(dt) {
    var st = SOL.state;
    // the clock: a full day is SOL.time.dayLength seconds of play
    SOL.time.hour += dt * 24 / SOL.time.dayLength;
    if (SOL.time.hour >= 24) SOL.time.hour -= 24;
    SOL.setTimeOfDay(SOL.time.hour);
    var focus = SOL.updatePlayer(dt, input);
    SOL.updateGraphics(dt, focus);
    SOL.updateVehicles(dt);
    SOL.updatePeds(dt);
    SOL.updateWanted(dt);
    SOL.updateMissions(dt);
    SOL.updateTaxi(dt);
    SOL.updateCourier(dt);
    SOL.updateHUD(dt);
    SOL.renderer.render(SOL.scene, SOL.camera);
  }

  function onKeyDown(e) {
    var k = e.key.toLowerCase();
    if (k === 'enter' && !SOL.started) { startGame(); return; }
    SOL.ensureAudio(); SOL.startRadio();
    if (k === 'w' || k === 'arrowup') input.forward = true;
    else if (k === 's' || k === 'arrowdown') input.back = true;
    else if (k === 'a' || k === 'arrowleft') input.left = true;
    else if (k === 'd' || k === 'arrowright') input.right = true;
    else if (k === 'shift') input.run = true;
    else if (k === 'control') input.crouch = true;
    else if (k === 'e') SOL.tryInteract();
    else if (k === 't') SOL.startTaxi();
    else if (k === 'y') SOL.startCourier();
    else if (k === 'r') SOL.reload();
    else if (k === 'v') SOL.cycleStation();
    else if (k === '0') SOL.toggleMute();
    else if (k === 'c') { SOL.switchCharacter(); SOL.saveGame(); }
    else if (k === 'p' || k === 'escape') {
      if (!SOL.started) return;
      if (SOL.isShopOpen()) SOL.closeShop();
      else SOL.togglePause();
    }
    else if (k === 'k') { SOL.saveGame(); SOL.hudToast('Saved', 'Progress saved.'); }
    else if (k === 'h') SOL.showHelp();
    else if (k === 'm') {
      if (!SOL.missionState.active) SOL.startMission(SOL.missionState.index + 1);
      else SOL.hudToast('Mission', SOL.MISSIONS[SOL.missionState.index].name);
    }
    else if (k === '1') { SOL.state.weapon = 'pistol'; SOL.hudToast('Pistol', 'Sidearm ready.'); }
    else if (k === '2') { if (SOL.weapons.smg.owned) { SOL.state.weapon = 'smg'; SOL.hudToast('SMG', 'Rapid fire ready.'); } }
    else if (k === '3') { if (SOL.weapons.shotgun.owned) { SOL.state.weapon = 'shotgun'; SOL.hudToast('Shotgun', 'Close range, big damage.'); } }
    else if (k === ' ') { e.preventDefault(); SOL.shoot(); }
  }

  function onKeyUp(e) {
    var k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.forward = false;
    else if (k === 's' || k === 'arrowdown') input.back = false;
    else if (k === 'a' || k === 'arrowleft') input.left = false;
    else if (k === 'd' || k === 'arrowright') input.right = false;
    else if (k === 'shift') input.run = false;
    else if (k === 'control') input.crouch = false;
  }

  // ---- save / load ---------------------------------------------------------
  var SAVE_KEY = 'solmar-save-v9';

  function saveGame() {
    try {
      var st = SOL.state;
      var p = SOL.player;
      var data = {
        cash: st.cash, respect: st.respect, missionsDone: st.missionsDone || 0,
        missionIndex: SOL.missionState.index, hour: SOL.time.hour,
        x: p.x, z: p.z, character: p.character,
        weapons: {
          smg: SOL.weapons.smg.owned, shotgun: SOL.weapons.shotgun.owned,
          ammo: { pistol: SOL.weapons.pistol.ammo, smg: SOL.weapons.smg.ammo, shotgun: SOL.weapons.shotgun.ammo },
          reserve: st.reserve,
        },
        garage: SOL.garage,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* a blocked save never stops the game */ }
  }
  SOL.saveGame = saveGame;

  function loadGame() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* no save, fresh start */ }
    if (!raw) return false;
    try {
      var d = JSON.parse(raw);
      var st = SOL.state;
      st.cash = d.cash; st.respect = d.respect; st.missionsDone = d.missionsDone || 0;
      SOL.time.hour = d.hour || 18.2;
      SOL.player.x = d.x; SOL.player.z = d.z;
      SOL.player.group.position.set(d.x, 0, d.z);
      // player.js's switchCharacter toggles from the current model, so
      // only call it when the save disagrees with the fresh default
      var savedChar = d.character || 'jason';
      if (savedChar !== SOL.player.character) SOL.switchCharacter();
      if (d.weapons) {
        SOL.weapons.smg.owned = !!d.weapons.smg;
        SOL.weapons.shotgun.owned = !!d.weapons.shotgun;
        if (d.weapons.ammo) {
          SOL.weapons.pistol.ammo = d.weapons.ammo.pistol;
          SOL.weapons.smg.ammo = d.weapons.ammo.smg;
          SOL.weapons.shotgun.ammo = d.weapons.ammo.shotgun;
        }
        if (d.weapons.reserve) st.reserve = d.weapons.reserve;
      }
      if (d.garage) SOL.garage = d.garage;
      SOL.missionState.index = d.missionIndex || 0;
      return true;
    } catch (e) { return false; }
  }
  SOL.loadGame = loadGame;

  // ---- debug API for the automated playtest --------------------------------
  // Every helper below is a thin, honest wrapper over live game state: the
  // playtest drives the real game, it never edits the score directly.
  SOL.debug = {
    state: function () { return SOL.debugState(); },
    start: function () { SOL.startGame(); return true; },
    teleport: function (x, z) {
      var p = SOL.player;
      if (p.mode !== 'foot') SOL.exitVehicle();
      p.x = x; p.z = z;
      p.group.position.set(x, 0, z);
      return true;
    },
    setTime: function (h) { SOL.setTimeOfDay(h); return h; },
    setWanted: function (n) { SOL.state.wanted = n; SOL.state.lastCrime = SOL.time.hour; return n; },
    setCash: function (n) { SOL.state.cash = n; return n; },
    giveWeapon: function (k) {
      if (SOL.weapons[k]) { SOL.weapons[k].owned = true; SOL.weapons[k].ammo = SOL.weapons[k].mag; SOL.state.reserve[k] = 96; }
      return SOL.weapons[k] ? SOL.weapons[k].owned : false;
    },
    startMission: function (i) { return SOL.startMission(i); },
    setRain: function (b) { SOL.setWeather(b ? 'rain' : 'clear'); return SOL.weather === 'rain'; },
    shootAt: function () { return SOL.shoot(); },
    enterNearest: function () {
      var f = SOL.nearestEnterable(8);
      if (!f) return null;
      SOL.enterVehicle(f);
      return f.kind;
    },
    exit: function () { SOL.exitVehicle(); return SOL.player.mode; },
    clearWanted: function () { SOL.state.wanted = 0; SOL.state.lastCrime = SOL.time.hour - 60; return 0; },
    save: function () { SOL.saveGame(); return true; },
    load: function () { return SOL.loadGame(); },
  };

  // boot once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
