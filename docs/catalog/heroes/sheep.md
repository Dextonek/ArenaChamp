---
title: Bo, the Ramherd (sheep kit)
tags: [catalog, heroes, sheep, summoner, ranged, wool, mechanics]
updated: 2026-11-04
---

# Bo, the Ramherd

The sheep hero kit: Bo's four spells (Q, W, E and the R ultimate), the passive wool, the shared parts file, the palette row and the rigged hero model. A grave old mountain herdsman-druid in a shaggy umber wool cloak and a silver beard, with great ram horns curling from a bronze headband and a tall crook hung with a glowing bell. He is built on the [combat mechanics](../../architecture/mechanics.md): a ranged summoner whose sheep walk to whoever is nearest, him or the enemy.

## Role

| | |
|---|---|
| Role | Summoner (ranged) |
| Signature | Wool Over Your Eyes |
| HP | 640 |
| Kit shapes | Q CONE crook · W SUMMON three sheep · E LINE wool ball (needs a sheep) · R LINE stampede |

He wins by loading the enemy with Wool: every touch of a sheep, the wool ball or a stampede sheep adds Wool, and at 5 Wool the enemy is a sheep for 1 s. His weakness is the flock: where he stands decides where it goes, and a sheep has only 30 HP.

## At a glance

| | |
|---|---|
| Hero | Bo, the Ramherd |
| Spell category | `hero: sheep` |
| Parts file | [`src/effects/parts/sheep.ts`](../../../src/effects/parts/sheep.ts) |
| Kit data | [`src/kits/sheep.ts`](../../../src/kits/sheep.ts) |
| Trait | [`src/traits/sheep.ts`](../../../src/traits/sheep.ts) |
| Kit sheet | [`kit-sheep.md`](../../../pipeline/designs/kit-sheep.md) |
| Model | [`public/models/heroes/sheep_v3.glb`](../../../public/models/heroes/sheep_v3.glb) |

## Palette

Fluffy lumpy wool kept mid-tone (about 0.7 of white), a black face and legs, dark wood and a little hay yellow and anger red. The game's bloom turns anything brighter into a white halo, so the cream accent belongs to the UI and the words, never to a large area. Constants `SHEEP` and `SHEEP_CSS` in the parts file.

| Accent (cream) | Foil (wood) | Wool | Wool shade | Wool high | Black | Skin (shorn) | Hay | Rage |
|---|---|---|---|---|---|---|---|---|
| `#f0ead6` | `#7a5a3a` | `#b8b2a4` | `#9a9486` | `#c4beaf` | `#1e1a19` | `#d9a89a` | `#c9b26a` | `#e0603a` |

## Signature shape and material rules

The lumpy cloud of a sheep with its black face and four stick legs, and the shepherd's crook of dark wood.

- Everything is pooled or built once. Dust and wool tufts reuse the `Puffs` and `Clods` of the mole parts (exported as `Dust` and `Tufts`).
- A sheared sheep shows a pink, skinny body and trots faster.
- The Wool count over the enemy and the sheep drawn when it turns into one are the trait's `marks`, `enemyScale` and `enemyLabel`.

## Passive and twist

| | |
|---|---|
| Passive | Wool Over Your Eyes. His sheep walk to whoever is nearest, Bo or you. Each touch adds Wool; at 5 Wool you are a sheep for 1 s: no casting, slow. A sheep has 30 HP and blocks bolts. |
| Twist | Where He Stands. Where Bo stands decides where the flock goes. Stand far from him and they come to you. Kill them, or lead them off. |
| Meter | SHEEP, max 6: the sheep alive. |
| Speed | 3.9 m/s. |
| Basic attack | Ranged, range 6, damage 9, every 0.9 s, wind-up 0.25 s, speed 18, look `sand` in hay yellow `#c9b26a`. |
| Hooks | `dealt` (adds the Wool), `victimTick` (turns the enemy into a sheep), `enemyScale` (the enemy is drawn at 62%), `enemyLabel` (BAA), `marks`, `canCast` (Shear needs a sheep within 6 m, Spare Sheep needs room), `tick`, `afterCast`, `aiHold`, `badge`. |

- Each touch of a sheep (damage 7 every 1.1 s, speed 3.4), each hit of a Stampede sheep and the wool ball add Wool (the ball 3, the rest 1). Wool lasts 8 s and caps at 5 (`addStacks('wool', n, 8, 5)`).
- At 5 Wool the Wool is gone and the enemy is a sheep for 1 s: silenced, slowed, drawn at 62% size with a little sheep over their head and the word BAA.
- A shorn sheep walks at 1.5 and cannot be shorn again; it still bumps for Wool.
- Six units a side at most: three sheep from Spare Sheep, plus a sheep a Crook Whack leaves. Stampede sheep are not units and do not count.
- The CPU casts Q within 4 m, W with the enemy within 8 m, E with an unsheared sheep within 6 m and R with the enemy within 10 m.

## Mechanics

