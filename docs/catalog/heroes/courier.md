---
title: Pip, the last courier (courier kit)
tags: [catalog, heroes, courier, skirmisher, ranged, parcel, mechanics]
updated: 2026-11-04
---

# Pip, the last courier

The courier hero kit: Pip's four spells (Q, W, E and the R ultimate), the passive parcel and drop point, the shared parts file, the palette row and the rigged hero model. A skinny, eager postman in a blue cap and shorts, with an enormous yellow mailbag far bigger than his body. He is built on the [combat mechanics](../../architecture/mechanics.md): a fast ranged skirmisher who earns Charges by carrying a parcel to a drop point on the floor.

## Role

| | |
|---|---|
| Role | Skirmisher (ranged) |
| Signature | Sign Here |
| HP | 620 |
| Kit shapes | Q LINE letter (grows with Charges) · W ZONE parcel bursts · E DASH sprint · R TARGET hunting parcel |

He wins by running the route: a parcel and a drop point show on the floor, and every delivery is a Charge that makes his letter hit harder, refunds his sprint and feeds his ultimate. His weakness is that the route is shown to both heroes, and a hit while he carries knocks the parcel loose.

## At a glance

| | |
|---|---|
| Hero | Pip, the last courier |
| Spell category | `hero: courier` |
| Parts file | [`src/effects/parts/courier.ts`](../../../src/effects/parts/courier.ts) |
| Kit data | [`src/kits/courier.ts`](../../../src/kits/courier.ts) |
| Trait | [`src/traits/courier.ts`](../../../src/traits/courier.ts) |
| Kit sheet | [`kit-courier.md`](../../../pipeline/designs/kit-courier.md) |
| Model | [`public/models/heroes/courier_v2.glb`](../../../public/models/heroes/courier_v2.glb) |

## Palette

Brown paper and string, cream envelopes, a postman's blue and a bright yellow, with a little red. Constants `COURIER` and `COURIER_CSS` in the parts file; the kit accent is the yellow and the foil the blue.

| Accent | Hot | Foil | Blue dark | Blue light | Paper | Brown | String | Red | Dark |
|---|---|---|---|---|---|---|---|---|---|
| `#ffd24a` | `#ffe88a` | `#3a6ac8` | `#24427e` | `#8fb0ee` | `#e6d6ac` | `#b98a52` | `#e4d49c` | `#d9463a` | `#2a1c12` |

Also cream `#eee3c4` and brown dark `#7a5230`.

## Signature shape and material rules

The brown-paper parcel tied with string and a bow, with a red FRAGILE sticker on its front. Envelopes are cream airmail with a red seal; paper scraps and stickers tumble where things burst; big hurried words (SIGN HERE, DELIVERED) are shown as sprites.

- Everything is pooled or built once, takes world-space positions, has `reset()` where it holds state and keeps every colour under the bloom threshold.
- The parcel, the drop point, the carried parcel and the dashed route on the floor are the trait's `marks` (`parcelLook`, `dropLook`, `carriedLook`, `dashLook`), each big and plain with a beam of light where it matters.

## Passive and twist

| | |
|---|---|
| Passive | Sign Here. A parcel lies on the arena and the drop point is shown. Carry one to the other: +1 Charge, 3 at most. A hit on him while he carries knocks the parcel loose where he stood. |
| Twist | Charges. Express Letter hits harder for each Charge, Shortcut can spend one to be ready again, Final Delivery spends all. You can read his route, and stand on the drop point. |
| Meter | CHARGE, max 3. |
| Speed | 4.7 m/s. |
| Basic attack | Ranged, range 5, damage 12, every 0.8 s, wind-up 0.2 s, speed 20, look `orb`. |
| Hooks | `marks` and `markLook`, `tick` (carrying, picking up, delivering), `taken` (a hit knocks the parcel loose), `cooldown` and `afterCast` (the Shortcut refund), `victimTick` (the Final Delivery burst), `ownChanged`, `peerNote`, `aiGoal`, `aiHold`, `badge`. |

- He walks into the parcel (reach 1.3 m, more when cover was raised on a loose parcel: it is reached from the edge of that cover) to carry it and delivers it at the drop point; a loose parcel can be picked up again after 1.2 s. The next parcel and drop appear after a delivery.
- Parcel and drop come from a pure function of the number of deliveries, a seed and the round's arena, at least 1.7 m from its cover, so both screens draw the same marks. Final Delivery's signature is measured against the cover standing now.
- The CPU walks to the parcel and then the drop when the enemy is not within 4 m, keeps R for 1 or more Charges, and keeps E (which would spend one) while it has Charges and the enemy is not close.

## Mechanics

