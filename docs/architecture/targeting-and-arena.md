---
title: Targeting and arena
tags: [architecture, targeting, arena, telegraph, gameplay]
updated: 2026-10-29
---

# Targeting and arena

How targeted spells find their targets and how the shared playground works: the `CastContext` an effect receives ([targeting.ts](../../src/effects/targeting.ts)), the `Arena` that owns the caster, the enemy pack, HP and hit reactions ([arena.ts](../../src/arena.ts)), the red danger zones ([telegraph.ts](../../src/effects/telegraph.ts)) and the WASD dodge dummy ([player.ts](../../src/player.ts)). Needed by anyone writing a targeted spell or changing how casts, hits or hero mode drive the arena.

## Flow of one cast

1. A module with `targeting` set is selected (or its target changes: a click calls `arena.onPick`, which replays the active effect).
2. `play()` (wrapped by `ensureEffect` in [main.ts](../../src/main.ts)) calls `arena.context(spec)`, hands the result to `effect.cast(ctx)`, then runs the real `play()`.
3. The effect reads targets and positions from `ctx`, calls `ctx.hit(...)` at impact, and optionally `ctx.displace(...)`.

## Targeting ([targeting.ts](../../src/effects/targeting.ts))

### `TargetingSpec` and modes

| `mode` | Meaning | `targets` |
|---|---|---|
| `enemy` | one target | the clicked enemy, else the nearest to the caster (or to the clicked ground spot) |
| `enemies` | several | the shift-clicked ones (if more than one selected, capped by `maxTargets`), else a nearest-neighbour chain from the primary target; `maxTargets` default 5 |
| `ground` | a spot | enemies within `radius` (default 5) of the point; point is the clicked ground spot, else the primary target's feet, else 6 units in front of the caster |
| `self` | centred on the caster | enemies within `radius` (default 5) of the caster |

### `CastContext` (before each `play()`)

| Field | Meaning |
|---|---|
| `caster: Enemy` | the shared caster figure; animate it, never add it to your own group |
| `from` | caster feet position at cast time |
| `aim` | yaw from the caster toward `point` (`atan2(dx, dz)`, same as telegraph `dir`) |
| `targets` | enemies to hit, primary first (chain order for `enemies`); may be empty for `ground` / `self` |
| `targetPos` | feet position of each target at cast time, same order (a snapshot: figures may move during play) |
| `point` | ground aim point with `y = 0` |
| `hit(target, opts?)` | hit reaction: flash, knockback, floating number, HP loss, death at 0 HP. Call once per hit at the impact moment; do not call `setFlash` on arena enemies yourself |
| `displace(target, offset)` | extra offset the arena adds to the enemy's position (lift, pull); reset on every cast |

`HitOptions`: `damage` (default random 10-20), `knock` (speed away from `from`; default 4; 0 = flinch in place), `from` (knockback source; default the caster), `color` (damage number and flash tint).

### Helpers

- `yawTo(a, b)`: yaw on the ground plane, 0 = toward +Z.
- `frameCast(camera, controls, ctx, height = 0)`: side-view camera (via `frameArena`) that keeps caster, every target and the aim point in view; use it as `frameCamera` for targeted effects.

## Arena ([arena.ts](../../src/arena.ts))

`Arena` is the shared playground: ground, the golden `caster`, a pack of clickable enemies ("foes") with HP, the selection and a ground marker. main.ts shows it only while a targeted effect is active or play mode is on.

### Foes

Each foe is an `Enemy` figure plus `home`, `hp` (max 100), `flash`, `knock`, `offset`, `displaced`, `dead` (seconds since death, -1 alive), `spawn`, a selection ring and an HP bar (camera-facing, shown below full HP). Default layout: up to 10 spots (`LAYOUT`); `setCount(n)` clamps to 1..10 and rebuilds (Targets folder "enemies" slider, default 6).

### Selection and picking

- A left click (pointer moved under 5 px, so orbit drags do not count) on a foe selects it; shift-click adds or removes; a click on the ground sets the ground point (shift keeps the selection). Each pick calls `onPick`.
- `pickEnabled` (default true) gates clicks; hero mode turns it off.
- `setTarget(enemy | null)` makes one enemy the only selection; `setGroundPoint(p | null)` aims at a spot and clears the enemy selection. `clearSelection()` clears both. `liveFoes()` returns the living foes with their current positions.
- `aimYaw()`: yaw from the caster to the selected, clicked or nearest target without resetting anything (used by `placeEffect` in main.ts).

