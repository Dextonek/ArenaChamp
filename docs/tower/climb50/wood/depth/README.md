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
  fallen leaves (thick under the trees), pebbles, mushrooms and now and then a fairy ring; stumps, woodpiles, beehives (straw skeps
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
  and patrols, waystones, caches, the lore stone, doors, quest steps: `woodKeep` in woodZone.ts). Checked on all ten floors: no solid
  prop within 2 m of any of the 40 to 48 spots.
- Speed: the scatter is a few triangles a thing (a blade of grass is one), merged into one mesh a 64 m square, no shadows cast; the
  solid props go into the zone's merged props. The first try (one instanced mesh a kind, round blades) drew 17 more things a frame and
  added 1.5 ms a frame on desktop; this one adds about 9 draws and 60k triangles.

## Checks (2026-11-14)

- `_worldCheck`, floors 11 to 20, both states of the roots: nothing unreachable, at most 4 or 5 units near any point (as before:
  the pass draws no cover).
- Speed, `perf.py scenes --profiles desktop,phone-4x --scenes world-2,gen-14`, A (depth off) and B (on) back to back, three pairs
  (other agents were running): the fights the same in every run (prints 68febcaa and a1448280). Median frame, A / B:

  | Pair | desktop world-2 | desktop gen-14 | phone-4x world-2 | phone-4x gen-14 |
  |---|---|---|---|---|
  | 1 | 8.5 / 8.9 | 9.3 / 9.1 | 24.9 / 20.9 | 27.1 / 24.8 |
  | 2 | 8.1 / 8.6 | 8.4 / 9.8 | 19.6 / 23.1 | 30.8 / 35.0 |
  | 3 | 9.1 / 9.3 | 9.8 / 9.9 | 27.5 / 27.9 | 31.8 / 32.8 |

  The A runs alone spread 8.1 to 9.1 ms (desktop) and 19.6 to 31.8 ms (phone); B is inside that spread. Pairs 1 and 2's B were measured before
  the drifting leaves got a material of their own (pair 3's B is the version committed).
