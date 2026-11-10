---
title: Pim and Pom, the Changeling Twins (twins kit)
tags: [catalog, heroes, twins, fighter, two-kit, mechanics]
updated: 2026-11-04
---

# Pim and Pom, the Changeling Twins

The twins hero kit: one hero in two halves, fae children in leaf and bark clothes with long pointed ears. Pim (amber tunic, bark acorn-cap helm, wooden sword with a glowing amber edge, melee) and Pom (blue tunic, blue leaf hood, slingshot with a glowing blue band, ranged) share one bar of 620 HP and one trait. Each has his own Q, W and E, model, portrait and basic attack; R is the same Tag Out for both. It is built on the [combat mechanics](../../architecture/mechanics.md): `HeroKit.alt` and `TraitView.swapKit` bring in the other half, `HeroKit.hpChunks` cuts the bar in two.

## Role

| | |
|---|---|
| Role | Fighter (melee or ranged, by the twin who is in) |
| Signature | Tag Team |
| HP | 620 in all (310 each), `hpChunks: 2` |
| Kit shapes | Pim: Q CONE · W DASH · E BUFF shield. Pom: Q BOLT · W ZONE root · E DASH + trap. R: swap (both) |

Pim fights up close, Pom from a distance. Each round starts on Pim.

## At a glance

| | |
|---|---|
| Hero | Pim and Pom, the Changeling Twins |
| Spell category | `hero: twins` |
| Parts file | [`src/effects/parts/twins.ts`](../../../src/effects/parts/twins.ts) |
| Kit data | [`src/kits/twins.ts`](../../../src/kits/twins.ts) (`twinsKit` is Pim, `twinsKit.alt` is Pom) |
| Trait | [`src/traits/twins.ts`](../../../src/traits/twins.ts) |
| Kit sheet | [`kit-twins.md`](../../../pipeline/designs/kit-twins.md) |
| Models | [`pim_v3.glb`](../../../public/models/heroes/pim_v3.glb), [`pom_v3.glb`](../../../public/models/heroes/pom_v3.glb) |

## Palette

Toy colours: flat and bright with a dark outline and small stars. Constants `TWINS` and `TWINS_CSS` in the parts file. Pim's accent is orange and his foil blue; Pom's accent is blue and her foil orange.

| Pim | Pim mid | Pom | Pom mid | Wood | Yellow | Pink | Green | Dark |
|---|---|---|---|---|---|---|---|---|
| `#ffb04a` | `#d98c34` | `#6ac8ff` | `#3f9fd6` | `#b07a40` | `#ffd24a` | `#ff7aa8` | `#7ed87e` | `#1a1424` |

## Signature shape and material rules

Toys. Cartoon words (BONK, RAAH, PING, GOTCHA, POP, TAG!, MY TURN), confetti in the twins' colours, spiky stars and rings, all with a dark outline. Nothing is realistic.

- Confetti: bits in orange, blue, yellow, pink and green.
- Props: a wooden sword, a slingshot with a pink band, a rope net with blue weights, a toy shield, a party popper.

## Passive and twist

| | |
|---|---|
| Passive | Tag Team. One hero, two twins on one bar of 620 HP: 310 each. Damage comes off the twin who is in; at 0 he is tagged out at once. The twin who rests heals 6 HP a second. Tag Out takes 0.5 s, and the twin who comes in has his next spell 2 s sooner. |
| Twist | Who is in? Pim fights up close, Pom from a distance, and each has a spell the other wants. |
| Meter | REST, max 310: the resting twin's share. |
| Speed | 4.2 m/s. |
| Basic attack | Pim: melee, range 2.4, damage 16, every 0.9 s, look `sweep`. Pom: ranged, range 6, damage 12, every 0.9 s, speed 20, look `dart` (`HeroKit.attack`). |
| Pips | Both shares are shown to both players over the hero (`ownLook`, shape `gem`): `pimHp` orange, `pomHp` blue, one pip per 62 HP. |
| Hooks | `ring` (keeps the book of which twin is in, draws nothing), `canCast`, `afterCast`, `tick`, `ownChanged`, `badge`, `aiHold`. |

- The trait keeps each twin's share in `mem` on its own client and holds `pim + pom = real HP` by watching the real HP in `tick`, not in `taken` (a hit is seen there before a shield soaks it).
- A twin with under 15 HP cannot be tagged in. A twin at 0 is tagged out at once, with no hold. When both are at 0 the hero is dead.
- Tag Out cuts the next-ready cooldown among Q, W and E of the incoming twin by 2 s. Cooldowns stay per slot.
- The CPU tags out when the twin in is under 35% of his share and the other has more, when the enemy is past 6 m and Pim is in, or when the enemy is within 3 m and Pom is in. It raises Shield Up only with Pim in and the enemy within 4.5 m.

## Mechanics

| Mechanic | Where |
|---|---|
| Two kits | `HeroKit.alt` (Pom), `base` (set in `src/heroes.ts`), `attack` per half, `TraitView.swapKit` on both screens (`show('twin', n)` and `ownChanged`) |
| HP chunks | `hpChunks: 2`: the bar is cut into two equal parts for both players |
| Hold | Tag Out holds him still 0.5 s (`t.hold`) |
| Dash | Pim's Charge and Pom's Backflip (`dash: true`, `ctx.moveCaster`); Backflip also has `escape: true` |
| Skillshot | Pom's Pebble (`aim: 'line'`, a real bolt) |
| Crowd control | Snare (`cc: true`, root 1 s) |
| Shield | Pim's Shield Up, made in the trait's `afterCast` |
| Tag Out | `anytime: true` on R: the duel AI casts it by the trait's rules, not as an ultimate |
| Summon, pull, silence | none |

## Spells

