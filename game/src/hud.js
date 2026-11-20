// Solmar City — the HUD: cash and health, wanted stars, clock and radio,
// the objective line, the minimap, toasts, the wasted screen and the pause
// menu. All of it is plain DOM over the canvas.
(function () {
  var SOL = window.SOL;

  function el(id) { return document.getElementById(id); }

  var stars = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];

  function updateHUD(dt) {
    var st = SOL.state;
    var p = SOL.player;
    el('cash').textContent = '$' + st.cash.toLocaleString('en-US');
    el('respectLine').textContent = 'RESPECT ' + st.respect + '/100';
    el('respectBar').style.width = st.respect + '%';
    el('healthBar').style.width = Math.max(0, p.health) + '%';
    el('armorBar').style.width = Math.max(0, p.armor) + '%';
    var w = SOL.weapons[st.weapon];
    el('weaponLine').textContent = w.name + ' · ' + w.ammo + '/' + w.mag +
      '  ·  reserve ' + st.reserve[st.weapon];
    el('charLine').textContent = (p.character === 'jason' ? 'Jason' : 'Lucia') + ' · Solmar City';
    var stars = el('wanted').querySelectorAll('.star');
    for (var i = 0; i < stars.length; i++) {
      stars[i].classList.toggle('off', i >= st.wanted);
    }
    var h = Math.floor(SOL.time.hour);
    var m = Math.floor((SOL.time.hour - h) * 60);
    el('timeText').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    el('weatherText').textContent = SOL.weatherLabel() + ' · ' + SOL.stationName();
    var speed = 0;
    if (p.mode === 'car' && p.vehicle) speed = Math.abs(p.vehicle.speed) * 2.4;
    else if (p.mode === 'heli' && p.vehicle) speed = Math.abs(p.vehicle.speed) * 2.4;
    else if (p.mode === 'boat' && p.vehicle) speed = Math.abs(p.vehicle.speed) * 2.4;
    el('speedLine').textContent = Math.round(speed) + ' mph · ' + p.mode;
    drawMinimap();
  }
  SOL.updateHUD = updateHUD;

  var minimap = null, mctx = null;
  function drawMinimap() {
    if (!minimap) {
      minimap = el('minimap');
      if (!minimap) return;
      mctx = minimap.getContext('2d');
    }
    var W = minimap.width, H = minimap.height;
    var toMap = function (x, z) { return [((x + 380) / 580) * W, ((z + 200) / 400) * H]; };
    // bay + beach + land
    mctx.fillStyle = '#0e2a4a'; mctx.fillRect(0, 0, W, H);
    var bx = toMap(-380, -200)[0], bx2 = toMap(-196, 200)[0];
    mctx.fillStyle = '#1b3a2a'; mctx.fillRect(0, 0, bx, H);
    mctx.fillStyle = '#c2a06a'; mctx.fillRect(bx, 0, 4, H);
    mctx.fillStyle = '#274b33'; mctx.fillRect(bx2, 0, W - bx2, H);
    // roads
    mctx.strokeStyle = '#3a4152'; mctx.lineWidth = 2.5;
    [-168, -112, -56, 0, 56, 112, 168].forEach(function (r) {
      var a = toMap(r, -200), b = toMap(r, 200);
      mctx.beginPath(); mctx.moveTo(a[0], a[1]); mctx.lineTo(b[0], b[1]); mctx.stroke();
      var c = toMap(-200, r), d = toMap(200, r);
      mctx.beginPath(); mctx.moveTo(c[0], c[1]); mctx.lineTo(d[0], d[1]); mctx.stroke();
    });
    // mission / job marker
    if (SOL.missionTarget) {
      var mt = toMap(SOL.missionTarget.x, SOL.missionTarget.z);
      mctx.fillStyle = '#ffd75e';
      mctx.beginPath(); mctx.arc(mt[0], mt[1], 5, 0, Math.PI * 2); mctx.fill();
    }
    // police dots
    mctx.fillStyle = '#4aa8ff';
    SOL.police.forEach(function (o) {
      var ox = o.kind === 'car' ? o.car.x : o.x;
      var oz = o.kind === 'car' ? o.car.z : o.z;
      var q = toMap(ox, oz);
      mctx.beginPath(); mctx.arc(q[0], q[1], 2.5, 0, Math.PI * 2); mctx.fill();
    });
    // police heli
    if (SOL.policeHeli) {
      var hp = toMap(SOL.policeHeli.x, SOL.policeHeli.z);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath(); mctx.arc(hp[0], hp[1], 3, 0, Math.PI * 2); mctx.fill();
    }
    // the player, as a white arrow
    var p = SOL.player;
    var pp = toMap(p.x, p.z);
    mctx.save();
    mctx.translate(pp[0], pp[1]);
    mctx.rotate(-p.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
  }
  SOL.drawMinimap = drawMinimap;

  function setObjective(title, text) {
    el('missionName').textContent = title;
    el('objectiveText').textContent = text;
  }
  SOL.setObjective = setObjective;

  var toastTimer = null;
  function hudToast(title, sub) {
    var t = el('toast');
    t.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    t.style.display = 'block';
    t.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 4200);
  }
  SOL.hudToast = hudToast;

  function flashDamage() {
    var d = el('damage');
    d.style.opacity = '0.55';
    setTimeout(function () { d.style.opacity = '0'; }, 160);
  }
  SOL.flashDamage = flashDamage;

  function hudShowWasted(text) {
    var w = el('wastedScreen');
    el('wastedText').textContent = text;
    w.classList.remove('hidden');
    setTimeout(function () { w.classList.add('hidden'); }, 3200);
  }
  SOL.hudShowWasted = hudShowWasted;

  // The clock panel also shows the weather, so the player can see at a
  // glance whether the rain is about to make the roads slick.
  SOL.weatherLabel = function () {
    return SOL.weather === 'rain' ? 'Rain' : (SOL.night > 0.5 ? 'Clear night' : 'Clear');
  };

  function togglePause() {
    var st = SOL.state;
    st.paused = !st.paused;
    el('pauseScreen').classList.toggle('hidden', !st.paused);
    if (st.paused) {
      el('pauseStats').textContent = 'Cash $' + st.cash.toLocaleString('en-US') +
        ' · Respect ' + st.respect + ' · Missions ' + (st.missionsDone || 0) + '/7 · Wanted ' + st.wanted + '★';
    }
  }
  SOL.togglePause = togglePause;

  function showHelp() {
    var h = el('hint');
    h.style.display = h.style.display === 'none' ? 'block' : 'none';
  }
  SOL.showHelp = showHelp;

  // A small, stable debug surface for the automated playtest. Every value
  // it reports comes straight from the live game state.
  SOL.debugState = function () {
    var st = SOL.state;
    var p = SOL.player;
    return {
      cash: st.cash, respect: st.respect, wanted: st.wanted,
      health: Math.round(p.health), armor: Math.round(p.armor),
      mode: p.mode, x: Math.round(p.x), z: Math.round(p.z),
      hour: SOL.time.hour.toFixed(2), night: SOL.night,
      missionsDone: st.missionsDone || 0,
      mission: SOL.missionInfo ? SOL.missionInfo() : null,
      character: p.character,
      weapons: Object.keys(SOL.weapons).filter(function (k) { return SOL.weapons[k].owned; }),
      ammo: { pistol: SOL.weapons.pistol.ammo, smg: SOL.weapons.smg.ammo, shotgun: SOL.weapons.shotgun.ammo },
      garage: SOL.garage,
      radio: SOL.stationName(),
      police: SOL.police.length, heliUp: !!SOL.policeHeli,
      rain: SOL.weather === 'rain',
    };
  };
})();
