# The Climb, chapter 5: the War (floors 41 to 50)

Built 2026-11-14 on the branch `t3/climb-war-chapter-floors-41-50` (pipeline/designs/tower-50.md). Not merged, not live.

**What it is.** Floor 41, The Field of Banners, grown to five times its old ground, and nine made floors after it: 42 to 49, and
50, the chapter's crown and the last floor of the Climb, where the Raid's Ash and Ember are fought alone at the second tier. Each
floor is a broad field between low hills, wider east to west than north to south (about 35 000 m² of walkable ground, any outline),
where two ghost armies never stop fighting. A palisade, the siege line, runs across the whole north with the lair's gate in its
middle. Past the edge an earth bank with a hedge of sharpened stakes stops the walk, and grassland rolls up to hills. In the north
the enemy's keep stands on its ridge behind the siege line. The two armies camp on the hills either side, crimson on one and azure
on the other, with watch fires on the hilltops, columns of smoke and crows over the field. Light rain falls in a grey evening.

## Pictures

For every floor there are three pictures:
- `fNN-camp.jpg`: the game's camera at the camp.
- `fNN-place.jpg`: the game's camera at one place, a different kind on each floor: the hill (41), the field hospital (42, 50), the
  ruined keep (43, 49), the burned farm (44, 48), the wagons (45), the burned mill (46), the siege line's gate (47).
- `fNN-low.jpg`: a low view north from the camp towards the horizon.

Also:
- `f42-fight.jpg`, `f48-fight.jpg`: the war itself. The crimson banner taken, four crimson soldiers fight beside the hero against the
  azure pack at the works.
- `f47-edge.jpg`: where a walk stops (the earth bank and its hedge of stakes, the grassland beyond).
- `f41-map.jpg`, `f46-map.jpg`, `f50-map.jpg`: from above with the fog pushed away. They show the outline, the siege line, the roads,
  the places and an army's camp on the hills.

## The floors

| Floor | Name | Places (besides the camp) | Ruler | Gatekeeper |
|---|---|---|---|---|
| 41 | The Field of Banners (handmade, grown) | west and east ridges, north works, burned wagons, the hill, ruined keep, burned farm, siege line | The Last Marshal | Oblivion L4 (unchanged) |
| 42 | The Mud Fields | two ridges, field hospital, ruined keep, the hill, battery, baggage train, farmstead, siege line | The Iron Marshal | Sirix L3 |
| 43 | The Broken Line | two rises, field hospital, ruined keep, drummers' hill, siege works, baggage train, burned mill, siege line | The Siege Lord | Nyx L3 |
| 44 | Ashford | two ridges, surgeons' tents, ruined keep, the mound, battery, wagon line, farmstead, siege line | The Ashen General | Gus L3 |
| 45 | The King's Road | two knolls, surgeons' tents, ruined keep, drummers' hill, siege works, wagon line, burned farm, siege line | The Banner Knight | Hank L3 |
| 46 | The Trench Line | two rises, surgeons' tents, ruined keep, drummers' hill, battery, wagon line, burned mill, siege line | The Crow King | Shiori L3 |
| 47 | The Crows' Field | two rises, field hospital, ruined keep, drummers' hill, north works, burned wagons, burned farm, siege line | The Black Herald | Anka L3 |
| 48 | The Long Retreat | two knolls, field hospital, ruined keep, the hill, north works, burned wagons, burned farm, siege line | The War Drummer | Tempo L3 |
| 49 | The Last Ridge | two knolls, field hospital, ruined keep, the hill, north works, wagon line, burned farm, siege line | The Grey Captain | Mum L3 |
| 50 | The Crown of the War | two ridges, field hospital, broken keep, the mound, battery, burned wagons, burned mill, siege line | **Ash and Ember** (Raid boss, alone, tier 2) | Mabel L3 |

**Every made floor has:**
- **Places:** eight on two rings, joined by roads, and the siege line in the north.
- **The law of sides, floor 41's.** In the camp you take one of two banners. Its soldiers fight beside you and its packs are gone
  for good; the other army's packs hunt you. Each of the four sites holds a pack of each army, with the same mix.