All play under the normal gameplay camera. Range and cooldown come from the kit data, numbers from `src/traits/twins.ts`, length from the spell files. Some spell-file headers still carry older damage numbers; the table uses the trait constants.

| Twin | Key | Label | Targeting | Range | Cooldown | Length | What happens |
|---|---|---|---|---|---|---|---|
| Pim | Q | [bonk](../../../src/spells/targeted/pimBonk.ts) | ground CONE (100 degrees) | 3 | 3 s | 1.5 s | He hauls the toy sword up (0.45 s wind-up), then brings it down across a 3 m cone: a star, confetti and BONK. Damage 72, a small knock-back. |
| Pim | W | [pim charge](../../../src/spells/targeted/pimCharge.ts) | ground DASH (lane 1.6 m wide) | 5 | 9 s | 1.6 s | He digs in for 0.4 s, then runs the aimed distance (2 to 5 m) in 0.2 s. Everyone in the lane when he arrives takes 56 and is shoved ahead of him. |
| Pim | E | [shield up](../../../src/spells/targeted/pimShieldUp.ts) | self | 0 | 10 s | 2.5 s | A toy shield pops up in front of him. Shield 50 for 2 s. No damage. |
| Pom | Q | [pebble](../../../src/spells/targeted/pomPebble.ts) | ground LINE (bolt, radius 0.3) | 9 | 3 s | 1.8 s | She pulls the band back (0.3 s) and fires a real bolt at 22 m/s. Damage 66. |
| Pom | W | [snare](../../../src/spells/targeted/pomSnare.ts) | ground ZONE (r 2) | 7 | 9 s | 2.7 s | A net lands on the circle after 1.0 s. Whoever is inside takes 30 and is rooted for 1 s. |
| Pom | E | [backflip](../../../src/spells/targeted/pomBackflip.ts) | ground DASH | 4 | 10 s | 1.6 s | She hops 4 m toward the aim in 0.3 s and leaves a party popper (r 1.5). It goes off 0.65 s after the cast for 40 and a shove. |
| both | R | [tag out](../../../src/spells/targeted/tagOut.ts) | self | 0 | 8 s | 1.5 s | A 0.5 s hold while the other twin pops out of the backpack and the two high-five. Then the kit swaps. No damage. |

Their catalog rows are in the [effect catalog](../effects.md#hero-twins).

## Parts file

[`src/effects/parts/twins.ts`](../../../src/effects/parts/twins.ts) holds what the spells share.

| Export | Role |
|---|---|
| `TWINS`, `TWINS_CSS`, `CONFETTI` | palette constants and the confetti colours |
| `Dust` | re-export of `Puffs` from the mole parts |
| `toon` | outlines a geometry |
| `ToyWords` | the cartoon words |
| `Confetti`, `Streaks`, `ToyRing` | confetti, speed streaks, rings |
| `WoodSword`, `Slingshot`, `PebbleBolt`, `RopeNet`, `ToyShield`, `Popper`, `ball` | the props |
| `TwinPuppet` | the twin who pops out of the backpack |

## Model

Two rigged figures, [`pim_v3.glb`](../../../public/models/heroes/pim_v3.glb) and [`pom_v3.glb`](../../../public/models/heroes/pom_v3.glb), one per half, built by the `TwinMythic` base class and its `PimMythic` and `PomMythic` subclasses in [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py). Each half sets its own `model` in the kit data (still the `_v2` paths until the switch in `src/heroes.ts` and the kit data is made). Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` files stay beside them. Hero body size for hits is radius 0.38, height 2.39 under `Pim and Pom` in `HERO_BODIES` in [`src/heroes.ts`](../../../src/heroes.ts).

- Look: one body between them (same joints, head, pointed ears, hair, legs, boots, height and stance), so swapping in play changes only what they wear and hold. Both wear a short tunic with a hem of hanging leaves, a collar of small leaves, dark moss leggings, bark boots with a gold cuff, bark bracers, a bark belt with a gold leaf clasp and a small woven satchel on the back (the backpack with a twin's head in it is gone). Pim: an amber tunic, a bark acorn-cap helm with an amber leaf crest, a wooden sword whose edges glow amber. Pom: a deep blue tunic, a blue leaf hood with a glowing bead on its point and the pointed ears out at the sides, a slingshot with a glowing blue band and stone.
- HUD portraits (canvas-drawn in the kit data): Pim with his acorn-cap helm and amber leaf crest, big green eyes and pointed ears, an amber leaf-collared tunic, the glowing-edged sword behind him and Pom's blue hood small over his shoulder; Pom in her blue leaf hood with a glowing bead, the slingshot with a glowing blue band and stone, and Pim's helm small in the corner.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-twins.md`](../../../pipeline/designs/kit-twins.md) |
| Parts | [`src/effects/parts/twins.ts`](../../../src/effects/parts/twins.ts) |
| Spells | [`pimBonk.ts`](../../../src/spells/targeted/pimBonk.ts), [`pimCharge.ts`](../../../src/spells/targeted/pimCharge.ts), [`pimShieldUp.ts`](../../../src/spells/targeted/pimShieldUp.ts), [`pomPebble.ts`](../../../src/spells/targeted/pomPebble.ts), [`pomSnare.ts`](../../../src/spells/targeted/pomSnare.ts), [`pomBackflip.ts`](../../../src/spells/targeted/pomBackflip.ts), [`tagOut.ts`](../../../src/spells/targeted/tagOut.ts) |
| Kit data | [`src/kits/twins.ts`](../../../src/kits/twins.ts) |
| Trait | [`src/traits/twins.ts`](../../../src/traits/twins.ts) |
| Models | [`pim_v3.glb`](../../../public/models/heroes/pim_v3.glb), [`pom_v3.glb`](../../../public/models/heroes/pom_v3.glb) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
