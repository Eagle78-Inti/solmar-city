// Solmar City — entry program (Node 22, standard library only).
//
// The game lives in game/ as plain static files a desktop browser loads
// offline (game/index.html plus its ES modules and the vendored three.js
// build under game/vendor/). This program hands the entry in: it copies
// game/ and screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library (vendor/makefun-game.ts).
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the game and the screenshots into /output, then build the dossier
// with the same caps the gate scorer enforces: at most 4 screenshots of
// 256 KiB, at most 993 files / 48 MiB under game/, paths under 1000 bytes,
// and the dossier text capped at 160 KiB. main.ts runs twice in the grader
// and both runs must write the same bytes, so nothing here depends on time
// or chance — it is a straight copy plus a deterministic dossier build.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

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
