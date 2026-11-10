---
title: Mabel, the Deepdelver (mole kit)
tags: [catalog, heroes, mole, assassin, melee, holes, mechanics]
updated: 2026-11-04
---

# Mabel, the Deepdelver

The mole hero kit: Mabel's four spells (Q, W, E and the R ultimate), the passive holes, the shared parts file, the palette row and the rigged hero model. A stout mole-folk miner in dark velvet fur and studded leather armour, with a long muzzle, a bronze helm topped by a glowing amber crystal lantern, and enormous digging claws tipped in gold. She is built on the [combat mechanics](../../architecture/mechanics.md): a melee assassin who digs pits and travels underground.

## Role

| | |
|---|---|
| Role | Assassin (melee) |
| Signature | Dig Site |
| HP | 680 |
| Kit shapes | Q CONE claw · W ZONE hole · E DASH underground · R TARGET sinkhole |

She wins by making the ground dangerous: her holes root and slow whoever walks into them, she can cross the arena underground where nothing can hit her, and her sinkhole roots a whole circle. Her weakness is that her mound shows where she is, she cannot cast underground, and a hole only catches someone who walks in.

## At a glance

| | |
|---|---|
| Hero | Mabel, the Deepdelver |
| Spell category | `hero: mole` |
| Parts file | [`src/effects/parts/mole.ts`](../../../src/effects/parts/mole.ts) |
| Kit data | [`src/kits/mole.ts`](../../../src/kits/mole.ts) |
| Trait | [`src/traits/mole.ts`](../../../src/traits/mole.ts) |
| Kit sheet | [`kit-mole.md`](../../../pipeline/designs/kit-mole.md) |
| Model | [`public/models/heroes/mole_v3.glb`](../../../public/models/heroes/mole_v3.glb) |

## Palette

A cheerful miner's palette of warm soil browns with a dark layer under everything and a pale gold foil (her helmet lamp, a pickaxe's edge, a pebble of gold in the dirt). Constants `MOLE` and `MOLE_CSS` in the parts file.

| Accent | Foil (gold) | Soil | Dirt | Dark | Deep | Light | Hot | Steel |
|---|---|---|---|---|---|---|---|---|
| `#8a6a4a` | `#ffcf5a` | `#a98258` | `#6b4e33` | `#2b1d12` | `#120b06` | `#d9b98a` | `#fff0c0` | `#9aa3ad` |

## Signature shape and material rules

The dark round pit with its raised rim of dirt, and three gold claw strokes. A hole is seen from above as a dark pit with a raised rim of dirt and a lit crescent.

- Every part is small and pooled. Dust puffs are ragged billboards that grow, rise and erode away (never smooth opaque spheres); clods are chunky lumps with a dark outline hull and a few flecks of gold.
- The holes are the trait's `marks`, drawn with `pitLook`.

## Passive and twist

| | |
|---|---|
| Passive | Dig Site. Holes she digs last 8 s (3 at most). Anyone who walks in falls: rooted 0.8 s, then slowed while they climb out. She walks across hers. |
| Twist | Down and Up. Underground she is safe, but she can only come up once, and her mound shows where. She cannot cast down there. |
| Meter | HOLES, max 3. |
| Speed | 4.3 m/s. |
| Basic attack | Melee, range 2.2, damage 18, every 0.9 s, wind-up 0.25 s, look `claw`. |
| Hooks | `marks` and `markLook` (the holes), `victimTick` (falling in), `tick` and `afterCast` (the dive), `figureHidden` (her figure is not drawn underground), `canCast`, `aiHold`, `badge`. |

- The fall happens once per visit: the enemy must leave before the hole can take them again. A hole that opens under a hero gives them the Dig telegraph (0.7 s) first, and then the same rule. The slow after the root is 0.75 (`FALL_SLOW`).
- Mole Run seals her for 1.2 s (`sealed`: every hit on her is swallowed and she cannot cast or attack); the slide that moves her still works. She is immune to stuns for 0.5 s after.
- The CPU casts W when the enemy is within 6 m and no hole is within 2 m of them, E when they are 3 to 9 m away and R within 9 m.

## Mechanics

