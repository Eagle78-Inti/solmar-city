// Solmar City v4 — the wanted system: police cruisers that chase and ram, a
// bust timer when they corner you, and the helicopter with its searchlight
// that joins the hunt at four stars and above.
import * as THREE from 'three';
import { clamp, lerp, rand, angleLerp, moveToward, dist2 } from './util.js';
import { makeCarMesh } from './vehicles.js';

export function createPolice(scene, hooks) {
  const P = {
    cars: [],
    heli: null,
    heliLight: null,
    beam: null,
    wanted: 0,
    bust: 0,
    flash: 0,
    orbit: 0,
    setWanted(n) {
      P.wanted = clamp(Math.round(n), 0, 5);
      while (P.cars.length < P.wanted) P.spawnOne();
      while (P.cars.length > P.wanted) {
        const c = P.cars.pop();
        scene.remove(c.group);
      }
      if (P.wanted >= 4 && !P.heli) P.spawnHeli();
      if (P.wanted < 4 && P.heli) P.removeHeli();
      hooks.audio.sirenSet(P.wanted > 0);
    },
    addWanted(n) { P.setWanted(P.wanted + n); },
    spawnOne() {
      const mesh = makeCarMesh(0x14161c, { police: true });
      const a = rand(Math.PI * 2);
      const r = rand(30, 48);
      const pp = hooks.playerPos();
      mesh.position.set(clamp(pp.x + Math.cos(a) * r, -145, 145), 0, clamp(pp.z + Math.sin(a) * r, -145, 145));
      scene.add(mesh);
      const car = { group: mesh, heading: rand(Math.PI * 2), speed: 0, hits: 0 };
      mesh.userData.ref = car;
      P.cars.push(car);
    },
    spawnHeli() {
      const g = new THREE.Group();
      const dark = new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.5, metalness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 4.6), dark);
      body.castShadow = true;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), dark);
      tail.position.set(0, 0.3, 3.8);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.4), new THREE.MeshStandardMaterial({ color: 0x0e1622, metalness: 0.9, roughness: 0.1 }));
      glass.position.set(0, 0.1, -1.9);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.08, 0.5), dark);
      rotor.position.y = 0.95;
      const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), dark);
      skidL.position.set(-0.9, -0.85, 0);
      const skidR = skidL.clone(); skidR.position.x = 0.9;
      g.add(body, tail, glass, rotor, skidL, skidR);
      g.userData.rotor = rotor;
      scene.add(g);
      const light = new THREE.SpotLight(0xfff2cc, 900, 130, 0.32, 0.55, 1.2);
      scene.add(light);
      scene.add(light.target);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 3.2, 1, 14, 1, true), beamMat);
      scene.add(beam);
      P.heli = g; P.heliLight = light; P.beam = beam;
    },
    removeHeli() {
      if (!P.heli) return;
      scene.remove(P.heli); scene.remove(P.heliLight); scene.remove(P.beam);
      P.heli = null; P.heliLight = null; P.beam = null;
    },
    update(dt, elapsed) {
      const pp = hooks.playerPos();
      P.flash += dt;
      const redOn = (P.flash * 2.4) % 2 < 1;
      for (const c of P.cars) {
        const dx = pp.x - c.group.position.x, dz = pp.z - c.group.position.z;
        const d = Math.hypot(dx, dz);
        const targetH = Math.atan2(-dx, -dz);
        c.heading = angleLerp(c.heading, targetH, clamp(dt * 1.4, 0, 1));
        c.speed = moveToward(c.speed, 17 + P.wanted * 2.6, 9 * dt);
        c.group.position.x += -Math.sin(c.heading) * c.speed * dt;
        c.group.position.z += -Math.cos(c.heading) * c.speed * dt;
        c.group.rotation.y = c.heading;
        for (const w of c.group.userData.wheels) w.rotation.x += c.speed * dt / 0.38;
        if (c.group.userData.barRed) {
          c.group.userData.barRed.material.emissiveIntensity = redOn ? 2.6 : 0.15;
          c.group.userData.barBlue.material.emissiveIntensity = redOn ? 0.15 : 2.6;
        }
        if (d < 3.2) {
          const push = 9 * dt;
          hooks.onRam(dx / (d || 1), dz / (d || 1), push);
          c.speed *= 0.82;
        }
        if (d < 4.5) P.bust += dt; else P.bust = Math.max(0, P.bust - dt * 2);
      }
      if (P.bust > 3) { P.bust = 0; hooks.onBusted(); }
      if (P.heli) {
        P.orbit += dt * 0.45;
        const hx = pp.x + Math.cos(P.orbit) * 22;
        const hz = pp.z + Math.sin(P.orbit) * 22;
        const hy = 20 + Math.sin(elapsed * 0.8) * 1.5;
        P.heli.position.set(hx, hy, hz);
        P.heli.lookAt(pp.x, 0, pp.z);
        P.heli.userData.rotor.rotation.y += dt * 22;
        P.heliLight.position.set(hx, hy - 0.5, hz);
        P.heliLight.target.position.set(pp.x, 0, pp.z);
        const mx = (hx + pp.x) / 2, my = hy / 2, mz = (hz + pp.z) / 2;
        P.beam.position.set(mx, my, mz);
        const dir = new THREE.Vector3(pp.x - hx, -hy, pp.z - hz).normalize();
        P.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
        P.beam.scale.y = Math.hypot(pp.x - hx, hy, pp.z - hz);
      }
    },
  };
  return P;
}
