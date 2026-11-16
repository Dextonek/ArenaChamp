# The Climb, floors 31 to 50: one floor at a time

2026-11-16. The user: "make agents that will go slowly through all tower floors and one by one check all things that are done and correct
them". This page is the second of the two agents: chapters IV (the Deep) and V (the War). Floors 1 to 30 are on their own page.

**How each floor was checked** (a dev server of its own, the game page in a hidden browser, time stepped by hand):
- **Played through** by the route bot (`_worldRoute`, pipeline/tools/world-tool.js) as Lyra: every quest taken, done and handed in, the race,
  every waystone, cache and the lore stone, the trial, the ruler and the gate; any error in the page is counted.
- **Walked on paper**: a flood fill of the floor from the camp (`_worldCheck`): every person, pack, quest spot, cache, door and stone must be
  reachable; and the busiest spot (most enemies within a pack's sight).
- **Props against the ground as drawn** (`climb-props-probe.js`): things in the air, light under one side, through cover, on walkable
  ground and the edge; and anything small standing on a cliff face (`climb-grass-probe.js`).
- **Looked at**: the camp, every person up close and their card, every pack standing and fighting, the doors and the lore stone, the big
  map (M), the ruler, the gatekeeper and the trial; the camp, the map and a card on a phone (390 x 844, touch).
- **Read**: every name and line of the floor against the lore (docs/lore/LORE.md and docs/lore/codex/, the Climb's chapters and The Long Noon).
- **Frames**: a rough frame time at the camp and in the busiest fight (the machine is shared with other agents: only clear outliers count).

## The round in short

**20 floors checked, 31 to 50.** Every floor cleared by the route bot with no errors in the page; every spot of every floor
reachable; every person, pack, named enemy, ruler, gatekeeper and trial seen in the game with its own model; every name and line read
against the codex.

**Fixed (7 faults, at their cause, so every floor that shared them is set right):**
- The big map's names covered each other by the camps and ran off the map's edge (all floors; `map.ts`). Floor 31.
- People's "!" marks and names were drawn over the minimap (all floors; `map.ts`). Floor 32.
- Floor 31's Candle-Crowned still said Isolde's "cold woman" line under her crown of candles (`folk.ts`). Floor 31.
- A jetty ran through a stone ridge on its way to the water (floor 32; `deepDepth.ts`). Floor 32.
- The small crystal of each glowing cluster on the cave walls hung beside the wall, up to 2 m (all ten Deep floors; `deepZone.ts`).
  Floor 35.
- Brannoc, who hosts floor 41's duel, was marked as a quest giver with nothing to give ("…" over him, "Quests" on his card). Floor 41.
- "Ash and Ember waits / is / has fallen / wakes" on the last floor: they are two. Floor 50.

**For you** (below): things in other agents' files this round, bigger changes, and matters of taste, each with where it shows and the
exact change I would make.

**Not changed:** hero numbers, kits, layouts, packs, the look's direction. The bot lost the gate to Oblivion (41) eight times in one run and
none in the next, and to Mum (49) eight times before winning: balance, noted only.

**Shared files touched** (each change tiny and checked on the other chapters): `src/tower/world/map.ts` (the map's names: checked on
floors 1, 11, 21, 41, desktop and phone; the minimap's layer), `src/tower/world/folk.ts` (floor 31's own line, as floors 11, 21, 41 have).

## Checked across the floors

**The War's two armies, floors 42 to 50.** Until a banner is taken both armies stay off the field (by design; the route bot never takes
one, so its runs fought only the ashen soldiers and the named). Taken by hand on each floor, Crimson and Azure in turn: four of the
hero's colour march beside it and the other colour's pack wakes and fights, footmen, bowmen and knights, on all nine floors.

![Floors 42 to 50, a banner taken: the other army fights](pics/war-armies-42-50.jpg)

**The fights on a phone** (floors 31, 40, 41, 50): the ruler, the gate duel and a trader's card. They play and read; the set piece's
title box sits over the hero's portrait and F key (it lets taps through: only hidden, not blocked; in the list).

![Phone: 31's ruler and gate, 40's crown and gate, 41's ruler and gate, 50's crown, 50's trader](pics/phone-fights.jpg)

**The War's rulers up close** (41, 43, 46): each on its own model (the Last Marshal, the Siege Lord, the Crow King).

![The Last Marshal, the Siege Lord, the Crow King](pics/war-rulers-close.jpg)

**The two fixes I could not make, tried live in the page** (no file changed): the people's marks on layer 5 go under the floor's panel
and the spell bar and can still be tapped (the keeper's card opens); the title box moved down clears the hero's portrait on a phone
(172 px) and the hero's panel on a desktop (160 px).

![Phone, now: the keeper's mark over the floor's panel](pics/try-marks-now.jpg)
![Marks on layer 5: under the panel](pics/try-marks-at5.jpg)
![Phone, now: the title box over the portrait and F](pics/try-title-now.jpg)
![Title box lower](pics/try-title-lower.jpg)
![Desktop, title box lower](pics/try-title-lower-desktop.jpg)

**Not seen as a fault:** on a fresh page the hero is not drawn for its first seconds on a floor (only its health bar) while its model
loads; it then stands posed. The T-poses in some tool pictures come from the tools stepping time by hand.

## Not checked in this round
- Packs shared between two players and their respawn (needs two signed-in players; stage 2 was tested in its own round).
- The perf tool's fixed prints and phone timings on a quiet machine (floors 21 and 41 are in STATUS); the frame times here are rough.
- Every hero: the route bot played Lyra only (balance per hero is the simulator's).
- Sound.

## Housekeeping
- My first tool runs made two empty folders, `C:\x` and `C:\x2` (a mistyped picture folder). Removing them was refused by the shell's
  safety check; they are empty and safe to delete by hand. A misplaced picture folder under `C:\Users\erich\.t3\AppData` (my own
  pictures only) was moved to the scratch folder and removed.
