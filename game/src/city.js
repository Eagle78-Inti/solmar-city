// Solmar City — the city: grid streets, the bay and marina, Neon Mile, and
// every building, palm and streetlight. All textures are procedural canvas.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  SOL.world = {
    colliders: [], lamps: [], palms: [], neonSigns: [],
    roadsX: [], roadsZ: [], yachts: [], piers: [],
    spots: {}, // named landmarks: marta, ammu, garage, hospital, bank, marina, yachtDock
  };

  var PITCH = 56, ROAD_W = 12, BLOCK = 44;
  var GRID = [-168, -112, -56, 0, 56, 112, 168];
  var BLOCK_C = [-140, -84, -28, 28, 84, 140];
  var CITY_MIN = -190, CITY_MAX = 190;

  function box(w, h, d, mat, x, y, z, shadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function facadeMat(tex, floors) {
    var t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(2, Math.max(1, floors));
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.05 });
  }

  function buildGround(scene) {
    // base ground
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
    scene.add(ground);

    // roads: one long strip per grid line, with the dashed-centre texture
    var roadTex = SOL.textures.road;
    GRID.forEach(function (c) {
      var t1 = roadTex.clone(); t1.needsUpdate = true; t1.repeat.set(1, 7);
      var mx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 400),
        new THREE.MeshStandardMaterial({ map: t1, roughness: 0.9 }));
      mx.rotation.x = -Math.PI / 2; mx.position.set(c, 0, 0); mx.receiveShadow = true;
      scene.add(mx);
      var t2 = roadTex.clone(); t2.needsUpdate = true; t2.repeat.set(1, 7);
      var mz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 400),
        new THREE.MeshStandardMaterial({ map: t2, roughness: 0.9 }));
      mz.rotation.x = -Math.PI / 2; mz.rotation.z = Math.PI / 2; mz.position.set(0, 0, c); mz.receiveShadow = true;
      scene.add(mz);
      SOL.world.roadsX.push(c); SOL.world.roadsZ.push(c);
    });
    // sidewalks hugging every road
    var swTex = SOL.textures.sidewalk;
    GRID.forEach(function (c) {
      [-1, 1].forEach(function (s) {
        var t = swTex.clone(); t.needsUpdate = true; t.repeat.set(1, 14);
        var sx = new THREE.Mesh(new THREE.PlaneGeometry(4, 400),
          new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
        sx.rotation.x = -Math.PI / 2; sx.position.set(c + s * 8, 0.06, 0); sx.receiveShadow = true;
        scene.add(sx);
        var t2 = swTex.clone(); t2.needsUpdate = true; t2.repeat.set(1, 14);
        var sz = new THREE.Mesh(new THREE.PlaneGeometry(4, 400),
          new THREE.MeshStandardMaterial({ map: t2, roughness: 0.95 }));
        sz.rotation.x = -Math.PI / 2; sz.rotation.z = Math.PI / 2; sz.position.set(0, 0.06, c + s * 8); sz.receiveShadow = true;
        scene.add(sz);
      });
    });

    // beach + bay water, west of the city
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(26, 400),
      new THREE.MeshStandardMaterial({ color: 0xc9b285, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-179, 0.02, 0); sand.receiveShadow = true;
    scene.add(sand);
    var waterTex = SOL.textures.water.clone(); waterTex.needsUpdate = true; waterTex.repeat.set(6, 6);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(260, 460),
      new THREE.MeshPhongMaterial({ map: waterTex, color: 0x2f7ea8, shininess: 140, specular: 0x99ccff, transparent: true, opacity: 0.94 }));
    water.rotation.x = -Math.PI / 2; water.position.set(-322, -0.35, 0);
    scene.add(water);
    SOL.world.water = water; SOL.world.waterTex = waterTex;
  }

  function buildBuildings(scene) {
    var r = SOL.rand(99);
    var downtown = new THREE.MeshStandardMaterial({ color: 0x2c3444, roughness: 0.9 });
    BLOCK_C.forEach(function (bx) {
      BLOCK_C.forEach(function (bz) {
        var dx = Math.abs(bx), dz = Math.abs(bz);
        var isDowntown = dx <= 28 && dz <= 28;
        var isNeon = bx >= 56 && bz >= -84 && bz <= 28;
        var count = isDowntown ? 1 : (r() < 0.5 ? 2 : 1);
        for (var i = 0; i < count; i++) {
          var w = 16 + r() * 14, d = 16 + r() * 14;
          var h = isDowntown ? 34 + r() * 30 : isNeon ? 14 + r() * 12 : 8 + r() * 12;
          var ox = (i === 0 ? -w / 4 : w / 4) * (count > 1 ? 1 : 0) + (r() - 0.5) * 4;
          var oz = (r() - 0.5) * 6;
          var cx = bx + ox, cz = bz + oz;
          var floors = Math.max(1, Math.round(h / 7));
          var tex = isDowntown ? SOL.textures.facadeDowntown : isNeon ? SOL.textures.facadeNeon : (r() < 0.4 ? SOL.textures.brick : SOL.textures.facadeLow);
          var side = facadeMat(tex, floors);
          var top = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 1 });
          var mats = [side, side, top, top, side, side];
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
          b.position.set(cx, h / 2, cz);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          SOL.world.colliders.push({ x1: cx - w / 2, z1: cz - d / 2, x2: cx + w / 2, z2: cz + d / 2 });
          // rooftop props: AC boxes, a water tower, an antenna on tall blocks
          var ac = box(3, 1.4, 2.4, downtown, cx - w / 4, h + 0.7, cz, true); scene.add(ac);
          var ac2 = box(2.2, 1, 2, downtown, cx + w / 5, h + 0.5, cz + d / 5, true); scene.add(ac2);
          if (h > 30 && r() < 0.6) {
            var tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 10), new THREE.MeshStandardMaterial({ color: 0x6b4a35, roughness: 0.9 }));
            tower.position.set(cx + w / 3, h + 3.4, cz - d / 4); tower.castShadow = true; scene.add(tower);
            var legs = box(0.5, 2.4, 0.5, downtown, cx + w / 3, h + 1.2, cz - d / 4, false); scene.add(legs);
          }
          if (h > 40) {
            var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 9, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            ant.position.set(cx, h + 4.5, cz); scene.add(ant);
            var tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
            tip.position.set(cx, h + 9, cz); scene.add(tip);
            SOL.world.antennaTips = SOL.world.antennaTips || []; SOL.world.antennaTips.push(tip);
          }
          // neon signs on Neon Mile facades, facing the nearest road
          if (isNeon && r() < 0.85) {
            var signs = [SOL.textures.neonPalms, SOL.textures.neonCasino, SOL.textures.neonNeon, SOL.textures.neonDiner];
            var pick = signs[Math.floor(r() * signs.length)];
            var colors = [0xff5fa2, 0xffd75e, 0x37e0ff, 0x7dff8a];
            var ci = signs.indexOf(pick);
            var sign = SOL.makeNeonSign(pick, 12, 3, colors[ci]);
            sign.position.set(cx, Math.min(h - 2, 12), cz + d / 2 + 0.15);
            scene.add(sign);
            SOL.world.neonSigns.push(sign);
          }
        }
      });
    });
  }

  function buildPalms(scene) {
    var r = SOL.rand(7);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5236, roughness: 1 });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, side: THREE.DoubleSide });
    function palm(x, z, s) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 7 * s, 7), trunkMat);
      trunk.position.y = 3.5 * s; trunk.castShadow = true;
      g.add(trunk);
      for (var i = 0; i < 7; i++) {
        var leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.12 * s, 4.4 * s), leafMat);
        var a = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.7 * s, (7.1 - Math.abs(Math.sin(a)) * 0.4) * s, Math.sin(a) * 1.7 * s);
        leaf.rotation.y = -a; leaf.rotation.x = 0.5;
        leaf.castShadow = true;
        g.add(leaf);
      }
      var nut = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a6b3a }));
      nut.position.y = 6.9 * s; g.add(nut);
      g.position.set(x, 0, z);
      scene.add(g);
      SOL.world.palms.push(g);
    }
    // beach row + scattered along roads and Neon Mile
    for (var i = 0; i < 18; i++) palm(-186 + r() * 6, -180 + i * 21 + r() * 6, 0.9 + r() * 0.5);
    for (var j = 0; j < 28; j++) {
      var road = GRID[Math.floor(r() * GRID.length)];
      var along = -180 + r() * 360;
      if (r() < 0.5) palm(road + 10.5, along, 0.8 + r() * 0.4); else palm(along, road + 10.5, 0.8 + r() * 0.4);
    }
  }

  function buildLamps(scene) {
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.6 });
    var bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0.15 });
    GRID.forEach(function (cx) {
      GRID.forEach(function (cz) {
        if ((cx + cz) % 112 !== 0) return; // one lamp per other intersection
        var g = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.5, 8), poleMat);
        pole.position.y = 3.75; pole.castShadow = true; g.add(pole);
        var arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), poleMat);
        arm.position.set(1.2, 7.4, 0); g.add(arm);
        var head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), poleMat);
        head.position.set(2.4, 7.3, 0); g.add(head);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat);
        bulb.position.set(2.4, 7.12, 0); g.add(bulb);
        var halo = SOL.glowSprite(0xffdf8a, 5, 0);
        halo.position.set(2.4, 7.1, 0); g.add(halo);
        g.position.set(cx + 9, 0, cz + 9);
        scene.add(g);
        SOL.world.lamps.push({ bulbMat: bulbMat, halo: halo });
      });
    });
    // lamp glow follows the night factor
    SOL.onTimeChange = (function (prev) {
      return function (night, dayF) {
        if (prev) prev(night, dayF);
        SOL.world.lamps.forEach(function (l) {
          l.bulbMat.emissiveIntensity = 0.15 + night * 2.2;
          l.halo.material.opacity = night * 0.75;
        });
        SOL.world.neonSigns.forEach(function (s) {
          s.userData.halo.material.opacity = 0.25 + night * 0.5;
        });
      };
    })(SOL.onTimeChange);
  }

  function buildMarina(scene) {
    var pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5c40, roughness: 1 });
    var postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
    [[-40, 0], [60, 0]].forEach(function (pz) {
      var pier = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 5), pierMat);
      pier.position.set(-208, 0.35, pz[0]); pier.castShadow = true; pier.receiveShadow = true;
      scene.add(pier);
      SOL.world.piers.push(pier);
      for (var i = 0; i < 5; i++) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), postMat);
        post.position.set(-192 - i * 8, 0.4, pz[0] + 2.2); scene.add(post);
      }
    });
    // moored yachts + speedboats
    function yacht(x, z, heading, big) {
      var g = new THREE.Group();
      var hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.25 });
      var hull = new THREE.Mesh(new THREE.BoxGeometry(big ? 10 : 6, 1.6, big ? 3.4 : 2.2), hullMat);
      hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
      var bow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.6, 2.4, 4), hullMat);
      bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(big ? 5.8 : 3.6, 0.4, 0); g.add(bow);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(big ? 5 : 3, 1.6, big ? 2.6 : 1.8),
        new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.4 }));
      cabin.position.set(-0.6, 1.9, 0); cabin.castShadow = true; g.add(cabin);
      var glass = new THREE.Mesh(new THREE.BoxGeometry(big ? 4.6 : 2.6, 0.7, big ? 2.7 : 1.9),
        new THREE.MeshPhongMaterial({ color: 0x0e1c28, shininess: 120 }));
      glass.position.set(-0.6, 2.5, 0); g.add(glass);
      g.position.set(x, 0, z); g.rotation.y = heading;
      scene.add(g);
      var y = { group: g, x: x, z: z, heading: heading, big: big, taken: false };
      SOL.world.yachts.push(y);
      return y;
    }
    yacht(-206, -52, Math.PI / 2, true);   // the white yacht for Harbor Lights
    yacht(-206, -30, Math.PI / 2, true);
    yacht(-206, 48, Math.PI / 2, false);
    yacht(-206, 72, Math.PI / 2, true);
    yacht(-232, -8, 0.3, false);
  }

  function buildLandmarks(scene) {
    var spots = SOL.world.spots;
    spots.marta = { x: -8, z: -8, label: 'Marta' };
    spots.hospital = { x: 140, z: 168, label: 'Hospital' };
    spots.bank = { x: 28, z: -28, label: 'Solmar Bank' };
    spots.marina = { x: -196, z: -40, label: 'Marina buyer' };
    spots.yachtDock = { x: -206, z: -52, label: 'White yacht' };
    // Ammu-Nation shopfront: orange awning + sign on a low block
    var shop = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 12),
      new THREE.MeshStandardMaterial({ map: SOL.textures.brick, roughness: 0.9 }));
    base.position.y = 3.5; base.castShadow = true; base.receiveShadow = true; shop.add(base);
    var awn = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.4, 4),
      new THREE.MeshStandardMaterial({ color: 0xff8a3c, roughness: 0.7 }));
    awn.position.set(0, 5.6, 7); shop.add(awn);
    var sign = SOL.makeNeonSign(SOL.textures.neonAmmu, 11, 2.6, 0xff8a3c);
    sign.position.set(0, 8.4, 6.4); shop.add(sign);
    SOL.world.neonSigns.push(sign);
    shop.position.set(84, 0, -56);
    scene.add(shop);
    SOL.world.colliders.push({ x1: 84 - 9, z1: -56 - 6, x2: 84 + 9, z2: -56 + 6 });
    spots.ammu = { x: 84, z: -48, label: 'Ammu-Nation' };
    // Sunset Garage (property): shuttered garage block with a forecourt
    var gar = new THREE.Group();
    var gbase = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85 }));
    gbase.position.y = 3; gbase.castShadow = true; gbase.receiveShadow = true; gar.add(gbase);
    for (var i = 0; i < 3; i++) {
      var door = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x8a94a6, roughness: 0.5, metalness: 0.5 }));
      door.position.set(-6.6 + i * 6.6, 2.2, 7.1); gar.add(door);
    }
    var gsign = SOL.makeNeonSign(SOL.textures.neonDiner, 10, 2.4, 0x7dff8a);
    gsign.position.set(0, 7.6, 7.2); gar.add(gsign);
    SOL.world.neonSigns.push(gsign);
    gar.position.set(-84, 0, 140);
    scene.add(gar);
    SOL.world.colliders.push({ x1: -84 - 11, z1: 140 - 7, x2: -84 + 11, z2: 140 + 7 });
    spots.garage = { x: -84, z: 130, label: 'Sunset Garage — $4,000' };
  }

  function buildCity() {
    var scene = SOL.scene;
    buildGround(scene);
    buildBuildings(scene);
    buildPalms(scene);
    buildLamps(scene);
    buildMarina(scene);
    buildLandmarks(scene);
    buildPlaza(scene);
    buildWetRoads(scene);
  }
  SOL.buildCity = buildCity;

  // A small downtown plaza: benches, planters and a fountain ring, for the
  // on-foot screenshots to have somewhere that reads as a place, not a road.
  function buildPlaza(scene) {
    var benchMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.95 });
    [[-34, -34], [-22, -34], [-34, -22]].forEach(function (p) {
      var bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.1), benchMat);
      bench.position.set(p[0], 0.6, p[1]); bench.castShadow = true; scene.add(bench);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 1), stoneMat);
      leg.position.set(p[0], 0.25, p[1]); scene.add(leg);
    });
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.9, 20), stoneMat);
    rim.position.set(-28, 0.45, -28); rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
    var pool = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 0.4, 20),
      new THREE.MeshPhongMaterial({ color: 0x2f7ea8, shininess: 140, specular: 0x99ccff }));
    pool.position.set(-28, 0.75, -28); scene.add(pool);
    SOL.world.plaza = { x: -28, z: -28 };
  }

  // Wet roads when it rains: darker, shinier asphalt plus reflective puddles.
  function buildWetRoads(scene) {
    var wetTex = SOL.textures.asphalt.clone(); wetTex.needsUpdate = true;
    SOL.world.wetRoadMat = new THREE.MeshStandardMaterial({ map: wetTex, color: 0x555a60, roughness: 0.25, metalness: 0.35 });
    var puddles = [];
    var r = SOL.rand(31);
    for (var i = 0; i < 14; i++) {
      var road = GRID[Math.floor(r() * GRID.length)];
      var along = -180 + r() * 360;
      var puddle = new THREE.Mesh(new THREE.CircleGeometry(2 + r() * 2.4, 18),
        new THREE.MeshPhongMaterial({ color: 0x8fb8d8, shininess: 160, specular: 0xffffff, transparent: true, opacity: 0.75 }));
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(r() < 0.5 ? road + (r() - 0.5) * 8 : along, 0.08, r() < 0.5 ? along : road + (r() - 0.5) * 8);
      puddle.visible = false;
      scene.add(puddle); puddles.push(puddle);
    }
    SOL.world.puddles = puddles;
    SOL.onWeatherChange = (function (prev) {
      return function (kind) {
        if (prev) prev(kind);
        puddles.forEach(function (p) { p.visible = kind === 'rain'; });
      };
    })(SOL.onWeatherChange);
  }
})();
