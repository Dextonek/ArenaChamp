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
| wreck | a rowing boat half sunk in the black lake, bow up, its lantern still lit, an oar and a crate afloat (half again the landing boat's size, to be seen across the water) | out on the lake, past the edge, never in the south |

A rope bridge's broken end over the south drop was made first and dropped: the south edge is under the game's HUD, and a player
never sees it there.

## How they are placed

Each floor's mix comes from its own seed (every kind 3 or 4 times, one of the five common kinds only once, another two more; the
wreck on four floors in five; at most 24). In order: shrines where tracks meet; a scene by each place that suits it; one every 40 to
55 m of track (at most seven, to leave room for the rest); up to five tall ones right south of a piece of cover; a few on the open cave
floor; the wreck out on the lake. Every part
keeps 3 m from its edge to the floor's spots (keep.ts), 2.4 m off a track's middle, 2.6 m off a place, 7 m off the turntable, off the
cover, the pools and the depth's own props, inside the outline and off the water; parts taller than the knee (0.56 m) only with cover
right north of them. No shrine has found room where tracks meet: the forks are at the turntable, which every scene keeps 7 m from.

Everything is built once for the page and copied by a matrix into the depth's own batch (one mesh per quarter of the floor on one
material): no new draw calls, no new lights.

## Scenes per floor

| Floor | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes | 20 | 20 | 21 | 22 | 23 | 20 | 19 | 21 | 22 | 20 |
| By a place / the track / a rock / open / the lake | 11/7/1/0/1 | 8/7/4/0/1 | 10/7/3/0/1 | 11/7/2/1/1 | 8/7/5/2/1 | 9/7/4/0/0 | 10/7/2/0/0 | 10/7/4/0/0 | 10/7/3/1/1 | 9/7/2/1/1 |
| Build (ms, desktop) | 29 (the first floor also makes the shapes) | 8 | 10 | 11 | 10 | 11 | 12 | 12 | 11 | 10 |

## The pictures

From the game's own camera on floors 31 (the Lightless Deep), 35 and 38, the dark law's layer hidden so the props can be judged:
`fNN-<kind>-mid-before.jpg` / `-after.jpg` (zoom 1.25), `-close-` (zoom 0.7), `fNN-wide-wide-*` (the game's farthest zoom);
`fNN-sheet.jpg` has every pair side by side. The wide shots from a free camera: `f35-wide-lake-*` (over the black lake and the wreck)
and `f35-wide-west-*` (the floor's west half from high up). In play the dark law's circle shows a scene only near the hero or a light.

## The checks (2026-11-14)

- **Overlap probe** (`pipeline/tools/scenes-probe-sd.js`): 0 hits on all ten floors.
- **`_worldCheck`, floors 31 to 40:** nothing unreachable; reachable 33,301 to 33,964 m²; most units near any point 4 or 5.
  `_worldCheck` reads only the floor's data, which the scenes do not touch, so it is unchanged by construction; these match the
  depth's notes.
- **Nothing moved:** the depth's own props are the same list with the scenes on and off; the floors' mesh counts are the same (175 and
  186 on floors 31 and 35).

## Speed (both chapters)

Measured on the first layout (the same kinds, two to four fewer scenes a Deep floor; the roadside pass was moved earlier afterwards).
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
- **Floor build time on the phone profile** (`arena.build()` with the processor slowed 4x as phone-4x does). The whole build swings by
  about a second from one build to the next (floor 21: 4.4 to 5.4 s; floor 26: 4.5 to 6.6 s; floor 31: 8.4 to 9.8 s; floor 35: 8.3 to
  9.7 s; floor 38: 10.1 to 10.5 s), so scenes off against on cannot show a cost of this size. The scenes' own part, timed inside the
  build: 75 to 132 ms on floors 21, 26 and 29, 52 to 131 ms on floors 31, 35 and 38: 1 to 2% of the build. Small, but it is added. Why
  these builds take longer than the 3.5 s the Deep's depth notes give for floor 35 is not explained here.
- The perf result files were deleted afterwards.

## The refinement (2026-11-14, "continue more refine")

The lead, on the first pass: too small to read, floating, too few in view; the cart and the survey read, the winch and the collapse were
a few sticks. What changed (`src/tower/world/scenes/deep.ts`; `deepDepth.ts` and `deepZone.ts` only hand the scenes the cave floor's
canvas, one line each: the canvas is made in the zone file and nowhere else):

- **Main pieces that read, under the knee:** the camp on a 3 x 2.3 m tarp (or its plank table fallen flat), the cart's ore tub upside
  down and 1.45 times wider with its ore fanned out, the collapse as a great heap of fallen rock (4 x 3 m) in paler stone than the
  trodden floor (it was dark on dark) under its fallen timbers, the harvest with three crates of shards on a tarp, the survey's map twice
  the size and a measuring line pegged out 5 m across the floor; the winch drawn 1.35 times with its chain run out, its skip, and the
  pulley wheel fallen flat.
- **Three new kinds:** a **derailed train** at a rail junction (a spur of rails and its branch on their sleepers, the points' lever
  lying, three ore tubs: one still on the rails, one jack-knifed off them, one upside down with its ore spilled), a **lift's cage** fallen
  at the shaft's foot (the shaft's mouth ringed with stones and a gold line, the cage crushed flat, the cable coiled, the head-frame's
  pulley wheel; against a rock, the cage on its side), a **flooded camp** where the black lake rose (puddles with pale rims, the tarp
  drowned, crates and a barrel half in the water, a bedroll, a lamp on its side), only by the lake's edge.
- **A ground of their own,** painted into the cave floor's canvas before it is drawn (no geometry, no draw calls, never on a place):
  ash round the fires, trodden ground, ore dust fanned from the spills, rock dust from the collapse, violet dust at the harvests,
  puddles; footprints or a drag mark from a scene back to its track.
- **Echoes:** about 20 single props a floor on the tracks' verges between the scenes (ore and chips, a dropped lamp, a pick, a sack, a
  helmet, a loose sleeper, a coil of rope).
