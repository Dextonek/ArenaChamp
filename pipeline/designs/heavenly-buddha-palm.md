# Heavenly Buddha Palm

- **Label:** `heavenly buddha palm` · **File:** `src/spells/targeted/heavenlyBuddhaPalm.ts` · **Module:** `heavenlyBuddhaPalmModule`
- **Targeting:** `ground`, `radius: 5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Solar / holy**. The shape that makes it ours: **a colossal golden palm** (a translucent open hand drawn as a flat canvas silhouette with a dark gold outline and palm-crease line art) descending from parting clouds and pressing the area flat, leaving a palm-print crater.
- **Recipes:** `a-val-brimstone-orbital-strike` (strike from above with a clear ground marker), `f-beyondfx-sunrise-pillar-strike` (gold light from above, held hang), `b-elden-ring-radahn-meteor-impact` (crater and debris).

## Timeline (~4.6 s)
- 0-0.7: darken 0.6 tint `#2a1a06`. Clouds part above the area (soft cloud sprites sliding outward), a gold light shaft comes down.
- 0.7-1.8: the palm (8 m, palm down, tilted ~30 degrees toward the caster so it reads) descends slowly, golden rim, sutra glyph ring round the wrist; its shadow grows.
- 1.8-1.95: it pauses just above; dead beat.
- D = 2.0: press: impact frames gold, a palm-print crater (dark flat palm decal + plates), gold shock ring, cyan star 2 frames. `ctx.hit(e, { damage: 60, knock: 4, from: center })`. Shake 1.0.
- 2.0-4.6: the palm lifts and dissolves into gold leaf flakes; dust; the print fades last.

## Layers
darken, parting clouds, light shaft, palm (normal translucent body + additive rim max 0.4), glyph ring, shadow, crater print + plates, shock ring, gold leaf.

## Hits and telegraphs
`circle` radius 5 from 0.7 until D.

## Exaggerate
A hand bigger than the arena section, slow and inevitable; the print left in the ground.
