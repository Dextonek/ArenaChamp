---
title: Brannoc, the Ashen Smith (forge kit)
tags: [catalog, heroes, forge, tank, melee]
updated: 2026-11-04
---

# Brannoc, the Ashen Smith

The forge hero kit (v5): Brannoc's four spells (Q, W, E and the R ultimate), his passive, the shared parts file, the palette row and the rigged hero model. A huge smith in a scorched leather apron with a glowing forge in his chest. He hooks the enemy in with a chain hammer, puts Heat on them with every hit, and spends three Heat to Temper his next spell. He is built on the [combat mechanics](../../architecture/mechanics.md): a melee tank with extra HP, a pull, a slow, stuns and a stance that nothing can slow or root.

## Role

| | |
|---|---|
| Role | Tank (melee) |
| Signature | Hot Iron |
| HP | 780 |
| Kit shapes | Q HOOK (skillshot line, pull, cc) · W SELF buff + armed slam · E TGT burn · R SELF stance + Quench recast |

He wins a 1v1 by hooking the enemy into reach, building 3 Heat, and then landing a Tempered spell for a stun or a damage debuff. His weakness is reach and speed: he walks at 3.6 m/s, so a kiter who dodges the hammer (9 m, a straight line) is hard to catch.

## At a glance

| | |
|---|---|
| Hero | Brannoc, the Ashen Smith |
| Spell category | `hero: forge` |
| Parts file | [`src/effects/parts/forge.ts`](../../../src/effects/parts/forge.ts) |
| Kit data | [`src/kits/forge.ts`](../../../src/kits/forge.ts) |
| Trait (rules) | [`src/traits/forge.ts`](../../../src/traits/forge.ts) |
| Kit sheet | [`kit-forge.md`](../../../pipeline/designs/kit-forge.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/forge_v2.glb`](../../../public/models/heroes/forge_v2.glb) |

## Palette

The art bible row "Forge" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row and adds black.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#fff3d0` | `#ffb03a` | `#ff5a12` | `#6fe0ff` | `#120a08` | ash `#cfc6b8` |

Core is tiny; accent (cold quench steam) only 2-3 frames; the ash foil is ash, cooled iron edges and the smoke rim.

## Signature shape and material rules

Molten slag that cools: liquid metal glows white-orange, a black crust grows over it from the edges inward, leaving orange cracks that dim to dull red and go out. Every spell ends with something cooling. Second shape: hard, heavy smith's iron (hammer, anvil, rivets, chain links) with hot edges.

- Molten: an unlit shader with a crust mask (dark crust plates with bright cracks between them); a `cool` parameter 0..1 runs from all glowing to black with dull red cracks.
- Iron: dark `MeshStandard` with a thin hot rim on the forged edges.
- Sparks: short streaks, not dots, and few.

## Passive and twist

| | |
|---|---|
| Passive | Hot Iron: his hits put Heat on the enemy (3 at most, each batch lasts 5 s, shown as pips over them). |
| Twist | Tempered: his next spell that lands on a 3-Heat enemy clears the Heat and gets its bonus: Q stuns 0.75 s instead of the slow, E makes the enemy take 20% more damage for 3 s, R's Quench stuns 0.75 s. A Tempered spell adds no Heat of its own, and only the first hit of a cast counts, so a burn tick never Tempers. |
| Resource or meter | none (the Heat is stacks on the enemy) |
| Speed | 3.6 m/s |
| Basic attack | melee, 2.6 m, 18 damage every 1.6 s, wind-up 0.4 s, smash look |
| Other rules | Heat sources: E adds 2; the W slam adds 2; each basic attack while the core burns adds 1; Q adds none. During Molten Core slows, roots and knock-ups are swallowed (`taken`). The CPU against him walks away from the core when within 5 m. |

## Mechanics

Brannoc uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 780` in the kit data. The duel AI walks up to melee range |
| Pull and slow | Q: `pull: 4` toward him, `knock: 0`, slow 1 s. Q is flagged `cc` (the AI casts it first when the enemy is in range) and `aim: 'line'` |
| Stun | Tempered Q and Tempered Quench: 0.75 s |
| Knock-up | The W slam: 0.5 s (0.8 s on a 3-Heat enemy) |
| Armour buff | W: +30% armour for 3 s (kit `buff`), no speed |
| Damage over time | E: two burn ticks of 6 |
| Debuff | Tempered E: `vulnerable` +20% for 3 s |
| Stance and recast | R: 6 s of immunity to slow, root and knock-up, +25 damage and +0.4 m reach per basic attack, +1 Heat per hit; Quench (recast) ends it with a ring burst |
| Hold | Quench holds him still for 0.6 s |
| Skillshot | Q: a projectile at 18 m/s, 9 m, radius 0.45 |
| Summon, dash, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/forge.ts`), hit time and length from the spell files in `src/spells/targeted/`; the numbers are the spell files' defaults. "Hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [chain hammer](../../../src/spells/targeted/chainHammer.ts) | line skillshot (ground aim) | 9 | 9 s | released at 0.3 s, reaches 6 m at 0.63 s | 1.7 s | He whirls the hammer on its chain (0.3 s wind-up), then throws it down the aim. The first enemy it touches takes 40, is dragged 4 m toward him and is slowed 1 s; the chain stays taut 0.45 s, then whips back. A miss reels in. Tempered: stunned 0.75 s instead of the slow. |
| W | [forge roar](../../../src/spells/targeted/forgeRoar.ts) | self | 0 (self) | 11 s | none (no damage) | 3.6 s | Heat rolls off him in a ring (2.4 m) and a loop of chain turns round his waist for 3 s of +30% armour. His next basic attack in those 3 s is a slam: +35 damage, a 0.5 s knock-up and 2 Heat (a 0.8 s knock-up that clears the Heat on a 3-Heat enemy). The hammer glows on his shoulder until the slam is spent. |
| E | [red-hot rivet](../../../src/spells/targeted/redHotRivet.ts) | enemy (needs sight) | 6 | 4 s | 0.55 s | 3.2 s | He pulls a white-hot rivet from his chest, flicks it, and it punches into the enemy: 25 damage. It stays in and burns two ticks of 6 (at 1.55 s and 2.55 s). Adds 2 Heat. Tempered: the enemy takes 20% more for 3 s. |
| R | [molten core](../../../src/spells/targeted/moltenCore.ts) | self (stance, then recast) | 6 (the AI's reach) | 24 s | stance 0.4 s; Quench ring 0.6 s | 6.4 s (the Quench 2.4 s) | His chest cracks open for 6 s: immune to slows, roots and knock-ups, and each basic attack sprays a 3 m slag cone (+25 damage, +1 Heat). Recast to Quench: he plants himself and a 3 m ring shows for 0.6 s, then it bursts for 30 plus 10 per second the core had left. Tempered: also stunned 0.75 s. |

Spell sources: [`chainHammer.ts`](../../../src/spells/targeted/chainHammer.ts), [`forgeRoar.ts`](../../../src/spells/targeted/forgeRoar.ts), [`redHotRivet.ts`](../../../src/spells/targeted/redHotRivet.ts), [`moltenCore.ts`](../../../src/spells/targeted/moltenCore.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-forge).

## Parts file

[`src/effects/parts/forge.ts`](../../../src/effects/parts/forge.ts) holds everything the kit's spells share. Spells import it directly (`../../effects/parts/forge`).

| Export | Role |
|---|---|
| `FORGE`, `FORGE_CSS` | palette constants |
| `SlagPool` | molten ground decal with a lumpy edge: `spread`, `cool` (crust grows inward), `fade`; web mode is the crack web of the ultimate |
| `SlagBlobs` | thrown molten blobs that land as small cooling splats (cap ~10) |
| `SlagStreams` | molten streams drawn along a function, molten at the leading end |
| `Sparks` | instanced short streak sparks with gravity, life ~0.4 s |
| `ForgeIron` | builders for the heavy objects: `hammer`, `anvil`, `rivet`, `chainLink` (dark iron, hot rim line) |
| `IronChunks` | broken iron that bursts out, rests, cools to black and sinks |
| `ChainRing` | a ring of molten chain links laid out each frame |
| `QuenchSteam` | a few pale toon steam puffs in the ash foil colour |
| `AshFlakes` | falling dull-grey ash |
| `HotStreak` | a short fat comet trail, core-white at the head to orange at the tail |
| `ForgeSigil` | ash-grey anvil sigil with orange runes, drawn on by a sweep |
| `PulseRing` | an expanding ground ring of heat |
| `ChainLine` | a straight run of heavy chain links from `a` to `b` (instanced, the same link as `ChainRing`); `set(a, b, heat, thickness)` every frame, `hide()` |
| `SlagCone` | pooled ground fans of slag, one per basic-attack swing of Molten Core: `fire(center, yaw, radius, life)`, `update(dt)` |

## Model

[`public/models/heroes/forge_v2.glb`](../../../public/models/heroes/forge_v2.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the current style, the `_v2` models). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Brannoc`), and its hit size is in `HERO_BODIES` in the same file (radius 0.58 m, height 2.35 m).
- HUD portrait (canvas-drawn in the kit data): A broad iron helm, an ash beard, and the forge glowing in his chest.

![Brannoc preview, angle 15](../../heroes/forge_15.png) ![Brannoc preview, angle 165](../../heroes/forge_165.png) 

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-forge.md`](../../../pipeline/designs/kit-forge.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/forge.ts`](../../../src/effects/parts/forge.ts) |
| Spells | [`chainHammer.ts`](../../../src/spells/targeted/chainHammer.ts), [`forgeRoar.ts`](../../../src/spells/targeted/forgeRoar.ts), [`redHotRivet.ts`](../../../src/spells/targeted/redHotRivet.ts), [`moltenCore.ts`](../../../src/spells/targeted/moltenCore.ts) |
| Kit data | [`src/kits/forge.ts`](../../../src/kits/forge.ts) |
| Trait (passive, twist, rules) | [`src/traits/forge.ts`](../../../src/traits/forge.ts) |
| Model | [`public/models/heroes/forge_v2.glb`](../../../public/models/heroes/forge_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Vesper (blood)](blood.md), [Isolde (frost)](frost.md), [Lyra (astral)](astral.md), [Vitriol (alchemy)](alchemy.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