- **More of them:** one every 26 to 36 m of track (was 40 to 55, at most seven), either verge; the places' surroundings take the new
  kinds (the yard a derailed train, the shaft a fallen cage, the shore a flooded camp); up to 30 on the walkable floor (was 24); the
  wreck placed early so the caps never leave it out.

### The views probe (the same as the Sands', `pipeline/tools/scenes-probe-sd.js`; echo props not counted)

| Floor | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes before / after | 20 / 28 | 20 / 30 | 21 / 29 | 22 / 30 | 23 / 31 | 20 / 31 | 19 / 29 | 21 / 31 | 22 / 27 | 20 / 29 |
| Echo props after | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 |
| Track views, in frame (%) | 70 / 81 | 66 / 86 | 72 / 84 | 69 / 87 | 83 / 88 | 69 / 95 | 71 / 88 | 81 / 93 | 87 / 85 | 74 / 92 |
| All views, in frame (%) | 51 / 65 | 48 / 66 | 57 / 71 | 56 / 67 | 67 / 77 | 58 / 79 | 58 / 72 | 61 / 73 | 63 / 70 | 57 / 72 |
| Track views, inner 80% (%) | 49 / 56 | 48 / 59 | 50 / 60 | 52 / 78 | 62 / 68 | 49 / 78 | 55 / 77 | 56 / 74 | 65 / 63 | 49 / 73 |
| All views, inner 80% (%) | 36 / 48 | 34 / 51 | 39 / 53 | 42 / 54 | 46 / 56 | 38 / 57 | 39 / 56 | 43 / 54 | 45 / 51 | 40 / 54 |

The aim (70% of track views, 45% of all) is met in frame on every floor; in the inner 80% of the screen all views meet it on every
floor and track views on five (31, 32, 33, 35 and 39 stay at 56 to 68%; floor 39's went from 65 to 63%).

### The checks

- **Overlap probe:** 0 hits on all ten floors.
- **`_worldCheck`, floors 31 to 40:** the same as before: nothing unreachable, reachable 33,301 to 33,964 m², most units near any point
  4 or 5.
- **Build time on the phone profile** (processor slowed 4 times; old and new code alternated in one session, two builds each): the
  scenes' own time 48 to 66 ms before, 46 to 100 ms after (about +25 ms); the whole depth (`buildDeepDepth`, which also copies the
  scenes into its meshes) 191 to 275 ms before, 200 to 330 ms after. Both well inside the +150 ms bar and the build's own swing.
- Pictures: `refine/fNN-sheet.jpg` (floors 31, 35, 38; before left, after right; mid and close from the game's camera with the dark
  law's layer hidden, as in the first pass) and the single pictures beside them; `refine/f35-wide-*` at the game's farthest zoom.
