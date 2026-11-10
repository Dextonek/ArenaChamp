---
title: Bram, the Stonewright (mason kit)
tags: [catalog, heroes, mason, bruiser, melee, pillar]
updated: 2026-11-04
---

# Bram, the Stonewright

The mason hero kit: Bram's four spells (Q, W, E and the R ultimate), his passive, the shared parts file, the palette and the rigged hero model. A broad temple mason in a dark tunic and a leather apron, carved limestone pauldrons on his shoulders, a rune-cut stone maul in his fist and a glowing amber rune on his chest, a calm square-jawed face. He has one friend: Gerald, a limestone pillar with a carved face. Gerald is a real wall with 220 HP. He is cover, a thrown weapon and a way in, and each use spends one of the others. Bram is a melee bruiser with 800 HP.

## Role

| | |
|---|---|
| Role | Bruiser (melee) |
| Signature | Best Friends |
| HP | 800 |
| Kit shapes | Q GROUND raise Gerald (burst + knock-up) · W LINE shove Gerald as a ram · E DASH to Gerald + shield · R LINE topple Gerald |

He wins by building the fight around Gerald: cover to fight beside (15% less damage within 3 m of him), a ram to carry the enemy into a wall, a shield dash, and a falling pillar. His weakness is that without Gerald he is a plain fighter, and anyone can break Gerald (220 HP) or walk away from him. W, E and R cannot be cast without a Gerald within reach.

## At a glance

