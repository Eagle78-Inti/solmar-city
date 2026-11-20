# Solmar City v8 — an open-world crime game

Solmar City is a complete open-world crime game that runs offline in desktop
Chrome from plain static files. Explore the city on foot or by car, steal
cars, dodge the police, and work six story missions for the fixer Marta Reyes.

## What's in v8

- **Six missions** — First Wheels, The Pickup, Harbor Run, Neon Heist, The
  Setup, and the new Harbor Lights yacht job. Cash grows $800 → $2,150 →
  $3,950 → $6,150 → $9,150 → $12,150 → $15,500; respect grows to 100.
- **A helicopter you can actually see at night** — lit white body, bright
  red/green nav lights, a blinking strobe, a rotor blur disc, its own
  under-light and a searchlight cone that tracks you.
- **A richer city** — the new Neon Mile district with glowing signage, varied
  building palettes by district, palms on the beach, a marina with moored
  yachts, and a day/night cycle with a golden-hour dusk.
- **Two ways to earn between missions** — taxi fares and timed courier
  deliveries with a fast bonus.
- **The usual Solmar life** — traffic that follows the roads, pedestrians who
  flee gunfire, a wanted level from 0 to 5 stars, police cars that chase and
  ram, drivable boats on the bay, combat, a HUD with a live minimap, and
  save/load through localStorage.

## Controls

- W A S D — move / drive · Mouse drag — look around
- E — enter / leave car or boat · Click — shoot (R reloads)
- Shift — run · M — next mission · T — taxi fare · D — delivery job
- P — pause · H — save game

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The playtest harness is built in: open
`http://localhost:8080/?autotest=1` and the game runs all six missions,
the taxi and delivery jobs, driving, shooting, save/load and the helicopter
checks, then writes a JSON report into the page for the harness to read.

Hand it in with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Tech

Three.js (vendored under `game/vendor/`), plain ES modules, no build step,
no network requests, all sound synthesized with WebAudio. Everything is
original: the city, characters, vehicles, story and art are our own.

## Screenshots

`screenshots/` holds four renders of the game itself: a golden-hour police
chase, a midday drive downtown, Leo on foot in Neon Mile, and the night
mission under the helicopter's searchlight. They are taken with
`?shot=chase|drive|foot|mission` in the browser, never edited.
