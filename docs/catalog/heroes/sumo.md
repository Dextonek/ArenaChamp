---
title: Big Yoko, the Sumo (sumo kit)
tags: [catalog, heroes, sumo, tank, melee, push, mechanics]
updated: 2026-11-04
---

# Big Yoko, the Sumo

The sumo hero kit: Big Yoko's four spells (Q, W, E and the R ultimate), the passive ring, the shared parts file, the palette row and the rigged hero model. A giant in a red belt with a topknot and a calm face, huge bare arms and bare feet, by far the widest hero. He is built on the [combat mechanics](../../architecture/mechanics.md): a melee tank who pushes, a straw-rope ring on the floor and a push that takes you out of it.

## Role

| | |
|---|---|
| Role | Tank (melee) |
| Signature | The ring (Dohyo) |
| HP | 840 |
| Kit shapes | Q LINE push · W AURA stamps the ring · E DASH carries · R CONE blind |

He wins by stamping the ring with Stomp and then shoving the enemy out of it with Palm Strike or Charge. His weakness is speed: he walks at 3.6 m/s and the enemy at 4, so a hero who walks out of the ring before he finishes it is safe.

## At a glance

| | |
|---|---|
| Hero | Big Yoko, the Sumo |
| Spell category | `hero: sumo` |
| Parts file | [`src/effects/parts/sumo.ts`](../../../src/effects/parts/sumo.ts) |
| Kit data | [`src/kits/sumo.ts`](../../../src/kits/sumo.ts) |
| Trait | [`src/traits/sumo.ts`](../../../src/traits/sumo.ts) |
| Kit sheet | [`kit-sumo.md`](../../../pipeline/designs/kit-sumo.md) |
| Model | [`public/models/heroes/sumo_v2.glb`](../../../public/models/heroes/sumo_v2.glb) |

## Palette

Straw rope and raked sand, a red belt, warm skin, white salt and pale dust. Constants `SUMO` and `SUMO_CSS` in the parts file; the kit accent is the red, the foil the pale core.

| Core | Hot | Body (accent) | Shade | Rope | Sand | Dark |
|---|---|---|---|---|---|---|
| `#f4ead0` | `#fff8ea` | `#e63a3a` | `#a42626` | `#d2ac5a` | `#dcc58f` | `#1e1412` |

Skin is `#e6b08a` (shade `#b97a56`), dust `#cdbb98`, rope dark `#8a6a2c`.

## Signature shape and material rules

The straw-rope ring seen from the side, with a pale line inside it. The ring on the floor has a straw rope twisted round it, a pale line inside and a red outer band. Salt is small white crystals; dust is pale clouds.

- Everything is unlit or built once and pooled, takes world-space positions and stays under the bloom threshold (no colour above 0.92).
- The ring is drawn by the trait (`marks` and `markLook`), not by a spell: it comes in three sizes (radius 5, 3 and 1), each its own ground look, so the drawn edge is the real one.

## Passive and twist

| | |
|---|---|
| Passive | Dohyo. His Stomp stamps a straw-rope ring on the floor, 5 m in radius, for 8 s. A push of his that carries you from inside it to outside is a ring-out: +80 damage and stunned 0.5 s. Salt Throw shrinks it by 2 m. |
| Twist | The Edge. The push counts only when it crosses the rope. Stand out of the ring, or fight in the middle and walk away before he gets behind you. |
| Meter | RING, max 8: the seconds the ring has left (0 with none). |
| Speed | 3.6 m/s. |
| Basic attack | Melee, range 2.4, damage 20, every 1.2 s, wind-up 0.35 s, look `smash`. |
| Hooks | `marks` and `markLook` (the ring), `victimTick` (decides the ring-out and makes the bonus hit), `enemyLabel` (the word RING OUT over the enemy for 1.4 s), `afterCast`, `tick` (the haste), `aiGoal`, `aiHold`, `badge`. |

- Only one ring stands. A new Stomp replaces it. The ring's radius can shrink to 1 m at the least (5, 3, 1).
- A ring-out needs a push window: Palm Strike and Charge open it when they carry a body; it closes at the ring-out. The bonus hit is a `trait` hit that none of his hooks answer.
- The haste (30% for 4 s) comes from `tick`, 0.6 s after the Salt Throw cast.
- The CPU walks to the far side of the enemy from the rope, casts Stomp when there is no ring (or the enemy is outside it and within 3 m) and holds Salt Throw until the enemy is within 6 m.

## Mechanics

