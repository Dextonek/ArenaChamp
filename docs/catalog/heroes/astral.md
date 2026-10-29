---
title: Lyra, the Star Archer (astral kit)
tags: [catalog, heroes, astral]
updated: 2026-10-29
---

# Lyra, the Star Archer

The astral hero kit: Lyra's four spells (Q, W, E and the R ultimate), the shared parts file, the palette row and the rigged hero model. A ranged archer who reads the sky; precise, elegant, multi-target.

## At a glance

| | |
|---|---|
| Hero | Lyra, the Star Archer |
| Spell category | `hero: astral` |
| Parts file | [`src/effects/parts/astral.ts`](../../../src/effects/parts/astral.ts) |
| Kit data | [`src/kits/astral.ts`](../../../src/kits/astral.ts) |
| Kit sheet | [`kit-astral.md`](../../../pipeline/designs/kit-astral.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/astral.glb`](../../../public/models/heroes/astral.glb) |

## Palette

The art bible row "Astral" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row and adds black.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#fffbe8` | `#ffe08a` | `#5a3fc0` | `#7ff3ff` | `#070414` | chart `#e8e0c8` |

Core only in star cores; hot is the constellation lines; body is the night-violet field behind the stars; accent (cyan) only 2-3 frames at hits; the parchment chart foil is the drawn chart rings and zodiac glyphs on the ground.

## Signature shape and material rules

Constellations: bright four-point star points joined by thin, crisp gold lines that draw themselves from star to star into a figure (a net, a bow, a stag), then snap: the lines break and the stars fall as small shooting stars. Second shape: arrows of light with a long, thin gold tail.

- Lines are crisp ribbons (width ~0.06-0.1) with a soft halo under them (~0.3 at low opacity), not fat glows.
- Stars are four-point hard shapes with a tiny white core and varied sizes.
- The violet body is a dark translucent "night" disc or ribbon behind the gold so the gold reads (the dark layer).
- The chart foil is a canvas ring with tick marks and zodiac glyphs, not glowing.

## Spells

All four play under the normal gameplay camera (no cinematic, no letterbox). Q, W and E are normal MOBA abilities (hit 0.4-0.8 s after the cast, clean by about 2 s; an E aura may run about 3 s); R is the ultimate (hit around 2.0-2.5 s, clean by 4.5 s, one dead beat and one short impact frame). Range and cooldown come from the kit data (`src/kits/astral.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [starshot](../../../src/spells/targeted/starshot.ts) | enemies (up to 3) | 12 | 3 s | 0.75, 0.83 and 0.91 s (one per target) | 1.6 s | She draws a bow of light; a star arrow hops from enemy to enemy and leaves a small constellation behind, which snaps at 1.0 s. Damage 45 per target. |
| W | [constellation snare](../../../src/spells/targeted/constellationSnare.ts) | ground (r 4) | 11 | 8 s | 0.8 s | 2.1 s | An arrow goes up, stars fall around the spot and are joined into a net that snaps tight at 0.8 s and drags the enemies toward the centre; it breaks apart at 1.4 s. Damage 50. |
| E | [orbit veil](../../../src/spells/targeted/orbitVeil.ts) | self (r 5) | 0 (self) | 9 s | 1.0 s and 2.0 s (two strikes) | 3.3 s | A turning constellation of 7 stars circles her under a night veil and fires gold lines at every enemy nearby, twice. Loopable. Damage 12 per strike. |
| R | [celestial hunt](../../../src/spells/targeted/celestialHunt.ts) | ground (r 7) | 14 | 20 s | 2.35 s | 4.5 s | The ultimate. The world goes to night and a giant constellation stag is drawn in the sky; dead beat at 1.8-1.95 s, then it charges down through the zone (impact frame, star rain). Damage 125. |

Spell sources: [`starshot.ts`](../../../src/spells/targeted/starshot.ts), [`constellationSnare.ts`](../../../src/spells/targeted/constellationSnare.ts), [`orbitVeil.ts`](../../../src/spells/targeted/orbitVeil.ts), [`celestialHunt.ts`](../../../src/spells/targeted/celestialHunt.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-astral).

## Parts file

[`src/effects/parts/astral.ts`](../../../src/effects/parts/astral.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/astral`).

| Export | Role |
|---|---|
| `ASTRAL`, `ASTRAL_CSS` | palette constants |
| `StarPoints` | instanced four-point stars: pop in, `twinkle`, `fall` as a shooting star |
| `ConstellationLines` | crisp gold segments with a halo: `connect` draws a line, `snap` breaks them into falling pieces |
| `StarArrow` | a light arrow with a long tapered gold tail: `fly`, `onArrive` |
| `StarChart` | a parchment ground ring with ticks and zodiac glyphs, with a `hole` to hide the busy centre |
| `NightVeil` | a dark violet translucent disc, dome or upright patch with sparse tiny stars, the dark layer behind constellations |

## Model

[`public/models/heroes/astral.glb`](../../../public/models/heroes/astral.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built by `build("astral")` / `export("astral")` in [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py); hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts).

- Look: A night-violet robe with gold trim, archer's bracers, a braid.
- Props: `star_circlet`, `star_halo`, `mantle_stars`, `robe_stars`, `back_bow`, `quiver`.
- HUD portrait (canvas-drawn in the kit data): A parchment ring with a gold bow-shaped constellation inside it.

![Lyra turnaround, angle 15](../../heroes/astral_15.png) ![Lyra turnaround, angle 165](../../heroes/astral_165.png)

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-astral.md`](../../../pipeline/designs/kit-astral.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/astral.ts`](../../../src/effects/parts/astral.ts) |
| Spells | [`starshot.ts`](../../../src/spells/targeted/starshot.ts), [`constellationSnare.ts`](../../../src/spells/targeted/constellationSnare.ts), [`orbitVeil.ts`](../../../src/spells/targeted/orbitVeil.ts), [`celestialHunt.ts`](../../../src/spells/targeted/celestialHunt.ts) |
| Kit data | [`src/kits/astral.ts`](../../../src/kits/astral.ts) |
| Model | [`public/models/heroes/astral.glb`](../../../public/models/heroes/astral.glb) |
| Model script | [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py) |

## Review sheets

Contact sheets in `docs/spells/` (frames over time, from `pipeline/tools/contact-sheet.js`).

### Starshot

![Starshot contact sheet](../../spells/starshot_sheet.jpg)

### Astral review (the other three spells)

![Astral review (the other three spells) contact sheet](../../spells/astral-review_sheet.jpg)

## See also

- [Hero roster and shared structure](README.md)
- [Vesper (blood)](blood.md), [Brannoc (forge)](forge.md), [Isolde (frost)](frost.md), [Vex (alchemy)](alchemy.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
