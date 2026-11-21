// main.ts — Solmar City dossier builder (make.fun gta6-01 kit entrypoint).
// Run with Node 22 from the repo root: `node main.ts`.
// Writes dossier.json deterministically: two runs produce identical bytes.
// Only Node stdlib is used; the game itself never touches the network.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dossier.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function walk(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.join(base, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else if (st.isFile()) out.push(rel);
  }
  return out;
}

function build() {
  const gameFiles = walk(path.join(ROOT, 'game'), 'game').sort();
  const files = [];
  for (const rel of gameFiles) {
    const full = path.join(ROOT, rel);
    const st = fs.statSync(full);
    files.push({ path: rel.replace(/\\/g, '/'), bytes: st.size, sha256: sha256(full) });
  }
  // Screenshots are part of the deliverable: verify presence and size cap.
  const shots = [];
  for (const name of ['chase', 'drive', 'foot', 'mission']) {
    const rel = `screenshots/${name}.jpg`;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) throw new Error(`missing screenshot: ${rel}`);
    const st = fs.statSync(full);
    if (st.size > 256 * 1024) throw new Error(`screenshot too large: ${rel} (${st.size} bytes)`);
    shots.push({ name, path: rel, bytes: st.size, sha256: sha256(full) });
  }
  const rootFiles = ['serve.ts', 'README.md', 'LICENSE', '.gitignore'];
  for (const rel of rootFiles) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) throw new Error(`missing file: ${rel}`);
    const st = fs.statSync(full);
    files.push({ path: rel, bytes: st.size, sha256: sha256(full) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const dossier = {
    game: 'Solmar City',
    version: 'v10.1',
    bounty: 'gta6-01',
    repo: 'Eagle78-Inti/solmar-city',
    title: 'Solmar City v10.1: The Solmar Reign — 3 acts, 8 missions, 2 endings, 7 districts, dialogue, stats, collectibles, race',
    districts: ['Downtown', 'Neon Mile', 'Old Town', 'Marina Bay', 'Kumala Beach', 'Portside', 'Palms Suburb'],
    missions: [
      { id: 'M1', name: 'First Wheels', pay: 1350 },
      { id: 'M2', name: 'Neon Nights', pay: 1800 },
      { id: 'M3', name: 'Harbor Run', pay: 2200 },
      { id: 'M4', name: 'The Getaway', pay: 3000 },
      { id: 'M5', name: 'Set Up', pay: 3000 },
      { id: 'M6', name: 'Harbor Lights', pay: 3350 },
      { id: 'M7', name: 'The Big One', pay: 9500 },
      { id: 'M8', name: 'The Choice', pay: 25000 },
    ],
    endings: ['Take the Crown', 'Stay Loyal'],
    features: [
      'flyable helicopter', 'Kelo Arms weapon shop', 'Sunset Garage property',
      'Jason/Lucia character switch', '3 named radio stations', 'taxi', 'courier',
      'boats and yachts', 'police + heli searchlight', 'save/load',
      '21 hidden packages', '5 stunt jumps', 'Neon Mile Sprint race',
      'career stats screen', 'story list with payouts', 'full-screen map',
      'scripted story dialogue', 'day/night cycle', 'rain + wet roads',
    ],
    graphics: {
      shadows: '2048px PCFSoft',
      toneMapping: 'ACESFilmic',
      sky: 'dome with sun/moon/clouds',
      fog: 'FogExp2',
      textures: 'procedural canvas (brick, lit windows, asphalt, neon, sand, water)',
    },
    files,
    screenshots: shots,
    totalBytes: files.reduce((a, f) => a + f.bytes, 0) + shots.reduce((a, s) => a + s.bytes, 0),
  };
  const text = JSON.stringify(dossier, null, 2) + '\n';
  fs.writeFileSync(OUT, text);
  const gameCount = files.filter(f => f.path.startsWith('game/')).length;
  console.log(`dossier.json written: ${files.length} files (${gameCount} in game/), ${shots.length} screenshots, ${dossier.totalBytes} bytes`);
  console.log(`dossier sha256: ${crypto.createHash('sha256').update(text).digest('hex')}`);
  return dossier;
}

build();
// main.ts — Solmar City dossier builder (make.fun gta6-01 kit entrypoint).
// Determinism note: file lists are sorted, JSON keys are written in a
// fixed order, and no timestamps are embedded, so two runs of
// `node main.ts` from the repo root produce byte-identical dossier.json.
export {};
