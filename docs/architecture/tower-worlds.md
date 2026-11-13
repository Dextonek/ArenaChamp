# The Tower's floors as worlds (the Climb)

A second way to climb beside the weekly Tower: each floor is a whole place to walk through, not one room. What it is and why:
[tower-worlds.md](../../pipeline/designs/tower-worlds.md) (the design the user agreed). How it was built, stage by stage, with the
numbers: [tower-worlds-build.md](../../pipeline/designs/tower-worlds-build.md) and [tower-worlds-pieces.md](../../pipeline/designs/tower-worlds-pieces.md).
This file says how it works now. Pictures: `docs/tower/worlds/`.

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
| Laws | `law.ts` | The place's rule: `tide`, `storm`, `dark`, `paths`, `sides` |
| Quests | `quests.ts` | Eight verbs |
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

A fall in the zone takes a life and stands the hero up at the last waystone (else the camp) with half its health. With none left the
floor begins again from its camp with what the hero arrived with.

## Floors as data, and adding one

A floor is a `FloorDef` (see `def.ts`): its arena and cover, start and camp, places, law, enemy kinds, packs, people, quests, caches,
waystones, the lore stone, doors, the rival, the par time and the trader's wares. `floors/harbour.ts` is floor 1.

To add a floor:

1. Write `floors/<name>.ts` as a `FloorDef` (copy the harbour's shape) and add it to `FLOORS` in `floors/index.ts`. The menu's tile, the
   "Climb to floor N" button and the stars and times follow from the registry.
2. The set pieces for floor N are data in `pieces/floors.ts` (`PIECES`): the ruler, the gate's gatekeeper and arena, the trial's kind,
   the rival's duel (floors 2, 3 and 5; floors 1 and 4 have a race the zone runs).
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
| `carry` | Take a thing from A to B; a hit that lands drops it, and it can be picked up again |
| `open` | A door's wall goes when the step is done |
| `lead` | Walk an escort along waypoints; it fails if it dies |

## The laws

`tide` (the low ground floods on a clock: 2 % of max health a second and a 0.6 walk; warned 7 s before), `storm` (a band crosses),
`dark` (a page layer with a clear circle round the hero, larger near a lit thing), `paths` (walls swap on the clock), `sides` (two banners,
take one and its pack is off while the other's is leashed). All five are built; only the tide is played on a floor so far.

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
two buttons: **Climb to floor N+1** (only when `FLOORS[N+1]` exists; otherwise the line "The way up is still being built" and no button)
and **Back to the Tower**.

## The menu

The Tower screen has two big tabs, as the Play screen has. **Climb** is `menu.ts`'s `climbPanel`: a tile per floor (name, law, stars, best
time; locked until reached; floors not built say so), the sigils kept, the hero picker, and the bar: Start floor N, or Continue floor N
(with the saved hero) and Begin floor N again. **Trials** is the weekly Tower exactly as it was, headed "Trials". The tab is kept in
`tower.tab`. Works without an account, at desktop and at 375 px. `WorldClimb` runs a climb on the game page (`game.world`): the page's own
loop steps it, a Leave button saves the floor and goes back to the Tower screen.

## The tools

All in `pipeline/tools/world-tool.js`, pasted into the tool page or the game page (`eval(await (await fetch('/pipeline/tools/world-tool.js')).text())`):

| Call | What |
|---|---|
| `_world({ floor, hero, person })` | Starts a floor; manual (you step time) or `person: true` (the page's own loop) |
| `_worldRoute({ floor, hero })` | The bot plays a floor camp to result card through the real pieces; returns time, falls, stars, checkpoints |
| `_worldSix(heroes, reps)` | The route for several heroes in the background; `_worldSix.result()` |
| `_worldVerbs()` | Every verb and every law once in a scratch zone |
| `_worldBench(label, frames)`, `_worldBench.duel()` | CPU time of `vfx.step` plus `vfx.render`, draw calls, triangles |
| `_world.end()` | Stops the floor; on the game page brings the menu back |

On the game page the tool uses `game.api` and hides the menu while it runs. The bot sprints (x3) during the race (the autopilot's own walk
takes two to three times a person's): `noSprint: true` turns that off.

## Limits

- Only floor 1 exists in the registry on this branch; floors 2 to 5 are data for their pieces and the other build adds their zones.
- The ruler, trial and gate are tuned with the autopilot, never with a person. The autopilot plays some kits badly (Vesper): see the plan.
- A reload inside a set piece continues in the zone at the last waystone with the run as it was when the door was entered.
- The five rulers are stand-ins (a hero's model, tinted). The gate's rule is that boons are set aside.
- `storm`, `dark`, `paths` and `sides` are built and tried once each, not played in a floor.
