---
title: Mr. Ledger, the Tithe-Keeper (ledger kit)
tags: [catalog, heroes, ledger, controller, tab]
updated: 2026-11-04
---

# Mr. Ledger, the Tithe-Keeper

The ledger hero kit (kits v5, a new hero): Mr. Ledger's four spells (Q, W, E and the R ultimate), his passive and twist, the shared parts file, the palette and the rigged hero model. A long thin arcane notary in black and oxblood robes with a high collar and gold coin chains, a great red book chained to his wrist and a quill staff. His spells do not hurt now: they put the damage on a tab over the enemy's head, and the tab comes due later with interest.

## Role

| | |
|---|---|
| Role | Controller (ranged attack) |
| Signature | On Your Tab |
| HP | 600 |
| Kit shapes | Q BOLT paper, damage goes on the tab · W ZONE notice, tab + slow · E SELF call the tab due now · R GROUND stamp, the whole tab at +60% |

He wins a 1v1 by choosing when to bill: bill the enemy now, or let the interest grow. His weakness is that the enemy can pay the tab early by hitting him (each attack pays off 2, each spell 10), and he is weak if pressed. Running away makes the tab worse. Walk speed 4.0 m/s.

## At a glance

| | |
|---|---|
| Hero | Mr. Ledger, the Tithe-Keeper |
| Spell category | `hero: ledger` |
| Parts file | [`src/effects/parts/ledger.ts`](../../../src/effects/parts/ledger.ts) |
| Kit data | [`src/kits/ledger.ts`](../../../src/kits/ledger.ts) |
| Trait data | [`src/traits/ledger.ts`](../../../src/traits/ledger.ts) |
| Kit sheet | [`kit-ledger.md`](../../../pipeline/designs/kit-ledger.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Design | [`new-heroes-kits.md`](../../../pipeline/designs/new-heroes-kits.md), section 6 |
| Model | [`public/models/heroes/ledger_v3.glb`](../../../public/models/heroes/ledger_v3.glb) |

## Palette

The palette `LEDGER` / `LEDGER_CSS` in the parts file. Cream paper, black ink, red rubber-stamp ink, gold leaf and a dark green cloth cover. Kit accent `#d9c27a` (gold), kit foil `#3f4a3a` (the green cloth).

| Core | Hot | Paper | Shade | Gold (accent) | Brass | Cloth | Ink | Red | Hot red | Dark | Foil |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#f5edd0` | `#efe4c0` | `#e6d9ae` | `#b9aa7c` | `#d9c27a` | `#b08a3a` | `#2d3a2c` | `#1c211c` | `#b3261e` | `#d9453a` | `#161a14` | green `#3f4a3a` |

Core and hot are the lit paper; paper and shade are the sheet and its fold shadow; gold and brass are the coins, the ledger corners and the stamp band; cloth is the ledger cover; ink is the figures and the black ink; red and hot red are the stamp ink and the words over the victim; wood (`#6d4a2a`) is the stamp block.

## Signature shape and material rules

Paper, ink and coins. Flat sheets of paper that flutter at their corners, scraps that tumble, gold coins that bounce, red rubber-stamp ink splashed on the floor, and a big red word over the victim. A ledger with dark green cloth covers and gold corners opens in the air and is written in by a pencil.

- Paper: a plane cut into a grid so it can ripple; it lies flat, flutters and rolls in the air.
- Stamp ink: red, with a double border and rough, uneven edges; it dries away.
- Everything stays under the bloom threshold (no colour above 0.92).

## Passive and twist

| | |
|---|---|
| Passive | **On Your Tab**: his spell damage does not hurt now: it goes on your tab, a number over your head. It comes due 3 s after the last charge, at +40%. Each attack you land on him pays off 2 of it and each spell 10. |
| Twist | **Interest**: bill you now, or let the interest grow? Hit him to pay your tab down. Running away makes it worse. |
| Resource or meter | none. The tab is a stack (`tab`, hidden from the pips) shown as a number over the enemy's head (`$72`, red from 120 up). Words appear over the enemy: PAST DUE, FINAL NOTICE |
| Walk speed | 4.0 m/s |
| Basic attack | ranged, 6 m, 11 per 0.8 s, wind-up 0.25 s, bolt speed 20, spark look |

Other trait rules (`src/traits/ledger.ts`):

- Invoice and Late Fee put their damage on the tab (`dealt`). When the tab comes due (3 s after the last charge) it hits once at +40% with the word PAST DUE.
- Paying off: each basic attack the enemy lands on him pays 2, each spell 10 (counted on his own client where the hits on him are decided).
- Call It In brings the tab due now, without the interest.
- Foreclosure replaces its damage by the whole tab x 1.6 and empties the tab, and makes the enemy take +20% from him for 3 s.
- The tab lives on the screen that decides the enemy's hits (offline the one screen, online the victim's). A new round clears it.

## Mechanics

