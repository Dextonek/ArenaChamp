---
title: Referee Whistler, by the book (referee kit)
tags: [catalog, heroes, referee, controller, ranged, rules, mechanics]
updated: 2026-11-04
---

# Referee Whistler, by the book

The referee hero kit: Whistler's four spells (Q, W, E and the R ultimate), the passive rules and cards, the shared parts file, the palette row and the rigged hero model. A stern little man with a big square head, a black and white striped shirt, black shorts, long socks and a chrome whistle on a cord, with a yellow card and a red card in his pockets. He is built on the [combat mechanics](../../architecture/mechanics.md): a ranged controller who calls rules over the enemy's head and cards them for breaking one.

## Role

| | |
|---|---|
| Role | Controller (ranged) |
| Signature | By the Book |
| HP | 620 |
| Kit shapes | Q LINE ring of sound · W AURA rule (no dashes) · E AURA rule (no spells) · R ZONE card |

He wins by calling a rule the enemy cannot afford to break. He never stops the break: he only cards it, and two yellow cards are a red card. His weakness is sight: his rules need the enemy in view, so cover saves them.

## At a glance

| | |
|---|---|
| Hero | Referee Whistler, by the book |
| Spell category | `hero: referee` |
| Parts file | [`src/effects/parts/referee.ts`](../../../src/effects/parts/referee.ts) |
| Kit data | [`src/kits/referee.ts`](../../../src/kits/referee.ts) |
| Trait | [`src/traits/referee.ts`](../../../src/traits/referee.ts) |
| Kit sheet | [`kit-referee.md`](../../../pipeline/designs/kit-referee.md) |
| Model | [`public/models/heroes/referee_v2.glb`](../../../public/models/heroes/referee_v2.glb) |

## Palette

Black and white stripes, a chrome whistle, a yellow card and a red card. Constants `REFEREE` and `REFEREE_CSS` in the parts file are kept dim on purpose (no pure white: the bloom turns it into a halo). The kit accent is `#f2f2f2` and the foil `#1a1a1a`.

| White (accent) | Pale | Grey | Foil | Dark | Yellow | Hot yellow | Red | Hot red | Skin |
|---|---|---|---|---|---|---|---|---|---|
| `#b4b4b4` | `#a2a2a2` | `#7c7c7c` | `#1a1a1a` | `#0e0e0e` | `#d9ac14` | `#e6c23a` | `#c4281c` | `#dc3a2a` | `#cfa583` |

## Signature shape and material rules

The whistle, and the round "no" sign: a pictogram crossed out in a red ring with a bar. A rule is stamped under the enemy as such a sign (a runner, a wand or a hand). Sound is drawn as pale rings.

- Every colour stays under a base of about 0.72.
- Everything is pooled or built once, takes world-space positions and has `reset()` where it holds state.
- The card count, the rule words and the red-card ring over the enemy are the trait's `markLook` and `enemyLabel`.

## Passive and twist

