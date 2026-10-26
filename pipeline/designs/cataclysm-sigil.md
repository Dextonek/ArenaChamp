# Cataclysm Sigil

- **Label:** `cataclysm sigil` · **File:** `src/spells/targeted/cataclysmSigil.ts` · **Module:** `cataclysmSigilModule`
- **Targeting:** `ground`, `radius: 6`
- **Recipes:**
  - `b-ffxiv-bahamut-megaflare`: the warning circles pulse faster as the countdown runs out, and orbs grow above the circles.
  - `c-rookies-meteor-strike`: a tumbling rock in a three-emitter fire shell falls on a diagonal and leaves a smoke trail.
    Then flash → sparks + a low dust ring + bouncing rocks → a scorch mark.
  - `a-dota-invoker-sun-strike`: a column of light from the sky marks the exact spot just before impact.

## Timeline (~5.4 s)
- 0.0–1.6 anticipation: a huge sigil (an outer ring with 3 counter-rotating rings + a star from rings with 3/6
  segments) draws itself at `ctx.point` (radius 6), in burning orange. Its pulse rate rises with the countdown.
  Four smaller satellite circles (radius 2.2) appear 7 units from the point, in the diagonal directions. The sky
  glows (a big soft GlowSphere high above, opacity ≤ 0.25).
- 0.6–2.2 the main meteor (a radius 2.2 icosahedron with flatShading, vertices randomly displaced, dark rock,
  emissive cracks ≤ 1) falls from 45 up and 25 sideways (from the caster's side) on a diagonal ease-in. Shell = 3
  emitters: hot skin, shedding embers, long dark smoke trail. At 1.9 a light column drops onto the point
  (LightPillar, radius ≈ 2).
- 2.2 main impact: a white core flash (3 frames), a burst shell, 3 staggered rings (0, +0.06, +0.14 s), a low dust ring
  (normal blend), 900 sparks, 60 bouncing rocks (instanced, gravity 18, bounce 0.35), a dust column rising, shake
  0.9. `ctx.hit(e, { damage: 70, knock: 10, from: point })` for every target.
- 2.5 / 2.65 / 2.8 / 2.95: four satellite meteors (smaller, radius 0.9, faster, 0.5 s fall) hit the satellite
  circles in turn, each with a smaller flash, ring, sparks and rocks. Hit every `ctx.targets` enemy whose
  `targetPos` is within 2.2 of that satellite: damage 25.
- Aftermath to 5.4: a scorch decal (a dark normal-blend disc, radius 5) with glowing ember cracks (additive ring
  segments) cooling from orange to dark over 2.5 s, rising embers, dark smoke drifting, rocks settling.

## Palette
`#fff0b0 → #ff7a1a → #7a2008`, smoke `#3a2418 → #120c09`.

## Telegraphs
The main circle (radius 6): start 0.1, impact 2.2, until 3.4 (burning ground). Four satellite circles
(radius 2.2): start 0.6, each impact at its own time.

## Exaggerate
Rock size, the triple-ring stagger, the delayed satellite strikes (an aftershock rhythm), the scorch that cools
slowly.
