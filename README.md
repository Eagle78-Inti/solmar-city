# Solmar City — an original open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar City is a complete open-world crime game that runs offline in desktop
Chrome from static files — v7, richer and more detailed than ever. You play Rook, a getaway driver working for the
fixer Mari Voss, in a sun-soaked bay city of your own — no names, art or
music from any commercial game. Drive the streets, steal cars, outrun the
police, work five story missions, take taxi fares, race the pier and hunt
for coins, all under a full day/night cycle with a golden-hour dusk.

## Play it

Serve the `game/` folder with any static server, or run `node serve.ts`
and open http://localhost:8080. Keyboard and mouse only.

- **WASD** move / drive, **Shift** sprint, **Space** handbrake, **R** reset car
- **E** enter / exit a car (stealing one raises your wanted level)
- **Mouse** aim, **click** shoot the pistol
- **T** start a taxi job, **Esc** pause, progress saves automatically

## What is in the city

- A living grid city: traffic that follows lanes, pedestrians who flee
  gunfire, police who chase, ram and bust, and a helicopter with a
  searchlight at 4 stars and above.
- Five story missions with cash and respect payouts, a twist in the last
  one, plus taxi jobs, pier street races and 20 hidden coins.
- A bay with animated water, a beach, three piers and the Solmar Tower.
- Day/night cycle, neon streets, wet-road gloss after dark, and a HUD
  with cash, respect, wanted stars, health, speed, a clock and a
  circular minimap.
- Synthesized sound only — engine, sirens, gunfire and music, all made
  in code with WebAudio.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `dossier.json`. Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This repository is an entry for the
[Make GTA 6](https://make.fun/bounty/gta6-01) bounty on
[make.fun](https://make.fun). It is licensed MIT.

## Screenshots

The cover is a golden-hour dusk chase — Rook in the red getaway car,
three police cruisers on his tail, the whole city glowing. The other
shots show a daytime drive, Rook on foot at noon, and the final mission
at night under the police helicopter's searchlight.