Mr. Ledger uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Tab (stacks) | Q (72) and W (62) put damage on the tab instead of hitting; E and R collect it |
| Delayed damage | the tab comes due after 3 s at +40% |
| Over-head label | `enemyLabel`: the tab number and the words |
| Slow | Late Fee, 1.5 s |
| Expose | Foreclosure: the enemy takes +20% from him for 3 s |
| Sight check | Foreclosure hits only a target he still sees in the circle; cover saves them |
| Skillshot | Invoice (radius 0.35, speed 20) |
| Dash, summon, shield, pull | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/ledger.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [invoice](../../../src/spells/targeted/invoice.ts) | ground (BOLT skillshot, line, radius 0.35) | 9 | 3.5 s | released at 0.25 s, flight at 20 m/s | up to 2.2 s | He pulls an invoice out of the ledger (it unrolls and flaps) and flicks it: a sheet that flutters and rolls in the air and sheds scraps. A hit slaps flat on the target in a puff of paper and a red stamp mark. 72 damage that goes on the tab instead of hurting now. A miss settles on the floor where its range ends. |
| W | [late fee](../../../src/spells/targeted/lateFee.ts) | ground (r 2.5) | 9 | 9 s | 1.0 s | 2.4 s | A gold ring of ruled lines draws on the ground and an enormous LATE FEE notice drops out of the sky onto it. At 1.0 s it lands flat with a slap and a burst of paper and bouncing coins. Whoever is in the ring is slowed 1.5 s and 62 goes on the tab. |
| E | [call it in](../../../src/spells/targeted/callItIn.ts) | self (no target needed) | 0 (self) | 8 s | 0.5 s | 1.7 s | The ledger swings open in the air, a pencil writes figures down the page, and it is slammed shut. At 0.5 s a stream of invoices and coins leaves it for the enemy and the tab comes due now, without the interest. No telegraph, and it does not root him. Needs a tab to call. |
| R | [foreclosure](../../../src/spells/targeted/foreclosure.ts) | ground (r 2.2) | 9 | 24 s | 0.8 s | 2.7 s | A red ring of ink draws at the spot and a huge rubber stamp drops out of the sky onto it. At 0.8 s, one impact frame, ink splatters, and FINAL NOTICE is printed on the floor. If the target is in the circle and he still sees them, they pay their whole tab at +60% now, and take 20% more from him for 3 s. Cover saves them. |

Spell sources: [`invoice.ts`](../../../src/spells/targeted/invoice.ts), [`lateFee.ts`](../../../src/spells/targeted/lateFee.ts), [`callItIn.ts`](../../../src/spells/targeted/callItIn.ts), [`foreclosure.ts`](../../../src/spells/targeted/foreclosure.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-ledger).

## Parts file

[`src/effects/parts/ledger.ts`](../../../src/effects/parts/ledger.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/ledger`). Everything is pooled or built once, takes world-space positions and has a `reset()` where it holds state; the colours stay under the bloom threshold.

| Export | Role |
|---|---|
| `LEDGER`, `LEDGER_CSS` | palette constants (`accent` is the gold, `foil` the green cloth) |
| `Invoice` | one sheet of paper: a plane cut into a grid so `flutter` can ripple it; the effect poses `mesh` |
| `PaperBits` | pooled loose scraps of paper (and torn red notices) that spin and drift down |
| `Coins` | pooled gold coins thrown up and bounced on the floor |
| `InkSplats` | red (or black) ink stains on the floor that spread out fast, hold and dry away |
| `buildStamp` | a huge rubber stamp (brass band round a wooden block, turned neck, round knob) with its face at y 0: `buildStamp(w, d)` |
| `GroundWord` | a word printed on the floor in rubber-stamp ink with a double border and rough ink |
| `Tome` | the ledger itself: dark green cloth covers with gold corners, ruled pages, a pencil. `open` 0..1, `scratch(p)` writes numbers on the right page |
| `wordLook` | the big red word over a victim (`Trait.markLook`), 3.4 m wide, drawn over everything |

## Model

[`public/models/heroes/ledger_v3.glb`](../../../public/models/heroes/ledger_v3.glb): a rigged figure on the Dao rig. Built by the `LedgerMythic` class in [`blender/heroes/restyle_batch2.py`](../../../blender/heroes/restyle_batch2.py) (`export("ledger_v3")` in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py)). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts). Hit size (`HERO_BODIES`): radius 0.42 m, height 2.40 m. Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: a long thin arcane notary. Long black robes to the floor with an oxblood front panel edged in gold, a high stiff oxblood collar, wide sleeves with gold cuffs, a gold belt and two swags of gold coins on chains across the chest, grey slicked hair and a calm severe face. Signature: a great red book held upright at his left side and chained to his wrist, a glowing red wax seal on its cover, and a quill staff in the right hand, taller than he is, with a long feather on top.
- HUD portrait (canvas-drawn in the kit data): ruled rows of figures on the wall behind him, the long quill rising behind his shoulder, a tall oxblood collar round a long calm face with grey slicked hair and faintly glowing red eyes, black robes with an oxblood panel and gold coin chains, and the great book at his side with its red wax seal glowing.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-ledger.md`](../../../pipeline/designs/kit-ledger.md) |
| New heroes design | [`pipeline/designs/new-heroes-kits.md`](../../../pipeline/designs/new-heroes-kits.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/ledger.ts`](../../../src/effects/parts/ledger.ts) |
| Spells | [`invoice.ts`](../../../src/spells/targeted/invoice.ts), [`lateFee.ts`](../../../src/spells/targeted/lateFee.ts), [`callItIn.ts`](../../../src/spells/targeted/callItIn.ts), [`foreclosure.ts`](../../../src/spells/targeted/foreclosure.ts) |
| Kit data | [`src/kits/ledger.ts`](../../../src/kits/ledger.ts) |
| Trait | [`src/traits/ledger.ts`](../../../src/traits/ledger.ts) |
| Model | [`public/models/heroes/ledger_v3.glb`](../../../public/models/heroes/ledger_v3.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Sir Whiskers (cat)](cat.md), [Tempo (chrono)](chrono.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
