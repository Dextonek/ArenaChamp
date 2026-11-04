---
title: Zephyr, the Wind Blade (sky kit)
tags: [catalog, heroes, sky, melee, dash, mechanics]
updated: 2026-11-04
---

# Zephyr, the Wind Blade

The sky hero kit (kits v5): Zephyr's four spells (Q, W, E and the R ultimate), his passive, the shared parts file, the palette row and the rigged hero model. A lean, quick fighter in a short teal coat with a very long jade scarf and a curved blade. He is built on the [combat mechanics](../../architecture/mechanics.md): a melee assassin who dashes, banks Gusts and spends them.

## Role

| | |
|---|---|
| Role | Assassin (melee) |
| Signature | Following Wind |
| HP | 620 |
| Kit shapes | Q CONE + recast dash-slash · W DASH leap, knock-up · E DASH step, 2 charges · R targeted cuts from every side |

He wins a 1v1 by dashing: every dash gives a Gust and resets his basic attack, and a Gust makes the next attack hit harder and reach farther. His weakness is low HP for a melee hero. He has to come to you, and once his dashes are spent he has no way out. Walk speed 4.6 m/s.

## At a glance

| | |
|---|---|
| Hero | Zephyr, the Wind Blade |
| Spell category | `hero: sky` |
| Parts file | [`src/effects/parts/sky.ts`](../../../src/effects/parts/sky.ts) |
| Kit data | [`src/kits/sky.ts`](../../../src/kits/sky.ts) |
| Trait data | [`src/traits/sky.ts`](../../../src/traits/sky.ts) |
| Kit sheet | [`kit-sky.md`](../../../pipeline/designs/kit-sky.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/sky_v2.glb`](../../../public/models/heroes/sky_v2.glb) |

## Palette

The art bible row "Sky" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#ffffff` | `#e6fff6` | `#7fe6c8` | `#ff8fb0` | `#0d2a2a` | cloud `#eef3f6` |

Core is only tiny highlights; hot is the leading edge of a crescent; body is the mint wind; accent (blossom pink) only 2-3 frames at hits and on a few leaves; dark is the inner edge of a crescent and the storm-teal sky; the cloud foil is the speed lines and the pale side of the leaves.

## Signature shape and material rules

The wind crescent. Wind is drawn as sharp, pale sickle crescents with a hot leading edge and a thin dark inner edge, joined by thin spiral gust ribbons and a few blown leaves. Every spell is a blade of wind: a swing, a rush, a whirl, a cyclone of blades. Not smoke, not cloud puffs and not the storm kit's lightning (Kaia): flat, hard-edged cut-outs and fine lines.

- Crescents: flat, unlit, needle tips; the sweep-on shows the hot edge first.
- Gust ribbons: thin translucent bands with a hot centre line and a faint dark rim.
- Leaves: small two-tone teardrops, a handful per hit, tumbling in the wind.

## Passive and twist

| | |
|---|---|
| Passive | **Following Wind**: every dash gives him a Gust (3 at most, 4 s, shown as pips round him) and resets his basic attack. His basic attack spends a Gust for +20 damage and 1 m more reach. Sky Rend spends all his Gusts for 2 more cuts each. |
| Twist | none (the trait has no `twist` entry) |
| Resource or meter | meter `GUSTS` (max 3). Gusts show as gem pips round him and Feather Step's charges as flake pips, on both screens |
| Walk speed | 4.6 m/s |
| Basic attack | melee, 2.4 m, 7 per 0.9 s, wind-up 0.22 s, sweep look. With a Gust banked it reaches 1 m farther and the attack spends the Gust for +20 damage |

Other trait rules (`src/traits/sky.ts`):

- Dashes are Crosswind's recast, Skyward and Feather Step. Each refreshes the 4 s timer. Skyward's attack reset comes at touchdown; the others reset at the cast.
- Feather Step has 2 charges, one back every 7 s (`charges`).
- Crosswind has a recast, "Dash-slash", for 2 s after the cast, at 2/3 of the damage.
- Untouchable windows: Skyward for 0.6 s from the cast; Sky Rend only while the cuts run (from 0.8 s after the cast to the last cut, plus 0.15 s). A fizzled Sky Rend cancels it. Feather Step has none.
- Sky Rend holds him still through the wind-up and the cuts, and he cannot cast for 0.6 s after he is out.

## Mechanics

Zephyr uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 620` in the kit data. The duel AI walks up to about 2 m and keeps chasing |
| Dash | Q recast (3 m), W (leap up to 5 m), E (4 m, 2 charges); all give a Gust and reset the basic attack. Kit flags: W `dash` `cc`, E `dash` `parry` |
| Knock-up | Skyward, 0.5 s |
| Untouchable | Skyward 0.6 s, Sky Rend during the cuts |
| Charges | Feather Step, 2 charges, 7 s each |
| Recast | Crosswind, "Dash-slash", 2 s window |
| Hold | Sky Rend: wind-up and cuts |
| Skillshot, summon, shield, pull | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/sky.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [crosswind](../../../src/spells/targeted/crosswind.ts) | enemies in a cone (110 degrees, radius 3, up to 10 targets) | 3 | 4 s | 0.25 s (dash-slash 0.13 s) | 1.2 s | A cross-cut of wind in front of him. Damage 34. Press Q again within 2 s for a 3 m dash-slash through the aim (a 1.8 m wide strip, 0.18 s run): 23 damage, and the dash gives a Gust. |
| W | [skyward](../../../src/spells/targeted/skyward.ts) | ground (r 1.4 landing circle) | 5 | 8 s | 0.6 s (lands) | 2.0 s | He leaps into the air (take-off 0.14 s), untouchable for 0.6 s, and comes down on the spot. The landing circle shows from take-off. Damage 34 within 1.4 m and a 0.5 s knock-up. The dash gives a Gust and resets his basic attack when he lands. |
| E | [feather step](../../../src/spells/targeted/featherStep.ts) | ground (aim line, dash) | 4 | 7 s per charge | 0.2 s (the slide) | 1.0 s | A quick step in any direction, 2 m at least and 4 m at most, with jade afterimages. No damage, not untouchable. Two charges, one back every 7 s. It gives a Gust and resets his basic attack. |
| R | [sky rend](../../../src/spells/targeted/skyRend.ts) | enemy (click), sight checked | 7 | 24 s | first cut 0.85 s, then one every 0.16 s | 2.2 to 3.1 s | He marks the enemy (a red circle) and stands for 0.8 s. If he still sees them within 9 m, he vanishes and strikers cut from every side: 3 cuts plus 2 per Gust spent (9 at most), 22 damage each. He ends behind them. If the wind-up fails (cover, or too far) it fizzles at 1.3 s and he is free. |

Spell sources: [`crosswind.ts`](../../../src/spells/targeted/crosswind.ts), [`skyward.ts`](../../../src/spells/targeted/skyward.ts), [`featherStep.ts`](../../../src/spells/targeted/featherStep.ts), [`skyRend.ts`](../../../src/spells/targeted/skyRend.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-sky).

## Parts file

[`src/effects/parts/sky.ts`](../../../src/effects/parts/sky.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/sky`). Everything is pooled, takes world-space positions and has a `reset()`; the materials are unlit toon shaders kept below the bloom threshold.

