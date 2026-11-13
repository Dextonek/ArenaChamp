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

1. Floor 2 alone, end to end (generator, zone drawing from a layout, pieces), checked and pictured. **(done)**
2. Floors 3 to 9, then floor 10 **(done, see below)** (the crown: a Raid boss played alone if `bossFight` takes one, else a great ruler; a party fight
   needs the server and the user's word).
3. The renumbering, all at once and only before a release: today's floors 2 to 5 become 11, 21, 31, 41 by a fixed id (their pieces,
   their ruler's seed `world-ruler-<n>`, their tuning follow the id, not the number); the difficulty curve so floor 11 is not easier
   than floor 10; the saved floor reached, stars, times and a mid-floor run migrated (tested with old storage); "next floor" is the
   next one that exists; the menu shows the chapters; the perf scenes and the words "Five floors" follow.
4. Chapters 2 to 5's made floors, one chapter at a time.

Nothing is pushed or live until the user says so.

## Where it stands (2026-11-13, night): chapter 1 made and checked, on the branch `tower-50`; NOT in the game's list, NOT live

- **The generator** (`src/tower/world/gen/sea.ts`, run by `node pipeline/tools/gen-floors.ts 2-10`) makes floors 2 to 10 of the sea
  from floor 1's parts; baked in `src/tower/world/floors/gen/sea-NN.ts`, turned into floors by `floors/gen/index.ts`. The sea zone is
  drawn from a layout (`zone.ts` `SeaLook`, `buildSeaZone`; `land.ts` takes the sea's side and a seed); floor 1 is unchanged
  (`_worldCheck` 6349 m2, 38 spots).
- **Floor 10 is the crown:** the lair's door leads to the Sun Warden, a Raid boss played alone at tier 1 (`pieces/core.ts`
  `crownFight`, `PiecesDef.crown`).
- **What the checks found and the generator now does:** waystones at least 13 m from any pack (a fall wakes the hero at the last
  one: one 10 m from an awake elite was a loop of falls); the two land-side packs at least 37 m apart (the cap of six on a spot);
  the cave pack kept at five; roaming enemies only +1.5 % health and +1 % a hit a floor and the set pieces' `hard` 1 to 1.11 (the
  first curve, +7 % and +4 %, had the bot falling at every pack by floor 9; the handmade floors keep their roaming enemies level and
  grow in the set pieces); the main quest clears the wreck's guard before its key is carried; the made floors' packs leash at 24 m
  (`PackDef.leash`: at 16 m a fight that drifted reset the pack while its units stood by the hero, and a ranged hero stepping back as
  it shot woke it, lost it and woke it again); a rival's duel has its own height (`RivalDef.height`, not twice the floor's number).
- **Checked:** type check; `_worldCheck` on every made floor (nothing unreachable, at most six units on a spot); the route bot (Lyra)
  three runs on each of floors 2 to 9 (24 of 24 cleared, 0 to 2 falls, a restart now and then from floor 6) and two on floor 10
  (cleared both, the Sun Warden beaten in 92 and 99 s); floor 1 five of five. Pictures of all ten (shown to the user).
- **Known:** the made floors share floor 1's skeleton (camp south, lair wall north, the town on the land side), so they differ by
  which places they have, where, and which side the sea is on; more variety (time of day, weather, other kinds of place) is open.
  People: nine different gatekeepers for floors 2 to 10 (none of the handmade floors'), no two floors with the same four people, a
- **To try one:** on the tool page, `await _worldGen(n)` then `_world({ floor: n })` or `_worldRoute({ floor: n })` (world-tool.js).
- **Next:** the renumbering (stage 3 above, all of it before any release), then chapters 2 to 5's generators (the Wood, the Sands,
  the Deep, the War) the same way, each with its crown (Ash and Ember, the Heart of Noon...).
- **After the review (the same night):** gatekeepers and people no longer repeat (the hero list had wrapped after six floors:
  floors 2 and 8 had the same people and gatekeeper); rulers' bodies rotate; the words read right ("Mother of Wrecks' door",
  "the Bell Below" mid-sentence, the light named as the place is). Checked again with the route bot, one run each on floors 2 to 10:
  Lyra 9 of 9, Bram (melee) 9 of 9 (floor 8's gatekeeper Mabel took him 7 tries); the crown lost at 5 % health comes back a loss
  in 13 s (a life, not a hang), won at full health in 120 s (the Sun Warden's enrage is at 132 s); floor 1's perf print is still
  `de2e692e` (8.2 ms).
