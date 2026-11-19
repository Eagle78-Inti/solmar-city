// Solmar City — the city itself: streets, buildings, bay, sky, day/night.
// Builds every visible piece of Solmar from procedural canvas textures.
// No network, no outside assets: everything is drawn at runtime.

import { clamp, lerp, rand, randInt, pick, mulberry32, makeCanvas, canvasTexture } from './util.js';

export const PITCH = 74;      // distance between neighbouring road centrelines
export const ROAD_W = 16;     // road width
export const HALF = 3;        // road indices run -3..3
export const BAY_X = 260;     // the bay starts east of here
export const DAY_LENGTH = 720; // one full day lasts 12 minutes

// Paint a building facade: windows in a grid, some lit warm, some dark.
function facadeCanvas(rng, base, litRatio) {
  return makeCanvas(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // subtle vertical panel shading
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(x, 0, 2, h);
    }
    const cols = 6, rows = 12, cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? pick(['#ffd98a', '#ffe9b0', '#ffb84d']) : '#20242e';
        g.fillRect(c * cw + 3, r * rh + 4, cw - 6, rh - 8);
      }
    }
    // ground floor: doors and shop fronts
    g.fillStyle = '#1c2027';
    g.fillRect(10, h - 26, 30, 26);
    g.fillStyle = '#3a2f1e';
    g.fillRect(52, h - 22, 66, 22);
  });
}

// Paint the ground: asphalt, road grid, lane dashes, crosswalks, sidewalks.
function groundCanvas() {
  return makeCanvas(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3d4046';
    g.fillRect(0, 0, w, h);
    // asphalt speckle
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const scale = w / 700; // world units -> canvas px (world spans -350..350)
    const toPx = (v) => (v + 350) * scale;
    // sidewalks: light blocks between the roads
    for (let bx = -3; bx <= 2; bx++) {
      for (let bz = -3; bz <= 2; bz++) {
        const x0 = toPx(bx * PITCH + ROAD_W / 2);
        const z0 = toPx(bz * PITCH + ROAD_W / 2);
        const s = (PITCH - ROAD_W) * scale;
        g.fillStyle = '#8d9299';
        g.fillRect(x0, z0, s, s);
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
          g.beginPath(); g.moveTo(x0 + (s * k) / 4, z0); g.lineTo(x0 + (s * k) / 4, z0 + s); g.stroke();
          g.beginPath(); g.moveTo(x0, z0 + (s * k) / 4); g.lineTo(x0 + s, z0 + (s * k) / 4); g.stroke();
        }
      }
    }
    // lane dashes along every road centreline
    g.fillStyle = '#e8c33a';
    for (let i = -HALF; i <= HALF; i++) {
      const c = toPx(i * PITCH);
      for (let d = -330; d < 330; d += 26) {
        g.fillRect(c - 1.5, toPx(d), 3, 14);
        g.fillRect(toPx(d), c - 1.5, 14, 3);
      }
    }
    // crosswalks at the four central intersections
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const ix of [-74, 0, 74]) {
      for (const iz of [-74, 0, 74]) {
        for (let k = -3; k <= 3; k++) {
          g.fillRect(toPx(ix + k * 4) - 1.5, toPx(iz - 9), 3, 18);
        }
      }
    }
  });
}

// Paint sand for the beach strip.
function sandCanvas() {
  return makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#d9c08a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(120,90,40,0.12)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Paint water with soft moving-looking streaks.
function waterCanvas() {
  return makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#1d6f9e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(Math.random() * w, y);
      g.lineTo(Math.random() * w, y + rand(-4, 4));
      g.stroke();
    }
  });
}

const FACADE_BASES = ['#b5673c', '#7d8a6a', '#8a6f4d', '#5d6b7a', '#a08a5a', '#6e5a6e', '#c2a06a'];