- **Other enemies:** the siege line's guard (ashen soldiers led by the Banner Bearer, or another name for him), and two named
  enemies of neither army on patrol.
- **The main quest, floor 41's:** take the three standards, hold the hill while the dead come, fell the siege line's guard, go
  through the gate.
- **Three side quests:** carry the white cloth from the ruined keep to the field hospital (clearing the keep first from floor 44),
  lead a cart from the burned farm or mill to the camp, light two braziers. Plus two bounties.
- **Secrets and doors:** six caches, six waystones, the soldiers' stone, a rival's duel, a trial and the gate.

**The rulers** use the Last Marshal's moves: the guard marches, cleave, lunge, the line burns, and the standard in the room whose
fall makes the guard kneel. Each has another body and name and one extra move (an arrow volley, a fan or a charge).

**The law grows gently, in data only** (f45/laws.ts is unchanged):
- **Knights:** the sites with a knight in their mix go from 1 (floor 42) to 4 (floor 50).
- **The keep:** from floor 44 an ashen pack holds it, and from floor 48 it is led by a bearer.
- **The hold:** 42 s on floor 42, 58 s on floor 50; its waves come every 15 s, then every 14 s from floor 46.
- **The two hosts:** their names change from floor to floor (Crimson and Azure Host, Legion, Oath, Crown). Their ids stay `r` and `b`.

**Floor 41** keeps its people (Cantor, Sir Whiskers, Brannoc, Madame Cleaver), quests and their steps in the same order, enemies,
law, ruler, gatekeeper, rival and every id (the packs `a-r` to `d-b`, `siege`, `deserter`; the braziers `br1`, `br2`; caches `c1`
to `c3`, stones `w1` to `w3`). It has three more waystones and three more caches (new ids) for the longer walks, and two places only
to look at (a ruined keep, a burned farm). Its set pieces (pieces/floors.ts) and `tunedAs` (5) are unchanged. The small floor's
drawing (`f45/banners-zone.ts`) is no longer used.

**Difficulty.**
- `tunedAs` runs from 5.11 (floor 42) to 6 (floor 50): the game's own growth of roaming enemies, with nothing of the generator's on top.
- The set pieces' `hard` runs from 1.57 to 1.69.
- Every gatekeeper is at CPU level 3: nine different heroes, none of them a handmade floor's. Level 4 was tried first on floors 47
  to 50. The route bot lost floor 48's gate (Tempo) 37 times with Bram and needed six starts. It lost floor 49's gate (Mum) 44 times
  with Lyra and never cleared the floor.

## Checks (all on the final bake)

- `npx tsc --noEmit -p .`, `npm run build`: pass.
- `_worldCheck` on 41 to 50: nothing unreachable; reachable 34 900 to 35 200 m²; at most 6 units near one spot (a site: three of each
  army; `_worldCheck` counts both). The generator counts the same way and throws a layout over six. It also throws when a pack of
  neither army stands within 38 m of a site, when the hold is within 36 m of a site, when the escort's road passes a site or touches
  cover, when a waystone stands by a pack, or when a quest step names an army's pack.
- Route bot, one run per floor per hero (Lyra ranged, Bram melee), `maxSeconds` 4500, the bot taking the crimson banner:

