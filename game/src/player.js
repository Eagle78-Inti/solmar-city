// Solmar City — Rook on foot: an articulated character, WASD movement
// relative to the camera, sprint, and getting in and out of cars.

import { clamp, lerp, turnToward, dist2d } from './util.js';

// Build Rook from primitives: jacket torso, head, swinging limbs.
export function makeRook(THREE) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x274b7a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  // open jacket front + shirt
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.9 }));
  shirt.position.set(0, 1.15, 0.21);
  g.add(shirt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.4), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 }));
  hair.position.y = 2.08;
  g.add(hair);

  function limb(mat, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  }
  const armL = limb(jacket, 0.2, 0.75, 0.2);
  armL.geometry.translate(0, -0.32, 0);
  armL.position.set(-0.48, 1.5, 0);
  g.add(armL);
  const armR = limb(jacket, 0.2, 0.75, 0.2);
  armR.geometry.translate(0, -0.32, 0);
  armR.position.set(0.48, 1.5, 0);
  g.add(armR);
  const legL = limb(pants, 0.26, 0.8, 0.26);
  legL.geometry.translate(0, -0.4, 0);
  legL.position.set(-0.19, 0.8, 0);
  g.add(legL);
  const legR = limb(pants, 0.26, 0.8, 0.26);
  legR.geometry.translate(0, -0.4, 0);
  legR.position.set(0.19, 0.8, 0);
  g.add(legR);
  const shoeL = limb(shoes, 0.28, 0.12, 0.44);
  shoeL.position.set(-0.19, 0.06, 0.06);
  g.add(shoeL);
  const shoeR = limb(shoes, 0.28, 0.12, 0.44);
  shoeR.position.set(0.19, 0.06, 0.06);
  g.add(shoeR);
  return { group: g, armL, armR, legL, legR, shoeL, shoeR };
}

export function createPlayer(THREE, scene, city) {
  const rook = makeRook(THREE);
  scene.add(rook.group);
  const state = {
    x: 0, z: 46, heading: 0, onFoot: true, walkPhase: 0, speed: 0,
    group: rook.group,
  };

  function update(dt, input, camHeading, ctx) {
    if (!state.onFoot) return;
    // WASD relative to the camera
    let fx = 0, fz = 0;
    const fwdX = Math.sin(camHeading), fwdZ = Math.cos(camHeading);
    const rightX = Math.cos(camHeading), rightZ = -Math.sin(camHeading);
    if (input.up) { fx += fwdX; fz += fwdZ; }
    if (input.down) { fx -= fwdX; fz -= fwdZ; }
    if (input.left) { fx -= rightX; fz -= rightZ; }
    if (input.right) { fx += rightX; fz += rightZ; }
    const len = Math.hypot(fx, fz);
    const sprint = input.sprint ? 9.5 : 5.2;
    if (len > 0.01) {
      fx /= len; fz /= len;
      state.x += fx * sprint * dt;
      state.z += fz * sprint * dt;
      state.heading = turnToward(state.heading, Math.atan2(fx, fz), 10 * dt);
      state.speed = sprint;
      state.walkPhase += dt * (input.sprint ? 13 : 9);
    } else {
      state.speed = 0;
      state.walkPhase += dt * 1.5;
    }
    const fixed = city.resolveCollision(state.x, state.z, 0.6);
    state.x = fixed.x;
    state.z = fixed.z;
    // stay inside the playable map: west edge, the waterline, north/south edges
    state.x = clamp(state.x, -340, 285);
    state.z = clamp(state.z, -340, 340);
    rook.group.position.set(state.x, 0, state.z);
    rook.group.rotation.y = state.heading;
    // walk cycle: legs and arms swing opposite, idle is a gentle sway
    const amp = state.speed > 0.1 ? 0.55 : 0.04;
    const ph = state.walkPhase;
    rook.legL.rotation.x = Math.sin(ph) * amp;
    rook.legR.rotation.x = -Math.sin(ph) * amp;
    rook.armL.rotation.x = -Math.sin(ph) * amp * 0.8;
    rook.armR.rotation.x = Math.sin(ph) * amp * 0.8;
    rook.shoeL.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * amp * 0.5;
    rook.shoeR.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * amp * 0.5;
  }

  // E near a car: get in (stealing a parked car raises the wanted level).
  // E while driving: get out beside the car.
  function tryEnterCar(parked, playerCar, addWanted) {
    if (state.onFoot) {
      let best = null, bestD = 4.2;
      for (const p of parked.list) {
        if (p.taken) continue;
        const d = dist2d(state.x, state.z, p.x, p.z);
        if (d < bestD) { best = p; bestD = d; }
      }
      if (best) {
        best.taken = true;
        best.built.group.visible = false;
        state.onFoot = false;
        rook.group.visible = false;
        playerCar.state.x = best.x;
        playerCar.state.z = best.z;
        playerCar.state.heading = best.heading;
        playerCar.state.speed = 0;
        addWanted(1);
        return 'stole';
      }
      // re-enter the player's own car
      const d = dist2d(state.x, state.z, playerCar.state.x, playerCar.state.z);
      if (d < 6.5) {
        state.onFoot = false;
        rook.group.visible = false;
        return 'entered';
      }
      return null;
    }
    // exit the car
    state.onFoot = true;
    rook.group.visible = true;
    state.x = playerCar.state.x + Math.sin(playerCar.state.heading + Math.PI / 2) * 2.6;
    state.z = playerCar.state.z + Math.cos(playerCar.state.heading + Math.PI / 2) * 2.6;
    rook.group.position.set(state.x, 0, state.z);
    return 'exited';
  }

  return { state, update, tryEnterCar, group: rook.group };
}

// Place Rook at a spot on foot (used by mission starts and debug staging).
export function placeOnFoot(player, x, z, heading) {
  player.state.onFoot = true;
  player.group.visible = true;
  player.state.x = x;
  player.state.z = z;
  player.state.heading = heading ?? 0;
  player.state.speed = 0;
  player.group.position.set(x, 0, z);
  player.group.rotation.y = player.state.heading;
}
