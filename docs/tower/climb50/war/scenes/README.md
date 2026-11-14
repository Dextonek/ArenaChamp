# The War's scenes (floors 41 to 50)

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". The War's depth pass dressed the roads, the field and the places; this pass puts **stories** between them: small groups of
props, 3 to 14 m across, that show something happened there. Looks only: nothing is cover, nothing changes a walk, a shot, the paths,
the fights or the checks. Code: `src/tower/world/scenes/war.ts`, called last from `warDepth.ts`.

The first pass's pictures: `index.html` in this folder, every picture pair side by side (before left, after right). From the game's camera:
`close` is zoom 0.7 to 0.8, `mid` zoom 1.7 (the farthest a player can zoom out), the past-the-edge stories from just inside the
outline at zoom 1.7. `f49-wide-after.jpg` is a wide view over floor 49's middle (the camera lifted past the player's limit, for the
picture only; its `-before` is the same view without the scenes).

## The refinement (2026-11-14, "continue more refine")

The lead's notes on the first pass: the aftermath field, the last stand and the stretchers read well; the satchel, the saddle and the
stakes were small at the game's camera; everything is matte and casts no shadow, so the scenes floated. **Start with `refine/index.html`**
(or the sheets `refine/f41-sheet.jpg`, `f46-sheet.jpg`, `f49-sheet.jpg`: before, the first pass, left; after right; the same spot from the
game's camera: `mid` at the default zoom 1.25, `close` at 0.62, `edge-farmhouse` at 1.7, `wide` lifted past the player's limit).

What changed (all in `src/tower/world/scenes/war.ts`):
- **A main piece at the middle of every story**, big enough to read: a great standard fallen flat (a 1.7 by 2.6 m cloth with a gold
  border, its 4.8 m pole), or a war cart's bed down in the mud with its wheels off (aftermath); the catapult 1.4 times larger, a great
  bow-engine with a 3.4 m bolt, or the catapult burned black and still smoking (engine); a courier's black chest with gold bands and a
  5 m trail of papers (was a satchel); a 2.6 by 1.8 m caparison with a gold border (saddle); a ditch, its thrown-up earth, four rows of
  pale-tipped stakes and a palisade panel, or three spiked logs (stakes); a stone forge (smithy); a field awning blown flat or six
  stretchers in a row (hospital); the army's banner laid along a row of five to eight graves. Footprints 1.3 to 2 times the first pass.
- **A ground of its own**, painted into the zone's own map (no triangle, no draw call): churned mud and footprints where lines met, a
  trampled ring round a last stand, ash and trodden earth round a fire, scorch round what burned, fresh earth on graves and dug ditches,
  wheel ruts and drag marks from a cart, an engine or the wounded's place to the road's verge (stopped short of the paving and the
  places), hoof marks running off, spilled grain fanned out from a split sack, a soft dark under each big piece (the shadow it does not
  cast). Past the edge, where the map does not reach, a draped disc of the scene's ground whose rim is the ground's own colour.
- **Six new kinds**: a broken **trench** (sandbags two high along both lips, duckboards, one lip caved in and its bags spilled; straight
  or turning a corner); a **ram** left by the siege line (a 6.2 m log with an iron head and gold bands, its hide roof fallen flat, deep
  ruts); the **drums** (a great kettle drum, or the drummers' line of four side drums and a burst head); a banner **smouldering** (half
  its cloth black on a scorch mark, embers, a thin smoke) or a burned cart; **captured** shields of the other side stacked, their spears
  roped, their banner folded on a crate; a supply tower pulled down (**stores**: its frame on its side, crates spilled in a fan).
- **Two or three layouts a kind** (`v`), the floor choosing which comes first (`first`), so floor 42's aftermath is not floor 45's.
- **Echo props** (`trail`, 12 a floor, 16 on 48 to 50) on the way between a story and the road and between two stories: arrows
  leaning towards the fight, a crate and a split sack fallen from a load, a shield and a helmet, a wheel (on 48 to 50 a stone shot in
  its scar), papers blown along.
- **Placement**: the roads first (where players walk), a story every 26 to 34 m on alternating verges; then the places' own stories,
  then the open ground. 27 to 31 stories wanted on floors 41 to 47, 33 to 37 on 48 to 50 (the counts below are what fitted).
