// Solmar City — combat: a hitscan pistol, police return fire at 2+ stars,
// health, and getting dropped.

import { dist2d, angleDiff } from './util.js';

export function createCombat(THREE, scene, G, hooks) {
  // hooks: { onShot(), onHitPed(), onPlayerHit(), onDeath(), addWanted(n) }
  const tracers = [];
  let fireTimer = 0;
  let lastDamage = -99;
  let time = 0;

  function spawnTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.14 });
  }

  // Fire the pistol along a heading from a position. Hits the nearest
  // pedestrian roughly in the line of fire, out to 45 units.
  function shoot(fromPos, heading, peds, policeCars) {
    hooks.onShot();
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let best = null, bestD = 45;
    for (const ped of peds.list) {
      if (ped.down) continue;
      const dx = ped.x - fromPos.x, dz = ped.z - fromPos.z;
      const d = Math.hypot(dx, dz);
      if (d > 45 || d < 0.5) continue;
      const ang = Math.abs(angleDiff(heading, Math.atan2(dx, dz)));
      if (ang < 0.14 && d < bestD) { best = ped; bestD = d; }
    }
    const end = best
      ? { x: best.x, y: 1.2, z: best.z }
      : { x: fromPos.x + fx * 45, y: 1.2, z: fromPos.z + fz * 45 };
    spawnTracer({ x: fromPos.x, y: 1.4, z: fromPos.z }, end, 0xffe9a0);
    if (best) {
      peds.knockDown(best.x, best.z, 2);
      hooks.onHitPed();
      hooks.addWanted(1);
      return true;
    }
    // a shot near a cop is still a crime — and so is shooting a police car
    for (const c of policeCars) {
      if (dist2d(fromPos.x, fromPos.z, c.x, c.z) < 30) {
        hooks.addWanted(1);
        break;
      }
    }
    return false;
  }

  function update(dt, playerPos, policeCars) {
    time += dt;
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.14) * 0.9;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        tracers.splice(i, 1);
      }
    }
    // police return fire at 2+ stars
    if (G.wanted >= 2 && policeCars.length > 0) {
      fireTimer -= dt;
      if (fireTimer <= 0) {
        fireTimer = 1.1 + Math.random() * 0.5;
        const near = policeCars.filter((c) => dist2d(c.x, c.z, playerPos.x, playerPos.z) < 42);
        if (near.length > 0) {
          const c = near[Math.floor(Math.random() * near.length)];
          spawnTracer({ x: c.x, y: 1.4, z: c.z }, { x: playerPos.x, y: 1.3, z: playerPos.z }, 0xff5040);
          damage(6);
        }
      }
    }
    // slow health regen once the shooting stops
    if (time - lastDamage > 5 && G.health < 100) {
      G.health = Math.min(100, G.health + 2.5 * dt);
    }
  }

  function damage(n) {
    G.health -= n;
    lastDamage = time;
    hooks.onPlayerHit();
    if (G.health <= 0) {
      G.health = 0;
      hooks.onDeath();
    }
  }

  return { shoot, update, damage };
}

// True while cops are actively shooting at the player — the HUD uses it to
// pulse the health bar.
export function inFirefight(G, policeCars, playerPos) {
  if (G.wanted < 2) return false;
  return policeCars.some((c) => dist2d(c.x, c.z, playerPos.x, playerPos.z) < 42);
}
