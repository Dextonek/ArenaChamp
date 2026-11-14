# Scenes on the sea's floors (1 to 10): little stories told in props

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". The code is `src/tower/world/scenes/sea.ts`, called from the sea's depth (`depth.ts`). **Looks only:** nothing in it is cover;
walking, pathing, fights, the AI and the checks are as they were. `?scenes=off` in the address leaves them out.

- `fNN-sheet.jpg`: floor NN, every view below, before (left) and after (right). Start here.
- `fNN-<view>-before.jpg` / `-after.jpg`, from the game's own camera: `mid1`, `mid2` (zoom 1.5), `close-*` (zoom 0.8), `beach-*`
  (a scene past the walkable edge). Floor 1 also has `wide` (a high camera, fog lifted for that picture only) and `far-capsized`.
  Floors 1 (the Drowned Harbour), 4 (the Sunken Mile) and 8 (the Anchorage).

## The kinds

On the walkable ground (nothing above knee height, 0.55 m, so nothing hides a hero or stops a walk):

| Kind | The story |
|---|---|
| stall | a fish stall knocked over: its board and awning down, baskets tipped, the catch spilled in a fan |
| fire | a fire on the shore just left: a ring of stones, the kettle on them, a bedroll, a pack, driftwood seats, a rod |
| fight | a fight's aftermath: a banner down, a shield split in two, a cutlass, a boarding pike, a helmet, arrows in the ground |
| cart | a fish cart tipped off the road: tray upside down, a wheel off, its tarp, crates and fish spilled |
| nets | a net being mended: spread on the grass, the rest heaped, floats in a basket, a stool |
| smugglers | smugglers surprised: crates broken open, bottles rolled out, sacks, a dropped lantern |
| washing | the washing blown down: props fallen, the line and the clothes in the grass, the basket tipped |
| barrels | the lighthouse keeper's oil barrels rolled off, one spilled, his lantern dropped |
| anchor | an anchor dragged ashore, its line out to a broken mooring stump, the rope's end frayed |
| memorial | a cairn for the drowned: an oar laid before it, a wreath, candles, a ring of stones |
| pots | lobster pots left to the gulls: on their sides, crab shells, feathers, a float on its line |
| flotsam | wreckage washed up: a hatch cover, a broken cask and its staves, a spar and its rope, weed |
| barrow | the salt barrow tipped, its salt spilled (the salt-pan floors, 4 and 5) |

Past the walkable edge (tall things allowed; never south of the walkable ground, between the camera and a hero):
`rowboat` (hauled up at the water's edge, oars, its little sail down), `netframe` (a net hung on its frame, half heaped below),
`potstack` (pots stacked to dry, one fallen), `mooring` (a post with its rope parted, the anchor fast in the sand), and out at sea
`capsized` (a ship keel-up on the far rocks, her mast broken off).

A first version had a washed-up chest with coins; it was dropped because it could pass for one of the floor's caches.

## How they are placed

Each kind is a list of parts in its own frame, built from shapes made once a floor, placed turned, mirrored and varied (how many
fish, arrows, seats; which crates) by the floor's own random stream (`seeded(6161 + seed)`; the zone's and the depth's streams are
untouched, so nothing that was there moved). Ground scenes are drawn 1.3 times life size so they read from the high camera; a part
that this would lift over the knee is drawn flatter. Gold trim is drawn matte (brass) inside the merged dressing. Per floor each kind has a cap of 1 to 4, so floors differ.

1. One near each place that suits it, outside its stand: a stall or a cart by the market, washing or a fire by the village, barrels
   by the lighthouse and the beacon, flotsam or an anchor by the wreck, a memorial by the chapel, a fight by the fort, smugglers by
   the caves, a barrow by the salt pans.
2. Along the roads, about one every 34 to 52 m, on the verge.
3. In the open ground between the places (up to 7).
4. On the beach and the land past the edge (up to 6), and one wreck far out on the rocks.

Every part keeps 3 m off the floor's spots (`floorKeep`: start, camp, lore, people, packs and patrols, waystones, caches, doors, quest
steps), 2 m off the roads' middles, off the cover, the places' stands, the tidal flats as drawn, the depth's props, and the land's
houses, jetties, boats, trees and the harbour file's props (each by half its length and its radius).

## Numbers

