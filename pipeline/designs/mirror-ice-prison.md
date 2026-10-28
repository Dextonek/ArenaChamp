# Mirror Ice Prison

- **Label:** `mirror ice prison` · **File:** `src/spells/targeted/mirrorIcePrison.ts` · **Module:** `mirrorIcePrisonModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Frost / lily**. The shape that makes it ours: **a hexagonal prison of mirror-ice panels** (6 tall faceted panels, dark blue body, white bevel edges) that slam up around the target; light beams bounce between the panels, then the prison implodes and shatters.
- **Recipes:** `i-frost-pillar-snow-dome-rubble` (ice structure rising with snow and rubble), `g-hiyuki-frozen-orb-shatter-finisher` (hold then shatter), `j-abitofgamedev-refraction-bubble` (fresnel rim and a bright line where it meets the floor).

## Timeline (~4.2 s)
- 0-0.5: darken 0.65. A cold glint at the target's feet; frost cracks spread (thin white lines radiating).
- 0.5-0.9: six panels (2.8 m tall) punch up around the target one after another (0.06 s apart) with overshoot, snow puffs at each base. `ctx.hit(e, { damage: 10, knock: 0 })`.
- 0.9-1.9: hold: thin bright beams bounce panel to panel in a star pattern, redrawn every few frames; panel edges flicker white.
- 1.9-2.15: implode: panels tilt inward and close in, dead beat.
- D = 2.2: shatter: impact frames blue, 60+ big flat ice shards (dark bodies, white edges) burst out, blue-white star, violet accent 2 frames. `ctx.hit(e, { damage: 55, knock: 5 })`. Shake 0.8.
- 2.2-4.2: shards land and twinkle out, snow, a frost ring stays.

## Layers
darken, cracks, ice panels (normal, faceted; additive rim copy max 0.35), bounce beams, shards (instanced), stars, snow, frost ring.

## Hits and telegraphs
`circle` 2 at the target from 0.5 until D.

## Exaggerate
Panels slamming up one by one; light trapped inside; shards bigger than the enemy's head.
