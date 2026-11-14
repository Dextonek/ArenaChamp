# The Sands' depth pass (floors 21 to 30): before and after

The user, 2026-11-14: "make all the background look fit there, all the roads and zones ... don't be shy". The Sands' own depth pass,
made like the sea's (`depth.ts`) and the Wood's (`woodDepth.ts`): `src/tower/world/sandsDepth.ts`, called from `sandsZone.ts`. **Looks
only:** nothing in it is cover, nothing changes walking, pathing, fights or the checks.

- `fNN-sheet.jpg`: floor NN, every spot below side by side, before (left) and after (right). Start here.
- `fNN-<spot>-before.jpg` / `-after.jpg`, floors 23, 26 and 29, from the game's own camera: `road`, `camp`, `open` (mid views);
  `serai`, `oasis`, `tombs`, `dig` (close); and three views by hand: `caravan` (out to the far dunes), `arch` (the cliffs' foot,
  from the middle), `low` (north from the camp).

## What is in it

- **The caravan roads:** cairns of stacked stones, milestones with a turquoise band, waymark poles with a strip of cloth, bleached bones
  half buried by the way; one broken cart and one roadside well (jars beside it) a floor.
- **The open sand:** dry scrub, thorn bushes, stones and flat slabs (more in the lee of the rocks); painted pebbles and darker drifts in
  the rocks' lee.
- **The places, dressed as what they are:** the caravanserai (rugs in the court, jars, an awning with its back to the wall, sacks), the
  tombs (urns, broken statues: a plinth with its feet, the torso fallen, the head further off), the dig (a pegged grid of rope over the
  court, ladders, coils of rope, baskets, a sieve), the oasis (a pool beside the court with a stone edge and reeds, small palms, jars),
  the raiders (spears in the sand, hides on a rack, loot sacks), the ruins (rubble, fallen drums), the fort (a spear rack, sacks), the
  watchtower (firewood, sacks), the shrine (offering bowls, prayer flags), floor 21's wells (a trough, jars), the camp (rugs, bedrolls,
  a pot, sacks).
- **The camp's ground:** the packed-earth disc, noted as too big and dark, is now about half the size and a shade nearer the sand.
- **Far off:** a caravan of camels walking over the far dunes as silhouettes (along the northern cliffs where a floor has no dunes),
  vultures circling over the northern cliffs, ruined arches (two at the cliffs' foot, one up on them, its lintel gilt).

## Rules it keeps

- Off the cover, the roads' middles and the places' courts (inside a court only flat things: rugs, the dig's rope grid); solid props
  2.5 m clear of the floor's spots (people, packs and patrols, waystones, caches, the lore stone, doors, quest steps: `keep.ts`
  `floorKeep`, shared with the Wood). Checked on all ten floors: no solid prop within 2 m of any of the 43 to 48 spots.
- Speed: everything matte is merged by 96 m squares, at most two meshes a square (props that cast shadows; the flat scatter that does
  not); small trims are a matte brass in those meshes (in the zone's polished gold each one put a gold mesh in its 24 m square: a draw).
  The depth adds about 12 draws and 30k triangles.

## Checks (2026-11-14)

- `_worldCheck`, floors 21 to 30: nothing unreachable, 33 900 to 34 300 m² reachable, at most 5 units near any point (21: 3), the same as
  in the chapter's notes (the pass draws no cover).
- Speed, `perf.py scenes --profiles desktop,phone-4x --scenes world-3,gen-26`, A (depth off) and B (on) back to back (other agents were
  running); the fights the same in every run (prints d69d7802 and 361c2602). Median frame, A / B:

  | Pair | desktop world-3 | desktop gen-26 | phone-4x world-3 | phone-4x gen-26 |
  |---|---|---|---|---|
  | 1 (the first try, gilt trims, 64 m squares) | 21.1 / 19.9 | 9.4 / 9.0 | 82.3 / 81.3 | 27.7 / 33.4 |
  | 2 (as committed) | 20.9 / 18.5 | 9.5 / 8.3 | 75.5 / 76.2 | 23.7 / 22.4 |
  | 3 (as committed) | | 8.8 / 8.7 | | 23.0 / 26.7 |

  The first try added 18 draws and was slower on the phone's gen-26; the version committed adds 12. Its B runs are inside the spread of
  the A runs alone (phone gen-26: 23.0 to 27.7 ms). Floor 21 (`world-3`) is slow with or without the depth (13 ms of game logic a frame on
  desktop): not from this pass.
