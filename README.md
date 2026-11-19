# Solmar City — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar City is an original open-world crime game that runs in a desktop browser
from plain static files. You are Rook, a getaway driver working for the fixer
Mari Voss. Steal cars, outrun the police, finish five story missions, take taxi
fares, race the pier road and hunt twenty Solmar coins across a living bay city
with a full day and night cycle — built for the make.fun "Make GTA 6" bounty.

## Play it

Serve the `game/` folder with any static file server and open `game/index.html`
in desktop Chrome, for example:

```sh
node serve.ts
# open http://localhost:8080
```

No network, no build step, no accounts. Everything the game loads is a file
under `game/` or a `data:` URI.

## What is in the city

- **A city to explore on foot and by car** — gridded streets, a beach and a bay
  with three piers, the Solmar Tower, traffic lights, palms and street lamps.
- **Traffic and pedestrians** — sixteen cars that follow lanes, stop at red
  lights and slow for the car ahead; twenty-six walkers who scatter when they
  hear a gunshot or a car comes at them fast.
- **Cars to steal** — walk up to a parked car and press **E**. Stealing one
  brings the police.
- **A wanted level** — zero to five stars. Police chase, ram and try to bust
  you; at four stars a helicopter joins with a searchlight.
- **Five story missions** — from a first pickup at the pier to a final job
  where Mari tips the cops and you have to escape to the hideout. Payouts run
  from $550 to $3,000; finishing the story banks $9,150 and 80 respect.
- **Side work** — taxi jobs (**T**), a repeatable pier street race, and twenty
  Solmar coins worth $50 each.
- **Combat** — a hitscan pistol (click or **F**); police shoot back at two
  stars and above.
- **A HUD with a circular minimap** — cash, respect, coins, stars, health,
  speed, the clock, the current objective, and blips for missions, taxis and
  police.
- **Day and night** — a twelve-minute day: blue skies, golden dusk, lit
  windows and headlights after dark.
- **Start, pause and save** — the game saves to localStorage, so you can
  continue where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| Shift | Sprint |
| Space | Handbrake |
| E | Enter / exit a car, steal a parked car |
| Click / F | Shoot |
| M | Start the next mission |
| T | Taxi job on / off |
| R | Reset the car to the street |
| Esc | Pause |

## How it is built

- `game/index.html` — the page, the HUD and the import map.
- `game/src/main.js` — bootstrap, input, camera, the main loop.
- `game/src/city.js` — streets, buildings, bay, sky, day and night.
- `game/src/vehicles.js` — the car factory, traffic and the player's car.
- `game/src/player.js` — Rook on foot and getting in and out of cars.
- `game/src/police.js` — the wanted system, pursuit and the helicopter.
- `game/src/pedestrians.js` — walkers who flee gunfire.
- `game/src/missions.js` — the five story missions, taxis, coins, races.
- `game/src/combat.js` — the pistol, police return fire, health.
- `game/src/hud.js` — the HUD and the circular minimap.
- `game/src/audio.js` — WebAudio-synthesized engine, sirens, shots and music.
- `game/src/save.js` — localStorage saving.
- `game/src/shots.js` — screenshot staging and the debug hooks.
- `game/src/util.js` — small math and canvas helpers.
- `game/vendor/three.module.min.js` — three.js, vendored.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.

All art is procedural (canvas textures drawn at runtime) and all sound is
synthesized with WebAudio. Nothing here comes from Rockstar Games or any
other commercial game: the city, the names, the characters and the story are
all original.

## License

MIT — see `LICENSE`.

## Screenshots

Four real renders of the game running in desktop Chrome, in `screenshots/`:

- `chase.jpg` — the cover: a bright afternoon getaway, three stars, police in
  pursuit, the car moving.
- `drive.jpg` — a daytime drive down the avenue.
- `foot.jpg` — Rook on foot in Solmar, pedestrians on the sidewalk.
- `mission.jpg` — the final mission at night: four stars, the helicopter and
  its searchlight.