Big Yoko uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 840` in the kit data (the default is 600) |
| Carry (push) | Q shoves 3 m over 0.22 s and E carries the caught body 1.2 m ahead of him, both with `ctx.carry` (`knock: 0`). It moves only the hero that screen decides |
| Dash | E runs 6 m in 0.4 s with `ctx.moveCaster`; a wall or pillar on the path shortens the run |
| Slow | W slows every enemy it hits for 1 s |
| Blind | R blinds every enemy in the cone for 1.5 s, no damage |
| Haste | R gives him 30% haste for 4 s |
| Ground mark | the ring (Stomp writes it; Salt Throw shrinks it) |
| Skillshot, summon, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/sumo.ts`), the numbers from `src/traits/sumo.ts`, hit time and length from the spell files in `src/spells/targeted/`. Q, W and R are self spells that go the way he faces (a range of 0 or 2.8 in the kit); E has a ground aim.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [palm strike](../../../src/spells/targeted/palmStrike.ts) | self LINE (2.8 m by 2 m strip in front of him) | 2.8 | 3 s | 0.4 s | 1.3 s | A huge open hand fades in beside him and is drawn back, growing. At 0.4 s it is thrown forward and everyone inside the strip is hit and shoved 3 m along his facing over 0.22 s. Pale star, ground ripple, refraction ring, dust and a hard shake. Opens the push window. Damage 54, push 3 m. |
| W | [stomp](../../../src/spells/targeted/stomp.ts) | self AURA (r 3) | 0 (self) | 11 s | 0.5 s | 1.7 s | A 3 m circle shows round him and closes in while dust puffs lift off the floor. At 0.5 s his foot comes down: everyone inside is hit and slowed, seven cracks with red light run out, a dust ring rolls out and the floor shakes. Then the ring is stamped: a red and a pale ripple run out to 5 m and the straw ring takes the floor for 8 s. Cracks close from 1.1 s. Damage 50, slow 1 s. |
| E | [sumo charge](../../../src/spells/targeted/sumoCharge.ts) | ground LINE (6 m run, 2 m strip) | 6 | 10 s | 0.4 s (run starts) | 2.0 s | He drops low with dust scraping behind him, then at 0.4 s runs 6 m down the aim in 0.4 s. The first enemy the strip sweeps over (nearest first) is caught and carried 1.2 m ahead of him until he stops. Pale star at the catch, ripple and hard shake at the end. Nobody in the strip: he just runs. Opens the push window. Damage 40. |
| R | [salt throw](../../../src/spells/targeted/saltThrow.ts) | self CONE (6 m, 70 degrees) | 0 (self) | 22 s | 0.6 s | 1.8 s | He raises a fistful of salt and keeps still. At 0.28 s 140 white crystals fly out in a fan and land across the cone between 0.55 s and 0.9 s, where they glitter and shrink away. At 0.6 s everyone in the cone is blinded 1.5 s (no damage), with a pale star, one short impact frame and a pale sheet over the cone. If his ring stands it loses 2 m of radius, hit or not. 30% haste for 4 s. |

Spell sources: [`palmStrike.ts`](../../../src/spells/targeted/palmStrike.ts), [`stomp.ts`](../../../src/spells/targeted/stomp.ts), [`sumoCharge.ts`](../../../src/spells/targeted/sumoCharge.ts), [`saltThrow.ts`](../../../src/spells/targeted/saltThrow.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-sumo).

## Parts file

[`src/effects/parts/sumo.ts`](../../../src/effects/parts/sumo.ts) holds everything the four spells share. Everything is pooled or built once, takes world-space positions and has `reset()` where it holds state.

| Export | Role |
|---|---|
| `SUMO`, `SUMO_CSS` | palette constants |
| `dohyoLook(radius)` | the ring on the floor (the look of `Trait.markLook`): straw rope, pale line, red outer band |
| `Puffs` | pooled dust clouds |
| `Cracks` | jagged cracks that run out across the floor with red light in them |
| `SaltGrains` | pooled white crystals thrown in an arc that lie on the floor and glitter |
| `Palm` | a big open hand |
| `Ripple` | a flat ring that runs out over the floor |

## Model

[`public/models/heroes/sumo_v2.glb`](../../../public/models/heroes/sumo_v2.glb): a rigged figure built by the `Sumo` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Big Yoko`); hero body size is radius 0.76, height 2.6 in `HERO_BODIES`.

- Look: a massive pear of a body with huge arms held out from it and a small calm head on top, eyes peacefully closed, a black topknot. A red belt with a cream rope, cream tassels in front and a big red knot on his back; bare feet with toes.
- HUD portrait (canvas-drawn in the kit data): a dark warm brown ground with a straw-rope ring behind him, bare round shoulders and a red belt, a round calm face with half-closed eyes, a small straight mouth and a topknot, and a few salt crystals in the air.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-sumo.md`](../../../pipeline/designs/kit-sumo.md) |
| Parts | [`src/effects/parts/sumo.ts`](../../../src/effects/parts/sumo.ts) |
| Spells | [`palmStrike.ts`](../../../src/spells/targeted/palmStrike.ts), [`stomp.ts`](../../../src/spells/targeted/stomp.ts), [`sumoCharge.ts`](../../../src/spells/targeted/sumoCharge.ts), [`saltThrow.ts`](../../../src/spells/targeted/saltThrow.ts) |
| Kit data | [`src/kits/sumo.ts`](../../../src/kits/sumo.ts) |
| Trait | [`src/traits/sumo.ts`](../../../src/traits/sumo.ts) |
| Model | [`public/models/heroes/sumo_v2.glb`](../../../public/models/heroes/sumo_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mum (mime)](mime.md), [Referee Whistler (referee)](referee.md), [Oblivion (void)](void.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
