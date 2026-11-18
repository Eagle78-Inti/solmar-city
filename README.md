# Solmar City

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game, built for the make.fun **Make GTA 6** bounty.
Nothing here comes from Rockstar or any other commercial game: the city, the
characters, the story, the art and the music are all our own. Built to win:
every system below was played end to end in desktop Chrome before submitting.

## The game

You are **Rook**, a getaway driver new to **Solmar** — a sun-soaked bay city
of pastel towers, palm-lined beaches, three piers and neon nights. The fixer
**Mari Voss** has five jobs for you: a first drive, a bank getaway, a repo
job, a midnight street race, and a final casino score that ends in betrayal.

- **A city to explore** on foot and by car: grid streets, traffic that stops
  at red lights, pedestrians who flee gunfire, and cars you can steal (press E).
- **Wanted stars 0–5**: police cruisers pursue and ram you, a bust timer runs
  when they corner you, and a helicopter with a searchlight joins at 4 stars.
- **Five story missions** with cash and respect progression, plus taxi fares,
  pier street races and 20 Solmar coins hidden around town.
- **A living day**: a 12-minute day/night cycle — sun-soaked streets by day,
  wet reflective asphalt, neon signs and headlights by night.
- **HUD with minimap**, start screen, pause, and saving to localStorage.
- **Sound**: an original synthwave radio loop, engine, sirens and effects,
  all synthesized in WebAudio. No audio files.

## The look

The game renders in three.js with ACES filmic tone mapping, soft shadows,
clearcoat car paint, dark glass cabins, procedural canvas textures (cracked
asphalt, facades with lit windows, sand, water), emissive neon, glow sprites
and fake light streaks on wet streets at night, a gradient sky with drifting
clouds, and an animated bay.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: every script, texture and sound is
generated from files under `game/` (three.js is vendored as
`game/vendor/three.module.min.js`).

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| E | Steal / enter / exit car |
| Space | Handbrake |
| Click | Shoot |
| T | Taxi job |
| R | Reset car |
| M | Mute |
| Esc | Pause |

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node ../gta6-01-kit/cli/makefun.mjs check --kit ../gta6-01-kit --repo .
```

License: MIT.

## About the entry

Built for the make.fun **Make GTA 6** bounty (gta6-01): https://make.fun/bounty/gta6-01

Solmar City is an original open-world crime game. The screenshots in
`screenshots/` are real renders of the game running in desktop Chrome:
`chase.jpg` (the cover) is a night chase at 3 stars, `drive.jpg` a sun-soaked
day drive, `foot.jpg` Rook on foot on Bay Avenue at dusk, and `mission.jpg`
the final mission at 4 stars with the police helicopter overhead.

Source layout (one clear job per file, under `game/src/`):

- `util.js` — math, seeded random, procedural canvas textures, material caches
- `city.js` — the bay city: streets, towers, neon, piers, beach, sky, day/night
- `audio.js` — synthesized WebAudio: radio, engine, sirens, effects
- `vehicles.js` — detailed cars, arcade driving, traffic that obeys lights
- `player.js` — Rook, on-foot movement, third-person camera
- `pedestrians.js` — walkers who flee trouble
- `police.js` — wanted stars, pursuit, busts, helicopter searchlight
- `missions.js` — five story missions, taxi jobs, races, coins
- `combat.js` — hitscan pistol, tracers, sparks
- `hud.js` — HUD, minimap, start/pause screens
- `save.js` — localStorage saves
- `shots.js` — screenshot staging (real renders, staged scenes)
- `main.js` — renderer, input, game loop
