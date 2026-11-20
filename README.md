[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City — The Solmar Reign

An open-world crime game in the spirit of GTA 6, built for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01). A sun-soaked modern city on the bay, seven districts, a three-act campaign, and a living world of traffic, pedestrians, police and radio.

## The story

Dario Vasquez owes Rook Calloway fifty grand. Rook sends Dario's kid brother Leo to collect, and Leo — fresh off the ferry with $800 and no crew — has to work the debt off district by district, or take the crown himself. Three acts, eight missions, two endings: **Take the Crown** or **Stay Loyal**.

## What is in the game

- **A full city**: 7 named districts (Downtown, Neon Mile, Old Town, Marina Bay, Kumala Beach, Portside, Palms Suburb), each with its own look and its own standing that moves as the story moves — win a district by finishing its story beats, and hold it.
- **The campaign**: 8 missions with scripted dialogue between named characters — Marta the garage boss, Rook the debt holder, Leo and Jason/Lucia — each briefing lists every stage before you start.
- **Progression**: rank and RP, respect, armour, a 5-slot weapon inventory with ammo (pistol, SMG, shotgun, rifle, fists), and a career stats screen in the pause menu: cash, respect, districts held, hidden packages, stunt jumps, races won, cars stolen, best wanted level.
- **The world, alive**: traffic with real drivers, pedestrians who flee from gunfire, police cars, foot cops and a helicopter with a searchlight at 4+ stars, a 5-star wanted system that decays when you lay low.
- **Vehicles**: steal any car, drive boats and yachts, fly a helicopter from the helipad. Taxi fares and courier deliveries pay on the side. A car-export point pays for stolen rides.
- **Side activities**: 21 hidden packages across the 7 districts, 5 stunt jumps, and the Neon Mile Sprint race — all tracked in the stats screen.
- **Money to spend**: Kelo Arms (Ammu-Nation) sells weapons, ammo and armour; the Sunset Garage property stores your cars; a respray loses the heat. The garage costs $4,000 and holds your stolen rides.
- **Atmosphere**: 2048px shadow maps, ACES tone mapping, a sky dome with sun, moon and clouds, fog, rain with wet roads, emissive neon and headlights, a full day/night cycle, and three named radio stations (Vice FM 88.4, Neon Rock 101.7, Wave FM 94.2) with track names in the HUD.
- **Save**: quick save at Marta's Loft, auto-save after every mission, Continue on the title screen.

## How to run

No build step, no network. Serve the `game/` directory with any static file server and open `index.html` in desktop Chrome:

```sh
cd game && python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `game/index.html` directly from the file system.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move on foot / drive |
| Mouse drag | Orbit the camera |
| Click | Shoot the current weapon |
| R | Reload |
| 1–5 | Select weapon (Q holds the weapon wheel) |
| F | Enter / exit a car, boat or helicopter |
| E | Interact (shop, garage, safehouse, respray) |
| C | Switch between Jason and Lucia |
| V | Change radio station |
| T | Start a taxi fare |
| Y | Start a courier delivery |
| M | Full city map (districts, legend, standings) |
| Esc | Pause — career stats and the story list |

## The missions

1. **First Wheels** ($1,350) — Marta hands Leo a sedan. Steal it, bring it to the garage.
2. **Neon Nights** ($1,800) — Race the Neon Mile for Rook's money, then drive it to the bank.
3. **Harbor Run** ($2,200) — A truck of Rook's cargo, from the port to the garage, in the rain.
4. **The Getaway** ($3,000) — Steal the sports car at the Marina, lose two stars.
5. **Set Up** ($3,000) — An ambush in Old Town at night. Survive 18 seconds at four stars.
6. **Harbor Lights** ($3,350) — Steal the white yacht, sail it to the buyer under four stars.
7. **The Big One** ($9,500) — Crack the Solmar Bank vault in ten seconds.
8. **The Choice** ($25,000) — The crown or the crew. Two endings.

The arc runs $800 → $50,000.

## Built with

Three.js (vendored under `game/vendor/`), plain JavaScript modules, procedural canvas textures and synthesized radio — no downloaded assets, no network requests. `main.ts` hands the game in with the make.fun dossier library (`vendor/makefun-game.ts`).

## Play it on make.fun

Enter the bounty and play the game at [make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01). If you sign up, use referral code **b3wnek95** — https://make.fun/r/b3wnek95.
