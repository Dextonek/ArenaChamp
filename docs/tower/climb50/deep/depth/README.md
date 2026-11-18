# The Deep's depth (floors 31 to 40)

The user, 2026-11-14: "add depth into the worlds, make all the background look like it fits there, all the roads and zones, don't be
shy". The cave is dressed as a mine people worked in, and the far cave around it is given shape. It changes only how things look:
nothing in it blocks a walk or a shot. The code is `src/tower/world/deepDepth.ts`, called from `deepZone.ts`. It is on the branch,
not live.

Open `index.html` in this folder for the pictures side by side, before and after.

## What was added

- **The tracks:** timber frames across them every 20 to 30 m, a few with a hanging lamp. Points levers where one track ends on another
  and by the middle turntable, and buffers where a track ends in the cart yard or the camp. Spilled ore, sacks, rope coils, pick-axes
  and loose sleepers lie on the verges.
- **The miners' rest:** pallet bunks by the tents, a stove with its kettle, a table and stools, and two lamps on a line.
- **The cart yard:** spare rails, wheel sets, stacked sleepers, ore and a winch.
- **The landing:** a jetty with a gold edge out over the black water, a lamp at its end, a moored boat, nets drying on poles, bollards.
- **The glow pools:** pale reeds round every pool, pale mushrooms, and two clumps of glowing fungi.
- **The old shaft:** the generator's four posts tied into a head-frame, a wheel over the hole, its rope down the hole and to a winch.
- **The halls:** crystal chips at the inner foot of the wall, a pick-axe.
- **The camp:** sacks and rope at its edge.
- **The cave:** rubble and scree at the wall's foot, two tipped carts against it, puddles, and glowing fungi. On the slopes, ledges,
  boulders and gold veins. Stalactites hang overhead, above the game camera. The north wall has an arch onto a second cavern with
  crystal light inside. A waterfall runs into the black lake, with faint glints on the water, pale spires along the far shore, and bats
  under the north wall.
- **The dark law:** 11 to 13 new glows a floor, from the track lamps, the rest's lamps, the jetty lamp, a few fungi and the far cavern.
  The crystals, the lamps and the waystones stay what a player steers by (`fNN-*-dark-*.jpg`).

## The pictures

Floors 31, 35, 36 and 38, before and after, twelve views each. The game-camera views show what a player sees; `-dark` means the dark
law's layer is on. The rest use a free camera, with no HUD and no dark.

| View | What |
|---|---|
| `rest-close` | The miners' rest, close (floor 31 has none: the cart yard) |
| `yard-mid` | The cart yard and its tracks |
| `landing-close`, `jetty` | The landing; the jetty and boat from above it |
| `shaft-mid`, `shaft-dark` | The old shaft's head-frame, without and with the dark |
| `between-mid`, `between-dark` | The cave floor between two halls, without and with the dark |
| `pools-close` | The glow pools |
| `north` | The north wall from mid-floor: the arch, the stalactites, the bats |
| `water` | Towards the black lake: the waterfall and the far shore |
| `far` | A low view from the camp to the north |

The pictures were taken with `pipeline/tools/world-shots.py` on `/game`, with the camera placed by a short script.

## The checks

- **`_worldCheck`, floors 31 to 40, before and after:** the same reachable ground on every floor (33,301 to 33,964 m²), nothing
  unreachable, and the same most-units-near count and place (4 or 5).
- **Spots** (people, packs, waystones, caches, lore, doors, quest points) **against every prop taller than 0.4 m:** two near misses,
  both harmless. The head-frame stands on the generator's own posts, 3.4 m from the shaft's satchel spot, as the posts already were. One
  sack lies 0.7 m from a waystone on floor 39. The shaft's winch was moved off the spot where the lead quest's miner waits.
