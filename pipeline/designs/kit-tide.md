# Tide kit: Marin, the Tide Dancer (v4, 2026-11-03)

Replaces the v3 kit (Tide Whip, Bubble Prison, Undertow Dance, Leviathan's Waltz). Design source: `kits-v4.md`, section
"Marin, the Tide Dancer". Read `kit-common.md` first.

## v5 (2026-11-04)
Design source: `kits-v5.md`, section "Marin". Where this differs from the v4 text below, v5 wins.
- Passive renamed **Turning Tide**. The tide turns every 8 s of round time and **Mist Form flips it** when she reforms. State is
  `epoch` and `base` in `t.mem`, the same on both screens (`ownChanged` for `tideflip`); `ring` keeps `tideOf` up to date on both.
- A ring at her feet (radius 1.6) is always on: pale at High, blue at Low, its arc is the time left to the next turn; during Moon's Pull it
  is blue and shows the moon's time left.
- Wave Disc: 0.3 s wind-up, 20 m/s, radius 0.8, 9 m (reaches 6 m at 0.6 s). Coral Spire rises at 0.9 s; the push or drag happens at the rise.
- Mist Form: untouchable 0.25 s, the dash is 0.25 s, no haste buff.
- Moon's Pull is a 3 s channel (`hold(3)`, a `ChannelBar` empties over it): drag only within 12 m and in sight, 2.4 m/s, 15 a second, crash 85
  at the natural end within 2.5 m. A stun, silence or knock-up ends it.

## Role
**Controller**, 670 HP, ranged attack (wave, range 6.5, 10 damage), walk speed 4.1. One verb: *turn the tide*.
- **Passive Riptide.** The tide turns every 8 s of round time (High first, then Low). At High tide her spells push the
  enemy away; at Low tide they pull it toward her. Shown on the passive slot (badge HIGH, LOW, or LOW x2 during Moon's
  Pull), by a floating word at every turn, and by a ring at her feet while one of her spells plays (foam chevrons march
  outward at High, blue chevrons march inward at Low). No twist: the tide is the whole rule.
- Balance pass 2026-11-03: Q 40 to 55, W 12 to 40, R and E gained damage (tournament was 0 of 24).
- Balance pass 2: Q 55 to 65 and radius 0.55 to 0.8, W 40 to 55, E splash 40 within 3 m, R ticks 20 and crash 80, HP 680.
- Balance pass 3 (71% wins): HP 650, Q 60, R crash 65.
- Balance pass 4 (37.5% over 72 duels, never beating Brannoc): HP 670.
- Balance pass 5, 2026-11-04 (23% over 48 duels, after the CPU learned to walk round cover): Q 60 to 68, W 55 to 62, basic attack 8 to 10.
- Cooldowns are not in the design; chosen here: Q 4 s, W 9 s, E 10 s, R 22 s.

| Key | Spell (label) | Type | Numbers |
|---|---|---|---|
| Q | Wave Disc (`wave disc`) | SHOT, `aim: 'line'` | range 9, 0.3 s wind-up, speed 20, radius 0.8, 68 damage; move 2.5 m (push at High, pull at Low) |
| W | Coral Spire (`coral spire`) | TERRAIN | range 8, rises at 0.9 s, stands 5 s from the rise (pillar r 0.8), hits within 2.5 m for 62; push 3 m (High) or pull 2 m (Low) |
| E | Mist Form (`mist form`) | DASH, `dash` + `parry`, ground, range 6 | untouchable 0.25 s (`MIST_SECONDS`); she flows up to 6 m in 0.25 s (`moveCaster`); the tide flips when she reforms; reform splash 40 within 3 m at the end spot at 0.25 s (telegraph circle plus a live distance check, `projectile: true`) |
| R | Moon's Pull (`moon's pull`) | SELF channel, radius 25 | 3 s (`MOON_SECONDS`, `hold`): enemy within 12 m and in sight dragged 2.4 m/s, stops 1.6 m short; 15 damage a second (5 every third of a second) while the drag holds; Q and W pulls x2 (cap 4 m); 85 tide crash at the natural end on an enemy within 2.5 m (`projectile: true`); a stun, silence or knock-up ends it with no crash |

## How the tide works (`src/traits/tide.ts`)
- `highAt(time)`: `floor(time / 8) % 2 === 0`. The trait's `tick` and `dealt` compute it from round time (`t.time`).
- `tides` (a WeakMap keyed by her figure, like Vesper's `bloodBonds`) holds `{ high, moonLeft, live }`. The effects read it
  through `tideNow(figure)` for their looks. Without a trait (the editor) `live` is false and the wall clock stands in.
- **`dealt` is the one authority for the move** (slots 0 and 1 only). The effects hand the engine the Low-tide shape (a
  `pull` toward the bolt's start or the spire's foot, `knock: 0`); `dealt` flips it to a push at High tide with
  `shapeMove`. A push is a `pull` toward a point `metres + 1` behind the victim, since the engine stops a pull 1 m short
  of its target. Reason: a `knock` moves a foe v / 7 m and the player hero 0.18 m per unit (cap 8), but a `pull` is the
  same metres on both and is synced online. It also means the victim's screen of a network duel, where only `tickClocks`
  runs for her trait, still gets the right tide, because `Duel.resolve` calls `dealt` on both screens.
- Moon's Pull: the effect sets `moonLeft = 4` on play, counts it down and clears it on reset; `dealt` then forces Low and
  doubles the pull. `tick` clears a stale value at the start of a round.
- Mist Form: `afterCast` (slot 2) sets `mem.mistUntil = time + MIST_SECONDS`; `taken` sets `hit.blocked` until then.
  `taken` runs on the victim's own client, which is her client, so it works online.

## Look
Palette `TIDE` (parts/tide.ts): deep teal `dark`, sea-glass `hot`, water `body`, foam `foam`, one coral `accent`.
**High and Low read differently on every spell:** High is pale foam flying outward (white streaks, crown splash,
droplets thrown away from her), Low is blue water drawing inward (blue spiralling streaks, a water tether from her to the
enemy, droplets arcing back to her).

Parts added to `src/effects/parts/tide.ts`: `TideRing` (the chevron ring), `TideCurrent` (instanced outward or inward
streaks), `WaterDisc`, `CoralSpire` (vertex-coloured coral cones, foam collar, sea-glass beads) and `MoonHalo`.

### Q Wave Disc (`waveDisc.ts`)
0-0.3: a disc forms between her hands and spins up, the tide ring shows at her feet. 0.3: it is thrown (`ctx.projectile`).
In flight it sheds drops. Hit: crown, pool, StarBurst, impact frame, shake, ground `ShockRefraction`. High: a bigger crown
and foam thrown away, streaks fly out of the enemy. Low: streaks spiral into the enemy and a water tether from her hand
holds taut while it is drawn in, then unravels from her end. A miss pops into foam where the disc ends. Clean by 2.0.

### W Coral Spire (`coralSpire.ts`)
0-0.65: a pool spreads at the spot, a tide ring (radius 2.5) and current streaks show which way the coral will move
whoever stands there; the telegraph circle (radius 2.5) is the dodge. 0.65: the pillar bursts up (ease-out-back), crown,
StarBurst, ground shock, impact frame, shake 0.4; the hit on whoever is inside, then `addObstacle(pillar, 5)`. It drips
while it stands; in its last 0.9 s the foot flares coral and sheds splinters, then it sinks and the obstacle goes.
Clean by 6.45.

### E Mist Form (`mistForm.ts`)
0-0.12: she dissolves and flows to the aimed spot (up to 6 m, 0.5 s, through the enemy) as a translucent water shell with three ribbons spiralling up round her, a crown at her feet. It
follows her while she runs, with a wake of ripples. At 1.0 s she reforms at the end spot: a 3 m telegraph circle has counted down, then crown, the 40 splash, droplets, StarBurst, shake. Tide: High
shell is pale with outward foam streaks, Low shell is deep blue with inward streaks. Clean by 1.9.

### R Moon's Pull (`moonPull.ts`)
0-0.3: a moon halo rises over her head, the arena dims, a contracting shock ring runs from 12 m into her. 0.3: pulse,
crown, impact frame, the drag begins: inward blue streaks across the whole arena, a ring of inward chevrons at her feet,
a water tether to each enemy. 4.0: the moon sets, the tide lets go in a burst of foam streaks and a crown. Clean by 4.9.

## Duel AI
- Q: a line skillshot used within 9 m. W: a ground spell used within 8 m at the enemy. E: a `dash` + `parry` ground spell. As a parry it is a dodge when a bolt is due or an attack winds up; as a dash it closes gaps beyond Q range, aimed about 1.8 m short of the enemy, so the splash lands.
  R: `self` radius 25 (global), so only the R rule gates it (the enemy under 55% HP or the round 20 s
  old). The AI plays no tide policy: the tide decides what its hits do.

## Online (see `docs/architecture/multiplayer.md#mechanics-online`)
Pulls, skillshots and walls are synced; the victim's client decides the move, and `dealt` gives it the right tide on
both screens (up to the latency at a flip). Moon's Pull: `ctx.carry` moves only this side's own hero, so the drag runs
on the victim's screen where the cast is replayed; on her screen the other hero follows its streamed position. The spire
is built on both screens from `sentFrom` and `point`. The tide ring and the effects' tide look on the victim's screen
use the last tide seen (her first hit refreshes it) until then they fall back to the wall clock.
Heroes do not collide, so she simply flows through the enemy. The replay has no `moveCaster`: the end spot comes from `sentFrom` and `point`.
