# The Climb's chapter 2: the Wood (floors 11 to 20)

Pictures of the Wood at the new size (pipeline/designs/tower-50.md, "The new scope": five times the ground, any outline, the handmade
floors grow too). Not live; on the branch only.

- `fNN-game.jpg`: floor NN in the game's own camera, the hero walking up to the first pack's glade.
- `fNN-low.jpg`: floor NN from the camp's edge, a low view north to the horizon (the heart's glade, the Elder tree in the haze).
- `maps.jpg`: all ten from above (north up, the camp at the bottom, the lair's wall of roots and the Elder tree at the top).

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
| 11 | The Walking Wood (handmade, grown) | hounds' den, bramble, old stones, giants' glade, thicket, the west and east lamp glades | The Elder Root (Hank) | Fenna L4 | 3 + 3, every 120 s | 2 / 1.12 | Nyx | 165 |
| 12 | The Mossway | thorn brake, charcoal clearing, thicket, giants' glade, wayside shrine, mossy spring, old stones, hollow oak | The Moss Warden (Hank) | Nyx L3 | 3 + 3, every 118 s | 2.11 / 1.13 | Vesper | 172 |
| 13 | Hollowmere | bramble, charcoal clearing, bark den, stag glade, wayside shrine, mossy spring, standing stones, hollow oak | The Thorn Mother (Brannoc) | Mortis L3 | 3 + 3, every 116 s | 2.22 / 1.15 | Mabel | 174 |
| 14 | The Thornfold | thorn brake, charcoal clearing, thicket, giants' glade, wayside shrine, spring, old stones, hollow oak | The Antler King (Mortis) | Isolde L3 | 3 + 3, every 114 s | 2.33 / 1.16 | Sirix | 176 |
| 15 | The Antler Glades | hounds' den, burners' clearing, dark thicket, standing stones, mossy spring, wayside shrine, stag glade, old oak | The Hollow Elder (Mortis) | Silvane L3 | 3 + 3, every 112 s | 2.44 / 1.17 | Sefu | 174 |
| 16 | Lanternroot | bramble, charcoal clearing, hounds' den, stag glade, mossy spring, wayside shrine, standing stones, old oak | The Briar Witch (Bram) | Hank L3 | 4 + 4, every 110 s | 2.56 / 1.18 | Pip | 178 |
| 17 | The Whispering Stand | bark den, charcoal clearing, dark thicket, standing stones, wayside shrine, mossy spring, giants' glade, old oak | The Lantern Root (Oblivion) | Bram L3 | 4 + 4, every 108 s | 2.67 / 1.2 | Lyra | 178 |
| 18 | Greyoak Deep | bark den, burners' clearing, dark thicket, giants' glade, spring, lantern shrine, old stones, old oak | The Grey Oak (Isolde) | Brannoc L3 | 4 + 4, every 106 s | 2.78 / 1.21 | Cantor | 182 |
| 19 | The Briar Gate | bark den, charcoal clearing, thicket, stag glade, lantern shrine, spring, standing stones, hollow oak | The Mire Heart (Isolde) | Kaia L3 | 4 + 4, every 104 s | 2.89 / 1.22 | Fenna | 181 |
| 20 | The Crown of the Wood | hounds' den, charcoal clearing, dark thicket, giants' glade, lantern shrine, mossy spring, old stones, old oak | **Ash and Ember** (crown, alone, tier 1) | Tempo L3 | 4 + 4, every 102 s | 3 / 1.23 | Anka | 184 |

Each made floor: two named enemies (one round the hollow oak's glade, one round a lamp's glade), the main quest (clear the first pack, lead
its wisp to the heart, clear the Stag-Crowned's glade, lead the second wisp, cut the three feeding roots, open the door), three side quests
(light two spore lamps; carry a bundle from a glade to the camp fire; find the burners' stacks and hold their clearing against hounds), six
caches, six waystones, a lore stone, the rival's duel, the trial, the lair and the gate. Floor 11 keeps its own people (Bo, Mortis, Nyx,
Silvane), quests, packs and ids; it gained three waystones and three caches for the larger ground, and its par grew from 840 to 1848 s.

## Checks (2026-11-14)

- `_worldCheck`, both states of the roots, all ten floors: nothing unreachable, at most 5 enemies near any point, every wall of roots cuts
  its pass (the way round is 56 to 420 m).
- Route bot, one run each, Lyra and Bram, all ten floors: **20 of 20 cleared, every one under par** (1254 to 1910 game seconds against
  pars of 1848 to 2244). Lyra began floor 15 again once (three falls in the main quest's fights) and lost floor 16's gate duel (Hank) three
  times before winning it; Bram never fell.
- Again with the roots held still for the whole floor (`_worldRoute`'s `pin`: Lyra in state 0, Bram in state 1): **20 of 20 cleared**, all
  within par and a half (floor 14 Lyra 2211 s against 1980, floor 18 Bram 2475 s against 2156 after losing the ruler once; the rest under
  par). Hank, floor 16's gatekeeper, beat Lyra 7 times before she won: the hardest duel of the chapter for a ranged hero.
- Ash and Ember alone at tier 1: won by Lyra 2 of 2 and Bram 1 of 2 in a direct test; won in both route runs of floor 20; a loss comes back
  as a loss (3 s at 5 % health).
- Speed (`perf.py scenes`, `world-1` against `gen-12`, the same run): desktop median 10.6 against 11.0 ms; phone, slowed 4 times, 42.5
  against 41.5 ms (the run-to-run noise on this busy computer is larger than that), the same simulation step (11.1 ms).

How to make them again: `node pipeline/tools/gen-floors.ts 12-20` (the made floors) and `node pipeline/tools/gen-wood11.ts` (floor 11).