### `context(spec)`

Casts from wherever the caster stands (`setHome` there), then either:

- **default (non-persist):** `reset()` everything (full HP, home positions, no knockback) and use all foes as the pool; or
- **`persist = true` (hero mode):** keep HP and deaths, fold each foe's knockback offset into its home so `targetPos` is where it stands now, and use only living foes.

The caster is turned toward the aim point (toward the primary target for `self`).

### Hit, knockback, death

`hit(target, opts)`: no-op on unknown or dead foes. Subtracts damage, sets `flash = 1` with a tint (the hit colour, else warm orange; a tint, not white, because white flashes bloomed figures and swallowed the hit VFX), counts `hits`, adds knockback along the away vector, floats a damage number (40+ is bigger, gold). At 0 HP the foe starts dying and `kills` increments. `update(dt)` integrates knockback with exponential decay (rate 7), decays the flash, and plays the death: topple back over 0.6 s, sink after 0.5 s, hidden after 1.8 s.

### Persist and respawn

`persist` is set by `HeroMode.setEnabled`. In persist mode a dead foe respawns at its `spawn` spot after `respawnAfter` seconds (default 4): full HP, no knockback, removed from the selection. `shuffle()` moves every foe to a random spot (at least 3.2 apart) and updates `home` and `spawn`.

### Caster movement and misc

- `walk(move)`: moves the caster on the ground plane (clamped to +/-55) and turns it to face the movement (used by play mode and hero mode).
- `homeCaster()`: back to `CASTER_POS` `(0, 0, 14)`. `reset()` resets the caster and foes. `setVisible(on)` toggles the group and the damage-number overlay.
- Counters `hits` and `kills` are shown in the stats line; floating damage numbers are DOM elements in a fixed overlay.

## Telegraphs ([telegraph.ts](../../src/effects/telegraph.ts))

Red ground danger zones ("don't stand in the red"). Effects only declare them through `EffectModule.telegraphs(effect)` (read on every play); main.ts draws them with `TelegraphLayer` and tests the dummy.

| Type | Fields |
|---|---|
| `TelegraphShape` | `circle {x, z, radius}`, `ring {x, z, inner, outer}`, `cone {x, z, radius, angle (degrees, full width), dir (yaw)}`, `line {x1, z1, x2, z2, width}` |
| `TelegraphSpec` | `shape`, `start` (zone appears, seconds after `play()`), `impact` (damage lands, countdown full), optional `until` (stays dangerous for lingering ground effects) |

- Direction convention: `dir` is a yaw, 0 toward +Z, pi toward -Z.
- `insideTelegraph(shape, x, z)` is the point-in-shape test.
- `TelegraphLayer` (`group`, `set(specs)` on every play, `update(t)` with seconds since play) fills each zone as a countdown with a bright moving front, flashes on impact and fades. main.ts hides it with the "danger zones" checkbox and gives it the same transform as the effect when `placeEffect` moves one.
- Hero mode uses the telegraphs for timing: the hero is rooted until the latest `impact` among the active zones (default 0.4 s, capped at 2.5 s).

## Player dummy ([player.ts](../../src/player.ts))

`PlayerDummy`: a blue `Enemy` figure moved with WASD / arrows relative to the camera heading (speed 7), toggled by "player dummy (WASD)" in the View folder (off by default; turned off when play mode starts so only one thing walks). `onPlay()` forgets which zones were tested. In `update(dt, effectTime, zones)` each zone is tested at its `impact` and then every 0.5 s while it stays dangerous (`until`): inside gives HIT (red flash, knockback 9, `hits++`); close but outside (within reach + 4) gives DODGED (`dodges++`, only on the first test). Floating HIT / DODGED labels use a DOM overlay.

## See also

- [Architecture overview](overview.md)
- [Effects and shared parts](effects-and-parts.md)
- [Hero mode](hero-mode.md)
- [Models pipeline](models.md)
- [Docs home](../README.md)
- [Targeted spell brief](../TARGETED_SPELL_BRIEF.md), [VFX principles](../VFX_PRINCIPLES.md)
