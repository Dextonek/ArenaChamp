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
| pots | pots stacked at a tomb's door, one smashed and its grain spilled, one rolled away (smaller than the cover's jars, so no one takes them for cover) | against a rock by the tombs |
| ribs | the bleached ribs of a great beast arching from the sand, its spine and horned skull (drawn 1.4 times, to be seen from far) | out past the edge only |

The first lion's head read as a teddy bear from the game's camera (a round mane round a round face) and was too cute for the art
bible; a second, a stone lion's head lying in profile, read as a spiked disc. The jackal in black lacquered stone with gold reads
plainly from above, so the kind became a jackal.

## How they are placed

Each floor's mix comes from its own seed: every kind may appear 2 or 3 times, two kinds are left out, one has two more, the ribs
appear on four floors in five, and no floor has more than 24 scenes. In order: shrines at the forks; a scene by each place that
suits it (pots at the tombs, a fight by the raiders and forts, a rest or caravan by the serai and oasis, a dig by the dig); one every
45 to 60 m of road, on the verge; up to five of the tall ones right south of a rock (the camera looks north, so a rock is behind them
and they hide nobody); a few in the open sand between the places; and up to three past the edge, on the dunes or the cliff tops, never
in the south (the camera's side).

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
| By the road / a place / a rock / open / a fork / past the edge | 8/5/5/1/2/3 | 5/9/4/0/1/1 | 7/7/5/0/1/1 | 8/8/3/0/1/0 | 9/8/4/0/1/1 | 8/7/3/0/1/1 | 10/8/2/0/1/0 | 8/8/5/0/1/1 | 10/8/2/0/1/1 | 9/6/4/0/1/0 |
| Build (ms, desktop) | 48 (the first floor also makes the shapes) | 16 | 38 | 23 | 23 | 20 | 19 | 35 | 22 | 15 |

## The pictures

From the game's own camera on floors 21 (the Storm Canyon), 26 and 29: `fNN-<kind>-mid-before.jpg` and `-after.jpg` (zoom 1.25, as
played), `-close-` (zoom 0.7), `fNN-wide-wide-*` (the game's farthest zoom, 30 m in from the floor's background scene);
`fNN-sheet.jpg` has every pair side by side, before left. The wide shots from a free camera: `f26-wide-edge-*` (over the eastern edge,
where the ribs lie on the cliff top) and `f26-wide-west-*` (the floor's west half from high up). Seen whole, the
scenes are small: they are made to be found while walking, at the game's camera.

## The checks (2026-11-14)

- **Overlap probe** (`pipeline/tools/scenes-probe-sd.js`, run with world-shots.py): it builds each floor and checks every part against
  the floor's own data (not the planner's): 0 hits on all ten floors.
- **`_worldCheck`, floors 21 to 30:** nothing unreachable; reachable 33,938 to 34,305 m²; most units near any point 5 (floor 21: 3).
  `_worldCheck` reads only the floor's data, which the scenes do not touch, so it is unchanged by construction; these are the chapter's
  numbers.
- **Nothing moved:** with the scenes on and off (floors 23 and 26), the depth's own props are the same list.
- **Speed:** both chapters were measured in one A/B run; the table is in `docs/tower/climb50/deep/scenes/README.md`. In short: the
  same draw calls (one more on gen-26), the same fights, frame times inside the noise. On the phone profile the scenes' own build takes
  75 to 132 ms (floors 21, 26, 29) of a floor build of 4.3 to 7.2 s: about 2%, smaller than the build's own swing, but not nothing.

## The refinement (2026-11-14, "continue more refine")

The lead, on the first pass: too small to read from the game's camera, floating on the sand, too few in view, the wagon and the jackal
small dark shapes. What changed (`src/tower/world/scenes/sands.ts`; in `sandsDepth.ts` two things, both where the cost or the canvas
lives: it hands the scenes the ground's canvas, and its merge takes the scenes' copies as ready typed blocks, the same vertices in the
same order, hashed the same, because growing plain arrays one number at a time was a third of the scenes' build time on the phone):

- **A main piece that reads, on the ground a hero walks on** (all under knee height): the caravan's cart bed fallen flat off its wheels,
  a striped awning torn down; a great standard fallen, or a chariot upside down; a dig of 4 x 3 m, or a 6 m trench with its finds laid
  out on a cloth; a well ring of 2.5 m with its trough; a great rug, or two camel saddles. Scenes are about 1.5 to 2 times the size
  (8 to 13 m across) and have more parts.
- **Three new kinds:** a nomad's **tent** blown down (5.4 x 4.2 m of wine, cream and turquoise stripes draped over its ridge pole, guy
  ropes slack to their pegs; against a rock, half standing on its back pole), a line of **amphorae** half buried (or a heap of them by
  their split crate), a **water-wheel** fallen by its dry channel (3.2 m across, lying flat by the channel's cracked bed between low
  kerbs; against a rock, standing upright at the channel's head, its face to the camera).
- **Two or three ways of being for every kind** but the ribs (past the edge only), so floors 22 and 29 do not repeat; the pots by a
  tomb now also stand in a row with two smashed.
- **The jackal** 1.45 times larger with three gold bands of its headdress round its head and a pale drift painted round it; a second way
  with the statue's broken base and forepaws. **The wagon** carries a cream canvas on its hoops (or, the second way, its sacks spill
  into the drift), 1.15 times larger.
- **A ground of their own**, painted into the sand's canvas before it goes to the graphics card (no geometry, no draw calls, about 1 ms
  a floor, never inside a court): trampled sand under each scene, spice fanned out from the split sacks in red, ochre and grain, pale
  drifts, spoil, the channel's cracked bed; and what leads back to the road: two wheel ruts from a cart or a wagon, footprints, a drag
  mark from the tent.