Mabel uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 680` in the kit data. Her Q range is 2.5 |
| Dash | E tunnels up to 7.2 m in 1.2 s (`ctx.moveCaster`), 40% faster than her walk of 4.3 m/s |
| Hidden figure and seal | E: `figureHidden` hides her figure, the `sealed` status makes her untouchable and uncastable |
| Ground marks | the holes (3 at most, 8 s) |
| Root and slow | a hole roots 0.8 s then slows; the sinkhole roots 1 s |
| Knock-up | E: 0.5 s |
| Sight | R needs sight at the cast |
| Projectile, summon, heal, pull | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/mole.ts`), numbers from `src/traits/mole.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [mole claw](../../../src/spells/targeted/moleClaw.ts) | self CONE (2.5 m, 120 degrees) | 2.5 | 3 s | 0.4 s | 1.3 s | She digs in her heels (puffs of dirt, her lamp flickers up) and rakes her claws across the cone: three gold strokes sweep over the ground on dark ones, clods fly out and a little pale star pops. Damage 68. |
| W | [mole dig](../../../src/spells/targeted/moleDig.ts) | ground ZONE (hole r 1.5) | 6 | 7 s | 0.7 s | 1.6 s | A tiny pickaxe pops up at the spot and taps three times (0.15, 0.35, 0.55 s), each tap flinging clods and running a crack out. At 0.7 s the ground gives way and a hole of radius 1.5 m opens, a dark pit with a raised rim, standing 8 s. A fourth hole closes the oldest. She is rooted until it opens. No damage; falling in roots 0.8 s, then slows. |
| E | [mole tunnel](../../../src/spells/targeted/moleTunnel.ts) | ground DASH (up to 7.2 m, at least 2 m; exit r 1.5) | 7.2 | 10 s | 1.5 s (she pops up) | about 2.6 s | She crouches (0.3 s), a pit opens under her and she drops in. Underground for 1.2 s she moves toward the aim, fastest at the start. A big mound with a gold ring and a glowing lamp moves over the surface with a furrow behind it. At 1.5 s she bursts out: everyone within 1.5 m of the exit is hit and knocked up 0.5 s. Damage 60. |
| R | [sinkhole](../../../src/spells/targeted/sinkhole.ts) | enemy (needs sight), pit r 4 | 9 | 24 s | 1.3 s | 3.0 s | The circle is fixed where the enemy stood. For 1.3 s the ground shudders: she taps her pickaxe, tremor rings run out from the centre (0.15, 0.5, 0.85 s), cracks run to the rim and the ground darkens. At 1.3 s it drops: a pit of the full 4 m opens, clods fly and one short impact frame. Everyone inside is hit and rooted 1 s. The pit stays a second, then crumbles shut. Damage 115. |

Spell sources: [`moleClaw.ts`](../../../src/spells/targeted/moleClaw.ts), [`moleDig.ts`](../../../src/spells/targeted/moleDig.ts), [`moleTunnel.ts`](../../../src/spells/targeted/moleTunnel.ts), [`sinkhole.ts`](../../../src/spells/targeted/sinkhole.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-mole).

The headers of `moleClaw.ts`, `moleTunnel.ts` and `sinkhole.ts` still say 45, 40 and 90 damage; the numbers above are the constants in `src/traits/mole.ts` (`CLAW_DAMAGE` 68, `TUNNEL_DAMAGE` 60, `SINK_DAMAGE` 115).

## Parts file

[`src/effects/parts/mole.ts`](../../../src/effects/parts/mole.ts) holds everything the spells share. Everything is small and pooled.

| Export | Role |
|---|---|
| `MOLE`, `MOLE_CSS` | palette constants |
| `Clods` | chunky flying lumps of earth that fall, bounce once, rest and shrink |
| `Puffs` | ragged billboard dust puffs |
| `Mound`, `Furrow` | the moving mound that shows where she is underground and the torn strip behind it |
| `buildPit`, `pitLook` | a hole seen from above: the ground mark for her holes and the sinkhole pit |
| `LampGlow` | her helmet lamp glow |
| `Pickaxe` | the tiny pickaxe |
| `GroundRing` | a tremor ring running out over the ground |
| `ClawArcs` | the gold claw strokes |
| `Cracks` | cracks running over the ground |
| `turnY` | a small rotation helper |

## Model

[`public/models/heroes/mole_v3.glb`](../../../public/models/heroes/mole_v3.glb): a rigged figure built by the `MoleMythic` class in [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Mabel`); hero body size is radius 0.5, height 2.33 in `HERO_BODIES`. Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: stout and short in dark velvety fur, a long muzzle with a small dusky-rose nose, small calm black eyes, no neck. A studded dark leather cuirass and skirt with a gold-buckled belt, leather straps over the shoulders, gold-banded bracers and greaves, dark leather boots, a close bronze helm with a gold ridge and brass goggles pushed up on its brow. Signature: enormous spade paws with five long pale claws each, every one tipped in gold, a glowing amber crystal lantern in a gold cage on top of the helm, and a pick slung across her back.
- HUD portrait (canvas-drawn in the kit data): a soil bank behind her with a dug-out tunnel mouth, a stout dark-furred frame in a studded leather cuirass, a long muzzle with a small rose nose and calm black eyes, a bronze helm with a gold band and brass goggles pushed up, a glowing amber crystal lantern on top, the slung pick behind her shoulder, and huge gold-tipped claws at the edges of the frame.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-mole.md`](../../../pipeline/designs/kit-mole.md) |
| Parts | [`src/effects/parts/mole.ts`](../../../src/effects/parts/mole.ts) |
| Spells | [`moleClaw.ts`](../../../src/spells/targeted/moleClaw.ts), [`moleDig.ts`](../../../src/spells/targeted/moleDig.ts), [`moleTunnel.ts`](../../../src/spells/targeted/moleTunnel.ts), [`sinkhole.ts`](../../../src/spells/targeted/sinkhole.ts) |
| Kit data | [`src/kits/mole.ts`](../../../src/kits/mole.ts) |
| Trait | [`src/traits/mole.ts`](../../../src/traits/mole.ts) |
| Model | [`public/models/heroes/mole_v3.glb`](../../../public/models/heroes/mole_v3.glb) |
| Model script | [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py) (the `_v3` class), [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the old class and the build kit) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Gus (janitor)](janitor.md), [Pip (courier)](courier.md), [Wick (door)](door.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
