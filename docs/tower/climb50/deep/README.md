# The Climb, chapter 4: The Deep (floors 31 to 40)

Pictures of the Deep's ten floors at the new size (five times the old ground, an outline of its own), taken 2026-11-14 on the
branch `t3/climb-deep-chapter-floors-32-40`. Not merged, not live.

## What it is

The Deep is underground, so the "real world" past the walkable ground is a cave: the outline is the foot of the cave's wall, and
rock rises there, tall in the north and low in the south (where the camera stands; past a timber rail the ground drops into the
dark). On one side the black water of an underground lake runs in, with the cave's far wall beyond it (east on the odd floors, west
on the even ones; floor 31 east). Inside, ridges of rock split the ground into chambers, and the mine's tracks run between them.
Stalagmites crowd the wall's foot, crystals glow on the walls, timber frames stand at the mouths of tunnels leading off, lamps on
posts are the warm light. The law is floor 31's: the dark (only crystals, lamps and touched waystones give light; lurkers hunt in
it). The dark grows gently: the hero's own light goes from 8 to 7 m over the chapter, a woken hall's from 18 to 16 m.

Each made floor: a camp in the south, a rock fall in the north with the ruler's door, three halls with a dark great crystal each
(carry a great shard to it and stay by it), a miners' rest, a cart yard, a landing on the black water, glow pools with the
Lantern Thief, an old shaft; two named enemies, three side quests, six caches, six waystones, a rival's duel, a trial, the gate.
Floor 40 is the crown: behind the rock fall is the Sun Warden, the Raid boss, alone at tier 2.

Floor 31, the Lightless Deep, is grown the same way: the same people (Mabel, Isolde, Tempo, Mr. Ledger), quests (the three
crystals, the Pale One, the lost lantern, the survey lamp), Tempo's race to the echo well, ruler (the Prism Mother), gatekeeper
(Opaline) and the dark, laid out again on a cave of the new size; six caches and six waystones now, not three.

## The pictures

Four a floor, `f31-` to `f40-`:

| File | What |
|---|---|
| `fNN-game-dark.jpg` | The game's own camera at the first hall's mouth, **with the dark** (what a player sees) |
| `fNN-game.jpg` | The same, **without the dark layer**, so the ground and the hall can be judged |
| `fNN-horizon.jpg` | A low view across the cave toward its north wall and the rock fall (no dark, no HUD) |
| `fNN-water.jpg` | A higher view toward the black water and the far wall |
| `fNN-map.jpg` | From high above: the outline, the tracks, the halls, the water and the drop (no fog) |

## The floors

| Floor | Name | Ruler (body) | Gate | Rival | Named |
|---|---|---|---|---|---|
| 31 | The Lightless Deep | The Prism Mother | Opaline | Tempo (race) | The Pale One |
| 32 | The Amethyst Seam | The Hollow Queen (Auriel) | Pip | Lyra | The Hollow Foreman, Old Pick |
| 33 | The Echo Galleries | The Lamp Warden (Silvane) | Mortis | Bram | The Glass Widow, Mother Seam |
| 34 | The Black Water | The Glass Abbot (Sirix) | Cantor | Marin | The Lampless, Grey Tallow |
| 35 | The Lamp Road | Mother of Echoes (Mortis) | Hank | Nyx | The Stone Choir, Cinder Jack |
| 36 | The Hollow Choir | The Seam King (Opaline) | Gus | Wick | The Long Dark, Quartz Annie |
| 37 | The Glass Roots | The Blind Cantor (Cantor) | Vitriol | Kaia | The Last Shift, Brother Flint |
| 38 | The Sunless Market | The Gem Tyrant (Isolde) | Auriel | Sefu | The Ore Bride, Slate-Eyes |
| 39 | The Prism Stair | The Drowned Lantern (Vitriol) | Bo | Silvane | The Night Shift, Widow Cobble |
| 40 | The Crown of the Deep | The Sun Warden (Raid boss, tier 2) | Anka | Ada | The Deep Bell, Captain Candle |