| | |
|---|---|
| Passive | By the Book. A rule he calls shows over your head: NO RUNNING 3 s, NO CASTING 2 s, HANDS OFF 3 s. Break it and you get a yellow card; two yellows are a red: 90 damage and silenced 1.5 s. Cards last the round. |
| Twist | Booked. Obey the rule, or take the card when the move is worth it. Your card count shows over your head. |
| Speed | 4.0 m/s. |
| Basic attack | Ranged, range 6, damage 12, every 0.9 s, wind-up 0.25 s, speed 20, look `orb`. |
| Hooks | `dealt` (turns the 1 damage hit of W, E and R into the rule or card), `taken` (a hit on him while HANDS OFF runs), `enemyCast` (counts the enemy's casts), `victimTick` (decides cards and the red), `enemyLabel`, `marks`, `markLook`, `peerNote`, `afterCast`, `aiHold`, `badge`. |

- The rules are stacks on the enemy (`norun`, `nocast`, `hands`; hidden from the pips). Each rule ends with the card it gave, so one rule is never more than one card.
- A dash is a step of 2 m in 0.2 s within 1.3 s of a cast while NO RUNNING runs. Casting under NO CASTING is never blocked: the spell goes out and the card is given. After a red the yellows go back to none.
- The red is a `trait` hit that none of his hooks answer, so it cannot give a card itself.
- Cards hover over the enemy's head (yellow in front, reds behind) and last the round.

## Mechanics

Whistler uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 8 m, 22 m/s, radius 0.4. It reaches 6 m at 0.57 s |
| Sight | W, E and R need the enemy seen at the moment of the hit; cover saves them |
| Status stacks | the rules (`norun`, `nocast`, `hands`) and the cards live on the enemy; the label over its head reads them |
| Silence | the red card silences 1.5 s |
| Knockback | Q knocks 1.5 |
| Dash, summon, heal, pull | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/referee.ts`), numbers from `src/traits/referee.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [whistle blast](../../../src/spells/targeted/whistleBlast.ts) | ground LINE (bolt, radius 0.4) | 8 | 3.5 s | 0.3 s (launch) | about 2 s | He draws the whistle to his lips over the wind-up and blows a standing ring of sound, a fat pale hoop with a smaller one inside, that flies and pulses and throws off thin rings behind it. A hit bursts three rings out of the target and a dark floor ring; a miss thins out where its range ends. Damage 72, knock 1.5. |
| W | [no running](../../../src/spells/targeted/noRunning.ts) | self AURA (r 7, needs sight) | 7 | 9 s | 0.5 s | 2.1 s | The whistle comes up at 0.2 s and a fat pale ring of sound rushes out along the floor to 7 m. At 0.5 s every enemy hero inside whom he still sees gets the rule NO RUNNING for 3 s: no dashes, blinks or leaps. A crossed-out runner sign stamps down under each. A dash taken anyway is a yellow card. |
| E | [no casting](../../../src/spells/targeted/noCasting.ts) | self AURA (r 7, needs sight) | 7 | 13 s | 0.5 s | about 2.1 s | The same whistle and ring as No Running; the sign is a crossed-out wand. The rule NO CASTING lasts 2 s: no spells, only basic attacks. Casting anyway goes out and is a yellow card. |
| R | [show the card](../../../src/spells/targeted/showTheCard.ts) | ground ZONE (r 1.2, needs sight) | 9 | 24 s | 0.6 s | 2.2 s | A big sleeved arm swings up and points at the spot while a white dashed line draws to a circle there. At 0.2 s his other hand throws a yellow card that flips through the air and lands at 0.6 s, with an impact frame, a whiteout blink and a ring of sound. Whoever is inside and seen gets a yellow card now and the rule HANDS OFF for 3 s: hit him in that time and it is another yellow. Two yellows are a red: 90 damage and silence 1.5 s. |

Spell sources: [`whistleBlast.ts`](../../../src/spells/targeted/whistleBlast.ts), [`noRunning.ts`](../../../src/spells/targeted/noRunning.ts), [`noCasting.ts`](../../../src/spells/targeted/noCasting.ts), [`showTheCard.ts`](../../../src/spells/targeted/showTheCard.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-referee).

The headers of `whistleBlast.ts` and `showTheCard.ts` still say 50 damage and a red of 60; the numbers above are the constants in `src/traits/referee.ts` (`WHISTLE_DAMAGE` 72, `RED_DAMAGE` 90).

## Parts file

[`src/effects/parts/referee.ts`](../../../src/effects/parts/referee.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `REFEREE`, `REFEREE_CSS` | palette constants |
| `SoundRings` | pooled rings of sound (a train behind a bolt, a ground ring that rushes out) |
| `CardFlight` | pooled cards that flip end over end through the air |
| `GroundSign` | a prohibition sign lying under a victim (`SignKind`: run, cast, hands) |
| `buildWhistle` | the whistle on its cord |
| `PointingArm` | a big sleeved arm with one finger out |
| `cardLook`, `wordLook`, `ringLook` | what `Trait.markLook` draws over the enemy: the cards, a rule word, the red-card ring |
| `paintRunner`, `paintWand`, `paintHand`, `paintProhibit`, `paintCard` | the canvas pictograms (the kit icons use them too) |

## Model

[`public/models/heroes/referee_v2.glb`](../../../public/models/heroes/referee_v2.glb): a rigged figure built by the `Referee` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Referee Whistler`); hero body size is radius 0.41, height 2.33 in `HERO_BODIES`.

- Look: a stern little man with a big square head, a black flat top and furious brows. A shirt in big vertical black and white stripes over a small round belly, black shorts, white socks to the knee with black hoops. A big silver whistle on a cord on his chest, and oversized red and yellow cards sticking out of his pockets: the only colour on him.
- HUD portrait (canvas-drawn in the kit data): a black ground, striped shoulders with a collar and a whistle on a cord, a square serious pale head with a dark cap of hair, a heavy straight brow and a tight mouth, and a raised hand with a yellow card.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-referee.md`](../../../pipeline/designs/kit-referee.md) |
| Parts | [`src/effects/parts/referee.ts`](../../../src/effects/parts/referee.ts) |
| Spells | [`whistleBlast.ts`](../../../src/spells/targeted/whistleBlast.ts), [`noRunning.ts`](../../../src/spells/targeted/noRunning.ts), [`noCasting.ts`](../../../src/spells/targeted/noCasting.ts), [`showTheCard.ts`](../../../src/spells/targeted/showTheCard.ts) |
| Kit data | [`src/kits/referee.ts`](../../../src/kits/referee.ts) |
| Trait | [`src/traits/referee.ts`](../../../src/traits/referee.ts) |
| Model | [`public/models/heroes/referee_v2.glb`](../../../public/models/heroes/referee_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mum (mime)](mime.md), [Mr. Ledger (ledger)](ledger.md), [Big Yoko (sumo)](sumo.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
