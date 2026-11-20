// Solmar City — the player: Jason and Lucia on foot, the camera, and getting
// in and out of cars, the helicopter and boats.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var SKIN = 0xc98d64, SKIN2 = 0x8a5a3b;
  var CHARACTERS = {
    jason: { name: 'Jason', shirt: 0x2e8b8b, pants: 0x2a2f3a, hair: 0x1a1210, skin: SKIN, height: 1.85 },
    lucia: { name: 'Lucia', shirt: 0xc23a7a, pants: 0x1f2a44, hair: 0x140e0c, skin: SKIN2, height: 1.78 },
  };

  function buildCharacterModel(key) {
    var c = CHARACTERS[key];
    var g = new THREE.Group();
    var shirt = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.8 });
    var pants = new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.9 });
    var skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.7 });
    var hairM = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.95 });
    var h = c.height, s = h / 1.85;
    // legs
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.8 * s, 0.24 * s), pants);
    legL.position.set(-0.13 * s, 0.4 * s, 0); legL.castShadow = true; g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.13 * s; g.add(legR);
    // torso + arms
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.72 * s, 0.34 * s), shirt);
    torso.position.y = 1.16 * s; torso.castShadow = true; g.add(torso);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.66 * s, 0.2 * s), shirt);
    armL.position.set(-0.4 * s, 1.18 * s, 0); armL.castShadow = true; g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.4 * s; g.add(armR);
    // hands
    var handL = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.14 * s, 0.16 * s), skin);
    handL.position.set(-0.4 * s, 0.82 * s, 0); g.add(handL);
    var handR = handL.clone(); handR.position.x = 0.4 * s; g.add(handR);
    // head + hair
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21 * s, 12, 10), skin);
    head.position.y = 1.68 * s; head.castShadow = true; g.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.16 * s, 0.44 * s), hairM);
    hair.position.y = 1.84 * s; g.add(hair);
    if (key === 'lucia') {
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.5 * s, 0.12 * s), hairM);
      back.position.set(0, 1.62 * s, -0.2 * s); g.add(back);
    }
    g.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR };
    return g;
  }

  function createPlayer() {
    var p = {
      x: -4, z: 4, y: 0, heading: Math.PI * 0.75, speed: 0,
      mode: 'foot', vehicle: null, character: 'jason',
      health: 100, armor: 0, lastDamage: -99, walkT: 0,
      models: {}, group: new THREE.Group(),
    };
    p.models.jason = buildCharacterModel('jason');
    p.models.lucia = buildCharacterModel('lucia');
    p.models.lucia.visible = false;
    p.group.add(p.models.jason); p.group.add(p.models.lucia);
    p.group.position.set(p.x, 0, p.z);
    SOL.scene.add(p.group);
    SOL.player = p;
    return p;
  }
  SOL.createPlayer = createPlayer;

  function switchCharacter() {
    var p = SOL.player;
    p.character = p.character === 'jason' ? 'lucia' : 'jason';
    p.models.jason.visible = p.character === 'jason';
    p.models.lucia.visible = p.character === 'lucia';
    SOL.hudToast(CHARACTERS[p.character].name + ' — on the job now', '');
    return p.character;
  }
  SOL.switchCharacter = switchCharacter;

  // Third-person camera: orbits with mouse drag, pulls back in vehicles.
  var camYaw = 0, camPitch = 0.32;
  function updateCamera(dt, focus) {
    var p = SOL.player;
    var dist = p.mode === 'heli' ? 24 : p.mode === 'car' ? 13 : p.mode === 'boat' ? 15 : 9;
    var tx = focus.x, ty = focus.y + 2.2, tz = focus.z;
    var cx = tx - Math.sin(camYaw) * Math.cos(camPitch) * dist;
    var cz = tz - Math.cos(camYaw) * Math.cos(camPitch) * dist;
    var cy = ty + Math.sin(camPitch) * dist;
    if (cy < 1.2) cy = 1.2;
    var cam = SOL.camera;
    cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 6);
    cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 6);
    cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 6);
    cam.lookAt(tx, ty, tz);
  }
  SOL.updateCamera = updateCamera;
  SOL.camOrbit = function (dx, dy) {
    camYaw -= dx * 0.005;
    camPitch = Math.max(0.05, Math.min(1.1, camPitch + dy * 0.004));
  };
  SOL.camYaw = function () { return camYaw; };
  SOL.setCamYaw = function (y) { camYaw = y; };

  function moveOnFoot(p, input, dt) {
    var run = input.run ? 7.5 : 4.2;
    var mx = 0, mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    var moving = mx !== 0 || mz !== 0;
    if (moving) {
      // move relative to the camera yaw
      var a = Math.atan2(mx, mz) + camYaw + Math.PI;
      p.heading = a;
      var sp = run;
      var nx = p.x + Math.sin(a) * sp * dt;
      var nz = p.z + Math.cos(a) * sp * dt;
      // the marina piers reach out over the water, so the player can walk
      // out to the yachts there; everywhere else the shore stops at -188
      var shore = (nz > -90 && nz < 100) ? -212 : -188;
      if (!SOL.collideBuildings(nx, nz, 0.6) && nx > shore && nx < 188 && nz > -188 && nz < 188) {
        p.x = nx; p.z = nz;
      }
      p.walkT += dt * (input.run ? 11 : 8);
      p.speed = sp;
    } else {
      p.walkT += dt * 2;
      p.speed = 0;
    }
    // walk-cycle limb swing
    var swing = moving ? Math.sin(p.walkT) * 0.55 : 0;
    var parts = p.models[p.character].userData.parts;
    parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8; parts.armR.rotation.x = swing * 0.8;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = -p.heading;
  }
  SOL.moveOnFoot = moveOnFoot;

  function nearestEnterable(maxD) {
    var p = SOL.player;
    var best = null, bestD = maxD;
    SOL.vehicles.forEach(function (v) {
      if (v.isPlayer) return;
      var d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < bestD) { bestD = d; best = { kind: 'car', obj: v, d: d }; }
    });
    SOL.helis.forEach(function (h) {
      if (h.isPlayer) return;
      var d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bestD && h.y < 4) { bestD = d; best = { kind: 'heli', obj: h, d: d }; }
    });
    SOL.boats.forEach(function (b) {
      if (b.isPlayer) return;
      var d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bestD) { bestD = d; best = { kind: 'boat', obj: b, d: d }; }
    });
    // yachts are moored off the pier, so the player can climb aboard from
    // the dock: when nothing closer is enterable, a yacht within 16 counts
    if (!best) {
      var yachtD = 16;
      SOL.world.yachts.forEach(function (y) {
        if (y.taken) return;
        var d = Math.hypot(y.x - p.x, y.z - p.z);
        if (d < yachtD) { yachtD = d; best = { kind: 'yacht', obj: y, d: d }; }
      });
    }
    return best;
  }
  SOL.nearestEnterable = nearestEnterable;

  function enterVehicle(found) {
    var p = SOL.player;
    if (!found) return false;
    if (found.kind === 'car') {
      var car = found.obj;
      var i = SOL.traffic.indexOf(car);
      if (i >= 0) SOL.traffic.splice(i, 1);
      car.isPlayer = true;
      SOL.playerCar = car;
      SOL.attachHeadlightBeam(car);
      p.mode = 'car'; p.vehicle = car;
      p.group.visible = false;
      SOL.state.lastCrime = SOL.time.hour;
      SOL.addWanted(1, 'stole a car');
      SOL.hudToast('Car jacked', 'Drive away — the law noticed.');
    } else if (found.kind === 'heli') {
      var h = found.obj;
      h.isPlayer = true;
      p.mode = 'heli'; p.vehicle = h;
      p.group.visible = false;
      SOL.hudToast('Helicopter', 'W/S pitch · A/D turn · Shift climb · Ctrl descend');
    } else if (found.kind === 'boat' || found.kind === 'yacht') {
      var b = found.obj;
      if (found.kind === 'yacht') {
        b.taken = true;
        var boat = SOL.createBoat('yacht', b.x, b.z, b.heading);
        boat.isPlayer = true;
        b.group.visible = false;
        p.vehicle = boat;
      } else {
        b.isPlayer = true;
        p.vehicle = b;
      }
      p.mode = 'boat';
      p.group.visible = false;
      SOL.hudToast('On the water', 'W/S throttle · A/D steer');
    }
    // entering a vehicle can complete a mission step (e.g. stealing the car)
    if (SOL.onEnter) {
      var enterKind = found.kind;
      if (found.kind === 'car' && found.obj.isMissionSports) enterKind = 'sports';
      SOL.onEnter(enterKind);
    }
    return true;
  }
  SOL.enterVehicle = enterVehicle;

  function exitVehicle() {
    var p = SOL.player;
    if (p.mode === 'foot' || !p.vehicle) return;
    var v = p.vehicle;
    var bx = 0, bz = 0;
    if (p.mode === 'car') { bx = v.x - Math.sin(v.heading) * 3; bz = v.z - Math.cos(v.heading) * 3; v.isPlayer = false; SOL.playerCar = null; }
    else if (p.mode === 'heli') { bx = v.x + 4; bz = v.z + 4; v.y = 0.5; v.isPlayer = false; }
    else if (p.mode === 'boat') { bx = v.x + 4; bz = v.z; v.isPlayer = false; }
    p.x = bx; p.z = bz; p.y = 0;
    p.mode = 'foot'; p.vehicle = null;
    p.group.visible = true;
    p.group.position.set(p.x, 0, p.z);
  }
  SOL.exitVehicle = exitVehicle;

  function flyHeli(h, input, dt) {
    // arcade flight: pitch moves, yaw turns, Shift/Ctrl change altitude
    var fwd = (input.forward ? 1 : 0) - (input.back ? 0.6 : 0);
    if (input.left) h.heading += dt * 1.4;
    if (input.right) h.heading -= dt * 1.4;
    h.speed += (fwd * 26 - h.speed) * Math.min(1, dt * 1.4);
    var lift = (input.run ? 14 : 0) - (input.crouch ? 14 : 0);
    h.alt += lift * dt;
    h.alt = Math.max(2, Math.min(120, h.alt));
    h.x += Math.sin(h.heading) * h.speed * dt;
    h.z += Math.cos(h.heading) * h.speed * dt;
    h.x = Math.max(-380, Math.min(200, h.x));
    h.z = Math.max(-200, Math.min(200, h.z));
    h.group.position.set(h.x, h.alt, h.z);
    h.group.rotation.y = -h.heading;
    h.group.rotation.x = fwd * 0.12;
    h.group.rotation.z = (input.left ? 0.1 : 0) + (input.right ? -0.1 : 0);
    return h.speed;
  }
  SOL.flyHeli = flyHeli;

  function driveBoat(b, input, dt) {
    var top = 24;
    if (input.forward) b.speed = Math.min(b.speed + dt * 14, top);
    else if (input.back) b.speed = Math.max(b.speed - dt * 18, -6);
    else b.speed *= Math.max(0, 1 - dt * 0.8);
    if (input.left) b.heading += dt * 1.1 * Math.min(1, Math.abs(b.speed) / 8);
    if (input.right) b.heading -= dt * 1.1 * Math.min(1, Math.abs(b.speed) / 8);
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    if (b.x > -192) { b.x = -192; b.speed *= 0.4; } // the shoreline
    b.x = Math.max(-380, Math.min(-192, b.x));
    b.z = Math.max(-200, Math.min(200, b.z));
    b.group.position.set(b.x, -0.1 + Math.sin(SOL.time.hour * 9) * 0.08, b.z);
    b.group.rotation.y = -b.heading;
    b.group.rotation.z = -b.speed * 0.004;
    return b.speed;
  }
  SOL.driveBoat = driveBoat;

  // The player's own helicopter waits on a marked helipad by the marina.
  function spawnPlayerHeli() {
    var pad = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(-168, 0.07, 44); pad.receiveShadow = true;
    SOL.scene.add(pad);
    var ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(-168, 0.09, 44);
    SOL.scene.add(ring);
    var heli = SOL.createHeli(false);
    heli.x = -168; heli.z = 44; heli.y = 0.5; heli.alt = 0.5;
    heli.group.position.set(-168, 0.5, 44);
    SOL.scene.add(heli.group);
    SOL.helis.push(heli);
    return heli;
  }
  SOL.spawnPlayerHeli = spawnPlayerHeli;

  function damagePlayer(amount, from) {    var p = SOL.player;
    var now = SOL.time.hour;
    if (now - p.lastDamage < 0.4) return;
    p.lastDamage = now;
    var absorbed = Math.min(p.armor, amount);
    p.armor -= absorbed;
    p.health -= (amount - absorbed);
    SOL.flashDamage();
    if (p.health <= 0) {
      p.health = 0;
      SOL.die(from || 'the streets');
    }
  }
  SOL.damagePlayer = damagePlayer;

  function updatePlayer(dt, input) {
    var p = SOL.player;
    // slow regen out of combat
    if (SOL.time.hour - p.lastDamage > 8 && p.health > 0 && p.health < 100) {
      p.health = Math.min(100, p.health + dt * 2);
    }
    var focus = { x: p.x, y: 0, z: p.z };
    if (p.mode === 'foot') {
      moveOnFoot(p, input, dt);
    } else if (p.mode === 'car' && p.vehicle) {
      SOL.driveCar(p.vehicle, input, dt);
      SOL.updateCarLights(p.vehicle, SOL.night, dt);
      focus = { x: p.vehicle.x, y: 0, z: p.vehicle.z };
      p.x = p.vehicle.x; p.z = p.vehicle.z;
    } else if (p.mode === 'heli' && p.vehicle) {
      flyHeli(p.vehicle, input, dt);
      focus = { x: p.vehicle.x, y: p.vehicle.alt, z: p.vehicle.z };
      p.x = p.vehicle.x; p.z = p.vehicle.z;
    } else if (p.mode === 'boat' && p.vehicle) {
      driveBoat(p.vehicle, input, dt);
      focus = { x: p.vehicle.x, y: 0, z: p.vehicle.z };
      p.x = p.vehicle.x; p.z = p.vehicle.z;
    }
    updateCamera(dt, focus);
    return focus;
  }
  SOL.updatePlayer = updatePlayer;
})();
