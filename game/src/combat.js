// Solmar City — pedestrians, weapons and shooting, police and the wanted
// level. Crimes raise stars; police cars, foot cops and the helicopter answer.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  SOL.peds = [];
  SOL.police = [];
  SOL.policeHeli = null;
  SOL.shootables = [];

  var PED_SHIRTS = [0xd84a4a, 0x4a7dd8, 0x4ad87a, 0xd8c84a, 0x8a4ad8, 0xe8e8e8, 0x333333, 0xff8a3c];
  var ROADS = [-168, -112, -56, 0, 56, 112, 168];

  function buildPedModel(shirt, h) {
    var g = new THREE.Group();
    var s = h / 1.8;
    var shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
    var pantsM = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
    var skinM = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.75 * s, 0.22 * s), pantsM);
    legL.position.set(-0.12 * s, 0.38 * s, 0); legL.castShadow = true; g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.12 * s; g.add(legR);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 0.66 * s, 0.32 * s), shirtM);
    torso.position.y = 1.08 * s; torso.castShadow = true; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 10, 8), skinM);
    head.position.y = 1.56 * s; head.castShadow = true; g.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.12 * s, 0.4 * s),
      new THREE.MeshStandardMaterial({ color: 0x1a1210 }));
    hair.position.y = 1.7 * s; g.add(hair);
    g.userData.parts = { legL: legL, legR: legR };
    return g;
  }

  function spawnPeds(n) {
    for (var i = 0; i < n; i++) {
      var road = ROADS[Math.floor(Math.random() * ROADS.length)];
      var along = -180 + Math.random() * 360;
      var onX = Math.random() < 0.5;
      var x = onX ? along : road + (Math.random() < 0.5 ? 8 : -8);
      var z = onX ? road + (Math.random() < 0.5 ? 8 : -8) : along;
      var h = 1.62 + Math.random() * 0.3;
      var g = buildPedModel(PED_SHIRTS[i % PED_SHIRTS.length], h);
      g.position.set(x, 0, z);
      SOL.scene.add(g);
      var ped = {
        group: g, x: x, z: z, heading: Math.random() * Math.PI * 2,
        speed: 1.1 + Math.random() * 0.8, alive: true, flee: 0, walkT: Math.random() * 6,
        onX: onX, road: road, dir: Math.random() < 0.5 ? 1 : -1, hp: 100,
      };
      g.userData.shootable = { kind: 'ped', ref: ped };
      SOL.shootables.push(g);
      SOL.peds.push(ped);
    }
  }
  SOL.spawnPeds = spawnPeds;

  function updatePeds(dt) {
    var p = SOL.player;
    SOL.peds.forEach(function (ped) {
      if (!ped.alive) return;
      var dPlayer = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (dPlayer < 14 && (SOL.state.wanted >= 2 || SOL.state.shotsFired > 0)) ped.flee = 3;
      if (ped.flee > 0) {
        ped.flee -= dt;
        var a = Math.atan2(ped.x - p.x, ped.z - p.z);
        ped.x += Math.sin(a) * 5.5 * dt;
        ped.z += Math.cos(a) * 5.5 * dt;
        ped.heading = a;
      } else {
        var step = ped.speed * ped.dir * dt;
        if (ped.onX) { ped.x += step; if (Math.abs(ped.x) > 186) ped.dir *= -1; }
        else { ped.z += step; if (Math.abs(ped.z) > 186) ped.dir *= -1; }
        ped.heading = ped.onX ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      }
      ped.walkT += dt * (ped.flee > 0 ? 12 : 6);
      var swing = Math.sin(ped.walkT) * 0.5;
      var parts = ped.group.userData.parts;
      parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
      ped.group.position.set(ped.x, 0, ped.z);
      ped.group.rotation.y = -ped.heading;
      // run over by the player's car
      if (p.mode === 'car' && p.vehicle && dPlayer < 2.4) {
        killPed(ped, 'run over');
      }
    });
  }
  SOL.updatePeds = updatePeds;

  function killPed(ped, how) {
    if (!ped.alive) return;
    ped.alive = false;
    ped.group.rotation.z = Math.PI / 2;
    ped.group.position.y = 0.3;
    SOL.addWanted(2, 'killed a pedestrian');
    setTimeout(function () { SOL.scene.remove(ped.group); }, 6000);
    var i = SOL.peds.indexOf(ped);
    if (i >= 0) SOL.peds.splice(i, 1);
  }
  SOL.killPed = killPed;

  // ---- weapons -------------------------------------------------------------
  SOL.weapons = {
    pistol: { name: 'Pistol', price: 0, ammo: 12, mag: 12, dmg: 34, rate: 0.28, range: 90, owned: true },
    smg: { name: 'SMG', price: 800, ammo: 0, mag: 32, dmg: 18, rate: 0.09, range: 70, owned: false },
    shotgun: { name: 'Shotgun', price: 1200, ammo: 0, mag: 8, dmg: 24, rate: 0.8, range: 40, owned: false, pellets: 5 },
  };
  SOL.state = SOL.state || {};
  SOL.state.weapon = 'pistol';
  SOL.state.reserve = { pistol: 48, smg: 0, shotgun: 0 };
  SOL.state.shotsFired = 0;
  SOL.state.lastShot = -99;

  var raycaster = null;
  function shoot() {
    var st = SOL.state;
    var now = SOL.time.hour;
    var w = SOL.weapons[st.weapon];
    if (!w.owned) return false;
    if (now - st.lastShot < w.rate) return false;
    if (w.ammo <= 0) { SOL.hudToast('Out of ammo', 'Press R to reload — or visit Ammu-Nation.'); return false; }
    st.lastShot = now; st.shotsFired++;
    w.ammo--;
    if (!raycaster) raycaster = new THREE.Raycaster();
    var cam = SOL.camera;
    raycaster.setFromCamera({ x: 0, y: 0 }, cam);
    raycaster.far = w.range;
    var hits = raycaster.intersectObjects(SOL.shootables, false);
    var end = null;
    if (hits.length > 0) {
      var hit = hits[0];
      end = hit.point;
      var s = hit.object.userData.shootable;
      if (s) damageTarget(s, w.dmg * (w.pellets || 1));
    } else {
      end = cam.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(w.range));
    }
    // tracer from the gun to the hit point
    var from = cam.position.clone();
    from.add(new THREE.Vector3(0.4, -0.35, 0).applyQuaternion(cam.quaternion));
    var tracer = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([from, end]),
      new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    SOL.scene.add(tracer);
    setTimeout(function () { SOL.scene.remove(tracer); }, 90);
    // muzzle flash
    var flash = SOL.glowSprite(0xffe9a8, 1.6, 0.95);
    flash.position.copy(from);
    SOL.scene.add(flash);
    setTimeout(function () { SOL.scene.remove(flash); }, 70);
    SOL.addWanted(0, ''); // shooting in public draws attention only on a hit
    return true;
  }
  SOL.shoot = shoot;

  function damageTarget(s, dmg) {
    if (s.kind === 'ped') {
      s.ref.hp -= dmg;
      if (s.ref.hp <= 0) killPed(s.ref, 'shot');
      else { s.ref.flee = 4; SOL.addWanted(1, 'shot at a pedestrian'); }
    } else if (s.kind === 'cop') {
      s.ref.hp -= dmg;
      if (s.ref.hp <= 0) killCop(s.ref);
      else SOL.addWanted(1, 'shot a cop');
    } else if (s.kind === 'car') {
      s.ref.hp -= dmg * 0.4;
      if (s.ref.hp <= 0) { destroyCar(s.ref); SOL.addWanted(2, 'blew up a car'); }
    } else if (s.kind === 'heli') {
      SOL.addWanted(1, 'shot at the police helicopter');
    }
  }

  // A destroyed car burns where it stands: a fireball halo that fades, then
  // the wreck is towed away (removed) so the street stays clear.
  function destroyCar(car) {
    var fire = SOL.glowSprite(0xff7722, 9, 0.95);
    fire.position.set(car.x, 1.2, car.z);
    SOL.scene.add(fire);
    car.group.rotation.z = 0.1;
    setTimeout(function () { SOL.scene.remove(fire); }, 4000);
    var ti = SOL.traffic.indexOf(car);
    if (ti >= 0) SOL.traffic.splice(ti, 1);
    var vi = SOL.vehicles.indexOf(car);
    if (vi >= 0) SOL.vehicles.splice(vi, 1);
    setTimeout(function () { SOL.scene.remove(car.group); }, 5000);
  }
  SOL.destroyCar = destroyCar;

  function reload() {
    var st = SOL.state;
    var w = SOL.weapons[st.weapon];
    var need = w.mag - w.ammo;
    var take = Math.min(need, st.reserve[st.weapon]);
    if (take <= 0) { SOL.hudToast('No reserve ammo', 'Buy more at Ammu-Nation.'); return; }
    w.ammo += take; st.reserve[st.weapon] -= take;
  }
  SOL.reload = reload;

  // ---- police & wanted -----------------------------------------------------
  function addWanted(n, reason) {
    var st = SOL.state;
    if (n <= 0) return;
    st.wanted = Math.min(5, st.wanted + n);
    st.lastCrime = SOL.time.hour;
    st.wantedQuiet = 0;
  }
  SOL.addWanted = addWanted;

  function spawnPoliceCar() {
    var p = SOL.player;
    var car = SOL.createCar('police', 0xe8e8e8);
    var a = Math.random() * Math.PI * 2;
    var x = p.x + Math.sin(a) * 70, z = p.z + Math.cos(a) * 70;
    x = Math.max(-184, Math.min(184, x)); z = Math.max(-184, Math.min(184, z));
    SOL.placeCar(car, x, z, Math.atan2(p.x - x, p.z - z));
    car.cruise = 24;
    car.group.userData.shootable = { kind: 'car', ref: car };
    SOL.shootables.push(car.group);
    SOL.scene.add(car.group);
    SOL.police.push({ kind: 'car', car: car, hp: 100 });
    return car;
  }

  function spawnCop() {
    var p = SOL.player;
    var g = (function () {
      var grp = new THREE.Group();
      var dark = new THREE.MeshStandardMaterial({ color: 0x1a2333, roughness: 0.8 });
      var skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
      var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), dark);
      torso.position.y = 1.14; torso.castShadow = true; grp.add(torso);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
      head.position.y = 1.66; grp.add(head);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), dark);
      cap.position.y = 1.82; grp.add(cap);
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), dark);
      legL.position.set(-0.12, 0.38, 0); grp.add(legL);
      var legR = legL.clone(); legR.position.x = 0.12; grp.add(legR);
      return grp;
    })();
    var a = Math.random() * Math.PI * 2;
    var x = p.x + Math.sin(a) * 24, z = p.z + Math.cos(a) * 24;
    g.position.set(x, 0, z);
    SOL.scene.add(g);
    var cop = { kind: 'cop', group: g, x: x, z: z, hp: 100, shootT: 0 };
    g.userData.shootable = { kind: 'cop', ref: cop };
    SOL.shootables.push(g);
    SOL.police.push(cop);
    return cop;
  }

  function killCop(cop) {
    SOL.scene.remove(cop.group);
    var i = SOL.police.indexOf(cop);
    if (i >= 0) SOL.police.splice(i, 1);
    SOL.addWanted(2, 'killed a cop');
  }

  function spawnPoliceHeli() {
    if (SOL.policeHeli) return SOL.policeHeli;
    var h = SOL.createHeli(true);
    var p = SOL.player;
    h.x = p.x + 40; h.z = p.z - 40; h.alt = 46; h.y = 46;
    h.group.position.set(h.x, 46, h.z);
    h.group.userData.shootable = { kind: 'heli', ref: h };
    SOL.shootables.push(h.group);
    SOL.scene.add(h.group);
    SOL.helis.push(h);
    SOL.policeHeli = h;
    return h;
  }

  function updateWanted(dt) {
    var st = SOL.state;
    var p = SOL.player;
    var want = st.wanted;
    var wantCars = Math.min(want, 4);
    var wantCops = want >= 2 ? Math.min(want - 1, 3) : 0;
    // spawn up to the wanted level's force
    var cars = SOL.police.filter(function (o) { return o.kind === 'car'; }).length;
    var cops = SOL.police.filter(function (o) { return o.kind === 'cop'; }).length;
    if (cars < wantCars && Math.random() < dt * 0.5) spawnPoliceCar();
    if (cops < wantCops && p.mode === 'foot' && Math.random() < dt * 0.4) spawnCop();
    if (want >= 4 && !SOL.policeHeli) spawnPoliceHeli();
    if (want < 4 && SOL.policeHeli) {
      SOL.scene.remove(SOL.policeHeli.group);
      SOL.helis.splice(SOL.helis.indexOf(SOL.policeHeli), 1);
      SOL.policeHeli = null;
    }
    // police cars chase
    SOL.police.forEach(function (o) {
      if (o.kind === 'car') {
        var car = o.car;
        var dx = p.x - car.x, dz = p.z - car.z;
        var d = Math.hypot(dx, dz);
        var wantHeading = Math.atan2(dx, dz);
        var dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        car.speed = Math.min(27, car.speed + dt * 8);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = -car.heading;
        car.wheels.forEach(function (w) { w.group.rotation.x += car.speed * dt * 2.6; });
        // ramming the player's car
        if (p.mode === 'car' && p.vehicle && d < 4) {
          p.vehicle.speed *= 0.92;
          SOL.damagePlayer(2, 'a police ram');
        }
      } else if (o.kind === 'cop') {
        var dx2 = p.x - o.x, dz2 = p.z - o.z;
        var d2 = Math.hypot(dx2, dz2);
        if (d2 > 2) {
          o.x += dx2 / d2 * 5 * dt; o.z += dz2 / d2 * 5 * dt;
          o.group.position.set(o.x, 0, o.z);
          o.group.rotation.y = -Math.atan2(dx2, dz2);
        }
        o.shootT -= dt;
        if (d2 < 26 && o.shootT <= 0) {
          o.shootT = 1.4 + Math.random();
          if (Math.random() < 0.45) SOL.damagePlayer(6, 'police gunfire');
        }
      }
    });
    // police heli circles the player
    if (SOL.policeHeli) {
      var h = SOL.policeHeli;
      h.heading += dt * 0.5;
      h.x = p.x + Math.sin(h.heading) * 26;
      h.z = p.z + Math.cos(h.heading) * 26;
      h.alt = 46;
      h.group.position.set(h.x, h.alt, h.z);
      h.group.rotation.y = -h.heading;
    }
    // wanted decays when quiet
    if (want > 0) {
      var nearest = 9999;
      SOL.police.forEach(function (o) {
        var ox = o.kind === 'car' ? o.car.x : o.x;
        var oz = o.kind === 'car' ? o.car.z : o.z;
        nearest = Math.min(nearest, Math.hypot(ox - p.x, oz - p.z));
      });
      if (nearest > 70 && SOL.time.hour - st.lastCrime > 15) {
        st.wantedQuiet += dt;
        if (st.wantedQuiet > 12) { st.wanted--; st.wantedQuiet = 0; }
      } else st.wantedQuiet = 0;
    }
    // the heat is off: the police stand down and the streets go quiet
    if (st.wanted === 0 && SOL.police.length > 0) {
      SOL.police.forEach(function (o) {
        if (o.kind === 'car') SOL.scene.remove(o.car.group);
        else SOL.scene.remove(o.group);
      });
      SOL.police.length = 0;
    }
  }
  SOL.updateWanted = updateWanted;

  function die(cause) {
    var st = SOL.state;
    var p = SOL.player;
    if (p.mode !== 'foot') SOL.exitVehicle();
    var fine = Math.min(200, st.cash);
    st.cash -= fine;
    st.wanted = 0;
    SOL.police.forEach(function (o) { if (o.kind === 'car') SOL.scene.remove(o.car.group); else SOL.scene.remove(o.group); });
    SOL.police.length = 0;
    if (SOL.policeHeli) { SOL.scene.remove(SOL.policeHeli.group); SOL.policeHeli = null; }
    var hosp = SOL.world.spots.hospital;
    p.x = hosp.x; p.z = hosp.z; p.health = 100;
    p.group.position.set(p.x, 0, p.z);
    SOL.hudShowWasted('The hospital patched you up. That will be $' + fine + '.');
    SOL.saveGame();
  }
  SOL.die = die;
})();
