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
that this would lift over the knee is drawn flatter. Per floor each kind has a cap of 1 to 4, so floors differ.

1. One near each place that suits it, outside its stand: a stall or a cart by the market, washing or a fire by the village, barrels
   by the lighthouse and the beacon, flotsam or an anchor by the wreck, a memorial by the chapel, a fight by the fort, smugglers by
   the caves, a barrow by the salt pans.
2. Along the roads, about one every 34 to 52 m, on the verge.
3. In the open ground between the places (up to 7).
4. On the beach and the land past the edge (up to 6), and one wreck far out on the rocks.

Every part keeps 3 m off the floor's spots (`floorKeep`: start, camp, lore, people, packs and patrols, waystones, caches, doors, quest
steps), 2 m off the roads' middles, off the cover, the places' stands, the tidal flats as drawn, the depth's props, and the land's
houses, jetties, boats, trees and the harbour file's props.

## Numbers

Scenes a floor (from the probe): 1: 24, 2: 23, 3: 22, 4: 24, 5: 24, 6: 19, 7: 25, 8: 26, 9: 27, 10: 23 (2 to 4 of them past the
edge). Over the ten floors: barrels 23, anchor 21, memorial 20, fire 19, stall 18, pots 18, flotsam 18, fight 17, nets 17, washing
15, cart 13, mooring 10, capsized 10, smugglers 9, rowboat 4, barrow 2, potstack 2, netframe 1. No kind is missing.

## Checks

- **Overlap probe** (`pipeline/tools/scenes-probe.js`, run on the page: `await _scenesProbe([1, 2, ..., 10])`): builds each floor's zone
  as the game does and checks every placed part's real corners against the floor's own data. Zero hits on all ten floors.
- **`_worldCheck`**, floors 1 to 10: nothing unreachable, 34,825 to 35,004 m2 reachable, most units near a spot 5, as before (it reads
  only the floor's data, which this pass does not touch).
- **Draw calls** (`_worldBench`, floors 1 and 6, five spots each, scenes off then on): 2 to 6 more a view (the gold trim lands in
  squares of ground that had none), 5k to 18k more triangles.
- **Build time** of the scenes alone: about 70 ms a floor on desktop (measured inside the page; the whole zone takes 1.3 to 2 s there,
  with other agents running). The first version took 240 ms: it laid out every part of every failed try against thousands of props
  by brute force; it now tests a scene's middle first, stops at the first part that fails and looks props up in an 8 m grid.
- The perf A/B and the phone build times are in the chapter's last section below once measured.