| Export | Role |
|---|---|
| `SKY`, `SKY_CSS` | palette constants (`cloud` is the pale foil) |
| `WindCrescent` | pooled flat sickles: `slash(center, dir, radius, arcDeg, tilt, seconds, opts)` sweeps one on and fades it (`SlashOptions`: `width`, `reverse`, `tone`, `spin`, `rise`, `sweep`); `put(pos, yaw, tilt, radius, arcDeg, ...)` is immediate mode for swarms (call every frame after `update`); `frozen` holds time for a dead beat |
| `GustRibbon` | thin spiral gust band: `spiral(center, radius, height, turns, seconds, width)`, `along(points, width, seconds)`, `setFunction(fn, width, head, tail, time, opacity)`, `hide()` |
| `SpeedLines` | streaks: `burst(pos, dir, count, length)`, `sweep(a, b, count, length, minLife)` |
| `Leaves` | tumbling leaves: `spawn(pos, vel, life, size)`, `blow(pos, dir, count, speed)` |
| `WindWraith` | pooled afterimages of Zephyr, flat jade cut-outs facing the camera that slide along a direction while they fade (Feather Step's ghosts, Sky Rend's strikers): `show(pos, dir, life, size, speed, opacity)`, `update(dt)` |

## Model

[`public/models/heroes/sky_v2.glb`](../../../public/models/heroes/sky_v2.glb): a rigged figure on the Dao rig. Built by `build("sky")` / `export("sky")` in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts). Hit size (`HERO_BODIES`): radius 0.40 m, height 2.37 m.

- Look: lean and quick; a very long jade scarf streaming behind him on a sway chain, a cloth mask over the lower face, white hair swept back like wind, a short teal coat over light leather, wrapped shins and a curved blade in the right hand.
- HUD portrait (canvas-drawn in the kit data): a big pale crescent behind him, a long scarf of wind streaming to the side, and shoulders in mint and white with the scarf round his neck.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-sky.md`](../../../pipeline/designs/kit-sky.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Kits v5 design | [`pipeline/designs/kits-v5.md`](../../../pipeline/designs/kits-v5.md) |
| Parts | [`src/effects/parts/sky.ts`](../../../src/effects/parts/sky.ts) |
| Spells | [`crosswind.ts`](../../../src/spells/targeted/crosswind.ts), [`skyward.ts`](../../../src/spells/targeted/skyward.ts), [`featherStep.ts`](../../../src/spells/targeted/featherStep.ts), [`skyRend.ts`](../../../src/spells/targeted/skyRend.ts) |
| Kit data | [`src/kits/sky.ts`](../../../src/kits/sky.ts) |
| Trait | [`src/traits/sky.ts`](../../../src/traits/sky.ts) |
| Model | [`public/models/heroes/sky_v2.glb`](../../../public/models/heroes/sky_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Marin (tide)](tide.md), [Oblivion (void)](void.md), [Sirix (hive)](hive.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