Bo uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Summon | W summons three sheep (`ctx.summon`): 30 HP, 6 s, they walk to the nearest of him and the enemy. A Crook Whack that hits the enemy hero leaves one more at their feet |
| Projectile | E is a real bolt (`ctx.projectile`): 8 m, 20 m/s, radius 0.3 |
| Wool stacks | the passive (see above) |
| Silence and slow | the sheep state: 1 s |
| Enemy scale | the enemy is drawn at 62% as a sheep |
| Drawn sheep | R's eight sheep are drawn only (`SheepHerd`); hits are decided on the enemy's live position |
| Dash, pull, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/sheep.ts`), numbers from `src/traits/sheep.ts`, hit time and length from the spell files in `src/spells/targeted/`. In a network duel there is no `ctx.summon` on the victim's screen for some of these: the effect only draws and the sheep come from the owner's client.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [crook whack](../../../src/spells/targeted/crookWhack.ts) | self CONE (4 m, 100 degrees) | 4 | 3.5 s | 0.55 s | 1.4 s | He hauls his crook over his shoulder and shakes it, red in the face, for 0.55 s (the wobble grows), then brings it down across the cone: a pale wedge of swept ground, a fan of wool tufts and dust. A hit on the enemy hero also leaves a sheep at their feet (when the flock has room). He is rooted until the swing. Damage 58. |
| W | [spare sheep](../../../src/spells/targeted/spareSheep.ts) | ground (summon, ring r 2) | 8 | 8 s | 0.5 s (they land) | 1.4 s | He points his crook and bellows; three sheep are flung out of his coat in high arcs with a pale ring on the ground at the spot, and land 0.5 s later with a ring of dust, wool tufts and a little baa over each. With four alive only two come down, with six none. No damage. Three sheep, 30 HP each, 6 s. |
| E | [shear](../../../src/spells/targeted/shear.ts) | ground LINE (bolt, radius 0.3; needs a sheep within 6 m) | 8 | 11 s | 0.25 s (launch) | 1.4 s | He grabs the nearest sheep that still has its wool and shears it in one furious stroke: the fleece bursts off in a cloud of tufts and a loud baa, and the sheep runs on naked, pink and fast. The wool streams into his fist and he throws it as a spinning ball. The ball reaches 6 m at 0.55 s and stops at cover and units. Damage 50 and 3 Wool. |
| R | [stampede](../../../src/spells/targeted/stampede.ts) | ground LINE (12 m by 4 m strip) | 12 | 22 s | 0.8 s | 2.9 s | He whirls his crook over his head and bellows; for 0.8 s eight sheep gather abreast of him, bouncing on the spot. At 0.8 s (one short impact frame) they bolt down the line at 8 m/s, a rocking rush of wool with dust and tufts. An enemy inside the strip and within 0.75 m of a sheep is hit once per sheep, three at most, each adding 1 Wool. A pillar or wall on the centre line shortens the line. Damage 30 per sheep (90 at most). |

Spell sources: [`crookWhack.ts`](../../../src/spells/targeted/crookWhack.ts), [`spareSheep.ts`](../../../src/spells/targeted/spareSheep.ts), [`shear.ts`](../../../src/spells/targeted/shear.ts), [`stampede.ts`](../../../src/spells/targeted/stampede.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-sheep).

The headers of `crookWhack.ts`, `shear.ts` and `stampede.ts` still say 45, 40 and 25 damage; the numbers above are the constants in `src/traits/sheep.ts` (`CROOK_DAMAGE` 58, `SHEAR_DAMAGE` 50, `STAMPEDE_DAMAGE` 30).

## Parts file

[`src/effects/parts/sheep.ts`](../../../src/effects/parts/sheep.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `SHEEP`, `SHEEP_CSS` | palette constants |
| `Tufts`, `Dust` | wool tufts and dust, the `Clods` and `Puffs` of [`mole.ts`](../../../src/effects/parts/mole.ts) |
| `shornBodies`, `sheepLook` | the `MinionLook` of a summoned sheep; a sheared sheep shows a pink, skinny body and trots faster |
| `SheepHerd` | the drawn sheep of a Stampede (not summons): one instanced mesh of eight, each bouncing and rocking |
| `Crook` | the crook in Bo's fist (it shakes in fury) |
| `WoolBall` | the ball of wool Shear throws |
| `BaaWords` | the little BAA words |
| `sheepMarkLook` | the ground mark look |

## Model

[`public/models/heroes/sheep_v3.glb`](../../../public/models/heroes/sheep_v3.glb): a rigged figure built by the `SheepMythic` class in [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Bo`); hero body size is radius 0.53, height 2.4 in `HERO_BODIES`. Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: a grave, unhurried old herdsman. A deep umber shaggy wool cloak to the knees (wool tufts melted into one fleece surface) with a grey fleece mantle on the shoulders and fleece hem, a dark leather belt with a gold buckle, dark boots with gold cuffs, a weathered face with a small nose, level grey brows and steady eyes under a bronze headband, a tidy silver beard with a gold ring at its end. Signature: a pair of great curled ram horns springing from the headband, and a tall crook of dark wood taller than anyone with a glowing warm bell hanging from its hook. The cartoon sheep stays in the kit, not on the model.
- HUD portrait (canvas-drawn in the kit data): a dusk-green pasture ground, the crook up beside his head with a glowing warm bell on its hook, a deep umber wool cloak with a grey fleece mantle, a tidy silver beard under a calm weathered face with level grey brows and steady eyes, grey hair under a bronze headband, and a great ram horn curling from each temple.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-sheep.md`](../../../pipeline/designs/kit-sheep.md) |
| Parts | [`src/effects/parts/sheep.ts`](../../../src/effects/parts/sheep.ts) |
| Spells | [`crookWhack.ts`](../../../src/spells/targeted/crookWhack.ts), [`spareSheep.ts`](../../../src/spells/targeted/spareSheep.ts), [`shear.ts`](../../../src/spells/targeted/shear.ts), [`stampede.ts`](../../../src/spells/targeted/stampede.ts) |
| Kit data | [`src/kits/sheep.ts`](../../../src/kits/sheep.ts) |
| Trait | [`src/traits/sheep.ts`](../../../src/traits/sheep.ts) |
| Model | [`public/models/heroes/sheep_v3.glb`](../../../public/models/heroes/sheep_v3.glb) |
| Model script | [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py) (the `_v3` class), [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the old class and the build kit) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Grandma Ironknit (yarn)](yarn.md), [Madame Cleaver (chef)](chef.md), [Hank (timber)](timber.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