- **Smoke**: a few soft puffs rising 2 to 3 m from what smoulders (5.5 m from the burned farmhouse past the edge): one instanced mesh
  a floor, moved by `warDepth.ts`'s update, no allocation a frame. Floors 48 to 50 the most scarred: more aftermath, trenches,
  smouldering and burned engines.
- **Files outside the scenes file, and why**: `warZone.ts` hands its painted ground map to the depth (one argument: the only way to paint
  the scenes' ground without new triangles or draw calls); `warDepth.ts` passes it on and calls the smoke's update. The off switches
  (`?scenes=off`, `__noScenes`, `__warScenes = false`) leave out the paint and the smoke too.
- **Tools**: `pipeline/tools/war-views-probe.js` (new, below), `pipeline/tools/war-scenes-shots.js` (new: pictures from the game's camera
  on /game, the law's card hidden), `pipeline/tools/war-scenes-probe.js` (also reports how far a built footprint passed its planned
  one, and the plan, build and paint times).

**Views probe** (`python -I pipeline/tools/world-shots.py pipeline/tools/war-views-probe.js --page / --port <port>`). The hero stands
every 8 m along every road and on an 8 m grid over the walkable ground; the game's camera is put where `followCamera` puts it (offset
(0, 15, 10.5) times the zoom, 50 degrees, 16:9). A view shows a story when its main piece is inside the middle 92 % of the frame AND
at least 6 % of the screen's height across (43 px of 720); echo props do not count. Before is the first pass (tower-50, 41552a9),
measured with the same rule (its main pieces by kind). Share of views showing at least one story, %:

| Floor | Stories | Echoes | Road views, zoom 1.25 | All views, 1.25 | Road, 1.7 | All, 1.7 | Triangles |
|---|---|---|---|---|---|---|---|
| 41 | 18 → 30 | 12 | 46 → **88.5** | 39.3 → **72.8** | 70.1 → 97.7 | 61 → 89.9 | 47k |
| 42 | 19 → 28 | 12 | 49.4 → **65.4** | 44.2 → **64.3** | 72.8 → 92.6 | 64.5 → 86.2 | 47k |
| 43 | 18 → 29 | 12 | 47.7 → **83** | 46 → **69.8** | 64.8 → 94.3 | 63.4 → 86.4 | 47k |
| 44 | 16 → 29 | 12 | 54.2 → **78.3** | 40.8 → **71.6** | 73.5 → 92.8 | 57.7 → 86.9 | 47k |
| 45 | 17 → 27 | 12 | 50.6 → **84.7** | 39.1 → **61.4** | 68.2 → 98.8 | 53.6 → 80.8 | 45k |
| 46 | 17 → 28 | 12 | 51.2 → **72** | 45.5 → **72.9** | 73.2 → 98.8 | 64.9 → 92.9 | 49k |
| 47 | 18 → 28 | 12 | 57.3 → **76.8** | 44.9 → **63.9** | 80.5 → 95.1 | 64.7 → 84.9 | 49k |
| 48 | 24 → 34 | 16 | 64.3 → **77.4** | 57.3 → **74.3** | 83.3 → 98.8 | 76.2 → 91.9 | 59k |
| 49 | 25 → 33 | 16 | 74.7 → **85.5** | 55.5 → **72.7** | 88 → 94 | 81.5 → 88.3 | 62k |
| 50 | 24 → 36 | 16 | 59.5 → **86.9** | 53.3 → **79.9** | 81 → 98.8 | 71.8 → 93.8 | 56k |
| **mean** | | | 55.5 → **79.8** | 46.6 → **70.4** | 75.5 → 96.2 | 65.9 → 88.2 | |

The aim was 70 % of road views and 45 % of all views: met on average and on every floor but 42's roads (65.4 % at the default zoom,
92.6 % at 1.7). "Stories" counts the stories, ladders and far stories; the echoes come on top.

**Overlap probe**: 434 scenes (stories, ladders, far stories and echoes), **0 hits** on floors 41 to 50; the tallest thing in the open
ground 0.6 m.

**`_worldCheck`**, floors 41 to 50: nothing unreachable, reachable 34 942 to 35 171 m2, at most 6 units near any point: unchanged.