// Build the whole city into the scene. Returns the handles the game needs.
export function buildCity(THREE, scene) {
  const rng = mulberry32(20261119);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  // --- ground ---
  const groundTex = canvasTexture(THREE, groundCanvas(), 1, 1);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- beach + bay ---
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 700),
    new THREE.MeshStandardMaterial({ map: canvasTexture(THREE, sandCanvas(), 4, 24), roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BAY_X + 8, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const waterTex = canvasTexture(THREE, waterCanvas(), 6, 10);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 700),
    new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.12, metalness: 0.35, color: 0x9fd4ee }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(BAY_X + 260, 0.02, 0);
  group.add(water);

  // --- piers ---
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 0.9 });
  const pierTops = [];
  for (const pz of [-120, 0, 120]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(130, 2, 14), pierMat);
    pier.position.set(BAY_X + 70, 1.2, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
    pierTops.push({ x: BAY_X + 70, z: pz });
    for (let k = 0; k < 6; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 5, 6), pierMat);
      post.position.set(BAY_X + 15 + k * 22, -1, pz + 5.5);
      group.add(post);
    }
  }

  // --- buildings ---
  const facadeMats = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(cx, cz, w, d, h, base, isTower) {
    const tex = canvasTexture(THREE, facadeCanvas(rng, base, 0.55), 1, Math.max(1, Math.round(h / 22)));
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0, roughness: 0.85, metalness: 0.05,
    });
    facadeMats.push(mat);
    const b = new THREE.Mesh(boxGeo, mat);
    b.scale.set(w, h, d);
    b.position.set(cx, h / 2, cz);
    b.castShadow = h > 18;
    b.receiveShadow = true;
    group.add(b);
    // roof cap + a rooftop box so the skyline is not flat
    const roof = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 1 }));
    roof.scale.set(w * 0.94, 1.2, d * 0.94);
    roof.position.set(cx, h + 0.6, cz);
    group.add(roof);
    if (h > 30) {
      const ac = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 1 }));
      ac.scale.set(4, 3, 4);
      ac.position.set(cx + w * 0.2, h + 2.4, cz - d * 0.15);
      group.add(ac);
    }
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return b;
  }
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const cx = bx * PITCH + PITCH / 2;
      const cz = bz * PITCH + PITCH / 2;
      if (cx > BAY_X - 40) continue; // the east edge is beach
      const isTowerBlock = bx === 0 && bz === -1;
      if (isTowerBlock) {
        addBuilding(cx, cz, 34, 34, 112, '#7a6a4d', true);
        continue;
      }
      const n = randInt(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rand(18, 30), d = rand(18, 30);
        const h = rand(12, 62);
        const ox = rand(-12, 12), oz = rand(-12, 12);
        addBuilding(cx + ox, cz + oz, w, d, h, pick(FACADE_BASES), false);
      }
    }
  }

  // --- street lamps along the roads ---
  const lampHeads = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.6 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0 });
  for (let i = -HALF; i <= HALF; i++) {
    for (let j = -HALF; j <= HALF; j += 2) {
      const lx = i * PITCH + ROAD_W / 2 + 1.5;
      const lz = j * PITCH;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
      pole.position.set(lx, 3.5, lz);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.5), lampHeadMat);
      head.position.set(lx - 0.8, 7, lz);
      group.add(head);
      lampHeads.push(head);
    }
  }

  // --- traffic lights at four central intersections ---
  const lights = [];
  const lightHeads = [];
  function addTrafficLight(ix, iz) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 6, 6), poleMat);
    pole.position.set(ix + 9, 3, iz + 9);
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7 }));
    head.position.set(ix + 9, 6.4, iz + 9);
    group.add(head);
    const dots = [];
    for (let k = 0; k < 3; k++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, emissiveIntensity: 1 }),
      );
      dot.position.set(ix + 9, 7.3 - k * 0.8, iz + 9.5);
      group.add(dot);
      dots.push(dot);
    }
    lights.push({ dots, timer: rand(0, 6), state: 0 });
    lightHeads.push(head);
  }
  addTrafficLight(-74, -74);
  addTrafficLight(74, -74);
  addTrafficLight(-74, 74);
  addTrafficLight(74, 74);

  // --- palms along the beach and the main avenue, hydrants, benches ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d3a, roughness: 0.9, side: THREE.DoubleSide });
  for (let k = 0; k < 22; k++) {
    const px = k < 10 ? BAY_X - 22 : pick([-222, -148, -74, 0, 74, 148, 222]) + 9;
    const pz = k < 10 ? -260 + k * 58 : rand(-240, 240);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), trunkMat);
    trunk.position.set(px, 4.5, pz);
    trunk.rotation.z = rand(-0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(px + Math.cos(a) * 1.8, 9.4, pz + Math.sin(a) * 1.8);
      frond.rotation.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + Math.PI);
      group.add(frond);
    }
  }
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xc22e2e, roughness: 0.5, metalness: 0.3 });
  for (let k = 0; k < 12; k++) {
    const hx = pick([-222, -148, -74, 0, 74, 148, 222]) + 9;
    const hz = rand(-240, 240);
    const hy = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 8), hydrantMat);
    hy.position.set(hx, 0.55, hz);
    group.add(hy);
  }

  // --- sky dome with a gradient shader, sun, clouds ---
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x3d7bd6) },
    horizonColor: { value: new THREE.Color(0xbfd9ee) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color(0xfff2c0) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(950, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vDir; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir; uniform vec3 sunColor; void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 col = mix(horizonColor, topColor, pow(h, 0.65)); float s = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0); col += sunColor * s * 1.4; float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0); col += sunColor * glow * 0.16; gl_FragColor = vec4(col, 1.0); }',
    }),
  );
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a4238, 0.9);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);

  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, fog: false });
  for (let k = 0; k < 12; k++) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(rand(90, 180), rand(24, 44)), cloudMat);
    cl.position.set(rand(-700, 700), rand(130, 190), rand(-700, 700));
    cl.rotation.x = -Math.PI / 2;
    scene.add(cl);
    clouds.push({ mesh: cl, speed: rand(1.5, 4) });
  }

  // --- per-frame update: sun, sky, fog, lamps, windows, water, lights ---
  let lightClock = 0;
  function update(dt, hours) {
    const dayFrac = (hours - 6) / 12; // 0 at 06:00, 1 at 18:00
    const sunAngle = dayFrac * Math.PI;
    const elev = Math.sin(sunAngle);
    const azim = Math.cos(sunAngle);
    const sunDir = new THREE.Vector3(azim * 0.7, Math.max(elev, -0.25), 0.45).normalize();
    sun.position.copy(sunDir).multiplyScalar(520);
    skyUniforms.sunDir.value.copy(sunDir);
    const isDay = hours >= 6 && hours < 17.5;
    const isDusk = hours >= 17.5 && hours < 20;
    if (isDay) {
      skyUniforms.topColor.value.set(0x2f6fd0);
      skyUniforms.horizonColor.value.set(0xbcd7ef);
      skyUniforms.sunColor.value.set(0xfff2c0);
      sun.intensity = 2.6;
      sun.color.set(0xfff2d8);
      hemi.intensity = 0.9;
      amb.intensity = 0.25;
      scene.fog = new THREE.Fog(0xbcd7ef, 320, 900);
    } else if (isDusk) {
      skyUniforms.topColor.value.set(0x4a3a7a);
      skyUniforms.horizonColor.value.set(0xff8a4d);
      skyUniforms.sunColor.value.set(0xffb36b);
      sun.intensity = 1.5;
      sun.color.set(0xffc07a);
      hemi.intensity = 0.55;
      amb.intensity = 0.2;
      scene.fog = new THREE.Fog(0xd98a5a, 280, 820);
    } else {
      skyUniforms.topColor.value.set(0x060a18);
      skyUniforms.horizonColor.value.set(0x1a2440);
      skyUniforms.sunColor.value.set(0x9fb4ff);
      sun.intensity = 0.35;
      sun.color.set(0x8fa8ff);
      hemi.intensity = 0.4;
      amb.intensity = 0.3;
      scene.fog = new THREE.Fog(0x0d1526, 200, 700);
    }
    const nightGlow = isDay ? 0 : isDusk ? 0.55 : 1.0;
    for (const m of facadeMats) m.emissiveIntensity = nightGlow * 0.85;
    lampHeadMat.emissiveIntensity = nightGlow * 1.6;
    waterTex.offset.x += dt * 0.008;
    waterTex.offset.y += dt * 0.003;
    for (const c of clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 750) c.mesh.position.x = -750;
    }
    lightClock += dt;
    for (const L of lights) {
      L.timer += dt;
      const phase = Math.floor(L.timer / 4) % 3; // 0 green, 1 amber, 2 red
      for (let k = 0; k < 3; k++) {
        const on = (phase === 0 && k === 2) || (phase === 1 && k === 1) || (phase === 2 && k === 0);
        L.dots[k].material.emissive.set(on ? (k === 0 ? 0xff2a22 : k === 1 ? 0xffb020 : 0x22d94a) : 0x000000);
      }
    }
  }

  // Push a circle (x, z, radius r) out of every building AABB it overlaps.
  function resolveCollision(x, z, r) {
    for (const c of colliders) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else if (d2 <= 0.0001) {
        // centre inside the box: shove out along the smallest penetration
        const px = Math.min(x - c.minX, c.maxX - x);
        const pz = Math.min(z - c.minZ, c.maxZ - z);
        if (px < pz) x = x - c.minX < c.maxX - x ? c.minX - r : c.maxX + r;
        else z = z - c.minZ < c.maxZ - z ? c.minZ - r : c.maxZ + r;
      }
    }
    return { x, z };
  }

  function randomStreetPos() {
    const i = randInt(-HALF, HALF);
    const j = randInt(-HALF, HALF);
    return { x: i * PITCH + rand(-6, 6), z: j * PITCH + rand(-6, 6) };
  }

  function lightIsRedAt(ix, iz) {
    const L = lights.find((l) => Math.abs(l.dots[0].position.x - (ix + 9)) < 1 && Math.abs(l.dots[0].position.z - (iz + 9)) < 1);
    if (!L) return false;
    return Math.floor(L.timer / 4) % 3 === 2;
  }

  return {
    update, resolveCollision, randomStreetPos, lightIsRedAt,
    colliders, pierTops,
    towerPos: { x: PITCH / 2, z: -PITCH / 2 }, // the Solmar Tower block (bx 0, bz -1)
    beachPos: { x: BAY_X - 10, z: 0 },
  };
}
