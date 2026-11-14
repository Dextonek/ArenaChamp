# The Tower's floors as worlds (the Climb)

A second way to climb beside the weekly Tower: each floor is a whole place to walk through, not one room. What it is and why:
[tower-worlds.md](../../pipeline/designs/tower-worlds.md) (the design the user agreed). How it was built, stage by stage, with the
numbers: [tower-worlds-build.md](../../pipeline/designs/tower-worlds-build.md) (the plan, the spike, floor 1),
[tower-worlds-pieces.md](../../pipeline/designs/tower-worlds-pieces.md) (the rulers, trials, rivals and gates),
[tower-worlds-floors23.md](../../pipeline/designs/tower-worlds-floors23.md), [tower-worlds-floors45.md](../../pipeline/designs/tower-worlds-floors45.md)
and [tower-worlds-join.md](../../pipeline/designs/tower-worlds-join.md) (the five floors joined and climbed).
This file says how it works now. Pictures and a clip: `docs/tower/worlds/` (`f1-` to `f5-` a floor each, `p1-` and `g1-`, `g2-` the pieces
and the game page, `j-` the joined climb).

**The weekly Tower is untouched.** The Climb imports the Tower's engine (`src/tower/`: boons, hooks, link, floors) and changes none of it.
The one engine-side file it edits is `src/game/main.ts` (a tab bar on the Tower screen, one controller, three lines of wiring). Where the
engine lacks something, the Climb does it from its own side and marks it `TOWER-HOOK` with a row in the build plan.

## The parts

