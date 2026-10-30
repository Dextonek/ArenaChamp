---
title: Combat mechanics
tags: [architecture, mechanics, status, projectile, summon, duel, ai, testing]
updated: 2026-10-29
---

# Combat mechanics

The engine pieces behind spells that do more than damage plus knockback: status effects, shields, heals and dashes, skillshot projectiles, summoned units and melee heroes, plus how the duel AI plays against them. The code is in [status.ts](../../src/effects/status.ts), [projectile.ts](../../src/effects/projectile.ts), [summon.ts](../../src/effects/summon.ts), the shared looks in `src/effects/parts/` (`status`, `shield`, `bolt`, `minion`), the arena ([arena.ts](../../src/arena.ts)), hero mode ([heroMode.ts](../../src/heroMode.ts)) and the duel ([duel.ts](../../src/duel.ts)). Read it before writing a spell that stuns, shields, shoots or summons, or before changing the duel AI. The plan it grew from is [mechanics.md](../../pipeline/designs/mechanics.md); where the plan and the code differ, this page follows the code.

## Concept

A spell reaches every mechanic through its `CastContext` ([targeting.ts](../../src/effects/targeting.ts)) or through a field on `HitOptions`; the engine owns the state (the arena ticks statuses, shields, dashes, bolts and units) and the spell only draws. The same rules apply to the player hero, the duel opponent and the arena foes, with the limits listed at the end. Everything is tested with hidden test kits, see [Testing](#testing).

## Statuses ([status.ts](../../src/effects/status.ts))

A hit carries one status: `ctx.hit(e, { damage: 30, status: { kind: 'stun', seconds: 1 } })`. `StatusSet` keeps the timers (one per figure; the arena holds one for the caster and one per foe) and answers `stunned`, `cannotMove`, `cannotCast`, `blind`, `speedMul` and `lift`.

| Kind | Cap (s) | Effect | Floating word |
|---|---|---|---|
| `stun` | 1.2 | no move, no cast | STUNNED |
| `knockup` | 0.8 | a stun that also lifts the figure up to 1.2 m (`KNOCKUP_HEIGHT`, a sine over its length) | KNOCKED UP |
| `root` | 1.5 | no move, can cast | ROOTED |
| `slow` | 2.5 | walking speed x 0.6 (`SLOW_FACTOR`) | SLOWED |
| `silence` | 1.5 | can move, no cast | SILENCED |
| `blind` | 2 | every cast lands at a random spot inside `BLIND_RADIUS` (2.5 m) of the aim point | BLINDED |

Rules:

- **Caps:** a single hit gives at most the cap, whatever `seconds` says.
- **Refresh, no stacking:** applying a kind that runs keeps the larger remaining time and returns `'refreshed'`; the word is only shown when it returns `'applied'`.
- **Immunity:** when a stun or knock-up ends, 0.5 s (`CC_IMMUNITY`) of immunity to both follows. A stun or knock-up inside it is refused (`'immune'`, floating "IMMUNE"), so there is no chain-lock. Root, slow, silence and blind are not affected by it.
- **Filtered hits give none:** a hit the duel's filter drops (a dodge) or one that kills gives no status. `arena.hit` applies the status only while the target lives.

### What each side does with them

| Who | Behaviour |
|---|---|
| Player hero ([heroMode.ts](../../src/heroMode.ts)) | `HeroMode.status` is the caster's `StatusSet`. Stun, knock-up and root stop click-moves; stun, knock-up and silence stop casting (toast "Stunned" / "Silenced"); slow walks at x0.6; blind rolls `arena.blindOffset()` into `arena.aimOffset` around the cast, so the effect and its danger zones are played at the offset spot. The QWER bar greys while the hero cannot cast and a dark vignette fades in while blind |
| Duel opponent and autopilot | A stunned or dashing AI does nothing; root or stun stops walking; slow scales `AI_SPEED` (3.5); silence skips casting; blind rolls an offset into the aim point (self spells are not aimed). A bolt dodge is skipped when it cannot move |
| Arena foes | `arena.applyStatus(target, kind, seconds, color)` works on any foe and on the caster figure. Foes get the same visuals; a knock-up lifts a foe where its position is rebuilt |

Because blind moves the cast, the telegraph is drawn at the offset spot and the zone dodge checks stay correct.

`arena.statusOf(target)`, `arena.clearStatuses(target?)` and `arena.applyStatus(...)` are the entry points. The visuals are in [parts/status.ts](../../src/effects/parts/status.ts): `StatusFx` per figure (stun three stars, root a dark ring with four clamps tinted by the last hit's colour, slow streaks, silence a crossed rune, blind a dark band over the eyes) handed out by `StatusFxPool`. A knock-up has no extra visual.

## Shield, heal and dash

Three optional `CastContext` methods, bound to the casting figure (the player hero, a duel opponent or an arena foe) by the arena's `selfFx`. The type marks them optional because network duels leave them undefined.

| Method | What it does |
|---|---|
| `shieldSelf(amount, seconds, color?)` | A shield that absorbs damage before HP (`arena.soak`), then breaks (floating "SHIELD BROKEN", a shard pop) or expires. Casting again keeps the larger amount and restarts the clock. Absorbed damage shows as a pale number. Visual: [parts/shield.ts](../../src/effects/parts/shield.ts) (`ShieldFx` bubble, `ShieldFxPool`); the duel bar draws a shield segment |
| `healSelf(amount)` | Heals up to max HP with a green "+N" number. For the player hero it goes through `arena.casterHeal`, which the duel sets (the duel keeps the hero's HP); outside a duel it only shows the number |
| `moveCaster(to, seconds)` | Slides the caster to `to` over `seconds`, ease-out cubic, clamped into the duel ring; returns the spot it will really reach. Meanwhile `arena.isDashing(figure)` is true: `walk` and knockback do nothing, hero mode ignores click-move and casts, the AI holds still. Call it at the cast moment and re-check enemy positions against the returned spot when the dash lands |

### Pull

`HitOptions.pull` (metres) drags the hit target toward `from` (default the caster), stopping 1 m short of it, at most 4 m. Pass `knock: 0` with it, because the default knock of 4 pushes the other way. A zone that drags enemies to its centre passes `from: point`; a hit that drags them to the caster leaves `from` unset. On an arena foe or duel opponent the pull rides the knockback velocity (it decays as exp(-7t), so the pull is added as `7 × metres`); on the player hero in a duel it moves the hero at once and keeps them inside the ring. A pull during a spell's build that only shows the drag uses `ctx.displace` instead and changes nothing in play.

In a duel the opponent's hits on the player go through `arena.absorb(caster, damage)` first, so a player shield works against the AI too. `arena.shieldOf(target)` reads the current shield (the duel HUD uses it).

## Skillshot projectiles ([projectile.ts](../../src/effects/projectile.ts))

`ctx.projectile(opts)` fires a bolt at the cast moment and returns a `Projectile` handle. The arena's `ProjectileSystem` moves and collides it every frame; the spell follows the handle (`pos`, `dir`, `alive`, `children`, `onHit(cb)`) to draw it. A bolt is dodged by stepping off its line before it arrives, not by leaving a zone.

### Options (`ProjectileOptions`)

| Option | Meaning |
|---|---|
| `from`, `dir` | start (feet position; y ignored) and ground direction (need not be normalised) |
| `speed`, `range`, `radius` | m/s, flight distance, bolt radius (an enemy body adds `BODY_RADIUS` 0.5) |
| `hit` | a `HitOptions` for what a hit does; the engine adds `projectile: true` and, unless set, `from` = where the bolt was |
| `pierce` | keeps flying after a hit; each enemy is hit once |
| `bounce` | after a hit, turns to the nearest other enemy within `BOUNCE_RANGE` (6 m) of the hit, this many times; range is extended to reach it (at least the distance plus 2) |
| `split` | `{ count, spreadDeg, at: 'hit' \| 'end', hit?, range? }`: fans out into `count` child bolts over `spreadDeg`; `'hit'` at the first hit (the parent ends), `'end'` at max range. Children use `hit` (default the parent's) and `range` (default 6), never hit an enemy their parent hit, and do not split, bounce or pierce |

Bolts fly at `BOLT_HEIGHT` 1.1 m. `onHit` fires for the whole family (children share the callbacks).

### Collision

Each frame a bolt sweeps a capsule from its old to its new position on the ground plane (`segmentTouch`). Every victim not yet in `hitSet` whose centre is within `radius + BODY_RADIUS` of that segment is hit, in the order the bolt meets them. A pillar or wall ends the bolt (`blocked`, via `blocksSight` on `arena.obstacles`). Without `pierce`, the first hit ends the bolt, splits it, or bounces it on. `ProjectileSystem.stats[tag]` tallies `fired`, `landed`, `missed` and `hits` per tag (`hero`, `opponent`, `hero-unit`, `opponent-unit`).

### How the duel accepts them

`HitOptions.projectile` is set by the engine only. The bolt physically touching the target is the dodge check, so both duel filters let it through: `Duel.opponentHit` returns true at once, and `Duel.hitPlayer` / `hitUnit` skip the zone and "near the aim point" tests. A bolt's `from` is where it was, so knockback pushes along the flight. The spell's telegraph for a bolt is a line zone along its path, only for the player to read.

### AI dodge

`Duel.dodgeBolt` asks `arena.projectiles.threats(figure)` for bolts flying at the figure. A bolt that will cross the figure within `BOLT_WINDOW` (0.6 s) is rolled once: `BOLT_DODGE_CHANCE` 0.65 decides whether this AI reacts, and it starts to move `BOLT_REACTION` (0.12 s) later, one step across the line to the side it stands on. So about a third of bolts land, and a late dodge fails. Both the opponent AI and the autopilot (the player's hero in duel simulations) do this; neither dodges while unable to move.

### The look ([parts/bolt.ts](../../src/effects/parts/bolt.ts))

`BoltSet.follow(handle, look)` draws a handle and every child it splits into: a hot core, a flat coloured body, a dark rim, a tapered trail and a spark on each hit. `BoltLook` = `core`, `body`, `rim`, `size`, `trail`, `hit`; `defaultBoltLook()` is the orange one. `BoltSet.busy` stays true while anything still flies or fades; keep the effect `playing` until it is false. Spells may draw their own bolt from the handle instead.

## Summons ([summon.ts](../../src/effects/summon.ts))

`ctx.summon(opts)` makes small units for the caster's side and returns a `Summon` handle (`units`, `alive`, `onDeath(cb)`). The arena owns and ticks them (`arena.summons`, a `SummonSystem`).

| Kind | Behaviour |
|---|---|
| `melee` | walks (default 3.6 m/s) to the nearest enemy, and inside `MELEE_REACH` 1.4 m starts a 0.3 s swing; the hit lands at the end of the swing if the target is still within about 1.9 m |
| `ranged` | keeps about 6 m away (walks in beyond 7 m or without sight, backs off under 4.5 m; default speed 3) and fires small bolts (speed 14, radius 0.22) at range 9 with sight |
| `turret` | never moves; fires the same bolts at whatever is in range 8 with sight |

`SummonOptions`: `kind`, `at` (a ring of `count` units is spread round it), `count` (default 1), `hp`, `seconds`, `damage`, `attackEvery`, optional `range`, `speed`, `color`, `look`. A unit dies at 0 HP (`slain` true) or when `seconds` run out (`slain` false), with a small puff; `onDeath` fires for both.

### The cap

At most `MAX_UNITS` = 6 live per side. A summon over the cap makes fewer units (the handle's `units` holds the ones really made, possibly none). The AI does not cast a summon spell when its side is at the cap.

### How units are hit and targeted

- A unit's `figure` is an `Enemy`, so it is a valid `ctx.hit` target. The arena routes a hit on a unit to `summons.hurt` (flash, knockback capped at 6, damage number, HP) after the same `hitFilter` as foes. Units take no statuses.
- In the duel, the opponent's units are in the player's `ctx.targets` (the `ground`, `self` and `enemies` pools), and `arena.liveFoes()` lists them after the foes. The hero's own units are in the AI's casts the same way (`castSpell` adds the player's units inside the area or next in a chain). A unit is never the duel's enemy hero: its death does not end the round.
- A unit picks the nearest enemy (hero or unit) each frame. Its hits go through the world's `hit` with `projectile: true`, which in a duel is the normal hit path (shield, status, no zone check).
- Units push each other apart (`SEPARATION` 0.75; a turret never yields). They stay inside the ring and slide round obstacles.
- `summons.stats[side]` tallies `spawned`, `dealt`, `taken`, `slain`, `expired`; the duel result carries it as `units`.

### The look: pluggable ([parts/minion.ts](../../src/effects/parts/minion.ts))

`kind` decides behaviour only. The look is a `MinionLook`: `(kind, palette) => MinionRig`, where the palette gives the body and trim materials (the arena's hit flash drives them), an unlit eye material and an outline material, and the rig has `root` (about 0.9 m tall, facing +Z, feet at y 0), `animate(dt, pose)` and optional `dispose`. `MinionPose` carries `time`, `walk`, `swing` and `shot`. Pass `look` in `SummonOptions`; `defaultLook` is the generic low-poly walker or post. `MinionFx` is an `Enemy` without the robe, with a small HP bar and a pop-in; `MinionPool` reuses figures so a summon builds no meshes.

### Budget

Summon kits stay inside the numbers the test kit was tuned to: see "Summon budget" in [kit-common.md](../../pipeline/designs/kit-common.md) (melee 2 x 40 HP for 6 s at 6 per 1 s, ranged 2 x 35 HP for 6 s at 8 per 1.5 s, turret 1 x 80 HP at 10 per 1.4 s, range 8). The same page has the "Zone hits" rule: area spells re-check each enemy's position at the impact moment rather than looping the cast-time `ctx.targets`.

## Melee kits

Three optional fields on the kit data ([heroes.ts](../../src/heroes.ts)):

| Field | Where | Effect |
|---|---|---|
| `maxHp` | `HeroKit` | start HP and the duel bar's length, default 600 (`HP` in duel.ts). The test melee kit has 780 |
| `melee: true` | `HeroKit` | the duel AI closes to about 2 m (`MELEE_GAP`) instead of holding 70% of Q's range, never backs off, strafes less and keeps chasing a target that retreats |
| `dash: true` | `HeroSpell` | a gap closer: the AI casts it only when the enemy is farther than Q's range + 0.5, aimed at a spot short of the enemy (`dashAim`), never otherwise |

A melee kit's Q is a short-range swing with a `cone` telegraph, so it can be side-stepped like anything else; a hard status on contact lets it make a hit stick. The test spells cover each piece.

Other `HeroSpell` flags the AI reads:

| Flag | Meaning |
|---|---|
| `cc: true` | the spell stuns or roots; see the AI rules below |
| `summon: true` | the AI casts it when ready and the hero is within 10 m (`SUMMON_REACH`), at a spot 3 m in front of itself |
| `aim: 'line'` | a skillshot: hero mode draws a strip of the spell's range and width from the hero toward the cursor instead of the ground circle |

## Duel AI rules ([duel.ts](../../src/duel.ts))

`pickSpell` chooses what to cast, `steer` where to walk, `dodgeBolt` when to sidestep. The same code drives the opponent and, in `'run'` mode, the player's hero (`pilot`).

1. **Cannot act:** stunned or dashing does nothing; a cast in progress (`rooted`) or the 1.2 s opening beat only faces the enemy.
2. **Bolt dodge** comes before casting or walking (see above).
3. **Cast order.** Unless the other side is already held (stunned or rooted), a ready `cc` spell in reach goes first, tried R, E, W, Q. Then the first ready spell in the order R, E, W, Q that is in reach. R waits until the other side is under 55% HP or the round is 20 s old; a self spell (E) waits until the enemy is inside its radius minus 0.6; without line of sight only self spells and summons go.
4. **Target choice.** The hero first. Only when nothing can be cast at the hero (out of range or sight) and an enemy unit stands within `UNIT_BLOCK` (2.5 m) and closer than the hero (`blocker`) does it cast at the unit. A summon spell goes by the distance to the hero.
5. **`bestSpot`.** An area spell (`ground` mode) is aimed at the spot that still covers the hero and catches the most of the enemy's units: the hero's own spot, or a point between the hero and a unit that stays within radius minus 1 of the hero. Radii under 1.5 just take the hero.
6. **Melee steer:** see the table above. A ranged kit also steps away from enemy melee units within 2.4 m so they do not hit for free.
7. **Strafe:** ranged kits hold about 70% of Q's range (35% without line of sight), strafe, and flip direction every 1.5 to 3.5 s.

### Per-cast hit checks (the side-bias fix)

The player's hits on the opponent land only if the opponent is inside that cast's own zones or near where it aimed. The arena numbers every cast context (`arena.castSeq`), a hit carries its cast number to `Duel.opponentHit`, and the duel looks the cast up in `playerCastsRecent` (kept 4.5 s, recorded by `recordPlayerCast`). Each hit is judged against its own cast, so a second spell cast while the first is still landing is not checked against the wrong zones (STATUS.md calls this the duel side-bias fix). A hit with no recorded cast (or a `projectile` hit) lands. Hits from a previous round are ignored (`round` id).

## Testing

### Test spells

Category `test: mechanics`, registered in [spells/targeted/index.ts](../../src/spells/targeted/index.ts), each a small tool with a panel:

| Label | File | What it does |
|---|---|---|
| `status test` | [statusTest.ts](../../src/spells/targeted/statusTest.ts) | 10 damage plus the chosen kind and seconds to everyone inside the zone; the panel shows the caps |
| `shield test` | [shieldTest.ts](../../src/spells/targeted/shieldTest.ts) | `shieldSelf(60, 4)` |
| `heal test` | [healTest.ts](../../src/spells/targeted/healTest.ts) | `healSelf` |
| `dash test` | [dashTest.ts](../../src/spells/targeted/dashTest.ts) | `moveCaster` over a quarter second, 20 damage where it lands |
| `cleave test` | [cleaveTest.ts](../../src/spells/targeted/cleaveTest.ts) | a cone swing, 45 damage, range 3 |
| `bolt test`, `summoner bolt test` | [boltTests.ts](../../src/spells/targeted/boltTests.ts) | plain bolt, 45 damage |
| `split bolt test` | boltTests.ts | splits into 3 over 25 degrees on the first hit (35, then 15 each) |
| `bounce bolt test` | boltTests.ts | bounces twice (30) |
| `pierce bolt test` | boltTests.ts | fast piercing lance (40) |
| `summon melee test`, `summon ranged test`, `turret test` | [summonTests.ts](../../src/spells/targeted/summonTests.ts) | the three unit kinds at the budget in kit-common.md |

### Test kits

[kits/test.ts](../../src/kits/test.ts) holds three hidden kits that are not in `HERO_KITS` (plain steel-grey icons, no model, the capsule stands in), reachable as kit objects on `vfx.testKits`:

| Handle | Kit | Slots (Q W E R) |
|---|---|---|
| `vfx.testKits.melee` | Testwarden (780 HP, melee) | cleave, dash, shield, heal |
| `vfx.testKits.ranged` | Testranger | bolt, split bolt, ricochet, lance (all `aim: 'line'`) |
| `vfx.testKits.summon` | Testsummoner | bolt, guards (melee), turret, archers (ranged) |

Use one with `vfx.heroMode.setKit(vfx.testKits.melee)`; an opponent can be a kit object too (`duel.opponentChoice`). The status test spell has no kit; pick it in the effect dropdown in the arena.

### Duel console recipe

Copied from the comment above `Duel.start()` ([duel.ts](../../src/duel.ts)). N AI fights with kit objects on either side:

```js
const v = vfx, K = v.testKits.melee; let w = 0;
for (let i = 0; i < 10; i++) {
  v.heroMode.setKit(K);               // player side: a kit object (or v.heroPickCtrl.setValue('Lyra') for a hero)
  v.duel.opponentChoice = 'Lyra';     // opponent side: a hero name or a kit object
  v.duel.start('run');                // not v.setDuel(): it overwrites opponentChoice with the panel's string
  while (!v.duel.result) v.step(1 / 60);
  w += v.duel.result.winner === K.name;
}
```

`duel.result` has `winner`, `seconds`, both HPs, cast and dodge counts and `units` (the summon stats). A fight stepped inside one browser call blocks the page, so keep a batch short.

### Tournament tool

[pipeline/tools/duel-tourney.js](../../pipeline/tools/duel-tourney.js): paste it into the page (`eval(await (await fetch('/pipeline/tools/duel-tourney.js')).text())`), then `await _tourney(3)` runs every hero in the dropdown against every other, 3 fights per ordered pairing, or `_tourney(3, ['Vesper', 'Kaia'])` for a subset. It returns `wins`, `h2h`, `fights`, `avgSeconds`, `avgWinnerHp` and `timeouts`; a fight over 120 s is a timeout. It steps time itself, so it works with the browser pane hidden. Results vary because the AI's strafe flips are random: judge balance with 5+ fights per pairing. It covers `HERO_KITS` only; use the console recipe for test kits.

## Limits

- **Network duels ignore these mechanics.** `startNet` clears `shieldSelf`, `healSelf`, `moveCaster`, `projectile` and `summon` from the opponent's context, statuses and pulls are not applied, and the server and `src/net/` carry none of it yet (phantom units would appear on the player side). The sync is planned for the multiplayer session; see [multiplayer.md](multiplayer.md).
- **Basic attacks are off in network duels** (see [attacks.md](attacks.md)): the server relays only the four spell slots.
- **Units take no statuses and no pull**. `arena.hit` on a unit does damage, flash and knockback only.
- **Area spells only hit units inside the radius at cast time.** `ground` and `self` targeting builds `ctx.targets` once, so a unit that walks in during the spell is not in the list (a spell that re-checks positions at impact, as the Zone hits rule asks, must use `arena.liveFoes()` to see units that arrived later).
- **`castAs` reuses one instance per label.** The duel plays an opponent spell on the effect registered under its label, so the two kits in a duel must not share a label, and the opponent casting the same label again while it plays restarts that instance. The player's hero is different: hero mode keeps the old instance playing (in `lingering`) and casts on a fresh one, so a bolt in flight survives a recast.
- **Blind does not move self spells**, and the hero's blind roll is made per cast, not per target.

## See also

- [Architecture overview](overview.md)
- [Targeting and arena](targeting-and-arena.md)
- [Hero mode](hero-mode.md)
- [Multiplayer duel game](multiplayer.md)
- [Effects and shared parts](effects-and-parts.md)
- [Docs home](../README.md)
- [Mechanics plan](../../pipeline/designs/mechanics.md), [Hero kit rules](../../pipeline/designs/kit-common.md)
