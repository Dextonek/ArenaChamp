---
title: Madame Cleaver, Arena Chef (chef kit)
tags: [catalog, heroes, chef, support, ranged, dishes, mechanics]
updated: 2026-11-04
---

# Madame Cleaver, Arena Chef

The chef hero kit: Madame Cleaver's four spells (Q, W, E and the R ultimate), the passive dishes, the shared parts file, the palette row and the rigged hero model. A big, proud chef with her chin up, in a white double-breasted jacket and a tall pleated hat, with a huge cleaver in one hand and a copper ladle in the other. She is built on the [combat mechanics](../../architecture/mechanics.md): a ranged support whose spells leave dishes on the floor that whoever walks over them eats.

## Role

| | |
|---|---|
| Role | Support (ranged) |
| Signature | Today's Special |
| HP | 680 |
| Kit shapes | Q LINE cleaver + dish · W ZONE soup + dish · E LOB burnt dish · R WALL banquet table |

She wins by feeding herself: her spells leave dishes (fresh ones give speed, good ones heal), and she can bait the enemy with a burnt one. Her weakness is that a dish is food for either hero: the enemy can eat hers first.

## At a glance

| | |
|---|---|
| Hero | Madame Cleaver, Arena Chef |
| Spell category | `hero: chef` |
| Parts file | [`src/effects/parts/chef.ts`](../../../src/effects/parts/chef.ts) |
| Kit data | [`src/kits/chef.ts`](../../../src/kits/chef.ts) |
| Trait | [`src/traits/chef.ts`](../../../src/traits/chef.ts) |
| Kit sheet | [`kit-chef.md`](../../../pipeline/designs/kit-chef.md) |
| Model | [`public/models/heroes/chef_v2.glb`](../../../public/models/heroes/chef_v2.glb) |

## Palette

Chef's whites (kept under about 0.72, because the bloom turns brighter areas into a halo), tomato red, steel, stock-pot silver, burnt black and a golden "good dish" glow. Constants `CHEF` and `CHEF_CSS` in the parts file; the kit accent is the core and the foil the red.

| Core (accent) | Hot | White | Body (red, foil) | Shade | Tomato | Steel | Gold | Gold deep |
|---|---|---|---|---|---|---|---|---|
| `#f2efe6` | `#d8d4c8` | `#b9b4a8` | `#d84a3a` | `#9a2e26` | `#e8794a` | `#b4bcc4` | `#e0b84a` | `#c98a28` |

Also wood `#8a5a34`, roast `#b87a3c` and leaf `#5f9a3e`.

## Signature shape and material rules

The big cleaver with the hole near its spine. A fresh dish is food you want, a good dish (bigger, golden) is food you want more, and a burnt dish (black, smoking, with a red ember ring) is food you do not want.

- Everything is pooled or built once, takes world-space positions, has `reset()` where it holds state and stays under the bloom threshold (no colour above 0.92).
- Dishes on the floor are the trait's `marks`, drawn with the three dish looks.

## Passive and twist

