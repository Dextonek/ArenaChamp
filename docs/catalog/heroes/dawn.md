---
title: Auriel, the Dawn Paladin (dawn kit)
tags: [catalog, heroes, dawn, support, shield]
updated: 2026-11-04
---

# Auriel, the Dawn Paladin

The dawn hero kit (kits v5): Auriel's four spells (Q, W, E and the R ultimate), her passive, the shared parts file, the palette row and the rigged hero model. A young paladin in white and gold plate with a winged circlet. She shields herself, and each shield bursts when it ends.

## Role

| | |
|---|---|
| Role | Support (ranged attack) |
| Signature | Oath of Dawn |
| HP | 550 |
| Kit shapes | Q QUICK cone + small shield · W SELF shield, recast to pop · E TGT beam, delayed, brand · R SELF big shield, recast to pop, then a fixed ring |

She wins a 1v1 by choosing when her shields end. Every shield bursts in light, so a shield she lets run is a bomb on a timer. Her weakness is that every threat she has is a burst the enemy can walk away from. She has no dash, her basic attack reaches 5.5 m (8 per 0.7 s) and she walks at 3.9 m/s.

## At a glance

| | |
|---|---|
| Hero | Auriel, the Dawn Paladin |
| Spell category | `hero: dawn` |
| Parts file | [`src/effects/parts/dawn.ts`](../../../src/effects/parts/dawn.ts) |
| Kit data | [`src/kits/dawn.ts`](../../../src/kits/dawn.ts) |
| Trait data | [`src/traits/dawn.ts`](../../../src/traits/dawn.ts) |
| Kit sheet | [`kit-dawn.md`](../../../pipeline/designs/kit-dawn.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/dawn_v2.glb`](../../../public/models/heroes/dawn_v2.glb) |

## Palette

The art bible row "Dawn" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#fffdf2` | `#ffe7a0` | `#f2b83c` | `#7fd8ff` | `#3a2408` | ivory `#efe6d2` |

Core is only the tiny core lines; body is the gold of the panels; accent (sky blue) only 2-3 frames at hits; dark is the amber-brown rim and shadows; the ivory foil is the panel faces and the halo's inner band.

## Signature shape and material rules

Hard-light geometry. Light is solid: flat gold panels with crisp edges (hexagons, kite shields, long blade shards) that click together into shapes (a shield wall, a halo of blades, a great sword), lit from inside with a white core line and a darker amber rim. Things assemble panel by panel and shatter into panels. Not soft holy glow and not stained glass (the existing sanctum): opaque, geometric, assembled light.

- Panels: unlit flat shapes, ivory/gold face with a thin white core line and a dark amber rim; only the core lines may bloom, never a soft glow sphere.
- Light rays: thin crisp tapered wedges, low opacity, few.


## Passive and twist

| | |
|---|---|
| Passive | **Oath of Dawn**: when one of her shields breaks or runs out, it bursts in light (3 m) for about 60% of its size (Sunrise: a 5 m ring, 80). A burst that catches a branded enemy stuns it for 0.8 s. |
| Twist | none (the trait has no `twist` entry) |
| Resource or meter | none. A gold `ward` gem pip shows while Dawnward holds, and the passive slot shows the seconds left on the shield |
| Walk speed | 3.9 m/s |
| Basic attack | ranged, 5.5 m, 8 per 0.7 s, wind-up 0.18 s, bolt speed 20, spear look. While Dawnward holds it reaches 3 m farther |

Other trait rules (`src/traits/dawn.ts`):

- The trait makes the shields and watches how they end. The burst itself is part of each spell effect, which plays on both screens and reads the trait's shield record.
- Q gives its 14 shield only when the cone hits the enemy hero, and not while Dawnward or Sunrise holds.
- W and R have a recast, "Pop". It ends the shield at once and the burst goes off. W's arms after 0.2 s and lasts 3 s; R's arms after 0.3 s and lasts 5.2 s. The duel AI never pops (`aiWait`).
- Dawnward cannot be cast while Sunrise holds.
- A new W or R cast replaces the old shield record; the replaced spell plays no burst.
- The duel AI casts W only within 6.5 m of the enemy and R only within 8 m (`aiHold`).

## Mechanics

Auriel uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Shield | Q (14 for 3 s), W (45 for 3 s), R (130 for 5 s). The engine keeps the larger shield, so Q gives none while W or R holds |
| Recast | W and R, "Pop": ends the shield now |
| Burst at shield end | Q 8, W 27 (both 3 m), R 80 (5 m ring). `projectile: true` hits on live positions; no telegraph can show them |
| Brand and stun | E brands for 2.5 s; a burst on a branded enemy stuns for 0.8 s |
| Reach | Dawnward: basic attacks +3 m |
| Skillshot, summon, dash, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/dawn.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage. W and R have a self radius of 30 so the enemy is in their target list when the burst comes. Lengths are the standalone lengths (no trait record, as in the tool). In a duel they follow the shield, up to the caps (Q 6.4 s, W 5.2 s, R 9.4 s).

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [first light](../../../src/spells/targeted/firstLight.ts) | self, QUICK cone (6 m, 70 degrees) | 6 | 4 s | 0.45 s | 4.35 s | A sun disc swells before her chest and five blade shards gather, then fly out and a fan of hard light fills the cone. Damage 40, knock 3. A hit on the enemy hero gives her a 14 shield for 3 s (not while Dawnward or Sunrise holds); when it ends it bursts for 8 in 3 m. A miss ends the effect at 2.3 s. |
| W | [dawnward](../../../src/spells/targeted/dawnward.ts) | self, shield, recast Pop | 0 (self) | 9 s | burst when the shield ends (3 s, or on Pop) | 3.95 s | Six kite shields fly in and click into a ring round her, with a sun-wheel sigil under her feet. A 45 shield for 3 s, and her basic attacks reach 3 m farther. When it ends the ring shatters and a 3 m burst hits at her live position: 27. Refused while Sunrise holds. |
| E | [oathbrand](../../../src/spells/targeted/oathbrand.ts) | enemy (click), sight checked | 7 | 11 s | 0.5 s | 3.1 s | A thread of light hangs over the enemy and a gold ring closes on its feet. At 0.5 s, if she still sees it, a beam falls on its live position (red circle 1.2 m on the telegraph): 44, and the enemy is branded for 2.5 s (a sun disc turns over its head). Cover makes it fizzle (1.0 s, no hit). |
| R | [sunrise](../../../src/spells/targeted/sunrise.ts) | self, shield, recast Pop | 0 (self) | 24 s | ring bursts 1.6 s after the shield ends (5 s, or on Pop) | 7.55 s | A sun disc opens behind her, a halo crowns her, and eight kite shields and six feather plates turn round her. She floats (look only). A 130 shield for 5 s. When it ends a 5 m ring appears fixed at her spot, closes over 1.6 s and bursts for 80. The ring does not follow her. |

Spell sources: [`firstLight.ts`](../../../src/spells/targeted/firstLight.ts), [`dawnward.ts`](../../../src/spells/targeted/dawnward.ts), [`oathbrand.ts`](../../../src/spells/targeted/oathbrand.ts), [`sunrise.ts`](../../../src/spells/targeted/sunrise.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-dawn).

## Parts file

[`src/effects/parts/dawn.ts`](../../../src/effects/parts/dawn.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/dawn`). Everything is pooled, takes world-space positions and has a `reset()`; the panel faces and gold stay below the bloom threshold; only the thin core lines are bright enough to bloom.

| Export | Role |
|---|---|
| `DAWN`, `DAWN_CSS` | palette constants (`foil` is the ivory) |
| `dawnFacing`, `dawnForward`, `dawnView`, `dawnOrient`, `dawnPanelNormal`, `dawnClamp01`, `dawnEaseOut`, `dawnEaseOutBack` | helpers: the camera-facing normal, the horizontal direction along the aim, the view direction, panel orientation and easing curves |
| `PanelShape` | the panel shapes: `'hex'`, `'shield'`, `'shard'` |
| `LightPanels` | instanced hard-light panels: `assemble(seconds, stagger, scatter, origin)` (fly in and click into place), `fadeOut`, `fling(i, vel, life, spin)`, `shatter(speed, life, center)`, `hide(i)`, `glow`, `opacity` |
| `HaloRing` | a crisp gold ring with an ivory inner band and short ray ticks: `set(center, normal, radius)`, `spin(dt)`, `opacity` |
| `SunRays` | a few thin crisp tapered wedges fanning from a point: `fan(origin, dir, count, length, spread, grow, width)`, `fade(k)`, `face(aim)` |
| `Sigil` | a gold ground circle with a sun-wheel pattern (canvas): `set(center, radius)` |
| `SunEmblems` | pooled flat sun discs (gold, twelve rays, dark outline) for shield faces and sun-disc flares: `set(i, pos, quat, size)`, `hide(i)`, `brightness` |
| `LightBeams` | pooled hard-light needles (a gold outer lens with a white-hot inner one): `set(i, center, dir, normal, length, width)`, `opacity`, `bright` |
| `dawnShieldRing` | stands kite-shield panels in a ring round a point, faces outward, points down: `spin` turns it, `wide` stretches the shields into a wall |


## Model

[`public/models/heroes/dawn_v2.glb`](../../../public/models/heroes/dawn_v2.glb): a rigged figure on the Dao rig. Built by `build("dawn")` / `export("dawn")` in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts). Hit size (`HERO_BODIES`): radius 0.47 m, height 2.33 m.

- Look: ivory plate with gold trim over a white skirt with tasset plates, a sun on the breastplate, golden hair in a long braid under a winged circlet, sky-blue eyes, a hard-light sword in the right hand and a gold kite shield on the left forearm.
- HUD portrait (canvas-drawn in the kit data): a sun disc with crisp rays behind her, a halo ring above a helmed paladin in white and gold plate, and a raised blade.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-dawn.md`](../../../pipeline/designs/kit-dawn.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Kits v5 design | [`pipeline/designs/kits-v5.md`](../../../pipeline/designs/kits-v5.md) |
| Parts | [`src/effects/parts/dawn.ts`](../../../src/effects/parts/dawn.ts) |
| Spells | [`firstLight.ts`](../../../src/spells/targeted/firstLight.ts), [`dawnward.ts`](../../../src/spells/targeted/dawnward.ts), [`oathbrand.ts`](../../../src/spells/targeted/oathbrand.ts), [`sunrise.ts`](../../../src/spells/targeted/sunrise.ts) |
| Kit data | [`src/kits/dawn.ts`](../../../src/kits/dawn.ts) |
| Trait | [`src/traits/dawn.ts`](../../../src/traits/dawn.ts) |
| Model | [`public/models/heroes/dawn_v2.glb`](../../../public/models/heroes/dawn_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Marin (tide)](tide.md), [Cantor (bard)](bard.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
