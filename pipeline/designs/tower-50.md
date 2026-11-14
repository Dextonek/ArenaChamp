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
   next one that exists; the menu shows the chapters; the perf scenes and the words "Five floors" follow. **(done 2026-11-14, see
   *The renumbering* below; the curve was left as it was: the Wood's set pieces are 1.12 against floor 10's 1.11)**
4. Chapters 2 to 5's made floors, one chapter at a time.

Nothing is pushed or live until the user says so.

## Where it stands (2026-11-13, night): chapter 1 made and checked, on the branch `tower-50`; NOT live (in the game's list since the renumbering, below)

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
  People: nine different gatekeepers for floors 2 to 10 (none of the handmade floors'), no two floors with the same four people.
- **To try one:** on the tool page, `_world({ floor: n })` or `_worldRoute({ floor: n })` (world-tool.js): since the renumbering every
  made floor is in the Climb's list, so `_worldGen(n)` only says what floor `n` is.
- **Next:** the renumbering (stage 3 above; done 2026-11-14, *The renumbering* below), then chapters 2 to 5's generators (the Wood, the Sands,
  the Deep, the War) the same way, each with its crown (Ash and Ember, the Heart of Noon...).
- **After the review (the same night):** gatekeepers and people no longer repeat (the hero list had wrapped after six floors:
  floors 2 and 8 had the same people and gatekeeper); rulers' bodies rotate; the words read right ("Mother of Wrecks' door",
  "the Bell Below" mid-sentence, the light named as the place is). Checked again with the route bot, one run each on floors 2 to 10:
  Lyra 9 of 9, Bram (melee) 9 of 9 (floor 8's gatekeeper Mabel took him 7 tries); the crown lost at 5 % health comes back a loss
  in 13 s (a life, not a hang), won at full health in 120 s (the Sun Warden's enrage is at 132 s); floor 1's perf print is still
  `de2e692e` (8.2 ms).

## The new scope (2026-11-14): all 50 floors, five times the ground, new models, agents

The user, shown chapter 1: "yes continue make it till floor 50 and if you need to create like new model for some npc and stuff make
new ones also for enemies just make new dont just reuse heroes that we have and continue till 50 and lets make those maps 5 x larger
than now; make more agents to work together". Asked what "5x larger" means: **five times the ground** (the walkable radius 48 m
becomes about 107 m; a floor of 20 to 30 minutes), and **the five handmade floors grow too**. Then: "and also it doesnt need to
have circular shape it can be whatever": **a floor's walkable ground is any shape** (a coast, a valley, a canyon), about five times
today's area, not a circle.

- **Size and shape first.** Every floor is rebuilt at the new size, so nothing more is built at 48 m. The engine's walk is clamped to
  +-55 m and kept inside a circle (`Arena.walk`, `keepInside`, src/arena.ts, a shared engine file: one writer): a zone gets a walkable
  outline of its own (a polygon) that the walk, the navigator, the summons, the camera and the checks follow; duels and the Raid keep their rings. Other size assumptions to
  find and fix: the navigator's cost (it grows with the pieces of cover), the painted ground (2048 px over 112 m), the land mesh
  (420 m), the fog and the sun's shadow box, `_worldCheck`'s grid, the route bot's limits. One sea floor at the new size is measured
  (perf on desktop and the phone profile, the bot's time) before the rest. Duels and the Raid must not change (`test:server`, the
  duel scenes' perf prints, the raid checks).
- **New models, not heroes, for the people, the enemies and the rulers.** Made like the heroes (blender/heroes/real, the style
  rules in docs/ART_BIBLE.md and blender/arenas/real/STYLE.md), and **shown first as a sheet beside Sefu and Kaia for the user's yes**
  (the house rule for a new look). One agent at a time in Blender (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` on
  this computer; the scripts' default is `D:/blender/blender.exe`). `PersonDef.hero` and `RulerDef.stand` name roster heroes today:
  they get a way to name a model of their own. **Gatekeepers and rivals stay heroes:** they are duels against a hero by design.
- **Agents:** at most three at once (CLAUDE.md), each in its own worktree and dev-server port. First wave: the size work, the model
  sheet, the renumbering (menu and saves). Second wave, once the size is settled: the generator's shared core pulled out of
  `gen/sea.ts`, then one chapter each (the Wood, the Sands, the Deep, the War), each to the same bar: `_worldCheck` clean, the route
  bot with a ranged and a melee hero, pictures.
- **Not in this:** the story, secrets and watchers (the user has not chosen); nothing is pushed or live until the user says so.

## The renumbering (stage 3, 2026-11-14): done on the branch `t3/climb-50-renumbering`; NOT merged, NOT live

- **The list:** `FLOORS` (`src/tower/world/floors/index.ts`) has 1 (the harbour), 2 to 10 (the sea's made floors, from `GEN_FLOORS`),
  11 the Wood, 21 the Canyon, 31 the Deep, 41 the Banners; with `CHAPTERS`, `isCrown`, `floorAbove` (the next floor that exists: after
  10 comes 11, after 11 comes 21 until 12 is made) and `floorAtOrBelow`. `piecesOf(n)` finds a handmade floor's pieces by their
  `floor` and a made floor's from `GEN_FLOORS`. The result card's "Climb to floor N" and the floor a later climb may begin on both
  follow `floorAbove`; a floor asked for that does not exist gives the highest one below it.
- **The same fights:** the four that moved carry `tunedAs` (2 to 5) on their `FloorDef` and `PiecesDef`: their roaming enemies'
  numbers (`floorNumbers`, which grow with the floor's number: at 11 the Wood's packs would have had 1.98 times their health, not 1.08),
  the ruler's, trial's and rival's seeds (`world-ruler-2`, `world-trial-2`, `world-rival-2`...) follow it, and the rivals have their old
  heights written out (4, 6, 10). The perf tool's `world-1` to `world-5` (now floors 1, 11, 21, 31, 41) print the same fights before and
  after (desktop, 900 frames: b75a6f15, b498f398, a824a7c4, e3ab55a9, fe442cf5).
- **Saves:** `migrateSaves` (`state.ts`), once, by the version key `tower.world.version` (2): old floors 2 to 5 -> 11, 21, 31, 41 for the
  stars, the best times and a run in progress; the floor reached likewise (old 6, all five cleared, -> 42). Tested in a real browser,
  four runs on one kept profile: `pipeline/tools/climb-saves/` (its README).
- **The menu:** the picked floor's line, then five chapters of ten small number tiles (ten to a row, five on a phone), open / padlock /
  dashed "soon" / a crown on every tenth. Pictures: `docs/tower/climb50/`.
- **Checked:** type check, build, `npm run test:server`; the four save runs all ok, no page errors; floor 1 begun from a fresh menu,
  the Storm Canyon continued from a migrated save (its quest step, shards, lives and clock), floor 2 begun from the menu; the route bot
  (Lyra) cleared floor 11 (578 game seconds, the gate lost once, 3 stars of 4).
- **Known:** the made sea floors' roaming enemies get `floorNumbers(n)` on top of the generator's own +1.5 % a floor, so floor 10's
  packs have about 1.95 times floor 1's health and the Wood's (floor 11, tuned as 2) 1.08: a step down after the crown. Left as it is
  (the task said to leave the curve); worth a look when the Wood's made floors are tuned.

## Progress on the new scope (2026-11-14)

- **Size and shape: done for the sea.** The engine's one change: the walk's box follows the play area (`Arena.walk`, src/arena.ts),
  and the sky stands round the camera (src/runtime.ts: a dome round the middle showed its cut-off far side from 120 m out). A zone's
  outline is radii round the middle (gen/core.ts `makeOutline`, land.ts `rimAt`) and its invisible edge walls are fixed cover (look
  `edge`): the walk, the navigator, the summons and the checks keep inside it with no other engine change. Duels and the Raid are as
  they were (`test:server` passes; floor 1's old perf print held through the sky change).
- **The sea at the new size:** floors 2 to 10 re-made (eight places on two rings, a ring road, two named enemies, three side quests,
  six caches and waystones, 16 tidal flats; floor 10 the Sun Warden's crown) and floor 1 grown (gen/harbour.ts: the sea's generator
  dressed as the harbour, its people, quests, Old Barnacle, Tam, Zephyr's race; the old save ids kept). Every floor: about 34,900 m2
  reachable (floor 1 was 6,349), nothing unreachable, at most five units near a spot. Route bot, one run each: floor 1 Lyra and Bram
  cleared in 22 min, no falls; floors 2 to 10 Lyra 9 of 9 (30 to 41 min) and Bram 9 of 9 (30 to 35 min), 0 to 3 falls, one restart in
  18 runs. Speed: the large floor 2 8.1 ms a frame on desktop (floor 1 7.7) and 19.6 on the phone profile (21.9); one long frame
  while the zone is built (the 4096 px painted ground), behind the loading page.
- **The curve:** the game raises roaming enemies by the floor's tuned number (`floorNumbers`); the sea's made floors are tuned as 1 to
  2 (`tunedAs`), so the Wood (11, tuned as 2) follows on with no step. The renumbering agent found it (with an own +1.5 % a floor on
  top of the real number, floor 9's packs were nearly twice floor 1's).
- **Chapters as hooks:** a generator a chapter (gen/chapters.ts), an arena builder a chapter (floors/gen/arenas.ts), the baking tool
  by floor number (`node pipeline/tools/gen-floors.ts 12-20`, `harbour` for floor 1), crowns with a tier (`PiecesDef.crownTier`).
- **Agents:** the renumbering (merged: floors 1, 11, 21, 31, 41; saves migrated and tested; the menu in five chapters); the sea's new
  models (branch `t3/tower-sea-npc-models`: a keeper, a quest giver, a trader, a drowned docker and the Drowned Admiral, a sheet
  beside Sefu and Kaia in docs/tower/models/, waiting on the user's yes; not in the game); the Wood, the Sands and the Deep each in
  their own worktree (briefs: the same bar as the sea), the War next.
- **Depth (the user: "make all the background look fit there, all the roads and zones"), the sea done:** src/tower/world/depth.ts,
  looks only, nothing to walk into. Lanterns, kerb stones, fences and signposts line the roads. The meadows have grass, flowers and
  pebbles. Each place is dressed as what it is (market, village, wreck, shipyard, beacon, chapel, fort, caves, salt pans, camp). Out
  on the far sea there are islands with a light, and seabirds fly overhead. Village houses are drawn as cottages, each with a roof of its own colour.
  In an A/B on floor 2 under the same load, the frames were no slower. Each other chapter gets its own depth pass, made the same way
  in its own zone file, once its floors are built.
- **The Sands (floors 21 to 30), merged (2026-11-14):** a generator for floors 22 to 30 (gen/sands.ts) and its zone drawing
  (sandsZone.ts): red stepped cliffs, dunes, mesas in the haze. Floor 21, the Storm Canyon, is grown and keeps its ids (baked by
  `pipeline/tools/gen-canyon.ts`). Floor 30 is the crown, the Heart of Noon. tunedAs runs 3.11 to 4. The storm's timing is worked
  out from the zone's size and the wall moves at walking speed; its wall is now drawn as high as the cliffs. The route bot cleared
  all ten floors with Lyra and Bram, within par x 1.5; the caravans wait in a rock's lee and walk short roads. Pictures and numbers
  are in docs/tower/climb50/sands/. Found on the way and fixed for every chapter: a named enemy's patrol walked on mid-fight, so it
  gave up and healed (packs.ts; it now stands still while it fights).
- **The War (41 to 50)** is now with an agent, its brief including a depth pass of its own. The Wood and the Deep are still being
  made. The Sands get their depth pass when an agent slot frees.
- **The Wood (floors 11 to 20), merged (2026-11-14):** glades parted by bands of trees, each band with a pass that walls of
  roots close by turns (gen/wood.ts, woodZone.ts). Floor 11 is grown and keeps its ids (`pipeline/tools/gen-wood11.ts`), and floor 20
  is the crown, Ash and Ember. The route bot cleared all ten floors with Lyra and Bram (30 of 30, roots both free and held still), and
  the four save runs pass on the merged branch. Notes and pictures are in docs/tower/climb50/wood/. **To look at later:** after the
  roots change, the first long walk ordered costs the navigator 46 to 464 ms on the desktop, and the phone profile's slowest frames are
  worse than floor 1's.
- **Depth for the Wood and the Sands** has gone to an agent (woodDepth.ts, sandsDepth.ts). The Deep and the War are still being made.
- **The Deep (floors 31 to 40), merged (2026-11-14):** each floor is a cave with an outline of its own: low ridges make chambers,
  mine tracks run between them, a black lake lies on one side, and halls are walled with stalagmites (gen/deep.ts, deepZone.ts). Floor 31
  is grown and keeps its quests and fights (`pipeline/tools/gen-deep-home.ts`), and floor 40 is the crown, the Sun Warden at tier 2. The
  route bot cleared all ten floors with Lyra and Bram; every fall was a lost gate duel. Notes and pictures are in
  docs/tower/climb50/deep/. **To look at later:** on the phone profile a Deep floor takes up to 3.9 s to build, against floor 1's 0.6 s.
  The Deep's pieces of cover carry the nearest drawable kind, with their real kind in a separate `kinds` list on the look; widening the
  kinds type in zone.ts would end that. `f45/deep-zone.ts` is no longer used.
- **Depth for the Deep** has gone to an agent (deepDepth.ts). Still running: the War, and depth for the Wood and the Sands.
- **Depth for the Wood and the Sands, merged (2026-11-14):** woodDepth.ts and sandsDepth.ts, called from their zones, which are handed
  the floor's spots to keep clear of (keep.ts). Before-and-after sheets are in docs/tower/climb50/{wood,sands}/depth/. Speed: on the
  phone profile both are within the noise. On the desktop, Wood floor 11 is 0.2 to 0.5 ms a frame slower, and memory churn rises by
  about 1 MB a second on some scenes, not yet explained.