- **Speed:** `perf.py scenes --profiles desktop,phone-4x --scenes world-4,gen-35`, before and after back to back twice, with the before
  served from a checkout of 5700d4f. The fights are the same, with the same prints (`a9a39789`, `5f524a6f`).

  | | Before | After |
  |---|---|---|
  | Desktop, median frame | 7.3 to 7.8 ms | 7.3 to 7.5 ms |
  | Phone-4x, floor 31, median frame | 16.0 / 16.2 ms | 15.0 / 14.6 ms |
  | Phone-4x, floor 35, median frame | 17.7 / 17.3 ms | 16.7 / 18.2 ms |
  | Phone-4x, longest frame (zone build), floor 31 | 942 / 919 ms | 977 / 974 ms |
  | Phone-4x, longest frame (zone build), floor 35 | 3384 / 3466 ms | 3484 / 3513 ms |

  This is 6 or 7 more draw calls. The depth's own build takes 20 to 35 ms on desktop. On the phone, every pair's longest frame was 35 to
  100 ms higher after. That is still inside the baseline's own spread over the session (919 to 1005 ms on floor 31, 3384 to 3580 ms on
  floor 35).
- **No bats or stalactites block the view:** in the game camera at the rock fall's door (zoom 1.25 and 1.7) and at the landing's outer
  edge, on desktop and on an upright phone (390 x 844), nothing of the depth comes between the camera and the hero.
- **What it took:** the first two versions failed this bar by 2 to 2.6 ms a frame on the phone on floor 31, with about 25 more draw
  calls. The scree reaches every square of ground, and each square drew twice, once for the picture and once for the shadows. Now every
  prop shape is built once. Each placement is copied into one mesh per quarter of the floor, near or far, all on one material. The
  unlit parts and the gold's warmth ride on each vertex, and none of it casts a shadow. Two trades were made for that speed: the depth's
  gold is matte with a faint warmth rather than polished metal (STYLE.md rule 4), and its props cast no shadows.

## The floor build's time (2026-11-14, the scenes' refinement)

The scenes' first pass timed a whole Deep floor's build at 8 to 10 s on the phone profile, while the notes above give about 3.5 s for
floor 35 and 1 s for floor 31. **Why the numbers differ:** the 1 s and 3.5 s are perf.py's longest *frame* in the world scene, not the
build: the world scene sets the floor up before its frames are timed, and its longest frame is part of that setup at most.
`arena.build()` itself, timed with the processor slowed 4 times (each floor built once at full speed first), took 8.2 to 9.3 s
on floors 31 and 35 alike, with a real graphics card or in software alike: far more than any frame perf.py reported for them.

**What costs what** (a processor profile of floor 35's build, slowed 4 times; 7.8 s in all):

| Part | Time |
|---|---|
| The cave's ground colour (`color` in deepZone.ts), for the ground plane's ~62,000 vertices and the painted map's ~56,000 pixels: it samples `steepness`, so `height` four times, so three octaves of value noise | 5.6 s |
| of which the noise lattice's lookup (`at`): some 20 million calls, each wrapping its index with two float modulos | 5.2 s |
| The painted map (`paint`, the canvas: the colours above plus the dabs, flagstones and tracks) | 2.8 s (with its share of the colour) |
| The depth (`buildDeepDepth`: props, scenes, its meshes) | 0.25 to 0.33 s |
| The scenes alone | 0.05 to 0.1 s |

**The fix** (deepZone.ts, one line): the lookup wraps with `i & 63` instead of `((i % 64) + 64) % 64`, the same number for every whole
index. Nothing seen or played changes: every vertex attribute, instance matrix and painted map of all ten Deep floors hashes the same
before and after (FNV-1a over the raw bytes). The build:

| | Before | After |
|---|---|---|
| Desktop, floors 31 to 40 | 1.75 to 2.28 s | 0.51 to 0.89 s |
| Phone profile (4x), floors 31 and 35 | 8.2 to 9.3 s | 3.05 to 3.35 s |

What is left on the phone profile is mostly the same colour sampling (about 1.9 s; `steepness` asks for four heights at every point of
the ground plane and the map, which could be shared between neighbours) and the browser's own work. **Not changed, for the lead:** the same
slow wrap is in `land.ts` (the sea), `woodZone.ts`, `sandsZone.ts` and `warZone.ts`; the same one-line change there would be expected to
cut those floors' builds the same way, and should be checked the same way (hash every attribute and map before and after).
