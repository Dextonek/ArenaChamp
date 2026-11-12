# The Tower

A third mode beside duels and the Raid: climb floors, one short room each. What it is and why: [tower.md](../../pipeline/designs/tower.md)
(the design the user agreed, and what was built and measured). Pictures: [docs/tower/tower.html](../tower/tower.html). This file says
how it works now. First version: one player, offline, no account, as the Raid alone is.

**The Raid is untouched.** The Tower imports the Raid's engine and changes none of it: no file under `src/raid/`, and none of
`src/duel.ts`, `src/heroMode.ts`, `src/arena.ts`, `server/` was edited. Where the duel has no method for what the Tower needs, the
Tower does it from its own side and says so ([Hooks](#hooks-the-engine-should-get)).

## A climb

Floor, boon, floor, boon. `TowerRun` (`src/tower/run.ts`) is shaped like `RaidRun`, and differs where the Tower does.

| What | How |
|---|---|
| A floor | One fight on the duel's boss path: `buildFloor` (`src/tower/floors.ts`) makes a `BossDef` for the floor, `Duel.startBoss` plays it, a `TowerLink` decides what the hub decides online |
| Its end | The floor's goal done: the link ends the fight as won (`TowerLink.win`), so what was fought falls and every zone goes. No card: the climb goes on by itself |
| The landing | 0.9 s later the same room again, cleared (`src/tower/landing.ts`): a fight with no boss, only walking, as Noonfall's hall is. Three altars rise before the stairs, each with a boon; walk onto one, or tap its card and the hero walks there. Then the stairs light up; walk onto them |
| Health | Carries over. The hero starts each fight with what it left the last one with (`setHealth`), never more than its max. Second Wind gives 5 % back after each floor |
| Lives | Three a climb. A fall takes one and starts the floor again after 1.7 s, with half the hero's health. With none left the fight ends as lost and the card says where the climb ended |
| A guardian beaten | Saves the climb (`tower.save`): the next climb this week may begin on the floor above it, with the boons the hero had and three lives. The menu offers that, or floor 1 |
| The best floor | The highest floor cleared, per week, in this browser (`tower.best`; this week's and the seven before) |
| The autopilot's climb | `start({ mode: 'run' })`: the same run with no fades, no waits and nothing on the page. Whatever would wait is kept until `pump()`, which the tool calls between two steps of the simulation. Nothing is saved from it |

## The week's Tower

`src/tower/week.ts`. Everything comes from the week's name, the ISO week in UTC (`isoWeek`: "2026-W46"; a new Tower every Monday
0:00 UTC), so every browser builds the same Tower with no server.

| What | Rule |
|---|---|
| The kinds' order | One seeded stream for the week (`tower-<week>`): the five kinds in shuffled hands of five, so every kind shows in the first five floors and none comes twice in a row. A guardian on every tenth floor, never a duel right after it |
| A floor's own choices | From the floor's own seed (`tower-<week>-<n>`), so they do not shift as the Tower grows: whose echo guards a Duel or a Guardian, a Duel's twist, and from floor 11 what the floor borrows and its twist |
| How far it goes | It has no top: `floorOf(week, n)` builds on as far as asked. The menu shows thirty floors, and more once the best is near them |
| The boons offered | From the floor's seed too (`boonsFor`) |

**From floor 11 a floor is mixed and twisted.** A mix is one more move for the floor's brain, borrowed from a second kind:

| Mix | What it adds | Not on |
|---|---|---|
| Gauntlet | Sweeping fire across the whole room | a gauntlet |
| Horde | Two keepers by the doors now and then; what stands in the room is warded until they fall | a gauntlet, a time to hold out (only walked: nothing could be done about them), a crystal (its clock would run out behind them) |
| Break it | One sentry that shoots (two from floor 16) | a crystal's own floor |
| Hold out | A gold circle to stand in | a gauntlet (it could come up behind a baffle), a time to hold out |

| Twist (two floors of three) | What it does | Where it acts |
|---|---|---|
| Lightless | Dark beyond a few steps of the hero | A page layer under the HUD (`TowerHud`) |
| Molten Steps | A circle that lands leaves fire for 4 s | The fight's script (`setMolten`) |
| Restless | The quiet between the room's blows is 30 % shorter | The floor's numbers |
| Thin Air | Walk 10 % slower, cooldowns 10 % shorter | `TowerBoons.speedMul`, `cooldownMul` |
| Frail | Every hit costs 20 % more | `TowerBoons.harmMul` |

## The six kinds

All by walking, so a phone needs no new button. Pale orange means leave, gold means stand here, as in the Raid.

| Kind | What is fought | How it is made |
|---|---|---|
| Gauntlet | Nobody. Two baffles across the room leave a gap each, on opposite sides: the way to the stairs is a long S. Fire sweeps the stretch the hero is in, in the half where it stood; stones fall where it stands. Reach the foot of the stairs | `BossDef.hall`, so only walking. The baffles are the room's own walls (`Obstacle.fixed`). The floor's brain casts `stones` by its gap and `sweep` by the clock (`BossPhase.timed`) |
| Horde | Keepers that come in by the four doors in two or three waves: most walk up and strike, one in four from floor 3 carries a lantern and shoots. Fell them all | Units of the summon system on the opponent's side (`arena.summonFor`), which walk, strike and shoot by themselves. An unseen boss is warded for the whole floor, so the autopilot goes for the nearest keeper. The bar is how many are left (`TowerLink.spend`) |
| Duel | The echo of a hero of the roster, bigger than a hero, with a boss's moves. One twist: a giant (bigger, more health, slower), swift (quicker, less health), or warded (two wards to break first) | The hero's own model and kit under another name (`echoKit`), `BossDef.scale` and `body`; a fighter cleaves and lunges, a caster throws a fan and calls light down, both have a shockwave |
| Break it | A crystal that seals the stairs, with two to four sentries that shoot beams through where the hero stood. When its time is out (45 s; 40 from floor 11) it strikes the whole room, and again every 18 s: only a pillar between it and the hero saves | The crystal is the boss, standing still (`speed` 0), drawn by the floor's own cast; the sentries are a boss's adds (`spawnAdd`); the strike is a zone with a `source`, so the floor behind cover shows gold as it gathers |
| Hold out | Nobody. The room turns against the hero for 45 s (55, then 60 higher up): stones, four wedges and then the four between, the half of the room it stands in, the walls and then the middle, and a gold circle to stand in. A gold ring round the room's middle runs out with the time | `BossDef.hall`; the brain casts the room's moves by its gap. A floor-wide move holds the next one back 1.6 s, the gold circle until it has landed |
| Guardian | Every tenth floor. A giant echo with three phases: it wakes; at 66 % it calls two keepers and is warded until they fall; at 33 % the walls burn and then the middle, and its blows come faster. Control fills a gauge and a full one makes it kneel | As a Duel, with phases, the gauge (`staggerMax` 100, `kneel` 5 s) and the room's `spokes` and `tide` |

Each floor also plays one long cast of its own, `floor` (as the hall's is): its goal, its clock, what it raises. A fall is said
by the link (`TowerLink.fell`), which a raid's link ends a fight with.

**The numbers** are in one table, `TOWER` in `src/tower/floors.ts`, as shares of the hero's max health at floor 1; `floorNumbers`
raises them with the height: enemies' health +8 % a floor, a hit +5 % of the first floor's a floor (from 1.12), and a step at
floors 11 and 21 (+10 % health, +0.15 on the hit). The quiet between blows gets 2.2 % shorter a floor, to half at most. Zones show
10 % shorter at each height (the Raid's tier). A keeper's blow grows with 60 % of that. What they were tuned to: `pipeline/designs/tower.md`.

## Boons

`src/tower/boons.ts`. After each floor always three: a heal, a power and a relic, in that order, so every landing asks the same
thing: health now, or strength for the floors above. `TowerBoons` is a `RunUpgrades`, so `startBoss({ upgrades })` takes it and every
hook a raid's upgrade has works for a boon. Its ids all begin `tw-`; of the Raid's ids only the three the engine asks for by name
are answered (`ENGINE_IDS`).

| Boon | Kind | Effect | Where it acts |
|---|---|---|---|
| Lantern Rest | Heal | Restore 35 % | `TowerRun.take` |
| Second Wind | Heal | Restore 15 % now and 5 % after every floor; each one taken adds | `TowerRun.take`, `TowerBoons.regen` |
| Kindled Heart | Heal | A lost life comes back; with all three, restore 25 %. Only offered once a life is lost | `TowerRun.take` |
| Keen Edge | Power | 12 % more damage, each time | `dealtMul` |
| Thick Hide | Power | 12 % more max health, each time; what it adds comes filled | `hpMul` |
| Quick Hands | Power | Cooldowns 8 % shorter, each time | `cooldownMul` |
| Long Stride | Power | Walk 8 % faster, three times at most | `speedMul` |
| Warding | Power | Hits cost 8 % less, each time | `harmMul` |
| Mirror Shard | Relic | Bolts bounce once off pillars and walls. Heroes with line bolts | `has('ricochet')`, `Arena.heroBolt` |
| Echo Stone | Relic | The first spell comes back twice as fast | `cooldownMul(0)` |
| Hourglass | Relic | The ultimate comes back 40 % sooner | `cooldownMul(3)` |
| Thirsting Blade | Relic | Heal 6 % of the damage dealt | `leech`; against units `leechFrom` |
| On the Brink | Relic | A zone that lands just beside the hero takes 1.5 s off every cooldown | `has('closecall')` |
| Phoenix Feather | Relic | Once a floor, a killing hit leaves 30 % health | `trySave` |
| Breaker's Crown | Relic | Control fills a gauge 50 % faster; 40 % more damage to a foe on its knees. Heroes with control | `staggerMul`, `dealtMul(open)` |
| Sunlit | Relic | A shield of 10 % of max health for standing in a gold zone as it lands | `has('suneater')` |
| Stair Ward | Relic | Each floor begins with a shield of 12 % of max health | `phaseShield` |

What a hero cannot use or already has is passed over; once the relics run out a second power takes the third card. The order of
each kind is the seed's alone, the same for everyone that week.

## The room

`src/arenas/tower.ts`. One place: a round stair-well room, radius 13, not in `ARENAS`. Every floor is this room again, a storey
higher: the floor's number is inlaid in its middle in Roman numerals inside the kind's sign, the kind decides what stands in it
(`towerCover`: a gauntlet's two baffles, four pillars for a horde and a guardian, two for a duel and a crystal, none to hold out),
and its stone, lanterns and sky change with the height (the Roots to floor 10, the Galleries to 20, the Crown above). The way up is
in the north wall where the camera looks: an arch, a flight of steps, and the stair going on up along the wall. The wall is tall
round the north and steps down toward the south so the camera looks over it. Four dark doors for the horde, lanterns on the wall as
the only glow. No pillar stands within 3.1 m of an altar's middle, the stairs' foot or the start. All drawn in code in the style of
Noonfall's hall, first pass, for the artist to direct.

The small enemies' looks are `src/tower/looks.ts`: a stair keeper (a hooded figure of stone with a gold mask, a blade or a lantern on
a staff) and a sentry (a brazier on a post, its flame in a gold cage).

## On the screen

`src/tower/hud.ts`, page elements with their own styles as the boss's bar has. Top left (under the boss's bar on a phone): the
floor and its kind, three hearts, the hero's health (it carries over, so it is always in sight), and the floor's goal in a few
words: "Reach the stairs", "Clear the room: 6 left", "Break the crystal: 0:42", "Hold out: 0:31", "Defeat the echo of Marin". As a
floor begins its numeral and kind cross the screen, with its mix and twist. On a landing the three cards sit in a row near the
bottom, left, middle and right as the altars stand (just over the stick on a phone); the altars' lights are green, gold and blue as
the cards' edges are.

The menu (`towerScreen` in `src/game/main.ts`): the hero picker, this week's Tower as tiles (ten to a row, a guardian in gold, a
mark on a floor with a twist), the best floor this week and last, and Start; beside Raid in the top bar and on the login.

## Hooks the engine should get

Each is done from the Tower's side for now and marked `TOWER-HOOK`: four in `src/tower/hooks.ts`, one in `boons.ts`, one in `floors.ts`.

| What the Tower needs | What it does now | What the engine should get |
|---|---|---|
| A unit's blow on the hero (a keeper's strike, a lampbearer's bolt) | A cast of a move with one unseen zone on the hero that lands at once (`bite`): the one public way a boss's hit has. It keeps shields, a parry, Warding and the Phoenix Feather | `Duel.hurtHero(opts)`: `hitPlayer` is private, and a boss's adds never attack |
| Health at a fight's start | `Duel.setPlayerHp` right after `startBoss` (it exists for a network duel) | `startBoss({ hp })` |
| Molten Steps | Sets `script.molten` on the fight after `startBoss` | `startBoss` taking the floor's twists; the fight turns it on only for a raid's omen, never in a room with no boss |
| Boons against units | Units get less health by what the boons add to damage; the Thirsting Blade heals through `arena.casterHeal` | `RunUpgrades.dealtMul` and `leech` applied to the boss's side's units too (`Duel.resolve` checks `victim === this.foe`) |
| A boon with its own number | Casts it to the base class's type | `RunUpgrades`' getters declared `: number` (they have the type of the Raid's own numbers), or the duel taking an interface |
| An echo that moves as its hero | An own name, so the hero's passive does not run on the boss's side; only heroes with no held staff are echoes (`ECHOES`) | `HeroKit.styleOf`, the hero whose motion style a kit uses: `HeroFigure.setModel` and `Duel.setupTraits` both go by `kit.name` |

## The pieces (`src/tower/`)

| File | Role |
|---|---|
| `week.ts` | The week's name and its Tower: `isoWeek`, `towerFor`, `floorOf`, the kinds, mixes and twists |
| `floors.ts` | `buildFloor`: a floor's `BossDef`, link and numbers; `TOWER` and `floorNumbers` |
| `moves.ts` | The floors' moves on the Raid's types: `stones`, `sweep`, `spokes`, `halves`, `tide`, `stand`, `volley`, `call`, and an echo's `cleave`, `lunge`, `fan` |
| `landing.ts` | `buildLanding`: the altars and the stairs after a floor |
| `boons.ts` | The boons, `TowerBoons`, `boonsFor` |
| `link.ts` | `TowerLink`: one screen, no server; a fall is the climb's to decide |
| `run.ts` | `TowerRun`: a climb; the best floor and the saved climb |
| `hud.ts` | What is on the screen over a floor |
| `looks.ts` | The keepers' and the sentries' looks |
| `hooks.ts` | Every `TOWER-HOOK` |

## Limits

- **Nobody has played it.** Every floor was only climbed by the autopilot and looked at in pictures; whether a floor is fun, and
  whether 30 to 90 s feels right, is for a hand to say. Not tried on a real phone.
- **The autopilot is not a person.** It leaves a gold circle for a stone that falls on it, ignores keepers unless what it fights is
  warded, and fights a horde in the middle of it. The floors' rules were shaped so it can climb (nothing else is called while a
  gold circle shows; a call wards the caller), which a person gets too.
- **A fallen foe is gone when the altars rise:** the landing is a new fight in the same room, so the echo's body and a few sparks
  vanish 0.9 s after it falls. The crystal scatters as the landing begins.
- **An echo is not its hero:** it has the hero's look and a boss's five moves, not the hero's spells or passive. "Two of them", the
  design's other duel twist, is not built: the boss path has one foe.
- **A hero's own spell on an unseen boss:** in a horde's room hits near the stairs' foot can say IMMUNE, where the room's unseen
  boss stands.
- **The crystal has no body to walk into:** a hero can walk through it.
- **The cards are page elements** in a row; their order matches the altars seen from the south, which a turned camera does not keep.
- **The first fade and the first effects of a session build their shaders,** as in the Raid.

## Tools

- `pipeline/tools/tower-tool.js`: `_tower(heroes, reps, { week, level, from, boons, upTo })` runs the autopilot's climb and reports,
  per hero, the floor each climb ended on, and per kind and per floor: cleared of those tried, seconds, health lost, what felled,
  and which moves hit. `pipeline/tools/tower-climbs.js` is the run the numbers in the design file come from (ten heroes twice, and
  three heroes in two other weeks), headless with `page-shots.py --page /game`.
- `pipeline/tools/tower-shots.py`: the pictures in `docs/tower/`, from the game page with its HUD, by the browser's own screenshot.
