# Spider Lily Soul Field

- **Label:** `spider lily soul field` · **File:** `src/spells/targeted/spiderLilySoulField.ts` · **Module:** `spiderLilySoulFieldModule`
- **Targeting:** `ground`, `radius: 5.5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Spiderlily (phoenix fan)**. The shape that makes it ours: **a field of red spider lilies** (thin curling petals and long stamens, hard-edged canvas sprites, crimson / pink with gold stamen tips) blooming across the area; soul wisps rise, then the field cuts everything with petal blades.
- **Recipes:** `f-spiderlily-staff-orb` (the lily filament burst shape), `i-blood-splat-crescent-kit` (crescent cuts across many targets), `e-onlyxyz-sunset-cloud-aura` (sunset palette layering).

## Timeline (~4.8 s)
- 0-0.8: darken 0.7 tint `#2a0f2e`. A wave of lilies blooms from the centre outward (60+ instanced lily billboards popping open with overshoot), dark stems.
- 0.8-2.2: pale gold soul wisps rise slowly from the flowers; petals drift; ticks every 0.5 s `damage: 5` on enemies inside.
- 2.2-2.4: all lilies close at once; dead beat.
- D = 2.45: they spring open releasing a spiral storm of petal blades (thin crimson crescents) across the circle: impact frames pink, gold star accents. `ctx.hit(e, { damage: 40, knock: 4, from: center })`.
- 2.45-4.8: petals settle and fade to embers, wisps rise out of frame, the lilies wither (shrink, darken).

## Layers
darken, lily billboards (instanced, normal), stems, soul wisps (small additive), petal blades (`CrescentArc` or instanced), stars, embers.

## Hits and telegraphs
`circle` radius 5.5 from 0.8 until D.

## Exaggerate
A whole field blooming in a wave; the close-and-burst.
