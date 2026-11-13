# The Climb to 50 floors: the build plan

The user, 2026-11-13: "we want to make 100 floors", shown a plan of 10 chapters of 10 (one handmade, eight made by a generator,
one boss crown), then: "okay lets make it up to 50 floors". So: **five chapters of ten**, and the five floors built so far are the
five chapters' handmade floors.

| Chapter | Floors | Handmade floor (today's) | Made by the generator | Crown |
|---|---|---|---|---|
| 1 The Sea | 1 to 10 | 1 The Drowned Harbour | 2 to 9 | 10 |
| 2 The Wood | 11 to 20 | 11 The Walking Wood (today's floor 2) | 12 to 19 | 20 |
| 3 The Sands | 21 to 30 | 21 The Storm Canyon (today's 3) | 22 to 29 | 30 |
| 4 The Deep | 31 to 40 | 31 The Lightless Deep (today's 4) | 32 to 39 | 40 |
| 5 The War | 41 to 50 | 41 The Field of Banners (today's 5) | 42 to 49 | 50 |

Story, secrets and the Stewards (the watchers) are a separate decision the user has not made yet
(the ideas: a Tower that collects worlds; written Stewards first, a live AI one maybe later).

## Rules

1. **Floors are baked, not made at run time.** The generator is a tool (`pipeline/tools/gen-floors.ts`, run with `node`) that writes
   each made floor's data as a file under `src/tower/world/floors/gen/`; the files are committed. The floor the route bot checked is
   the floor every player gets, a saved run never changes under a player, and a bad floor can be fixed by hand.
2. **A chapter's made floors are its handmade floor's parts, rearranged and stronger:** the same land and look, enemies, law and
   kinds of quest, in a new layout from the floor's number. The generator code imports types only (it runs under `node`).
3. **Every spot is reserved before cover is placed:** people, doors, caches, waystones, the lore stone, quest places, patrol and
   lead paths, the camp. Flats (the tide's low ground) stay off the camp, the doors and the places' stands; packs are spaced so no
   point has more than six units near it (`_worldCheck`'s `mostUnitsNear`).
4. **The camera looks north:** the camp is in the south, the lair in the north, the cliff north; the sea is east or west (mirrored),
   never south. Nothing tall south of the walkable ground.
5. **A made floor ships only when** `_worldCheck` finds nothing unreachable and the route bot clears it from camp to gate within the
   floor's par and a half. A floor that fails is made again from the next seed.
6. **Floor 1 does not change** when the zone drawing is generalised: the same `_worldCheck` numbers and the perf print `de2e692e`.

## Order

1. Floor 2 alone, end to end (generator, zone drawing from a layout, pieces), checked and pictured. **(now)**
2. Floors 3 to 9, then floor 10 (the crown: a Raid boss played alone if `bossFight` takes one, else a great ruler; a party fight
   needs the server and the user's word).
3. The renumbering, all at once and only before a release: today's floors 2 to 5 become 11, 21, 31, 41 by a fixed id (their pieces,
   their ruler's seed `world-ruler-<n>`, their tuning follow the id, not the number); the difficulty curve so floor 11 is not easier
   than floor 10; the saved floor reached, stars, times and a mid-floor run migrated (tested with old storage); "next floor" is the
   next one that exists; the menu shows the chapters; the perf scenes and the words "Five floors" follow.
4. Chapters 2 to 5's made floors, one chapter at a time.

Nothing is pushed or live until the user says so.
