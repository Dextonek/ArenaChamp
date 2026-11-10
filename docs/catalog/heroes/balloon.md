---
title: Professor Puff, the Aeronaut (balloon kit)
tags: [catalog, heroes, balloon, mage, ranged, air]
updated: 2026-11-04
---

# Professor Puff, the Aeronaut

The balloon hero kit: Professor Puff's four spells (Q, W, E and the R ultimate), his passive, the shared parts file, the palette and the rigged hero model. A small round alchemist of the air in a long aubergine coat with brass buttons, goggles pushed up on his brow and a brass gas tank on his back, with glowing rose glass gas spheres floating above and beside his head on chains. His hits put Air on the enemy and the enemy really swells: the enemy hero is drawn bigger and is easier to hit. Then Pop! hits harder for every Air. He is a ranged mage and he is fragile.

## Role

| | |
|---|---|
| Role | Mage (ranged) |
| Signature | Inflate |
| HP | 580 |
| Kit shapes | Q SHOT air jet · W ZONE delayed pop · E ESCAPE float with a push · R TGT pin |

He wins by stacking Air with the hose and the bomb, then popping the enemy for 60 plus 20 per Air. Waiting makes the pop stronger, and waiting is also when the Air runs out. His weakness is HP (580) and the Air itself: the enemy lets it out by standing still for 1 s or by hitting him.

## At a glance

