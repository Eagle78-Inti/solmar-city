// Solmar City v7 — combat: hitscan pistol, muzzle flash, police return
// fire at 2+ stars, and the health/bust consequences of a firefight.
import * as THREE from 'three';
import { clamp, rand, dist2 } from './util.js';
import { scarePeds } from './pedestrians.js';

export function shoot(G) {
  const p = G.player;
  if (G.shootCooldown > 0 || p.health <= 0) return;
  G.shootCooldown = 0.28;
  G.lastShot = { x: p.pos.x, z: p.pos.z };
  G.audio.shot();
  scarePeds(G, p.pos.x, p.pos.z);
  // muzzle flash
  const flash = new THREE.PointLight(0xffe9a0, 60, 12, 1.8);
  flash.position.set(p.pos.x + Math.sin(p.heading) * 1.2, 1.4, p.pos.z + Math.cos(p.heading) * 1.2);
  G.scene.add(flash);
  G.flashes.push({ light: flash, t: 0.07 });
  // hitscan: nearest ped or police in the aim cone
  const aimX = Math.sin(p.heading), aimZ = Math.cos(p.heading);
  let best = null, bestD = 55 * 55, bestKind = null;
  for (const ped of G.peds) {
    const dx = ped.group.position.x - p.pos.x, dz = ped.group.position.z - p.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      const dot = (dx * aimX + dz * aimZ) / Math.max(1, Math.sqrt(d2));
      if (dot > 0.86) { bestD = d2; best = ped; bestKind = 'ped'; }
    }
  }
  for (const c of G.police) {
    const dx = c.group.position.x - p.pos.x, dz = c.group.position.z - p.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      const dot = (dx * aimX + dz * aimZ) / Math.max(1, Math.sqrt(d2));
      if (dot > 0.86) { bestD = d2; best = c; bestKind = 'cop'; }
    }
  }
  if (best) {
    if (bestKind === 'ped') {
      G.scene.remove(best.group);
      G.peds.splice(G.peds.indexOf(best), 1);
      G.toast('Pedestrian down — the heat is on');
    } else {
      G.scene.remove(best.group);
      G.police.splice(G.police.indexOf(best), 1);
      G.toast('Police cruiser disabled');
    }
    if (G.wanted < 5) G.wanted = Math.min(5, G.wanted + 1);
  } else if (G.wanted < 2) {
    G.wanted = Math.min(5, G.wanted + 1);
  }
  G.audio.echo();
}

export function updateCombat(G, dt) {
  G.shootCooldown = Math.max(0, (G.shootCooldown || 0) - dt);
  for (let i = G.flashes.length - 1; i >= 0; i--) {
    const f = G.flashes[i];
    f.t -= dt;
    if (f.t <= 0) { G.scene.remove(f.light); G.flashes.splice(i, 1); }
  }
  // police return fire at 2+ stars
  const p = G.player;
  if (G.wanted >= 2 && p.health > 0) {
    G.fireTimer = (G.fireTimer || 0) - dt;
    if (G.fireTimer <= 0) {
      G.fireTimer = rand(0.9, 1.6);
      let near = null, nd = 40 * 40;
      for (const c of G.police) {
        const d = dist2(c.group.position.x, c.group.position.z, p.pos.x, p.pos.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (near && Math.random() < 0.42) {
        p.health = Math.max(0, p.health - rand(6, 12));
        G.audio.incoming();
        G.toast('You are taking fire!');
        if (p.health <= 0) {
          p.cash = Math.max(0, p.cash - 150);
          p.health = 100;
          p.pos.set(-240, 0, 240); p.heading = Math.PI / 2;
          if (p.car) { p.car = null; p.mesh.visible = true; }
          p.mesh.position.copy(p.pos);
          G.wanted = 0;
          G.toast('Wasted — $150 hospital bill, back at the safehouse');
          G.save();
        }
      }
    }
  }
  if (p.health < 100) p.health = Math.min(100, p.health + dt * 1.2);
}

// Damage the player directly (used by police rams that land hard).
export function damagePlayer(G, amount) {
  const p = G.player;
  p.health = Math.max(0, p.health - amount);
  G.audio.incoming();
  if (p.health <= 0) {
    p.cash = Math.max(0, p.cash - 150);
    p.health = 100;
    p.pos.set(-240, 0, 240); p.heading = Math.PI / 2;
    if (p.car) { p.car = null; p.mesh.visible = true; }
    p.mesh.position.copy(p.pos);
    G.wanted = 0;
    G.toast('Wasted — $150 hospital bill, back at the safehouse');
    G.save();
  }
}

// A warning shot in the air: scares peds without hurting anyone.
export function warningShot(G) {
  G.lastShot = { x: G.player.pos.x, z: G.player.pos.z };
  G.audio.shot();
  scarePeds(G, G.player.pos.x, G.player.pos.z, 30);
}
