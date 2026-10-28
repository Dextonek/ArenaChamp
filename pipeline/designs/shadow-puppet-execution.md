# Shadow Puppet Execution

- **Label:** `shadow puppet execution` · **File:** `src/spells/targeted/shadowPuppetExecution.ts` · **Module:** `shadowPuppetExecutionModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Void / shadow**. The shape that makes it ours: **Chinese shadow-play puppets**: flat black cut-out silhouettes of armoured warriors with jointed limbs and ornate cut-out patterns, back-lit by a violet paper screen, that step out and spear the target.
- **Recipes:** `i-acheron-petal-wipe-monochrome-slashes` (monochrome stage, colour only at the hits), `g-castorice-dash-crescent-spike` (sharp spike strikes), `d-maxmdp-2-grave-hands-portal-aura` (figures emerging from a portal).

## Timeline (~4.4 s)
- 0-0.6: darken 0.85. A tall paper screen (soft violet `#8a2ee0` to `#f0d8ff` rectangle with a vignette) unrolls behind the target, facing the caster.
- 0.6-1.6: three puppet silhouettes (canvas: helmet plume, lamellar armour cut-outs, spear) appear on the screen with jerky stepped puppet animation (limb rotations on pivots, 12 fps).
- 1.6-2.0: they step off the screen into the world (flat cut-outs turning toward the target) and surround it, spears raised. Dead beat.
- D = 2.1: all three thrust: impact frames violet/black, magenta star 2 frames, black ink spikes burst from the target. `ctx.hit(e, { damage: 55, knock: 3 })`.
- 2.1-4.4: puppets collapse as if their strings were cut (limbs fold, fall flat) and burn from the edges into violet embers; the screen tears and fades.

## Layers
darken, paper screen (soft additive), puppets (normal black cut-outs, violet rim), stepped animation, ink spikes, stars, embers, tearing screen.

## Hits and telegraphs
`circle` 2 at the target from 1.6 until D.

## Exaggerate
Theatre: a back-lit screen, stepped puppet motion, cut strings.
