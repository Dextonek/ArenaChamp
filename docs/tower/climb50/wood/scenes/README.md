# Scenes on the Wood's floors (11 to 20): little stories told in props

The user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on the maps, make actual scenarios and
stuff". The code is `src/tower/world/scenes/wood.ts`, called from `woodZone.ts` after the Wood's depth (`woodDepth.ts`). Made like the
sea's (`docs/tower/climb50/sea/scenes/`). **Looks only:** nothing in it is cover; walking, pathing, fights, the AI, the roots and the
checks are as they were. `?scenes=off` in the address leaves them out.

- `fNN-sheet.jpg`: floor NN, every view below, before (left) and after (right). Start here.
- `fNN-<view>-before.jpg` / `-after.jpg`, from the game's own camera: `mid1`, `mid2` (zoom 1.5), `close-*` (zoom 0.8), `edge-yard`
  (past the walkable edge). Floor 11 also has `wide` (a high camera). Floors 11 (the Walking Wood), 14 and 17.

## The kinds

On the walkable ground (nothing above knee height, 0.55 m):

| Kind | The story |
|---|---|
| woodcut | the woodcutter's work left mid-way: the axe in a half-split round on the block, the halves fallen, billets strewn, a stack begun, the saw dropped, chips |
| hunters | a hunter's camp left in a hurry: the fire cold, the pot over, the bedroll kicked aside, the bow on a stump, the quiver spilled, the cloak dropped |
| logcart | a cart of logs tipped into the ditch: on its side, a wheel off, its load rolled out across the verge |
| hive | a hive knocked over: the stand on its side, the straw skep rolled off, combs of honey in the grass, the smoker and veil dropped |
| gatherer | a mushroom basket dropped: its finds spilled, a second basket, the shawl, the knife and the stick left behind |
| trap | a snapped trap with a torn cloak in its jaws, its chain to the stake, a satchel dropped, an arrow snapped, tufts and feathers |
| offering | a wayside offering: a flat stone with candles on gilt dishes, bread, berries, a garland, a ring of pebbles |
| wall | a dry-stone wall half built: two courses laid, the rest heaped beside it, the barrow and the mallet left |
| fallen | a tree come down, its branches lopped and stacked, moss on its back, mushrooms at its foot |
| fight | a fight with the Wood's beasts: a shield dropped, a spear broken, a lantern on its side, arrows in the ground, tufts of fur |
| picnic | a picnic cut short: the cloth spread, the basket open, bread, a jug spilled, cups |

Past the walkable edge: `yard`, a woodcutter's yard (a log on the sawhorse, a woodpile, the axe in the block, cut rounds) in a
clearing among the trees outside, never south of the walkable ground and with no tree just south of it to hide it.

The Wood's depth already has woodpiles, upright beehives, fairy rings, the shrine's ribbons and the burners' smoke, so these tell
other stories (a hive knocked over rather than a hive). A giant fallen tree with its roots in the air was tried past the edge and
dropped: the forest there left it no room on any floor.

## How they are placed

As on the sea (its README): each kind a list of parts, placed turned, mirrored and varied by the floor's own stream
(`seeded(7171 + seed)`), 1.3 times life size on the ground, gold trim drawn matte (brass) in the shared merged props. A kind whose larger drawing would rise over the knee is drawn flatter as a
whole, so a stacked part (the axe in its round, the candles on the stone) stays where it belongs. One near each place that suits it
(woodcut or a log cart by the burners, a trap or a fight by the dens, an offering by the stones and the shrine, a picnic by the spring,
a gatherer by the bramble and the hollow...), then along the trails about one every 28 to 44 m, then the open glades, then the yard
past the edge. Every part keeps 3 m off the floor's spots, 2 m off the trails' middles, off the cover, the passes where the roots rise
(their width and 3 m), the places, the brooks (the depth now hands their lines on), the depth's solid props and the trees' trunks
(the forest now records where its trees stand).

## Numbers

Scenes a floor (from the probe): 11: 21, 12: 20, 13: 24, 14: 22, 15: 23, 16: 23, 17: 29, 18: 21, 19: 21, 20: 24 (one of them the yard,
except on floor 13). Over the ten floors: offering 26, gatherer 24, fight 22, wall 21, picnic 21, woodcut 21, hive 20, trap 18,
logcart 17, fallen 15, hunters 14, yard 9. No kind is missing.

## Checks

- **Overlap probe** (`pipeline/tools/scenes-probe.js`, `await _scenesProbe([11, ..., 20])`): every placed part's footprint, sampled
  every 0.5 m, against the brooks (0.9 m), the floor's spots (3 m), the trails' middles, the cover, the roots' walls of both states (0.3 m), the places, the outline (ground
  scenes inside and low, the yard outside) and the depth's solid props. Zero hits on all ten floors.
- **`_worldCheck`**, floors 11 to 20, both states of the roots: nothing unreachable, 31,487 to 32,043 m2 reachable, most units near a
  spot 4 or 5, as before (it reads only the floor's data, which this pass does not touch).
- **`npx tsc --noEmit -p .`** clean, **`npm run build`** passes.
- **Speed:** both chapters were measured together; the numbers are in the sea's README (`docs/tower/climb50/sea/scenes/README.md`,
  last section). In short: on desktop within the noise in the one fair pair, but floor 14 (gen-14) was slower in three pairs (0.5 to
  1.7 ms) and is the one to watch; the Wood's zone build at a 4x slowed processor +222 to +283 ms.
