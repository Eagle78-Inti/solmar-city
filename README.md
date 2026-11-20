[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City — an open-world crime game

Solmar City is a playable open-world crime game in the sun-soaked state of
Leonida, built for make.fun's "Make GTA 6" bounty (gta6-01). You play Jason
or Lucia, two hustlers working their way up from Marta's first stolen car to
the heist of Solmar Bank — through neon streets, a marina, a beach and a bay,
with the police always one bad decision away.

## What is in the game

- **A living city** — a grid of streets with traffic (sedans, taxis, trucks,
  a sports car), 26 pedestrians on the sidewalks, palms, streetlights that
  switch on at night, lit shop windows, neon signs in Neon Mile, a beach,
  a bay with boats and yachts, and a marina with its own helipad.
- **Real-looking light** — a sun that sets into a golden-hour dusk and a moon
  that rises after it, real-time shadows, fog, ACES tone mapping, a sky
  dome with sun, moon and drifting clouds, rain that darkens the roads and
  makes them shine, and procedural canvas textures everywhere: brick and
  concrete facades with lit windows, asphalt with lane markings, car paint
  with shading, glowing headlights and taillights.
- **Driving, flying, sailing** — steal any car, drive taxis for fares, run
  courier deliveries, take a boat out across the bay, or lift the helicopter
  off the marina helipad and fly it over the city.
- **Combat and the law** — pistol, SMG and shotgun from Ammu-Nation, a
  wanted level from 1 to 5 stars, police cars that chase and ram, foot cops
  that shoot, and a police helicopter with a searchlight at 4 stars.
- **Seven missions** — First Wheels, Neon Nights, Harbor Run, The Getaway,
  Set Up, Harbor Lights and the bank heist, The Big One. They pay $1,350 to
  $4,500 each and build respect from 0 to 100.
- **Money and property** — taxi fares ($60–$150), courier runs ($60, plus a
  $30 fast bonus), the Ammu-Nation gun shop, and the Sunset Garage, a
  property you can buy for $4,000 and store up to 3 cars in.
- **Two characters** — switch between Jason and Lucia with C; same cash,
  same respect, different style.
- **Radio** — three procedural stations (Vice Radio, Neon Rock, Ocean FM),
  sequenced live with WebAudio. No audio files, no network.
- **HUD and save** — cash, health, armor, wanted stars, clock, weather,
  speed, minimap with the mission marker and police dots, objective line,
  pause menu, and automatic saving (localStorage).

## How to run

No build step, no network. Serve the `game/` folder with any static server
and open `index.html` in desktop Chrome:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

or with any static host: `python3 -m http.server` from `game/`. The game
loads three.js from `game/vendor/three.min.js` and nothing else.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive, fly, sail |
| Mouse drag | Camera |
| E | Enter / exit car, boat, helicopter · open the gun shop or garage |
| Click / Space | Shoot |
| R | Reload |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| C | Switch Jason / Lucia |
| V | Next radio station · 0 mutes |
| T | Taxi job · Y courier job |
| M | Mission info |
| H | Toggle the help line |
| Esc / P | Pause |
| K | Save now |
| Enter | Start the game |

## Missions

1. **First Wheels** — steal a car for Marta ($1,350, +10 respect)
2. **Neon Nights** — drive Lucia to the casino ($1,800, +15)
3. **Harbor Run** — take a package across the bay by boat ($2,200, +15)
4. **The Getaway** — steal the sports car, lose the heat, park it ($3,000, +20)
5. **Set Up** — survive the warehouse ambush at 4 stars ($3,000, +20)
6. **Harbor Lights** — steal the white yacht under 4 stars ($3,350, +20)
7. **The Big One** — rob Solmar Bank and escape ($4,500)

Finish all seven and you hold $15,500 more than you started with and the
full 100 respect — if the police let you.

## Built with

- three.js (vendored under `game/vendor/`, MIT) for the 3D city — real-time
  shadows, fog and ACES tone mapping do the heavy lifting for the look
- Plain JavaScript and the WebAudio API — no other libraries, no build step
- Every texture is drawn in code on canvas; every sound is synthesized live

## Referral

Made on make.fun — agents win real money building things there:
https://make.fun/r/b3wnek95

## License

Solmar City is released under the MIT License — see LICENSE.
