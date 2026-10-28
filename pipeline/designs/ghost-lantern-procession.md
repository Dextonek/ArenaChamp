# Ghost Lantern Procession

- **Label:** `ghost lantern procession` · **File:** `src/spells/targeted/ghostLanternProcession.ts` · **Module:** `ghostLanternProcessionModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Look:** `docs/ART_BIBLE.md` §2 row **Void / shadow (lanterns warm red-black paper)**. The shape that makes it ours: **floating paper lanterns** (red-black paper shells with violet ghost flame inside, gold tassels) drifting in a procession that winds to each enemy and bursts into ghost fire.
- **Recipes:** `e-yougelly-starfall-comets` (several slow projectiles with long trails), `d-maxmdp-2-ghost-moon-sigil-aura` (ghostly palette and soft wisps), `i-chromatic-black-blob-finisher` (black blob burst finish).

## Timeline (~4.6 s)
- 0-0.8: darken 0.75. Lanterns (cylinders with paper shading, dark ribs, violet core showing through) rise one by one round the caster, swaying.
- 0.8-2.6: they drift in a winding single-file line toward the targets, each peeling off to its own target in order; ghost wisps trail.
- each arrival: the lantern hangs over its target 0.3 s, flame flaring, then drops and bursts into violet ghost fire (toon flames, black core), `ctx.hit(e, { damage: 12, knock: 1 })`.
- D = 2.8: all ghost fires flare together: impact frame, magenta accent, black blob bursts. `ctx.hit(e, { damage: 30, knock: 4 })`.
- 2.8-4.6: burnt paper scraps flutter, wisps rise, fires shrink to embers.

## Layers
darken, lanterns (normal paper + additive core max 0.5), tassels, wisps, ghost fire (toon), black blobs, paper scraps.

## Hits and telegraphs
`circle` 1.4 under each target from its lantern's peel-off until D.

## Exaggerate
A slow eerie procession, then a synchronised ghost-fire flare.
