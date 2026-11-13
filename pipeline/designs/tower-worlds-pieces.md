---
title: The Tower's floors as worlds, stage 1B: the set pieces behind a floor's doors
tags: [tower, build, pieces]
updated: 2026-11-13
---

# Stage 1B: the set pieces

The design the user agreed: [tower-worlds.md](tower-worlds.md). The build plan and stage 0's findings:
[tower-worlds-build.md](tower-worlds-build.md) (not edited here: the zone's builder edits it; everything this part would have put
there is in this file). Pictures: `docs/tower/worlds/p1-*.jpg`. Tool: `pipeline/tools/world-pieces-tool.js`.

Built in the worktree `C:\VFXTool-worlds-b`, branch `tower-worlds-pieces`. New files only (`src/tower/world/pieces/`, the tool, pictures,
this file); no engine file and none of the weekly Tower's or stage 0's files were edited, they are only imported.

## What there is

A floor has four set pieces. The zone enters one through a door and gets an outcome back:

```ts
startPiece(api, kind: 'ruler' | 'gate' | 'trial' | 'rival', input: PieceIn, done: (out: PieceOut) => void): PieceHandle
// PieceIn  { floor, hero, hp (share 0..1), boons: TowerBoons, ally?: string, mode: 'play' | 'run' }
// PieceOut { won, hp (share left 0..1), seconds }
```

The types are declared in `src/tower/world/pieces/types.ts` and exported from `index.ts`; the zone declares the same in `doors.ts`
(to be unified at the merge). **Two things the contract does not say.** `startPiece` returns a handle (`pump`, `cancel`, `over`, `report`):
the contract's `void` is still satisfied by a caller that ignores it. In `mode: 'run'` there are no timers (as in the weekly Tower's
autopilot climb), so a finished fight reports its outcome from the first `handle.pump()` after it ended; the zone's route bot must call it
between two steps of the simulation, as `TowerRun.pump` is called. In a person's play the outcome is handed back 2 s after the end (so the
end can be seen). Before `done` the piece puts back what it changed (the duel's flags, `onFinish`, the page's elements) and stops the duel;
`done` is called once (checked: 0 wrong counts in every run below).

