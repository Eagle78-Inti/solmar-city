import * as THREE from 'three';
// Solmar City — the city itself: procedural textures, ground, roads,
// buildings with lit facades, the bay, beach, piers, props and the sky.
// Solmar is a fictional bay city; every name, sign and texture is original.
import { mulberry32, clamp, lerp, bump, pick, canvasTexture, speckle, boxGeo, cylGeo, sphGeo, std, paint } from './util.js';

export const ROAD_XS = [-140, -100, -60, -20, 20, 60, 100, 140, 180];
export const ROAD_ZS = [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180];
export const CITY = { min: -190, max: 190, bayX: -170, beachX: -150 };

// Mission and activity spots, all on or beside roads.
export const SPOTS = {
  start: { x: 140, z: -140 }, bank: { x: 66, z: -14 }, casino: { x: 106, z: 66 },
  garage: { x: -54, z: 106 }, safehouse: { x: -114, z: 146 }, pier: { x: -152, z: 0 },
  tower: { x: 40, z: 40 }, hospital: { x: -134, z: -54 },
};

function asphaltTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e3138'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 900, ['#3a3e46', '#23262c', '#454a53'], 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = rng() * w; ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) { x += (rng() - 0.5) * 10; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // worn centre dashes, drawn along the strip
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(w / 2 - 2, 8, 4, 26); ctx.fillRect(w / 2 - 2, 72, 4, 26);
  }, 1, 6);
}

function concreteTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8d8f8a'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 500, ['#7c7e79', '#9a9c97', '#6f716c'], 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  }, 8, 8);
}

// A building facade: base colour, window grid, a door and roofline detail.
// Returns { map, emissive } — emissive holds only the warm lit windows.
function facadeTextures(rng, base, trim) {
  const cols = 8, rows = 12;
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rng() < 0.55);
  const map = canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 350, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.12)'], 3);
    ctx.fillStyle = trim; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 12, w, 12);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + 5, y = r * ch + 8;
      ctx.fillStyle = lit[r * cols + c] ? '#ffd98a' : '#20242e';
      ctx.fillRect(x, y, cw - 10, ch - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y, cw - 10, 4);
    }
    ctx.fillStyle = '#1c1a17'; ctx.fillRect(w / 2 - 14, h - 46, 28, 34);
  });
  const emissive = canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!lit[r * cols + c]) continue;
      ctx.fillStyle = '#ffbe55';
      ctx.fillRect(c * cw + 5, r * ch + 8, cw - 10, ch - 14);
    }
  });
  return { map, emissive };
}

function waterTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1d5f7a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.12})`;
      ctx.lineWidth = 1 + rng() * 2;
      const y = rng() * h, x = rng() * w, len = 20 + rng() * 60;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
  }, 6, 6);
}

function signTexture(text, bg, fg) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = fg; ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);
  });
}

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const g = new THREE.Group(); scene.add(g);
  const texAsphalt = asphaltTexture(rng);
  const texConcrete = concreteTexture(rng);
  const texWater = waterTexture(rng);

  // Ground: grassy base under everything, sand beach, bay water.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), std('#5d7a4a', 0.95));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-10, 0, 0); ground.receiveShadow = true; g.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(20, 380), std('#d9c48f', 0.95));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-160, 0.05, 0); beach.receiveShadow = true; g.add(beach);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 560), new THREE.MeshStandardMaterial({
    map: texWater, roughness: 0.18, metalness: 0.55, color: '#9fd4e8',
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(-215, 0.12, 0); g.add(water);

  // Roads: asphalt strips both ways, with sidewalks beside them.
  const roadMat = new THREE.MeshStandardMaterial({ map: texAsphalt, roughness: 0.9 });
  const walkMat = new THREE.MeshStandardMaterial({ map: texConcrete, roughness: 0.95 });
  for (const x of ROAD_XS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, 0); r.receiveShadow = true; g.add(r);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3, 400), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x + s * 6.5, 0.1, 0); w.receiveShadow = true; g.add(w);
    }
  }
  for (const z of ROAD_ZS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(400, 10), roadMat.clone());
    r.material.map = texAsphalt.clone(); r.material.map.rotation = Math.PI / 2;
    r.material.map.center.set(0.5, 0.5); r.material.map.needsUpdate = true;
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.08, z); r.receiveShadow = true; g.add(r);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(400, 3), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(0, 0.1, z + s * 6.5); w.receiveShadow = true; g.add(w);
    }
  }

  // Buildings: one to three per block, varied heights and facade colours.
  // The Solmar Tower rises over the middle of the map as the landmark.
  const facadeMats = [];
  const bases = ['#b08d6a', '#7d8a99', '#a89a7e', '#8a6f5c', '#6f7f8c', '#c2a878'];
  for (let i = 0; i < 6; i++) {
    const f = facadeTextures(rng, bases[i], '#3a3f46');
    facadeMats.push(new THREE.MeshStandardMaterial({
      map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color('#ffbe55'),
      emissiveIntensity: 0.12, roughness: 0.85,
    }));
  }
  const roofMat = std('#3c4046', 0.95);
  const buildings = [];
  const towerMat = new THREE.MeshStandardMaterial({
    map: facadeTextures(rng, '#2c3a4a', '#18222e').map, roughness: 0.35, metalness: 0.5,
  });
  for (let ix = 0; ix < ROAD_XS.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_ZS.length - 1; iz++) {
      const x0 = ROAD_XS[ix] + 8, x1 = ROAD_XS[ix + 1] - 8;
      const z0 = ROAD_ZS[iz] + 8, z1 = ROAD_ZS[iz + 1] - 8;
      if (x1 - x0 < 14 || z1 - z0 < 14) continue;
      if (x0 < CITY.beachX + 4) continue; // beach blocks stay open
      const n = 1 + Math.floor(rng() * 2);
      for (let b = 0; b < n; b++) {
        const w = 12 + rng() * 10, d = 12 + rng() * 10;
        const cx = x0 + w / 2 + rng() * Math.max(1, (x1 - x0) - w);
        const cz = z0 + d / 2 + rng() * Math.max(1, (z1 - z0) - d);
        const isTower = Math.abs(cx - SPOTS.tower.x) < 22 && Math.abs(cz - SPOTS.tower.z) < 22;
        const h = isTower ? 108 : 11 + rng() * rng() * 44;
        const m = new THREE.Mesh(boxGeo(w, h, d), isTower ? towerMat : pick(rng, facadeMats));
        m.position.set(cx, h / 2, cz); m.castShadow = true; m.receiveShadow = true; g.add(m);
        const roof = new THREE.Mesh(boxGeo(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(cx, h + 0.4, cz); g.add(roof);
        if (rng() < 0.4) {
          const ac = new THREE.Mesh(boxGeo(2, 1.2, 2), std('#9aa0a6', 0.7, 0.4));
          ac.position.set(cx + w / 4, h + 1.2, cz); g.add(ac);
        }
        buildings.push({ x: cx, z: cz, w, d, h });
      }
    }
  }

  // Neon signs on a few downtown facades.
  const signs = [
    { text: 'CASINO', bg: '#3d0a4e', fg: '#ff5ce1', x: 100, z: 52, y: 26, ry: Math.PI },
    { text: 'SOLMAR', bg: '#062a4a', fg: '#39c6ff', x: 40, z: 18, y: 60, ry: 0 },
    { text: 'PIER 9', bg: '#123a1e', fg: '#7dff9a', x: -148, z: -8, y: 7, ry: Math.PI / 2 },
    { text: 'HOTEL', bg: '#4a2a06', fg: '#ffb347', x: -20, z: 100, y: 22, ry: 0 },
  ];
  const signMats = [];
  for (const s of signs) {
    const m = new THREE.MeshStandardMaterial({
      map: signTexture(s.text, s.bg, s.fg), emissiveMap: signTexture(s.text, s.bg, s.fg),
      emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25, roughness: 0.6,
    });
    signMats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), m);
    mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.ry; g.add(mesh);
  }

  // Street lamps, traffic lights, palms, hydrants and benches.
  const lampHeads = [];
  const poleMat = std('#2f3338', 0.6, 0.6);
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#fff6d8', emissive: new THREE.Color('#ffd98a'), emissiveIntensity: 0.0, roughness: 0.4,
  });
  for (const x of ROAD_XS) for (let z = -160; z <= 180; z += 40) {
    if (rng() < 0.3) continue;
    const px = x + 8.5, pz = z;
    const pole = new THREE.Mesh(cylGeo(0.12, 0.16, 6.5), poleMat);
    pole.position.set(px, 3.25, pz); pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(boxGeo(1.8, 0.12, 0.12), poleMat);
    arm.position.set(px - 0.9, 6.4, pz); g.add(arm);
    const head = new THREE.Mesh(boxGeo(0.9, 0.25, 0.4), lampMat.clone());
    head.position.set(px - 1.7, 6.3, pz); g.add(head);
    lampHeads.push(head.material);
  }
  const lightMats = { red: [], amber: [], green: [] };
  for (const x of ROAD_XS) for (const z of ROAD_ZS) {
    if (Math.abs(x) > 150 || Math.abs(z) > 150) continue;
    if (rng() < 0.5) continue;
    const pole = new THREE.Mesh(cylGeo(0.1, 0.14, 5.5), poleMat);
    pole.position.set(x + 8, 2.75, z + 8); g.add(pole);
    const box = new THREE.Mesh(boxGeo(0.5, 1.4, 0.5), std('#14161a', 0.6));
    box.position.set(x + 8, 5.6, z + 8); g.add(box);
    ['red', 'amber', 'green'].forEach((c, i) => {
      const m = new THREE.MeshStandardMaterial({
        color: '#330000', emissive: new THREE.Color(c === 'red' ? '#ff2a2a' : c === 'amber' ? '#ffb02a' : '#2aff5e'),
        emissiveIntensity: 0.05,
      });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), m);
      dot.position.set(x + 8, 6.05 - i * 0.42, z + 8.3); g.add(dot);
      lightMats[c].push(m);
    });
  }
  const palmTrunk = std('#6d4c2f', 0.95), palmLeaf = std('#2f7a3d', 0.9);
  for (let i = 0; i < 26; i++) {
    const px = -168 + rng() * 14, pz = -170 + rng() * 340;
    const trunk = new THREE.Mesh(cylGeo(0.22, 0.35, 7, 8), palmTrunk);
    trunk.position.set(px, 3.5, pz); trunk.rotation.z = (rng() - 0.5) * 0.25; trunk.castShadow = true; g.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(boxGeo(3.4, 0.08, 0.7), palmLeaf);
      const a = (l / 5) * Math.PI * 2;
      leaf.position.set(px + Math.cos(a) * 1.4, 7 + Math.sin(a * 2) * 0.2, pz + Math.sin(a) * 1.4);
      leaf.rotation.y = -a; leaf.rotation.z = 0.35; g.add(leaf);
    }
  }
  const hydMat = std('#c22a2a', 0.6);
  for (let i = 0; i < 14; i++) {
    const hx = pick(rng, ROAD_XS) + 8.5, hz = -160 + rng() * 320;
    const hy = new THREE.Mesh(cylGeo(0.28, 0.32, 0.9, 8), hydMat);
    hy.position.set(hx, 0.45, hz); g.add(hy);
  }

  // Three wooden piers reaching into the bay, with string lights.
  const pierMat = std('#7a5a38', 0.95);
  for (const pz of [-60, 0, 60]) {
    const deck = new THREE.Mesh(boxGeo(26, 0.5, 8), pierMat);
    deck.position.set(-183, 0.6, pz); deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
    for (let x = -194; x <= -172; x += 5.5) {
      const post = new THREE.Mesh(cylGeo(0.18, 0.18, 1.6, 6), pierMat);
      post.position.set(x, 0.2, pz + 3.6); g.add(post);
    }
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: new THREE.Color('#ffd98a'), emissiveIntensity: 0.1 });
    for (let x = -194; x <= -172; x += 5.5) {
      const bulb = new THREE.Mesh(sphGeo(0.18, 8, 6), bulbMat);
      bulb.position.set(x, 2.6, pz + 3.6); g.add(bulb);
    }
    lampHeads.push(bulbMat);
  }

  // Sky: a gradient dome, a sun disc and drifting clouds.
  const skyUniforms = {
    top: { value: new THREE.Color('#6fa8dc') },
    bottom: { value: new THREE.Color('#cfe8f5') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y / 700.0, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
    }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshBasicMaterial({ color: '#fff3c0', fog: false }));
  scene.add(sunDisc);
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(sphGeo(6 + rng() * 7, 10, 8), cloudMat);
      s.position.set(j * 8 - 8, rng() * 2, rng() * 4 - 2); s.scale.y = 0.42; cl.add(s);
    }
    cl.position.set(-250 + rng() * 500, 95 + rng() * 45, -250 + rng() * 500);
    scene.add(cl); clouds.push(cl);
  }

  // Lights: sun (shadow-casting) + hemisphere + a soft ambient fill.
  const sun = new THREE.DirectionalLight('#fff2d8', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight('#bcd8ff', '#4a4238', 0.75);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight('#ffffff', 0.12));

  const daySky = new THREE.Color('#5f9fd8'), duskSky = new THREE.Color('#e2603a'), nightSky = new THREE.Color('#0a1030');
  const dayHor = new THREE.Color('#cfe8f5'), duskHor = new THREE.Color('#ffb37a'), nightHor = new THREE.Color('#141c38');
  const dayFog = new THREE.Color('#bcd8ea'), duskFog = new THREE.Color('#d98a5f'), nightFog = new THREE.Color('#0d1428');
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function update(dt, dayT, focus) {
    // dayT: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight.
    const ang = dayT * Math.PI * 2;
    const elev = Math.sin(ang);
    const duskF = clamp(bump(dayT, 0.0, 0.13) + bump(dayT, 0.5, 0.13), 0, 1);
    const nightF = clamp(bump(dayT, 0.75, 0.22), 0, 1);
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.6, Math.max(0.06, elev), 0.35).normalize();
    sun.position.copy(focus).addScaledVector(sunDir, 260);
    sun.target.position.copy(focus);
    sun.intensity = lerp(1.7, 0.12, nightF);
    sun.color.setHex(nightF > 0.6 ? 0x8fa8ff : duskF > 0.5 ? 0xffb37a : 0xfff2d8);
    hemi.intensity = lerp(0.8, 0.22, nightF);
    // Sky and fog: day -> dusk -> night, each lerp driven by its own factor.
    tmpA.copy(daySky).lerp(duskSky, duskF); tmpA.lerp(nightSky, nightF);
    tmpB.copy(dayHor).lerp(duskHor, duskF); tmpB.lerp(nightHor, nightF);
    skyUniforms.top.value.copy(tmpA); skyUniforms.bottom.value.copy(tmpB);
    sky.position.copy(focus);
    const fogC = tmpA.clone().lerp(tmpB, 0.5); fogC.lerp(nightFog, nightF * 0.7);
    scene.fog = scene.fog || new THREE.Fog(fogC.getHex(), 120, 520);
    scene.fog.color.copy(fogC);
    sunDisc.position.copy(focus).addScaledVector(sunDir, 620);
    sunDisc.lookAt(focus);
    sunDisc.material.color.setHex(nightF > 0.6 ? 0xdfe8ff : duskF > 0.5 ? 0xff7a3a : 0xfff3c0);
    sunDisc.visible = elev > -0.12;
    for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 280) c.position.x = -280; }
    const winGlow = 0.12 + duskF * 0.7 + nightF * 1.5;
    for (const m of facadeMats) m.emissiveIntensity = winGlow;
    for (const m of signMats) m.emissiveIntensity = 0.25 + nightF * 1.6 + duskF * 0.8;
    const lampGlow = duskF > 0.25 || nightF > 0.25 ? 1.6 : 0.0;
    for (const m of lampHeads) m.emissiveIntensity = lampGlow;
    // Traffic lights cycle on a 12-second loop.
    const phase = (performance.now() / 1000) % 12;
    const on = (c, v) => { for (const m of lightMats[c]) m.emissiveIntensity = v; };
    on('green', phase < 5 ? 1.6 : 0.05); on('amber', phase >= 5 && phase < 7 ? 1.6 : 0.05);
    on('red', phase >= 7 ? 1.6 : 0.05);
    // Wet streets at night: the asphalt turns glossier and picks up the lamps.
    roadMat.roughness = lerp(0.92, 0.5, nightF);
    texWater.offset.x += dt * 0.015; texWater.offset.y += dt * 0.008;
    return { duskF, nightF };
  }

  return {
    group: g, buildings, facadeMats, update,
    isWater: (x) => x < CITY.bayX,
    onRoad: (x, z) => ROAD_XS.some((rx) => Math.abs(x - rx) < 6) || ROAD_ZS.some((rz) => Math.abs(z - rz) < 6),
    nearestRoad: (x, z) => {
      let best = null, bd = 1e9;
      for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { x: rx, z, axis: 'z' }; } }
      for (const rz of ROAD_ZS) { const d = Math.abs(z - rz); if (d < bd) { bd = d; best = { x, z: rz, axis: 'x' }; } }
      return best;
    },
  };
}
