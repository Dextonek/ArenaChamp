---
title: Hank, the Lumberjack (timber kit)
tags: [catalog, heroes, timber, bruiser, melee, trees]
updated: 2026-11-04
---

# Hank, the Lumberjack

The timber hero kit: Hank's four spells (Q, W, E and the R ultimate), his passive, the shared parts file, the palette and the rigged hero model. A huge bearded man in a red plaid shirt, suspenders, a big double axe, boots and a woolly hat. His trees are real: they grow from a sapling to a full tree, they are cover while they stand, and when he chops one it falls along a strip and hits whoever lies in the way. Bigger trees fall harder. He is a melee bruiser.

## Role

| | |
|---|---|
| Role | Bruiser (melee) |
| Signature | Fresh Cut |
| HP | 780 |
| Kit shapes | Q QUICK cone + felling · W TERRAIN tree with a late hit, 2 charges · E SHOT thrown tree or axe · R TERRAIN row of five + recast dominoes |

He wins by letting trees grow and then chopping them for more damage, or by using them as cover. His weakness is time: saplings are weak (30 HP) and block nothing, and he has no dash. Every tree is cover now or damage later.

## At a glance

| | |
|---|---|
| Hero | Hank, the Lumberjack |
| Spell category | `hero: timber` |
| Parts file | [`src/effects/parts/timber.ts`](../../../src/effects/parts/timber.ts) |
| Kit data | [`src/kits/timber.ts`](../../../src/kits/timber.ts) |
| Trait (rules) | [`src/traits/timber.ts`](../../../src/traits/timber.ts) |
| Kit sheet | [`kit-timber.md`](../../../pipeline/designs/kit-timber.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/timber_v2.glb`](../../../public/models/heroes/timber_v2.glb) |

## Palette

The `TIMBER` constant in [`src/effects/parts/timber.ts`](../../../src/effects/parts/timber.ts) (numbers for `THREE.Color`; `TIMBER_CSS` has the string twins). There is no art bible row for this kit yet. The kit accent is the wood brown and the kit foil is the pine green, `#3f6b3a`; the parts file calls `pale` (sawdust and birch) the foil that shows on the dark floor.

| Core | Hot | Body (accent in kit data) | Accent (plaid red) | Dark | Pine | Leaf | Pale (foil) |
|---|---|---|---|---|---|---|---|
| `#fff0d0` | `#e8b868` | `#b5763a` | `#c8322e` | `#1c120b` | `#3f6b3a` | `#7fbf55` | `#f1e2c0` |

Plaid red, wood brown and pine green, with pale sawdust and birch as the foil.

## Signature shape and material rules

Chunky stylised pines in three stages: a light sapling, a mid young tree and a tall dark full tree, each with a dark footprint disc at its real obstacle radius. Plus a stump, a double axe, a falling tree (8 m long and 1.6 m wide, the strip it hits), a tumbling thrown tree and axe, sawdust and leaves, a flock of birds and a floating word (TIMBER!).

- Everything is pooled, takes world-space positions and has a `reset()`.
- Flat unlit colours, nothing additive, so nothing turns into a white blob under bloom.
- A fall shows its shadow first: a flat dark strip with a pale border, exactly where the hit is checked.

## Passive and twist

| | |
|---|---|
| Passive | Fresh Cut: his trees (3 at most; a fourth makes the oldest fall over harmlessly) grow from a sapling (30 HP, blocks nothing) to a young tree at 1.2 s (120 HP, real cover, radius 0.5) and a full tree at 2.5 s (radius 0.7). Bigger trees fall harder when chopped: 30, 60 or 110. A stump stays 6 s. |
| Twist | Grow or Chop. Let this tree grow for more damage, or chop it now? Every tree is cover now or damage later, and saplings are weak, so break them early. E with no tree in reach throws his axe, and Q is refused ("Fetch your axe") until he walks within 1.5 m of where it landed. |
| Resource or meter | Meter TREES, max 3 (his trees standing) |
| Speed | 3.8 m/s |
| Basic attack | melee, 2.5 m, 22 damage every 1.3 s, wind-up 0.4 s, cleave look |
| Other rules | W has 2 charges, one back every 7 s (`charges`). R has a recast (Timber) open from 1.0 s to 4 s after the cast. The trees of R's row are his for that cast only: they do not count toward the cap of 3 and have no HP. |

## Mechanics

Hank uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true`, `maxHp: 780` in the kit data; Q range is 3 |
| Obstacles with HP | His trees: a hidden unit with HP plus a real pillar (`plantTree` in `src/traits/timber.ts`), drawn by the trait's marks |
| Falling obstacle | Q and R: a tree falls along a strip, shown by a shadow for 0.6 s before it lands |
| Charges | W: 2 charges, 7 s each |
| Recast | R: Timber (`recast`, window 4 s, arm 1.0 s, replay on) |
| Knock-up and knock-back | W knocks up 0.5 s; Q and R throw the enemy along the strip; E knocks back |
| Skillshot | E: a bolt of radius 0.9, 16 m/s, 9 m (`aim: 'line'`) |
| Cast gate | Q refused while the axe is away |
| Flagged `cc` | W |
| Dash, pull, shield, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/timber.ts`), hit time and length from the spell files in `src/spells/targeted/`; the numbers are the spell files' defaults and the trait's constants.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [axe swing](../../../src/spells/targeted/axeSwing.ts) | self (cone r 3, 110 degrees) | 3 | 3 s | swing 0.15 s; the felled tree lands at 0.75 s | about 2.05 s | A quick swing of the double axe: 60 to an enemy in the cone. Any tree of his that the cone touches is chopped (a stump stays) and falls away from him along a strip 8 m long and 1.6 m wide, shown for 0.6 s. Enemies in the strip take 30, 60 or 110 by the tree's stage and are thrown along it. At most 3 trees fall from one swing. |
| W | [fast growth](../../../src/spells/targeted/fastGrowth.ts) | ground (r 1.5) | 6 (at least 1.5 m from him) | 7 s, 2 charges | 0.7 s | 1.8 s | He slams the axe into the ground and a tree sprouts at the spot: a sapling that grows. At 0.7 s anyone within 1.5 m of the spot takes 50 and a 0.5 s knock-up, and roots burst round it. A fourth tree makes the oldest fall over harmlessly. |
| E | [caber toss](../../../src/spells/targeted/caberToss.ts) | line skillshot (ground aim) | 9 | 9 s | thrown at 0.3 s; 16 m/s | up to 3.0 s | He rips up the nearest tree within 3 m (any stage) and hurls it end over end (radius 0.9): 30, 60 or 90 by the tree's stage, and it throws the enemy back. With no tree in reach he throws his axe instead: 30 and a knock of 3. The axe lands on the ground and he must walk to it before he can use Q. |
| R | [timber call](../../../src/spells/targeted/timberCall.ts) | ground (row), recast | 10 | 24 s | the fall: 0.25 s after the recast, then one tree every 0.15 s | the row 9.3 s; the fall 3.65 s | Ultimate. Five trees burst up in a row along the aim, 2 m apart from 2 m to 10 m in front of him, one every 0.1 s: real cover that is full-grown by 1.1 s. Recast from 1.0 s to 4 s: he swings and the trees fall like dominoes along the row, one every 0.15 s, 0.6 s to fall, each with a 5 m strip shown. 90 to anyone in a strip when its tree lands, thrown along it; one enemy takes 3 hits at most. With no recast the row falls harmlessly at about 7.3 s. |

