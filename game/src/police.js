// Solmar City — the law: a wanted level from 0 to 5 stars, police cruisers
// that pursue and ram, a bust timer when they corner you, and a helicopter
// with a sweeping searchlight once the heat gets serious.
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, pick, angleLerp, wrapAngle, dist2, boxGeo, cylGeo, stdMat, glowSprite } from './util.js';
import { ROADS } from './city.js';
import { Car } from './vehicles.js';

function buildHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = stdMat({ color: 0x1c2a44, roughness: 0.4, metalness: 0.5 });
  const glass = stdMat({ color: 0x0e1418, roughness: 0.1, metalness: 0.9 });
  const body = new THREE.Mesh(boxGeo(4.2, 1.5, 2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(boxGeo(1.4, 1.1, 1.7), glass);
  nose.position.set(2.4, -0.1, 0);
  g.add(nose);
  const boom = new THREE.Mesh(boxGeo(4.6, 0.5, 0.5), bodyMat);
  boom.position.set(-4, 0.3, 0);
  g.add(boom);
  const fin = new THREE.Mesh(boxGeo(0.3, 1.2, 0.1), bodyMat);
  fin.position.set(-6.2, 0.8, 0);
  g.add(fin);
  const mast = new THREE.Mesh(cylGeo(0.12, 0.12, 0.8, 6), stdMat({ color: 0x222222, roughness: 0.5, metalness: 0.6 }));
  mast.position.y = 1.1;
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.55;
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(boxGeo(11, 0.08, 0.5), stdMat({ color: 0x111111, roughness: 0.5 }));
    blade.rotation.y = a;
    rotor.add(blade);
  }
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-6.3, 0.7, 0.35);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(boxGeo(0.12, 1.8, 0.08), stdMat({ color: 0x111111, roughness: 0.5 }));
    blade.rotation.z = a;
    tailRotor.add(blade);
  }
  g.add(tailRotor);
  for (const s of [1, -1]) {
    const skid = new THREE.Mesh(boxGeo(3.4, 0.1, 0.14), stdMat({ color: 0x333333, roughness: 0.5, metalness: 0.6 }));
    skid.position.set(0.2, -1.05, s * 0.8);
    g.add(skid);
  }
  // The searchlight: a real spotlight. Its target and the visible cone are
  // scene-level objects (set up by Police), because the heli's own rotation
  // would corrupt their world-space aim if they were children of the group.
  const spot = new THREE.SpotLight(0xfff2c8, 0, 90, 0.32, 0.5, 1);
  spot.position.set(0, -0.8, 0);
  g.add(spot);
  const lampGlow = glowSprite('#fff2c8', 6, 0.9);
  lampGlow.position.set(0, -0.9, 0);
  g.add(lampGlow);
  g.userData = { rotor, tailRotor, spot, lampGlow };
  return g;
}

