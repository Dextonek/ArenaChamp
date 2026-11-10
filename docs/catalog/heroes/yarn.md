---
title: Grandma Ironknit, the Weaver (yarn kit)
tags: [catalog, heroes, yarn, support, ranged, lines, summon, mechanics]
updated: 2026-11-04
---

# Grandma Ironknit, the Weaver

The yarn hero kit: Grandma Ironknit's four spells (Q, W, E and the R ultimate), the passive yarn lines, the shared parts file, the palette row and the rigged hero model. A tiny old fate-spinner in a dark hooded shawl knitted in bands of rose thread, with two knitting needles as long as swords and a spindle of glowing rose yarn spools behind her shoulder. She is built on the [combat mechanics](../../architecture/mechanics.md): a ranged support who ties yarn lines across the arena and sends out a cat.

## Role

| | |
|---|---|
| Role | Support (ranged) |
| Signature | Keep Warm |
| HP | 620 |
| Kit shapes | Q LINE needle · W LINE yarn (two charges) · E TARGET sweater · R SUMMON cat |

She wins by stringing the arena: a line catches an enemy who walks across it, and her cat sits on whoever it reaches. Her weakness is that one hit of any size cuts a line, and a line tied to nothing is easy to walk round.

## At a glance

| | |
|---|---|
| Hero | Grandma Ironknit, the Weaver |
| Spell category | `hero: yarn` |
| Parts file | [`src/effects/parts/yarn.ts`](../../../src/effects/parts/yarn.ts) |
| Kit data | [`src/kits/yarn.ts`](../../../src/kits/yarn.ts) |
| Trait | [`src/traits/yarn.ts`](../../../src/traits/yarn.ts) |
| Kit sheet | [`kit-yarn.md`](../../../pipeline/designs/kit-yarn.md) |
| Model | [`public/models/heroes/yarn_v3.glb`](../../../public/models/heroes/yarn_v3.glb) |

## Palette

Warm rose wool, pale horn-coloured needles, a dark wine layer under every bright strand. Flat unlit colour only: no additive glow, wool does not shine. Constants `YARN` and `YARN_CSS` in the parts file; the kit accent is the pink and the foil the horn.

| Pink (accent) | Hot | Core | Foil | Wine | Ink | Cream | Grey |
|---|---|---|---|---|---|---|---|
| `#e86a9a` | `#ff9cc4` | `#fff0f6` | `#c8c0a8` | `#7a2a4c` | `#2a1020` | `#f2e6d0` | `#9a9aa6` |

## Signature shape and material rules

A ball of wool with a strand pulled out and a long needle through it. A line is a sagging strand of rose wool with knots; a loose line is tied to nothing and ends in a loose ball on the floor; a cut line is drawn as a snip.

- Flat unlit colour, no additive glow.
- Lines are the trait's `marks`, drawn with `yarnLook`, `yarnLooseLook` and `snipLook` (1 m along z with its feet at y 0; the engine stretches z to the line's length).

## Passive and twist

