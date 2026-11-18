# The Climb's chapter 2: the Wood (floors 11 to 20)

Pictures of the Wood at the new size (pipeline/designs/tower-50.md, "The new scope": five times the ground, any outline, the handmade
floors grow too). Not live; on the branch only.

- `fNN-game.jpg`: floor NN in the game's own camera, the hero walking up to the first pack's glade.
- `fNN-low.jpg`: floor NN from the camp's edge, a low view north to the horizon (the heart's glade, the Elder tree in the haze).
- `maps.jpg`: all ten from above (north up, the camp at the bottom, the lair's wall of roots and the Elder tree at the top).
- `depth/`: the depth pass (2026-11-14; `src/tower/world/woodDepth.ts`): the trails, glades, places and far wood dressed, before and after
  side by side (`depth/fNN-sheet.jpg`); what is in it and its checks in `depth/README.md`. The `fNN-game.jpg` / `fNN-low.jpg` above are
  from before it.

## What the Wood is at this size

Floor 11 at 48 m was a maze of narrow corridors cut through solid tree masses. At five times the ground that way needs thousands of pieces
of cover, and the navigator's cost grows with them, so the Wood is now **glades**: the floor is cut into cells round its ten places (the
camp, the heart and eight others), and every border between two cells is a **band of trees** (one long piece of cover each, drawn as two
rows of trees with bushes at their feet). A border has a **pass** where its two places are joined, lit by two lanterns. The `paths` law
closes some passes with a wall of roots: the passes of a tree joining every glade never close (the camp to the lair, the wisps' and the
named enemies' ways); 3 to 4 others are shortcuts that close half at a time and open again. Inside a glade: its place, and open forest
floor with groves, single oaks, rocks, thorn bushes and logs. Past the outline the wood goes on, up wooded hills to a ridge in the north.

Things to judge by eye:

- **Trees between the camera and the hero thin out** (a see-through hole round the hero), or a band south of a pass would hide whoever walks
  it. A low camera keeps every tree.
- The lair is a **wall of roots with the door in its doorway** (no walled yard behind it: a closed yard made one order to its door cost the
  navigator 1.4 s). Behind the wall, to the edge, the Elder's roots; the Elder tree stands past the edge.
- Late-afternoon gold, a green haze; lantern light is the only glow (the places, the passes, the hollow oak, the charcoal mound, the fire).

## The floors

| Floor | Name | Places (besides the camp and the heart) | Ruler (body) | Gatekeeper | Walls of roots | Tuned as / pieces' `hard` | Rival | Cover |
|---|---|---|---|---|---|---|---|---|
| 11 | The Walking Wood (handmade, grown) | hounds' den, bramble, old stones, giants' glade, thicket, the west and east lamp glades | The Elder Root (Hank) | Fenna L4 | 3 + 3, every 120 s | 2 / 1.12 | Nyx | 176 |
| 12 | The Mossway | bark den, burners' clearing, thicket, giants' glade, lantern shrine, spring, old stones, hollow oak | The Moss Warden (Hank) | Nyx L3 | 3 + 3, every 118 s | 2.11 / 1.13 | Vesper | 186 |
| 13 | Hollowmere | bramble, charcoal clearing, bark den, stag glade, wayside shrine, mossy spring, standing stones, hollow oak | The Thorn Mother (Brannoc) | Mortis L3 | 3 + 3, every 116 s | 2.22 / 1.15 | Mabel | 186 |
| 14 | The Thornfold | thorn brake, charcoal clearing, thicket, giants' glade, wayside shrine, spring, old stones, hollow oak | The Antler King (Mortis) | Isolde L3 | 3 + 3, every 114 s | 2.33 / 1.16 | Sirix | 188 |
| 15 | The Antler Glades | hounds' den, burners' clearing, dark thicket, standing stones, mossy spring, wayside shrine, stag glade, old oak | The Hollow Elder (Bram) | Silvane L3 | 3 + 3, every 112 s | 2.44 / 1.17 | Sefu | 186 |
| 16 | Lanternroot | bramble, charcoal clearing, hounds' den, stag glade, mossy spring, wayside shrine, standing stones, old oak | The Briar Witch (Cantor) | Hank L3 | 4 + 4, every 110 s | 2.56 / 1.18 | Pip | 190 |
| 17 | The Whispering Stand | bark den, charcoal clearing, dark thicket, standing stones, wayside shrine, mossy spring, giants' glade, old oak | The Lantern Root (Oblivion) | Bram L3 | 4 + 4, every 108 s | 2.67 / 1.2 | Lyra | 190 |
| 18 | Greyoak Deep | bark den, burners' clearing, dark thicket, giants' glade, spring, lantern shrine, old stones, old oak | The Grey Oak (Isolde) | Brannoc L3 | 4 + 4, every 106 s | 2.78 / 1.21 | Cantor | 194 |
| 19 | The Briar Gate | bark den, charcoal clearing, thicket, stag glade, lantern shrine, spring, standing stones, hollow oak | The Mire Heart (Vesper) | Kaia L3 | 4 + 4, every 104 s | 2.89 / 1.22 | Fenna | 193 |
| 20 | The Crown of the Wood | hounds' den, charcoal clearing, dark thicket, giants' glade, lantern shrine, mossy spring, old stones, old oak | **Ash and Ember** (crown, alone, tier 1) | Tempo L3 | 4 + 4, every 102 s | 3 / 1.23 | Anka | 196 |

Each made floor: two named enemies (one round the hollow oak's glade, one round a lamp's glade), the main quest (clear the first pack, lead
its wisp to the heart, clear the Stag-Crowned's glade, lead the second wisp, cut the three feeding roots, open the door), three side quests
(light two spore lamps; carry a bundle from a glade to the camp fire; find the burners' stacks and hold their clearing against hounds), six
caches, six waystones (each clear of the packs and the named enemies' walks), a lore stone, the rival's duel, the trial, the lair and the gate. Floor 11 keeps its own people (Bo, Mortis, Nyx,
Silvane), quests, packs and ids; it gained three waystones and three caches for the larger ground, and its par grew from 840 to 1848 s.

## Checks (2026-11-14, on the floors as committed)

- `_worldCheck`, both states of the roots, all ten floors: nothing unreachable, at most 5 enemies near any point, every wall of roots cuts
  its pass (the way round is 56 to 420 m). Every waystone stands at least 14 m from every pack and feeding root and 15 m from every leg of a
  named enemy's walk (a fall wakes the hero at the last waystone touched).
- Route bot, game seconds (par), all **cleared**:

  | Floor | Par | Lyra | Bram | Roots held still |
  |---|---|---|---|---|
  | 11 | 1848 | 1045 | 1210 | Bram, state 0: 1380 |
  | 12 | 1892 | 2382 (two falls in the zone, a gate duel lost; again: 1610) | 1549 | Lyra, state 1: 1785 |
  | 13 | 1936 | 1258 | 1440 | Bram, state 0: 1500 |
  | 14 | 1980 | 1599 | 1604 | Lyra, state 1: 1690 |
  | 15 | 2024 | 1655 | 1424 | Bram, state 0: 1536 |
  | 16 | 2068 | 1740 | 1509 (Hank won 2 gate duels) | Lyra, state 1: 1395 |
  | 17 | 2112 | 1543 | 1744 | Bram, state 0: 1579 |
  | 18 | 2156 | 1815 | 1512 | Lyra, state 1: 2064 |
  | 19 | 2200 | 1443 | 2963 (lost the ruler 3 times) | Bram, state 0: 1651 |
  | 20 | 2244 | 1488 (three falls, began again once; again: 1732, none) | 1414 | Lyra, state 1: 1502 |

  Every run is within par and a half; all but three are under par. On an earlier bake Hank, floor 16's gatekeeper, beat Lyra 10 times in
  12 duels: the hardest gate of the chapter for a ranged hero.
- Ash and Ember alone at tier 1: won in every route run of floor 20 and by Lyra 2 of 2, Bram 1 of 2 in a direct test; a loss comes back as
  a loss (Bram at 5 % health, 3 s).
- Speed (`perf.py scenes`, one run, 1500 frames): median frame on desktop floor 1 8.9 ms, floor 11 7.5, floor 12 8.6, floor 20 8.8; on
  the phone slowed 4 times 27.3, 19.4, 25.4, 23.2 ms. The tails are worse than floor 1's on the phone: p99 72 against 50 ms, the longest
  frame 1.3 s against 0.6 s (the zone's build), twice the memory churn (32 against 18 MB a second, the navigator's searches round the
  bands). When the roots change, the navigator rebuilds in 4 to 6 ms, but the first long walk ordered after it costs 46 to 464 ms on the
  desktop while its links are worked out again.

How to make them again: `node pipeline/tools/gen-floors.ts 12-20` (the made floors) and `node pipeline/tools/gen-wood11.ts` (floor 11).
