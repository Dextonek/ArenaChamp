---
title: Opaline, the Lightbreaker (prism kit)
tags: [catalog, heroes, prism, marksman, mechanics]
updated: 2026-10-30
---

# Opaline, the Lightbreaker

The prism hero kit: Opaline's four spells (Q, W, E and the R ultimate), the shared parts file, the palette row and the rigged hero model. A marksman in a long pale lavender robe with a ring of small prisms floating behind her head and a crystal-tipped wand; she catches light in clear crystal and splits it into a spectrum. She is built on the [combat mechanics](../../architecture/mechanics.md): a splitting skillshot, a blind, a shield and a mirror blink.

## Role

| | |
|---|---|
| Role | Marksman (ranged) |
| Signature | Refraction |
| HP | 560 |
| Kit shapes | Q BOLT split · W ZONE blind · E BLINK + shield · R QUICK CHANNEL sweep |

She wins a 1v1 by out-ranging the enemy (Q reaches 14 m, cooldown 2 s), blinking out of reach and sweeping a held beam across the space in front of her. Her weakness is low HP: a dive kills her, and the ultimate roots her for 2 s.

## At a glance

| | |
|---|---|
| Hero | Opaline, the Lightbreaker |
| Spell category | `hero: prism` |
| Parts file | [`src/effects/parts/prism.ts`](../../../src/effects/parts/prism.ts) |
| Kit data | [`src/kits/prism.ts`](../../../src/kits/prism.ts) |
| Kit sheet | [`kit-prism.md`](../../../pipeline/designs/kit-prism.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Model | [`public/models/heroes/prism.glb`](../../../public/models/heroes/prism.glb) |

## Palette

The art bible row "Prism" ([ART_BIBLE.md](../../ART_BIBLE.md) section 2, energy value ladders). Every effect of the kit picks from this row.

| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#ffffff` | `#f2eeff` | `#b8b0ff` | spectrum: red `#ff5a6a`, gold `#ffd24a`, green `#5aff9a`, blue `#5ab8ff` | `#14102a` | clear glass `#f0f4ff` |

Core is the white heart of every beam; hot is the lit top face of a crystal; body is the lavender glass; the accent is the four spectrum bands (`SPECTRUM`, always in the order red, gold, green, blue, as thin parallel bands either side of a white core, never a fat rainbow); dark is the outline of every crystal and the violet-black sky of the ultimate; the glass foil is the pale facets and glitter. The kit icons also use a darker lavender `#7f74d6` for the shaded facets.

## Signature shape and material rules

The refracting crystal. Light enters a faceted clear crystal white and leaves as thin, parallel bands of red, gold, green and blue. Every spell is light caught and split: a bolt that shatters into three beams, a ring of crystals feeding one prism, mirrors that throw beams outward, a giant prism that splits a beam into seven lances. Not the astral kit's constellations (Lyra) and not the dawn kit's gold panels (Auriel): cold clear glass with a dark edge line, and spectrum only as thin bands.

- Crystals: double-terminated hexagonal shards, flat-shaded in bands with a lighter top face and a dark outline hull; never smooth.
- Beams: a white core with thin spectrum bands either side (use a width of 0.4 or more so the bands read); a single tint gives one coloured band each side.
- Glitter: a few small flat diamond facets that flash once and fall, each with a dark edge so it reads on a bright floor.

## Mechanics

Opaline uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Skillshot, split | Q is `aim: 'line'`: `ctx.projectile` fires a crystal (speed 22, range 14, radius 0.45) with `split: { count: 3, spreadDeg: 25, at: 'hit', range: 6 }`. At the first hit the parent ends and three child bolts fan out over 25 degrees; each child hits for 18 and never hits an enemy its parent hit. Hero mode draws a strip toward the cursor; the AI's bolt dodge can sidestep it |
| Blind | W blinds every enemy it hits for 1.5 s (`status: { kind: 'blind', seconds: 1.5 }`, cap 2 s): their casts land at a random spot within 2.5 m of the aim point. It does not move self spells |
| Shield | E gives `ctx.shieldSelf(45, 3)`, a 45 point shield for 3 s |
| Blink | E moves her 4 m sideways of the line to the enemy in 0.12 s (`ctx.moveCaster`), toward the side nearer the middle of the ring. No damage |
| Channel | R is QUICK: no aim, self mode, radius 12. She is rooted for 2 s and a beam sweeps 70 degrees in front of her, hitting whoever is on its line at three ticks (knock 1.5) |
| Melee, dash, heal, summons | none. `maxHp` is 560 |

The numbers follow the "Mechanics budget" of [kit-common.md](../../../pipeline/designs/kit-common.md).

## Spells

All four play under the normal gameplay camera (no cinematic, no letterbox). The four spells have different shapes: Q is a splitting skillshot (first damage 0.2-0.85 s after the cast, clean by 1.5 s), W a delayed ground zone (hit at 0.75 s, clean by 2.2 s), E a blink with a shield and no damage (2.3 s), R a no-aim channel that sweeps a beam (three ticks, impact at 2.3 s, clean by 3.2 s). Range and cooldown come from the kit data (`src/kits/prism.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [prism bolt](../../../src/spells/targeted/prismBolt.ts) | ground, BOLT skillshot line (width 0.9) | 14 | 2 s | flies from 0.2 s, about 0.64 s of flight | 1.5 s | A faceted crystal (0.8 long) forms at her wand tip over 0.2 s, then is fired along the aim line, spinning, with a short white trail. On the first enemy it bursts: glitter, a small spectrum star for two frames, and three thin tinted beams (red, gold, blue) fan out over 25 degrees, one riding each child bolt. The children hit again and spark a little. A bolt that ends without a hit pops into glitter where it was. Damage 50, knock 2; children 18, knock 1. |
| W | [refraction field](../../../src/spells/targeted/refractionField.ts) | ground ZONE (r 4) | 10 | 7 s | 0.75 s | 2.2 s | A ring of six tilted crystals rises at the zone edge, facing inward. Each fires a white beam to a prism forming over the centre (about 2.5 high), which spins faster and brightens. At 0.75 s the prism bursts: spectral beams flash down across the zone with glitter, a little shake and a ground refraction ring, and every enemy inside is hit and blinded. From 1.0 s the crystals shatter into glitter. Damage 48, blind 1.5 s. |
| E | [mirror shell](../../../src/spells/targeted/mirrorShell.ts) | self BLINK (r 4) | 0 (self) | 9 s | 0.3 s (the flash and the blink) | 2.3 s | Six flat crystal mirrors assemble round her (radius 1.3, waist to head), turning slowly. At 0.3 s they flash, throw spectral beams outward, and she blinks 4 m sideways of the line to the enemy in 0.12 s (the side nearer the middle of the ring). She takes a 45 point shield for 3 s. At 1.8 s the mirrors shatter into glitter. No damage. The telegraph is the blink line. Shield 45. |
| R | [spectrum lance](../../../src/spells/targeted/spectrumLance.ts) | self QUICK CHANNEL (r 12) | 0 (self, no aim) | 20 s | 2.3 s (ticks at 0.63, 1.3 and 1.97 s) | 3.2 s | The ultimate. No aim: it fires where she faces. A huge faceted prism (about 2 tall) stands in front of her over 0.3 s and the world darkens. From 0.3 to 2.3 s she holds a rainbow beam where she faces, rooted, and it sweeps 70 degrees across, 12 m long. Three ticks hit whoever is on the beam's line then (live positions, 1.2 m wide), with glitter, a spectrum accent and a little shake. At 2.4 s the prism shatters into glitter. The telegraph is the 84 degree cone. Damage 50 per tick (3 ticks), knock 1.5. |

Spell sources: [`prismBolt.ts`](../../../src/spells/targeted/prismBolt.ts), [`refractionField.ts`](../../../src/spells/targeted/refractionField.ts), [`mirrorShell.ts`](../../../src/spells/targeted/mirrorShell.ts), [`spectrumLance.ts`](../../../src/spells/targeted/spectrumLance.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-prism).

## Parts file

[`src/effects/parts/prism.ts`](../../../src/effects/parts/prism.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/prism`). Everything is pooled, takes world-space positions and has a `reset()`; the materials are toon shaders kept below the bloom threshold.

| Export | Role |
|---|---|
| `PRISM`, `PRISM_CSS`, `SPECTRUM` | palette constants (`foil` is the clear glass) and the four spectrum colours in beam order |
| `Crystal` | pooled hexagonal crystal shards (`CrystalOptions`): `place(pos, dir, length, width, opts)` returns an index; `move`, `setSize`, `setScale`, `setRoll`, `setSpin`, `hide(i)`; `shatter(speed, life, origin)` turns every live crystal into loose tumbling shards; `frozen` holds time for a dead beat |
| `SpectrumBeam` | camera-facing beams with a white core and thin spectrum bands: `set(a, b, width, opacity, tint?, tailTaper?, slot?)`, `split(fanDeg, count, length?, width?, opacity?, tints?)` fans slots 1..count out of the end of slot 0, `fan(origin, dir, axis, ...)` is the general form, `hide(slot)` |
| `Glitter` | small flat diamond facets that flash once and fall: `burst(pos, count, speed, size)` |
| `PrismRing` | a ring of small floating prisms: `set(center, radius, count, spin, size)` each frame, `scale(k)`, `shatter(speed, life)`, `hide()` |

## Model

[`public/models/heroes/prism.glb`](../../../public/models/heroes/prism.glb): a rigged figure on the Dao rig (same bone names as `public/models/figures/hero.glb`, so `src/effects/weapons/hero.ts` can pose it). Built by `build("prism")` / `export("prism")` in [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py); hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Opaline`).

- Look: A slim woman in a long pale lavender robe over white, with narrow sleeves, loose platinum hair, crystal epaulettes, a ring of small floating prisms behind her head, a crystal-tipped wand in her right hand and thin spectral bands on a dark sash.
- Props: `prism_ring`, `crystal_epaulettes`, `crystal_wand`, `spectral_sash`.
- HUD portrait (canvas-drawn in the kit data): A floating ring of small prisms behind her head with light bending through one of them, shoulders in a pale lavender robe with white trim, crystal epaulettes and a crystal brooch at the throat, and a cool, calm face under long pale hair parted in the middle.

![Opaline model preview, angle 15](../../heroes/prism_15.png)

The wave 4 concept (Opaline, Sirix and Cantor; vector source [`wave4_concept.svg`](../../heroes/wave4_concept.svg)):

![Wave 4 concept: Opaline, Sirix and Cantor](../../heroes/wave4_concept.jpg)

The wave 4 models in hero mode (Opaline, Sirix and Cantor):

![Wave 4 in-game hero models](../../heroes/wave4-ingame_sheet.jpg)

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-prism.md`](../../../pipeline/designs/kit-prism.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/prism.ts`](../../../src/effects/parts/prism.ts) |
| Spells | [`prismBolt.ts`](../../../src/spells/targeted/prismBolt.ts), [`refractionField.ts`](../../../src/spells/targeted/refractionField.ts), [`mirrorShell.ts`](../../../src/spells/targeted/mirrorShell.ts), [`spectrumLance.ts`](../../../src/spells/targeted/spectrumLance.ts) |
| Kit data | [`src/kits/prism.ts`](../../../src/kits/prism.ts) |
| Model | [`public/models/heroes/prism.glb`](../../../public/models/heroes/prism.glb) |
| Model script | [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py) |

## Review sheets

Contact sheets in `docs/spells/` (frames over time, from `pipeline/tools/contact-sheet.js`).

### Prism review

![Prism review contact sheet](../../spells/wave4-prism_sheet.jpg)

### Prism re-check (round 2)

![Prism re-check contact sheet](../../spells/wave4-prism-r2_sheet.jpg)

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Sirix (hive)](hive.md), [Cantor (bard)](bard.md), [Lyra (astral)](astral.md), [Auriel (dawn)](dawn.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
