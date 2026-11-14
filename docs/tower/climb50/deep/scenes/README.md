# The Deep's scenes (floors 31 to 40)

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". A scene is a small group of props that says what happened in the mine. The code is `src/tower/world/scenes/deep.ts`, called
from `deepDepth.ts`. It is on the branch, not live.

**Looks only.** Nothing in it blocks a walk or a shot. In the Deep a cart, a crate, timber or a hut is cover, so on ground a hero walks
on only low things lie; the tall parts stand right south of a rock, a column or a ridge (the camera looks north, so the rock is behind
them). Nothing that was there moved: the scenes have their own random stream, and the depth's own props are the same with the scenes on
or off (floors 31 and 35).

**Light:** the dark law reads only the floor's own lights (crystals, lamps, waystones). A scene's glow (a lamp's glass, a candle's
flame, crystal shards in a crate, the sunken boat's lantern) is the depth's unlit vertex colour: it reads as lit and gives no light,
and there are only a few of them.

## The scene kinds

| Kind | What it shows | Where |
|---|---|---|
| camp | the miners' last camp: two bedrolls (one still rolled), a cold fire ring and its kettle, tin plates and mugs, a pack, a lamp on the ground; against a rock, the cold stove, a lamp hung from its post, picks leaned on the rock | by the rest and the camp, open floor, against a rock |
| cart | a cart off its rails: against a rock, the cart on its side; elsewhere its loose wheel set; ore spilled with crystal chips in it, a rail bent up, sleepers knocked askew | by the cart yard, open floor, against a rock |
| collapse | timbers fallen across each other, rock come down, a miner's helmet with its lamp out; against a rock, a frame leaned on it | by the old shaft, open floor, against a rock |
| harvest | a crystal harvest: open crates of glowing shards, the lid off, shards spilled on a tarp, cut stumps, the sledge and chisels | by the crystal halls, open floor |
| survey | a survey left behind: a map on the ground weighted with stones, a spyglass and compass, a pack; the tripod fallen, or against a rock standing over a board with the map pinned | by the shore and the pools, open floor, against a rock |
| winch | a winch with its chain snapped, the hook, the skip overturned and its ore out | against a rock only |
| shrine | stacked stones with a candle, stubs at the foot, coins and a shard left | where a track ends on another, by the pools and the well |
| wreck | a rowing boat half sunk in the black lake, bow up, its lantern still lit, an oar and a crate afloat | out on the lake, past the edge, never in the south |

A rope bridge's broken end over the south drop was made first and dropped: the south edge is under the game's HUD, and a player
never sees it there.

## How they are placed

Each floor's mix comes from its own seed (every kind 2 or 3 times, one of the five common kinds only once, another two more; the
wreck on four floors in five; at most 22). In order: shrines where tracks meet; a scene by each place that suits it; up to five tall ones
right south of a piece of cover; up to four on the open cave floor; one every 40 to 55 m of track; the wreck out on the lake. Every part
keeps 3 m from its edge to the floor's spots (keep.ts), 2.4 m off a track's middle, 2.6 m off a place, 7 m off the turntable, off the
cover, the pools and the depth's own props, inside the outline and off the water; parts taller than the knee (0.56 m) only with cover
right north of them. The tracks' verges were already full of the depth's frames, sacks and ore, so most scenes stand by the places, in
the open and against the rocks.

Everything is built once for the page and copied by a matrix into the depth's own batch (one mesh per quarter of the floor on one
material): no new draw calls, no new lights.

## Scenes per floor

| Floor | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes | 16 | 16 | 16 | 18 | 18 | 16 | 15 | 17 | 18 | 16 |
| Build (ms, desktop) | 16 (the first floor also makes the shapes) | 7 | 5 | 3 | 6 | 6 | 3 | 6 | 7 | 8 |

## The pictures

From the game's own camera on floors 31 (the Lightless Deep), 35 and 38, the dark law's layer hidden so the props can be judged:
`fNN-<kind>-mid-before.jpg` / `-after.jpg` (zoom 1.25), `-close-` (zoom 0.7); `fNN-sheet.jpg` has every pair side by side. The wide
shots: `f35-wide-lake-*` (a free camera over the black lake and the wreck) and `f35-wide-west-*` (the floor's west half from high
up). In play the dark law's circle shows a scene only near the hero or a light.

## The checks (2026-11-14)