| | |
|---|---|
| Hero | Professor Puff, the Aeronaut |
| Spell category | `hero: balloon` |
| Parts file | [`src/effects/parts/balloon.ts`](../../../src/effects/parts/balloon.ts) |
| Kit data | [`src/kits/balloon.ts`](../../../src/kits/balloon.ts) |
| Trait (rules) | [`src/traits/balloon.ts`](../../../src/traits/balloon.ts) |
| Kit sheet | [`kit-balloon.md`](../../../pipeline/designs/kit-balloon.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/balloon_v3.glb`](../../../public/models/heroes/balloon_v3.glb) |

## Palette

The `BALLOON` constant in [`src/effects/parts/balloon.ts`](../../../src/effects/parts/balloon.ts) (numbers for `THREE.Color`; `BALLOON_CSS` has the string twins). There is no art bible row for this kit yet. The kit accent is the body colour and the foil is the pale gold.

| Core | Hot | Body | Shade | Deep | Foil (pale gold) | Sky | Mint | Brass | Dark |
|---|---|---|---|---|---|---|---|---|---|
| `#ffffff` | `#ffd2e3` | `#ff8fb8` | `#c9507f` | `#8a2f5a` | `#fff1a8` | `#8fd8ff` | `#a8efc8` | `#d9a441` | `#2a1424` |

Shiny pink rubber and pale foil, a dark outline layer and a brass pump. Sky and mint are the other balloon colours in a bunch.

## Signature shape and material rules

Real balloons. A pear-shaped glossy body with a pale window highlight, a dark outline, a knot and a string; they bob, lean away from their motion and wobble when poked. Air is soft camera-facing soap-bubble rings and puffs; a pop leaves flat torn rubber scraps that flutter down and a floating word (POP, BLOAT, PFFT). The brass pin of Pop! has a pink glass head.

- Everything is pooled, takes world-space positions and stays under the bloom threshold (no colour above 0.92).
- A balloon is a real object, not a glowing ball: a rocket of rubber that shrinks as it empties, with its string streaming.
- The enemy hero really swells (6% per Air) on both screens through `enemyScale`; a swollen hero is also judged bigger.

## Passive and twist

| | |
|---|---|
| Passive | Inflate: his hits put Air on the enemy (10 at most, each batch lasts 6 s): Air Hose and Helium Bomb give 3, a basic attack 1. The enemy really swells by 6% per Air, which makes them easier to hit, and his hits push them 8% farther per Air. At 7 Air or more the word BLOAT shows over their head. |
| Twist | Pop Now or Inflate More. Pop! hits for 60 plus 20 per Air and lets all the Air out in a 3 m shove, so waiting pays, and waiting is when the enemy deflates. Standing still for 1 s lets out 1 Air per 0.3 s, and so does each hit the enemy lands on him. |
| Resource or meter | none (Air is stacks on the enemy; the passive slot shows the count) |
| Speed | 3.9 m/s |
| Basic attack | ranged, 6 m, 10 damage every 1.0 s, wind-up 0.25 s, bolt speed 18, orb look |
| Other rules | The duel AI playing him holds R until the enemy has 4 Air, and E until the enemy is within 3.5 m. |

## Mechanics

Professor Puff uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Stacks on the enemy | Air, from the trait's `dealt` |
| Enemy size | `enemyScale`: the enemy hero is drawn and judged 6% bigger per Air, on both screens |
| Enemy label | `enemyLabel`: BLOAT at 7 Air or more |
| Push | Q (1 m, plus 8% per Air), W (out from the spot), E (3 m), R (3 m shove, fixed) |
| Skillshot | Q: a projectile at 22 m/s, 8 m, radius 0.35 (`aim: 'line'`) |
| Zone with a delay | W: a 2.5 m circle, 1.0 s |
| Escape | E: floats 6 m in 0.7 s (`moveCaster`) |
| Targeted hit | R: judged on the live position, needs sight when it lands, fizzles past 11 m |
| Melee, summon, shield, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/balloon.ts`), hit time and length from the spell files in `src/spells/targeted/`; the numbers are the spell files' defaults and the trait's constants.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [air hose](../../../src/spells/targeted/airHose.ts) | line skillshot (ground aim) | 8 | 3.5 s | thrown at 0.3 s, reaches 6 m at 0.57 s | about 1.7 s | He pumps a small pink balloon up at the brass nozzle for 0.3 s and lets go: a balloon rocket, shrinking as it empties. It hits the first enemy it touches for 60, adds 3 Air and pushes 1 m (8% farther per Air already on them). A thin line shows the path. |
| W | [helium bomb](../../../src/spells/targeted/heliumBomb.ts) | ground (r 2.5) | 9 | 9 s | 1.0 s | 2.2 s | A shiny foil balloon floats to the spot in 0.4 s and hangs 2.6 m above it, swelling and wobbling, with the 2.5 m circle drawn on the floor. At 1.0 s it pops: 50 damage and 3 Air to everyone inside, each pushed out from the spot. The word POP shows. |
| E | [hot air](../../../src/spells/targeted/hotAir.ts) | ground (r 2.5 push) | 9 | 10 s | push at 0.4 s | 2.4 s | He pumps himself up for 0.4 s (three big balloons swell over his head and the word BLOAT floats up), then lets go: anyone within 2.5 m is pushed 3 m (no damage). Then he floats 6 m away from the aimed spot in 0.7 s; a pale ring on the floor shows where he will land. He is out of position afterwards. |
| R | [pop!](../../../src/spells/targeted/popPin.ts) | enemy (needs sight when it lands) | 9 | 22 s | 0.6 s (the pin is thrown at 0.15 s) | 1.9 s | Ultimate. He draws a brass pin with a pink glass head; a red circle and a closing ring mark the enemy. At 0.6 s, if he still sees them and they are within 11 m, they POP: 60 plus 20 per Air, and all their Air goes out in a 3 m shove. If they reached cover or went past 11 m, the pin clatters off. |

Spell sources: [`airHose.ts`](../../../src/spells/targeted/airHose.ts), [`heliumBomb.ts`](../../../src/spells/targeted/heliumBomb.ts), [`hotAir.ts`](../../../src/spells/targeted/hotAir.ts), [`popPin.ts`](../../../src/spells/targeted/popPin.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-balloon).

## Parts file

[`src/effects/parts/balloon.ts`](../../../src/effects/parts/balloon.ts) holds everything the kit's spells share. Spells import it directly (`../../effects/parts/balloon`). Everything is pooled, takes world-space positions and has a `reset()` where it holds state.

| Export | Role |
|---|---|
| `BALLOON`, `BALLOON_CSS` | palette constants (`foil` is the pale gold) |
| `Balloons` | pooled real balloons: a pear-shaped glossy body with a pale window highlight, a dark outline, a knot and a string; they bob, lean away from their motion and wobble when poked |
| `Bubbles` | pooled camera-facing soap-bubble rings and soft puffs of air (jets, gathering air, the shock of a pop) |
| `Scraps` | flat torn rubber scraps that flutter down after a pop |
| `PopWords` | the floating word (POP, BLOAT, PFFT) |
| `buildPin` | the brass pin of Pop! |
## Model

[`public/models/heroes/balloon_v3.glb`](../../../public/models/heroes/balloon_v3.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it), built by the `BalloonMythic` class (a subclass of `Balloon`) in [`blender/heroes/restyle_batch1.py`](../../../blender/heroes/restyle_batch1.py) on top of [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Professor Puff`), and its hit size is in `HERO_BODIES` in the same file (radius 0.54 m, height 2.43 m). Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: small and round, an alchemist of the air. A long aubergine coat with brass buttons and a brass-bound hem, dark leggings and brown shoes, silver wild hair at the sides, big calm eyes and a small mouth, brass goggles pushed up on his brow, and a brass gas tank on his back with its hose over the shoulder to a nozzle in his right hand. Signature: four glass gas spheres glowing rose pink, each in a brass cradle on a chain tied at his belt, floating above and beside his head where the balloons were.
- HUD portrait (canvas-drawn in the kit data): glowing rose gas spheres in brass cradles above and beside his head, an aubergine coat with a high collar and two rows of brass buttons, silver tufts of hair, brass goggles up on the brow and big calm eyes.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-balloon.md`](../../../pipeline/designs/kit-balloon.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/balloon.ts`](../../../src/effects/parts/balloon.ts) |
| Spells | [`airHose.ts`](../../../src/spells/targeted/airHose.ts), [`heliumBomb.ts`](../../../src/spells/targeted/heliumBomb.ts), [`hotAir.ts`](../../../src/spells/targeted/hotAir.ts), [`popPin.ts`](../../../src/spells/targeted/popPin.ts) |
| Kit data | [`src/kits/balloon.ts`](../../../src/kits/balloon.ts) |
| Trait (passive, twist, rules) | [`src/traits/balloon.ts`](../../../src/traits/balloon.ts) |
| Model | [`public/models/heroes/balloon_v3.glb`](../../../public/models/heroes/balloon_v3.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Silvane (mirror)](mirror.md), [Bram (mason)](mason.md), [Hank (timber)](timber.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
