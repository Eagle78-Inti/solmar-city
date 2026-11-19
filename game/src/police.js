// Solmar City — the wanted system: police pursuit, ramming, the 3-second
// bust timer, and the helicopter with its searchlight at 4-5 stars.

import { clamp, lerp, turnToward, dist2d } from './util.js';
import { makeCar } from './vehicles.js';

export function createPolice(THREE, scene, city) {
  const state = { wanted: 0, bustTimer: 0, busted: false };
  const cars = [];
  const pool = [];

  function spawnPoliceCar(x, z) {
    const built = makeCar(THREE, { police: true });
    scene.add(built.group);
    const car = {
      built, x, z, heading: 0, speed: 0, flash: Math.random() * 10,
    };
    cars.push(car);
    return car;
  }

  function wantedCarCount(w) {
    return w <= 0 ? 0 : Math.min(2 + w, 8);
  }

  function setWanted(n, playerPos) {
    const w = clamp(Math.round(n), 0, 5);
    state.wanted = w;
    state.bustTimer = 0;
    const need = wantedCarCount(w);
    while (cars.length < need) {
      const a = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 40;
      const px = playerPos ? playerPos.x + Math.cos(a) * r : 0;
      const pz = playerPos ? playerPos.z + Math.sin(a) * r : 40;
      spawnPoliceCar(clamp(px, -320, 300), clamp(pz, -320, 320));
    }
    while (cars.length > need) {
      const c = cars.pop();
      scene.remove(c.built.group);
    }
    if (w >= 4) ensureHeli(playerPos);
    else if (heli) {
      scene.remove(heli.group);
      scene.remove(heli.cone);
      scene.remove(heli.pool);
      heli = null;
    }
  }

  function update(dt, playerPos, playerSpeed, onBusted) {
    // pursuit: every police car steers at the player and rams
    for (const c of cars) {
      const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      c.heading = turnToward(c.heading, wantHeading, 2.4 * dt);
      const targetSpeed = d > 26 ? 30 : d > 8 ? 24 : 13;
      c.speed = lerp(c.speed, targetSpeed, Math.min(1, dt * 1.6));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      const fixed = city.resolveCollision(c.x, c.z, 2.4);
      c.x = fixed.x;
      c.z = fixed.z;
      c.built.group.position.set(c.x, 0, c.z);
      c.built.group.rotation.y = c.heading;
      for (const w of c.built.wheels) w.rotation.x += (c.speed * dt) / 0.42;
      // flashing light bar
      c.flash += dt * 9;
      const bar = c.built.group.userData.lightBar;
      if (bar) {
        const on = Math.sin(c.flash) > 0;
        bar.red.material.emissiveIntensity = on ? 2.4 : 0.15;
        bar.blue.material.emissiveIntensity = on ? 0.15 : 2.4;
      }
    }
    // bust: player pinned slow with a cop right on them for 3 seconds
    if (state.wanted > 0 && playerSpeed < 1.5) {
      let near = false;
      for (const c of cars) {
        if (dist2d(c.x, c.z, playerPos.x, playerPos.z) < 7) { near = true; break; }
      }
      if (near) {
        state.bustTimer += dt;
        if (state.bustTimer >= 3 && !state.busted) {
          state.busted = true;
          onBusted();
        }
      } else {
        state.bustTimer = 0;
      }
    } else {
      state.bustTimer = 0;
    }
    updateHeli(dt, playerPos);
  }

  // --- helicopter ---
  let heli = null;
  function ensureHeli(playerPos) {
    if (heli) return;
    const g = new THREE.Group();
    // light grey-blue body + a bright red nav light: the heli must read
    // against a black night sky
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6a8aaa, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6.4), bodyMat);
    body.castShadow = true;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 6.5),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
    stripe.position.y = 0.2;
    g.add(stripe);
    const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 3 }));
    navLight.position.set(0, -0.9, -3.2);
    g.add(navLight);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.1, metalness: 0.9 }));
    glass.position.set(0, 0.3, 2.6);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
    tail.position.set(0, 0.3, -5);
    g.add(tail);
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.08, 0.5), rotorMat);
    rotor.position.y = 1.2;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.5), rotorMat);
    tailRotor.position.set(0.5, 0.4, -7);
    g.add(tailRotor);
    // searchlight: a real spotlight plus a visible beam cone and a ground
    // pool — the cone and pool live in the scene (not under the heli) so
    // they can be aimed from the heli straight at the player every frame
    const spot = new THREE.SpotLight(0xfff6cc, 900, 90, 0.42, 0.5, 1.2);
    spot.position.set(0, -0.8, 0);
    g.add(spot);
    g.add(spot.target);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(5.5, 12, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    scene.add(cone);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    scene.add(pool);
    g.scale.setScalar(1.2); // a little bigger so it reads in a still
    scene.add(g);
    heli = { group: g, rotor, tailRotor, spot, cone, pool, angle: 0 };
  }

  function updateHeli(dt, playerPos) {
    if (!heli) return;
    heli.angle += dt * 0.55;
    const hx = playerPos.x + Math.cos(heli.angle) * 22;
    const hz = playerPos.z + Math.sin(heli.angle) * 22;
    heli.group.position.set(hx, 12, hz);
    heli.group.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
    heli.rotor.rotation.y += dt * 22;
    heli.tailRotor.rotation.x += dt * 30;
    // keep the beam locked on the player
    heli.spot.target.position.set(playerPos.x - hx, -11, playerPos.z - hz);
    const dx = playerPos.x - hx, dy = -12, dz = playerPos.z - hz;
    const beamLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    heli.cone.position.set((hx + playerPos.x) / 2, 6, (hz + playerPos.z) / 2);
    heli.cone.lookAt(playerPos.x, 0, playerPos.z);
    heli.cone.rotateX(-Math.PI / 2);
    heli.cone.scale.set(1, beamLen / 12, 1);
    heli.pool.position.set(playerPos.x, 0.15, playerPos.z);
  }

  function setNight(night) {
    for (const c of cars) c.built.setNight(night);
  }

  function clearBusted() {
    state.busted = false;
    state.bustTimer = 0;
  }

  // Drop police cars at exact spots — used to stage a screenshot chase.
  function placeCars(spots, playerPos) {
    setWanted(0, playerPos || { x: 0, z: 0 });
    for (const s of spots) spawnPoliceCar(s.x, s.z);
    state.wanted = Math.max(1, spots.length > 3 ? 4 : spots.length);
    if (state.wanted >= 4) ensureHeli(playerPos || { x: 0, z: 0 });
  }

  // Park the helicopter at a chosen orbit angle — used to stage it in
  // frame for a screenshot (angle -PI/2 puts it ahead of the player).
  function setHeliAngle(a) {
    if (heli) heli.angle = a;
  }

  return { state, cars, setWanted, update, setNight, clearBusted, placeCars, setHeliAngle };
}

// Is the helicopter currently up? (used by the HUD and the shot stager)
export function heliActive(police) {
  return police.state.wanted >= 4;
}

// Drop police cars at exact spots — used to stage a screenshot chase.
export function stagePolice(police, spots, playerPos) {
  police.placeCars(spots, playerPos);
}
