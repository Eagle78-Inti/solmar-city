// Solmar City v7 — vehicles: detailed car factory (arches, glass cabin,
// bumpers, grille, mirrors, emissive lights, spinning hubbed wheels, four
// body shapes) plus lane-following traffic that slows for cars ahead.
import * as THREE from 'three';
import { clamp, lerp, rand, randi, pick, angleLerp, angleDiff, dist2 } from './util.js';

const BODY_TYPES = {
  sedan: { len: 4.4, wid: 1.9, hgt: 0.62, cabLen: 2.1, cabH: 0.55, color: 0xc22424 },
  hatch: { len: 3.9, wid: 1.8, hgt: 0.66, cabLen: 2.3, cabH: 0.6, color: 0x2a6ac2 },
  van: { len: 5.0, wid: 2.0, hgt: 0.95, cabLen: 3.6, cabH: 0.8, color: 0xd8d3c8 },
  pickup: { len: 4.8, wid: 1.95, hgt: 0.7, cabLen: 1.7, cabH: 0.62, color: 0x3a7a4a },
};
const PAINTS = [0xc22424, 0x2a6ac2, 0xe8a020, 0x2e2e34, 0xd8d3c8, 0x3a7a4a, 0x7a2a8a, 0x1899a8, 0x8a1f2a, 0x4455aa];

let GEO, MAT;
function shared() {
  if (GEO) return;
  GEO = {
    wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14),
    hub: new THREE.CylinderGeometry(0.18, 0.18, 0.26, 10),
    mirror: new THREE.BoxGeometry(0.16, 0.1, 0.22),
    lightF: new THREE.BoxGeometry(0.42, 0.12, 0.06),
    lightR: new THREE.BoxGeometry(0.42, 0.12, 0.06),
    arch: new THREE.TorusGeometry(0.42, 0.07, 6, 12, Math.PI),
  };
  MAT = {
    tire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1622, roughness: 0.08, metalness: 0.9 }),
    bumper: new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.5, metalness: 0.4 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.35, metalness: 0.8 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xfff2b0, emissiveIntensity: 0.25, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xdd1111, emissiveIntensity: 0.5, roughness: 0.2 }),
  };
}

// Build one car. opts: {type, color, police, taxi}. Returns a group with
// userData {wheels[], headlights, speed, heading...} filled in by callers.
export function makeCar(opts = {}) {
  shared();
  const type = BODY_TYPES[opts.type || 'sedan'];
  const color = opts.color ?? pick(PAINTS);
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.12 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(type.wid, type.hgt, type.len), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.92, 0.34, 0.5), paint);
  nose.position.set(0, 0.42, type.len / 2 - 0.1); nose.castShadow = true; g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.84, type.cabH, type.cabLen), MAT.glass);
  cabin.position.set(0, 0.55 + type.hgt / 2 + type.cabH / 2 - 0.08, type.len * 0.04); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.86, 0.06, type.cabLen * 0.9), paint);
  roof.position.set(0, 0.55 + type.hgt / 2 + type.cabH - 0.05, type.len * 0.04); g.add(roof);
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.96, 0.22, 0.18), MAT.bumper);
  bumpF.position.set(0, 0.3, type.len / 2 + 0.08); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = -type.len / 2 - 0.08; g.add(bumpR);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.5, 0.14, 0.05), MAT.grille);
  grille.position.set(0, 0.5, type.len / 2 + 0.12); g.add(grille);
  for (const s of [-1, 1]) {
    const mir = new THREE.Mesh(GEO.mirror, MAT.bumper);
    mir.position.set(s * (type.wid / 2 + 0.08), 0.92, type.len * 0.18); g.add(mir);
    const hl = new THREE.Mesh(GEO.lightF, MAT.head);
    hl.position.set(s * (type.wid * 0.3), 0.58, type.len / 2 + 0.14); g.add(hl);
    const tl = new THREE.Mesh(GEO.lightR, MAT.tail);
    tl.position.set(s * (type.wid * 0.3), 0.58, -type.len / 2 - 0.14); g.add(tl);
  }
  const wheels = [];
  const wy = 0.34, wz = type.len / 2 - 0.85, wx = type.wid / 2 - 0.05;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const arch = new THREE.Mesh(GEO.arch, MAT.bumper);
    arch.position.set(sx * wx, 0.36, sz * wz); arch.rotation.z = sx > 0 ? 0 : Math.PI; arch.rotation.y = Math.PI / 2; g.add(arch);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(GEO.wheel, MAT.tire); tire.rotation.z = Math.PI / 2; tire.castShadow = true;
    const hub = new THREE.Mesh(GEO.hub, MAT.hub); hub.rotation.z = Math.PI / 2;
    wheel.add(tire); wheel.add(hub);
    wheel.position.set(sx * wx, wy, sz * wz);
    g.add(wheel); wheels.push(wheel);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), MAT.bumper);
    bar.position.set(0, 0.55 + type.hgt / 2 + type.cabH + 0.02, 0); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.32), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.6 }));
    red.position.set(-0.22, 0.55 + type.hgt / 2 + type.cabH + 0.09, 0); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.32), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1.6 }));
    blue.position.set(0.22, 0.55 + type.hgt / 2 + type.cabH + 0.09, 0); g.add(blue);
    g.userData.lightBar = [red, blue];
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 1.1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    door.position.set(type.wid / 2 + 0.01, 0.6, 0); g.add(door);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), new THREE.MeshStandardMaterial({ color: 0xffc800, emissive: 0xffc800, emissiveIntensity: 0.9 }));
    sign.position.set(0, 0.55 + type.hgt / 2 + type.cabH + 0.06, 0); g.add(sign);
  }
  g.userData.wheels = wheels;
  g.userData.headMat = MAT.head;
  g.userData.tailMat = MAT.tail;
  g.userData.type = type;
  g.userData.paint = paint;
  return g;
}

