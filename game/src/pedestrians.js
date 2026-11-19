// Solmar City — pedestrians: ~26 walkers on the sidewalks who scatter
// when they hear a gunshot or a car comes at them fast.

import { clamp, rand, randInt, pick, turnToward, dist2d } from './util.js';

const SHIRTS = [0xd84a4a, 0x4a7dd8, 0x4ad87a, 0xd8c84a, 0x8a4ad8, 0xe8e8e8, 0x333333, 0xd88a4a];

export function makePed(THREE, shirt) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick([0xc98e6a, 0x8a5a3a, 0xe8b890, 0x6a4a2a]), roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: pick([0x2b2e33, 0x3a3a4a, 0x5a4a3a]), roughness: 0.95 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.34), skin);
  head.position.y = 1.62;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legL.geometry.translate(0, -0.35, 0);
  legL.position.set(-0.16, 0.7, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legR.geometry.translate(0, -0.35, 0);
  legR.position.set(0.16, 0.7, 0);
  g.add(legR);
  return { group: g, legL, legR };
}

export function createPedestrians(THREE, scene, city, count) {
  const list = [];
  for (let k = 0; k < count; k++) {
    const built = makePed(THREE, pick(SHIRTS));
    scene.add(built.group);
    const p = city.randomStreetPos();
    const ped = {
      built, x: p.x, z: p.z, heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.2), tx: p.x, tz: p.z,
      flee: 0, fleeX: 0, fleeZ: 0, phase: rand(0, 6), down: false, downT: 0,
    };
    list.push(ped);
    built.group.position.set(ped.x, 0, ped.z);
  }

  function update(dt, threats) {
    for (const ped of list) {
      if (ped.down) {
        ped.downT += dt;
        if (ped.downT > 6) {
          ped.down = false;
          ped.downT = 0;
          ped.built.group.rotation.x = 0;
          ped.built.group.position.y = 0;
        }
        continue;
      }
      // flee a gunshot or a fast car nearby
      if (threats) {
        for (const t of threats) {
          const d = dist2d(ped.x, ped.z, t.x, t.z);
          if (d < 16) {
            ped.flee = 3;
            ped.fleeX = ped.x - t.x;
            ped.fleeZ = ped.z - t.z;
          }
        }
      }
      let tx, tz, speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const fl = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
        tx = ped.x + (ped.fleeX / fl) * 10;
        tz = ped.z + (ped.fleeZ / fl) * 10;
        speed = 6.5;
      } else {
        tx = ped.tx;
        tz = ped.tz;
        speed = ped.speed;
        if (dist2d(ped.x, ped.z, tx, tz) < 3) {
          const np = city.randomStreetPos();
          ped.tx = np.x;
          ped.tz = np.z;
        }
      }
      const wantHeading = Math.atan2(tx - ped.x, tz - ped.z);
      ped.heading = turnToward(ped.heading, wantHeading, 6 * dt);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.x = clamp(ped.x, -330, 250);
      ped.z = clamp(ped.z, -330, 330);
      ped.phase += dt * (ped.flee > 0 ? 12 : 7);
      // keep walkers on the sidewalks: nudge them off the road centreline
      const onRoadX = Math.abs(((ped.x + 8) % 74 + 74) % 74 - 8) < 6;
      const onRoadZ = Math.abs(((ped.z + 8) % 74 + 74) % 74 - 8) < 6;
      if (onRoadX && onRoadZ) {
        ped.tx = ped.x + (ped.x >= 0 ? 12 : -12);
        ped.tz = ped.z + (ped.z >= 0 ? 12 : -12);
      }
      ped.built.group.position.set(ped.x, 0, ped.z);
      ped.built.group.rotation.y = ped.heading;
      ped.built.legL.rotation.x = Math.sin(ped.phase) * 0.5;
      ped.built.legR.rotation.x = -Math.sin(ped.phase) * 0.5;
    }
  }

  // Knock a pedestrian down (combat). Returns the ped, or null.
  function knockDown(x, z, range) {
    let best = null, bestD = range;
    for (const ped of list) {
      if (ped.down) continue;
      const d = dist2d(ped.x, ped.z, x, z);
      if (d < bestD) { best = ped; bestD = d; }
    }
    if (best) {
      best.down = true;
      best.downT = 0;
      best.built.group.rotation.x = -Math.PI / 2;
      best.built.group.position.y = 0.25;
    }
    return best;
  }

  function countStanding() {
    return list.filter((p) => !p.down).length;
  }

  return { list, update, knockDown, countStanding };
}

// Move a few standing pedestrians near a point — used to stage a shot so
// the street reads as alive in frame.
export function scatterNear(peds, x, z, n) {
  let placed = 0;
  for (const ped of peds.list) {
    if (placed >= n || ped.down) continue;
    ped.x = x + rand(-3, 3);
    ped.z = z + rand(-2.5, 2.5);
    ped.tx = ped.x + rand(-20, 20);
    ped.tz = ped.z + rand(-20, 20);
    ped.built.group.position.set(ped.x, 0, ped.z);
    placed++;
  }
  return placed;
}