| | |
|---|---|
| Hero | Bram, the Stonewright |
| Spell category | `hero: mason` |
| Parts file | [`src/effects/parts/mason.ts`](../../../src/effects/parts/mason.ts) |
| Kit data | [`src/kits/mason.ts`](../../../src/kits/mason.ts) |
| Trait (rules) | [`src/traits/mason.ts`](../../../src/traits/mason.ts) |
| Kit sheet | [`kit-mason.md`](../../../pipeline/designs/kit-mason.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/mason_v3.glb`](../../../public/models/heroes/mason_v3.glb) |

## Palette

The `MASON` constant in [`src/effects/parts/mason.ts`](../../../src/effects/parts/mason.ts) (numbers for `THREE.Color`; `MASON_CSS` has the string twins). There is no art bible row for this kit yet. The kit accent is the body colour; the kit foil is a stone grey, `#6d6a66`.

| Core | Hot | Body (accent) | Stone | Stone lit | Stone dark | Foil (chalk) | Dark | Fury | Sweat | Moss |
|---|---|---|---|---|---|---|---|---|---|---|
| `#f6efdc` | `#dcc58f` | `#c9b48a` | `#9a958c` | `#b4afa5` | `#5b5853` | `#e6e0d0` | `#1c1a18` | `#b06a58` | `#8fd3ff` | `#6f8f5a` |

Limestone and sand on a dark floor, a pale chalk foil for the edges, a flushed red-brown for Gerald's temper and a pale blue drop of sweat for his nerves.

## Signature shape and material rules

Gerald and what he leaves behind. A chunky chipped limestone pillar with a big carved face (the same face on the far side, so each player's camera sees one), a dark disc and a pale rim under him so he reads on a bright floor. His mood is in the face: bored, alarmed (a drop of sweat) or angry (the fury colour). He leaves rubble heaps, dust puffs and a long dark shadow when he tips.

- Everything is flat toon stone (flat-shaded standard material) or flat unlit colour: nothing glows, nothing blooms.
- Gerald is drawn by the trait's ground marks on both screens; an effect draws him itself while he tips over in R (and in the VFX tool, where no trait runs).
- The 3 m passive ring round him is a thin chalk ring over a dark layer.

## Passive and twist

| | |
|---|---|
| Passive | Best Friends: one Gerald at a time, a real pillar (it blocks walking, sight and bolts) with 220 HP and a carved face that changes. Within 3 m of him Bram takes 15% less damage. |
| Twist | Cover, weapon or escape? Gerald is cover, a thrown weapon and a way in; each use spends one of the others. W needs Gerald within 3 m, E within 8 m, R any Gerald; they are refused while he is busy sliding ("Gerald is busy", "Too far from Gerald", "Raise Gerald first"). A new Gerald crumbles the old one. |
| Resource or meter | Meter GERALD, max 220 (Gerald's HP now, 0 with no Gerald) |
| Speed | 4.0 m/s |
| Basic attack | melee, 2.5 m, 26 damage every 1.2 s, wind-up 0.35 s, smash look |
| Other rules | Rubble from R slows whoever stands on it (0.6 s, refreshed every tick). Floating words: EXCUSE ME (W), HUG (E), GERALD, NO! (R). |

## Mechanics

Bram uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true`, `maxHp: 800` in the kit data; the duel AI walks up to melee range |
| Obstacle with HP | Gerald: a real obstacle plus a hidden 220 HP unit, drawn by the trait's marks (`raiseGeraldAt` in `src/traits/mason.ts`) |
| Knock-up | Q: 0.5 s |
| Carry and stun | W: the first enemy Gerald touches is carried along; stopped by a wall with them, they are stunned 0.9 s |
| Dash and shield | E: dash to Gerald (`moveCaster`, 0.25 s), shield 60 for 2 s |
| Damage taken cut | The passive: -15% within 3 m of Gerald (`taken`) |
| Cast gates | `canCast` refuses W, E and R without a Gerald in reach |
| Slow zone | R's rubble line (`victimTick`) |
| Flagged `cc` | Q. W and R are `aim: 'line'` |
| Summon (visible), pull, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/mason.ts`), hit time and length from the spell files in `src/spells/targeted/`; the numbers are the spell files' defaults.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [raise gerald](../../../src/spells/targeted/raiseGerald.ts) | ground (r 1.5) | 9 | 6 s | 0.7 s | 2.0 s | A 1.5 m circle marks a spot; dark cracks spread, a pale ring tightens and the ground trembles. At 0.7 s Gerald, a 3.5 m limestone pillar, bursts up: everyone inside the circle takes 76 and a 0.5 s knock-up. He arrives alarmed, then settles into boredom. An older Gerald crumbles into rubble. |
| W | [the shove](../../../src/spells/targeted/theShove.ts) | ground (line, r 1) | 8 | 7 s | slide starts at 0.3 s | 2.3 s | Needs Gerald within 3 m. After a 0.3 s wind-up Gerald slides up to 8 m along the aim at 8 m/s; the line is on the floor from the cast and is cut short by walls. The first enemy within 1.3 m of him takes 70 and is carried along. If he stops on a wall, pillar or the ring edge with someone carried, they are stunned 0.9 s. A full 8 m slide ends with a small thump. |
| E | [a good lean](../../../src/spells/targeted/aGoodLean.ts) | self | 8 | 11 s | none (no damage) | 1.4 s | Needs Gerald within 8 m. He runs at Gerald in 0.25 s and stops 1.5 m short with a chalk ring and a hug: a shield of 60 for 2 s. Gerald did not ask for this. |
| R | [gerald no](../../../src/spells/targeted/geraldNo.ts) | ground (line 10 m x 1.6 m) | 10 | 24 s | 1.0 s | 2.5 s | Ultimate. Needs Gerald. He topples along the aim and a dark shadow, 10 m long and 1.6 m wide, shows for 1.0 s. At 1.0 s he crashes: everyone inside the line takes 150. He breaks into rubble that lies 3 s and slows whoever stands on it; Bram has no pillar afterwards. If Gerald is broken by damage before the crash, the fall fizzles. |

Spell sources: [`raiseGerald.ts`](../../../src/spells/targeted/raiseGerald.ts), [`theShove.ts`](../../../src/spells/targeted/theShove.ts), [`aGoodLean.ts`](../../../src/spells/targeted/aGoodLean.ts), [`geraldNo.ts`](../../../src/spells/targeted/geraldNo.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-mason).

## Parts file

[`src/effects/parts/mason.ts`](../../../src/effects/parts/mason.ts) holds everything the kit's spells share. Spells import it directly (`../../effects/parts/mason`). The pooled parts take world-space positions and have a `reset()`; the builders make one object each (`Trait.markLook`).

| Export | Role |
|---|---|
| `MASON`, `MASON_CSS` | palette constants |
| `GERALD_HEIGHT`, `GERALD_RADIUS` | Gerald's size (used by the trait's obstacle) |
| `buildGerald` | Gerald himself: a chipped limestone pillar with a carved face on both sides, a dark disc and a pale rim under him; the mood (bored, alarmed, angry) is in the face |
| `buildRubble` | a heap of broken stone about 1.4 m across (a mark) |
| `buildDust` | a puff of stone dust (a mark that pops in and shrinks away) |
| `buildAura` | the faint 3 m ring round Gerald (his passive) |
| `GeraldFigure` | a Gerald an effect draws itself, feet at (x, z), turned `yaw`, leaning `tilt` radians (R's topple, and the VFX tool) |
| `StoneChunks` | flying stones that tumble under gravity, bounce once and shrink away |
| `DustPuffs` | pale lumps of stone dust that swell fast, drift up and shrink away |
| `FloorCracks` | a star of dark cracks on the floor round a point (Raise Gerald's warning, the crash) |
| `FlatRing` | a flat ring or disc on the floor with its own colour and opacity |
| `ShadowStrip` | a long dark shadow lying on the floor with a pale chalk edge (R's topple) |
## Model

[`public/models/heroes/mason_v3.glb`](../../../public/models/heroes/mason_v3.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it), built by the `MasonMythic` class (a subclass of `Mason`) in [`blender/heroes/restyle_batch1.py`](../../../blender/heroes/restyle_batch1.py) on top of [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Bram`), and its hit size is in `HERO_BODIES` in the same file (radius 0.59 m, height 2.7 m). Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: a broad, calm temple mason. A dark warm tunic with rolled sleeves, a deep brown leather apron with a gold hem and a chisel through the belt, leather bracers with gold bands on the big forearms, a gold gorget, iron-grey cropped hair and a small closed mouth. Signature: carved limestone pauldrons in two thin gold-edged lames on each shoulder, a rune-cut stone maul with gold bands in the right fist, and a glowing amber rune in a gold ring on the chest.
- HUD portrait (canvas-drawn in the kit data): Bram's head and shoulders: a calm square-jawed face under iron-grey hair, the carved pauldrons and the apron bib with its glowing amber rune in a gold ring, the stone maul over his shoulder, and Gerald as a small grumpy block of limestone in the corner of the frame.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-mason.md`](../../../pipeline/designs/kit-mason.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/mason.ts`](../../../src/effects/parts/mason.ts) |
| Spells | [`raiseGerald.ts`](../../../src/spells/targeted/raiseGerald.ts), [`theShove.ts`](../../../src/spells/targeted/theShove.ts), [`aGoodLean.ts`](../../../src/spells/targeted/aGoodLean.ts), [`geraldNo.ts`](../../../src/spells/targeted/geraldNo.ts) |
| Kit data | [`src/kits/mason.ts`](../../../src/kits/mason.ts) |
| Trait (passive, twist, rules) | [`src/traits/mason.ts`](../../../src/traits/mason.ts) |
| Model | [`public/models/heroes/mason_v3.glb`](../../../public/models/heroes/mason_v3.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Silvane (mirror)](mirror.md), [Hank (timber)](timber.md), [Professor Puff (balloon)](balloon.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
