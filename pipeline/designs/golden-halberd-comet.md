# Golden Halberd Comet

- **Label:** `golden halberd comet` · **File:** `src/spells/targeted/goldenHalberdComet.ts` · **Module:** `goldenHalberdCometModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Solar / holy**. The shape that makes it ours: **a giant golden halberd (ji)** summoned in the caster's hand and thrown like a comet with a long gold trail and a black under-trail; it pierces the target and stays planted like a monument.
- **Recipes:** `a-lol-ashe-enchanted-crystal-arrow` (one heavy projectile with a long readable flight), `g-fuga-fire-arrow-pillar` (a pillar erupts where it lands), `i-lanza-leaf-burst-needle-throw` (needle telegraph before the throw).

## Timeline (~3.8 s)
- 0-0.8: grade 0.5. The halberd (6 m: shaft, crescent blade, spear tip, red tassel; object rules: dark gold body, bright edges) forms in the caster's raised hand from converging gold motes and turns to aim.
- 0.8-1.0: a needle-thin gold line flashes from the tip to the target. Dead beat.
- 1.0-1.35: thrown: slight spin, a long comet trail (gold strip + wider black under-strip), sparks peel off.
- D = 1.4: it pierces the target and plants in the ground behind it at an angle: impact frames gold, light pillar, cool star 2 frames, ground cracks. `ctx.hit(e, { damage: 60, knock: 6 })`.
- 1.4-3.8: it stays planted, glowing, then breaks into gold motes from the tip down; the pillar collapses to a line.

## Layers
grade, converging motes, halberd, aim needle, comet trail + black under-trail, sparks, pillar, cracks.

## Hits and telegraphs
`line` from caster to target from 0.8 until D.

## Exaggerate
A weapon bigger than the caster, left planted after the hit.