Spell sources: [`axeSwing.ts`](../../../src/spells/targeted/axeSwing.ts), [`fastGrowth.ts`](../../../src/spells/targeted/fastGrowth.ts), [`caberToss.ts`](../../../src/spells/targeted/caberToss.ts), [`timberCall.ts`](../../../src/spells/targeted/timberCall.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-timber).

## Parts file

[`src/effects/parts/timber.ts`](../../../src/effects/parts/timber.ts) holds everything the kit's spells share. Spells import it directly (`../../effects/parts/timber`). Everything is pooled, takes world-space positions and has a `reset()`.

| Export | Role |
|---|---|
| `TIMBER`, `TIMBER_CSS` | palette constants (`pale` is the foil) |
| `TREE_HEIGHT`, `FALL_LENGTH`, `FALL_WIDTH` | tree height and the felled strip (8 m by 1.6 m) |
| `buildTree`, `buildStump`, `buildAxe`, `buildAxeMark` | builders (one object each, for `Trait.markLook`): a tree in three stages, a stump, the double axe, and the axe lying in its 1.5 m ring |
| `TreeFalls` | trees toppling: each pivots on its base with an accelerating fall, bounces once, lies 0.7 s and sinks; `harmless` is a slower, lighter fall with no bounce |
| `FallShadows` | the shadow of a tree about to land: a flat dark strip with a pale border, drawn exactly where the hit is checked |
| `ThrownProp` | one tumbling thing for Caber Toss: a tree about 2.6 m long or a huge double axe, spinning end over end |
| `Chips` | chips, leaves and sawdust |
| `Birds` | a flock that bursts out of a tree, wings about 0.7 m across |
| `FloatingWord` | a big outlined word floating up from a spot (TIMBER!) |
| `Swipe` | the swing of the axe over a flat cone: a dark fan with a pale rim and a bright leading edge; `fire(at, yaw, radius, angleDeg)` |
| `RootBurst` | roots bursting round a spot (Fast Growth) |
## Model

[`public/models/heroes/timber_v2.glb`](../../../public/models/heroes/timber_v2.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the current style, the `_v2` models). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Hank`), and its hit size is in `HERO_BODIES` in the same file (radius 0.61 m, height 2.69 m).
- HUD portrait (canvas-drawn in the kit data): Pines behind him and a double axe over his shoulder.


## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-timber.md`](../../../pipeline/designs/kit-timber.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/timber.ts`](../../../src/effects/parts/timber.ts) |
| Spells | [`axeSwing.ts`](../../../src/spells/targeted/axeSwing.ts), [`fastGrowth.ts`](../../../src/spells/targeted/fastGrowth.ts), [`caberToss.ts`](../../../src/spells/targeted/caberToss.ts), [`timberCall.ts`](../../../src/spells/targeted/timberCall.ts) |
| Kit data | [`src/kits/timber.ts`](../../../src/kits/timber.ts) |
| Trait (passive, twist, rules) | [`src/traits/timber.ts`](../../../src/traits/timber.ts) |
| Model | [`public/models/heroes/timber_v2.glb`](../../../public/models/heroes/timber_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Silvane (mirror)](mirror.md), [Bram (mason)](mason.md), [Professor Puff (balloon)](balloon.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
