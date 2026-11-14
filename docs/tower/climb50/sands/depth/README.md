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
  running), 1500 frames each; the fights the same in every run (prints d69d7802 and 361c2602). Pair 1's B was the first try (gilt trims
  in the zone's kit, 64 m squares: 18 more draws); pairs 2 and 3 the version as measured for commit (12 more draws). Median / p99 (ms), A
  then B:

  | Pair | desktop world-3 | desktop gen-26 | phone-4x world-3 | phone-4x gen-26 |
  |---|---|---|---|---|
  | 1 (first try) | 21.1 / 29.0, then 19.9 / 33.9 | 9.4 / 35.5, then 9.0 / 32.3 | 82.3 / 115.6, then 81.3 / 126.9 | 27.7 / 137.9, then 33.4 / 138.7 |
  | 2 | 20.9 / 31.5, then 18.5 / 29.1 | 9.5 / 34.3, then 8.3 / 29.7 | 75.5 / 113.0, then 76.2 / 104.4 | 23.7 / 136.1, then 22.4 / 117.9 |
  | 3 | | 8.8 / 27.8, then 8.7 / 35.7 | | 23.0 / 121.1, then 26.7 / 146.6 |

  Draws a frame 174 to 187 (world-3) and 238 to 250 (gen-26); triangles 332k to 360k and 345k to 378k. Memory churn (MB a second), A then
  B: desktop world-3 68.0, 68.8 then 68.2 (pair 2); desktop gen-26 33.7, 33.6, 33.4 then 34.9, 34.9 (pairs 2, 3); phone gen-26 34.3, 34.1,
  33.7 then 32.7, 33.9.

  **What that says:** pair 2 is no slower anywhere; pair 3 on gen-26 is level on desktop and 3.7 ms slower on the phone, inside the
  phone's own spread of A runs (23.0 to 27.7 ms); the phone's p99 goes both ways (117.9 and 146.6 against 136.1 and 121.1). Desktop
  gen-26's churn is up about 1.4 MB a second in both pairs and the phone's is not: not explained, not profiled. Floor 21 (`world-3`) is
  slow with or without the depth (13 ms of game logic a frame on desktop): not from this pass.
- After the A/B, looks only (no new draws): the cloths (waymark strips, prayer flags, hides) two-sided and lifted as if by the wind (a
  hanging cloth is a line from the high camera), the looks-only jars and fallen drums made smaller than the cover's jars and columns.