Scenes a floor (from the probe): 1: 26, 2: 22, 3: 22, 4: 25, 5: 22, 6: 27, 7: 24, 8: 20, 9: 23, 10: 27 (1 to 4 of them past the
edge). Over the ten floors: memorial 22, barrels 22, stall 21, pots 21, anchor 19, flotsam 19, fire 17, nets 17, washing 15, fight
15, cart 12, mooring 11, capsized 10, smugglers 9, rowboat 4, barrow 2, potstack 1, netframe 1. The tall beach kinds are rare: the
dry sand past the edge is 1.5 to 4 m wide. No kind is missing.

## Checks

- **Overlap probe** (`pipeline/tools/scenes-probe.js`, run on the page: `await _scenesProbe([1, 2, ..., 10])`): builds each floor's zone
  as the game does and checks every placed part's footprint, sampled every 0.5 m, against the floor's own data. Zero hits on all ten
  floors.
- **`_worldCheck`**, floors 1 to 10: nothing unreachable, 34,825 to 35,004 m2 reachable, most units near a spot 5, as before (it reads
  only the floor's data, which this pass does not touch).
- **`npx tsc --noEmit -p .`** clean, **`npm run build`** passes.

## Speed (both chapters, measured together)

- **Frames, `perf.py scenes --scenes world-1,gen-6,world-2,gen-14`** (floors 1, 6, 11, 14), before = the base commit d29ea95 served
  from a second checkout (`--root`), after = this branch; the same fights in every run (prints unchanged). Medians in ms, before
  then after:

  | Pair | desktop world-1 | desktop gen-6 | desktop world-2 | desktop gen-14 |
  |---|---|---|---|---|
  | 1 (before first) | 8.5, 8.3 | 8.7, 9.3 | 6.5, 7.2 | 7.4, 7.7 |
  | 2 (before first) | 7.0, 8.5 | 8.3, 9.4 | 6.4, 8.4 | 8.2, 8.6 |
  | 3 (after first) | 8.3, 8.5 | 9.2, 9.0 | 6.8, 7.3 | 7.1, 7.6 |
  | 4 (after first) | 7.8, 9.0 | 8.1, 9.7 | 7.2, 7.0 | 7.0, 7.5 |
  | 5 (before first, lighter scenes) | 6.9, 6.4 | 8.2, 8.1 | 6.4, 6.6 | 6.1, 6.6 |
  | 6 (after first, lighter scenes) | 7.0, 7.1 | 7.4, 9.1 | 6.2, 6.0 | 6.3, 7.3 |

  **What that says:** the first version was slower on desktop in 13 of 16 pairs (0.45 to 0.8 ms on average, 6 to 10 %): the sea's
  scenes opened 22 more meshes (their gold trim in squares that had no polished gold) and both chapters added 25k to 40k triangles. Gold
  in scenes is now drawn matte in the merged dressing (as the Deep's depth did) and their round shapes have fewer segments: 10 to 14
  more meshes on a sea floor, 0 to 2 on a Wood floor, draw calls +0 to +1 in the perf scenes, triangles +3k to +11k. With that (pairs 5
  and 6) desktop goes both ways and is within the noise, except gen-14 (floor 14), slower in both pairs (+0.5 and +1.0 ms).
  Phone-4x (pairs 1 and 2, the first version): medians both ways (x0.89 to x1.17), within its spread. Memory churn up about 1 to 2 MB
  a second on world-1 and world-2 in the first version's pairs, not explained (the scenes allocate nothing per frame); about level in
  pairs 5 and 6 except world-2's pair 5 (+1.9). The final trims (fewer tries, baked geometry) only make the scenes cheaper to build
  and were not timed frame by frame again.
- **The delivered code, timed again** (base commit d29ea95 from a fresh checkout; the same four scenes; prints unchanged). `step` is the
  simulation's time a frame, which static props cannot change, so it shows how busy the machine was during each run. Desktop medians
  (and step), before then after:

  | Pair | world-1 | gen-6 | world-2 | gen-14 |
  |---|---|---|---|---|
  | 1 (before first) | 6.2 (0.8), 7.5 (1.1) | 6.5 (0.8), 10.0 (1.2) | 5.2 (0.6), 9.5 (1.0) | 5.7 (0.8), 6.8 (1.1) |
  | 2 (after first) | 7.4 (0.9), 7.9 (0.9) | 7.6 (0.9), 8.1 (0.9) | 7.4 (1.0), 6.0 (0.8) | 6.7 (1.0), 6.4 (0.9) |
  | 3 (before first) | 7.9 (0.9), 8.5 (1.0) | 9.2 (1.0), 9.0 (1.1) | 5.9 (0.8), 6.6 (0.9) | 6.0 (0.9), 7.7 (1.1) |

  Phone-4x, pair 1: 30.4, 31.6; 31.4, 35.9; 22.4, 25.5; 29.4, 31.5 (step 8.6 to 9.7 before, 8.9 to 10.7 after); longest frames 383,
  385; 525, 538; 228, 259; 326, 343. **What that says, plainly:** pair 1 is not a fair pair (step up 40 to 60 % and memory churn about
  doubled during the after run: other agents were working). In pair 2, the one with equal step, the scenes are within the noise (-1.4 to
  +0.5 ms). In pair 3 floor 14 (gen-14) is 1.7 ms slower with step up 0.2. So: no clear cost on desktop, but not a clean proof of none
  either, and floor 14 is the scene to watch; a quiet machine would settle it. The perf tool's `longest` frame is not the zone's build
  (that happens before the timed frames), so the build is measured on its own below.
- **Build time, processor slowed 4 times (the phone profile),** each zone built in a page after a warm-up build, three times each way
  alternating, medians in ms, scenes off then on: floor 1 8133, 8385 (+252); floor 6 7866, 8081 (+215); floor 11 5636, 5919
  (+283); floor 14 5688, 5910 (+222). (The first version added 340 to 640; the scenes now try a scene's middle first, try fewer
  spots, look things up in an 8 m grid and hand each scene to the merged props as one geometry a colour.)
  **Read the added milliseconds, not the percentages:** this page builds the whole zone (land, painted ground, depth) in 5.6 to 8 s at
  4x, so it is not the same measure as the 0.6 s given for floor 1 on the phone profile in pipeline/designs/tower-50.md; against a
  smaller base the same 215 to 283 ms would be a larger share.

## The second pass: bigger, clearer, fuller (2026-11-14, "continue more refine")

Pictures: `refine/fNN-sheet.jpg` (start here; before left, after right), floors 1, 4 and 8, and `refine/fNN-<view>-before.jpg` /
`-after.jpg`: `mid1`, `mid2` at the game's own zoom (1.25), `close-*` (0.8), `beach-*` (past the edge); floor 1 also `wide` (from above
over its busiest stretch, fog lifted for that picture). **"Before" is tower-50 with its first-pass scenes**, and the scenes moved, so a
before picture shows tower-50's nearest scene of the same kind (or the same spot, for a kind tower-50 did not have); the caption says
which.

What changed:

- **A clear main piece, big enough to read.** The ground scenes are drawn 1.45 times life size (was 1.3) and each has one large flat piece
  in a clear colour: the stall's striped awning, the tent come down by the fire, a torn sail or the ship's wheel, the banner or a shield
  wall with its drum, the cart's tray and tarp, the oars laid round the cairn like rays or the bow of the lost boat. Large cloths are in
  a new duller `canvas` colour (cream glared next to the hero's light). The anchor and the mooring post the lead found hard to see:
  the anchor is now iron a shade lighter (`iron`) with a wooden stock and a gilt ring, its cable out to a heap of coils (or a chain to a
  broken stump); the post is thicker, with a wine band between two gilt rings and a rope wound twice.
- **Their own ground.** Each scene paints into the land's map (the painted middle of `land.ts`, 14 to 18 pixels a metre; no triangles,
  no draw calls): a trodden patch of earth under it, a scorch under a fire, a black pool of oil under the barrels, wet ground under nets
  and fish, a pale fan of salt or grain, two wheel ruts from the nearest road to a tipped cart, and the furrow an anchor left, dragged up
  from the sea. Each patch is shrunk to keep off the roads' middles, the places' stands and the tidal flats.
- **More of them where players walk.** Along the roads one every 20 to 30 m on alternate verges (was 34 to 52), trying both verges and
  three distances; one at each fork; up to 14 round the floor's spots (6 to 10 m off them, so 3 m off still holds); the places that suit
  them get two when they are big. **Echoes** between: a small piece of the scene ahead dropped on the verge 8 to 14 m before it (a crate
  off the cart, fish from the stall, arrows towards the fight, a barrel and its stain). They are recorded with `echo` and are not counted
  as scenes.
- **Variety.** Each kind has two or three ways (which main piece, which load, which state), and new kinds: `drying` (a catch laid out on
  a sailcloth, the rack knocked flat) on the ground; past the edge `caulk` (a boat upside down on trestles being caulked, the tar pot on
  its fire), `fishrack` (split fish hung on a pole between two A-frames) and `tidecart` (a cart sunk to its hubs at the tide line, its
  shafts in the air). The pots now spill from a tipped hand-cart, the barrels from their ramp.
- The checks keep each scene's parts off everything by the parts' real reach (a long anchor cable used to reach past the short list of
  nearby spots; one hit on floor 10 in a trial, fixed), and look up nearby props in the 8 m squares round a wide scene, not all of them.

### Numbers

Scenes a floor (not counting echoes), before and after: 1: 26, 32 (+5 echoes); 2: 22, 32 (+8); 3: 22, 32 (+7); 4: 25, 34 (+8); 5: 22, 37
(+5); 6: 27, 31 (+4); 7: 24, 32 (+5); 8: 20, 35 (+7); 9: 23, 34 (+4); 10: 27, 35 (+5). Past the edge 2 or 3 a floor (the dry beach is
narrow): over the ten floors caulk 3, tidecart 3, fishrack 2, rowboat 2, mooring 5, capsized 10.

**The views probe** (`_scenesViews` in `pipeline/tools/scenes-probe.js`): the hero stands every 8 m along every road and on an 8 m grid
over the walkable ground, the camera is the game's own at its own zoom (1.25), and a view counts when a scene's main piece is in the
picture outside the HUD's bar. Stricter, a scene **reads** when its largest part is at least 60 px across (of 1280 x 720) in the middle
of the picture. The brief's aim: 70 % of road views and 45 % of all views. Before then after:

| Floor | road views | all views | road views that read | all views that read |
|---|---|---|---|---|
| 1 | 64 %, 75 % | 51 %, 62 % | 20 %, 56 % | 17 %, 47 % |
| 2 | 65 %, 85 % | 51 %, 68 % | 25 %, 72 % | 20 %, 49 % |
| 3 | 52 %, 85 % | 45 %, 62 % | 22 %, 78 % | 21 %, 45 % |
| 4 | 77 %, 78 % | 51 %, 71 % | 32 %, 62 % | 16 %, 47 % |
| 5 | 59 %, 82 % | 51 %, 69 % | 18 %, 67 % | 15 %, 50 % |
| 6 | 61 %, 79 % | 52 %, 62 % | 23 %, 60 % | 14 %, 45 % |
| 7 | 65 %, 77 % | 50 %, 68 % | 14 %, 52 % | 15 %, 49 % |
| 8 | 47 %, 84 % | 44 %, 66 % | 15 %, 65 % | 14 %, 48 % |
| 9 | 47 %, 78 % | 46 %, 68 % | 13 %, 58 % | 15 %, 50 % |
| 10 | 64 %, 77 % | 58 %, 62 % | 13 %, 64 % | 18 %, 44 % |

Plainly: the brief's "all views" aim was nearly met before (the game's camera sees about 40 by 30 m), which is why the stricter column
is there; it shows what the lead saw (a scene read in 13 to 32 % of road views) and it is now 52 to 78 %.

- **Overlap probe:** 0 hits on all ten floors (echoes included).
- **`_worldCheck`**, floors 1 to 10: nothing unreachable, 34,825 to 35,004 m2 reachable, most units near a spot 5: the same as before (it
  reads only the floor's data).
- **Build time, phone profile** (processor slowed 4 times, tower-50 from a second checkout and this branch served in turn, three
  alternating rounds of three builds after a warm one; medians of nine): the scenes' own code, floor 1: 253 ms, 372 ms (+119); floor 6:
  259 ms, 392 ms (+133); the merge of the dressing +6 ms on both. The whole zone's build: floor 1 8695, 9688; floor 6 8410, 8851; single
  builds of the same code ranged 8052 to 12382 ms, so the whole-zone medians are mostly noise and the scenes' own timer is the measure.
  Unslowed the scenes take 57 to 67 ms a floor (about 45 before); the dressing gets about 100k vertices from them (71k before).
