---
title: The Great Zambini, stage magician (magic kit)
tags: [catalog, heroes, magic, trickster, ranged, hats, mechanics]
updated: 2026-11-04
---

# The Great Zambini, stage magician

The magic hero kit: Zambini's four spells (Q, W, E and the R ultimate), the passive Ta-da!, the shared parts file, the palette row and the rigged hero model. A very tall, very pleased magician in a black tailcoat and a purple-lined cape, with a top hat, a thin curled moustache and a star-tipped wand. He is built on the [combat mechanics](../../architecture/mechanics.md): a ranged trickster who vanishes under hats and comes out with a rabbit.

## Role

| | |
|---|---|
| Role | Trickster (ranged) |
| Signature | Ta-da! |
| HP | 570 |
| Kit shapes | Q FAN three cards · W LINE saw · E SELF three hats · R TARGET three hats and swords |

He wins by disappearing: under a hat he cannot be hit, and the first spell after he comes out deals 40% more and sends a rabbit. His weakness is the hats: the right hat popped stuns him for 1 s, and an area spell hits all three.

## At a glance

| | |
|---|---|
| Hero | The Great Zambini, stage magician |
| Spell category | `hero: magic` |
| Parts file | [`src/effects/parts/magic.ts`](../../../src/effects/parts/magic.ts) |
| Kit data | [`src/kits/magic.ts`](../../../src/kits/magic.ts) |
| Trait | [`src/traits/magic.ts`](../../../src/traits/magic.ts) |
| Kit sheet | [`kit-magic.md`](../../../pipeline/designs/kit-magic.md) |
| Model | [`public/models/heroes/magic_v2.glb`](../../../public/models/heroes/magic_v2.glb) |

## Palette

A black tailcoat and a purple cape on a dark violet ground, gold foil, paper confetti, playing cards and gold stars. Everything is flat and unlit (nothing above 0.92). Constants `MAGIC` and `MAGIC_CSS` in the parts file; the kit accent is the violet and the foil the pale gold.

| Core | Hot | Foil | Gold | Violet (accent) | Purple | Deep | Dark |
|---|---|---|---|---|---|---|---|
| `#ffffff` | `#fff1c8` | `#ffe08a` | `#e0b050` | `#b05aff` | `#7a30c8` | `#2a1248` | `#120a1e` |

Confetti also uses red `#d8404a`, pink `#ff8ac8` and cyan `#6ad8ff`.

## Signature shape and material rules

The top hat and the gold star. Hats stand on the floor with a gold ring under each so they read on any floor. Confetti, gold stars and playing cards fly from every trick.

- Flat and unlit, pooled, takes world-space positions and has `reset()` where it holds state.
- Cards, saw and swords are `Flyers` that follow a real bolt, or a drawn straight path where no bolt flies.

## Passive and twist

| | |
|---|---|
| Passive | Ta-da! His first spell after he comes out of a hat deals 40% more, and a white rabbit runs at you (20 HP, 8 damage). |
| Twist | Which Hat? Hide for safety, or stay out for damage. Hit the right hat and he pops out stunned; an area spell hits all three. |
| Speed | 4.1 m/s. |
| Basic attack | Ranged, range 6, damage 12, every 1.0 s, wind-up 0.25 s, speed 20, look `spark` in gold `#ffe08a`. |
| Hooks | `castMods` (Ta-da! power 1.4, within 8 s), `afterCast` and `tick` (the act and the seal), `figureHidden` (his figure is not drawn under a hat), `victimTick`, `peerNote`, `ownChanged`, `canCast`, `aiHold`, `badge`. |

- Under a hat he is `sealed` for the length of the act: nothing can hit him and he cannot act. The act ends when he steps out of his hat, which arms Ta-da!.
- The hats are real units (1 HP each) made on both screens. When the right hat is popped the act ends and he is stunned 1 s; a wrong hat gives confetti.
- The rabbit has 20 HP, runs at 4.5 m/s, lives 8 s and hits for 8.
- The CPU casts E when its HP is under 60% or the enemy is within 4 m, and R when the enemy is within 9 m.

## Mechanics

