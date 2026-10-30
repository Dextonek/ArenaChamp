---
title: Vex, the Plague Alchemist (alchemy kit)
tags: [catalog, heroes, alchemy]
updated: 2026-10-29
---

# Vex, the Plague Alchemist

The alchemy hero kit: Vex's four spells (Q, W, E and the R ultimate), the shared parts file, the palette row and the rigged hero model. A masked alchemist in a coat of vials; damage over time, zones, a gamble of an ultimate.

## At a glance

| | |
|---|---|
| Hero | Vex, the Plague Alchemist |
| Spell category | `hero: alchemy` |
| Parts file | [`src/effects/parts/alchemy.ts`](../../../src/effects/parts/alchemy.ts) |
| Kit data | [`src/kits/alchemy.ts`](../../../src/kits/alchemy.ts) |
| Kit sheet | [`kit-alchemy.md`](../../../pipeline/designs/kit-alchemy.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/alchemy.glb`](../../../public/models/heroes/alchemy.glb) |

## Palette

The art bible row "Alchemy" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row and adds black.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#f4ffe0` | `#c8ff4a` | `#4fbf2a` | `#ff5ad8` | `#0c1606` | glass `#dcefe6`, gold `#e8b84a` |

Core is tiny; accent is a magenta reaction spark, 2-3 frames; the glass foil is glass walls, shard edges and the alchemical circle ink; gold `#e8b84a` is used only for the transmutation.

## Signature shape and material rules

Glass and reaction: thin-walled glass flasks (pale green-white glass, dark liquid inside) that shatter into sharp glass shards, releasing a bubbling caustic liquid (acid green, big round bubbles that swell and pop into rings) and rising fume curls. The ultimate's twist: transmutation to gold (enemies flash to gold statues for a beat, then crack).

- Acid: the kit's liquid shader (smooth, dark-green rim, one thin hot-green rim line, pinpoint specular); bubbles are separate small spheres of the same look that swell and pop into thin rings.
- Glass: low-opacity pale glass with a bright fresnel rim; shards are flat glass triangles with an edge line.
- Fumes: dark green toon smoke curls (normal-blended, dark with a hot-green rim), small and few.

## Spells

All four play under the normal gameplay camera (no cinematic, no letterbox). Q, W and E are normal MOBA abilities (hit 0.4-0.8 s after the cast, clean by about 2 s; an E aura may run about 3 s); R is the ultimate (hit around 2.0-2.5 s, clean by 4.5 s, one dead beat and one short impact frame). Range and cooldown come from the kit data (`src/kits/alchemy.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [volatile flask](../../../src/spells/targeted/volatileFlask.ts) | enemy | 10 | 3 s | 0.55 s | 1.8 s | She lobs a flask in a high spinning arc; it shatters on the enemy in glass and caustic splash, and burns for a moment. Damage 49, one burn tick of 12 at 1.2 s. |
| W | [caustic pool](../../../src/spells/targeted/causticPool.ts) | ground (r 4) | 10 | 7 s | 0.6 s | 2.6 s | Two flasks shatter on the point and an alchemical circle fills with boiling acid that burns everything in it, then drains to a stain. Damage 30, then ticks of 12 (the slow burner of the kits). |
| E | [mutagen](../../../src/spells/targeted/mutagen.ts) | self (r 4) | 0 (self) | 9 s | 1.1 s and 2.1 s (two spits) | 3.2 s | She drinks a flask; four flasks orbit her and spit acid at every enemy nearby, twice, then shatter at 2.6 s. Loopable. Damage 12 per spit. |
| R | [grand transmutation](../../../src/spells/targeted/grandTransmutation.ts) | ground (r 7) | 13 | 20 s | 2.0 s (gold), 2.6 s (shatter) | 4.5 s | The ultimate. A giant circle and a column of acid that coils into a sphere (dead beat 1.85-2.0 s); at 2.0 s everything in the zone turns to gold (86), at 2.6 s the gold shatters (50). |

Spell sources: [`volatileFlask.ts`](../../../src/spells/targeted/volatileFlask.ts), [`causticPool.ts`](../../../src/spells/targeted/causticPool.ts), [`mutagen.ts`](../../../src/spells/targeted/mutagen.ts), [`grandTransmutation.ts`](../../../src/spells/targeted/grandTransmutation.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-alchemy).

## Parts file

[`src/effects/parts/alchemy.ts`](../../../src/effects/parts/alchemy.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/alchemy`).

| Export | Role |
|---|---|
| `ALCHEMY`, `ALCHEMY_CSS` | palette constants |
| `Flask` | a flask mesh (glass shell, sloshing dark acid, cork): `slosh`, `lob` along an arc |
| `GlassShards` | instanced flat glass triangles (or, recoloured, gold flakes) with gravity and spin |
| `Bubbles` | acid bubbles that rise, swell and pop into a thin ring |
| `AcidPool` | bubbling ground decal: `spread`, `bubble`, `drain` to a stain |
| `Fumes` | dark toon fume curls that rise and twist (default cap 8) |
| `Droplets` | small acid droplets flying an arc from point to point (the E spit) |
| `TransmuteCircle` | a glass-ink alchemical circle with glyphs that can be lit one by one |
| `AcidColumn` | the ultimate's column of acid that coils into a sphere |
| `FigureShell` | a gold statue or green-rim shell drawn over an arena figure without touching the arena materials |

## Model

[`public/models/heroes/alchemy.glb`](../../../public/models/heroes/alchemy.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built by `build("alchemy")` / `export("alchemy")` in [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py); hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts).

- Look: A long dark coat over a stained robe, a leather apron, a wide conical hat.
- Props: `plague_mask` (beaked, glass eyes), `vial_bandolier` (glowing vials), `back_alembic`, `held_flask`.
- HUD portrait (canvas-drawn in the kit data): A dark hood, a pale glass mask with a long beak-like snout and two round green lenses, and a coat with a bandolier of vials.

![Vex turnaround, angle 15](../../heroes/alchemy_15.png) ![Vex turnaround, angle 165](../../heroes/alchemy_165.png)

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-alchemy.md`](../../../pipeline/designs/kit-alchemy.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/alchemy.ts`](../../../src/effects/parts/alchemy.ts) |
| Spells | [`volatileFlask.ts`](../../../src/spells/targeted/volatileFlask.ts), [`causticPool.ts`](../../../src/spells/targeted/causticPool.ts), [`mutagen.ts`](../../../src/spells/targeted/mutagen.ts), [`grandTransmutation.ts`](../../../src/spells/targeted/grandTransmutation.ts) |
| Kit data | [`src/kits/alchemy.ts`](../../../src/kits/alchemy.ts) |
| Model | [`public/models/heroes/alchemy.glb`](../../../public/models/heroes/alchemy.glb) |
| Model script | [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py) |

## Review sheets

Contact sheets in `docs/spells/` (frames over time, from `pipeline/tools/contact-sheet.js`).

### Alchemy review A

![Alchemy review A contact sheet](../../spells/alchemy-review-a_sheet.jpg)

### Alchemy review B

![Alchemy review B contact sheet](../../spells/alchemy-review-b_sheet.jpg)

### Final check (forgefall and the alchemy kit)

![Final check (forgefall and the alchemy kit) contact sheet](../../spells/final-check_sheet.jpg)

## See also

- [Hero roster and shared structure](README.md)
- [Vesper (blood)](blood.md), [Brannoc (forge)](forge.md), [Isolde (frost)](frost.md), [Lyra (astral)](astral.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