- **Overlap probe** (`pipeline/tools/scenes-probe-sd.js`): 0 hits on all ten floors.
- **`_worldCheck`, floors 31 to 40:** nothing unreachable; reachable 33,301 to 33,964 m²; most units near any point 4 or 5, at the same
  places as the depth's notes.
- **Nothing moved:** the depth's own props are the same list with the scenes on and off; the floors' mesh counts are the same (175 and
  186 on floors 31 and 35).

## Speed (both chapters)

`perf.py scenes --profiles desktop,phone-4x --scenes world-3,gen-26,world-4,gen-35,gen-32`, 1500 frames each: A with the scenes off
(`VITE_NO_SCENES=1` at perf.py's own server), B with them on, back to back twice (A1, B1, A2, B2), other agents running at the same time.
Median / p99 frame (ms):

| Profile, scene | A1 | B1 | A2 | B2 | draws A/B | triangles A/B | fight print |
|---|---|---|---|---|---|---|---|
| desktop world-3 | 15.3 / 33.6 | 9.9 / 22.9 | 11 / 29.3 | 9.8 / 24.7 | 187 / 187 | 358k / 397k | d69d7802 |
| desktop gen-26 | 12.3 / 38.9 | 7.9 / 28.5 | 7.5 / 27.8 | 8.6 / 33.2 | 250 / 251 | 376k / 407k | 361c2602 |
| desktop world-4 | 8.5 / 22.4 | 6.5 / 15.9 | 6.8 / 16.9 | 6.6 / 15.8 | 154 / 154 | 317k / 325k | a9a39789 |
| desktop gen-35 | 6.6 / 14.4 | 7.5 / 16.8 | 7.2 / 17.1 | 7.6 / 22.7 | 171 / 171 | 343k / 347k | 5f524a6f |
| desktop gen-32 | 7.2 / 14.8 | 6.6 / 15.2 | 7.7 / 23 | 8.2 / 15.7 | 184 / 184 | 340k / 347k | 33f2f3dd |
| phone-4x world-3 | 43.4 / 113.3 | 40.9 / 113.3 | 43.3 / 164.2 | 51.4 / 133.2 | 194 / 194 | 360k / 401k | d69d7802 |
| phone-4x gen-26 | 37.6 / 157.4 | 32.9 / 129.4 | 38.9 / 179.6 | 36.7 / 159.2 | 255 / 255 | 376k / 407k | 361c2602 |
| phone-4x world-4 | 31.2 / 93.4 | 27.8 / 74.3 | 28.4 / 63.4 | 33.3 / 80.7 | 157 / 157 | 318k / 325k | a9a39789 |
| phone-4x gen-35 | 31.8 / 73.4 | 31.9 / 83.3 | 30.2 / 61.5 | 32.4 / 62.4 | 174 / 174 | 343k / 347k | 5f524a6f |
| phone-4x gen-32 | 34.3 / 60.8 | 32 / 68.7 | 33.6 / 65.6 | 35 / 69.6 | 189 / 189 | 341k / 348k | 33f2f3dd |

- **The same fights** in every run (the prints match each other and the depth passes' notes).
- **Draw calls: the same** on every scene but desktop gen-26 (one more: a background scene in an otherwise empty 96 m square of the
  Sands' depth). Triangles: about 30k to 40k more on a Sands floor, 4k to 8k on a Deep floor.
- **Frame times:** inside the noise. The A runs alone differ by up to 4 ms on desktop world-3 and 2 to 5 ms on the phone. B is level or
  faster on most pairs. Two B numbers are higher than both A runs: phone world-3 in pair 2 (51.4 ms against 43.3 and 43.4; B1 was 40.9)
  and desktop gen-35 (7.5 and 7.6 against 6.6 and 7.2). Neither repeats in the other B run, so neither is a cost I can show.
- **Floor build time on the phone profile** (`arena.build()` with the processor slowed 4x as phone-4x does, scenes off and on in turns,
  4 builds each, ms): floor 21 off 4761 to 5441, on 4384 to 4829; floor 26 off 4878 to 6578, on 4479 to 5021; floor 31 off 8674 to 9848,
  on 8360 to 8960; floor 35 off 8646 to 9589, on 8305 to 9123. On is no slower. The scenes' own build is 3 to 35 ms on desktop (the
  table above under "Scenes per floor"), lost in the build's own swing. These totals are higher than the 3.5 s the Deep's notes give
  for floor 35: this times a build in a windowless page with no warm caches beyond one first build, so compare off and on, not with
  those notes.
- The perf result files were deleted afterwards.