Zambini uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q (three bolts, 8 m, 22 m/s), W (one bolt, 8 m, 18 m/s) and R's three swords (16 m/s) are real bolts (`ctx.projectile`) |
| Seal and hidden figure | E and R: he is not drawn and cannot be hit while under a hat |
| Summon | hats (units, 1 HP) and the rabbit (`ctx.summon`) |
| Slow | W slows 1.5 s |
| Stun | the right hat popped stuns him 1 s |
| Empowered cast | Ta-da! multiplies the first spell by 1.4 |
| Moving the caster | E and R move him to his hat with `ctx.moveCaster` |
| Dash, pull, silence, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/magic.ts`), numbers from `src/traits/magic.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [card spray](../../../src/spells/targeted/cardSpray.ts) | ground LINE (three bolts in a 24 degree fan) | 8 | 3.5 s | 0.3 s (launch) | about 2.2 s | He flicks his wrist: a fan of three playing cards appears at his hand with gold stars falling from it and leaves as three real bolts at -12, 0 and +12 degrees. Each card spins and trails confetti and gold stars. A card reaches 6 m at 0.57 s. A hit bursts into confetti and loose cards; a miss pops into confetti. Close up the three overlap into a wall; past 5 m a player can stand in a gap. Damage 26 each. |
| W | [sawn in half](../../../src/spells/targeted/sawnInHalf.ts) | ground LINE (bolt, radius 0.35) | 8 | 10 s | 0.3 s (launch) | about 2.2 s | He snaps his fingers and a long toothed saw blade with a gold and violet grip is drawn out of thin air in a puff of confetti, then slides at the enemy rocking, with a trail of gold stars. It reaches 6 m at 0.63 s. A hit throws confetti, stars and two halves of a card. Damage 60, slow 1.5 s. |
| E | [hat trick](../../../src/spells/targeted/hatTrick.ts) | self (three hats 1.1 m round him) | 0 (self) | 13 s | 1.5 s (he steps out) | about 2.7 s | A puff of purple smoke and three top hats pop up round him in a triangle. He is gone and sealed for 1.5 s while the hats shuffle: from 0.15 s three swaps of 0.42 s each, two hats trading places along half-circles. At 1.5 s he steps out of his hat with smoke, a ring, a star and confetti, and the rabbit runs at the enemy. Hit the right hat and he pops out stunned 1 s. No damage. |
| R | [grand finale](../../../src/spells/targeted/grandFinale.ts) | enemy (ring r 3 round their spot) | 9 | 24 s | 1.2 s (the swords fly) | about 3.0 s | A burst of purple smoke: he is gone and sealed for 1.2 s. Three top hats pop up in a ring 3 m round the enemy's spot (step out of it) with a thin gold circle between them. The hats glow and from 0.7 s a sword rises out of each, point toward the centre. At 1.2 s the three swords fly as real bolts, 3.6 m from each hat, stopped by walls and pillars. One impact frame. He steps out of one hat at 1.15 s with the rabbit. Damage 30 each. |

Spell sources: [`cardSpray.ts`](../../../src/spells/targeted/cardSpray.ts), [`sawnInHalf.ts`](../../../src/spells/targeted/sawnInHalf.ts), [`hatTrick.ts`](../../../src/spells/targeted/hatTrick.ts), [`grandFinale.ts`](../../../src/spells/targeted/grandFinale.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-magic).

The headers of `cardSpray.ts` and `sawnInHalf.ts` still say 22 and 50 damage; the numbers above are the constants in `src/traits/magic.ts` (`CARD_DAMAGE` 26, `SAW_DAMAGE` 60).

## Parts file

[`src/effects/parts/magic.ts`](../../../src/effects/parts/magic.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `MAGIC`, `MAGIC_CSS`, `CONFETTI`, `STARS`, `BOLT_Y` | palette constants and the confetti and star colour lists |
| `paintStar`, `paintCard`, `paintHat` | canvas pictograms (the kit icons use them too) |
| `Pieces` | pooled tumbling confetti, gold stars and playing cards: bursts, and one-off pieces with a velocity |
| `Flyers` | a card, a saw or a sword that follows a real bolt, or a drawn straight path |
| `Hats`, `HAT_BRIM` | three pooled top hats standing on the floor, with a gold ring under each |
| `rabbitLook`, `HIDDEN_LOOK` | a white rabbit with long ears (a `MinionLook`) and an empty look for a unit that is only a target |

## Model

[`public/models/heroes/magic_v2.glb`](../../../public/models/heroes/magic_v2.glb): a rigged figure built by the `Magic` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `The Great Zambini`); hero body size is radius 0.45, height 2.51 in `HERO_BODIES`.

- Look: very tall, very pleased. A black tailcoat over a violet waistcoat and pale shirt, a violet bow tie, white gloves, a thin curled moustache, one eyebrow up. A tall top hat with a violet band, a star-tipped wand held high, and a long cape parted down the back, black outside and purple inside, with a purple standing collar.
- HUD portrait (canvas-drawn in the kit data): a violet spotlight cone on a dark stage with gold stars hanging in it, a purple cape with a high collar and gold lining, a tailcoat with a white shirt front and a gold stud, a pale face with a thin waxed moustache, a smug smile and one raised brow, a tipped top hat with a violet band and a gold star, and a wand with a gold star at its tip in his raised hand.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-magic.md`](../../../pipeline/designs/kit-magic.md) |
| Parts | [`src/effects/parts/magic.ts`](../../../src/effects/parts/magic.ts) |
| Spells | [`cardSpray.ts`](../../../src/spells/targeted/cardSpray.ts), [`sawnInHalf.ts`](../../../src/spells/targeted/sawnInHalf.ts), [`hatTrick.ts`](../../../src/spells/targeted/hatTrick.ts), [`grandFinale.ts`](../../../src/spells/targeted/grandFinale.ts) |
| Kit data | [`src/kits/magic.ts`](../../../src/kits/magic.ts) |
| Trait | [`src/traits/magic.ts`](../../../src/traits/magic.ts) |
| Model | [`public/models/heroes/magic_v2.glb`](../../../public/models/heroes/magic_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mum (mime)](mime.md), [Wick (door)](door.md), [Barry Cloudsley (weather)](weather.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
