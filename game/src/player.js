// Solmar City v4 — Rook, the player on foot: an articulated character with a
// jacket, walk cycle and camera-relative WASD movement with sprint.
import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './util.js';

export function makeRookMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2e7f7a, roughness: 0.75 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), pants);
  legL.position.set(-0.14, 0.26, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), pants);
  legR.position.set(0.14, 0.26, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), jacket);
  torso.position.y = 0.84; torso.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), jacket);
  armL.position.set(-0.41, 0.82, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), jacket);
  armR.position.set(0.41, 0.82, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skin);
  head.position.y = 1.34; head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), hair);
  cap.scale.set(1, 0.62, 1); cap.position.y = 1.44;
  group.add(legL, legR, torso, armL, armR, head, cap);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(scene) {
  const group = makeRookMesh();
  group.position.set(-100, 0, -80);
  scene.add(group);
  const p = {
    group,
    pos: group.position,
    heading: 0,
    speed: 0,
    walkPhase: 0,
    update(dt, keys, camYaw) {
      let ix = 0, iz = 0;
      if (keys.KeyW) iz += 1;
      if (keys.KeyS) iz -= 1;
      if (keys.KeyA) ix -= 1;
      if (keys.KeyD) ix += 1;
      const moving = ix !== 0 || iz !== 0;
      const sprint = keys.ShiftLeft || keys.ShiftRight;
      const target = moving ? (sprint ? 7.5 : 4.4) : 0;
      p.speed = lerp(p.speed, target, clamp(dt * 8, 0, 1));
      if (moving) {
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
        const rx = -fz, rz = fx;
        let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        p.heading = Math.atan2(-mx, -mz);
        p.pos.x += mx * p.speed * dt;
        p.pos.z += mz * p.speed * dt;
        p.pos.x = clamp(p.pos.x, -158, 158);
        p.pos.z = clamp(p.pos.z, -158, 158);
        p.walkPhase += dt * p.speed * 1.6;
      }
      const sw = Math.sin(p.walkPhase) * clamp(p.speed / 4.4, 0, 1) * 0.55;
      group.userData.legL.rotation.x = sw;
      group.userData.legR.rotation.x = -sw;
      group.userData.armL.rotation.x = -sw * 0.7;
      group.userData.armR.rotation.x = sw * 0.7;
      group.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.05 * clamp(p.speed / 4.4, 0, 1);
      group.rotation.y = p.heading;
    },
  };
  return p;
}

export function teleportPlayer(p, x, z, heading = 0) {
  p.pos.set(x, 0, z);
  p.heading = heading;
  p.speed = 0;
  p.group.position.set(x, 0, z);
  p.group.rotation.y = heading;
}