export function buildHeliCone() {
  // A soft beam: low opacity and one-sided, so looking up the beam does not
  // wash the whole street white (the old 0.16 DoubleSide cone filled the
  // frame with a white wedge whenever the heli was behind the camera).
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 42, 16, 1, true), mat);
  cone.visible = false;
  return cone;
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.heli = null;
    this.heliAngle = 0;
    this.heliRadius = 26; // circle radius around the player
    this.heliHeight = 42; // altitude; staging may lower it so it reads in frame
    this.bustT = 0;
    this.unseenT = 0;
    this.decayT = 0;
    this.shootT = 0;
    this.onBusted = null;
    this.onShot = null;
  }
  addWanted(n) { this.setWanted(this.wanted + n); }
  setWanted(n) {
    const next = clamp(Math.round(n), 0, 5);
    if (next !== this.wanted) {
      this.wanted = next;
      this.unseenT = 0;
      this.decayT = 0;
    }
  }
  clear() {
    this.setWanted(0);
    this.bustT = 0;
    for (const c of this.cars) { this.scene.remove(c.mesh); }
    this.cars = [];
    this.removeHeli();
  }
  removeHeli() {
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heliCone) { this.scene.remove(this.heliCone); this.heliCone = null; }
    if (this.heliSpotTarget) { this.scene.remove(this.heliSpotTarget); this.heliSpotTarget = null; }
  }
  spawnCarNear(playerPos) {
    // Spawn on a road 55-95 m from the player, ideally out of direct sight.
    for (let tries = 0; tries < 12; tries++) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const line = pick(ROADS);
      const along = rand(-176, 176);
      const x = axis === 'x' ? along : line;
      const z = axis === 'x' ? line : along;
      const d = dist2(x, z, playerPos.x, playerPos.z);
      if (d > 55 && d < 110) {
        const car = new Car(this.scene, { color: 0xf0f0ee, type: 'police', x, z, heading: rand(0, Math.PI * 2) });
        this.cars.push(car);
        return car;
      }
    }
    const car = new Car(this.scene, { color: 0xf0f0ee, type: 'police', x: playerPos.x + 70, z: playerPos.z + 20, heading: 0 });
    this.cars.push(car);
    return car;
  }
  ensureHeli() {
    if (this.heli || this.wanted < 4) return;
    this.heli = buildHeliMesh();
    this.scene.add(this.heli);
    this.heliCone = buildHeliCone();
    this.scene.add(this.heliCone);
    this.heliSpotTarget = new THREE.Object3D();
    this.scene.add(this.heliSpotTarget);
    this.heli.userData.spot.target = this.heliSpotTarget;
    this.heliAngle = rand(0, Math.PI * 2);
  }

  update(dt, player, others) {
    const wantCount = [0, 2, 3, 4, 5, 6][this.wanted];
    // Spawn or retire cruisers to match the wanted level.
    while (this.cars.length < wantCount) this.spawnCarNear(player.pos);
    while (this.cars.length > wantCount) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    if (this.wanted >= 4) this.ensureHeli();
    else this.removeHeli();

    let nearest = Infinity;
    const playerSpeed = player.onFoot ? player.speed : Math.abs(player.car ? player.car.speed : 0);
    for (const c of this.cars) {
      const dx = player.pos.x - c.pos.x;
      const dz = player.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      nearest = Math.min(nearest, d);
      // Pursuit steering: aim at the player, throttle hard, brake to ram.
      const wantHeading = Math.atan2(dx, dz);
      const diff = wrapAngle(wantHeading - c.heading);
      const steer = clamp(diff * 1.6, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      c.drive({ throttle, steer, handbrake: false }, dt, this.city, null);
      // Ram: shove the player's car when contact happens.
      if (d < 4.6 && player.car) {
        const push = 9 * dt;
        player.car.pos.x += (dx / (d || 1)) * -push * -1;
        player.car.pos.z += (dz / (d || 1)) * -push * -1;
        player.car.speed *= 0.92;
        player.shake = Math.min(player.shake + 0.3, 1);
      }
      if (d < 4.6 && player.onFoot) {
        player.damage(6 * dt);
      }
      c.setLights(1);
      c.updateVisual(dt);
    }
    // Bust: a cruiser sits on you while you are slow for 3 seconds.
    if (this.wanted > 0 && nearest < 5.5 && playerSpeed < 3) {
      this.bustT += dt;
      if (this.bustT >= 3 && this.onBusted) {
        this.onBusted();
        this.bustT = 0;
      }
    } else {
      this.bustT = Math.max(0, this.bustT - dt * 2);
    }
    // Wanted decay: stay out of sight and the heat cools off.
    if (nearest > 45) this.unseenT += dt;
    else this.unseenT = 0;
    if (this.wanted > 0 && this.unseenT > 9 && !this.heli) {
      this.decayT += dt;
      if (this.decayT > 9) {
        this.setWanted(this.wanted - 1);
        this.decayT = 0;
        this.unseenT = 0;
      }
    }
    // Police return fire at 2+ stars when close.
    if (this.wanted >= 2) {
      this.shootT -= dt;
      if (this.shootT <= 0 && nearest < 34 && this.onShot) {
        this.shootT = rand(0.9, 1.6);
        if (Math.random() < 0.55) this.onShot(rand(3, 7));
      }
    }
    // Helicopter: circle overhead, beam sweeping the player, keeping the
    // heat alive while it is up.
    if (this.heli) {
      this.heliAngle += dt * 0.35;
      const hx = player.pos.x + Math.cos(this.heliAngle) * this.heliRadius;
      const hz = player.pos.z + Math.sin(this.heliAngle) * this.heliRadius;
      this.heli.position.set(hx, this.heliHeight + Math.sin(this.heliAngle * 2.3) * 2, hz);
      this.heli.lookAt(player.pos.x, 0, player.pos.z);
      const u = this.heli.userData;
      u.rotor.rotation.y += dt * 22;
      u.tailRotor.rotation.x += dt * 30;
      // The searchlight is strong enough to read by, but not so strong it
      // blows the whole street white: 1600 washed out every night shot, and
      // 450 still did (at 42 m up, decay 1, that is ~4x the sun). 120 is a
      // strong beam that leaves the buildings readable.
      u.spot.intensity = 120;
      this.heliSpotTarget.position.set(player.pos.x, 0, player.pos.z);
      // The visible cone stretches from the heli to the ground at the player:
      // apex (cone +Y) points up at the heli, wide end down at the street.
      const ground = new THREE.Vector3(player.pos.x, 0, player.pos.z);
      const mid = this.heli.position.clone().add(ground).multiplyScalar(0.5);
      this.heliCone.position.copy(mid);
      const up = new THREE.Vector3(0, 1, 0);
      const toHeli = this.heli.position.clone().sub(ground).normalize();
      this.heliCone.quaternion.setFromUnitVectors(up, toHeli);
      this.heliCone.visible = true;
      this.unseenT = 0;
    }
  }
}
