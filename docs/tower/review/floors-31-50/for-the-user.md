# For you: what I did not change

Bigger things, things in files another agent is working in, and matters of taste. Each with where it shows and what I would do.

## Still yours

- **Who holds the gates**: the codex says Opaline holds the Deep's gate and Oblivion the War's. They do on floors 31 and 41; on the
  generated floors other heroes hold it (32 Pip, 33 Mortis, 34 Cantor, 35 Hank, 36 Gus, 37 Vitriol, 38 Auriel, 39 Bo, 40 Anka; 42 Sirix,
  43 Nyx, 44 Gus, 45 Hank, 46 Shiori, 47 Anka, 48 Tempo, 49 Mum, 50 Mabel). Either the codex says "the first floor's gate", or the gates
  follow the codex. Your call.
- **White-robed people read as white shapes in the War** (the White Sister, the Herald, the Camp-Mother): under the War's sun and bloom
  their robes go to pure white from the game's camera. Already so in the accepted line-up. A fix is a darker cloth in their models
  (Blender, one agent at a time) or a tint in code for the War's folk. Picture: floor 42.
- **After beating a ruler the hero is sent to the last waystone**, though the code's own comment says "back in front of the door when
  it was won" (`src/tower/world/game.ts`, `pieceDone`: `this.enter(d.piece === 'ruler' || d.piece === 'gate' ? undefined : ...)`, which
  sends a won ruler to `wake()`). If the comment is the intent: `(d.piece === 'ruler' || d.piece === 'gate') && !out.won ? undefined :
  this.inFront(d)`. Another agent's file this round; and maybe you like the walk back as it is.

## Done in the follow-up round (2026-11-16, the parent: "they are faults, not taste")

Each as described below; what was made and checked is in "The follow-up round" at the top of the page.

- **The trial rooms carry the old Tower's number** (floors 31 to 50, and likely the other chapters' too): the far wall says VIII on
  floors 31 to 35, IX on 36 to 40, X and XI in the War, the weekly Tower's height each trial was tuned at, while the title says "Trial of
  floor 31". The room is drawn by the set pieces' code (`src/tower/world/pieces/duels.ts` `startTrial` -> `weekly`, and
  `src/arenas/tower.ts` `roomFloor`, which writes `roman(n)`). What I would do: keep the height for the fight, and write the floor's own
  number on the wall (or none). Picture: floor 31's entry.
- **The rival can be the hero you play**: a player who climbs as Lyra meets "I am Lyra" on floor 32 and duels a Lyra. The same on any
  floor whose rival is the player's hero. What I would do: when the rival is the player's own hero, the floor takes the next hero on a
  fixed list (the floor's packs and doors stay as they are).
- **People's marks over the HUD** (all floors, most on a phone): the people's marks (the "!" and the name over each person) are on
  layer 7, over the floor's panel (6) and the spell bar (6), so a person who walks under them on screen is drawn on top (floor 34: over
  "The Black Water / In the light"; floor 36: over the W key). The exact fix, in `src/tower/world/hud.ts` (another agent's file this
  round): the marks' `z-index:7` (line 217) -> `z-index:5`, under every panel and still over the world and the law's flood. The
  minimap was raised over them on floor 32 (`map.ts`). Pictures: floors 34 and 36.
- **The ruler fights' title box covers the hero's panel** (every ruler and crown, all chapters): the set piece's box ("The Prism Mother /
  Defeat The Prism Mother") is at the top left, 64 px down, right over the hero's name and health. The exact fix, in
  `src/tower/world/pieces/hud.ts` (another agent's folder this round): the root's `top:64px` -> under the hero's panel (about `top:160px`
  on a desktop; on a phone below the minimap's column), or only for the ruler kind, which has no top bar of its own. Picture: floor 40.
- **The Iron Marshal's words** (floor 42): title "Two banners, one sword", last phase "Under no banner" (a random pick of three in the
  generator), while the codex makes him the crimson's marshal and "both banners" belongs to the Last Marshal (41). What I would do: a
  title like "The crimson's iron hand" (`src/tower/world/gen/war.ts` `RULERS`, and the same words in `floors/gen/war-42.ts`).
- **The War rulers' last phase names** are picked at random from "Alone on a horse of smoke" (the Last Marshal's end in the codex),
  "The last charge" and "Under no banner" (`src/tower/world/gen/war.ts`, line 527): the Siege Lord (43) and the Grey Captain (49) ride a
  horse of smoke, the crimson's Iron Marshal (42) and Black Herald (47) fight "under no banner". What I would do, in the baked floors
  (`floors/gen/war-4x.ts`, one line each) and the generator: 42 and 47 "The last charge"; 43 "The walls come down"; 49 "Under no
  banner" (he deserted); keep 44, 45, 46 and 48.
- **A lost trial says "Nothing lost"** while the hero comes out with the health it had left (floor 49: 26 of 520). Lives and the door are
  kept, health is not. Words: "No life lost: the door stays open for one more try".
- **The Camp-Mother on the generated War floors** (43, 45, 47, 49) says the generator's trader line, "Both armies buy from me, and both
  pay", which reads like the Quartermaster; on 41 she says "A cook feeds both armies, and both pay". If you want her own words on
  every floor: one line a floor in `src/tower/world/folk.ts` `LINES`.
