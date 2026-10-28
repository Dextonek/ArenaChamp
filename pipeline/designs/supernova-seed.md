# Supernova Seed

- **Label:** `supernova seed` · **File:** `src/spells/targeted/supernovaSeed.ts` · **Module:** `supernovaSeedModule`
- **Targeting:** `enemy`
- **Palette (value ladder core → hot → body → accent → dark):** white `#ffffff` → star yellow `#fff2a8` → hot orange `#ff8a2a` → nebula magenta/teal accents `#ff4fa8` / `#3fd0c0` → space dark `#06040e`
- **The shape that makes it ours:** a **tiny star planted in the enemy** that swells, collapses to a point (implode), then goes supernova as **concentric shock shells and a two-lobed nebula** (hourglass shape), leaving a slowly spinning nebula cloud.
- **Recipes:** `i-astral-star-compass-portal-charge` (a compass / star chart that charges), `d-kler-1-singularity-collapse-detonation` (collapse then detonation), `e-yougelly-clef-ring-nova` (stacked ring nova)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~5 s)
- 0-0.5: darken 0.85 to a deep space tint; a star-chart circle (thin lines, constellation dots) draws at the target.
- 0.5-1.6: a small star (hard four-point flare + small core, no glow ball over a shape) seeds in the enemy and swells; orbiting sparks; the world darkens further.
- 1.6-1.9: implode: the star collapses to a pinpoint, the chart rings contract, everything pulls in; dead beat.
- D = 1.95: supernova: impact frames (white-gold, short), 3 shock shells (thin bright rings on tilted planes, expanding at different speeds), a two-lobed hourglass nebula (two cones of soft magenta/teal particles + dark dust lanes, normal-blended dark layer), a cool teal star 2 frames. `ctx.hit(e, { damage: 70, knock: 5 })`. Enemies within 4 m: a second hit damage 15 at D + 0.15 (read ctx.targets only; enemy mode has one target, so skip this if no access).
- 1.95-5: the nebula keeps expanding slowly and spinning, dims to dark dust; a tiny neutron-star glint pulses at the centre and fades.

## Exaggerate
The implode-to-a-pinpoint silence before the blast; a nebula that hangs in the sky afterwards.
