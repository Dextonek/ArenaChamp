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