| What | File (`src/tower/world/`) | Role |
|---|---|---|
| The run | `state.ts` | `WorldRun`: everything a floor is, in plain data. The zone is built from it at any moment |
| A floor | `def.ts`, `floors/` | `FloorDef`: data only. `FLOORS[n]` in `floors/index.ts` is the registry |
| The zone | `world.ts`, `zone.ts` | `buildZone`: one walking fight on the duel's boss path for the whole floor; the only way a zone begins |
| Packs | `packs.ts` | Enemies that sleep until the hero is near; at most six awake at once (the summon system's cap) |
| Laws | `law.ts`, `f45/laws.ts` | The place's rule: `tide`, `storm`, `paths` (`law.ts`), `dark`, `sides` (`f45/laws.ts`, asked first) |
| Zones | `zone.ts` (with `land.ts`: floor 1's world past the rim), `zoneWood.ts`, `sandsZone.ts` (the Sands, floors 21 to 30; floor 21 baked by `pipeline/tools/gen-canyon.ts`), `zoneGen.ts`, `f45/deep-zone.ts`, `f45/banners-zone.ts`, `f45/zonekit.ts` | Each floor's ground, props and cover, drawn in code |
| Enemy looks | `looks.ts`, `looksWild.ts`, `f45/looks.ts` | Looks of the summon system's units, by the spec's `look` string |
| Quests | `quests.ts`, `f45/carry.ts` | Eight verbs; what a carried thing looks like |
| People, scenery | `people.ts`, `scenery.ts` | Keeper, giver, trader, rival; waystones, caches, the lore stone, the doors |
| The screen | `hud.ts` | The floor panel, quest list, banners, cards, the result card |
| The run's owner | `game.ts` | `WorldGame`: the run, the zone, the doors to the pieces, falls, boons, the floor's end |
| The doors | `doors.ts`, `pieces/` | The ruler's fight, the trial, the rival's duel, the gatekeeper's duel |
| The menu | `menu.ts` | The Climb tab and `WorldClimb`, the controller the game page runs |

## The run and its saves

`WorldRun` holds: the floor and hero, three lives, shards, the boons (`TowerBoons`), what the hero arrived with (a floor that begins
again starts from it), health as a share, each quest's step, the packs cleared, caches found, lore read, waystones touched (and the
last), the rival's result and ally, the floor's clock, the pieces won, doors opened, lights lit, the carried thing, trials lost, falls,
and the result. `toJSON` / `from` round-trip it. No three.js object is in it, so a zone can be rebuilt after a set piece, after a
reload and after the last life.

Saved in the browser under keys that all begin `tower.world.`; never `tower.save` or `tower.best` (the weekly Tower's), and nothing goes to
the board:

| Key | Holds |
|---|---|
| `tower.world.run` | The floor in progress (saved as it goes; wiped when the floor is cleared and its card is left). A reload continues it |
| `tower.world.floor` | The next floor a climb may begin on |
| `tower.world.sigils` | The boons kept as sigils: every later climb begins with them |
| `tower.world.stars` | Per floor, the best of each of the four stars |
| `tower.world.times` | Per floor, the best time (s) |
| `tower.world.version` | The saves' numbering: 2 since the Climb has 50 floors. A browser without it had the five-floor Climb: its saves are moved once (below) |

**The renumbering (2026-11-14).** The Climb had five floors, 1 to 5; it has 50 in five chapters of ten, and the handmade floors 2 to 5
are 11, 21, 31 and 41. `migrateSaves` (`state.ts`) runs before the first read or write of a `tower.world.` key, once (the version key):
the stars and best times of old floors 2 to 5 go to 11, 21, 31, 41; a floor in progress there continues on the new number; the floor
a climb may begin on moves likewise (old 3 is 21, and every floor below it that exists is open); who had cleared all five (the floor
reached was 6) may begin 42, as clearing 41 now writes. Tested in a real browser with the five-floor saves and two reloads:
`pipeline/tools/climb-saves/` (its README).

A fall in the zone takes a life and stands the hero up at the last waystone (else the camp) with half its health. With none left the
floor begins again from its camp with what the hero arrived with.

## Floors as data, and adding one

A floor is a `FloorDef` (see `def.ts`): its arena and cover, start and camp, places, law, enemy kinds, packs, people, quests, caches,
waystones, the lore stone, doors, the rival, the par time and the trader's wares.

The Climb is 50 floors in five chapters of ten (pipeline/designs/tower-50.md): The Sea 1 to 10, The Wood 11 to 20, The Sands 21 to
30, The Deep 31 to 40, The War 41 to 50. A chapter's first floor is handmade (below), floors 2 to 9 of it are made by a generator and
baked (`floors/gen/`, `GEN_FLOORS`), the tenth is a crown (a Raid boss, alone). Made so far: the sea's 2 to 10. `FLOORS`
(`floors/index.ts`) lists the floors that exist; `floorAbove(n)` is the next one that does (after 10 comes 11, after 11 comes 21 until
12 is made), and a floor that is not made is shown as coming and cannot be begun.

| Floor (was) | File | Law | Main quest's verbs | Rival | Ruler, gatekeeper |
|---|---|---|---|---|---|
| 1 The Drowned Harbour | `floors/harbour.ts` | `tide` | `fell`, `light`, `carry` (the key), `open` | Zephyr, a race | The Drowned Captain, Marin |
| 11 (2) The Walking Wood | `floors/wood.ts` | `paths` | `lead` x3 (wisps), `fell` (three roots), `open` | Nyx, a duel | The Elder Root, Fenna |
| 21 (3) The Storm Canyon | `floors/canyon.ts` | `storm` | `carry` x3 (water), `lead` (the caravan), `fell`, `open` | Vesper, a duel | The Scarab Colossus, Sefu |
| 31 (4) The Lightless Deep | `floors/deep.ts` | `dark` | `carry` and `light` x3 (great shards, crystals), `open` | Tempo, a race | The Prism Mother, Opaline |
| 41 (5) The Field of Banners | `floors/banners.ts` | `sides` | `reach` x3 (standards), `hold` (the hill), `fell`, `open` | Brannoc, a duel | The Last Marshal, Oblivion |

The four that moved keep the number they were tuned at as `tunedAs` (on the `FloorDef` and on its `PiecesDef`): their roaming
enemies' numbers (`floorNumbers`), the ruler's, trial's and rival's seeds (`world-ruler-2`...) and the rivals' heights (4, 6, 10)
follow it, so their fights are the ones they were (the perf tool's `world-1` to `world-5` print the same before and after).

To add a floor:

1. Write `floors/<name>.ts` as a `FloorDef` (copy the harbour's shape) and add it to `FLOORS` in `floors/index.ts` at its number (a made
   floor: bake it with `pipeline/tools/gen-floors.ts`; `gen/list.ts` puts it in `GEN_FLOORS`, and `FLOORS` takes it from there). The
   menu's tile, the "Climb to floor N" button and the stars and times follow from the registry.
2. The set pieces for floor N are data in `pieces/floors.ts` (`PIECES`, found by `piecesOf(n)` by their `floor`; a made floor's are
   baked with it): the ruler, the gate's gatekeeper and arena, the trial's kind, the rival's duel (floors 11, 21 and 41; floors 1 and
   31 have a race the zone runs).
3. Run `_worldRoute({ floor: N, hero })` (below) and look at the checkpoints that are `stuck`.

No code of the loop names a floor.

## The quest verbs

A step is one verb with its place and number, done when its condition holds. The hero's walk does it, so a phone needs no new button.

| Verb | What it asks |
|---|---|
| `reach` | Walk to a place |
| `fell` | Fell a pack, or N of a kind |
| `fell-named` | Fell a named enemy (it may patrol the quay) |
| `light` | Stand in each of N things for 2 s |
| `hold` | Stay in a ring for T s while waves come |
| `carry` | Take a thing from A to B; a hit that lands drops it, and it can be picked up again. Drawn by its `item` (`f45/carry.ts`: a great shard, a cloth), else by the step's `look` (`jar`, `bundle`), else as the key; `plain` draws no winch at B |
| `open` | A door's wall goes when the step is done |
| `lead` | Walk an escort along waypoints; it fails if it dies. `look`: a person, a wisp, a cart |

## The laws

Each floor plays one. The numbers and what was measured are in the floors' notes.

| Law | Floor | What it does |
|---|---|---|
| `tide` | 1 | The low ground floods on a clock: 2 % of max health a second and a 0.6 walk; warned 7 s before |
| `paths` | 11 | Every 120 s three of six root barriers sink and three rise, warned 8 s before. Whoever stands where one rises is set down beside it; in both states every spot of the floor's data is reachable (`_worldCheck`) |
| `storm` | 21 to 30 | Every 124 to 147 s (each floor's own) a band of sand crosses north to south at walking speed, its time worked out from the zone's size (gen/sands.ts), warned 8 s before: a few steps of sight and 4 % of max health a second, unless a piece of cover stands within 7 m to the north (the lee). Dust wraiths come only out of the band |
| `dark` | 31 | A page layer (a quarter-size canvas under the HUD) dark all over, with holes at the hero (8 m; 10.8 m carrying a shard), the camp's lamps, touched waystones and woken crystals (a hall, for good). Lurkers wake from 15 m when the hero stands outside every light |
| `sides` | 41 | A card at the start: take a banner. That army's packs are gone and four of its soldiers walk with the hero (hero-side units, replaced 18 s after one falls); the other army's packs hunt. The choice is in the run |

`lawOf` (a WeakMap by zone) lets other parts ask the law (the caravan waits out a storm in a lee).

## Packs and the cap of six

The summon system holds at most six units a side. A pack is born when the hero is near and sleeps again when it is cleared or left; a
pack of one with an elite counts as one. The floors are written so that no more than six are ever awake together (a wave of a `hold`
is one pack of its own, born at the ring's edge). A cleared pack stays cleared in the run.

## The doors and the set pieces

The hero walks into a door that is ready (a wall opened, a piece not yet won, the gate unsealed once the ruler has fallen). The zone
notes it inside the duel's frame and `WorldGame.tick` starts the piece outside it: the zone is torn down, `startPiece` (`pieces/index.ts`)
plays the fight, `done` hands back `{ won, hp, seconds }` and the zone is rebuilt from the run.

| Door | Piece | Entered with | A win | A loss |
|---|---|---|---|---|
| The lair | The ruler's fight (a boss on the boss path) | health, boons, and the ally if the race was won | 40 shards, the gate is unsealed | A life; the hero wakes at the last waystone with half its health; try again |
| The trial | One room of the weekly Tower by kind | health, boons | 20 shards and a relic | Nothing; the door stays open for one more try, then closes |
| The gate up | The gatekeeper's duel (a CPU duel, the hero's real spells) | health; the boons are set aside | The floor ends | A life, as the ruler |

`startPiece` returns a handle (`pump`, `cancel`, `over`, `report`). `WorldGame` keeps it: in the route bot's run `tick` pumps it between
two steps; leaving cancels it. In a person's play the outcome comes 2 s after the end, and the duel's own result card (a CPU duel puts up
a Rematch and a Leave button that a piece cannot suppress) is hidden the frame after it shows, so the player sees only the piece's own
words ("Won", "Beaten") and never a rematch (`pieces/core.ts`, marked `TOWER-HOOK`).

## The floor's end

Gate won: the clock stops, the packs sleep, and the result card opens over the zone: four stars (cleared; every quest done; no life lost;
under the par), the time, shards and falls, one boon to keep as a sigil (the first is picked; a tap changes it, "None" keeps nothing), and
two buttons: **Climb to floor N** (the next floor that exists, `floorAbove`; after 11 that is 21 until 12 is made; past the last one the
line "The way up is still being built" and no button) and **Back to the Tower**. The floor a later climb may begin on is set to the
same next floor.

## The menu

The Tower screen has two big tabs, as the Play screen has. **Climb** is `menu.ts`'s `climbPanel`: the picked floor's chapter, name, law,
stars, best time and blurb; then the five chapters, each ten small number tiles (ten to a row, five on a phone, as the Trials tab's
floors): open when reached (stars under the number once cleared, "new" before), a padlock until reached, dashed and "soon" while not
made, a small crown on every tenth. Every floor that exists at or below the floor reached is open. Then the sigils kept, the hero
picker, and the bar: Start floor N, or Continue floor N (with the saved hero) and Begin floor N again. Pictures:
`docs/tower/climb50/` (`climb-fresh-*`, `climb-migrated-*`). **Trials** is the weekly Tower exactly as it was, headed "Trials". The tab is kept in
`tower.tab`. Works without an account, at desktop and at 375 px. `WorldClimb` runs a climb on the game page (`game.world`): the page's own
loop steps it, a Leave button saves the floor and goes back to the Tower screen.

## The tools

All in `pipeline/tools/world-tool.js`, pasted into the tool page or the game page (`eval(await (await fetch('/pipeline/tools/world-tool.js')).text())`):

| Call | What |
|---|---|
| `_world({ floor, hero, person })` | Starts a floor (any that exists: 1 to 10, 11, 21, 31, 41); manual (you step time) or `person: true` (the page's own loop) |
| `_worldGen(n)` | Says what floor `n` is (its id, name, ruler, gatekeeper). It used to put a made floor in the list by hand; they are in it now |
| `_worldRoute({ floor, hero })` | The bot plays a floor camp to result card through the real pieces; returns time, falls, stars, checkpoints |
| `_worldSix(heroes, reps)` | The route for several heroes in the background; `_worldSix.result()` |
| `_worldVerbs()` | Every verb and every law once in a scratch zone |
| `_worldCheck({ floor, map })` | No game: a flood fill of the zone from the camp for each state of the paths; lists every spot of the floor's data that cannot be reached, and the most units one point has near it (the cap is six) |
| `_worldBench(label, frames)`, `_worldBench.duel()` | CPU time of `vfx.step` plus `vfx.render`, draw calls, triangles |
| `_world.end()` | Stops the floor; on the game page brings the menu back |

`pipeline/tools/world-shots.py` is a headless browser that saves pictures of the whole page (HUD and the dark layer included; `--profile`
keeps the save between two runs for a reload test); `world-film.js` films a clip from the canvas (the dark layer is not in it).

On the game page the tool uses `game.api` and hides the menu while it runs. The bot sprints (x3) during the race (the autopilot's own walk
takes two to three times a person's): `noSprint: true` turns that off.

## Limits

Below, written before the renumbering, the handmade floors keep their old numbers: floor 2 is now 11, 3 is 21, 4 is 31, 5 is 41.

- **No person has played any of it.** Every number comes from the route bot (the game's autopilot with a route) and from `_pieceRun`.
  The autopilot plays some kits badly (Vesper does not clear floor 5, and floor 4 only after restarts).
- **Fairness is rough.** Win rates over 8 to 12 fights: floor 2's gate (Fenna, CPU level 4) 2 of 8 alone but 3 of 4 first tries inside
  route runs, and 12 of 12 at level 3, so there is no middle step; floor 5's gate and ruler 4 of 8 each. Floor 3 takes the bot 16 to
  18 minutes against a par of 15.
- **Floor 1 is a place in the world (2026-11-13, waiting on the user's look):** `land.ts` draws one ground 420 m across: flat
  inside the rim (walks, cover and routes as before), then a bank, hills and a cliff along the north; a beach running into the
  drawn sea on the east, with jetties and boats; the town's houses and a dry-stone wall to the west; woods; daylight (`STAGE`
  in `zone.ts`). The ground's colour is a painted map in the middle (grass, dirt roads on `PATHS`, the market's cobbles, the tide's
  low ground as tidal flats, `TIDE_LOW`) and vertex colours beyond, mixed by the vertex's alpha (a small `onBeforeCompile`). The
  dressing past the rim carries its colours in its vertices (`Dress`: one mesh per 24 m square) and the trees are instanced, so
  it costs few draws. Floors 2 to 5 still have their first-pass looks.
- **Looks are first pass:** zones, props and enemies are drawn in code from plain forms; the five rulers are a hero's model drawn big
  and tinted. A lurker's leap, a golem's bolt and a knight's charge are speed and pose, not mechanics of their own.
- **Alone, in the browser.** No friends on a floor, nothing on the account or the board.
- **Not measured on a phone.** On the build machine a zone costs 10 to 14 ms a frame (a duel 7.7 ms). The 375 px pictures are a
  narrow window with touch, not a phone.
- A reload inside a set piece continues in the zone at the last waystone with the run as it was when the door was entered.
- `_worldVerbs`'s `dark` and `sides` cases still play the scratch laws in `law.ts`, not floors 4 and 5's (`f45/laws.ts`).
- The dark is a page layer: a clip filmed from the 3D canvas alone does not show it.
- The HUD names a carried thing by its short id ("water", "spade", "shard").
