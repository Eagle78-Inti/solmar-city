// Solmar City v9 — the entry program (Node 22, standard library only).
// It hands the game in: it copies game/ and screenshots/ from beside this
// file into the output directory and writes /output/dossier.json with the
// vendored make.fun library, so the scorer can rebuild the same dossier
// byte for byte from what is handed in. Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer caps /output at 1000 entries, so the output is rebuilt from
// scratch on every run: a stale file from an earlier build must never leak
// into the hand-in, and running the program twice writes the same bytes.
// Removing the old trees first is what makes the second run identical.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
rmSync(join(out, 'dossier.json'), { force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the other caps refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all; a path under game/ over 1000 bytes. game/
// counts beside /output's own 1000-entry cap with screenshots/ and
// dossier.json, so the game is kept at 993 entries at most.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log('Solmar City v9: handed in to ' + out);
console.log('  dossier.json: ' + dossier.length + ' bytes');