| | |
|---|---|
| Passive | Keep Warm. Her yarn lines tie between her, pillars and walls (Cast On): three at most, the oldest goes. An enemy who walks across one is stuck 0.4 s, then slowed 1 s, and the line stays until it is cut. One hit of any size cuts it. She crosses her own freely. |
| Twist | Where To String It. Yarn on your path, or round her for safety. A line tied to nothing, out in the open, is easy to walk round and easy to cut. |
| Meter | YARN, max 3: the lines standing. |
| Speed | 3.8 m/s. |
| Basic attack | Ranged, range 5.5, damage 12, every 0.9 s, wind-up 0.25 s, speed 20, look `dart`. |
| Charges | W has 2 charges, one back every 6 s; its cooldown is a 0.6 s gap. |
| Hooks | `marks` and `markLook` (the lines), `victimTick` (keeps each line unit between the enemy and her, tests the crossing), `dealt` (Mr. Biscuit's hits carry a slow), `landed` (her words), `enemyLabel` (TANGLED, KEEP WARM), `tick`, `peerNote`, `ownChanged`, `aiHold`, `badge`. |

- Each line is a bolt wall and a 1 HP unit; units count toward the cap of 6 a side, so three lines and Mr. Biscuit are 4. A line stays until it is cut (it has no timer of its own).
- A crossing is tested against the enemy's last place: stuck 0.4 s (`CROSS_ROOT`), then slowed 1 s (`CROSS_SLOW`).
- Mr. Biscuit stops to play with a loose end when one of her lines is cut within 4 m of him.
- The CPU casts Cast On only with the enemy 3 to 9 m away and Mr. Biscuit within 9 m.

## Mechanics

Grandma Ironknit uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 9 m, 22 m/s, radius 0.3 |
| Lines | W ties a line to the nearest cover or 9 m out: a bolt wall and a 1 HP unit, so one hit cuts it |
| Charges | W has 2 charges (see the passive) |
| Root and slow | a crossing roots 0.4 s then slows 1 s; the sweater slows 2 s; Mr. Biscuit's hits slow 1 s |
| Sight | E needs sight at the cast and again at the hit |
| Summon | R summons Mr. Biscuit with `ctx.summon`: 200 HP, 6 s, 4.5 m/s, 25 damage a second |
| Dash, pull, silence, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/yarn.ts`), numbers from `src/traits/yarn.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [knitting needle](../../../src/spells/targeted/knittingNeedle.ts) | ground LINE (bolt, radius 0.3) | 9 | 3.5 s | 0.3 s (throw) | about 1.8 s | She pulls a needle as long as a sword out of her bun and holds it up over the wind-up, a loose strand of rose wool trailing from its knob, then throws it end first, turning on its axis with a wavy thread behind it. It reaches 6 m at 0.57 s. A hit pops a pink star and a puff of wool; a miss sticks where it stops, quivers and fades. Damage 62. |
| W | [cast on](../../../src/spells/targeted/castOn.ts) | ground LINE (to the nearest cover, up to 9 m) | 9 | 0.6 s (2 charges) | 0.4 s (the tie) | 1.1 s | She lifts a ball of wool from her basket (0.15 s) and throws it along the aim; it runs out across the floor trailing a sagging strand of rose wool to the nearest cover and ties off with a knot and a puff of wool at 0.4 s. With no cover the line ends 9 m out in a loose ball on the floor and still works. Three lines stand; a fourth takes the oldest. She is rooted until it ties. No damage; a crossing sticks 0.4 s then slows 1 s. |
| E | [sweater](../../../src/spells/targeted/sweater.ts) | enemy (needs sight) | 7 | 11 s | 0.5 s (lands), 2.5 s (shrinks) | 3.4 s | She holds up a knitted sweater and throws it along a high arc at the enemy; a red circle on their feet follows them. At 0.5 s, if she still sees them and they are within 9 m, the sweater lands: slowed 2 s, a sweater drawn on them tightening, and KEEP WARM over their head. At 2.5 s it shrinks and hits, with a pop of wool, and she says "ooh, it suits you". Otherwise it falls and unravels. Reaching cover in the 0.5 s is the answer. Damage 50, slow 2 s. |
| R | [mr biscuit](../../../src/spells/targeted/mrBiscuit.ts) | summon (hits up to 10 targets) | 0 (self) | 24 s | 0.4 s (he springs out) | about 7.2 s | She tips a big ball of wool out of her basket; it wobbles and swells for 0.4 s and bursts, and Mr. Biscuit, a big grey cat, springs out and runs at the enemy at 4.5 m/s. He has 200 HP and stays 6 s. In reach he pounces and sits on them, and every hit slows. He stops to play with a loose end when one of her lines is cut within 4 m. He puffs into wool when he goes. Damage 25 a second, slow 1 s. |

Spell sources: [`knittingNeedle.ts`](../../../src/spells/targeted/knittingNeedle.ts), [`castOn.ts`](../../../src/spells/targeted/castOn.ts), [`sweater.ts`](../../../src/spells/targeted/sweater.ts), [`mrBiscuit.ts`](../../../src/spells/targeted/mrBiscuit.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-yarn).

The headers of `knittingNeedle.ts` and `sweater.ts` still say 50 and 40 damage; the numbers above are the constants in `src/traits/yarn.ts` (`NEEDLE_DAMAGE` 62, `SWEATER_DAMAGE` 50).

## Parts file

[`src/effects/parts/yarn.ts`](../../../src/effects/parts/yarn.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `YARN`, `YARN_CSS` | palette constants |
| `LINE_HEIGHT`, `LINE_SAG`, `lineY` | the height and sag of a line |
| `StrandTube`, `strandPoints` | a thin tube along any list of points, rebuilt each frame (a thread in flight, a strand of wool) |
| `yarnLook`, `yarnLooseLook`, `snipLook` | what a standing line, a line tied to nothing and a cut line look like on the floor (`Trait.markLook`) |
| `Needles`, `NEEDLE_LEN` | pooled knitting needles, as long as swords, that fly end first |
| `YarnBalls` | pooled balls of wool |
| `Fluff` | fibres and lint that fly and fall |
| `Sweater` | a knitted jumper that is thrown, worn and shrinks |
| `catLook`, `CatState` | Mr. Biscuit, a big grey cat (a `MinionLook`) |

## Model

[`public/models/heroes/yarn_v3.glb`](../../../public/models/heroes/yarn_v3.glb): a rigged figure built by the `YarnMythic` class in [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Grandma Ironknit`); hero body size is radius 0.54, height 2.33 in `HERO_BODIES`. Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: a tiny old fate-spinner, unhurried. A long dark aubergine robe with a gold hem and a rose-thread belt, a dark wine hooded shawl knitted in bands of rose thread with a gold brooch, the hood up round her face with a rolled rose edge and its point falling down her back, silver hair at the brow, calm big eyes and a small kind smile (no glasses). Signature: two silver knitting needles as long as swords held out like a duellist, gold at the butts, half a rose-and-wine scarf on the right one, and a spindle standing up behind her left shoulder with three glowing rose yarn spools in gold flanges. Mr. Biscuit is not in the model; the kit draws him.
- HUD portrait (canvas-drawn in the kit data): a dark wine ground with loose strands of rose wool, a spindle with three glowing rose spools behind her shoulder, a grey cat's head by her shoulder, a dark wine shawl knitted in bands of rose thread with a gold brooch, a dark hood with a rolled rose edge round a kind old face with silver hair at the brow, calm eyes and a small smile, and two silver needles crossed in front of her.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-yarn.md`](../../../pipeline/designs/kit-yarn.md) |
| Parts | [`src/effects/parts/yarn.ts`](../../../src/effects/parts/yarn.ts) |
| Spells | [`knittingNeedle.ts`](../../../src/spells/targeted/knittingNeedle.ts), [`castOn.ts`](../../../src/spells/targeted/castOn.ts), [`sweater.ts`](../../../src/spells/targeted/sweater.ts), [`mrBiscuit.ts`](../../../src/spells/targeted/mrBiscuit.ts) |
| Kit data | [`src/kits/yarn.ts`](../../../src/kits/yarn.ts) |
| Trait | [`src/traits/yarn.ts`](../../../src/traits/yarn.ts) |
| Model | [`public/models/heroes/yarn_v3.glb`](../../../public/models/heroes/yarn_v3.glb) |
| Model script | [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py) (the `_v3` class), [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the old class and the build kit) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mum (mime)](mime.md), [Sir Whiskers (cat)](cat.md), [Bo (sheep)](sheep.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
