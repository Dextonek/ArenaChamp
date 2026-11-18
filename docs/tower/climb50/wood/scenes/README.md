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

## The second pass: bigger, clearer, fuller (2026-11-14, "continue more refine")

Pictures: `refine/fNN-sheet.jpg` (start here; before left, after right), floors 11, 14 and 17, and `refine/fNN-<view>-before.jpg` /
`-after.jpg`: `mid1`, `mid2` at the game's own zoom (1.25), `close-*` (0.8), `edge-*` (past the walkable edge); floor 11 also `wide`
(from above over its busiest stretch, fog lifted). **"Before" is tower-50 with its first-pass scenes**; the scenes moved, so a before
picture shows tower-50's nearest scene of the same kind (or the same spot, for a new kind), as its caption says. The yard past the
edge is hidden under the tree crowns from the game's camera, as it was on tower-50.

What changed (made like the sea's second pass, `docs/tower/climb50/sea/scenes/README.md`):

- **A clear main piece.** Drawn 1.45 times life size (was 1.3). The two the lead found tiny: the **trap** is now a snare net torn open on
  the leaves (2.4 m of rope grid with its weights) beside the jaw trap and its torn cloak; the **gatherer** has her teal shawl spread with
  the finds spilled over it, and in its second way her little hand-cart tipped. The hives are a tipped bench with three skeps rolled off
  it; the offering a bigger stone with ribbons laid out like rays in a wider ring of pebbles; the picnic a striped cloth and a hat blown
  off; the hunters' lean-to blown flat (a new `hide` brown); the fight a hide or a cloak with its shields; the woodcutter's sawbuck
  knocked over with its log half sawn. The log cart and the fallen tree, which read already, are a little larger.
- **Their own ground**, painted into the Wood's map (woodZone.ts `paint`; no triangles, no draw calls): trodden earth, a scorch under a
  fire and the charcoal, pale chips round the woodcutter's block and the finds round a basket, a dark stain of spilled wine, wet ground
  on a brook's bank, and two ruts from the nearest trail to a tipped log cart. Kept off the trails' middles, the places and the brooks.
- **More of them where players walk.** One every 18 to 28 m along the trails, each spot tried on both verges at three distances and
  shifted along; then a **fill pass**: every 8 m along the trails, if the game's camera (its own frame, as in the views probe) would show
  no scene, one is put ahead of that point. At the forks, round the floor's spots (6 to 10 m off), two at a big place. **Echoes** between
  (a log off the cart, billets, arrows towards the fight, a comb of honey, mushrooms, a cup and bread): 5 to 11 a floor.
- **New kinds:** `charcoal` (the burner's mound raked open: its black ring, the turf stacked round, rakes, the sacks filled, a ladder down),
  `rail` (a footbridge's rail broken on a brook's bank, its planks and its rope, placed along the brooks), and past the edge `woodshed`
  (the forester's lean-to over its stacked wood, the block, a barrow, a lantern on its hook, unlit).
- **Cheaper to make:** random sizes (a mushroom, a log's length, a stone) are rounded to a few steps, so each is made once a floor; before,
  every mushroom was a new shape (the first version of this pass took 320 ms a floor for that alone, unslowed). Nearby props, cover and
  trails are looked up in the squares round a wide scene, not all of them.

### Numbers

Scenes a floor (not counting echoes), before and after: 11: 21, 39 (+5 echoes); 12: 20, 38 (+11); 13: 24, 37 (+8); 14: 22, 31 (+8); 15: 23,
38 (+6); 16: 23, 39 (+10); 17: 29, 47 (+10); 18: 21, 37 (+7); 19: 21, 37 (+8); 20: 24, 42 (+8). Over the ten floors: gatherer 37, wall 35,
fight 34, woodcut 33, picnic 32, hive 32, offering 31, trap 31, logcart 30, hunters 25, charcoal 19, fallen 16, rail 14; past the edge
yard 9, woodshed 7.

**The views probe** (`_scenesViews`, as on the sea: the game's own camera at its own zoom, every 8 m along the trails and on an 8 m grid;
"read" = the scene's largest part at least 60 px across in the middle of the picture). Before then after:

| Floor | trail views | all views | trail views that read | all views that read |
|---|---|---|---|---|
| 11 | 54 %, 94 % | 48 %, 72 % | 8 %, 67 % | 9 %, 55 % |
| 12 | 55 %, 85 % | 46 %, 75 % | 9 %, 55 % | 11 %, 51 % |
| 13 | 54 %, 89 % | 53 %, 72 % | 14 %, 67 % | 12 %, 51 % |
| 14 | 56 %, 82 % | 44 %, 65 % | 11 %, 55 % | 10 %, 44 % |
| 15 | 44 %, 89 % | 46 %, 71 % | 7 %, 70 % | 11 %, 51 % |
| 16 | 61 %, 81 % | 53 %, 71 % | 13 %, 60 % | 13 %, 49 % |
| 17 | 62 %, 91 % | 55 %, 79 % | 15 %, 64 % | 14 %, 55 % |
| 18 | 55 %, 89 % | 44 %, 76 % | 10 %, 67 % | 8 %, 51 % |
| 19 | 48 %, 79 % | 46 %, 72 % | 5 %, 52 % | 8 %, 47 % |
| 20 | 45 %, 81 % | 49 %, 76 % | 9 %, 53 % | 10 %, 50 % |

The probe does not see the tree crowns; the trees stand past the walkable edge, so only the yard and the woodshed are under them.

- **Overlap probe:** 0 hits on all ten floors (echoes included; the rail keeps the brooks' 0.9 m like every other part).
- **`_worldCheck`**, floors 11 to 20, both states of the roots: nothing unreachable, 31,487 to 32,043 m2 reachable, most units near a spot
  4 or 5; the output for floors 1 to 20 is identical, line for line, to tower-50's.
- **Build time, phone profile** (processor slowed 4 times; tower-50 from a second checkout and this branch in turn, three alternating
  rounds of three builds after a warm one; medians of nine): the scenes' own code, floor 11: 416 ms, 484 ms (+68); floor 14: 377 ms,
  499 ms (+122); the merge of the props +2 to +3 ms. Whole zone: floor 11 6917, 7446; floor 14 7800, 8092; single builds of the same
  code ranged 6590 to 10397 ms, so the scenes' own timer is the measure.

### Frames

Measured with the sea, floors 1, 6, 11 and 14 together: see the last section of `docs/tower/climb50/sea/scenes/README.md`. For the
Wood: floor 11 (world-2) desktop 9.8, 6.4, 6.1, 6.3 and phone-4x 31.1, 28.9, 29.0, 29.0; floor 14 (gen-14) desktop 7.4, 7.3, 6.5, 6.4
and phone-4x 32.3, 32.9, 32.8, 32.7 (tower-50, this, this, tower-50): inside the noise; draw calls -1 to +1, triangles +10k to +18k.

### After looking at every sheet (fixes, and the whole-zone build checked again)

- Fixed after the pictures were looked at, floor by floor: gold trims that lay flush on a part showed a whole gilt face that glared next
  to the hero (the pots' hand-cart, the salt barrow, the tide cart's tray; in the Wood the log cart's side and the gatherer's hand-cart):
  each band now sits below the top, so only its edge shows. The salt heap and the salt sack were dulled (they glared white). The fish
  rack's A-frame legs splayed outward; they now lean in to meet under the pole. The anchor's furrow, with pale ridges, looked like a
  plank lying on the grass; it is now a soft groove. Wheel ruts now stop short of a place's stand, a tidal flat (a brook in the Wood) and
  another road's middle. The pictures in `refine/` were taken again after these fixes; the placing did not change (overlap probe 0 hits on
  floors 1 to 20, the views probe's numbers the same).
- **The whole zone's build, checked again** (a fresh page for each run, the processor slowed 4 times, scenes off then on alternating,
  four rounds each, this branch and then tower-50 from a second checkout). Medians in ms, scenes off then on: floor 1: this 10209, 11550;
  tower-50 10819, 11599. Floor 6: this 9850, 10962; tower-50 10187, 12188. Floor 11: this 7450, 7653; tower-50 7106, 7911. Floor 14: this
  7225, 8007; tower-50 7553, 7598. Single builds of the same code and the same switch ranged over 1 to 3 s (tower-50's own scenes cost
  anywhere from +45 to +2001 ms by this measure, against about +250 by its timer), so this measure cannot resolve 150 ms on this machine.
  What it does show: with the scenes on, this branch's builds were no slower than tower-50's (-49, -1226, -258 and +409 ms on floors 1,
  6, 11 and 14). The scenes' own timer (which includes the painting and the hand-off to the merged props) is the measure that resolves
  it: +119 and +133 ms on the sea's floors 1 and 6, +68 and +122 on the Wood's 11 and 14, against tower-50, at 4x. The painted map is
  uploaded to the graphics card at the first frame, as it was before (the same canvas, the same size).
