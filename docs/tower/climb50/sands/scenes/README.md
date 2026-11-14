# The Sands' scenes (floors 21 to 30)

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". A scene is a small group of props, 3 to 12 m across, that says at a glance that something happened there. The code is
`src/tower/world/scenes/sands.ts`, called from `sandsDepth.ts`. It is on the branch, not live.

**Looks only.** Nothing in it blocks a walk or a shot, and nothing that was there before moved: the scenes have their own random
stream, and the depth's own props are the same with the scenes on or off (checked on floors 23 and 26).

## The scene kinds

| Kind | What it shows | Where |
|---|---|---|
| caravan | an ambushed caravan: crates (one open, its cloth rolls out), split sacks and their spice in red, ochre and grain heaps, the awning torn down, a dropped lantern, arrows in the sand; against a rock, the cart itself on its side with a wheel in the air | road, open, by the serai, against a rock |
| dig | an abandoned dig: the pit's dark floor, pegs and rope, the spoil heap with a sieve on it, baskets (one tipped), a ladder, a shovel or pick, sherds | road, open, by the dig |
| well | a dry well with its windlass fallen: a broken ring of blocks (two lying beside it), the dark hole, the posts and drum on the sand, the bucket on its side, a jar | road, open, by the oasis and wells |
| rest | a travellers' rest: a rug, a brass tea tray with cups, cushions, a cold fire ring with a kettle, a pack and a staff; against a rock, a lean-to over it | road, open, by the serai and oasis, against a rock |
| sundial | a sundial on its plinth and an obelisk broken beside it: the stump, two lengths of shaft lying, the gilt-tipped cap | road, open, by the ruins |
| fight | a fight's aftermath: a fallen standard, a round shield, a curved sword, a helmet rolled away, a snapped spear, arrows standing in the sand | road, by the raiders and forts |
| shrine | a shrine at a fork: a cairn under a turquoise cloth, offering bowls, candle stubs, a brass plate, a small rug | where a road ends on another |
| grave | a long mound ringed with stones, a helmet on it, a sword across it, a small cairn at its head | road, open, by the raiders and forts |
| jackal | a jackal's head in black stone, fallen from its statue and lying on its cheek half buried in a drift, gold in its eye and ear, a turquoise collar at the broken neck; a paw further off | against a rock, or out on the dunes |
| wagon | a wagon sunk to its axles in a drift, its tongue in the sand (raised, out on the dunes) | against a rock, or out on the dunes |
| pots | pots stacked at a tomb's door, one smashed and its grain spilled, one rolled away | against a rock by the tombs |
| ribs | the bleached ribs of a great beast arching from the sand, its spine and horned skull | out past the edge only |

The first lion's head read as a teddy bear from the game's camera (a round mane round a round face) and was too cute for the art
bible; a second, a stone lion's head lying in profile, read as a spiked disc. The jackal in black lacquered stone with gold reads
plainly from above, so the kind became a jackal.

## How they are placed

Each floor's mix comes from its own seed: every kind may appear 2 or 3 times, two kinds are left out, one has two more, the ribs
appear on four floors in five, and no floor has more than 24 scenes. In order: shrines at the forks; a scene by each place that
suits it (pots at the tombs, a fight by the raiders and forts, a rest or caravan by the serai and oasis, a dig by the dig); up to five
of the tall ones right south of a rock (the camera looks north, so a rock is behind them and they hide nobody); four in the open sand
between the places; one every 45 to 60 m of road, on the verge; and up to three past the edge, on the dunes or the cliff tops, never in
the south (the camera's side).

Every part of a scene has a footprint (a circle and a height), and a scene is placed only if every part keeps:
- 3 m from its edge to the floor's spots (keep.ts `floorKeep`: start, camp, lore, people, packs and patrols, waystones, caches, doors,
  every quest step);
- 2.2 m from its edge to a road's middle (off the trodden band), 2.6 m off a place's court, off the cover, off the depth's own props;
- inside the walkable outline, or (the background ones) at least 4 m past it;
- under knee height (0.56 m) on open sand; anything taller only with a rock right north of it, or past the edge.

All of it is built once for the page (every part a shape copied by a matrix) and goes into the depth's own merged meshes: no draw calls
of its own, except where a background scene lands in a 96 m square that had nothing in it (one or two meshes on some floors).

## Scenes per floor

| Floor | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes | 24 | 20 | 21 | 20 | 23 | 20 | 21 | 23 | 22 | 20 |
| Build (ms, desktop) | 35 (the first floor also makes the shapes) | 13 | 16 | 13 | 17 | 14 | 18 | 17 | 12 | 14 |

## The pictures

From the game's own camera on floors 21 (the Storm Canyon), 26 and 29: `fNN-<kind>-mid-before.jpg` and `-after.jpg` (zoom 1.25, as
played), `-close-` (zoom 0.7); `fNN-sheet.jpg` has every pair side by side, before left. The `wide` shots: `f26-wide-ribs-*` (a free camera
over the western dunes, where the ribs lie past the edge) and `f26-wide-west-*` (the floor's west half from high up). Seen whole, the
scenes are small: they are made to be found while walking, at the game's camera.

## The checks (2026-11-14)

- **Overlap probe** (`pipeline/tools/scenes-probe-sd.js`, run with world-shots.py): it builds each floor and checks every part against
  the floor's own data (not the planner's): 0 hits on all ten floors.
- **`_worldCheck`, floors 21 to 30:** nothing unreachable; reachable 33,938 to 34,305 m²; most units near any point 5 (floor 21: 3).
  The same as the chapter's notes: the scenes draw no cover.
- **Nothing moved:** with the scenes on and off (floors 23 and 26), the depth's own props are the same list.
- **Speed:** both chapters were measured in one A/B run; the table is in `docs/tower/climb50/deep/scenes/README.md`. In short: the
  same draw calls (one more on gen-26), the same fights, frame times and the phone profile's floor build times inside the noise.