| Floor | par / limit (s) | Lyra | Bram |
|---|---|---|---|
| 41 | 2200 / 3300 | cleared, 1092 s, 0 falls | cleared, 1298 s, 2 falls (gate 3 tries) |
| 42 | 2244 / 3366 | cleared, 1009 s, 0 falls | cleared, 1058 s, 0 falls |
| 43 | 2288 / 3432 | cleared, 1034 s, 0 falls | cleared, 1128 s, 0 falls |
| 44 | 2332 / 3498 | cleared, 995 s, 0 falls | cleared, 1061 s, 0 falls |
| 45 | 2376 / 3564 | cleared, 969 s, 0 falls | cleared, 1163 s, 1 fall (gate 2 tries); lost the rival's duel |
| 46 | 2420 / 3630 | cleared, 1002 s, 0 falls | cleared, 1092 s, 0 falls |
| 47 | 2464 / 3696 | cleared, 1043 s, 0 falls | cleared, 1115 s, 0 falls |
| 48 | 2508 / 3762 | cleared, 1089 s, 0 falls | cleared, 1227 s, 1 fall (gate 2 tries); lost the rival's duel |
| 49 | 2552 / 3828 | cleared, 1093 s, 2 falls (gate 3 tries) | cleared, 1055 s, 0 falls |
| 50 | 2596 / 3894 | cleared, 1028 s, 0 falls; Ash and Ember beaten first try | cleared, 1240 s, 0 falls; Ash and Ember beaten first try |

  No restarts in any of the 20 runs. Every fall was a lost gate duel. No page errors in any run. The floors take the bot 16 to 22
  minutes of game time against the sea's 30 to 41 (and the plan's 20 to 30): the four soldiers the banner gives fight beside the
  hero, so the field's packs go fast. So the par (about twice the bot's time) gives its star away. The levers are data only (pars,
  the hold's seconds, the sites' mixes, a fifth site) and are left to the lead.
- Ash and Ember alone at tier 2 (`_pieceRun`, full health): Lyra 2 of 2 (121 s, 127 s), Bram 1 of 2. Entered at 5 % health, it
  comes back a loss in 3 s (a life, not a hang).
- The other banner (`window.__worldBanner = 1`, azure): floor 44 with Lyra cleared, 956 s, 0 falls, 4 stars.
- `pipeline/tools/climb-saves/` 1 to 4 (the fresh menu, the migrated five-floor saves, a second reload, saves in the new numbering) on
  one kept profile: all four ok, no page errors. `1-fresh.js` now expects floors 42 to 50 to exist and 42 after 41. The migrated run
  continues floor 21, not 41: a five-floor save in the middle of floor 5 was not tried on the grown floor 41 (its ids are kept).
