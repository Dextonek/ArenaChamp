# The War's scenes (floors 41 to 50)

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". The War's depth pass dressed the roads, the field and the places; this pass puts **stories** between them: small groups of
props, 3 to 14 m across, that show something happened there. Looks only: nothing is cover, nothing changes a walk, a shot, the paths,
the fights or the checks. Code: `src/tower/world/scenes/war.ts`, called last from `warDepth.ts`.

**Start with `index.html`** in this folder: every picture pair side by side (before left, after right). From the game's camera:
`close` is zoom 0.7 to 0.8, `mid` zoom 1.7 (the farthest a player can zoom out), the past-the-edge stories from just inside the
outline at zoom 1.7. `f49-wide-after.jpg` is a wide view over floor 49's middle (the camera lifted past the player's limit, for the
picture only; its `-before` is the same view without the scenes).

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
- **Grass under a scene:** the depth's grass tufts, strewn arrows, helmets and spears that would stand up through a scene's cloth are
  left out under it (about 140 instances a floor). Nothing else of the depth changes.

## The numbers (2026-11-14, final code)

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

**Speed** (`perf.py scenes --scenes world-5,gen-46,gen-42`, 1500 frames, A = `--set '{"globals": {"__warScenes": false}}'` (a switch
added to `perf-page.js`'s what-ifs), B = the scenes on, back to back while other agents ran; every pair played the same fights, prints
6ff3e790, b2e87242, dd44d21). Median frame in ms, world-5 / gen-46 / gen-42:

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
