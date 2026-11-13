---
title: The Tower's floors as worlds, the build plan
tags: [tower, build, plan]
updated: 2026-11-13
---

# Floors as worlds: the build plan

The design the user agreed: [tower-worlds.md](tower-worlds.md). This file is how it gets built, stage by stage; each
stage's builder fills in what it found and what it built, so the next one starts from here.

## Where and how

- **Its own checkout:** `C:\VFXTool-worlds`, branch `tower-worlds` (a git worktree of `C:\VFXTool`). Dev server:
  `npx vite --port 5194 --strictPort` there (tool page `/`, game `/game`). The main checkout belongs to a performance
  session that is the one writer on the engine files (`src/heroMode.ts`, `src/arena.ts`, `src/duel.ts`, `src/main.ts`,
  `src/runtime.ts`) and is measuring frame times: keep this build's browser load short, and never touch `C:\VFXTool`.
- **New files only, under `src/tower/world/`** (and data per floor under `src/tower/world/floors/`), as the first
  Tower was built without changing the Raid. What the engine lacks is done from the Tower's side and marked
  `TOWER-HOOK` with a row in this file (what is needed, what is done instead). The one engine file that must change is
  `src/game/main.ts` (a menu entry and a screen): keep that edit small and in one place, and say so in the report.
- **The weekly Tower of today stays working and untouched:** its own save keys (`tower.save`, `tower.best`) and its
  weekly board are not written. The worlds use their own keys (`tower.world.*`).
- **Rules:** `CLAUDE.md`. Stage by explicit path, commit on `tower-worlds`, never push, never deploy. No helper agents
  of your own. Every wait ends within 10 minutes; never kill a process by name; stop the dev server you started.

## The shape (the advisor's and the plan's, to be confirmed by stage 0)

