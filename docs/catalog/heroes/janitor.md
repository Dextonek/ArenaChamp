---
title: Gus, the Caretaker (janitor kit)
tags: [catalog, heroes, janitor, controller, melee, wet floor, mechanics]
updated: 2026-11-04
---

# Gus, the Caretaker

The janitor hero kit: Gus's four spells (Q, W, E and the R ultimate), the passive wet floor, the shared parts file, the palette row and the rigged hero model. A stocky, tired caretaker in baggy grey overalls and a cap with a squeaky mop, a yellow wheeled bucket and a drooping moustache. He is built on the [combat mechanics](../../architecture/mechanics.md): a melee controller whose floor stays wet, so the enemy slides on it.

## Role

| | |
|---|---|
| Role | Controller (melee) |
| Signature | Wet Floor |
| HP | 700 |
| Kit shapes | Q CONE mop swipe + wet strip · W WALL sign (two charges) · E LINE thrown bucket + wet splash · R AURA flood |

He wins by deciding where the enemy slides: wet floor makes them keep going the way they were going and turn half as fast, and a slide into his sign hurts. His weakness is that the wet shows and a slide is fast, so the enemy can use it too, and he must stay close.

## At a glance

| | |
|---|---|
| Hero | Gus, the Caretaker |
| Spell category | `hero: janitor` |
| Parts file | [`src/effects/parts/janitor.ts`](../../../src/effects/parts/janitor.ts) |
| Kit data | [`src/kits/janitor.ts`](../../../src/kits/janitor.ts) |
| Trait | [`src/traits/janitor.ts`](../../../src/traits/janitor.ts) |
| Kit sheet | [`kit-janitor.md`](../../../pipeline/designs/kit-janitor.md) |
| Model | [`public/models/heroes/janitor_v2.glb`](../../../public/models/heroes/janitor_v2.glb) |

## Palette

Soapy blue water, white foam, safety yellow, rubber black and grey overalls. Kept under about 0.92 per channel, because the bloom turns brighter areas into a halo. Constants `JANITOR` and `JANITOR_CSS` in the parts file; the kit accent is the yellow and the foil the deep blue.

| Core | Foam | Pale | Water | Water deep | Yellow (accent) | Yellow deep | Grey | Rubber | Dark |
|---|---|---|---|---|---|---|---|---|---|
| `#f2f6f8` | `#e4f1f6` | `#c4e4f2` | `#74c0ea` | `#3a6a8a` | `#ffd23a` | `#d9a514` | `#8a929a` | `#23282e` | `#15202a` |

Also deep `#2a4a62`, grey dark `#4a5058`, steel `#b4bcc4`, bucket `#4f86a8`, wood `#a4906a` and string `#d8d6c8`. The kit foil is `#3a6a8a`.

## Signature shape and material rules

The mop with its strings, the yellow A-frame sign, the wheeled bucket, and a wet floor with a shine across it. A wet patch is shining and reflective, pale blue, with a layer of dark blue under it and a pale rim, so it reads as water on the floor and never as a red telegraph.

- Everything is pooled or built once, takes world-space positions and has `reset()`.
- The wet floor is the trait's `marks`, drawn with `wetLook` in three kinds (strip, splash, flood).

## Passive and twist

| | |
|---|---|
| Passive | Wet Floor. What he mops stays wet and shining for 6 s. On it you keep sliding the way you were going and turn half as fast; he never slides. His mop wipes your rods, flowers and ink along its strip. Slide into his sign at speed: 40 and a 0.6 s stun. |
| Twist | Where to Mop. Mop in your way, or where he wants you to end. The wet shows, and a slide is fast, so you can use it too: slide on purpose, or walk round the shine. |
| Speed | 3.9 m/s. |
| Basic attack | Melee, range 2.8, damage 20, every 1.3 s, wind-up 0.35 s, look `sweep`. |
| Charges | W has 2 charges, one back every 8 s; its cooldown is a 0.8 s gap. |
| Hooks | `victimTick` (the slide), `marks` and `markLook` (the wet), `ring` (the surf), `castMods` (Q hits for 60 while he surfs), `afterCast` and `tick` (the surf), `landed`, `peerNote`, `ownChanged`, `aiHold`, `aiGoal`, `badge`. |

- The slide: while the floor under the enemy is wet, a momentum follows their own step at a rate of 4 (cap 6). The difference is carried with `carryEnemy`, so a hero pressing steadily is not faster, only slower to turn and stop; cover still stops them.
- A sign hit needs a slide speed toward the sign of 2.5 m/s or more: walking on dry floor never hurts.
- The wet is written on both screens at the moment a spell lands and lasts 6 s (the flood disc 5 s).
- Flood: 1 s later the surf starts for 5 s: haste 35% for him, and his Q deals 60 instead of 45 in the header (the code constant is 60).

## Mechanics