Gatekeepers are all level 3 and none is a handmade floor's or the sea chapter's. Fights grow by the game's own rule, the floor's
tuned number (`tunedAs`) running from 4 (floor 31) to 5 (floor 40, as the War's floor 41); the set pieces' `hard` from 1.4 to 1.54.

## The checks (route bot, one run each, hero Lyra (ranged) and Bram (melee))

All 20 cleared, all inside par x 1.5; two over the par itself (floor 32 and floor 36, both Lyra). Game seconds / falls:

| Floor | Par | Lyra | Bram |
|---|---|---|---|
| 31 | 1980 | 991 s, 0 | 977 s, 0 |
| 32 | 2024 | 2137 s, 1 | 1349 s, 1 |
| 33 | 2068 | 1703 s, 0 | 1194 s, 0 |
| 34 | 2112 | 1649 s, 0 | 1221 s, 0 |
| 35 | 2156 | 1445 s, 0 | 1398 s, 0 |
| 36 | 2200 | 3 falls, the floor begun again, then cleared in 1313 s: about 2990 s in all | 1354 s, 0 |
| 37 | 2244 | 1497 s, 0 | 1349 s, 0 |
| 38 | 2288 | 1104 s, 0 | 1265 s, 0 |
| 39 | 2332 | 1418 s, 0 | 1336 s, 0 |
| 40 | 2376 | 1281 s, 0 | 1419 s, 0 |

`_worldCheck` on all ten: nothing unreachable, at most 4 to 6 units near any spot, about 33,000 m2 of walkable ground each (floor 1:
6,349). The Sun Warden at tier 2, alone (floor 10's crown patched to tier 2, 8 fights each at full health): Lyra won 6 of 8, Bram 2
of 8 (as at tier 1: 2 of 8); a loss comes back as a loss, never a hang. Inside the route runs on floor 40 both beat it at the first try. (The runs on 37 to 40 were before the named enemies got their last names: a change of words only.)

Speed (`perf.py scenes`, desktop / phone-4x, median frame): floor 1 8.8 / 27.8 ms; floor 35 8.6 / 22.2 ms; floor 31 7.9 / 19.1 ms.

## What the route bot taught (and the generator now does)

- A row of posts is not a wall: a hall's back of stalagmites with 0.9 m gaps let the bot wedge itself in one (a walker is 0.5 m
  round), and touching ones held it pressed against them. Each hall's back is one wall in four joined lengths, and the generator
  refuses any gap between two pieces of cover narrower than a walker unless they overlap.
- A goal inside cover ends at its edge on the walker's side: coming at a hall from behind, the bot stopped outside its wall trying to
  reach the crystal. The shard is carried to, and the crystal woken from, open ground in front of it.
- The bot picks up a cache within 14 m on its way: one behind a wall, near in a straight line and far on foot, had it turning
  between the cache and its quest for good. No ridge within 16 m of a cache, waystone or the lore stone, and a check that nothing
  within 16 m of them is a long way round.
- The door must stand in front of the rock fall (as floor 31's did): behind it, in a yard shut on every side, nothing could reach it.
  And the fall stands free: walled in at the sides it shut in the zone's unseen boss at the ring's far north, and an autopilot with no
  other goal planned a way there every frame and found none (13 ms a frame).
- A named enemy's home is where its patrol is now, and it gives up 24 m from it: on a loop 50 to 75 m round a melee hero never felled
  one. They walk small loops (8 to 10 m round their middle), slowly.
- The pools' elite keeps two mites: with a third, Lyra lost to it, healed at the camp and lost again.

## To make them again

`node pipeline/tools/gen-floors.ts 32-40` (the made floors), `node pipeline/tools/gen-deep-home.ts` (floor 31). The generator is
`src/tower/world/gen/deep.ts`, the drawing `src/tower/world/deepZone.ts`.
