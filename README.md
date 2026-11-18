[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Eagle78-Inti/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar City — an open-world crime game

**Solmar City** is an original open-world crime game that plays offline in a
desktop browser from its own files. You are **Rook**, a getaway driver fresh
off the ferry into Solmar — a sun-soaked bay city that never sleeps. The fixer
**Mari Voss** has jobs for you: drives, getaways, repos, races. Earn cash,
earn respect, watch the wanted stars — and find out who Mari really works for.

Built for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on
[make.fun](https://make.fun). Everything here is invented: the city, the
characters, the cars, the story, the art and the music are all original —
nothing from any commercial game.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests. `game/index.html` plus its ES modules
and a vendored three.js build under `game/vendor/` are all it loads.

## What's in the city

- **A city on foot and by car** — grid streets, a waterfront with piers and
  a beach, the Solmar Tower, neon signs, palm trees, and a full **day/night
  cycle**: golden hour, neon nightlife, headlights after dark.
- **Traffic and pedestrians** — cars that drive the grid and slow for you,
  walkers who stroll the sidewalks and flee from gunfire.
- **Cars to steal** — walk up to any parked car, press **E**, and it's
  yours. The cops will notice.
- **A wanted level and police** — 1 to 5 stars. Patrol cars spawn, chase,
  ram and try to bust you. At 4 stars the **police helicopter** circles
  overhead with a searchlight.
- **Missions and a story** — five jobs for Mari Voss, from a first-day
  pickup to a midnight setup with a twist, plus **taxi fares**, **pier
  street races** and **20 Solmar coins** hidden around the city.
- **Combat** — a pistol (mouse click), police return fire, car damage,
  smoke and explosions.
- **HUD with a minimap** — cash, respect, wanted stars, health, speed,
  objective and a live circular minimap with mission, taxi and police blips.
- **Start and save** — start screen, pause menu, and progress saved to
  localStorage.
- **Sound** — engine, sirens, gunshots and a bass-and-pad music loop, all
  synthesized live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| E | Enter & exit car / interact |
| Mouse click | Shoot (on foot) |
| Space | Handbrake |
| Shift | Sprint |
| R | Reset car to the road |
| T | Take a taxi fare |
| P / Esc | Pause |
| M | Mute |

## How it is built

```
repo/
  main.ts                  entry program: copies game/ + screenshots/ to /output,
                           writes dossier.json with buildDossier
  serve.ts                 tiny static server for local play-testing
  vendor/makefun-game.ts   the kit's dossier library, unchanged
  game/
    index.html             page shell, HUD, import map (three.js)
    vendor/three.module.min.js   vendored three.js r170
    src/
      main.js              bootstrap, game loop, camera, input, menus, save/load
      city.js              the city: roads, buildings, waterfront, day/night rig
      vehicles.js          car meshes, arcade driving, traffic AI, parked cars
      player.js            Rook on foot: walking, entering/exiting cars
      pedestrians.js       sidewalk walkers who flee danger
      police.js            wanted stars, pursuit cars, bust logic, helicopter
      missions.js          five story missions, taxi fares, street race, coins
      combat.js            pistol hitscan, police return fire, explosions
      hud.js               DOM HUD and the circular minimap
      audio.js             WebAudio-synthesized engine, sirens, music
      save.js              localStorage save / load
      shots.js             deterministic ?shot= scene setups for screenshots
      util.js              shared helpers
  screenshots/             4 real renders of the game's own code
```

## Screenshots

1. `1-chase.jpg` — a night getaway chase: 3 wanted stars, police on your
   tail, mission objective and minimap on the HUD.
2. `2-foot.jpg` — Rook on foot on the neon strip at dusk.
3. `3-drive.jpg` — daytime driving through traffic on Bay Avenue.
4. `4-mission.jpg` — the midnight setup: 4 stars and the helicopter overhead.

## License

MIT. See [LICENSE](LICENSE).