**Speed** (`perf.py scenes --scenes world-5,gen-46,gen-42 --no-pictures`, A with `--set "{\"globals\": {\"__warScenes\": false}}"`,
B on; off, on, off, on, back to back while other agents ran). Median frame in ms, world-5 / gen-46 / gen-42:
- desktop: off 14.4 / 10.4 / 16.2 and 16.4 / 10.0 / 16.2, on 14.9 / 10.0 / 16.1 and 11.5 / 10.0 / 15.6; the card's time 2.0 to 2.4 both
  ways; +2 draw calls (the mesh and the smoke), +43k to +46k triangles; every pair played the same fights (prints 6ff3e790, b2e87242,
  dd44d21).
- phone-4x: draw 31.0 / 30.9 / 32.4 and 39.2 / 35.4 / 36.8 off, 35.5 / 34.4 / 34.6 and 36.3 / 34.1 / 34.4 on: on average 34.3 off and
  34.9 on (+0.6 ms; the off runs alone spread 30.9 to 39.2). Medians 76.9 / 53.3 / 90.1 and 97.9 / 72.0 / 91.3 off, 84.2 / 57.0 / 88.6
  and 87.5 / 58.3 / 82.6 on. Two phone runs of the first pair printed other fights (gen-42 off, after a 63 s stall; gen-46 on); the
  second pair and all desktop runs printed the same ones.

**Build time on the phone profile** (844 x 390, 3 px a point, CPU slowed 4 times; `arena.build()` timed in the page, six builds each,
off and on alternating). The scenes' own work (plan + build, paint included), median: floor 41 **about 90 to 190 ms**, floor 46 **about 90
to 200 ms** (tower-50: plan 13 to 15, build 70 to 84; now plan 16 to 28, build 155 to 175 of which paint 17 to 20): **+100 to +110 ms a
floor**, inside the +150 ms allowed. Whole builds swing about 300 ms either way (medians off/on 2983 / 3149 for 41, 3587 / 3857 for 46).
The first refined build cost +170 to +190 ms; the planner's tests in squared distances (cheapest first), plain fills for the small
marks, a smaller first buffer and ten-sided shields brought it down.

## The first pass

## The kinds

In the walkable ground, knee height (0.6 m) at most:
- **aftermath**: where two lines met: 9 to 15 shields of both armies (each thickest on its own side), swords, helmets, spears, two
  fans of arrows, one or two banners trampled flat, a cart's wheel; on floors 48 to 50 charred planks and blackened shields.
- **laststand**: a ring of one army's shields round its fallen banner, spears laid outward, a helmet, arrows all over.
- **cookfire**: a stone ring round the ash, a big pot on three stones with its ladle, a plank bench with bowls, bedrolls of the army's
  colour, a pack, a log.
- **smithy**: an anvil on its stump, a grindstone in its frame, a quench bucket, a hammer, blades laid out, horseshoes, a bench with
  the army's cloth.
