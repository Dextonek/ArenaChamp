# The Wood's depth pass (floors 11 to 20): before and after

The user, 2026-11-14: "make all the background look fit there, all the roads and zones ... don't be shy". The Wood's own depth pass,
made like the sea's (`src/tower/world/depth.ts`): `src/tower/world/woodDepth.ts`, called from `woodZone.ts`. **Looks only:** nothing in it is
cover, nothing changes walking, pathing, fights or the checks.

- `fNN-sheet.jpg`: floor NN, every spot below side by side, before (left) and after (right). Start here.
- `fNN-<spot>-before.jpg` / `-after.jpg`, from the game's own camera (`road`, `glade`: a mid view; `place`, `hollow`, `brook`, `spring`,
  `shrine`, `stones`: close), and `low`: a low view north from the camp. Floors 12, 14 and 17.

## What is in it

- **The trails:** mossy stones, ferns and mushrooms along the verges; roots running out of the trees, half sunk; a wooden signpost
  where a trail meets a glade or another trail; a few hanging lanterns on crooked posts (up to six a floor). A brook painted across a
  trail or two in the open (nine of the ten floors have one or two), with a plank footbridge (gilt rails) or stepping stones.
- **The glades:** grass in clumps (green and dry), low shrubs and ferns along the tree lines, wildflowers in clumps (cream, gold, lilac),
  fallen leaves (thick under the trees), pebbles, mushrooms and now and then a fairy ring; low mossy stumps (lower than the
  cover's flat-cut stumps, so they do not pass for something to hide behind), woodpiles, beehives (straw skeps
  with a gilt band) and a hunter's stand, the tall ones only with their backs to the trees (the camera looks north).
- **The places, dressed as what they are:** the camp (a woodpile, a cooking tripod, bedrolls), the burners (woodpiles, billets stood
  on end, smoke rising from the charcoal mound, charcoal crumbs), the shrine (ribbons on a line, offerings), the spring (stones round the
  pool, reeds behind it, lily pads), the old stones and the giants' glade (lichen on fallen stones, a ring of tall grass; a cairn and a
  dropped club), the dens (bones, a clawed log), the bramble (berried shoots), the thicket (ferns, fallen branches), the hollow oak
  (mushrooms, stumps), the lamp glades (toadstools), the heart (a ring of flowers). Inside a place only flat or very low things.
- **In the air and far off:** leaves drifting down under the trees, dark birds over the hills, a woodcutter's cottage on the hills
  with smoke from its chimney and a lit window, a watchtower on the northern ridge with its lantern.

## Rules it keeps

- Off the cover, the passes (where the roots rise), the trails' middles; solid props 2.5 m clear of the floor's spots (people, packs
  and patrols, waystones, caches, the lore stone, doors, quest steps: `floorKeep` in keep.ts, shared with the Sands). Checked on all ten floors: no solid
  prop within 2 m of any of the 40 to 48 spots.
- Speed: the scatter is a few triangles a thing (a blade of grass is one), merged into one mesh a 64 m square, no shadows cast; the
  solid props go into the zone's merged props. The first try (one instanced mesh a kind, round blades) drew 17 more things a frame and
  added 1.5 ms a frame on desktop; this one adds about 9 draws and 60k triangles.

## Checks (2026-11-14)

- `_worldCheck`, floors 11 to 20, both states of the roots: nothing unreachable, at most 4 or 5 units near any point (as before:
  the pass draws no cover).
- Speed, `perf.py scenes --profiles desktop,phone-4x --scenes world-2,gen-14`, A (depth off) and B (on) back to back, three pairs
  (other agents were running), 1500 frames each; the fights the same in every run (prints 68febcaa and a1448280). Pairs 1 and 2's B
  were before the drifting leaves had a material of their own; pair 3's B is the version committed. Median / p99 (ms), A then B:

  | Pair | desktop world-2 | desktop gen-14 | phone-4x world-2 | phone-4x gen-14 |
  |---|---|---|---|---|
  | 1 | 8.5 / 17.1, then 8.9 / 22.1 | 9.3 / 21.3, then 9.1 / 20.7 | 24.9 / 55.0, then 20.9 / 43.6 | 27.1 / 96.3, then 24.8 / 68.7 |
  | 2 | 8.1 / 17.7, then 8.6 / 19.2 | 8.4 / 18.5, then 9.8 / 20.2 | 19.6 / 48.3, then 23.1 / 53.5 | 30.8 / 75.7, then 35.0 / 88.7 |
  | 3 | 9.1 / 20.2, then 9.3 / 18.0 | 9.8 / 21.7, then 9.9 / 22.2 | 27.5 / 61.3, then 27.9 / 59.5 | 31.8 / 78.3, then 32.8 / 91.1 |

  Draws a frame 190 to 199 (world-2) and 217 to 228 (gen-14); triangles 465k to 526k and 480k to 531k. Memory churn (MB a second),
  A then B: desktop world-2 14.5, 14.8, 14.5 then 16.0, 16.2, 15.6; desktop gen-14 34.7, 34.6, 34.0 then 34.6, 34.4, 34.3; phone world-2
  14.5, 14.8, 14.9 then 16.0, 15.6, 14.8; phone gen-14 33.6, 33.7, 32.3 then 35.3, 34.7, 33.9.

  **What that says:** on desktop world-2 the depth is slower in all three pairs, by 0.2 to 0.5 ms a frame (3 to 6 %); elsewhere the
  pairs go both ways (the phone's run-to-run spread, 19.6 to 31.8 ms, is far wider than any difference). The churn is up about 1 MB a
  second on world-2 and on the phone's gen-14, not on desktop gen-14: not explained. The depth's per-frame update reuses its matrices
  and arrays and allocates nothing that I could see; that was not profiled. The first try (one instanced mesh a kind, round blades)
  drew 17 more things a frame, 330k more triangles and 1.5 ms more on desktop: rejected.
