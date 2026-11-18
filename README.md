# Solmar City — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

Sun, sea and sirens. **Solmar City** is a 3D open-world crime game built for the make.fun "Make GTA 6" bounty — an original bay city, nothing from Rockstar or any other commercial game.

You are **Rook**, a getaway driver working for the fixer **Mari Voss**. Run her five jobs — a first run, a bank getaway, a repo job, a pier race and a final score with a twist — while the Solmar PD chases you across a living city: traffic, pedestrians, car theft, a 0–5 star wanted level with a police helicopter at 4 stars, taxi jobs, street races, 20 hidden coins and a full day/night cycle with neon nightlife. Progress saves to your browser, so you can pick up where you left off.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. It plays fully offline — every script, texture and sound is a file under `game/` or synthesized at runtime.

- **WASD** move / drive · **Shift** sprint · **E** enter / steal car · **Space** handbrake
- **Click** or **F** shoot · **T** taxi job · **R** reset car · **Esc** pause · **M** mute

## What is inside

- `game/` — the game: `index.html` plus `src/` (one file per job: city, vehicles, player, pedestrians, police, missions, combat, HUD, save, audio, screenshots, main) and `vendor/three.module.min.js`.
- `screenshots/` — four real renders of the game: a night chase, a day drive, dusk on foot by the bay, and the final mission under the helicopter.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` (run with `MAKEFUN_OUTPUT_DIR=out node main.ts`).

Built with three.js (vendored), procedural canvas textures, ACES tone mapping, PCFSoft shadows, a gradient sky with a 12-minute day/night cycle, and WebAudio-synthesized sound and music.

## License

MIT — see `LICENSE`.
