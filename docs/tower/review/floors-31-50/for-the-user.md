# For you: what I did not change

Bigger things, things in files another agent is working in, and matters of taste. Each with where it shows and what I would do.

- **The trial rooms carry the old Tower's number** (floors 31 to 50, and likely the other chapters' too): the far wall says VIII on
  floors 31 to 35, IX on 36 to 40, X and XI in the War, the weekly Tower's height each trial was tuned at, while the title says "Trial of
  floor 31". The room is drawn by the set pieces' code (`src/tower/world/pieces/duels.ts` `startTrial` -> `weekly`, and
  `src/arenas/tower.ts` `roomFloor`, which writes `roman(n)`). What I would do: keep the height for the fight, and write the floor's own
  number on the wall (or none). Picture: floor 31's entry.
- **Who holds the gates**: the codex says Opaline holds the Deep's gate and Oblivion the War's. They do on floors 31 and 41; on the
  generated floors other heroes hold it (32 Pip, 33 Mortis, 34 Cantor, 35 Hank, 36 Gus, 37 Vitriol, 38 Auriel, 39 Bo, 40 Anka; 42 Sirix,
  43 Nyx, 44 Gus, 45 Hank, 46 Shiori, 47 Anka, 48 Tempo, 49 Mum, 50 Mabel). Either the codex says "the first floor's gate", or the gates
  follow the codex. Your call.
- **The rival can be the hero you play**: a player who climbs as Lyra meets "I am Lyra" on floor 32 and duels a Lyra. The same on any
  floor whose rival is the player's hero. What I would do: when the rival is the player's own hero, the floor takes the next hero on a
  fixed list (the floor's packs and doors stay as they are).
