---
title: The fight engine's new mechanics for the twenty new heroes
tags: [design, engine, heroes, traits, network]
updated: 2026-11-14
status: built and tested, 17 of 20 pieces and 3 the sheets did not name; 3 left with a simpler version (no hero, no kit, nothing a player sees)
---

# The engine pieces the twenty new heroes need

The user, 2026-11-14, of the twenty heroes designed that day: "all of them, and already match them to lore, okay". Gate 3 of
[new-hero.md](../../docs/pipeline/new-hero.md) says that anything the engine does not have is named and built first, by one
writer. This page is that list, checked against the code (the sheets, `pipeline/designs/kit-<theme>.md`, were written from
the docs), and then each piece as it was built: its API, what is drawn, how it travels online, what the CPU sees, and its test.

No hero is built here. A mechanic is general: the hero who first needs it is named, others may use it.

## The list

"Sheet" is the size the hero's sheet guessed; "Real" is what the code says. "Decides" is the screen whose word counts online
(the victim's screen decides a hit on its own hero; each client moves its own hero). The net column says how the other screen
learns it: **cast** means both screens build it from the cast message (as walls and marks are today), **#** means the new
engine channel over the `stacks` relay (below), **none** means nothing travels.

| # | Mechanic | Heroes | Decides | Online | CPU must know | Sheet | Real |
|---|---|---|---|---|---|---|---|
| 1 | The enemy's HP in a trait (`t.enemyHp()`) | Nebet | the victim's screen (`dealt`) | none: HP is synced | nothing new | none | **tiny**: `TraitView` had only its own HP |
| 2 | Facing as a rule input | Lithea | the victim's screen (its own yaw) | none | that walking away is facing away (it is: a CPU faces where it walks) | small | **tiny**: yaw is on both screens, a helper |
| 3 | Footprint trails | Arden | the victim's screen | none (each screen samples) | to avoid its own prints (`enemyAvoid`, 6) | small | **small**: a recorder, pure |
| 4 | Crossing a line; strips that carry | Saga, Ostrel | the victim's screen | none (marks from the cast) | to walk round them (`enemyAvoid`, 6) | none | **small**: helpers; carrying exists (`carryEnemy`, `carrySelf`) |
| 5 | A second cast origin (the kite) | Lian | her client | cast (the kite is placed from a cast point) | the reach is from the kite | small | **small**: `ProjectileOptions.from` is free already; aim, reach and the CPU's range were the hero's only |
| 6 | Things the enemy CPU plans round, or believes are cover | Saga, Sahar, Itzel, Arden, Ostrel, Campana | the CPU's own screen | none | this is it | (in each) | **small**: a trait hook into the CPU's route and sight |
| 7 | An HP bar cut at given values | Ramet | his client | `show` | nothing new | small | **small**: `hpChunks` cuts equal parts only |
| 8 | The engine channel (`#` over `stacks`) | 9-13, 15, 18 | — | — | — | — | **small**: no server change |
| 9 | Sleep: a stun damage ends, the waking hit +25% (30 at most) | Vela | the victim's screen | # (`#z`) | that a sleeper wakes at the first hit (`aiHoldAttack`) | medium | **medium**: kept out of `StatusKind` (the hub relays only its own eight kinds, `src/net/` types them) |
| 10 | Lines that stop spells, not feet | Morwen | bolts: the screen they fly at; a targeted cast: the caster's client; an area hit: the victim's screen | cast | wards as no sight for its bolts and targeted spells | medium | **medium**: two bolt walls (one per side) stop both sides' bolts with no change to `projectile.ts` |
| 11 | A leash to a moving hero, max length; a swap of places | Kessa | the leashed hero's own client | the leash: the trait's stacks; a break: # (`#l`) | the clamp holds it; nothing to plan | medium | **medium** |
| 12 | Locking an enemy's key; the kind of a spell | Kohaku | the victim's screen (its own client refuses the key) | # (`#s`) | a sealed key is cooling | medium | **small-medium** |
| 13 | A token one hero holds, passed by hits or picked up | Asenet, Orren | the screen of the hero who takes it (a hit's victim, the one who picks up) | # (`#k`), versions and claim times | who holds it, where it lies | medium | **medium** |
| 14 | Ground only its maker can cross | Itzel | the walker's own client | cast | its route plans round them | medium | **medium**: a walk-only obstacle that knows whom it stops |
| 15 | Breaking the arena's cover | Tova | her client | # (`#c`) | it sees the hole (sight and routes read the live list) | large | **medium**: breakable walls, `removeCover` and the toppling look exist already |
| 16 | Bolts that bend into a point (lanterns) | Vela | the screen the bolt flies at | cast (the lantern) | its bolts may be caught | (in 9) | **small**: steered from outside, no change to `projectile.ts` |
| 17 | Placed things with HP that both screens agree on | Campana, Lithea, Vela, Lian, Hesk | the attacker's screen | # | as today (it shoots units in its way) | (assumed to exist) | **medium, found here**: see "Placed things online" |
| 17b | A dash that fizzles | Morwen (Hex Bundle) | the hexed hero's own screen | # (`#f`) | a hexed CPU holds its dashes | (assumed `grounded` would do) | **small, found here**: `grounded` only shortens a dash (at most by half) and is not used up |
| 17c | Unseen: no one-target spell picks the hero | Kohaku (Glamour) | the hero's own client | # (`#v`) | it does not cast one-target spells at it | (assumed `figureHidden` would do) | **small, found here**: a hidden figure could still be picked |
| 17d | A cleanse of one's own statuses | Nebet (Feather-Light: "free of slows") | the hero's own client | # (`#x`) | — | (not named) | **tiny, found here**: no trait could end a status |
| 18 | Standing on top of cover | Corbel | his client; the victim's screen skips melee | # | to perch, and to shoot a percher | large | **large** |
| 19 | A summon that can be turned | Hesk | the enemy's screen counts the hits | # | whose the golem is | large | **large** (in `effects/summon.ts`, which another agent touches) |
| 20 | Two places counted as one in every hit test | Thessa | the victim's screen | cast (the pins) | to step off a pin | large | **large** (every spell tests its own hits) |

**Where it stands (2026-11-15):** 1 to 17 (with 17b to 17d) are built and tested, so seventeen heroes need no more engine work: Nebet, Campana,
Ostrel, Saga, Sahar, Lithea, Arden, Lian, Ramet, Asenet, Kessa, Kohaku, Vela, Itzel, Orren, Morwen and Tova. 18 to 20 (Corbel,
Hesk, Thessa) are left with what they need and a simpler spell each that the built pieces already allow (below).

### What the code says against the sheets

- **Nebet is not "none".** A trait could read only its own HP. `TraitView.enemyHp()` and `enemyMaxHp()` are added (1).
- **The hub relays only the eight status kinds it lists** (`server/hub.mjs`, `STATUS_KINDS`), and `src/net/client.ts` types
  them. A new `StatusKind` would be dropped on its way to the other screen, and `statusTest.ts` walks every kind. Sleep is
  therefore its own state on top of a stun (9), told over the engine channel.
- **The `stacks` relay is the one free channel**: any name the client likes, cut to 16 characters, `n` rounded and held to
  0..999 (`server/hub.mjs`, `case 'stacks'`). Names starting with `@` and `!` are taken (shown state, notes to the owner). The
  engine's messages start with `#` (8).
- **Lian's bolt origin exists**: `ProjectileOptions.from` takes any point. What a kite needs is the aim and the reach measured
  from it, for the player and the CPU (5).
- **Tova is smaller than "large"**: breakable walls (`def.breakable`, `Duel.blastWalls`), `removeCover` and the arena's
  `coverFall` look (Ash's pillars) are there. What is new is HP per piece against one hero's spells and telling the other
  screen (15).
- **Placed things with HP do not always agree online** (17): the crystal of `crystalPillar.ts` is a summoned unit, and each
  screen runs its own copy of the units and judges the hits on its own copy. Spells and bolts play on both screens and are
  judged alike; a basic attack on a unit stays on the attacker's screen. The sheets assumed bells, statues, lanterns and the
  kite could be built "as the crystal is". See "Placed things online" for the measurement and the fix.
- **Bolts stop at both sides' walls with two bolt walls**: a `BoltWall` stops the other side's bolts; a ward is one wall
  owned by each side, so nothing in `projectile.ts` changes (10).
- **Three needs the sheets did not name** turned up when their "Needs" columns were read against the code: Morwen's Hex
  Bundle leans on `grounded`, which only shortens a dash and stays on; Kohaku's Glamour leans on `figureHidden`, which hides
  the look but leaves the hero a target; Nebet's Feather-Light frees her of slows, and no trait could end a status. Each is a
  small piece now (17b to 17d). Ramet's wider mounted body needs none: his second kit gets its own `HERO_BODIES` row.
- **Kessa's swap moves farther than the 4 m pull cap**: it is a dash of each hero on its own screen to the other's place as
  the cast recorded it (11), not a pull.

## How the pieces are reached

- **From a trait:** `t.mech` (a `MechView`, `src/mech/index.ts`), bound to the trait's side: `t.mech.sleep(...)`,
  `t.mech.seal(...)`, `t.mech.leash(...)`, and so on. Each says on which screen it acts, as `hitEnemy` does today.
- **From a spell:** `mechFor(ctx.caster)` (`src/mech/index.ts`) gives the same view for the caster's side. A spell plays on
  both screens, so what it builds from the cast (a ward, a barrier) is built on both.
- **The CPU:** the new `Trait` hooks `enemyAvoid`, `castOrigin`, `aiHoldAttack`, read in both `Duel.ai` (the opponent) and
  `Duel.pilot` (the autopilot of the simulations).
- **Every hook costs nothing when no hero uses it:** empty lists return before any sum, no `Math.random`, and the order of
  the existing sums is untouched, so the perf tool's fights print the same.

## The engine channel (8)

`src/mech/net.ts`. A message is `stacks(name, n)` with `name = '#' + key + data` (at most 16 characters) and `n` a whole
number 0..999. The duel's `peerStacks` and the watcher's `watchMine` hand `#` names to the round's `Mech`, which hands them
to the mechanic whose key it is. Sides are written relative to the sender (`S`: the sender's hero, `R`: the receiver's), so
nothing needs the match's side numbers. Numbers in the name are base 36: a position is two characters a coordinate (0.1 m
over -64..+64 m), a clock three (0.01 s up to 466 s).

**For the parent (a server change, not made here):** a relay of its own would carry longer data and could be checked:

    case 'mech': relay(c, match, { t: 'peer_mech', k: String(m.k).slice(0, 2), d: String(m.d).slice(0, 40), n: clamp(m.n, 0, 9999) })

with a smoke case "mech relayed". The client side would only need `MechHost.send` in `Duel` to use it. Until then `#` over `stacks`
needs no change on the hub.

## The mechanics, as built

All in `src/mech/` (`index.ts` the pieces, `geom.ts` the pure helpers, `net.ts` the channel, `fx.ts` the plain look), wired
into `src/duel.ts` (the `Mech` of the round, its host, the hit pipeline, the CPU), `src/arena.ts` (walk and dash hooks),
`src/heroMode.ts` (the player's keys and aim) and `src/traits/` (the hooks). "Look" is the plain one `fx.ts` draws on both
screens; a hero draws its own over it. Picture of all of them at once: `pipeline/tools/heroes20-engine/looks.js`.

| # | Piece | API (a trait's `t`, or `mechFor(ctx.caster)` in a spell) | Look | Online | CPU | Test |
|---|---|---|---|---|---|---|
| 1 | Enemy HP | `t.enemyHp()`, `t.enemyMaxHp()` | — | HP is synced | — | `small.js` |
| 2 | Facing | `t.mech.faces('self' \| 'enemy', at, halfDeg)`; `faces(from, yaw, at, halfDeg)` in `geom.ts` | — | yaw comes with every move | a CPU faces where it walks (measured: it faces its enemy about half the time in a fight) | `small.js` |
| 3 | Trail | `new Trail()`: `sample(time, x, z)` every frame, `prints`, `scent()` (since the last gap), `along(a, b)` (metres of a flight within 1 m of it), `cut()` | the hero's marks | each screen samples the positions it has | `enemyAvoid` the prints | `small.js` |
| 4 | Lines, strips | `crosses(p0, p1, a, b)`, `crossesCircle(p0, p1, c, r)`, `toSegment`, `stripStep(p, a, b, width, speed, dt)` (then `t.carryEnemy` / `t.carrySelf`) | the hero's marks | marks from the cast | `enemyAvoid` | `small.js` |
| 5 | Cast origin | `Trait.castOrigin(t, slot)`: `{x, z}` or null | the aim strip and reach ring start there | the kite is placed from a cast point | `pickSpell` measures that slot's reach from it | `cpu.js` |
| 6 | What the CPU avoids or believes | `Trait.enemyAvoid(t)`: `[{ o: Obstacle, sight?: true }]` | — | — | the enemy CPU routes round them; with `sight` it believes it cannot see or shoot through (a mirage) | `cpu.js` |
| 7 | Bar cuts | `Trait.barCuts(t)`: HP values | a cut with a pale edge, over the head and in the top bar | read `own()`/`hp()`, both screens | — | `small.js` |
| 8 | Channel | `MechHost.send`; `Mech.receive` | — | `#` over `stacks`, also on a watcher's screen | — | `online.py` |
| 9 | Sleep | `t.mech.sleepEnemy(seconds, { bonus, cap })` (from `dealt` / `victimTick`), `t.mech.enemyAsleep()`; `Trait.aiHoldAttack(t)` | a violet ring at the feet, ASLEEP | `#z` (start, wake) | a sleeper does nothing (it is a stun); `aiHold` + `aiHoldAttack` let a CPU Vela wait | `sleep.js` |
| 10 | Wards | `t.mech.ward(a, b, seconds)` or `ward(c, null, seconds, { r })`; `wardBlocks(a, b)` | a pale ribbon or ring | built from the cast on both screens | wards are no sight for its bolts and one-target spells | `wards.js` |
| 11 | Leash, swap | `t.mech.leashEnemy(r, seconds, { breakOnDash, slow, anchor, onBreak })`, `leashSelf(anchor, r, seconds)`, `t.mech.swap(seconds, reach)` | a chain at waist height | the leash is kept by the leashed hero's screen and `#l` tells the other to draw it; the swap: each screen dashes the heroes it moves to the places the cast message recorded | the clamp holds it | `leash.js` |
| 12 | Sealed key, kind of a spell | `t.mech.sealEnemy(slot, seconds)`, `t.mech.enemyLastCast()` (slot, time, `shape`), `spellShape(spell, mode)` | a lock and its seconds on the player's key | `#s` | a sealed key is cooling | `seal.js`, `spell-kinds.js` |
| 13 | Token | `t.mech.token(key, holder, at?)` (make it on both screens, in a hook that runs on both: `marks`), `.claim(holder, at?, start)`, `.holder`, `.state`, `.onChange`; `Mech.hitsOn(side, since)` for a late pass | a gold diamond over the holder, or on the floor | `#k` with a version and the claim's start: the same number from both screens settles on the earlier start (a tie: seat 0); an older one is dropped | read `.holder` in `aiHold` / `aiGoal` | `token.js` |
| 14 | One-sided ground | `t.mech.chasm(obstacle, seconds)` (the enemy may not walk across) | a black strip with ember edges | built from the cast | the enemy CPU's route plans round it; the player's click-walk too | `chasm.js` |
| 15 | Arena cover | `t.mech.hurtCover(i, damage, from?)`, `coverLeft(i)`, `coverNear(p, r)` | the arena's own fall (`coverFall`) where it has one | decided on the hurting hero's client, `#c` | sight and routes read the live list | `cover.js` |
| 16 | Attractor | `t.mech.attractor(x, z, r, seconds, onCatch)` | a faint blue ring | built from the cast; each screen bends the bolts it flies | its bolts may be caught | `attractor.js` |
| 17b | Fizzle | `t.mech.fizzleEnemyDash(seconds)` (from `dealt` / `victimTick`); `Mech.dashFizzles(side)` | FIZZLED | `#f` | holds its dash spells while hexed | `guards.js` |
| 17c | Unseen | `t.mech.unseen(seconds)` (own client), `t.mech.enemyUnseen()` | the hero's own (`figureHidden`) | `#v` | no one-target spell at it | `guards.js` |
| 17d | Cleanse | `t.mech.cleanse(['slow', ...])` (own client) | — | `#x` ends the look on the other screen | — | `guards.js` |
| 17 | Placed things | `t.mech.placed(summonHandle)` (in the spell, at the cast) | the spell's | the attacker's screen counts their HP and `#u` tells the owner's screen, which ignores its own replays | as today | `online.py placed` |

Rules worth knowing:

- **Sleep** is a stun underneath (so everything that obeys a stun obeys it), kept apart from `StatusKind`. It takes the stun's
  rules first (immunity, a lock already running cuts it) and may then run to 1.5 s, past a stun's 1.2 s cap. The hit that puts a
  hero to sleep does not wake it (found online: the first version woke the sleeper in the same hit). Hazards wake without the bonus.
- **Wards** test an area hit from the zone's own centre (a lane: its start; a cone: its tip) to the victim; a hit with no drawn
  zone from where it aimed. Basic attacks and trait hits pass.
- **Leashes** hold walks (`Arena.walk`, `moveFoe`) and dashes; a knock or a carry that takes the hero past the end is dragged
  back at 6 m/s. The remote hero is never held here: its own screen holds it.
- **A swap** moves each hero on the screen that moves it: online the caster's client moves her to where she saw the enemy, the
  enemy's screen moves its hero to where she stood: both from the cast message, so both screens agree. It is no dash: her own
  chain holds through it (a first version broke it: found by the advisor's reading, fixed, tested in `leash.js`), and a hexed
  dash does not catch it.
- **Cover**: an arena without a `coverFall` look (most of them have none for pillars) takes the piece away without a fall; the
  hero builder of Tova will want each arena's cover to have one.

## Placed things online

Bells (Campana), statues (Lithea), lanterns (Vela), the kite (Lian) and the golem (Hesk) are summoned units with HP, made as
`crystalPillar.ts` makes its crystal. Each screen runs its own copy of every unit, and a hit on a unit is judged on the screen
where it is seen: a spell or a bolt plays on both screens and is judged alike on both (a placed thing stands still), but a basic
attack on a unit is not sent to the other screen at all (`Duel.setupTraits`, `onAttack`: "Attacks on units stay local").

Measured with Opaline's crystal and Brannoc, two bots on one dev server (`online.py crystal`, then `online.py placed`):

- As the game is (crystal): 144 paired samples with a crystal on either screen; they differed only for a sample at a crystal's
  rise and fall. Brannoc's spells hit it once (80 to 41), seen alike on both screens.
- With hits made on Brannoc's screen alone (25 every 1.5 s, as a basic attack on a unit is) and the crystal registered with
  `placed`: Opaline's screen showed every one of them (80, 55, 30, 5 on both screens); 94 paired samples, 5 apart, each one
  sample behind at a hit. Without `placed` those hits would never reach her screen.

So: a spell registers its placed thing with `mechFor(ctx.caster)?.placed(handle)` at the cast. The attacker's screen counts its
HP and `#u` tells the owner's screen; there its own replays of the attacker's hits no longer count (`Duel.hitUnit`). Nothing in
`src/effects/summon.ts` changed: it already takes a hit "passed" from another screen.

## The two-screen check (`online.py mech`)

Lyra and Isolde, two bots, Isolde keeping 7 m away and stepping from side to side; a test layer on both pages
(`online-case.js`) uses every engine message. Each screen's view sampled ten times a second and laid over the other's by the
wall clock. The last run, on the code as committed (with the swap on Lyra's R): 775 paired samples, two rounds, no page errors,
the longest message name 11 characters of 16. Two earlier runs (938 and 1,163 samples) gave the same picture.

| What | Decided on | Agree | Changes followed | Behind (median / most) |
|---|---|---|---|---|
| Sleep | Isolde's screen | 99.1% | 24 of 24 | 0 / 68 ms |
| Sealed key | Lyra's screen | 99.4% | 11 of 11 | 35 / 52 ms |
| Leash (drawn) | Isolde's screen | 97.4% | 19 of 20 | 0 / 66 ms |
| Cover broken | Isolde's client | 99.7% | 5 of 5 | 31 / 51 ms |
| Token's holder | the screen of the one hit | 100% | 8 of 8 | 0 / 48 ms |
| Wards | both, from the cast | 99.7% | 35 of 35 | 42 / 54 ms |
| HP (for scale) | | 97.4%, 98.5% | | |

(A negative lag, shown as 0, is a sample taken on the deciding screen just after the other screen's.) **The swap** (each R of
Lyra's, from the cast, on both screens): two swaps in this run; 0.45 s after the cast the two screens put Lyra 0.22 and 0.35 m
apart and Isolde 1.1 and 0.4 m apart, while both bots walk on (Isolde's sidesteps; 0.1 s of walking is 0.4 m); each landed
within 0.4 m of the place the cast recorded, Isolde once 1.1 m (she was already walking away). Two swaps are few: the hero's
own gate 5 should look again.

One-sided ground and the attractor were not run online: both are built from the cast on both screens, as the wards are, and
each screen applies them only to what it moves (its own hero) or flies (the bolts aimed at its hero).

The few samples apart are the edges of a change (a sample taken between the two screens' moments). In the runs, the changes not followed
came at a round's end: the hub drops `stacks` once a round is over (`match.state !== 'fight'`), so a pass on the killing blow
never reaches the other screen. It does not matter there (the next round starts clean), but a hero's rule must not count on a
message sent after the round ends. The first run of this check found a real bug: the hit that put a hero to sleep woke it again
in the same step; fixed (`Duel.resolve` reads "asleep" before the hit's own hooks).

## Nothing else changed (the checks, 2026-11-15)

| Check | Before (ef6fc16) | After |
|---|---|---|
| `perf.py scenes --profiles desktop --scenes duel-temple,raid-party`: duel-temple's print | 90b1abaa | 90b1abaa (every time, the final code too) |
| the same, raid-party's print | e83903c0 | the scene varies: over six runs this code printed e83903c0 three times, 34f75b29 twice and b53a2f62 once; the untouched commit, measured the same day with `--root`, printed e83903c0 once (the first baseline) and 34f75b29 three times. Both commits printed e83903c0 and 34f75b29 |
| `sim.py hero Lyra` (96 fights) | 55.2% +-9.9 | 52.1% +-10.0; on the final code 49.0% +-10.0 (the CPU's fights are random: inside the noise) |
| `sim.py hero Isolde` (80 fights) | 33.8% +-10.4 | 37.5% +-10.6 |
| `npx tsc --noEmit -p .`, `npm run build` | pass | pass |
| `npm run test:server` | 306 ok | 303 ok, then "FAIL shop: timeout waiting for boards" (below) |
| `rustfull/guard.py` | fails (engine files, Brannoc, Sirix) | fails as before, and also lists `src/effects/status.ts`, `src/traits/runtime.ts`, `src/traits/types.ts` (additions only) |

The server test's one failure is the date, not this work (no server file changed): its "week turns" case moves the server's
clock a day forward and then reports a climb for the real week; on a Sunday that day is already next week, the hub refuses the
report (`server/hub.mjs`, `m.week !== isoWeek(now()).id`) and the test waits in vain. It passes again from Monday.

## Left for later, with a simpler spell that keeps the idea

These three are as large as their sheets said. Each needs changes across systems the other pieces did not touch; the
simpler version keeps the hero's idea with the pieces built here.

**18. Standing on top of cover (Corbel).** What it needs: a hero inside an obstacle (walks push everyone out of cover:
`pushOut` in `keepInside`, the navigator, the AI's routes); his figure raised to the cover's top and held there (`HeroFigure`, the
camera, the hit size); melee spells and basic attacks that skip him (every melee effect tests its own reach, and `Attacker`
homes); his own sight from the top, past the cover he stands on (`lineOfSight`, `coverStop`, the aim strip); the CPU taught to
perch and to answer a percher; and his client telling the other screen where he is (`#p`), since a position inside cover
looks like a lost update there. **Simpler:** Take Perch lands him on the cover's edge, just outside it (no walking rule
changes), raised in look only, held still up to 6 s (`t.hold`); while perched the duel blocks basic attacks on him and hits of
a melee kit's spells (a check in `Duel.resolve`, decided on his own screen, told with `t.show`); Stone Spit from there is a bolt
like any. He loses "seeing over the cover", keeps "out of reach of blades, on the cover".

**19. A summon that can be turned (Hesk).** What it needs: a unit that changes sides mid-life. A unit's side is fixed when it is
made (its world, its victims, its bolts' tags, the side lists of `SummonSystem`), in `src/effects/summon.ts`, which another
agent touches; and each screen's copy must flip at the same moment. The count of enemy hits is already solved by `placed`
(the attacker's screen counts and tells). **Simpler:** three hits from the enemy *scratch out the word*: the golem stands
idle and harmless for 4 s (`t.unitRate(() => 0)` on its owner's client, the notches as `t.show`), and his W rewrites it as the
sheet says. The answer is the same (turn it when it stands near him, or ignore it), it just never fights for the enemy.

**20. Two places counted as one in every hit test (Thessa).** What it needs: one shared test of "where may this hero be hit
from", used by every hit: the duel's zone checks (`inCastReach` in `hitPlayer`, `opponentHit`, `hitUnit`), the bolts'
victims (`ProjectileWorld.victims` could list a hero twice, once at the other pin: `hitSet` keeps it to one hit), basic
attacks (`Attacker`), and the many spells that test their enemies' positions themselves before they call `ctx.hit` (Fragile,
for one, hits "every enemy whose live position is inside"): each of those would have to ask the shared test instead. That is a
change in most of the 160 spell files. **Simpler:** the seam carries *her own* spells only: a spell of hers that lands at one
pin also lands at the other (her spells test both pins themselves; the duel's checks see a second zone at the far pin), and
her Needle moves the far pin to where it hit (told by the screen that decided the hit, `t.noteOwner`). She keeps "a hit at one
place is a hit at another"; the enemy's spells no longer pass through the seam, so her weakness ("she is exposed the same
way") goes, and her sheet's answer becomes only "step 2 m off a pin".

## What a hero builder needs to know

- Reach the pieces from a trait with `t.mech`, from a spell with `mechFor(ctx.caster)`. Call a "decided on the victim's screen"
  piece (sleep, seal, leash of the enemy, token pass by a hit) from `dealt` or `victimTick`; call "own client" pieces (cover,
  `leashSelf`, a pick-up) from `tick`, `afterCast` or `recastAct`. Elsewhere it does nothing online, by design.
- Build anything both screens must have (wards, one-sided ground, attractors, the kite's spot) inside the spell from the cast
  (`sentFrom`, `point`), at the moment it lands, or from `noteCast`'s record: not from a trait hook that runs on one screen.
- Make a token on both screens in a hook that runs on both (`marks`), with the same first holder named by side
  (`t.side`, `t.mech.enemySide`).
- Register a placed thing with `placed(handle)` at the cast; otherwise a basic attack on it counts on one screen only.
- No message reaches the other screen after a round ends.
- Give the CPU what it needs: `enemyAvoid` for ground it should walk round (or take for cover), `castOrigin` for a slot cast
  from elsewhere, `aiHoldAttack` when an attack would spoil a set-up.
- The plain looks (`src/mech/fx.ts`) are placeholders: draw the hero's own over them (marks, parts), and if one should go,
  say so; `drawMech` draws only what is alive.
- `spellShape` reads a spell's flags; for a few spells it guesses (a self spell with no reach is a "shield": Smoke Veil, the
  Hat Trick). Kohaku's builder should check the list (`spell-kinds.js`) and add an override where it is wrong.
- Arenas whose pillars have no `coverFall` look lose a broken pillar without a fall: Tova's builder needs one per arena.
- Orren's light ("enemies in it cannot fade or be unseen") meets Kohaku's `unseen`: nothing lets one hero end the other's
  `unseen` yet. If both are built, Orren's builder adds it (the hidden hero's own client ends it on a `#` message).

## Tests

`pipeline/tools/heroes20-engine/`: one tool-page script per mechanic, each the body of an async function for
`python pipeline/tools/page-shots.py <script> <out> --port 5261`. Each puts a test trait in `TRAITS` under an existing
hero's name for that page only (no file changes: the record is exported and mutable), sets up a CPU duel, plays the
mechanic and returns what it saw. `python pipeline/tools/heroes20-engine/run.py all` runs them all (dev server on 5261) and
prints each check; pictures and results go to `pipeline/sim/out/heroes20-engine/` (git-ignored). The online checks,
`online.py mech | crystal | placed`, run two headless game pages against their own dev server on 5262 (the hero shop off);
the bots' throwaway accounts land in `server/data/` (git-ignored): delete them afterwards.

| Test | What it shows |
|---|---|
| `harness.js` | a test trait put in front of a hero's own fires in a running duel |
| `small.js` | enemy HP, facing, a strip that carries, crossing, the trail, bar cuts |
| `sleep.js` | a sleep left alone runs 1.5 s; a hit ends it early with +25% (30 at most) |
| `wards.js` | bolts of both sides stop; a one-target spell fails with its cooldown spent; an area hit does not reach past; feet cross |
| `leash.js` | a CPU and the player's hero held; a dash breaks one, keeps inside another; a swap of places, which keeps her own chain |
| `seal.js`, `spell-kinds.js` | no sealed key is cast, the lock on the key; the kind of every spell |
| `token.js` | a pass by a hit, a claim's message read back, two claims of one number settled alike |
| `chasm.js` | the CPU goes round, its maker walks across, a dash crosses |
| `cover.js` | 150 HP, the fall, sight and paths through, the next round stands it again |
| `attractor.js` | the other side's bolt caught, its own passes, none without it |
| `cpu.js` | a CPU walks round what it is told, takes a mirage for cover, casts from an origin, holds attacks |
| `guards.js` | a hexed dash fizzles once; an unseen hero cannot be picked (the key is not spent); a cleanse |
| `looks.js` | the plain look of every piece at once |
| `online.py` | the two screens, above |
