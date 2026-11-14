# The Climb, chapter 3: the Sands (floors 21 to 30)

Built 2026-11-14 on the branch `t3/climb-sands-chapter-three` (pipeline/designs/tower-50.md). Not merged, not live.

**What it is.** Floor 21, The Storm Canyon, grown to five times its old ground, and nine made floors after it: 22 to 29, and
30, the chapter's crown, where the Raid's Heart of Noon is fought alone. Each floor is a long wadi in a red canyon (any outline: a
narrow canyon or a wide basin), about 36 000 m² of walkable sand, with the canyon's cliffs rising past its edge on the walls' side and
in the north, dunes rolling away on the other side (east or west by floor), low ledges in the south, mesas in the haze.

## Pictures

For every floor: `fNN-camp.jpg` (the game's camera at the camp), `fNN-place.jpg` (the game's camera at a place: the tombs on the made
floors, the old fort with its raiders on floor 21), `fNN-low.jpg` (a low view north towards the horizon). `f26-storm-front.jpg` and `f26-storm-inside.jpg`: the storm at the new size (the
page's own sand layer, which hides all but a circle round the hero, is not in the second). Also `f21-map.jpg`,
`f22-map.jpg`, `f30-map.jpg` (from above, in the haze: the outline, roads and places) and `f21-edge.jpg`, `f25-edge.jpg` (the lair's
wall against the north cliff: what stands where a walk stops).

## The floors

| Floor | Name | Places (besides the camp) | Ruler | Gatekeeper |
|---|---|---|---|---|
| 21 | The Storm Canyon (handmade, grown) | three wells, the bridge, two bays, the old fort, the raiders' gate | The Scarab Colossus | Sefu L3 |
| 22 | The Red Wadi | raiders' camp, travellers' court, tombs, mud fort, watchtower, sun shrine, fallen obelisk, palm well | The Scarab King | Cantor L3 |
| 23 | The Glass Flats | ruined temple, travellers' court, rock tombs, old fort, watchtower, obelisk, fallen obelisk, oasis | The Dune Colossus | Silvane L3 |
| 24 | Caravan Rest | colonnade, caravanserai, tombs, mud fort, watchtower, sun shrine, fallen obelisk, oasis | The Brass Sphinx | Lyra L3 |
| 25 | The Singing Dunes | colonnade, travellers' court, kings' tombs, old fort, watchtower, obelisk, fallen obelisk, oasis | The Glass Serpent | Kaia L3 |
| 26 | The Brass Road | raiders' camp, travellers' court, tombs, old fort, signal tower, sun shrine, scarab dig, oasis | The Mirage Lord | Gus L3 |
| 27 | The Dry Wells | raiders' camp, caravanserai, kings' tombs, ruined temple, watchtower, obelisk, fallen obelisk, oasis | The Sand Tyrant | Nyx L3 |
| 28 | The Scorpion Steps | red tents, caravanserai, rock tombs, ruined temple, signal tower, sun shrine, fallen obelisk, oasis | The Red Jackal | Isolde L3 |
| 29 | The Mirage Road | raiders' camp, travellers' court, tombs, mud fort, signal tower, obelisk, fallen obelisk, oasis | The Sun-Eater | Brannoc L3 |
| 30 | The Crown of the Sands | ruined temple, caravanserai, tombs, old fort, watchtower, sun shrine, scarab dig, palm well | **The Heart of Noon** (Raid boss, alone, tier 1) | Bo L3 |

Every made floor has: eight places on two rings joined by roads; four packs of raiders and slingers (one with the chief as its elite,
guarding the gate's seal), two named enemies on patrol, the main quest (clear a pack, carry water from the camp spring to the oasis,
clear the seal's guard, carry the seal to the winch: the brass door opens), three side quests (a reach and a hold, leading a caravan,
lighting two watch fires), six caches, six waystones, the wind stone, a rival's duel, a trial and the gate. The rulers use the Scarab
Colossus's moves (it burrows, marks the sand, calls the storm) with another body, name and one extra move.

**Floor 21** keeps its people (Pip, Kaia, Vesper, Wick), quests, enemies, ruler, gatekeeper, rival and every id (checked with
`pipeline/tools/climb-saves/2-migrated.js`: a five-floor save continues the grown canyon at its quest step, shards and clock); it has three more waystones and three more caches (new ids) for the longer
walks, and its caravan is led about 90 m up the canyon instead of the whole canyon (below). Its set pieces (pieces/floors.ts) and
`tunedAs` (3) are unchanged.

**Difficulty.** `tunedAs` runs 3.11 (22) to 4 (30): the game's own growth of roaming enemies; nothing of the generator's on top.
The set pieces' `hard` runs 1.27 to 1.39. All gatekeepers are CPU level 3, nine different heroes, none of a handmade floor's.

**The storm, at the new size.** The band sweeps the whole zone (`2 × ring + width` metres) in `lasts` seconds, so `lasts` is worked out
from each floor's ring to keep the band at a walking speed: 4.5 m/s on floor 21 up to 5.5 on floor 30, 22 m deep up to 30, 4 % of max
health a second up to 5 %, a storm every 124 to 147 s. At most four dust wraiths (five, tried first, beside an awake pack felled the
route bot at floor 28's dig).

## Checks (all on the final bake)

- `npx tsc --noEmit -p .`, `npm run build`: pass.
- `_worldCheck` on 21 to 30: nothing unreachable; reachable 33 900 to 34 300 m²; at most 5 units near one spot (21: 3).
- Route bot, one run per floor per hero (Lyra ranged, Bram melee), `maxSeconds` 4500; the limit is par × 1.5:

| Floor | par / limit (s) | Lyra | Bram |
|---|---|---|---|
| 21 | 1980 / 2970 | cleared, 1853 s, 0 falls | cleared, 2175 s, 0 falls |
| 22 | 2024 / 3036 | cleared, 2112 s, 0 falls | cleared, 1927 s, 0 falls |
| 23 | 2068 / 3102 | cleared, 2144 s, 0 falls | cleared, 2560 s, 0 falls |
| 24 | 2112 / 3168 | cleared, 2318 s, 1 fall, gate 2 tries | cleared, 2358 s, 0 falls |
| 25 | 2156 / 3234 | cleared, 2156 s, 2 falls, gate 2 tries | cleared, 3125 s, 1 fall, ruler 2 tries |
| 26 | 2200 / 3300 | cleared, 2221 s, 1 fall | cleared, 2250 s, 0 falls |
| 27 | 2244 / 3366 | cleared, 2529 s, 2 falls | cleared, 2410 s, 0 falls |
| 28 | 2288 / 3432 | cleared, 3051 s, 3 falls | cleared, 2456 s, 1 fall |
| 29 | 2332 / 3498 | cleared, 2882 s, 3 falls, lost the rival's duel | cleared, 2882 s on its third start (6 falls, 2 restarts) |
| 30 | 2376 / 3564 | cleared, 2351 s, 1 fall; the Heart beaten first try | cleared, 2703 s, 0 falls; the Heart beaten first try |

  A third of each run is the bot standing in a lee while a storm crosses (500 to 1000 s). A run's seconds are the clock of its last
  start: Bram's floor 29 played about 5400 s in all before its third start cleared it.

  Run again (the thinnest): 25 Bram cleared, 3008 s on its second start (3 falls in the first); 28 Lyra cleared, 2202 s, 0 falls;
  29 Bram cleared, 3010 s, 0 falls, first start; 29 Bram once more with a probe: cleared, 3255 s on its second start. So the melee
  hero's late floors do end in a restart now and then (2 of 3 runs on floor 29, 1 of 2 on 25), mostly at the named enemies (below).
- The Heart of Noon alone (`_pieceRun`, tier 1, full health): Lyra 2 of 2 (94 s, 89 s), Bram 1 of 2; entered at 5 % health it comes back a
  loss in about 4 s (a life, not a hang).
- Speed (`perf.py scenes --label sands --profiles desktop,phone-4x --scenes world-1,gen-26`): see below.

| Profile | Scene | Median | p99 | Warm p99 | Draw calls | Triangles |
|---|---|---|---|---|---|---|
| desktop | world-1 (floor 1) | 11.0 ms | 19.8 | 17.0 | 278 | 406k |
| desktop | gen-26 (floor 26) | 10.4 ms | 22.6 | 18.4 | 238 | 182k |
| phone-4x | world-1 | 42.8 ms | 100.5 | 60.8 | 284 | 406k |
| phone-4x | gen-26 | 36.2 ms | 81.5 | 78.1 | 244 | 185k |

  Not slower than floor 1 by the median on either profile; on the phone profile its warm p99 is higher (78 against 61 ms). Floor 1's
  print is unchanged (`de2e692e`). The `gen-` scenes now include 22 to 30. `world-3` (floor 21) prints another fight than before:
  the floor was rebuilt.

## What the route runs taught (and the generator now does)

- **The caravan must live through the storm.** The escort is a hero-side unit; a storm burns it as it burns the hero, and while the
  hero waits in a lee the dust wraiths find it. A caravan waiting in the open was dead after four or five storms, and one left mid-road
  when a storm came was felled (most likely by the storm's wraiths, which come out round the hero waiting nearby) and started its road again: the first roads (230 m, from the tombs to the camp; floor 21 the whole
  canyon) were walked again and again for up to 40 minutes. Now the caravan waits in a rock's lee, its road is short (28 to 63 m, to
  the caravanserai next door; floor 21 about 90 m), with a point every 6 m.
- **Roads leave the tombs by their mouth**: the edge point towards the next place was inside the horseshoe of rock.
- The calm between storms is 80 s on floor 21, 68 s on floor 30 (64 s first: the bot spent 865 of 2586 s in a lee on floor 22).

## Known, not done

- **Named enemies heal mid-fight (an engine matter, `packs.ts`).** A named enemy's home is where its patrol has got to by the clock
  (`home`), and the patrol keeps walking (1.6 m/s) while the enemy fights; after about 15 s of fighting it is more than its leash
  (24 m, set for every named pack whatever the floor says) from that home, gives up, walks after it and is back at full health. A probe
  of floor 29 with Bram counted 28 give-ups in one try at the Dune Mother, most with the hero beside it; that try ended in three falls
  and a restart. It touches every floor with a named patrol (the sea's made floors and floor 21's Dune Mother too). Fixes: in the engine,
  stop the patrol's clock while the enemy is awake, or measure the leash from where it woke; in data, a slower patrol (`named.speed`).
- The storm's wraiths still spawn inside a circle round the middle (`law.ts`), not the outline; a spawn point past the edge is
  refused by its line of sight, so it only costs a try.
- The cliffs past the edge are a height field with the strata painted by height: they read as a cliff from the game's camera and the
  low views, a little soft close up. The palms, obelisks and the fallen obelisk are first-pass shapes in code.
- The storm's wall (`law.ts`) is drawn 7 m high and its dust is the old floor's 260 motes over a zone three times as wide: at the new
  size the front reads as a low band against cliffs of 9 to 19 m (`f26-storm-front.jpg`).
- `pipeline/tools/climb-saves/1-fresh.js` lists the floors that exist; it predates 22 to 30 and fails on them until it is updated.
- No person has played these floors; every number is the route bot's.

## How to make them again

    node pipeline/tools/gen-floors.ts 22-30      # the made floors (src/tower/world/floors/gen/sands-NN.ts)
    node pipeline/tools/gen-canyon.ts            # floor 21 (src/tower/world/floors/canyon-made.ts)

The generator is `src/tower/world/gen/sands.ts` (`makeSandsFloor`, `makeCanyonFloor`); the drawing `src/tower/world/sandsZone.ts`.