- **hospital**: three stretchers (some with the army's folded blanket), bandage rolls and one unrolled, a basin on a stool, a jug, an
  open chest, folded cloth.
- **engine**: a catapult wrecked where it stood: its frame down, wheels flat, the arm broken in two, rope coils, its stone shot stacked.
- **graves**: three or four low mounds, a sword and a helmet on each, a wreath on one, the spade.
- **depot**: a load still lashed under the army's tarp (the cart gone), crates (two broken open), barrels on their sides, sacks, bound
  sheaves of arrows and loose ones, a fallen spear rack.
- **stakes**: three staggered rows of short sharpened stakes, a few knocked flat, caltrops, the spade and a coil of rope.
- **saddle**: a rider's end without the horse: the caparison of the army's colour crumpled, the saddle on its side, a plumed helmet,
  cut harness, a horseshoe, a broken lance with its pennon, a tipped feed bucket.
- **satchel**: a messenger's satchel, nine papers blown one way (no writing), the seal broken in two, the cord, a helmet.

Against the cover:
- **ladder**: a siege ladder broken in two at the foot of the siege line (or a ruined wall): the stub leans on the wall inside the band
  a hero cannot enter (what rises above the knee stays within 0.5 m of the wall's own radius), the top half lies along the wall, a
  dropped shield, arrows, a helmet.

Past the walkable edge (tall things allowed), 4 to 9 m beyond the stake hedge, never on the camera's (south) side:
- **farmhouse**: burned out: wall stubs in soot, black beams fallen and leaning, the roof's frame down, a door frame, the chimney
  standing, a wheel, a chest.
- **tents**: an army's field hospital: two bell tents with its colour, its banner on a pole, four cots in a row, a basin, chests.
- **graveyard**: two rows of mounds, a sword upright in each with a helmet on its hilt, a wreath, a torn banner of the army.
- **watchtower**: fallen in pieces: its frame on its side, the platform and the roof apart, its ladder and planks strewn.

**Colours.** A scene on a side of the field (`look.crimson` says which) uses that army's colour; the middle ground (within 26 m of the
middle, between the lines) holds both. All parts are clean forms in the heroes' palette, one flat colour a part, gold trims; "broken"
is shown by clean pieces lying apart (STYLE.md rule 1).

## How they are placed

On the floor's own stream (`seeded(8803 + look.seed)` to plan, `8807` to build), never `Math.random`, the zone's or the depth's: nothing
that was there moves, and the scenes are built after everything else so every earlier object keeps its id. The floor's number (read
from the arena's id) decides how scarred it is.
1. One or two past-the-edge stories (three on floors 48 to 50), each kind once.
2. Up to two ladders on the siege line's field side (or a ruin's wall).
3. By the places, the stories that belong to them (80 % each): the hospital → stretchers, graves; the works → the engine, a depot;
   the wagons → a depot, a saddle; the keep → graves, a last stand; the hill → a last stand, an aftermath; a ridge → stakes, a
   cook-fire; a farm or mill → a saddle, a cook-fire; the camp → the smithy; the siege line → an aftermath, an engine.
4. Beside the roads, one try about every 46 to 60 m, on the verge (never the middle); then the open ground until the floor's count.
   In the middle ground: aftermath, stakes, satchels, last stands, saddles, engines; on the sides: cook-fires, stretchers, depots,
   graves, saddles, smithies, aftermath. Floors 48 to 50 add more aftermath and stakes.
- **Counts:** 16 to 19 scenes on floors 41 to 47, 23 to 25 on 48 to 50, each kind capped (aftermath 3, 6 on the scarred floors; most
  others 1 or 2), some caps lowered by the floor's draw so floors differ.
- **Clear of:** 3 m (3.2 planned) round every floor spot (`keep.ts` `floorKeep`: start, camp, lore stone, people, packs and patrols,
  waystones, caches, doors, every quest step), the cover's bodies, 2.5 m round the roads' lines, the places' rounds (1.5 m more), the
  depth's own big props (milestones, banner poles, stakes, carts, the places' dressing, the near trees: `warDepth.ts` records where it
  put them, adding no draw of its stream), behind the siege line, and 4 m from each other.
- **The keep spots are points** (as `floorKeep` gives them): a patrol's or an escort's way between two of its points is not a spot. The
  escorts' ways run on the roads, which the scenes keep off; a patrol may walk past a scene, which is only looks.
- **Grass under a scene:** the depth's grass tufts, strewn arrows, helmets and spears that would stand up through a scene's cloth are
  left out under it (about 140 instances a floor). Nothing else of the depth changes.

## The numbers (2026-11-14)

**Scenes per floor** (open ground / leaning on a wall / past the edge):

| Floor | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes | 18 | 19 | 18 | 16 | 17 | 17 | 18 | 24 | 25 | 24 |
| Split | 13/2/3 | 16/2/1 | 15/2/1 | 13/1/2 | 12/2/3 | 14/2/1 | 14/2/2 | 19/2/3 | 20/2/3 | 19/2/3 |
| Triangles | 22k | 20k | 20k | 18k | 20k | 23k | 23k | 38k | 34k | 32k |

**Overlap probe** (`python -I pipeline/tools/world-shots.py pipeline/tools/war-scenes-probe.js --page / --port <port>`): every
scene's footprint measured from its built vertices, checked with the probe's own maths against the keep spots (3 m), the roads'
middles (the paved band), the cover, the places' rounds, the outline (inside it, or past the stake hedge for the far stories), behind
the siege line, the depth's props, each other, and knee height. **196 scenes, 0 hits** on floors 41 to 50; the tallest scene in the
open ground is 0.6 m. Tried with the planner's keep and road clearances switched off: it reported the keep spots and roads it should.