Pip uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 8 m, 24 m/s, radius 0.3 |
| Dash | E moves him up to 6 m in 0.3 s (`escape`); with a Charge it is refunded to 0.4 s |
| Charges (resource) | Q adds 15 per Charge, R adds 40 per Charge and spends all |
| Slow | W slows 1 s |
| Homing mark | R's parcel follows the enemy at 5 m/s for 1.5 s on both screens |
| Cover | touching cover before R bursts signs for the parcel and sends it back |
| Pull, silence, summon, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/courier.ts`), numbers from `src/traits/courier.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [express letter](../../../src/spells/targeted/expressLetter.ts) | ground LINE (bolt, radius 0.3) | 8 | 3 s | 0.25 s (launch) | about 2 s | He pulls an airmail envelope out of his bag over the wind-up and flicks it as a real bolt that flutters and spins, trailing paper scraps and one after-image per Charge. It reaches 6 m at 0.5 s, and grows with his Charges. It bursts into paper where it hits or where its line ends. Damage 58, +15 per Charge (he keeps them). |
| W | [fragile](../../../src/spells/targeted/fragile.ts) | ground ZONE (r 2.5) | 9 | 9 s | 1.0 s | 2.6 s | He hurls a brown-paper parcel in a high spinning arc (0.45 s) at a spot (at least 1.5 m). It lands with a bounce and a red ring, ticks and rattles harder, then at 1.0 s bursts: paper flies, FRAGILE stickers scatter and DELIVERED pops over the spot. Damage 72, slow 1 s. |
| E | [shortcut](../../../src/spells/targeted/shortcut.ts) | ground DASH (up to 6 m, at least 2 m) | 6 | 9 s | 0.3 s (the run) | 1.3 s | He puts his head down and sprints toward the aim, cap and bag flapping, leaving a pale streak, scraps of paper and three envelopes that tumble out of the bag. With a Charge he spends one, a blue-and-yellow ring pops round him as he lands and E is ready again after 0.4 s. No damage. |
| R | [final delivery](../../../src/spells/targeted/finalDelivery.ts) | enemy (the parcel hunts it) | 6 | 24 s | 1.5 s (the burst) | 3.0 s | He spends all his Charges. A big brown parcel with URGENT on its label pops up at his side and goes after the enemy for 1.5 s at 5 m/s, with SIGN HERE over it and a red ring 2 m wide filling on the floor. It bursts with an impact frame, a flash and flying paper. Touch cover before it bursts and you sign for it: it goes back. Damage 80, +40 per Charge spent, within 2 m. |

Spell sources: [`expressLetter.ts`](../../../src/spells/targeted/expressLetter.ts), [`fragile.ts`](../../../src/spells/targeted/fragile.ts), [`shortcut.ts`](../../../src/spells/targeted/shortcut.ts), [`finalDelivery.ts`](../../../src/spells/targeted/finalDelivery.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-courier).

The headers of `expressLetter.ts` and `fragile.ts` still say 35 and 50 damage; the numbers above are the constants in `src/traits/courier.ts` (`LETTER_DAMAGE` 58, `FRAGILE_DAMAGE` 72).

## Parts file

[`src/effects/parts/courier.ts`](../../../src/effects/parts/courier.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `COURIER`, `COURIER_CSS` | palette constants |
| `stickerTexture` | the FRAGILE sticker |
| `wordSprite` | a big hurried word (SIGN HERE, DELIVERED) |
| `buildParcel` | a brown-paper parcel with string, a bow, a FRAGILE sticker and a label |
| `buildLetter` | an airmail envelope with a red seal |
| `Flecks` | pooled flat scraps that tumble (paper bits, or FRAGILE stickers) |
| `parcelLook`, `dropLook`, `carriedLook`, `dashLook` | what `Trait.markLook` draws on the floor |

## Model

[`public/models/heroes/courier_v2.glb`](../../../public/models/heroes/courier_v2.glb): a rigged figure built by the `Courier` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Pip`); hero body size is radius 0.39, height 2.33 in `HERO_BODIES`.

- Look: a skinny eager postman, all knees and ears. A pale blue shirt, blue cap and shorts, ginger hair, a letter in his right hand, one long sock up and the other rolled down, big red running shoes. An enormous yellow mailbag on his back and hip, far bigger than his body, with a blue flap, gold buckles and letters spilling out of the top.
- HUD portrait (canvas-drawn in the kit data): a deep postman's-blue ground, the enormous brown bag behind him with envelopes poking out and a yellow strap, a blue jacket, a thin hurried face with a big nose, wide eyes and a whistling mouth, a blue cap with a yellow badge, and a letter in his raised hand.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-courier.md`](../../../pipeline/designs/kit-courier.md) |
| Parts | [`src/effects/parts/courier.ts`](../../../src/effects/parts/courier.ts) |
| Spells | [`expressLetter.ts`](../../../src/spells/targeted/expressLetter.ts), [`fragile.ts`](../../../src/spells/targeted/fragile.ts), [`shortcut.ts`](../../../src/spells/targeted/shortcut.ts), [`finalDelivery.ts`](../../../src/spells/targeted/finalDelivery.ts) |
| Kit data | [`src/kits/courier.ts`](../../../src/kits/courier.ts) |
| Trait | [`src/traits/courier.ts`](../../../src/traits/courier.ts) |
| Model | [`public/models/heroes/courier_v2.glb`](../../../public/models/heroes/courier_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Gus (janitor)](janitor.md), [Mabel (mole)](mole.md), [Wick (door)](door.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
