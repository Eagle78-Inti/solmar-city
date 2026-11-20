// Solmar City v8 — the entry program (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library, exactly as the
// scorer rebuilds it. Running it twice writes the same bytes both times.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error('main.ts: ' + message);
  process.exit(1);
}

function checkDir(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) fail(`missing ${label} directory: ${path}`);
}

function copyTree(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  // The copy must be a plain tree: no symlinks may reach /output.
  const checkNoLinks = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail(`symlink in output tree: ${join(dir, entry.name)}`);
      if (entry.isDirectory()) checkNoLinks(join(dir, entry.name));
    }
  };
  checkNoLinks(to);
}

// The game and its screenshots must be beside this file.
checkDir(join(repoRoot, 'game'), 'game');
checkDir(join(repoRoot, 'screenshots'), 'screenshots');
if (!existsSync(join(repoRoot, 'game', 'index.html'))) fail('game/index.html is missing');

mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps: only text_max_bytes shapes the dossier bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files, or
// a path under game/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmar City v8 handed in: ${outDir} (dossier ${dossier.length} bytes)`);

// Nothing else to hand in: the dossier is the whole summary the judge reads,
// and the game plus its screenshots are already in /output.
