// Solmar City — the entry program (Node 22, standard library only).
// It copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json with the vendored make.fun library, exactly
// as the kit's starter does. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The judge reads the game through its screenshots: refuse to hand in an
// entry with no screenshots rather than shipping a blind dossier. Three is
// the minimum the gate accepts; four is what Solmar City ships.
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir) || readdirSync(shotDir).filter((f) => !f.startsWith('.')).length < 3) {
  throw new Error('Solmar City needs at least 3 screenshots in screenshots/ before it can be handed in.');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A one-line receipt on stdout so a local run shows what it handed in.
console.log('Solmar City handed in: game/ + ' + readdirSync(shotDir).filter((f) => !f.startsWith('.')).length + ' screenshots -> ' + out);
