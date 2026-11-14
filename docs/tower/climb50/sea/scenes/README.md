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
- **Build time, processor slowed 4 times (the phone profile),** each zone built in a page after a warm-up build, three times each way
  alternating, medians in ms, scenes off then on: floor 1 8133, 8385 (+252, +3 %); floor 6 7866, 8081 (+215); floor 11 5636, 5919
  (+283, +5 %); floor 14 5688, 5910 (+222). (The first version added 340 to 640; the scenes now try a scene's middle first, try fewer
  spots, look things up in an 8 m grid and hand each scene to the merged props as one geometry a colour.)