- Speed (`perf.py scenes --profiles desktop,phone-4x`, 1500 frames; the perf tool's `gen-` scenes now include 42 to 50):

| Profile | Scene | Median | p99 | Step | Draw | Draw calls | Triangles |
|---|---|---|---|---|---|---|---|
| desktop | world-1 (floor 1) | 8.7 ms | 20.5 | 0.7 | 2.7 | 270 | 648k |
| desktop | gen-46 (floor 46) | 10.1 to 11.8 ms | 28 to 33 | 1.1 to 1.4 | 2.9 to 3.4 | 326 | 423k |
| phone-4x | world-1 | 25.9 ms | 81 | 7.2 | 18.7 | 276 | 648k |
| phone-4x | gen-46 | 30.5 to 41.0 ms | 120 to 160 | 9.8 to 11.9 | 17.2 to 20.6 | 331 | 424k |

  **Floor 46 is slower than floor 1**, by 1.5 to 3 ms on desktop and 5 to 15 ms on the phone profile, and its p99 is higher. What
  makes it slower is not the drawing: it is the law's own squad (f45/laws.ts). Timed in the page at the same four packs, the step
  is 7 to 14 ms on floor 46 with the squad walking after the hero, 0.1 to 0.2 ms on floor 46 with no banner taken (no squad, and
  every pack asleep: not a full control), and 0.4 to 0.8 ms on floor 1. The scene sets the hero down at a new pack every ten
  seconds, and the four soldiers of the banner then plan a route across the field through the navigator every frame until they catch
  up (timed in the page: 9 to 17 ms a step while they walk, 1 to 4 ms once they stand by the hero; `nav.ts` `clear` and `plan` are the
  top of the profile, and most of the memory the scene asks for). The same holds on floor 41 (`world-5`: step 11.9 ms on desktop,
  66 ms on the phone profile, with three far pack visits in a row). In a person's play the hero walks and the squad walks beside it;
  the long routes come after a fall (the hero wakes at a waystone) or a door. A fix belongs to the law or the navigator (a squad unit
  far behind could re-plan only every half second, or be set down beside the hero past some distance): not done here (f45/laws.ts is
  the handmade floor's and shared).
- **The longest frame.** Floor 46 has one frame of 1.9 to 2.9 s on desktop (10 to 15 s on the phone profile), floor 1 one of 0.15 s.
  Read from the tool's `longest`: it is 1.02 s into the scene, 2169 ms of it the simulation's step and 116 ms the drawing. That is the
  moment the banner is taken and the squad musters (`sides` in f45/laws.ts takes it after 1.2 s of the floor's own clock), and it
  shows with the depth off too. Most likely it is the squad's first plan across the large zone (the navigator is at the top of the
  profile), but this was not separated further. A player would feel it as one hitch when taking a banner. Not fixed here (the law and
  the navigator are shared).
- **The depth's cost, A/B** (gen-46). The runs played the same load and the same fight: the depth is built on its own random stream,
  so the fight's dice do not change when it is switched off. Off, then on, twice:
  - Desktop median 9.8 / 10.1 and 11.2 / 10.2 ms: no consistent difference.
  - Phone-4x 29.1 / 30.5 and 36.0 / 37.2 ms: the depth about 1.3 ms slower both times, the same sign. Two runs of the same code
    differ by up to 7 ms there. Whether 1 ms on the phone profile passes the bar is the lead's call.
  - It costs 16 draw calls and about 70k triangles.
  - Earlier A/Bs played two different fights (three.js draws on `Math.random` for every object's id), so they said nothing.
  - What changed the numbers: running the same fight, and grass blades with no base (3 triangles a blade: 484k to 427k triangles in
    the frame). Taking out the far glow sprites, the pebbles and the far tents as instanced meshes left the draw calls where they
    were (326 on, 310 off): those were not in the measured frame.

## What the route runs taught (and the generator now does)

- **The escort's cart stood against the farm's walls for an hour.** The farm (or mill) in the inner south faced "outward", which
  for a place south of the middle is towards the camp, so its walls stood on the road to the camp; the cart starts there (floors 46
  and 47's first runs, 4500 s and stuck). Now the farm turns its back east or west, the cart starts on its camp side, and the
  generator throws out a layout whose escort road touches cover.
- **Level 4 gatekeepers** (above): all level 3.

## Known, not done

- No person has played these floors; every number is the route bot's. The bot always takes the crimson banner (`__worldBanner` 0);
  one run with the azure banner (floor 44) cleared as well.
- The people, rulers and enemies are the handmade floor's: heroes for people and rulers (as on every made floor), floor 41's
  code-drawn soldiers. New models are the separate model agents' work.
- The armies' camps, the keep and the hills past the edge are first-pass clean forms in code; the smoke is a stack of soft puffs.
- The depth's objects get the same three.js ids each time a floor is built (its own random stream, `warZone.ts`). Harmless as far as
  seen; worth knowing.
- On floors 48 to 50 the siege line's guard and the keep's ashen pack are led by the same kind (`bearer`), so two elites share a
  name on the floor.
- Not done, left for the lead: the War rows in `docs/architecture/tower-worlds.md`, a line in `src/game/changelog.ts`.
- `pipeline/tools/climb-saves/1-fresh.js` now lists floors 42 to 50 as existing and floor 41's next floor as 42.
- `src/tower/world/floors/gen/list.ts` is rewritten by the bake tool: it will conflict with the other chapters' at the merge (it
  lists every baked file in the folder; bake again after the merge).
- The perf tool's `world-5` scene (floor 41) prints another fight than before: the floor was rebuilt.

## How to make them again

    node pipeline/tools/gen-floors.ts 42-50      # the made floors (src/tower/world/floors/gen/war-NN.ts)
    node pipeline/tools/gen-banners.ts           # floor 41 (src/tower/world/floors/banners-made.ts)

The generator is `src/tower/world/gen/war.ts` (`makeWarFloor`, `makeBannersFloor`); the drawing `src/tower/world/warZone.ts`; the
depth `src/tower/world/warDepth.ts` (switched off for an A/B by `DEPTH` in warZone.ts, or `globalThis.__warDepth = false`).
