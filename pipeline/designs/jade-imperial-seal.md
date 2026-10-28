# Jade Imperial Seal

- **Label:** `jade imperial seal` · **File:** `src/spells/targeted/jadeImperialSeal.ts` · **Module:** `jadeImperialSealModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Jade qi / dragon**. The shape that makes it ours: **a giant carved jade imperial seal** (a 3 m square jade block with a coiled dragon knob, gold band) that drops from the sky and stamps the target, leaving a **red seal-script stamp mark** on the ground.
- **Recipes:** `a-ow-doomfist-meteor-strike` (landing marked by a growing ground indicator), `c-ground-slam-shockwave-ring` (slam shockwave ring), `b-ffxiv-titan-weight-of-the-land` (heavy object weight; big flat ground breakage).

## Timeline (~4 s)
- 0-0.6: darken 0.6. A red square outline appears round the target and grows (the stamp's footprint).
- 0.6-1.3: the seal descends from 12 m, slowly rotating to align with the square; its dark square shadow grows.
- 1.3-1.4: it stops 1 m above and hangs; dead beat.
- D = 1.45: SLAM: impact frames jade, 8 big dark ground plates tilt up round the square, shock ring, dust. `ctx.hit(e, { damage: 60, knock: 3 })`. Shake 1.0.
- 1.45-2.2: the seal lifts slowly, revealing a vermilion square stamp mark with blocky seal-script strokes (canvas) burned into the ground.
- 2.2-4.0: the seal fades into rising jade motes; the stamp mark stays longest.

## Layers
darken, footprint square, seal (box + gold band + dragon knob from simple meshes; jade value ramp), shadow, plates, shock ring, dust, stamp decal (canvas), motes.

## Hits and telegraphs
`circle` 2 at the target from 0.6 until D.

## Exaggerate
Weight: slow descent, a hang, a slam; the red stamp left behind like a signature.