| | |
|---|---|
| Passive | Today's Special. Her spells leave dishes on the floor (3 at most, 8 s). Whoever walks over one eats it: fresh gives 15% speed for 3 s; from 3 s it is good and also heals 30. Burnt ones are 60 damage and a 0.8 s stun to whoever eats them. |
| Twist | Left Longer. A dish gets better with time, and is worth more to whoever takes it. Eat her food before she does, and walk round the black and smoking ones. |
| Meter | DISHES, max 3: the dishes standing. |
| Speed | 3.9 m/s. |
| Basic attack | Ranged, range 5.5, damage 12, every 0.8 s, wind-up 0.2 s, speed 20, look `orb`. |
| Hooks | `marks` and `markLook` (the dishes), `tick` (her eating), `victimTick` (the enemy's eating), `ownChanged`, `peerNote`, `aiGoal`, `enemyGoal`, `aiHold`, `badge`. |

- A dish does not feed whoever was standing on it as it landed: they must step off and back on. Eating radius 0.9 m.
- A burnt dish does nothing to her. On the enemy it is 60 damage and a 0.8 s stun.
- The enemy's eating is decided on the screen that decides the enemy hero (a `trait` hit: the haste goes through its debuff). If both step on one dish in the same instant either may win; the dish is gone on both screens.
- The table (R) is eaten by standing at it for 1 s (reach 1.8 m).

## Mechanics

Madame Cleaver uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 9 m, 20 m/s, radius 0.3 |
| Ground mark | the dishes, written on both screens as each spell lands |
| Slow | W slows 1.5 s |
| Stun | a burnt dish stuns 0.8 s |
| Haste | a fresh dish gives 15% for 3 s |
| Heal | a good dish heals 30; the table heals her 50 |
| Might | the table gives +25% damage for 5 s |
| Obstacle and summons | R is a real wall (`ctx.addObstacle`) with three summoned 'turret' units, 150 HP together, that block walking, sight and bolts |
| Dash, pull, silence | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/chef.ts`), numbers from `src/traits/chef.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [thrown cleaver](../../../src/spells/targeted/thrownCleaver.ts) | ground LINE (bolt, radius 0.3) | 9 | 3.5 s | 0.25 s (thrown) | about 2.4 s | She swings the cleaver over her shoulder and throws it as a real bolt that tumbles end over end with three pale after-images. It reaches 6 m at 0.55 s. It bites into the floor at the end of the line (9 m, or the first cover), hit or not, and a dish plops out beside it. Damage 66. |
| W | [hot soup](../../../src/spells/targeted/hotSoup.ts) | ground ZONE (r 2.5) | 8 | 9 s | 1.0 s | 3.3 s | A red ring and a shadow mark the spot and a huge steel stock pot drops on it (0.45 s), then rocks harder with steam and red bubbles. At 1.0 s it tips over and the soup runs out into a puddle 2.5 m wide. At 1.3 s a fresh dish plops out in the middle; whoever stood in the puddle must step out and in to eat it. Damage 56, slow 1.5 s. |
| E | [burnt offering](../../../src/spells/targeted/burntOffering.ts) | ground (dish footprint r 0.9) | 8 | 12 s | 0.55 s (lands) | 1.7 s | She spins a blackened plate out of her hand in a high arc (8 m at the most, at least 2 m) with dark smoke and sparks. It lands with a clatter and a red ring and stays 8 s as a burnt dish. It does nothing when it lands. Whoever walks over it eats it: the enemy takes 60 and is stunned 0.8 s; on her it does nothing. |
| R | [dinner is served](../../../src/spells/targeted/dinnerIsServed.ts) | self WALL (8 m table across the aim) | 0 (self) | 24 s | 0.6 s (the table rises) | about 6.9 s | She snaps her fingers and an 8 m banquet table rises in front of her across her aim: a cream cloth, a red runner, a candle at each end and three covered silver plates that bounce into place. It stands 5 s as real cover for both heroes and breaks at 150 damage. Whoever stands at it for 1 s eats the three dishes: +25% damage for 5 s, and for her 50 HP. |

Spell sources: [`thrownCleaver.ts`](../../../src/spells/targeted/thrownCleaver.ts), [`hotSoup.ts`](../../../src/spells/targeted/hotSoup.ts), [`burntOffering.ts`](../../../src/spells/targeted/burntOffering.ts), [`dinnerIsServed.ts`](../../../src/spells/targeted/dinnerIsServed.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-chef).

The headers of `thrownCleaver.ts` and `hotSoup.ts` still say 50 and 40 damage; the numbers above are the constants in `src/traits/chef.ts` (`CLEAVER_DAMAGE` 66, `SOUP_DAMAGE` 56).

## Parts file

[`src/effects/parts/chef.ts`](../../../src/effects/parts/chef.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `CHEF`, `CHEF_CSS` | palette constants |
| `freshDishLook`, `goodDishLook`, `burntDishLook` | the dish on the floor (`Trait.markLook`) |
| `buildBurntPlate` | the blackened plate Burnt Offering throws |
| `buildCleaver` | the big cleaver |
| `buildPot`, `POT_RADIUS`, `POT_HEIGHT` | the stock pot |
| `buildTable`, `TABLE_WIDTH`, `TABLE_TOP` | the long laid table with its cloth and three covered plates |
| `Vapour` | pooled steam and smoke puffs |
| `Chunks` | pooled bits that fly in an arc (soup, crumbs, splinters) |

## Model

[`public/models/heroes/chef_v2.glb`](../../../public/models/heroes/chef_v2.glb): a rigged figure built by the `Chef` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Madame Cleaver`); hero body size is radius 0.58, height 2.63 in `HERO_BODIES`.

- Look: big and proud, chin up. A white double-breasted jacket in mid-value whites with pressed folds, a red neckerchief and apron, a tall pleated chef's hat, a huge cleaver held out in the right hand with its broad blade to the camera and a long copper ladle in the left.
- HUD portrait (canvas-drawn in the kit data): a warm charcoal ground with pale kitchen light, a great steel cleaver raised behind her shoulder, a white double-breasted coat with a red neckerchief, a ladle in her other hand, a round rosy proud face with heavy brows and a small stern mouth, and a tall toque with a red pin.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-chef.md`](../../../pipeline/designs/kit-chef.md) |
| Parts | [`src/effects/parts/chef.ts`](../../../src/effects/parts/chef.ts) |
| Spells | [`thrownCleaver.ts`](../../../src/spells/targeted/thrownCleaver.ts), [`hotSoup.ts`](../../../src/spells/targeted/hotSoup.ts), [`burntOffering.ts`](../../../src/spells/targeted/burntOffering.ts), [`dinnerIsServed.ts`](../../../src/spells/targeted/dinnerIsServed.ts) |
| Kit data | [`src/kits/chef.ts`](../../../src/kits/chef.ts) |
| Trait | [`src/traits/chef.ts`](../../../src/traits/chef.ts) |
| Model | [`public/models/heroes/chef_v2.glb`](../../../public/models/heroes/chef_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Gus (janitor)](janitor.md), [Bo (sheep)](sheep.md), [Hank (timber)](timber.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
