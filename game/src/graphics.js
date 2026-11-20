// Solmar City — graphics core: renderer, sky, sun and moon, fog, weather,
// and every procedural canvas texture the city is built from. No external art.
(function () {
  var SOL = (window.SOL = window.SOL || {});
  var THREE = window.THREE;

  SOL.THREE = THREE;
  SOL.time = { hour: 17.75, dayLength: 480 }; // game clock; a full day is 8 real minutes
  SOL.weather = 'clear'; // clear | haze | rain
  SOL.night = 0; // 0 = day, 1 = full night, lerped from the clock
  SOL.rainAmt = 0;

  // Blend two THREE.Color values channel by channel into `out` (THREE.Color has
  // no addScaledVector; do the arithmetic on r, g and b directly).
  function lerpColor(a, b, t, out) {
    out.r = a.r + (b.r - a.r) * t;
    out.g = a.g + (b.g - a.g) * t;
    out.b = a.b + (b.b - a.b) * t;
    return out;
  }
  SOL.lerpColor = lerpColor;

  function canvasTex(w, h, draw, repeat) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  SOL.makeTex = canvasTex;

  function rand(seed) { // tiny deterministic PRNG so textures look the same every run
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  SOL.rand = rand;

  // ---- procedural textures -------------------------------------------------
  function facadeTexture(base, trim, litRatio, seed) {
    var r = rand(seed);
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // subtle grime streaks
      for (var i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.03 + r() * 0.06) + ')';
        g.fillRect(r() * w, r() * h, 2 + r() * 8, 20 + r() * 60);
      }
      // window grid, some lit warm, most dark glass
      var cols = 6, rows = 9, ww = w / cols, wh = h / rows;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var lit = r() < litRatio;
          g.fillStyle = lit ? '#ffd98a' : (r() < 0.5 ? '#202b3a' : '#2c3a4d');
          g.fillRect(x * ww + 4, y * wh + 5, ww - 8, wh - 10);
          if (lit) { g.fillStyle = 'rgba(255,220,140,0.35)'; g.fillRect(x * ww + 4, y * wh + 5, ww - 8, 3); }
        }
      }
      // floor bands and a ground-floor shopfront band
      g.fillStyle = trim; g.fillRect(0, h - 26, w, 26);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 28, w, 2);
    });
  }
  function brickTexture(base, seed) {
    var r = rand(seed);
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var bh = 16, bw = 42;
      for (var y = 0; y < h / bh; y++) {
        for (var x = -1; x < w / bw + 1; x++) {
          var shade = 0.85 + r() * 0.3;
          g.fillStyle = 'rgb(' + Math.floor(150 * shade) + ',' + Math.floor(84 * shade) + ',' + Math.floor(66 * shade) + ')';
          g.fillRect(x * bw + (y % 2 ? bw / 2 : 0) + 1, y * bh + 1, bw - 2, bh - 2);
        }
      }
    });
  }
  function asphaltTexture(seed) {
    var r = rand(seed);
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#23262b'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = 20 + r() * 45;
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 4) + ')';
        g.fillRect(r() * w, r() * h, 1.5, 1.5);
      }
      // cracks
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
      for (var c = 0; c < 6; c++) {
        g.beginPath(); var x = r() * w, y = r() * h;
        g.moveTo(x, y);
        for (var s = 0; s < 5; s++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
        g.stroke();
      }
    });
  }
  function roadTexture() {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = '#23262b'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var v = 22 + Math.random() * 38;
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 4) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      // edge lines
      g.fillStyle = '#d8d8c8'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
      // dashed centre line
      g.fillStyle = '#f2d24b';
      for (var y = 0; y < h; y += 64) g.fillRect(w / 2 - 2, y + 8, 4, 34);
    });
  }
  function sidewalkTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#8d8f94'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 500; i++) {
        var v = 120 + Math.random() * 40;
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    });
  }
  function waterTexture() {
    return canvasTex(256, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1d5f7a'); grad.addColorStop(0.5, '#17607f'); grad.addColorStop(1, '#0f4a66');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.5;
      for (var i = 0; i < 26; i++) {
        var y = Math.random() * h, x = Math.random() * w, len = 20 + Math.random() * 60;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
      }
    });
  }
  function glowTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      var grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
  }
  function cloudTexture() {
    return canvasTex(256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) {
        var x = 20 + Math.random() * (w - 40), y = 30 + Math.random() * (h - 55), r = 14 + Math.random() * 26;
        var grad = g.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    });
  }
  function neonTexture(word, color, sub) {
    return canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = '#0d0a14'; g.fillRect(0, 0, w, h);
      g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
      g.font = 'bold 64px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 26;
      g.fillStyle = color; g.fillText(word, w / 2, sub ? h / 2 - 12 : h / 2);
      if (sub) { g.font = 'bold 26px Arial'; g.shadowBlur = 12; g.fillText(sub, w / 2, h - 26); }
    });
  }

  SOL.textures = {
    facadeDowntown: facadeTexture('#3d4a63', '#232c3d', 0.28, 11),
    facadeMid: facadeTexture('#5b5648', '#2e2a22', 0.34, 23),
    facadeNeon: facadeTexture('#4a2b4d', '#1c1420', 0.4, 37),
    facadeLow: facadeTexture('#7a6a58', '#3a322a', 0.3, 51),
    brick: brickTexture('#96543f', 7),
    concrete: canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#9a9da2'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 400; i++) { var v = 130 + Math.random() * 40; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }),
    asphalt: asphaltTexture(3),
    road: roadTexture(),
    sidewalk: sidewalkTexture(),
    water: waterTexture(),
    glow: glowTexture(),
    cloud: cloudTexture(),
    neonPalms: neonTexture('PALMS', '#ff5fa2', 'HOTEL · POOL · BAR'),
    neonCasino: neonTexture('CASINO', '#ffd75e', 'SLOTS · 24 HOURS'),
    neonNeon: neonTexture('NEON', '#37e0ff', 'MILE'),
    neonDiner: neonTexture('DINER', '#7dff8a', 'EAT · OPEN LATE'),
    neonAmmu: neonTexture('AMMU', '#ff8a3c', 'NATION · GUNS'),
  };

  // ---- renderer / scene ----------------------------------------------------
  function initGraphics() {
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('game').appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a2f3a, 0.0016);
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
    camera.position.set(0, 26, 60);

    // Sky dome: gradient + sun disc + moon disc, all driven by uniforms.
    var skyUniforms = {
      topColor: { value: new THREE.Color(0x2f6fb8) },
      horizonColor: { value: new THREE.Color(0xffb36b) },
      sunDir: { value: new THREE.Vector3(0.4, 0.35, 0.2) },
      sunColor: { value: new THREE.Color(0xffd9a0) },
      moonDir: { value: new THREE.Vector3(-0.5, 0.6, -0.3) },
      nightMix: { value: 0 },
    };
    var skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vDir; uniform vec3 topColor; uniform vec3 horizonColor;',
        'uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir; uniform float nightMix;',
        'void main(){',
        '  float h = clamp(vDir.y, -0.08, 1.0);',
        '  vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.62));',
        '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  col += sunColor * (pow(s, 220.0) * 1.6 + pow(s, 10.0) * 0.30) * (1.0 - nightMix);',
        '  float m = max(dot(normalize(vDir), normalize(moonDir)), 0.0);',
        '  col += vec3(0.85, 0.9, 1.0) * (pow(m, 350.0) * 1.4 + pow(m, 24.0) * 0.10) * nightMix;',
        '  col = mix(col, col * vec3(0.16, 0.20, 0.34), nightMix * 0.55);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), skyMat);
    scene.add(sky);

    // One shadow-casting directional light: sun by day, moon by night.
    var sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
    sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);

    var hemi = new THREE.HemisphereLight(0x9db8e8, 0x3a3230, 0.75);
    scene.add(hemi);

    // Drifting cloud billboards.
    var clouds = [];
    for (var i = 0; i < 14; i++) {
      var sm = new THREE.SpriteMaterial({ map: SOL.textures.cloud, transparent: true, opacity: 0.5 + Math.random() * 0.3, depthWrite: false, fog: false });
      var sp = new THREE.Sprite(sm);
      sp.position.set(-500 + Math.random() * 1000, 160 + Math.random() * 120, -500 + Math.random() * 1000);
      sp.scale.set(180 + Math.random() * 160, 60 + Math.random() * 40, 1);
      sp.userData.drift = 1.5 + Math.random() * 2.5;
      scene.add(sp); clouds.push(sp);
    }

    // Rain: a box of falling streaks around the camera, hidden until it rains.
    var rainGeo = new THREE.BufferGeometry();
    var rainCount = 1600, rainPos = new Float32Array(rainCount * 3);
    for (var j = 0; j < rainCount; j++) {
      rainPos[j * 3] = (Math.random() - 0.5) * 140;
      rainPos[j * 3 + 1] = Math.random() * 60;
      rainPos[j * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    var rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac4de, size: 0.5, transparent: true, opacity: 0.55 }));
    rain.visible = false; rain.frustumCulled = false;
    scene.add(rain);

    SOL.renderer = renderer; SOL.scene = scene; SOL.camera = camera;
    SOL.sun = sun; SOL.hemi = hemi; SOL.skyMat = skyMat; SOL.skyUniforms = skyUniforms;
    SOL.clouds = clouds; SOL.rain = rain; SOL.rainPos = rainPos;

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  SOL.initGraphics = initGraphics;

  // Glow sprite helper: a soft additive halo for neon, lamps and headlights.
  function glowSprite(color, scale, opacity) {
    var m = new THREE.SpriteMaterial({
      map: SOL.textures.glow, color: color, transparent: true,
      opacity: opacity == null ? 0.85 : opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var s = new THREE.Sprite(m);
    s.scale.set(scale, scale, 1);
    return s;
  }
  SOL.glowSprite = glowSprite;

  // A neon sign: emissive plane plus a coloured halo sprite behind it, so the
  // sign blooms at dusk and night without any post-processing pass.
  function makeNeonSign(tex, w, h, haloColor) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ map: tex });
    var face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, h + 0.4),
      new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
    back.position.z = -0.06;
    var halo = glowSprite(haloColor, Math.max(w, h) * 1.7, 0.55);
    halo.position.z = 0.25;
    g.add(back); g.add(face); g.add(halo);
    g.userData.halo = halo;
    return g;
  }
  SOL.makeNeonSign = makeNeonSign;

  // ---- day / night / weather ----------------------------------------------
  var DAY = {
    top: new THREE.Color(0x2f6fb8), horizon: new THREE.Color(0xbfd9ee),
    sun: new THREE.Color(0xfff2cf), fog: new THREE.Color(0xa8c4de), hemiSky: new THREE.Color(0x9db8e8),
  };
  var DUSK = {
    top: new THREE.Color(0x4a3a72), horizon: new THREE.Color(0xff9e57),
    sun: new THREE.Color(0xffb36b), fog: new THREE.Color(0x8a6a72), hemiSky: new THREE.Color(0x8a7ab8),
  };
  var NIGHT = {
    top: new THREE.Color(0x060a18), horizon: new THREE.Color(0x131a2e),
    sun: new THREE.Color(0x8fa8d8), fog: new THREE.Color(0x0a0f1c), hemiSky: new THREE.Color(0x2a3450),
  };
  var _c1 = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3();

  // hour: 0-24. Returns darkness 0..1. Drives sun position, sky, fog and lamps.
  function setTimeOfDay(hour) {
    SOL.time.hour = ((hour % 24) + 24) % 24;
    var h = SOL.time.hour;
    // daylight factor: 1 at noon, 0 at midnight, smooth at dawn/dusk
    var dayF = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
    var duskF = Math.max(0, 1 - Math.abs(h - 18.2) / 2.2) + Math.max(0, 1 - Math.abs(h - 6.4) / 1.6);
    duskF = Math.min(1, duskF);
    var night = 1 - Math.max(dayF, duskF * 0.55);
    SOL.night = night;

    var sunAngle = (h - 6) / 12 * Math.PI; // 0 at dawn, PI at dusk
    var elev = Math.sin(sunAngle), azim = Math.cos(sunAngle);
    _v.set(azim * 0.8, Math.max(elev, -0.25), 0.45).normalize();
    SOL.skyUniforms.sunDir.value.copy(_v);
    SOL.skyUniforms.nightMix.value = night;
    SOL.skyUniforms.moonDir.value.set(-0.45, 0.62, -0.35).normalize();

    // sky colours: day -> dusk -> night, blended channel by channel
    lerpColor(DAY.top, DUSK.top, duskF, _c1); lerpColor(_c1, NIGHT.top, night, _c2);
    SOL.skyUniforms.topColor.value.copy(_c2);
    lerpColor(DAY.horizon, DUSK.horizon, duskF, _c1); lerpColor(_c1, NIGHT.horizon, night, _c2);
    SOL.skyUniforms.horizonColor.value.copy(_c2);
    lerpColor(DAY.sun, DUSK.sun, duskF, _c1); lerpColor(_c1, NIGHT.sun, night, _c2);
    SOL.skyUniforms.sunColor.value.copy(_c2);
    lerpColor(DAY.fog, DUSK.fog, duskF, _c1); lerpColor(_c1, NIGHT.fog, night, _c2);
    SOL.scene.fog.color.copy(_c2);

    // the one directional light: warm low sun at dusk, cool moon at night
    if (night > 0.5) {
      SOL.sun.position.set(-160, 260, -120);
      SOL.sun.color.setHex(0x8fa8d8);
      SOL.sun.intensity = 0.55;
    } else {
      SOL.sun.position.set(azim * 320, Math.max(elev, 0.12) * 320 + 40, 150);
      SOL.sun.color.copy(_c2);
      SOL.sun.intensity = 1.1 + dayF * 0.7;
    }
    SOL.sun.target.position.set(0, 0, 0);
    SOL.sun.target.updateMatrixWorld();

    lerpColor(DAY.hemiSky, NIGHT.hemiSky, night, _c1);
    SOL.hemi.color.copy(_c1);
    SOL.hemi.intensity = 0.85 - night * 0.45;
    SOL.renderer.toneMappingExposure = 1.12 - night * 0.12;

    var fogBase = 0.0016 + night * 0.0011 + (SOL.weather === 'rain' ? 0.0026 : 0) + (SOL.weather === 'haze' ? 0.0022 : 0);
    SOL.scene.fog.density = fogBase;
    SOL.lampGlow = night; // city.js / vehicles.js read this for emissive + halos
    if (SOL.onTimeChange) SOL.onTimeChange(night, dayF);
    return night;
  }
  SOL.setTimeOfDay = setTimeOfDay;

  function setWeather(kind) {
    SOL.weather = kind;
    SOL.rain.visible = kind === 'rain';
    SOL.rainAmt = kind === 'rain' ? 1 : 0;
    if (SOL.onWeatherChange) SOL.onWeatherChange(kind);
    setTimeOfDay(SOL.time.hour); // re-apply fog for the new weather
  }
  SOL.setWeather = setWeather;

  // Per-frame visuals: cloud drift, water shimmer, rain fall, sun shadow follow.
  function updateGraphics(dt, focus) {
    for (var i = 0; i < SOL.clouds.length; i++) {
      var c = SOL.clouds[i];
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 620) c.position.x = -620;
      c.material.opacity = 0.35 + (1 - SOL.night) * 0.35;
    }
    if (SOL.textures.water) { SOL.textures.water.offset.x += dt * 0.008; SOL.textures.water.offset.y += dt * 0.004; }
    if (SOL.rain.visible && focus) {
      var p = SOL.rainPos;
      for (var j = 0; j < p.length; j += 3) {
        p[j + 1] -= 55 * dt;
        p[j] += 6 * dt;
        if (p[j + 1] < 0) { p[j + 1] = 55 + Math.random() * 5; p[j] = focus.x + (Math.random() - 0.5) * 140; p[j + 2] = focus.z + (Math.random() - 0.5) * 140; }
      }
      SOL.rain.geometry.attributes.position.needsUpdate = true;
      SOL.rain.position.set(focus.x, 0, focus.z);
    }
    // keep the shadow camera centred on the action
    if (focus) {
      SOL.sun.target.position.set(focus.x, 0, focus.z);
      SOL.sun.position.set(focus.x + (SOL.night > 0.5 ? -160 : 240), SOL.night > 0.5 ? 260 : 260, focus.z + 150);
      SOL.sun.target.updateMatrixWorld();
    }
  }
  SOL.updateGraphics = updateGraphics;
})();
