[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City — The Solmar Reign

An open-world crime game in a desktop browser, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). One city, seven districts, three acts, eight missions and two endings — all offline, no network assets.

## Play

```sh
node serve.ts        # serves http://localhost:8080/
```

Open the page, click **START**, and drive. WASD moves and drives, mouse drags the camera, E interacts, F enters and exits cars, Click shoots, R reloads, 1–5 switch weapons, Q opens the weapon wheel, C switches between Jason and Lucia, V cycles the radio, T starts a taxi fare, Y starts a courier job, M opens the full map, Esc pauses.

## The campaign — "The Solmar Reign"

| Mission | Act | Payout | What happens |
| --- | --- | --- | --- |
| M1 First Wheels | 1 | $1,350 | Meet Marta, take the corner car to the loft |
| M2 Neon Nights | 1 | $1,800 | Run a package across the Neon Mile |
| M3 Harbor Run | 2 | $2,200 | The yacht deal on the water at Marina Bay |
| M4 The Getaway | 2 | $3,000 | A sports car and a two-star tail |
| M5 Set Up | 2 | $3,000 | Survive an 18-second ambush at four stars |
| M6 Harbor Lights | 2 | $3,350 | Steal the white yacht, sail it to the buyer |
| M7 The Big One | 3 | $9,500 | Ten seconds on the Downtown vault crack |
| M8 The Choice | 3 | $25,000 | Take the Crown, or Stay Loyal |

Cash runs $800 → $50,000, respect 0 → 100. Mission briefings list every stage, and the story is told through scripted dialogue with Marta the garage boss, Rook the debt holder, Dario and Jason/Lucia.

## The city

Seven named districts — Downtown, Neon Mile, Old Town, Marina Bay, Kumala Beach, Portside, Palms Suburb — each with standing that moves as you play (+35 per story mission, +10 per race win, +5 per hidden package). Districts you win are held and shown on the full-screen map (M), which also carries the legend: Mission, Police, Respray, Kelo Arms, Safehouse, Car Export, Side Job, Garage.

Side content: 21 hidden packages (3 per district), 5 stunt jumps, the Neon Mile Sprint race, taxi fares, courier jobs with a fast bonus, a flyable helicopter (Space climbs), boats and yachts in the bay, and a police force with a helicopter searchlight at three stars and up.

## Systems

- Rank and RP, armour, a five-slot weapon inventory with ammo (Fists, .38 Pistol, SMG, 12G Shotgun, AR-9)
- Kelo Arms weapon shop (SMG $800) and the Sunset Garage property ($4,000 — store and retrieve your car)
- Three named radio stations with the current track in the HUD: Vice FM 88.4, Neon Rock 101.7, Wave FM 94.2
- Day clock, role tag, GRIP meter, vehicle-condition bar, weapon wheel, quick save at the safehouse, horn, drive-by shooting
- Career stats screen: cash, respect, districts held, packages, jumps, races, cars stolen, best wanted
- Save/load round-trip via localStorage (F9 at the safehouse)

## Graphics

2048px shadow maps, ACES tone mapping, a sky dome with sun, moon and clouds, FogExp2, procedural canvas textures (brick, lit windows, asphalt, neon signs, sand, water), rain with wet roads, emissive neon, headlights and taillights, and a coherent teal / purple / orange sunset palette. Day/night cycle included.

## Layout

- `game/index.html` — page shell, import map, HUD and menus
- `game/src/` — the game, one module per system (`state`, `graphics`, `city`, `vehicles`, `people`, `player`, `police`, `missions`, `combat`, `activities`, `hud`, `audio`, `save`, `shots`, `util`, `main`)
- `game/vendor/` — vendored Three.js (no CDN, no network)
- `main.ts` — builds `dossier.json` deterministically (`node main.ts`, run twice, byte-identical)
- `serve.ts` — local static dev server (`node serve.ts`, then http://localhost:8080/)
- `screenshots/` — the four dossier shots (chase, drive, foot, mission)

## License

MIT — see `LICENSE`.

<!-- Built for the make.fun "Make GTA 6" bounty: https://make.fun/bounty/gta6-01 -->
