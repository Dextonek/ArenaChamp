---
title: Silvane, the Vain (mirror kit)
tags: [catalog, heroes, mirror, marksman, bounce]
updated: 2026-11-04
---

# Silvane, the Vain

The mirror hero kit: Silvane's four spells (Q, W, E and the R ultimate), her passive, the shared parts file, the palette and the rigged hero model. A tall, elegant duelist in a silver gown with a high collar, carrying a hand mirror, hair perfect, nose in the air. Her mirrors are real objects: she throws them, they bounce off walls and pillars and standing mirrors, and she runs to catch them when they come to rest. She is a ranged marksman.

## Role

| | |
|---|---|
| Role | Marksman (ranged) |
| Signature | Fairest of All |
| HP | 620 |
| Kit shapes | Q SHOT bank shot with a catch · W TERRAIN standing mirror · E DASH through the glass · R SELF ring of eight bolts |

She wins by bank shots: every bounce adds damage, and a mirror she catches gives her Q back. Her weakness is open ground, which gives no bounces, and close range, where she has no damage worth the name (her basic attack is 16 per 1.0 s). Every thrown mirror asks whether to walk to the catch, and the enemy can see where she must walk.

## At a glance

| | |
|---|---|
| Hero | Silvane, the Vain |
| Spell category | `hero: mirror` |
| Parts file | [`src/effects/parts/mirror.ts`](../../../src/effects/parts/mirror.ts) |
| Kit data | [`src/kits/mirror.ts`](../../../src/kits/mirror.ts) |
| Trait (rules) | [`src/traits/mirror.ts`](../../../src/traits/mirror.ts) |
| Kit sheet | [`kit-mirror.md`](../../../pipeline/designs/kit-mirror.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/mirror_v2.glb`](../../../public/models/heroes/mirror_v2.glb) |

## Palette

The `MIRROR` constant in [`src/effects/parts/mirror.ts`](../../../src/effects/parts/mirror.ts) (numbers for `THREE.Color`; `MIRROR_CSS` has the string twins). There is no art bible row for this kit yet. The kit accent is the body colour and the foil is the violet.

| Core | Hot | Body | Shade | Silver | Steel | Violet (foil) | Dark |
|---|---|---|---|---|---|---|---|
| `#ffffff` | `#f4f9ff` | `#cfe6ff` | `#8fa8cc` | `#c6cedb` | `#7d8aa0` | `#d9b8ff` | `#121a2e` |

Polished silver and pale blue glass with a little violet. The glass is the body colour with a white core; the silver rim and frames use silver and steel; violet is the gems, the catch glow and the second edge of a ribbon; dark is the outline that makes the pale glass read on a bright floor.

## Signature shape and material rules

Real mirrors. A hand mirror is an oval of glass in a silver rim with a handle; a standing mirror is a tall ornate full-length mirror in an arched silver frame with a violet gem on top and two feet. There are many of them and they are objects in the world: they spin, bounce, lie on the floor and are caught. Glass breaks into small flat diamond slivers. Not the prism kit (Opaline: clear glass and light): here the glass is a thing with a frame.

- Hand mirrors: pooled, spinning about the vertical in flight so the pane flashes at the camera, lying face up and turning slowly at rest.
- Standing mirror: a dark outline, a silver arched frame, a glass pane with a slow sweep of light, glass on both faces.
- Slivers: small flat diamonds, white, pale blue and silver with a few violet ones, each with a dark edge, kept to a handful per burst.
- Gleam: camera-facing ribbons with a white core and a pale blue (or violet) edge.
- Everything is pooled, takes world-space positions and stays under the bloom threshold (no colour above 0.92).

## Passive and twist

| | |
|---|---|
| Passive | Fairest of All: each bounce of her bolts adds 25% damage and 2 m of range. A mirror that comes to rest on the floor after a bounce stays 2.5 s; she catches it by walking within 1 m (a 1 m ring marks the catch). |
| Twist | Catch. A caught Hand Mirror makes Q ready again, gives her +20% speed for 2 s and a 0.25 s pose (a word: GORGEOUS, STUNNING or DARLING). A caught Hall of Mirrors mirror cuts 2 s off R. Every thrown mirror asks whether to walk to the catch, and the enemy can see where she must walk. |
| Resource or meter | Meter MIRRORS, max 4 (the mirrors lying on the floor now) |
| Speed | 4.1 m/s |
| Basic attack | ranged, 7.5 m, 16 damage every 1.0 s, wind-up 0.3 s, bolt speed 22, prism look |
| Other rules | A rare self-compliment on a hit. The duel AI playing her walks to the nearest resting mirror within 5 m. |

## Mechanics

Silvane uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Bank shots | Q and R: bolts reflect off walls, pillars, crystals and standing mirrors (`reflect`), +25% damage and +2 m range per bounce. Q is flagged `bank: true` and `aim: 'line'` |
| Ground marks | The resting mirrors (`marks`, `markLook`), drawn on both screens; catching is checked on her own client |
| Terrain | W: a real obstacle (a wall 1.1 m wide, `ctx.addObstacle`) that blocks walking, sight and bolts for both heroes, with 60 HP held by a hidden summoned unit |
| Debuff | W: whoever breaks the Stand gets Bad Luck, `weaken` 15% for 7 s |
| Dash | E: `dash: true`, `escape: true`; through her own Stand or a plain 3 m step |
| Cooldown reset and cut | Catching a hand mirror ends Q's cooldown; catching a Hall mirror cuts 2 s off R |
| Haste buff | A caught hand mirror, +20% for 2 s |
| Melee, summon (visible), pull, shield, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/mirror.ts`), hit time and length from the spell files in `src/spells/targeted/` and the constants in the trait.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [hand mirror](../../../src/spells/targeted/handMirror.ts) | line skillshot (ground aim), bank | 10 | 3 s | thrown at 0.3 s, reaches 6 m at 0.57 s | 3.2 s | She draws a hand mirror out at her side and throws it as a spinning bolt (22 m/s, radius 0.3). 64 damage, knock 1.5, +25% and +2 m of range per bounce, up to three bounces. A thin line shows the first two legs of its path. If the flight ends after at least one bounce without a hit, the mirror lies on the floor 2.5 s to be caught. A hit shatters it. |
| W | [vanity stand](../../../src/spells/targeted/vanityStand.ts) | ground (r 0.9 telegraph) | 8 (at least 1.5 m from her) | 12 s | rises at 0.5 s | 7.5 s | A tall ornate mirror steps up at the spot and stands 6 s as a real wall: it blocks walking, sight and bolts for both heroes, and her bolts bounce off it. 60 HP; it breaks into glass. Whoever breaks it has Bad Luck: 15% less damage for 7 s. |
| E | [through the glass](../../../src/spells/targeted/throughTheGlass.ts) | ground (dash) | 9 | 10 s | none (no damage) | 1.0 s | With a Vanity Stand within 9 m she steps into it and out of the far side, 3 m beyond it, up to 9 m in all, in 0.3 s. With no Stand (or a broken or far one), a 3 m step toward the aim. A silver streak goes into the glass and a violet streak comes out. |
| R | [hall of mirrors](../../../src/spells/targeted/hallOfMirrors.ts) | self (r 3) | 0 (self) | 22 s | thrown at 0.6 s | about 2.5 s | Ultimate. A 0.6 s spin: eight mirrors rise round her and are thrown outward as bolts (16 m/s, 12 m, radius 0.3, two bounces): 60 each, +25% per bounce, each hits at most once. Eight pale spokes show their lines, one at the aim, so the gaps (2.3 m wide at 3 m) are plain to read. Up to four that end after a bounce lie on the floor 2.5 s; each caught cuts 2 s off R. |

Spell sources: [`handMirror.ts`](../../../src/spells/targeted/handMirror.ts), [`vanityStand.ts`](../../../src/spells/targeted/vanityStand.ts), [`throughTheGlass.ts`](../../../src/spells/targeted/throughTheGlass.ts), [`hallOfMirrors.ts`](../../../src/spells/targeted/hallOfMirrors.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-mirror).

## Parts file

[`src/effects/parts/mirror.ts`](../../../src/effects/parts/mirror.ts) holds everything the kit's spells share. Spells import it directly (`../../effects/parts/mirror`). Everything is pooled and takes world-space positions.

| Export | Role |
|---|---|
| `MIRROR`, `MIRROR_CSS` | palette constants (`foil` is the violet) |
| `HandMirrors` | pooled real hand mirrors: `place(pos, yaw)`, `move`, `setScale`, `setSpin`, `setMode` ('fly' spinning, 'rest' lying face up), `hide`, `update(dt)` |
| `restingMirrorLook` | the mirror on the floor with its 1 m catch ring (`Trait.markLook`) |
| `StandMirror`, `STAND_HEIGHT` | one tall standing mirror: `place(pos)`, `setScale(k)`, `flinch(k)`, `hide()` |
| `Slivers` | small flat diamond slivers of glass that flash once and fall: `burst(pos, count, speed, size)` |
| `Gleam` | camera-facing ribbons with a white core and a pale blue or violet edge: `set(a, b, width, opacity, tint?, tailTaper?, slot?)`, `hide(slot)` |
## Model

[`public/models/heroes/mirror_v2.glb`](../../../public/models/heroes/mirror_v2.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the current style, the `_v2` models). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Silvane`), and its hit size is in `HERO_BODIES` in the same file (radius 0.57 m, height 2.73 m).
- HUD portrait (canvas-drawn in the kit data): A tall oval looking-glass behind her head: a silver frame, a pale sheen.


## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-mirror.md`](../../../pipeline/designs/kit-mirror.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/mirror.ts`](../../../src/effects/parts/mirror.ts) |
| Spells | [`handMirror.ts`](../../../src/spells/targeted/handMirror.ts), [`vanityStand.ts`](../../../src/spells/targeted/vanityStand.ts), [`throughTheGlass.ts`](../../../src/spells/targeted/throughTheGlass.ts), [`hallOfMirrors.ts`](../../../src/spells/targeted/hallOfMirrors.ts) |
| Kit data | [`src/kits/mirror.ts`](../../../src/kits/mirror.ts) |
| Trait (passive, twist, rules) | [`src/traits/mirror.ts`](../../../src/traits/mirror.ts) |
| Model | [`public/models/heroes/mirror_v2.glb`](../../../public/models/heroes/mirror_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Bram (mason)](mason.md), [Hank (timber)](timber.md), [Professor Puff (balloon)](balloon.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