| File | Role |
|---|---|
| `types.ts` | The contract's types, and `PiecesDef` with `RulerDef`, `GateDef`, `TrialDef`, `RivalDef` |
| `floors.ts` | `PIECES`: the data of floors 1 to 5 |
| `ruler.ts` | `buildRuler`: a ruler as a fight on the duel's boss path, from a `RulerDef` |
| `duels.ts` | `startGate` (a real CPU duel), `startTrial` and `startRival` (a floor of the weekly Tower by `buildFloor`) |
| `core.ts` | `PieceRun`: the life of one piece (ends once, `done` once, puts back what it changed); `bossFight`: `TowerRun.fight` without a climb |
| `looks.ts` | The cannon, the root, the crystal and the standard (a boss's adds) |
| `hud.ts` | A line of goal, big words, and the dark layer, on the page (a person's play only) |
| `index.ts` | `startPiece` |

### 1. The ruler's fight

A boss on the duel's boss path with three phases, a stagger gauge that makes it kneel (`staggerMax` 100, `kneel` 5 s: control fills it, and
so does a sentry that falls: `FloorReward.stagger`, or `kneel` for the Marshal's standard, so a hero with no control can still kneel it),
and one mechanic of the floor's own made only of the plan's "Ruler moves". The ruler is a hero's model drawn big under its own name, a
tint laid over the model's colours, and its own size. The hero enters with `hp` and `boons`, the outcome carries the health left, a fall
is a loss at once (`won: false`: the zone takes a life).

| | Ruler | Drawn from | Tint, size | Its mechanic, in the plan's words | Made of |
|---|---|---|---|---|---|
| 1 | The Drowned Captain | **Bram** (melee) | teal, x2.2 | Anchor `sweep`s, a cannon `volley`; at half he calls the `tide` early and only the deck is safe ground | `sweep`, `volley` (the cannons are sentries, raised in phase 2, again 22 s after one falls), `cleave`, `lunge`, the tide: `BossDef.floor` (the Twin Forge's way: `safe` = on a deck, `burn`, the walk slowed) with three decks, a hint and the water drawn |
| 2 | The Elder Root | **Hank** (melee, timber) | green, x2.7, still | A heart tree that does not move: three roots that regrow after 34 s while it throws thorns and raises walls of roots | `volley` from the roots (sentries), `stones` (cover walls), `halves`, `spokes`; `guard` while any root stands, `exposed` for 9 s when the last has fallen |
| 3 | The Scarab Colossus | **Sirix** (melee, hive) | sand, x2.5 | Burrows and bursts up under you; last phase the storm, its shell the only cover | `burrow` = `guard`, `stones`' mark, `tide`'s near burst (the boss dashes to where the hero stood), `exposed`; the storm = the same `BossDef.floor` machinery with `safe` = near the boss |
| 4 | The Prism Mother | **Auriel** (dawn) | violet, x2.6, still | Beams turn between her crystals; break one to leave a gap with no beam; last phase the dark | `volley` from four crystals (sentries; a fallen crystal fires no beam), `fan`, `stones` (light), `spokes`, the dark layer in the last phase |
| 5 | The Last Marshal | **Zephyr** (melee, sky) | grey, x2.4 | Fights with his guard; fell the standard and his guard kneels; last phase alone | `call` (at most 2 of the guard, 6 live in all), a standard (a sentry) whose fall is a `kneel` reward, `cleave`, `lunge`, `spokes` |

The stand-ins are cheap and show it: only floor 1's ruler (a mason) and floor 4's (a winged figure) read as rulers in the pictures; the Elder
Root is a lumberjack in a glade. They are placeholders for bodies of their own (stage 3 of the plan). The floors 2 to 5 were each started and
fought by the autopilot and looked at in one picture, floor 1's was looked at in each phase.

Floor 1's fight, in order: the Captain wakes (anchor sweeps, cleave, lunge); at 66 % the wreck opens fire (two cannons rise at the wings
and fire beams at where the hero stood); at 50 % he calls the tide (2.6 s of warning as the water comes up, 11 s of it, every 26 s after):
everything but the decks hurts and slows, the autopilot walks to a deck when it is called.

### 2. The gatekeeper's duel

`Duel.start` against the floor's gatekeeper (Marin, Fenna, Sefu, Opaline, Oblivion), the hero's real spells and the gatekeeper's, in the
floor's arena, one round. The CPU's level is data. **The rule:** `Duel.start` takes no upgrades, so *nothing* of the climb's boons is applied
(not the walk, not the damage, not the health), and the screen says so as the duel begins: "At the gate your boons are set aside: the
gatekeeper tests you alone" (big words for 4 s, and the gatekeeper's name and the ring's twist under them). I found no clean way to apply any
boon from outside and so applied none. A hero never meets itself (Marin at Marin's own gate meets the first other hero). The outcome's `hp` is
the health the hero entered with. A loss is `won: false`.

The ring's twist is the arena's own shift or hazard, in a run too (`shiftsInRuns` / `hazardsInRuns` are set and put back):

| Floor | Gatekeeper, arena | Twist | How |
|---|---|---|---|
| 1 | Marin, Drowned Harbour | The tide comes in | the harbour's shift, 29 s early (`Duel.shiftOffset`): its first pools open at 6 s, the sea over the kerb at 56 s |
| 2 | Fenna, Verdant Glade | Roots rise as cover | the glade's shift, 29 s early |
| 3 | Sefu, Sandstone Canyon | A storm crosses | the canyon's hazard (turning dust, first event at 8 s, then every 9 to 13 s) |
| 4 | Opaline, Crystal Cavern | The roof gives way | the cavern's shift (roof slabs), 29 s early. The plan's other wording, "half the ring is dark" (a page layer), is only in the ruler's room |
| 5 | Oblivion, Fallen Battlefield | Arrows fall on a line | the battlefield's hazard |

### 3. The trial room

One room of the weekly Tower by kind, built by its own `buildFloor` at a height that fits the floor (the weekly Tower's floor 2n): 1 a
Gauntlet (floor 2), 2 Break it (4), 3 Hold out (6), 4 a Gauntlet with the Lightless twist (8; the dark is the piece's own page layer, as the
Tower's hud does it), 5 a Horde (10). Entered with the hero's health and boons (`TowerBoons`, all of them act on the boss path), no landing:
reaching the stairs, breaking the crystal, holding out or felling the horde ends the piece as won. Not a fair fight to be measured (it is a
side room for a relic): see the table.

### 4. The rival's duel (floors 2, 3 and 5)

The weekly Tower's Duel kind (`buildFloor`, kind `duel`: an echo of the rival's hero with a boss's moves, where boons act), with one twist
each: Nyx (floor 2, "in the thicket") swift (quicker, less health), Vesper (floor 3, "on the bridge") a giant (bigger, more health, slower),
Brannoc (floor 5, "between the lines") warded (two wards to break first). Floors 1 and 4 have no rival piece: the zone runs the race itself,
and `startPiece(..., 'rival', ...)` on those throws. Vesper is not one of the weekly Tower's `ECHOES` (heroes with no held staff): the echo's
motion style may be wrong; not looked at.

### The ally

`input.ally` (the beaten rival's hero name) puts a unit of the summon system on the hero's side in a ruler's fight (`arena.summonFor('hero')`:
stage 0's answer to its question 6): a walker bigger than the horde's, in the hero's accent and foil, 380 hp and 20 a blow at floor 1
(`hard` grows it), it walks to the boss and strikes. Its look is **weak**: a small walker in the hero's colours, not the hero's figure.

## Fairness

Measured with the autopilot (`pipeline/tools/world-pieces-tool.js`, `_pieceRun`): the player's hero is the duel's autopilot at CPU level 3
(Normal, the stand-in for a person), entering at 70 % health with three ordinary boons (Keen Edge, Thick Hide, Warding); a gate is a duel
at full health with no boons. A try is a win or a loss. Heroes: six on floor 1 (Lyra and Vesper ranged, Bram and Nyx melee, Sefu and Kaia
staff), three (Lyra, Bram, Sefu) on the others. The simulation is random: a run of 36 swings by about 10 points.

### Floor 1 (six heroes, 6 tries each unless said)

| Piece | Won of tried | Seconds (mean) | Health left on a win | What felled the hero (of the losses) | Moves that hit a try (mean) |
|---|---|---|---|---|---|
| Ruler, final numbers | 20/36 (56 %) | 74 | 23 % | cleave, lunge, anchor, cannons, the tide | anchor 3.6, cleave 2.2, lunge 1.8, tide 0.9, cannons 0.8 |
| Ruler, earlier runs at slightly harder numbers (the same code but a share or two) | 21/36, 16/36, 17/36 | 76 to 81 | 14 to 23 % | the same | |
| Ruler with Zephyr beside (Lyra, Bram, Sefu, 4 each) | 10/12 (83 %) | 60 | 34 % | cleave | the same, a little less |
| Gate (Marin, Normal, full health, no boons) | 25/36 (69 %) and 21/36 (58 %), two runs | 21 | the entry health | | |
| Trial (a gauntlet, at 70 % health) | 36/36 | 28 | 58 % | (a loss only from 10 % health: 3/6, stones and the fire) | stones 0.5, sweep 0.8 |

By hero (ruler / gate, floor 1): Lyra 5/6 / 4-5/6, Sefu 6/6 / 3-6/6, Kaia 3/6 / 2-6/6, Nyx 4/6 / 3-6/6, Bram 2/6 / 4-6/6, **Vesper 0/6 / 0-1/6**.
Vesper loses to every piece: the autopilot plays that kit badly (rule 8 of `docs/pipeline/new-hero.md`), nothing the pieces do. Floor 1's ruler
is a little under the target at the Bram end (a melee hero with no way round the sweeps) and about on it overall; the gate is on the
top of the target (Normal is a little easy for Marin; Hard is 44 % at floor 1, Master 11 %: the levels are coarse steps).

### Floors 2 to 5 (Lyra, Bram, Sefu, 4 tries each: 12 in all, so a swing of 15 points)

| Floor | Ruler won | Seconds | Gate (level) won | Rival duel won | Trial (kind) won |
|---|---|---|---|---|---|
| 2 | 7/12 (58 %), 174 s | long | 7/12 (58 %) at Hard (4) | 9/9 (Nyx, swift) | 9/9 (Break it) |
| 3 | 9/12 (75 %), 88 s | | 10/12 (83 %) at Normal (3); at Hard 2/9 | 8/9 (Vesper, giant) | 8/9 (Hold out) |
| 4 | 6/12 (50 %), 96 s | | 7/12 (58 %) at Normal (3) | | 9/9 (Gauntlet, Lightless) |
| 5 | 6/12 (50 %), 126 s | | 6/12 (50 %) at Hard (4) | 6/9 (Brannoc, warded) | 6/9 (Horde) |

CPU levels of the gates (data in `floors.ts`): floor 1 Normal, 2 Hard, 3 Normal, 4 Normal, 5 Hard. The plan said floor 1 about Easy and floor 5 about
Hard; Easy gave 94 % at floor 1, so floor 1 is Normal.

**Where it is not yet fair.** (a) The levels do not make "harder floor by floor": floor 3's gate (Sefu at Normal) is 83 % and at Hard 22 %, and
there is no level between; the gates' own heroes decide more than the level does. (b) Floor 2's ruler takes 174 s: the roots must all fall
inside the 34 s they take to grow back, which the autopilot does slowly; a person may find it long. (c) Rulers 3 to 5 got one pass of tuning
(shares and health), not a careful one. (d) The ally is untuned against the other floors: at floor 1 it moves the ruler from about 56 % to
about 80 %. (e) The rival duels and trials are not tuned at all (the weekly Tower's numbers at floor 2n+1 and 2n): they are easy for the
autopilot except floor 5's. (f) Every number is the autopilot's, never a person's.


## Quirks found and fixed (worth knowing)

- **A move's key in `BossDef.moves` must be its `id`.** The brain casts `move: m.id` and the fight looks it up by that key, so a record
  keyed `anchor` holding `sweep()` (id `sweep`) does nothing at all: it cast, hit nobody, and the autopilot won 90 % of the time. `ruler.ts`
  sets `id` to the key.
- **A sheet drawn over a boss hazes it.** A boss's figure is drawn in the transparent pass; a water sheet with a later render order covers the
  body in water-colour. The sheet has render order -2.
- **The pane shows the frame before.** Pictures of a hidden pane's canvas: step, `vfx.render()`, wait, render again, then take two
  screenshots and use the second.

## TOWER-HOOKs (done from the Tower's side; the engine should get)

| Hook | Where | Needed | Done instead | The engine should get |
|---|---|---|---|---|
| Tint | `ruler.ts` `tintFigure` | A boss drawn in a colour of its own | After the figure loads, the boss figure's materials are reached through `Duel`'s private `figure` and `RealHero`'s private `mats` and lerped to the tint (the base colours the flash is drawn from) | `HeroKit.tint` |
| Style of | `ruler.ts` `standKit` | A kit that is another hero's body under its own name | As the weekly Tower's `echoKit` (the name decides the motion style) | `HeroKit.styleOf` |
| Twist at start | `duels.ts` `startGate` | A duel that begins with its arena's twist started | `Duel.shiftOffset` (public, made for tests) after `start`; hazards by `hazardsOn` and their first event at 8 s | `Duel.start({ twist })` |
| Boons in a duel | `duels.ts` | `Duel.start` with the climb's boons | None: the gate's rule says they are set aside | `Duel.start({ upgrades })` (stage 0's row) |
| A card on a duel | `core.ts` `watch` | No result card on a duel that is only a piece | The rematch button is muted for the piece; the card shows for the 2 s before `done` and goes with the duel's stop | `Duel.start({ card: null })` as `startBoss` has |
| A floor that slows | `ruler.ts` surge | `RoomFloor.slow(x, z)` | `heroMode.speedBonus` set each frame from the piece's own state while the sea is in | `RoomFloor` with a `slow` |
| A unit with a hero's body | `ruler.ts` ally | The ally drawn as its hero | The default walker in the hero's colours | `SummonOptions.model` (a hero's figure as a unit's look) |
| The end of a duel | `core.ts` `pump` | A callback after a frame, not inside it: `Duel.onFinish` is called from within `Duel.update`, so the zone could not start its next fight from it | `done` is called from `pump` (the autopilot's) or 2 s later by a timer (a person's) | `Duel.onFinish` deferred to the end of the frame |

## Not done, not verified, or poor

- **Nobody has played it.** Everything is the autopilot's play and pictures; whether a ruler is fun, readable on a phone or too long is for a
  hand to say. Not tried on a phone. The pictures are from the tool page's camera in a hidden pane (the game page was not used).
- **Not run through the zone.** The zone's builder has not merged: nothing calls `startPiece` but the tool. How a door, the zone's fade and
  the zone's hud meet the piece's (a second top-left box) is for the merge.
- **Play mode was proved only by forcing the end:** all six ends (ruler, trial and gate, each a win and a loss) hand `done` once after 2 s
  with the duel stopped; a whole fight by a person was not played. The autopilot's runs (`mode: 'run'`) are the measured ones.
- **The looks are first pass and several are poor.** The five rulers are a hero's model with a tint: the mason, the lumberjack, the hive
  insect, the dawn angel and the sky hero as the Captain, the Root, the Colossus, the Mother and the Marshal. The Elder Root does not look
  like a tree, and the stand-ins' own weapons (Bram's hammer) show. The Captain's anchor is the Tower's fire bar renamed; the cannon, root,
  crystal and standard are small procedural pieces. The ally is a small walker in the hero's colours (it reads as a teal figure of the
  rival's colour, not as the rival).
- **Floors 2 to 5 were each started and fought by the autopilot and looked at in one picture,** not checked phase by phase. Not looked at: the
  Root's walls of roots (they are the Tower's stones, no root look), the Colossus's storm (dust and a gold ring round the shell, no picture),
  the Prism Mother's dark layer, the Marshal's guard of both banners (the guard is the Tower's keeper look in red or blue: the keeper look
  sets its own stone colour, so the banners are only in the unit's bar colour), the Marshal's kneel by the standard.
- **A sentry's fall paying the stagger gauge was never seen to fire** (cannons: 45 points; the Marshal's standard: a kneel). The kneel itself works:
  control filled the gauge in the runs (about 0.9 kneels a try on floor 1) and `link.stagger(100)` showed it in a picture. The autopilot rarely fells a cannon.
- **Gates 3 and 5 use the arena's hazard,** which fires its first event at 8 s by itself; the plan's "a storm crosses once" is
  "a storm crosses every 9 to 13 s" here. Floor 4's twist is the roof slabs, not "half the ring is dark".
- **Rivals 2, 3 and 5 are not looked at in a picture,** nor is a trial of floors 2 to 5.
- **No `?arena=` or game page check:** the pieces were run on the tool page (`http://localhost:5195/`) only; `window.game.api` has the same
  fields, but `startPiece` was not run there.
- **Cost on a phone and frame time were not measured.**