// --- traffic + parked cars ---------------------------------------------------
const ROUTES = [];
function makeRoute(x0, z0, x1, z1) {
  const pts = [];
  for (let x = x0; x <= x1; x += 30) pts.push([x, z0]);
  for (let z = z0; z <= z1; z += 30) pts.push([x1, z]);
  for (let x = x1; x >= x0; x -= 30) pts.push([x, z1]);
  for (let z = z1; z >= z0; z -= 30) pts.push([x0, z]);
  return pts;
}
export function spawnTraffic(G) {
  G.traffic = [];
  ROUTES.length = 0;
  const blocks = [[-240, -240, -60, -60], [-60, -180, 120, 0], [0, 60, 180, 240], [-180, 0, -60, 180], [60, -240, 240, -120], [-240, 120, -120, 240]];
  for (const b of blocks) ROUTES.push(makeRoute(b[0], b[1], b[2], b[3]));
  const types = ['sedan', 'hatch', 'van', 'pickup'];
  for (let i = 0; i < 16; i++) {
    const route = ROUTES[i % ROUTES.length];
    const wp = Math.floor(rand(route.length));
    const group = makeCar({ type: types[i % types.length] });
    group.position.set(route[wp][0] + rand(-2, 2), 0, route[wp][1] + rand(-2, 2));
    G.scene.add(group);
    G.traffic.push({ group, route, wp, speed: rand(8, 12), heading: 0, stopped: 0 });
  }
  G.parked = [];
  const parkSpots = [[-53, -120], [67, -60], [-113, 60], [127, -180], [-173, 120], [187, 0], [-7, 180], [53, 240], [-240, 67], [240, -53]];
  for (const [x, z] of parkSpots) {
    const group = makeCar({ type: pick(types) });
    group.position.set(x, 0, z);
    group.rotation.y = (Math.abs(x) % 2 === 0 ? 0 : Math.PI / 2) + (rand() < 0.5 ? 0 : Math.PI);
    G.scene.add(group);
    G.parked.push({ group, x, z, stolen: false, heading: group.rotation.y });
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    const target = car.route[car.wp];
    const dx = target[0] - car.group.position.x, dz = target[1] - car.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) { car.wp = (car.wp + 1) % car.route.length; continue; }
    const want = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, want, Math.min(1, dt * 2.2));
    let blocked = false;
    for (const o of G.traffic) {
      if (o === car) continue;
      const od = dist2(car.group.position.x, car.group.position.z, o.group.position.x, o.group.position.z);
      if (od < 64) {
        const ahead = (o.group.position.x - car.group.position.x) * Math.sin(car.heading) + (o.group.position.z - car.group.position.z) * Math.cos(car.heading);
        if (ahead > 0 && ahead < 9) { blocked = true; break; }
      }
    }
    const p = G.player;
    if (p && p.car) {
      const pd = dist2(car.group.position.x, car.group.position.z, p.car.group.position.x, p.car.group.position.z);
      if (pd < 64) {
        const ahead = (p.car.group.position.x - car.group.position.x) * Math.sin(car.heading) + (p.car.group.position.z - car.group.position.z) * Math.cos(car.heading);
        if (ahead > 0 && ahead < 9) blocked = true;
      }
    }
    car.speed = lerp(car.speed, blocked ? 0 : 10, Math.min(1, dt * 1.5));
    car.group.position.x += Math.sin(car.heading) * car.speed * dt;
    car.group.position.z += Math.cos(car.heading) * car.speed * dt;
    car.group.rotation.y = car.heading;
    for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt / 0.34;
  }
}