**`_worldCheck`**, floors 41 to 50: nothing unreachable; reachable 34 942 to 35 171 m²; at most 6 units near any point. The same as the
chapter's notes: no floor data changed (the scenes are looks only).

**Speed** (`perf.py scenes --scenes world-5,gen-46,gen-42 --no-pictures`, 1500 frames; A with the scenes off, B on, back to back while
other agents ran; every pair played the same fights, prints 6ff3e790, b2e87242, dd44d21). The switch is a what-if added to
`perf-page.js`: `--set "{\"globals\": {\"__warScenes\": false}}"` (that quoting works in PowerShell 5.1 and in bash). The "final" rows
were run on the one-mesh version before the last trims of the build (typed arrays, shared shapes), which do not touch a frame. Median
frame in ms, world-5 / gen-46 / gen-42:

| Version | Profile | A | B |
|---|---|---|---|
| first (4 meshes, shadows) | desktop | 13.9 / 10.6 / 14.0 and 14.2 / 13.9 / 16.4 | 13.3 / 14.0 / 13.3 and 15.4 / 16.6 / 17.1 |
| first | phone-4x | 52.8 / 54.4 / 65.5 and 60.4 / 47.1 / 76.0 | 68.7 / 49.7 / 75.1 and 72.2 / 54.0 / 75.6 |
| **final (1 mesh, no shadow)** | desktop | 15.8 / 9.7 / 16.4 and 15.2 / 14.8 / 16.8 | 15.1 / 10.2 / 16.2 and 16.5 / 13.5 / 16.9 |
| **final** | phone-4x | 70.5 / 57.4 / 78.3 and 67.8 / 49.7 / 76.3 | 70.0 / 54.2 / 80.3 and 70.0 / 60.2 / 70.4 |

- The first version added 6 draw calls (matte and metal meshes for the open ground and past the edge, and the shadow pass) and 45k
  triangles; on the phone its draw time rose in both pairs on world-5 (23.4 → 27.1 and 23.4 → 29.3 ms). So every scene is now **one
  mesh of one matte material casting no shadow** (as the Deep's depth did): +1 draw call, +20k triangles (world-5 and gen-42) to +21k
  (gen-46). With it the phone's draw time is 28.6 → 28.1, 30.7 → 31.4, 29.4 → 29.7 in one pair and 27.9 → 30.1, 28.1 → 33.1,
  30.4 → 26.8 in the other: on average +0.7 ms, inside the session's own spread (A alone ran 23 to 31 ms). Desktop: level, the card's
  time 2.1 ms in A and B.
- The trade: the scenes' steel and gold are matte (STYLE.md rule 4 asks polished metal), and they cast no shadows (they are low; in the
  pictures the shadows hardly showed).
- "particles" in the perf rows is 140 lower in B: that count includes the depth's instanced grass and arrows, which are left out under
  the scenes. Nothing hit-tests the scene meshes (no raycast against the arena).

**Floor build time on the phone profile** (844 x 390, 3 pixels a point, the CPU slowed 4 times; `arena.build()` timed in the page, six
builds each, off and on alternating): floor 41 median 3092 → 3130 ms, floor 46 3575 → 3781 ms (single builds spread about ±300 ms).
The scenes' own work is 87 to 120 ms of it (planning 12 to 24, building 68 to 96); a profile of floor 49's build puts the scenes at
3.6 % of it (the zone's ground noise and the painted map are most of the rest). On desktop building them takes 9 to 21 ms a floor.

## Checks

- `npx tsc --noEmit -p .` clean; `npm run build` passes.
- No figures, bodies, statues, text, interactables or lore; no change to quests, people, cover, floors or generators.

## Not done, for the lead

- `src/game/changelog.ts` (players will see the scenes) and `docs/STATUS.md` are outside this pass's files.
- `pipeline/tools/perf-page.js` (shared) has one new line for the `globals` what-if; another chapter's pass may add its own switch there.