- **A floor is one walking fight for the zone** (as Noonfall's hall and a Tower landing are fights with no boss), and
  **each set piece is a fight of its own behind a door:** the ruler, the trial room, the rival's duel, the
  gatekeeper's duel. Leaving a set piece rebuilds the zone from the run object.
- **The run object keeps everything:** the floor, which packs are cleared, quest steps, caches found, waystones
  touched, lives, shards, boons, the rival's outcome. Saved in the browser.
- **Floors are data.** A closed list of quest verbs and law pieces, built once; floors 2 to 5 are tables on it. What a
  floor in the design asks for that the list does not have is reworded to fit, and the design file is corrected.
- **A route bot** plays a floor from its data (every quest step, door, ruler and gate) so a floor can be checked
  without a person; pictures and a clip of each part go to the user.

## Stages

| # | Stage | State |
|---|---|---|
| 0 | **Spike:** one walking-only zone of about 50 m radius with packs that appear near the hero. Measure frame time, path finding and the edge of the ring at that size. Answer the open questions below. Close the vocabulary | **done 2026-11-13** |
| 1 | **The world system and floor 1,** the whole loop, with the route bot, pictures and a clip | **1A done 2026-11-13** (the zone's loop, floors as data, the route bot, pictures; checkout `tower-worlds`). **1B** (the set pieces behind the doors: ruler, gatekeeper, trial, rival's duel) is built in another checkout against `src/tower/world/doors.ts`. Not done in stage 1: 1B's merge, the menu entry in `src/game/main.ts`, the clip |
| 2 | **Floors 2 to 5** as data | not started |
| 3 | **All five checked,** docs (`docs/architecture/tower-worlds.md`), News, merge into `feat/particle-editor` | not started |

## Open questions for stage 0

1. Does a zone of 50 m radius hold its frame rate with the harbour's look, and what does it cost against an arena?
   If it does not: a floor becomes five or six arena-sized places joined by doors, and this plan says so.
2. How does the arena clamp a hero at its edge, find paths, and place cover at that size (see how the 40-player hall
   and Noonfall's hall set their size)?
3. Can a fall be handled inside the zone's fight without ending it (the weekly Tower restarts the floor's fight)?
4. Do the Tower's boons (`TowerBoons`, a `RunUpgrades`) apply in a real CPU duel (`Duel.start`), which the
   gatekeeper and the rival are, or only on the boss path?
5. Can a unit of the summon system stand still until the hero is near, then wake its pack, and go home when the
   hero leaves? What must be added from the Tower's side?
6. Can a hero's ally (the rival, after being beaten) be a summoned unit on the hero's side in the ruler's fight?

## The vocabulary (closed by stage 0)

Each piece is the engine piece it is made of, and "new" says how big and why. The list is closed: a floor in stages 2 to 5 is a table
on it, and what a floor asks for that is not here is reworded (the table under "The five floors mapped on it").

**Quest verbs** (a quest step is one verb with its place and number; a step is done when its condition holds, and the hero's walk
is what does it, so a phone needs no new button):

| Verb | Made of | New |
|---|---|---|
| `reach` a place | An `Objective` (`src/raid/types.ts`, as the landing's altars and stairs are: `landing.ts`), a `LightPillar` as its mark; the arrows at the screen's edge already follow objectives | Nothing |
| `fell` a pack, or N of a kind | `Pack` (`src/tower/world/packs.ts`, built in stage 0): its `cleared` and its kill count | Nothing |
| `fell-named` | A pack of one, with more health and a bigger look; it may patrol (the unit's `goal` walks it between waypoints while asleep) | About 20 lines: a `named` pack with a patrol |
| `light` N things | An objective that is done after the hero stands in it for 2 s; the thing lit is a `LightPillar` | About 25 lines: the standing timer |
| `hold` a place for T s while waves come | The Tower's Hold out (`HoldRing`, a gold circle, `floors.ts`) and the horde's waves (`raise` there, one wave after another from the place's edge) | About 30 lines: the clock runs only while the hero stands in the circle; the waves are `Pack`s born at its edge |
| `carry` a thing A to B | `PlayContext.heavy(on)` (the hero walks slower, as with the Sun Warden's shard: `duel.ts:1244`) and `mute(on)` (hands full); an objective at each end | About 30 lines: it is dropped where the hero stood when a hit lands (watch `Duel.heroHp` fall) and can be picked up again |
| `open` a door | The zone's cover list is edited in place (the navigator compares it by value, `nav.ts` `sync`) or `PlayContext.addStone` / `dropStone` / `breakCover`; the door is a wall that goes when its step is done | About 10 lines, and a look that lifts |
| `lead` (an escort) | A unit on the hero's side (`arena.summonFor('hero', ...)`) with a `goal` that walks it along waypoints (the unit option Bo's sheep use); it fails if it dies. Tried in stage 0: a hero-side unit fights the ruler and takes its blows (question 6) | About 30 lines: the waypoints and the fail rule |
| `beat` the rival | A set piece behind a door: a CPU duel (`Duel.start`, the gatekeeper's way) or the Tower's Duel floor (`echoKit`, the boss path). Boons act fully on the second, only in part on the first (question 4) | Nothing for a duel; a race is reworded (below) |

**Law pieces** (one per floor, each a rule of the zone's cast):

| Piece | Made of | New |
|---|---|---|
| `tide` | `BossDef.floor(): RoomFloor` (`types.ts`, the Twin Forge's flood: `burn(x, z)`, `safe`, the AI plans round it; `duel.ts` `roomStep` burns the hero and its units once a second) for the low ground, `speedBonus` for the slow, quays and decks as the places where `burn` is 0 | About 40 lines: the rising water's look and the clock |
| `storm` | The same `RoomFloor`: `burn` is the band that crosses the zone, 0 behind cover (`PlayContext.rayStop` from the band's edge) | About 40 lines: the band and the clock |
| `dark` | The Lightless twist (`TowerHud`, a page layer under the HUD: `docs/architecture/tower.md`), its radius grown near lit things | About 30 lines: lights that push it back |
| `paths` | The cover list changes by clock: a wall rises (`addStone`, or pushed to `arena.obstacles`) and another sinks; the navigator rebuilds when the list changes | About 40 lines: the clock and the look; the navigator's rebuild on a change is not measured yet |
| `sides` | `Pack` with a `side` that a banner decides: a pack of the banner the hero took stays asleep; the others hunt. The summon cap (6 a side) bounds an army | About 15 lines |

**Ruler moves** (the Tower's and the Raid's, on the Raid's types; a ruler is a `BossDef` with phases, as the guardian is): `stones`,
`sweep`, `spokes`, `halves`, `tide`, `stand`, `volley` (from sentries), `call` (keepers by the doors), the echo's `cleave`, `lunge` and
`fan`, a still boss with a clock and sentries (the crystal: `speed` 0, sentries are `spawnAdd`), wards that fall with keepers
(`ward` / `unward`), a stagger gauge that makes it kneel (`staggerMax`, `kneel`, a `FloorReward` `kneel` for an add that falls), and
`PlayContext.guard` / `exposed` (it cannot be hurt, or takes more, for a while). A ruler's add that comes back after a delay is the
sentry raised again (about 15 lines).

## The five floors mapped on it

Law, main quest in three steps, the ruler's mechanic, the gate ring's twist, the rival. Where a cell is not the design's own words
it is the nearest wording that fits; the design file is not edited.

| | 1 · Drowned Harbour | 2 · Walking Wood | 3 · Storm Canyon | 4 · Lightless Deep | 5 · Field of Banners |
|---|---|---|---|---|---|
| Law | `tide` | `paths` | `storm` | `dark` | `sides` |
| Main quest | `fell` the market's pack; `light` the lighthouse; `carry` the captain's key from the wreck to the camp's gate | `lead` three wisps (stand by each to free it; they follow) to the heart; `fell-named` the three roots that feed it (a named pack of one each) | `carry` water to three wells; `lead` the caravan to the far end, through one storm; `open` the raiders' gate (`fell` its guards) | `carry` a great shard to three dark crystals (`light` each by standing at it); each lit crystal pushes the dark back from a hall | `reach` three standards (each takes your banner); `hold` the hill for a minute; `open` the siege line (`fell` its guards) |
| Ruler's mechanic | `sweep` and `volley` (the cannons are the sentries); at half `tide` early, and the deck is the `safe` ground | A still boss: roots (`fell-named`) that return after 20 s (sentries raised again) while it throws `volley` and raises walls (`stones` as cover) | `stones` that mark the ground, then `tide`'s near burst where the hero stood (it goes unhurt behind dust while it moves: `guard`, then `exposed`); last phase the `storm`, its shell the only cover | `volley` from crystals (sentries) that turn their aim; a crystal broken leaves a gap with no beam (`safe`); last phase `dark` at its deepest | `call` the guards of both banners (at most 6 live); fell the standard (a sentry) and the guard kneels (`FloorReward`); last phase alone, quicker `lunge` |
| Gate ring | The harbour's own shift, "the tide comes in" (`shifts/harbour.ts`: pools that grow) | The glade's roots shift (`shifts/roots.ts`: cover that rises) | The canyon's turning dust bands (`hazards/canyon.ts`) | The cavern with `dark` over half the screen (`TowerHud`), or its roof slabs (`shifts/cavern.ts`) | The battlefield's arrows (`hazards/battlefield.ts`) |
| Rival | `beat` as a race, reworded: reach the lighthouse before a runner (a unit on the path at the hero's speed) | `beat`: a duel in the thicket (a Duel floor of the Tower) | `beat`: a duel on the bridge (Duel floor) | A race reworded the same way, against the dark's clock | `beat`: a duel between the lines |

**What does not fit, and the wording that does:**

| In the design | Why it does not | Nearest that fits |
|---|---|---|
| An escort ("shelter the caravan") | It does fit: a hero-side unit with a `goal`. Listed because it is new work (about 30 lines) | `lead`: the caravan is one to three units that walk the path and are hit as the hero is; shelter is the `storm`'s cover |
| A race | The rival is a hero; the zone's fight has one hero under control, and a CPU hero runs only in a duel | "Reach the place before the runner": a unit of the rival's look walks the path at the hero's speed; whoever arrives first decides the boon |
| Two armies fighting each other | Units of the opponent side never target each other (`arena.summonFor`, `arena.ts:909`): a unit's victims are the hero and the hero's units, and the hero's units' victims are the foes | One army fights beside the hero, the other against it: the banner taken in the camp makes its soldiers hero-side units (at most 6) that walk to the front line; the other banner's are opponent-side packs (at most 6). The line is that |
| A boss that burrows | The boss's body has no hide and surface | It goes unhurt behind a cloud of dust (`guard`), marks the ground under the hero (`stones`), and bursts up there (`tide`'s near burst), open for a few seconds (`exposed`): the same fight, no hole in the ground |
| Roots that regrow | Not missing: an add dies and a new one is raised after a delay | Kept: the roots are sentries raised again 20 s after each falls; the ruler is exposed while none stands |
| A named enemy that walks the zone | A pack that waits is built; a pack that patrols is a small step on it | Kept (`fell-named` with a patrol) |
| Packs of 3 to 5 at each of five places, all awake at once | The summon cap is 6 live units a side, for the whole zone | Packs are born near the hero and the zone keeps its pack places at least 36 m apart, so one pack is near at a time; two packs awake at once are two packs of 3 |
| "The tide comes in once" (floor 1's gate) | The harbour's shift grows the water by stages | "The tide comes in": the shift as the arena has it |

## What each stage found and built

### Stage 0: the spike (2026-11-13), done

**Built** (all new files, nothing of the engine edited, no `main.ts` entry yet): `src/tower/world/zone.ts` (the zone: the ground drawn as
a map, five places, 56 pieces of cover, paths, props, an `ArenaDef` of radius 48), `src/tower/world/packs.ts` (a pack that is born
near, sleeps, wakes, leashes home, clears), `src/tower/world/world.ts` (the zone as a fight on the duel's boss path, as a horde
floor is: an unseen boss warded for the whole fight, a fall that stands the hero at the camp, `startWorld`), `pipeline/tools/world-tool.js`
(`_world`, `_worldWalk`, `_worldBench`, `_worldPath`). Pictures: `docs/tower/worlds/spike-*.jpg` (camp, market asleep, a pack awake,
caves, lighthouse, wreck and the rim).

**Measured** on the tool page in the Browser pane, CPU time per frame on this machine (the JavaScript of `vfx.step(1/60)` plus
`vfx.render()` with the GL calls it makes; `gl.finish()` after it added nothing), not a frame rate on a phone. 240 frames a run, three
runs each; the machine was shared with another session, so a median moves by about 2 ms between runs, and every configuration has a
one-off frame of 100 to 400 ms (a shader or an effect built the first time, or a garbage collection). Triangles and calls are all
passes (the shadow pass, the sea, post).

| What | Median ms (three runs) | p95 ms | Calls | Triangles |
|---|---|---|---|---|
| Baseline: a duel on the harbour (12 m ring), Lyra against Bram, both on the autopilot | 5.0, 7.7, 6.7 (step 0.6) | 11 to 12.5 | 203 to 293 | 222 000 to 237 000 |
| The empty zone, hero in the middle | 8.8, 9.2, 9.2 (step 0.3) | 9.8 | 167 | 143 000 |
| The empty zone, hero at the camp | 8.8, 9.2, 9.2 | 10 | 167 | 151 000 |
| The zone with six keepers awake round the hero (all the summon cap allows), hero on the autopilot | 6.3, 7.5, 7.1 (step 0.8 to 1.3) | 9.5 to 12.6 | 181 to 256 | 119 000 to 135 000 |
| The empty zone with the zone's meshes hidden (the hero, the HUD and the post only) | 5.2 | | 34 | 28 000 |

What the zone costs: about 4 ms more than no zone, of which the harbour's props are about 1 ms, and the sea, the glow sprites and the
dressing nothing the clock could see (the rest is the 96 m floor and its shadow). The heroes' models are most of the triangles. Two
mistakes found on the way: dressing merged into one mesh per material for the whole zone is never culled (195 000 triangles of props
drawn in two passes whatever the camera saw), so it is merged per 24 m square now (`Kit` in `zone.ts`); and the first frames of a run
are cheap while the props load from the file.

| Path finding (`arena.route`, 56 pieces of cover) | |
|---|---|
| The graph built and the first path across the zone | 33 ms, once a zone |
| A path of 55 to 69 m between two places | 1.1 to 1.7 ms; the first plan between a new pair of places 1.2 to 21 ms (the links are found as plans need them) |
| Six walkers re-planned each frame (units chasing) | median 0 ms (a kept route is not planned again), worst 9 ms |
| The hero through the five places and back (10 legs), then 44 legs to random free spots, the U of the customs house and the cave's horseshoe among them | All reached, none stuck, 0 falls; eight more legs with packs waking and chasing: no unit stood still while chasing |

**The edge:** the hero stops cleanly at 47.25 to 47.4 m (the ring less the 0.6 m margin of `Arena.keepInside`, `arena.ts:753`) however it
is sent: a walk order to a point 70 m out, a dash 200 m out, a knockback of 40, the stick held outward for 6 s. Nothing pushed it
out. At a ring of 50 the south rim is flat at z = 55 and the east reaches 49.3, because `Arena.walk` clamps to plus or minus 55
(`arena.ts:727`) round a middle fixed at (0, 7): so the zone is 48.

**The weekly Tower still starts:** `_tower(['Lyra'], 1, { upTo: 2 })` on the same tool page cleared floors 1 and 2 with no error.

**The six questions**

1. *Does 50 m hold its frame rate, and what does it cost against an arena?* On this machine yes: 8.8 to 9.2 ms against 5 to 7.7 for a
   duel arena, about 4 ms more, 167 calls against about 240, fewer triangles once the dressing is culled by square. The phone is not
   measured.
2. *Clamp, paths, cover at that size?* The ring is `ArenaDef.ring` (`types.ts:66`), read by `duel.ts:1538` into `arena.bounds`; `keepInside`
   (`arena.ts:753`) holds everything in it, units too (`summon.ts` `place`). The big halls do the same: the Sun Warden's party hall is
   `partyRing: 46` (`server/protocol.mjs:18`, picked by `raidRing`, `:53`) and Noonfall's hall 13 (`RAID_HALL_RING`, `:83`). Paths: the
   navigator copes (above). The one wall is the walk clamp of 55, so 48 is the largest ring.
3. *A fall without ending the fight?* Yes, tried: `TowerLink.heroDown` calls `fell` (`link.ts:124`), which the world takes; 1.7 s later
   `Duel.raidRevived(0, hp, 0)` (`duel.ts:906`) stands the hero up, the cast moves it to the camp; the fight never ended and the hero
   took a hit after (`TOWER-HOOK` revive).
4. *Boons in a real CPU duel?* Not by the engine: `Duel.start` (`duel.ts:520`) takes no upgrades, and every effect reads `this.boss?.upgrades`
   (`:1194` max health, `:1766` cooldowns, `:1816` damage dealt, `:2385` cooldown rate, `:3126` the save). Tried from outside: walk speed
   (`heroMode.speedBonus`, kept through `start`) and damage dealt (a wrapper on `arena.hitFilter`: 56 for 50) work; health, harm taken,
   the save and the leech cannot be reached without private fields. A gatekeeper duel on `Duel.start` gets speed, cooldown and damage
   boons only, until the duel takes `upgrades` outside a boss fight (`TOWER-HOOK` boons in a duel). The Tower's Duel floor (the boss
   path) gets all of them.
5. *A unit that waits, wakes, goes home?* Yes, built and tried: born at 18 m, asleep until 9 m or a hit, awake as a pack, home when the hero
   is 16 m from it (it heals on the way), gone at 24 m with its health kept, a cleared pack stays cleared and its bar goes down
   (`packs.ts`; the log is in `_world.status()`). The system has no such unit, so it is done by `rate` 0, `speed` 0, the melee unit's
   `goal` and an own walk home (`TOWER-HOOK`). The cap of 6 live units a side (`summon.ts:184`, `:231`) is real: with a pack of 4 still
   on its way home a pack of 5 could not be born until it was gone.
6. *An ally on the hero's side in the ruler's fight?* Yes, tried on the Tower's Duel floor: `summonFor('hero', ...)` (`arena.ts:909`)
   made a melee unit that took the ruler's bar from 1 to 0.85 in ten seconds while the hero stood still, and the ruler's blows hit
   it (400 to 340 health). The keepers of a pack also go for it (their victims are the hero and the hero's units).

**Verdict:** one zone of 48 m radius works: it costs about 4 ms of frame time on this machine, path finding is cheap, the rim is clean,
and a pack that waits, wakes and goes home is built. Two limits shape the content: at most 6 live enemies at once (so a pack is 3 to
5 and one pack is near at a time) and a ring of at most 48 (so the zone is the size of the spike's). A floor of five or six arena-sized
places joined by doors is not needed. Not yet known: the cost on a phone, and the navigator's rebuild when the cover changes (the `paths`
law).

**TOWER-HOOKs found** (the first five are `TOWER-HOOK` comments in `src/tower/world/`; the last two are not in code):

| Hook | Needed | Done instead | The engine should get |
|---|---|---|---|
| Stand still / go home | A summoned unit that waits and returns (`packs.ts`) | `rate` 0, `speed` 0, a melee `goal`, an own walk, the unit leaves at 24 m | `SummonOptions.idle` / `home` / `leash` |
| Unit cap | More than 6 live enemies a side (`summon.ts:184`) | Packs are all or nothing; places 36 m apart | The cap an option of `SummonSystem` |
| Ring centre and walk clamp | A ring wider than 48, or off the middle (`arena.ts:727`) | Radius 48 | `ArenaDef` with its own centre; the clamp from `arena.bounds` |
| Sun shadow | A shadow box that follows the hero (`runtime.ts:116`) | The zone finds the sun in the scene and moves it and its target | The runtime's sun follows the camera |
| Revive | A hero stands up after a fall in a boss fight (`duel.ts:906`) | `Duel.raidRevived(0, hp, 0)` | `Duel.revive(hp)` |
| Boons in a duel | `Duel.start` with the run's upgrades | Speed through `speedBonus`, damage through a wrapper on `hitFilter` | `Duel.start({ upgrades })` |
| The renderer on the tool page | `renderer.info` | GL calls counted by wrapping `WebGL2RenderingContext` (`world-tool.js`) | `vfx.renderer` in `src/tool/main.ts:407` |

**Not done / not verified:** no quest, no HUD beyond one line, no menu entry in `src/game/main.ts`, nothing saved. Cost on a phone and
in the game page not measured (the tool page was). The ruler, the gate and the rival are not built. The place's look is a first pass
(boxes with gold edges, the crates' gold band reads like eyes, the paths are flat). Frame numbers are noisy (shared machine, a hidden
pane).

### Stage 1A: the zone's whole loop, floor 1 as data (2026-11-13), done

**Built** (new files under `src/tower/world/`, and stage 0's `zone.ts`, `packs.ts`, `world.ts` changed; no engine file edited and no entry in `src/game/main.ts`):

| File | What it is |
|---|---|
| `def.ts` | `FloorDef` and what it holds: places, cover, enemy kinds, packs (one named with a patrol, one with an elite), people, quests made of the closed verbs, caches, waystones, the lore stone, doors, the law (a union of the five), the rival, the par time, the shop |
| `floors/harbour.ts`, `floors/index.ts` | Floor 1 as data; `FLOORS[n]`. A second floor is a data file here and a zone drawing (`arena`, `cover`); no code of the loop names a floor |
| `state.ts` | `WorldRun`: floor, hero, lives, shards, boons, quest steps, packs cleared, caches, lore, waystones, the rival's result and ally, the floor's clock, pieces won, doors opened, lights lit, the carried thing. Saved under `tower.world.run` (and `tower.world.floor`, `.sigils`, `.stars`); never `tower.save` or `tower.best` |
| `world.ts` | `buildZone`: the only way a zone begins (first entry, after a piece, after a reload, after a floor begins again). One walking fight on the duel's boss path as in stage 0. Frame order: packs, law, quests, scenery, people, the screen. A fall: a life goes, the hero lies 1.7 s, stands at the last waystone (else the camp) with half its health, the fight goes on |
| `game.ts` | `WorldGame`: owns the run and the HUD, builds the zone from the run, takes a fall (no life left: the floor begins again with the boons and shards the hero arrived with), offers boons, takes the hero through a door and back, ends the floor with its four stars and the sigil choice |
| `doors.ts` | The contract with stage 1B exactly as agreed (`PieceKind`, `PieceIn`, `PieceOut`, `PieceStarter`, `setPieceStarter`) and a default stub that reports a win with the same health after one simulated second (counted by `WorldGame.tick`, as `TowerRun.pump` counts what waits) |
| `quests.ts` | The eight verbs: `reach`, `fell`, `fell-named`, `light`, `hold`, `carry`, `open`, `lead`. The state is the run's; this class holds the drawing and what is alive (a wave, the escorted one) |
| `law.ts` | The five law pieces behind one interface (`update`, `floor`, `status`, `safe`, `facts`) |
| `packs.ts` | Stage 0's pack, generalised: enemy kinds from the floor's data (a net that roots, armour as health, scale), a patrol read from the clock, an elite, hunters (a hold's waves); a cleared pack stays cleared in the run |
| `looks.ts` | Five enemy looks and one person look drawn in code: sea-green, red and navy with brass and pale trim (the keepers are black and gold) |
| `people.ts`, `hud.ts` | The keeper (Gus), the giver (Anka), the trader (Pip) and the rival (Zephyr) as the roster's own models; marks over their heads (44 px buttons: a tap walks the hero there); a card with lines and buttons; the trader; the race. The HUD: floor and law line, lives, health, shards, clock, quest list, banners, the edge arrow, boon cards, the floor's result |
| `scenery.ts` | Waystones, caches, the lore stone, the winch, the doors (a chained gate that lifts, a trial arch, the sealed gate up) |
| `pipeline/tools/world-tool.js` | `_world`, `_worldRoute` (the bot), `_worldVerbs`, and stage 0's `_worldWalk`, `_worldBench`, `_worldPath` |

**Floor 1 in numbers:** a zone of 48 m with four packs (market 4, wreck 3 with the elite, caves 5, and Old Barnacle alone on a patrol of about 90 m at 1.6 m/s), three caches, three waystones,
one lore stone, three doors (the lair behind a chain, the trial vault, the gate up) and Zephyr's race. Quests: the main one in three steps (`fell` the market, `light` the lighthouse, `carry` the key
to the winch, which `open`s the lair), the bounty (`fell-named`), and Anka's two (`reach` then `hold` 18 s against waves of three; `lead` Tam 77 m). Shards: 4 to 7 a small enemy, 30 the elite, 40 the
named, 20 to 60 a quest, 25, 30 and 20 the caches. The tide: first at 80 s, 15 s long, then every 80 s, warned 7 s before; low ground costs 2 % of max health a second and the hero walks at 0.6.

**Checks that were run** (headless Edge on the tool page; game time stepped by the tool, 60 steps a second):

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` and `npm run build` | Both pass |
| The weekly Tower still starts: `_tower(['Lyra'], 1, { upTo: 2 })` | Floors 1 and 2 cleared, no error |
| `_worldRoute`, **Lyra** (ranged) | Cleared camp to gate in 768 s of game time (12.8 min), 0 falls, 79 % health left, 29 kills, 407 shards, four stars; 59 s of wall time |
| `_worldRoute`, **Bram** (melee) | Cleared in 463 s, 0 falls, 60 % health, four stars |
| `_worldRoute`, **Isolde** (staff) | Cleared in 1180 s with **2 falls and one restart**: she lost all three lives once, the floor began again from its camp, then she cleared it; two stars (cleared, every quest) |
| Can a hero lose all three lives? | Yes (Isolde, above) |
| How long a floor takes | 8 to 13 minutes of game time for a hero that does not die; the par for the fourth star is 13 |
| Reload mid-floor | The route was stopped at 330 s and the page reloaded; `_worldRoute({ resume: true })` continued from the save (the last one, at about 300 s): quests, caches, waystones, shards, lives, the opened lair and the cleared packs came back and the floor was cleared. Only `tower.world.*` keys were written. (The first try showed the cleared packs were not kept; fixed, and the second try kept all four) |
| Every verb once, `_worldVerbs` | A scratch quest with all eight verbs, played by the bot: all done in 111 s, no fall, no error |
| Every law once, `_worldVerbs` | `tide`: warned 7 s before; a hero in the flood lost 90 hp in 9 s and walked at 0.6; on dry ground it lost nothing. `storm`: a hero in the open band lost 32 hp in 1.6 s. `dark`: the layer is there and its clear circle grew from 22 to 62 near a lit thing. `paths`: the walls swapped on the clock; the list swap and one route took 1.6 ms. `sides`: a banner taken, its pack off, the other pack leashed at 40 m |
| Console | No `console.error` and no page error from the page's own code in any run. The one error line is the browser asking for `/favicon.ico` (404), which the tool page has always had |

**Pictures** (the game's own camera and the page's own HUD, headless, `docs/tower/worlds/f1-*.jpg`, each looked at): `f1-camp` (the people, Zephyr and their marks), `f1-talk` and `f1-trader`
(the cards), `f1-quests` and `f1-quests-hud` (the list), `f1-pack-market`, `f1-enemy-docker` / `-netter` / `-crab` (crops of the market pack), `f1-pack-wreck`, `f1-elite-mate`,
`f1-named-barnacle`, `f1-named-patrol`, `f1-tide-warn` (amber rings round the low ground), `f1-tide-in` and `f1-tide-hurt` (flooded ground; the hero on dry ground and in the flood),
`f1-cache`, `f1-cache-opened`, `f1-waystone-before`, `f1-waystone`, `f1-lighthouse-lighting`, `-lighting2`, `-lit`, `f1-key-at-wreck`, `f1-carry-key`, `f1-result` (four stars and the sigil
choice), and at 375 x 812 with touch controls `f1-375-hud`, `f1-375-card`, `f1-375-trader`.

**TOWER-HOOKs found in 1A:**

| Hook | Needed | Done instead | The engine should get |
|---|---|---|---|
| Patrol (`packs.ts`, in code) | A named unit that walks a route while it is not hunting; `SummonOptions.goal` is melee only and stops 1 m short | `unit.pos` is set each frame from the route and the clock, so the unit is where it should be after any rebuild | A unit option `route` |
| Escort (`quests.ts`) | `summonFor('hero', { goal })` walks a unit only toward a victim: with no enemy alive it does not move at all (`summon.ts` `step`, the `else if (tgt)` branch) | The escorted one is walked from here (`arena.route`, `keepInside`); its `goal` keeps it where it stands | `goal` that works with no victim |
| Boss bar (`hud.ts`) | A fight with an unseen boss and no bar (the duel's `BossHud` said "13 / 13" all floor) | A style rule hides the bar's root by its attributes while the zone's HUD exists | `Duel.startBoss({ bar: false })` |
| Speed (`world.ts`) | One field, `heroMode.speedBonus`, that the flood, the carry, a net's slow and Long Stride all want, and `PlayContext.heavy` overwrites | The zone multiplies every source in one place each frame and never calls `heavy` | A list of factors on the hero mode |
| The bot's goal (`world.ts`) | The autopilot walks only to an `Objective`, and an objective is taken once | One open objective of radius 0 (never taken), shut while anything awake is within 12 m so the autopilot fights; moved by closing it and opening another | An autopilot that takes a goal point |
| Menu entry | A "Worlds" entry and a screen in `src/game/main.ts` | Not done (not in this stage's brief): `WorldGame` is started by `_world` on the tool page | One entry: `new WorldGame(api, { hero }).start({ resume })` |
| Boons on units | `dealtMul` and `leech` act on the boss only (stage 0's hook) | Units have less health by the boons' damage (`Pack` divides by `dealtMul(false)`) and `leechFrom` on hurt, as `floors.ts` does | As stage 0 said |

**The rule for a lost piece** (the brief left it open; 1B should know it): a ruler or a gate that is lost costs one life (the zone applies it, so a piece must not take one), and the hero is back
in front of the door with half its health, free to try again; with no life left the floor begins again from its camp. A trial or a rival's duel that is lost costs nothing and pays nothing. A piece won:
the ruler pays 40 shards and unseals the gate; the trial pays a relic; the rival's duel pays a boon and sets `ally` for the ruler; the gate ends the floor (four stars, one carried boon kept as a
sigil, `tower.world.floor` set to the next floor). A piece reports `hp` as a share and the zone sets the hero's health from it. The rival of floor 1 is not a piece: it is the race in the zone.

**Not done, not verified, or poor:**

- No menu entry, no clip, no phone run. The 375 px pictures are the page in a narrow headless window with touch on, not a phone. The frame cost of the whole zone with its quests, people and law was not measured again (stage 0 measured the bare zone).
- The set pieces are the stub: `setPieceStarter` is not tried against a real piece. The zone is gone (the duel is stopped) before a starter is called, and is built again from the run when it answers.
- Floor 1 is easy for the autopilot: two of three heroes never fell, and the bot waits out every tide on dry ground, which a person may not. The numbers are not tuned; the par of 13 minutes is a guess that Lyra just meets.
- The race is won by walking straight (the rival runs at 0.92 of 4 m/s). The bot lost it in the two routes where the result was read (Isolde's and the reload test's); Lyra's and Bram's were not read, and the route report does not name the result.
- `storm`, `dark`, `paths` and `sides` are built and tried once each in the scratch zone, and not played in a floor and not drawn well: the storm band is a flat tinted box (shelter was not tried, only the open band), `dark` is a page layer with no lights drawn, `paths` has plain boxes for walls, `sides` has two poles for flags. Stage 2 owes each its floor's data, its look and a bot try. `hold`'s waves and `lead`'s road were tried on floor 1 only.
- A pack's wounds are not kept in the run (a pack that is rebuilt is whole); only "cleared" is.
- Looks: the cache is a half barrel with a glow, the key over the hero's head is small, the people stand in a T-pose for the first second until their models load, the enemy crops are of the market's units rather than one pack a kind.
- On a phone the zone's HUD sits under the hero's own panel (top 158 px), which is right only while that panel is shown.
