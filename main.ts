// main.ts — Solmar City's hand-in program (Node 22, standard library only).
// It copies game/ and screenshots/ from this repository into the output
// directory and writes output/dossier.json with buildDossier, the kit's own
// library, so the dossier the judge reads is exactly the one the scorer
// rebuilds from the same files.
//
//   node main.ts                          writes to /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts   writes to ./out instead
//
// Running it twice over the same repository writes the same bytes twice.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

/** The repository root: the directory this file lives in. */
const ROOT = dirname(fileURLToPath(import.meta.url));

/** The output directory: the platform's /output, or MAKEFUN_OUTPUT_DIR. */
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

/** The gate's caps for this bounty, as the dossier library takes them. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

/** Copy one directory of the repository into the output, replacing it. */
function copyDir(name: string): void {
  const from = join(ROOT, name);
  const to = join(OUT, name);
  if (!existsSync(from)) throw new Error(`main.ts: ${name}/ is missing from the repository`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(OUT, { recursive: true });
copyDir('game');
copyDir('screenshots');

// The dossier is built from the output itself, so it always describes
// exactly what was handed in — never the repository's working tree.
const dossier = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`Solmar City v10 handed in: ${dossier.length} bytes of dossier in ${OUT}`);
