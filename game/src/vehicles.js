// Solmar City — vehicles: detailed car models, traffic, and arcade driving.
// Every car carries a cruise speed default of 12: a car without one gets NaN
// speed, breaks the traffic update, and missions never advance.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  SOL.vehicles = [];
  SOL.traffic = [];
  SOL.boats = [];
  SOL.playerCar = null;

  var PAINTS = [0xc23b2e, 0x2e6fc2, 0xe8e8e8, 0x22262e, 0x3a7d4a, 0xd8a13a, 0x7a4a9e, 0xc27a2e, 0x9fb4c8, 0x5a2e2e];

  function paintMat(color) {
    return new THREE.MeshStandardMaterial({ color: color, metalness: 0.75, roughness: 0.32 });
  }
  function glassMat() {
    return new THREE.MeshPhongMaterial({ color: 0x0e1620, shininess: 140, specular: 0x88aaff, transparent: true, opacity: 0.92 });
  }
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  // A detailed car: body, cabin glass, wheels with hubcaps, bumpers, grille,
  // mirrors, headlights and taillights with night halos. `kind` picks the shape.
  function createCar(kind, color, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var paint = paintMat(color == null ? PAINTS[Math.floor(Math.random() * PAINTS.length)] : color);
    var dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7, metalness: 0.3 });
    var chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.25 });
    var glass = glassMat();
    var len = kind === 'truck' ? 6.4 : kind === 'sports' ? 4.6 : 4.4;
    var wid = kind === 'truck' ? 2.2 : 1.9;
    var low = kind === 'sports' ? 0.62 : 0.78;

    if (kind === 'truck') {
      box(2.2, 1.6, wid, paint, 1.9, 1.15, 0, g); // cab
      box(1.4, 1.1, wid - 0.2, glass, 1.7, 1.5, 0, g);
      box(3.6, 2.3, wid, new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.4, roughness: 0.5 }), -1.3, 1.5, 0, g); // cargo
    } else {
      box(len, low, wid, paint, 0, 0.62, 0, g); // lower body
      box(len * 0.62, 0.62, wid - 0.24, paint, -0.2, low + 0.3, 0, g); // shoulder line
      box(len * 0.52, 0.55, wid - 0.3, glass, -0.25, low + 0.62, 0, g); // cabin glass
      box(len * 0.5, 0.1, wid - 0.34, paint, -0.25, low + 0.94, 0, g); // roof
      if (kind === 'sports') {
        box(0.14, 0.1, 1.7, dark, -len / 2 + 0.15, low + 0.28, 0, g); // spoiler blade
        box(0.1, 0.34, 0.1, dark, -len / 2 + 0.15, low + 0.1, 0.75, g);
        box(0.1, 0.34, 0.1, dark, -len / 2 + 0.15, low + 0.1, -0.75, g);
      }
    }
    // bumpers, grille, mirrors
    box(0.18, 0.3, wid - 0.1, dark, len / 2 - 0.05, 0.42, 0, g);
    box(0.18, 0.3, wid - 0.1, dark, -len / 2 + 0.05, 0.42, 0, g);
    box(0.1, 0.22, 1.0, chrome, len / 2 + 0.02, 0.72, 0, g);
    box(0.24, 0.14, 0.12, paint, len / 2 - 0.35, 1.05, wid / 2, g);
    box(0.24, 0.14, 0.12, paint, len / 2 - 0.35, 1.05, -wid / 2, g);
    // wheels with hubcaps
    var wheels = [];
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
    var hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10);
    var tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.95 });
    [[len / 2 - 0.9, wid / 2], [len / 2 - 0.9, -wid / 2], [-len / 2 + 0.9, wid / 2], [-len / 2 + 0.9, -wid / 2]].forEach(function (p, i) {
      var wgeo = new THREE.Group();
      var tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.x = Math.PI / 2; tire.castShadow = true;
      var hub = new THREE.Mesh(hubGeo, chrome);
      hub.rotation.x = Math.PI / 2;
      wgeo.add(tire); wgeo.add(hub);
      wgeo.position.set(p[0], 0.38, p[1]);
      g.add(wgeo);
      wheels.push({ group: wgeo, front: i < 2 });
    });
    // headlights: emissive lenses + additive halos + (player) a real beam
    var headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.25 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.35 });
    var headlights = [], taillights = [];
    [wid / 2 - 0.32, -wid / 2 + 0.32].forEach(function (z) {
      var hl = box(0.1, 0.22, 0.42, headMat, len / 2 + 0.03, 0.78, z, g);
      var halo = SOL.glowSprite(0xffe9a8, 1.6, 0);
      halo.position.set(len / 2 + 0.3, 0.78, z); g.add(halo);
      headlights.push({ mesh: hl, halo: halo, mat: headMat });
      var tl = box(0.1, 0.2, 0.4, tailMat, -len / 2 - 0.03, 0.78, z, g);
      var thalo = SOL.glowSprite(0xff2222, 1.3, 0);
      thalo.position.set(-len / 2 - 0.3, 0.78, z); g.add(thalo);
      taillights.push({ mesh: tl, halo: thalo, mat: tailMat });
    });
    // taxi extras
    if (kind === 'taxi') {
      var sign = box(0.7, 0.3, 0.5, new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffd75e, emissiveIntensity: 0.4 }), -0.2, low + 1.12, 0, g);
      sign.userData.isTaxiSign = true;
    }
    if (kind === 'police') {
      var bar = box(0.9, 0.16, 0.5, dark, -0.2, low + 1.02, 0, g);
      var rLight = box(0.4, 0.18, 0.52, new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 1 }), -0.2, low + 1.04, 0.12, g);
      var bLight = box(0.4, 0.18, 0.52, new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2266ff, emissiveIntensity: 1 }), -0.2, low + 1.04, -0.12, g);
      g.userData.lightBar = { r: rLight, b: bLight, phase: 0 };
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var car = {
      group: g, kind: kind, color: color, speed: 0,
      cruise: 12, // default cruise speed (m/s): never leave it unset
      heading: 0, steer: 0, accel: 0,
      wheels: wheels, headlights: headlights, taillights: taillights,
      headMat: headMat, tailMat: tailMat, isPlayer: false,
      axis: 'x', dir: 1, lane: 2.2, x: 0, z: 0, hp: 100,
    };
    car.group.position.set(0, 0, 0);
    return car;
  }
  SOL.createCar = createCar;

  function placeCar(car, x, z, heading) {
    car.x = x; car.z = z; car.heading = heading || 0;
    car.group.position.set(x, 0, z);
    car.group.rotation.y = -car.heading;
  }
  SOL.placeCar = placeCar;

  // ---- traffic -------------------------------------------------------------
  var ROADS = [-168, -112, -56, 0, 56, 112, 168];
  function spawnTraffic(n) {
    var kinds = ['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck'];
    for (var i = 0; i < n; i++) {
      var car = createCar(kinds[i % kinds.length]);
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var road = ROADS[Math.floor(Math.random() * ROADS.length)];
      var along = -180 + Math.random() * 360;
      car.axis = axis; car.dir = Math.random() < 0.5 ? 1 : -1;
      car.lane = (Math.random() < 0.5 ? 2.4 : -2.4);
      car.cruise = 9 + Math.random() * 6;
      car.speed = car.cruise;
      if (axis === 'x') placeCar(car, along, road + car.lane, car.dir > 0 ? 0 : Math.PI);
      else placeCar(car, road + car.lane, along, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      SOL.scene.add(car.group);
      SOL.traffic.push(car); SOL.vehicles.push(car);
    }
  }
  SOL.spawnTraffic = spawnTraffic;

  function updateTraffic(dt) {
    SOL.traffic.forEach(function (car) {
      // keep a gap to the car ahead in the same lane
      var target = car.cruise;
      SOL.traffic.forEach(function (o) {
        if (o === car || o.axis !== car.axis || o.dir !== car.dir) return;
        var sameLane = Math.abs((car.axis === 'x' ? o.z - car.z : o.x - car.x)) < 3;
        if (!sameLane) return;
        var ahead = car.axis === 'x' ? (o.x - car.x) * car.dir : (o.z - car.z) * car.dir;
        if (ahead > 0 && ahead < 14) target = Math.min(target, o.speed * 0.8);
      });
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      var step = car.speed * dt;
      if (car.axis === 'x') {
        car.x += step * car.dir;
        if (Math.abs(car.x) > 186) { car.dir *= -1; car.lane *= -1; car.heading += Math.PI; }
        if (Math.random() < dt * 0.06) { // turn at an intersection
          car.axis = 'z'; car.z = car.x; car.x = ROADS[Math.floor(Math.random() * ROADS.length)] + car.lane;
          car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else {
        car.z += step * car.dir;
        if (Math.abs(car.z) > 186) { car.dir *= -1; car.lane *= -1; car.heading += Math.PI; }
        if (Math.random() < dt * 0.06) {
          car.axis = 'x'; car.x = car.z; car.z = ROADS[Math.floor(Math.random() * ROADS.length)] + car.lane;
          car.heading = car.dir > 0 ? 0 : Math.PI;
        }
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = -car.heading;
      car.wheels.forEach(function (w) { w.group.rotation.x += car.speed * dt * 2.6; });
    });
  }

  // ---- player driving ------------------------------------------------------
  // A real headlight beam for the player's car: a spotlight that switches on
  // with the dark, so night driving throws light down the road.
  function attachHeadlightBeam(car) {
    var beam = new THREE.SpotLight(0xffe9a8, 0, 55, 0.42, 0.5, 1.1);
    beam.position.set(2.2, 0.9, 0);
    var tgt = new THREE.Object3D();
    tgt.position.set(22, -0.6, 0);
    car.group.add(tgt); beam.target = tgt;
    car.group.add(beam);
    car.beam = beam;
    return beam;
  }
  SOL.attachHeadlightBeam = attachHeadlightBeam;

  function driveCar(car, input, dt) {
    var top = 34; // m/s, about 122 km/h
    if (input.forward) car.accel = Math.min(car.accel + dt * 26, 22);
    else if (input.back) car.accel = Math.max(car.accel - dt * 30, -12);
    else car.accel *= Math.max(0, 1 - dt * 1.6);
    car.speed += car.accel * dt;
    if (input.brake) car.speed *= Math.max(0, 1 - dt * 4);
    car.speed = Math.max(-8, Math.min(top, car.speed));
    var steerTarget = 0;
    if (input.left) steerTarget = 1;
    if (input.right) steerTarget = -1;
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 6);
    var turnRate = car.steer * 1.9 * Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= 0 ? 1 : -1);
    car.heading += turnRate * dt;
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var nx = car.x + fx * car.speed * dt;
    var nz = car.z + fz * car.speed * dt;
    // building push-out
    var hit = collideBuildings(nx, nz, 2.2);
    if (hit) { car.speed *= 0.55; } else { car.x = nx; car.z = nz; }
    // bay edge: stay on land unless in a boat
    if (car.x < -186) { car.x = -186; car.speed *= 0.5; }
    car.x = Math.max(-186, Math.min(188, car.x));
    car.z = Math.max(-188, Math.min(188, car.z));
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = -car.heading;
    // body roll + pitch for feel
    car.group.rotation.z = -car.steer * 0.05 * Math.min(1, Math.abs(car.speed) / 12);
    car.group.rotation.x = -car.accel * 0.003;
    car.wheels.forEach(function (w) {
      w.group.rotation.x += car.speed * dt * 2.6;
      if (w.front) w.group.rotation.y = car.steer * 0.42;
    });
    car.braking = !!input.brake;
    return car.speed;
  }
  SOL.driveCar = driveCar;

  function collideBuildings(x, z, r) {
    var cs = SOL.world.colliders;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return c;
    }
    return null;
  }
  SOL.collideBuildings = collideBuildings;

  function updateCarLights(car, night, dt) {
    var on = night > 0.35;
    if (car.beam) car.beam.intensity = on ? 260 : 0;
    car.headMat.emissiveIntensity = on ? 1.6 : 0.25;
    car.headlights.forEach(function (h) { h.halo.material.opacity = on ? 0.8 : 0; });
    car.taillights.forEach(function (t) { t.halo.material.opacity = on ? (car.braking ? 0.95 : 0.45) : 0; });
    car.tailMat.emissiveIntensity = car.braking ? 2.2 : (on ? 0.9 : 0.35);
    if (car.group.userData.lightBar) {
      var lb = car.group.userData.lightBar;
      lb.phase += dt * 9;
      var onR = Math.sin(lb.phase) > 0;
      lb.r.material.emissiveIntensity = onR ? 3 : 0.2;
      lb.b.material.emissiveIntensity = onR ? 0.2 : 3;
    }
  }
  SOL.updateCarLights = updateCarLights;

  // ---- helicopter ----------------------------------------------------------
  function createHeli(police) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: police ? 0x1a2028 : 0xd8b13a, metalness: 0.6, roughness: 0.4 });
    var glass = new THREE.MeshPhongMaterial({ color: 0x0e1c28, shininess: 140, specular: 0x88aaff });
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.7, 2), bodyMat);
    body.position.y = 1.4; body.castShadow = true; g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), glass);
    nose.position.set(2.1, 1.3, 0); nose.castShadow = true; g.add(nose);
    var boom = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.5), bodyMat);
    boom.position.set(-3.4, 1.7, 0); boom.castShadow = true; g.add(boom);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.2), bodyMat);
    fin.position.set(-5.4, 2.3, 0); g.add(fin);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    tailRotor.position.set(-5.5, 2.2, 0.35); g.add(tailRotor);
    var rotor = new THREE.Group();
    var b1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    var b2 = b1.clone(); b2.rotation.y = Math.PI / 2;
    rotor.add(b1); rotor.add(b2);
    rotor.position.y = 2.6; g.add(rotor);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(4.8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 2.55; g.add(disc);
    var skidMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 });
    [-0.8, 0.8].forEach(function (z) {
      var skid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.12), skidMat);
      skid.position.set(0.3, 0.15, z); g.add(skid);
    });
    // nav lights: red left, green right, white strobe
    var nav = {};
    [['red', 0xff2222, 0, 1.1], ['green', 0x22ff66, 0, -1.1], ['strobe', 0xffffff, 2.4, 0]].forEach(function (d) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: d[1], emissiveIntensity: 1.6 }));
      m.position.set(d[2], 1.4, d[3]); g.add(m);
      var halo = SOL.glowSprite(d[1], 1.4, 0.7); halo.position.copy(m.position); g.add(halo);
      nav[d[0]] = { mesh: m, halo: halo, mat: m.material };
    });
    // police searchlight: real spotlight + visible cone + ground pool
    var spot = null, cone = null, pool = null;
    if (police) {
      spot = new THREE.SpotLight(0xfff2c0, 0, 120, 0.32, 0.45, 1.2);
      spot.position.set(0, 1.2, 0);
      var tgt = new THREE.Object3D(); tgt.position.set(0, -30, 0);
      g.add(tgt); spot.target = tgt; g.add(spot);
      cone = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
      cone.position.y = -12; cone.rotation.x = Math.PI; g.add(cone);
      pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.28, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.1;
      SOL.scene.add(pool);
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    var heli = { group: g, rotor: rotor, tailRotor: tailRotor, nav: nav, spot: spot, cone: cone, pool: pool,
      x: 0, y: 30, z: 0, heading: 0, speed: 0, alt: 30, police: !!police, isPlayer: false, strobeT: 0 };
    return heli;
  }
  SOL.createHeli = createHeli;

  // ---- boats ---------------------------------------------------------------
  function createBoat(kind, x, z, heading) {
    var g = new THREE.Group();
    var hullMat = new THREE.MeshStandardMaterial({ color: kind === 'yacht' ? 0xf2f4f6 : 0x2e6fc2, roughness: 0.35, metalness: 0.25 });
    var len = kind === 'yacht' ? 10 : 6;
    var hull = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5, kind === 'yacht' ? 3.4 : 2.2), hullMat);
    hull.position.y = 0.3; hull.castShadow = true; g.add(hull);
    var bow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.5, 2.2, 4), hullMat);
    bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(len / 2 + 1, 0.3, 0); g.add(bow);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.45, 1.5, kind === 'yacht' ? 2.6 : 1.8),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.4 }));
    cabin.position.set(-0.6, 1.7, 0); cabin.castShadow = true; g.add(cabin);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(len * 0.4, 0.6, kind === 'yacht' ? 2.7 : 1.9),
      new THREE.MeshPhongMaterial({ color: 0x0e1c28, shininess: 120 }));
    glass.position.set(-0.6, 2.2, 0); g.add(glass);
    g.position.set(x, -0.1, z); g.rotation.y = -heading;
    SOL.scene.add(g);
    var boat = { group: g, kind: kind, x: x, z: z, heading: heading, speed: 0, cruise: 14, isPlayer: false };
    SOL.boats.push(boat);
    return boat;
  }
  SOL.createBoat = createBoat;

  function updateVehicles(dt, playerPos) {
    updateTraffic(dt);
    SOL.boats.forEach(function (b) {
      if (b.isPlayer) return;
      b.group.position.set(b.x, -0.1 + Math.sin(SOL.time.hour * 9 + b.x) * 0.08, b.z);
      b.group.rotation.z = Math.sin(SOL.time.hour * 7 + b.z) * 0.02;
    });
    // heli rotors always spin; searchlight pool follows the ground below
    var helis = SOL.helis || [];
    helis.forEach(function (h) {
      h.rotor.rotation.y += dt * 22;
      h.tailRotor.rotation.x += dt * 30;
      h.strobeT += dt;
      if (h.nav.strobe) {
        var on = (h.strobeT % 1.2) < 0.12;
        h.nav.strobe.mat.emissiveIntensity = on ? 4 : 0.2;
        h.nav.strobe.halo.material.opacity = on ? 0.9 : 0.05;
      }
      if (h.spot) {
        var on2 = SOL.night > 0.3;
        h.spot.intensity = on2 ? 900 : 0;
        h.cone.visible = on2; h.pool.visible = on2;
        if (on2) h.pool.position.set(h.group.position.x, 0.1, h.group.position.z);
      }
    });
    // police light bars flash
    SOL.traffic.forEach(function (c) {
      if (c.kind === 'police') updateCarLights(c, SOL.night, dt);
    });
  }
  SOL.updateVehicles = updateVehicles;
  SOL.helis = [];

  // Boats in the bay: one tied up at the marina pier for the Harbor Run,
  // the rest out on the water where the player can take them.
  function spawnBoats() {
    var spots = [[-200, -40], [-240, 80], [-260, -100], [-300, 40]];
    spots.forEach(function (s) {
      createBoat('boat', s[0], s[1], Math.random() * Math.PI * 2);
    });
  }
  SOL.spawnBoats = spawnBoats;

  // One more big white yacht joins the marina's moored fleet. The city's
  // own yachts already sit in SOL.world.yachts; this one is built here so
  // the fleet is complete even if the marina build changes.
  function spawnYachts() {
    var y = createBoat('yacht', -206, 20, Math.PI / 2);
    var i = SOL.boats.indexOf(y);
    if (i >= 0) SOL.boats.splice(i, 1);
    SOL.world.yachts.push({ x: -206, z: 20, heading: Math.PI / 2, group: y.group, taken: false });
  }
  SOL.spawnYachts = spawnYachts;
})();
