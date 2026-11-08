# Noonfall: the Raid's own place, the bosses' own bodies, mechanics players do

User, 2026-11-07: "make like dedication like new place for them", "make the bosses be different than from heroes like something new
extra and all should have like phases and spells to dodge", "so players can do mechanics of the boss when playing". Asked and answered the
same day: **one place to walk through**, and **the same bosses with new bodies**. Every number is a starting value. Names, bodies and
mechanics are original: principles from raid games, never a boss, kit or name.

**As built (2026-11-07):** how it works now is in `docs/architecture/raid.md`. Changes from this plan:
- Built in the order mechanics, bodies, hall, gates (not bodies first), after a review: mechanics were asked for twice.
- A boss's body goes through the same model loader as a hero's (`Hero`), with no skeleton: a `look` on the kit poses its parts. No separate class.
- Rewards are paid by the hub from one table (`RAID_REWARDS`) when the brain's screen asks, never by a client's own numbers.
- Seal the vent makes the lava wait 20 s longer instead of sinking a step: the floor's stages only go forward.
- Noon gathers for 8 s, with the shadows for its last 4.
- The rooms got the hall's gates. Their floors and cover are as they were: the moves were tuned on them.
- Extra parts on the bodies: a `corona` on the Warden's sun, `plateA` to `plateE` on Ash, so phases have something to change.

The rules in `src/raid/types.ts` stay: a move never reads a hero, each step is its own cast, each screen decides hits on its own hero,
shared things go through `RaidLink`.

## The place

**Noonfall Keep.** A sun fell into a mountain at noon. The Sun Warden still keeps the court above it, under the eclipse it left. Ash and Ember
keep the pit below, where it still burns. The hall between them is built round what is left of it.

**The hall** (`src/arenas/noonfall.ts`, not in `ARENAS`): round, radius 13. In the middle a cracked gold sun disc sunk in the floor, lava in the
cracks: marble and gold on the Court's side, basalt on the Pit's. Two gates on the far side, where the camera sees them: the Court's and the Pit's.
Three altars in an arc in front of the disc. Heroes come in from the south.

```
          Court gate      Pit gate
                 \         /
                   (disc)
              [A]   [B]   [C]
                     ^
                   heroes
```

**The run**, with no more cards over a black screen:

1. The hero stands in the hall, and walks. Over each altar floats an upgrade: its name and what it does.
2. **Walk onto an altar to take it**, or tap its card and the hero walks there. 30 s, and time out takes the first, as now.
3. The gate to the next boss opens. **Walk into it.** For two it opens once both have picked, and the fight starts when both are in, or after 15 s.
4. A short fade, and the hero stands at the room's south gate. A loading page only if the room is not ready in about a second.
5. The boss falls: the room's north gate opens, and a fade takes the hero back to the hall. The gate just used stays lit, the next one opens.
6. Lost, or the card's Leave: the result card as now.

No spells in the hall: walking only. The hub's order becomes `offer → gate → loading → fight`; a new message each way (`raid_gate`, `raid_enter`).

**The rooms** stay where the moves were tested (same radius, same cover spots, so no move changes) and get remade to belong to the place: the same gate at their south and north,
the Court with the crack where the sun tore through and lit by what's below it, the Pit with the fallen sun's gold showing in the vent.

## The bodies

Not heroes drawn big. No shared rig, no skinning: **rigid parts in a named hierarchy, animated in code** (`src/raid/bodies/`). Rock and gold don't bend, so this suits them, and no
hero's walk can leak in. Each must read from the game's steep camera, so what matters most is on top and wide. `HeroFigure.setModel` sees a url under `models/bosses/` and hands over to `BossBody`, so the duel
keeps calling the same methods on the same figure, on both screens and on the rim.

| Boss | Height, radius | Body | Parts (node names) | What each phase changes |
|---|---|---|---|---|
| **Sun Warden** | 5.4, 1.2 | A floating stone sentinel with no legs. A tapered monolith with gold inlay, slabs for shoulders, a broad carved mask, a halo ring round a small sun, and two huge fists that float free | `core`, `mask`, `halo`, `sun`, `slabL`, `slabR`, `fistL`, `fistR`, `stones` | Awake: the sun dim, the halo still. High Noon: it blazes and the halo turns. Last Light: the slabs break away and orbit, and the sun goes black with a corona |
| **Ash** | 5.8, 1.3 | A hunched magma brute on his knuckles. Separate plates of basalt over a glowing core, forearms bigger than his body, a small sunk head | `torso`, `head`, `armL`, `foreL`, `fistL`, `armR`, `foreR`, `fistR`, `legL`, `legR`, `core` | Each phase the seams burn hotter and plates fall away, so the core shows more |
| **Ember** | 4.0, 0.9 | A flame in a burnt mantle, no legs, no face. A hollow hood, tatters of ash with glowing edges, a white-hot core, two lanterns that orbit her | `hood`, `mantle`, `core`, `lanternL`, `lanternR` | The lanterns orbit faster and the flame grows |

