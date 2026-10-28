# Cloud Step Cyclone

- **Label:** `cloud step cyclone` · **File:** `src/spells/targeted/cloudStepCyclone.ts` · **Module:** `cloudStepCycloneModule`
- **Targeting:** `self`, `radius: 6` (check `src/effects/targeting.ts` and `src/spells/targeted/goldenBellSutra.ts` for how self mode works)
- **Look:** `docs/ART_BIBLE.md` §2 row **Wind**. The shape that makes it ours: **a jade-white cyclone of auspicious clouds**: stylised xiangyun cloud curls (spiral cloud motifs drawn on canvas, outlined) spinning round the caster in a funnel, lifting enemies, then flinging them out.
- **Recipes:** `j-lelu-twisted-wind-tornado` (the funnel mesh shape does the motion; spin the mesh one way and scroll the texture the other), `i-guide-swirl-slice-tornado` (slices inside the tornado), `e-seo-wind-bullet` (the outward nova).

## Timeline (~4.4 s)
- 0-0.6: grade 0.5. Cloud curl sprites appear on the ground round the caster and start to orbit.
- 0.6-2.2: a funnel (twisted lathe, 6 m tall, flared top) with scrolling toon wind bands spins round the caster; cloud curls ride up its wall; enemies within the radius are pulled in and lifted 1-2 m (`ctx.displace`), ticks every 0.4 s `damage: 6`.
- 2.2-2.35: the funnel pinches tight, dead beat.
- D = 2.4: burst: the funnel blows outward into a flat ring of cloud curls, grade impact frame, enemies flung outward `ctx.hit(e, { damage: 35, knock: 9, from: caster })`.
- 2.4-4.4: cloud curls drift outward and fade by thinning their outlines; a grey dust vortex keeps spinning.

## Layers
grade, cloud curl sprites (normal, outlined), funnel bands (toon), lifted debris, burst ring, dust vortex.

## Hits and telegraphs
`circle` radius 6 round the caster from 0.6 until D.

## Exaggerate
Enemies lifted into the funnel; cloud motifs instead of generic smoke.