- **Echoes:** 16 single props a floor on the roads' verges between the scenes (a crate, a sack and its spilled spice, a jar, a basket,
  a wheel, arrows), every 16 to 24 m where no scene is near; arrows stuck in the sand on the way from a fight to its road; a crate or a
  sack dropped where a cart's ruts leave the road.
- **More of them, where players walk:** one every 26 to 38 m of road (was 45 to 60), either verge; the places' surroundings take a tent,
  a water-wheel or amphorae as well; up to 28 on the walkable sand (was 24), up to six against the rocks (the jackal's head, the
  wagon, the cart on its side, the lean-to, the tent half standing, the upright water-wheel: 1 to 4 a floor) and up to three past the
  edge, placed early so they are never left out (one of each kind). The caps were brought down from 32 scenes and 22 echoes for build time.
- Kerbs keep the turquoise to a thin line (a full turquoise cap read loud).
- **Made true to the shapes.** A check that measures every vertex of every part (`pipeline/tools/scenes-shape-sd.js`) found that the
  footprints the probe trusts were hand-set circles, and some parts reached up to 2.8 m past them or stood above the knee on open sand
  (a tilted wheel at 0.69 m, the sundial at 0.8 m, arrows, the well's jar; some of it from the first pass). Now each scene's footprint
  also takes its parts' measured reach and height (`autoCover`), the open-ground parts are trimmed under the knee, and cylinders laid on
  their side are centred (the tent's ridge pole had run 6.4 m to one side; the standard's pole, the spears, the staff and the well's drum
  were half a length off). A tall part reaching past its scene's circles gets small circles drawn tight round its points there, so a
  scene against a rock still fits; the wagon's drift against the rock is two smaller drifts (one wide one reached into the rock). The check: 0 vertices outside the footprint, 0 above what it declares, on every kind and way, 80 draws each.

### The views probe

`pipeline/tools/scenes-probe-sd.js` puts the game's camera (heroMode.ts: (0, 15, 10.5) times the zoom 1.25, looking at the hero's feet,
50 degrees, 16:9) at a point every 8 m along every road and on an 8 m grid over the walkable ground, and counts a view when a scene's
main piece is in frame. The literal bar (in frame anywhere) was already met by the first pass on most floors, while the lead saw "most
views show none": a scene at the screen's very edge is 40 m off at the top corners and not seen at a glance. So the work was steered by
the **inner 80% of the screen**; both are given. Echo props are not counted.

| Floor | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|
| Scenes before / after | 24 / 31 | 20 / 30 | 21 / 33 | 20 / 33 | 23 / 30 | 20 / 33 | 21 / 31 | 23 / 32 | 22 / 33 | 20 / 32 |
| Against a rock after | 2 | 1 | 3 | 4 | 3 | 2 | 2 | 2 | 3 | 3 |
| Echo props after | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 |
| Road views, in frame (%) | 62 / 91 | 60 / 77 | 79 / 93 | 80 / 93 | 84 / 85 | 73 / 92 | 72 / 78 | 71 / 86 | 78 / 85 | 73 / 89 |
| All views, in frame (%) | 54 / 77 | 56 / 76 | 57 / 80 | 57 / 73 | 59 / 70 | 57 / 78 | 56 / 75 | 59 / 73 | 57 / 69 | 62 / 74 |
| Road views, inner 80% (%) | 50 / 78 | 39 / 66 | 69 / 80 | 62 / 76 | 58 / 66 | 50 / 71 | 55 / 66 | 55 / 73 | 57 / 67 | 57 / 73 |
| All views, inner 80% (%) | 39 / 55 | 40 / 54 | 42 / 58 | 39 / 53 | 43 / 54 | 38 / 60 | 42 / 55 | 43 / 54 | 39 / 52 | 42 / 55 |

The aim (70% of road views, 45% of all) is met in frame on every floor. In the inner 80% of the screen all views meet it on every floor,
road views on six (21, 23, 24, 26, 28, 30); the other four reach 66 to 67%.

### The checks

- **Overlap probe:** 0 hits on all ten floors (every part of every scene and echo against the floor's spots, roads, cover, courts and
  stands, the outline and knee height); **shape check:** 0 outside, 0 too tall.
- **`_worldCheck`, floors 21 to 30:** the same as before: nothing unreachable, reachable 33,938 to 34,305 m², most units near any point 5
  (floor 21: 3).
- **Nothing moved:** with the scenes switched off (`window.__noScenes`), floors 21 and 26 build byte for byte the same (every vertex
  attribute, instance matrix and painted map hashed) under the tower-50 code and this one.
- **Build time on the phone profile** (the processor slowed 4 times, as perf.py's phone-4x; each floor built once at full speed first),
  the scenes' own time, the tower-50 code and this one alternated in one session, three builds each. The machine was loaded by other
  agents (a whole floor build swung from 3 to 17 s), so only the pair under comparable load is read: floor 21 92 to 111 ms before, 140 to
  181 ms after; floor 26 66 to 90 ms before, 111 to 129 ms after: +40 to +70 ms (the bar: +150). Most of it is copying the scenes'
  vertices into the merged meshes and the room checks; the shapes were thinned (three-sided trims, coarser sacks, wheels and amphorae),
  the checks read a grid of 8 m cells (widened by a part's own reach), a verge with no room is left for a few metres, and the depth's
  merge takes the scenes' copies as typed blocks.
- **Frame speed:** in the Deep's README ("Speed (both chapters' refinement)").
- Pictures: `refine/fNN-sheet.jpg` (floors 21, 26, 29; before left, after right; mid at the game's zoom 1.25, close at 0.7) and the
  single pictures beside them; `refine/f26-wide-*` at the game's farthest zoom.