They keep their rules: hit by what touches the body (`foe.body`), not moved, the stagger gauge, the fade when they hide a hero. The Warden has nothing to walk on, so it glides; Ash knuckle-walks; Ember drifts and backs away.
Files: `blender/bosses/boss_bodies.py`, then `public/models/bosses/warden.glb`, `ash.glb`, `ember.glb`.

## Mechanics players do

All **by walking**, so a phone needs no new button. Every phase of every boss has something to do besides dodging:

| Boss, phase | Mechanic | What the player does | The reward |
|---|---|---|---|
| Warden, Awake | **Break the ray** (new) | Pillar Fall's stones stay 8 s as cover. Stand behind one when Sun Ray comes | The ray shatters the stone: +40 on the stagger gauge |
| Warden, High Noon | **Turn the light** (new) | "Gathering Noon" fills for 7 s and sun shards fall, far from the altar. Walk over one to carry it (walk 15 % slower, it glows over your head), and walk it to the altar. Alone one shard, for two one each. | No Noon, the Warden kneels and takes 5 % of its max HP. Fail, and Noon comes as it does now: hide behind cover |
| Warden, Last Light | Anchors, as now | Stand in the gold, one then the other. For two both at once | No hit |
| Ash and Ember, Ash in the ring | **Hide behind a pillar** (2026-11-08, the user's design) | Six pillars are the pit's only cover. His Charge comes every 12 s he is in the ring: he fixes on one of you for 3.5 s, then runs through where you are, and kills. Get a pillar between you and him | He crashes into it and it breaks; stunned, he kneels 5 s and takes 50 % more. Kill him before the pillars run out: with none left, every Charge kills |
| Ash and Ember, Ember steps in | **Burn your own** (new) | Ember's mark follows you, and lands where you stand. Carry it onto whichever of them is in the ring | The burst hits them instead: 4 % of max HP and +40 on the gauge |
| Ash and Ember, Together | **Seal the vent** (new) | The lava rises. Stand on the vent in the middle for 4 s, hits or not, and casting stops it | The lava sinks one step and the one in the ring is staggered +40. Twice a fight |

**One new piece for all of them: an objective** (`Objective` in `types.ts`, played in `script.ts`): a spot a hero can take, at once or after holding. A move's `play` returns them next to its threats. Each screen watches its own hero and reports with
`link.objective(id, part)`. The hub takes the first report only and tells both screens who did it (`boss_obj`, then `boss_done`), and `LocalLink` does that on the spot, so it stays within rule 4. Objectives get the same gold rings and edge arrows as gold zones. A kneel asked for by an objective is the hub's, as any kneel is.

The autopilot (`Duel.pilot`) goes for objectives, so the balance tool and tests exercise them.

## What it costs, what could go wrong

- **Fight time goes down** when a mechanic works, which may make them too easy. Measure with the autopilot, then a person. Numbers are starting values.
- **The hall adds walking** before every fight. It must stay short: the farthest altar about 5 s from the start, the gate about 3 s further.
- **`PROTOCOL` goes to 5**, because the hub's order changes. An old tab gets the Reload bar.
- **A hero left standing in the hall** is covered by the timers, as the pick already is.

## Order

1. **Bodies:** the system with the Warden, then Ash and Ember. Blender runs one job at a time.
2. **Objectives and mechanics,** alone first, then for two: hub, smoke test, `_raidCheck`, `_raidAsh`.
3. **The hall,** alone first, then for two.
4. **The rooms' gates and remake.**
5. **Retest all of it,** measure with the autopilot, docs. No push and no deploy without a new ask.

**Not this job:** a third boss, new moves beyond these, friend brackets, spectating. Sound is not in the game yet.

## The lairs (user, 2026-11-07: "make the boss room different from the arena, it is supposed to be where the boss lives")

The boss rooms still used the duel arenas' props (the temple's for the Court, the caldera's for the Pit), so they read as arenas. Each
becomes the boss's home. **Every obstacle stays where it is, with the same size:** the moves were tuned on that cover. Only the look
changes: props, floor, backdrop, sky and light, and what moves in the air.

| Room | Its story | Cover (same spots) | Floor | Around it | In the air |
|---|---|---|---|---|---|
| **The Warden's sanctum** (the Sun Court) | The top of the mountain, where he keeps watch over the hole the sun tore. His throne faces the eclipse | The six screen walls become carved sun-stone slabs with gold seams (whole, cracked, rubble); the eight columns become sun obelisks with a gold disc on top; the middle altar becomes the Sun Well where shards are delivered | A great sundial: hour marks, a gnomon's shadow, cracks of light | His empty throne on a stepped plinth past the north gate; broken sun arches; floating rocks like his own; tall obelisks | Rocks drifting up and down, motes of light |
| **Ash and Ember's den** (the Cinder Pit) | The crater the sun fell into, where it still burns under the floor. They nest here | Six pillars of basalt and pale blue sun-glass, the only cover, which Ash's Charge breaks (2026-11-08; they replaced the spires, slag walls and anvil stones); the five rim perches become Ember's lantern perches | Black glass and cooled lava over a buried sun: gold light through the cracks, Ash's claw marks | A great fallen sun shard half sunk in the lava; the ribs of something huge that burned; posts with hanging lanterns round the crater | Embers rising, heat haze on the lava |

Props come from Blender (`blender/arenas/sanctum_props.py`, `den_props.py`), named `<Prop>__<material>` as the other arenas' are, so the
same instancing code places them. The Court keeps its breakable walls: the sanctum's file has `Wall`, `WallCracked` and `WallRubble`.
Nothing over 2 m on the camera's side, as in every arena (`checkCameraRule`).

## Stages, enrage, soak and summons

User, 2026-11-08: "refine how the boss works: more phases/stages and an enrage timer, and more mechanics like dodge, soak or summons".
Each boss has four phases now, one of them a stage; both have an enrage timer; Ember has a soak.

| Piece | What it is | How it works on two screens |
|---|---|---|
| **The stage** | At 50 % the boss stands apart in a shell of light and can't be hurt. Three adds rise round the room and shoot at one hero and then the other. Kill all three before its cast bar fills (30 s at tier 1) and the boss falls to its knees; if not, a blow over the whole floor | One move (`src/raid/stage.ts`, `BossMove.stage`), the phase's opener. Its first cast makes the adds where the seed puts them; its later steps (`spread`) shoot from those still standing |
| **Adds** | Units on the boss's side of the summon system: heroes target and hit them like any enemy, and spells aim past the boss meanwhile. They never move and never attack by themselves | Each screen has its own copy. A hit on one is passed to the other screen (`boss_add` → `peer_add`), and the first screen that sees one die says so: an objective (`boss_obj` → `boss_done`), so both agree |
| **Enrage** | A timer next to the boss's name: 2:30 for the Warden, 2:50 for Ash and Ember, later at a higher tier by as much as the HP grows. Then ENRAGED: every hit costs twice as much and the quiet between moves is half. The floor still closes in at 5:00 and ends it at 6:00 | Each screen's own clock from its first live frame: nothing is sent |
| **Soak: Falling Star** | Ember, in the ring, calls a star down in a gold circle where you stand. Under it: alone 10 %, for two 30 % split between those under it. Nobody under it: 30 % alone, 45 % for two | A gold zone that splits, as Shared Burden; what it costs those under it is its own number (`Threat.soak`) |

| Boss | The stage | Adds and their shots | If they still stand |
|---|---|---|---|
| The Sun Warden | **The Long Hour**: he floats behind the Sun Well | Three **Hour Stones** 9 m from the altar: beams from each through the hero, 8 % | **The dial strikes**: 55 %, and only cover between you and him is safe (gold shadows show where) |
| Ash and Ember | **Eruption**: whoever is in the ring sinks into the vent; the one on the rim keeps throwing | Three **Coal Hearts** 8.5 m from the vent: lava lobs, the first where you stand and the others round it, 8 % each | **The vent erupts**: 45 %, and nothing covers you |

Each add has 3.5 % of the boss's HP. Phases: the Warden's Awake, High Noon (70 %), The Long Hour (50 %), Last Light (35 %); Ash and Ember's
first, Ember steps in (66 %), Eruption (50 %), Together (33 %).

While a stage is on, its cast bar is its clock: a move from the one on the rim doesn't take the bar. The boss is safe from the phase's start
until the stage's cast comes (a kneel that lands with the phase makes the brain wait it out; at most 12 s).

**Tuned with the autopilot (39 heroes once each, alone):** Falling Star first cost 20 % alone under it and came from the rim as well, and Ash and
Ember fell from 26 clears to 9, with the star the first killer. At 10 %, and from the ring only, 22 of 39. The Warden stayed at 32 of 39.

### Made hard (user, 2026-11-08: "test it by playing it and make sure the bosses are hard")

Played first through the real menus (a solo run with Bram at the autopilot's Normal level): the hall, an upgrade, the gate, the Warden
won with 1 HP left thanks to Stubborn, the hall again, then Ash and Ember killed him at 27 %. Then measured: the autopilot alone, every hero
once (Ash and Ember twice in the last row), at **Normal**, the project's stand-in for a person, and **Hard**, a strong player. Clears:

| | Before | First pass | Now |
|---|---|---|---|
| The Warden, Normal | 25 of 39 (64 %) | 22 (56 %) | **14 (36 %)** |
| The Warden, Hard | 31 (79 %) | 26 (67 %) | **21 (54 %)** |
| Ash and Ember, Normal | 15 (38 %) | 10 (26 %) | **17 of 78 (22 %)** |
| Ash and Ember, Hard | 20 (51 %) | 11 (28 %) | **35 of 78 (45 %)** |

Before, no fight reached the 4:00 enrage and the stages were won almost every time. **The changes:** HP alone 4,300 for the Warden (was
3,200) and 3,300 for Ash and Ember (was 3,000), for two 8,700 and 7,100 (Ash and Ember's two-player HP was 2.33 times one player's, now
2.15, so the enrage bites two players no harder). The enrage at 2:30 and 2:50, about where the slowest third of the Normal wins end, and
later at a higher tier by as much as the HP grows (`BossFight.enrageAt`). Enraged, hits cost twice as much and moves come twice as often:
with half as much again, more than half the fights that reached it still won. The stage 30 s (was 32), its shots 8 % (were 7 %). A second
pass made Ash and Ember too hard (6 of 39 at Normal, with 3,550 HP and the enrage at 2:45); they were eased back.

**Read with care:** the autopilot dodges better than a person (at Normal it reacts to 80 % of casts within 0.2 s; Bram sat at 1 HP through a
whole phase without a hit). A person will find these bosses harder than these numbers. Stages are still won about nine times in ten at Normal,
so most losses come from the last phase and the enrage. Moves' costs and the quiet between moves were left alone: those are where the
autopilot says least about a person. **The knobs:** `enrage` in each boss's file, HP in `RAID_BOSSES`, the stage's `STAGE_S`, `ADD_SHARE`
and `SHOT_SHARE` in `src/raid/stage.ts`, `RAGE_HIT` and `RAGE_GAP`. Not measured above tier 1: there the stage's window shrinks with the
shown times while its adds' HP grows with the boss's, so it gets harder from both sides.

### The mechanics' big effects (user, 2026-11-08: "make some VFX super effect for the mechanics")

| Moment | Effect |
|---|---|
| A stage begins | The boss goes up in a column of its light, a shockwave crosses the floor, each add rises out of a column of its own; a small shake |
| The shell | Lit at its rim with bands of light running over it, so the boss shows through; in its last seconds it beats faster and the blow gathers inside it |
| An Hour Stone shoots | Its eye gathers light over the telegraph, then a white-hot beam through where the hero stood |
| A Coal Heart throws | A burning lump on a high arc from the heart, landing in its circle with a splash of fire and a ring of heat |
| An add dies | It bursts in its own colour: shards, a column, a ring |
| The stage won | The shell shatters, a white shockwave over the floor, a white flash; the boss kneels |
| The dial strikes (the Warden's fail) | 26 rays of white light out along the floor, a giant shockwave, a whiteout. The gold shadows behind cover stay the safe places |
| The vent erupts (Ash and Ember's fail) | A geyser of fire out of the vent, sixteen lumps of lava thrown over the pit, a heat wave across the floor, a red flash |
| Falling Star | A star glints just over the top of the screen, then streaks down into its gold circle; a column of light, a shockwave, its pieces |
| A mechanic done right | The light turned, the ray broken, burn your own, the vent sealed: a column of light, a shockwave, sparks and shards |
| Enraged | A red blast over the floor, red heat rising round the boss, its body lit red and throbbing, a slow red throb on the screen |

All from the casts, landings and objectives, so both screens draw them; none changes a zone, a time or a cost (the checks came out the same).
Pictures: `docs/bosses/fx-*.jpg`.

**As built, against the plan above it:** the adds' HP isn't kept by the hub. Each screen keeps its own, takes the partner's hits off when they
arrive, and death is an objective: no HP to keep in sync, and nothing new for the hub to count. The stage is a move, not a new kind of phase.
The Warden's stage was to be called Eclipse, but he has a move of that name.