Gus uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 700` in the kit data. His Q range is 3.5 |
| Obstacle and summon | W is a real obstacle (`ctx.addObstacle`, a wall 0.9 m wide) with a summoned 'turret' unit holding 40 HP; when it dies by damage the sign bursts |
| Charges | W has 2 charges (see the passive) |
| Projectile | E is a real bolt (`ctx.projectile`): 8 m, 16 m/s, radius 0.4 |
| Enemy carry | the slide moves the enemy with `carryEnemy` in `victimTick` |
| Ground wipe | Q wipes the enemy's rods, flowers and ink along its strip (`wipeGround`) |
| Stun | the sign: 0.6 s |
| Haste | R: 35% for 5 s |
| Dash, pull, silence, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/janitor.ts`), numbers from `src/traits/janitor.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [big mop](../../../src/spells/targeted/bigMop.ts) | self CONE (3.5 m, 140 degrees) | 3.5 | 3.5 s | 0.3 s | 2.0 s | He draws the mop back (it squeaks) and swings it across the cone, its strings dragging a fan of foamy water along the floor. It leaves a strip of wet floor 6 m long and 2 m wide straight ahead, wet for 6 s, and wipes the enemy's rods, flowers and ink along the strip. Damage 60. |
| W | [wet floor sign](../../../src/spells/targeted/wetFloorSign.ts) | ground WALL (a sign 0.9 m wide) | 8 | 0.8 s (2 charges) | 0.4 s (it lands) | about 7.4 s | A pale ring marks a spot (at least 1.5 m from him) and a yellow folding A-frame sign tumbles down onto it with a clatter and the words WET FLOOR. It stands 6 s as a real obstacle: blocks walking, sight and bolts for both heroes. It breaks at 40 damage into yellow chips. A hero who slides into it takes 40 and is stunned 0.6 s. |
| E | [mop bucket](../../../src/spells/targeted/mopBucket.ts) | ground LINE (bolt, radius 0.4) | 8 | 10 s | 0.3 s (launch) | about 2.2 s | He swings the bucket up from his side (water slops over the rim) and lets it fly: it tumbles with its wheels spinning and a trail of drops and soap bubbles. It reaches 6 m at 0.65 s. Where it stops it lands with a CLANG, a splash and a ring, and the floor 2.5 m round is wet for 6 s. Damage 55. |
| R | [flood](../../../src/spells/targeted/flood.ts) | self AURA (r 7) | 0 (self) | 24 s | 1.0 s (the wave) | about 7.2 s | He pulls the plug of a pipe somewhere: for a second the floor gurgles with bubbles and rings of water running in (the red telegraph shows the disc), then at 1.0 s a wave bursts out to the edge and a geyser leaps. The whole disc is wet for 5 s. No damage. He surfs on it: +35% speed and his Q hits for 60. The water drains away in a spiral of rings. |

Spell sources: [`bigMop.ts`](../../../src/spells/targeted/bigMop.ts), [`wetFloorSign.ts`](../../../src/spells/targeted/wetFloorSign.ts), [`mopBucket.ts`](../../../src/spells/targeted/mopBucket.ts), [`flood.ts`](../../../src/spells/targeted/flood.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-janitor).

The headers of `bigMop.ts` and `mopBucket.ts` still say 45 and 40 damage; the numbers above are the constants in `src/traits/janitor.ts` (`MOP_DAMAGE` 60, `BUCKET_DAMAGE` 55).

## Parts file

[`src/effects/parts/janitor.ts`](../../../src/effects/parts/janitor.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `JANITOR`, `JANITOR_CSS` | palette constants |
| `wetLook(kind, r)` | a patch of wet floor (`Trait.markLook`): kind `strip`, `splash` or `flood` |
| `buildSign`, `SIGN_WIDTH`, `SIGN_HEIGHT` | the yellow A-frame sign |
| `buildMop` | the mop |
| `buildBucket` | the wheeled bucket |
| `Ripples`, `Drops`, `Bubbles` | pooled water rings, drops and soap bubbles |
| `Words` | pooled words (SQUEAK, CLANG, GLUG, WET FLOOR) |
| `SwipeFan` | the fan of foamy water a mop swing drags |

## Model

[`public/models/heroes/janitor_v2.glb`](../../../public/models/heroes/janitor_v2.glb): a rigged figure built by the `Janitor` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Gus`); hero body size is radius 0.55, height 2.39 in `HERO_BODIES`.

- Look: stocky and tired. Baggy grey overalls over a blue shirt, a cap, yellow rubber gloves, heavy-lidded eyes with bags under them, a big nose over a drooping walrus moustache and a brass keyring at the hip. A mop as tall as a spear in the right hand, and a yellow bucket on wheels hung from the left hand by its bail.
- HUD portrait (canvas-drawn in the kit data): a deep blue ground with a wet floor under him and a few bubbles, the mop leaning behind his shoulder, grey overalls with a yellow strap and a bunch of keys, a broad tired face with bags under heavy-lidded eyes, a red nose and a grey drooping moustache, and a flat grey cap with a yellow badge.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-janitor.md`](../../../pipeline/designs/kit-janitor.md) |
| Parts | [`src/effects/parts/janitor.ts`](../../../src/effects/parts/janitor.ts) |
| Spells | [`bigMop.ts`](../../../src/spells/targeted/bigMop.ts), [`wetFloorSign.ts`](../../../src/spells/targeted/wetFloorSign.ts), [`mopBucket.ts`](../../../src/spells/targeted/mopBucket.ts), [`flood.ts`](../../../src/spells/targeted/flood.ts) |
| Kit data | [`src/kits/janitor.ts`](../../../src/kits/janitor.ts) |
| Trait | [`src/traits/janitor.ts`](../../../src/traits/janitor.ts) |
| Model | [`public/models/heroes/janitor_v2.glb`](../../../public/models/heroes/janitor_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Madame Cleaver (chef)](chef.md), [Mabel (mole)](mole.md), [Bram (mason)](mason.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
