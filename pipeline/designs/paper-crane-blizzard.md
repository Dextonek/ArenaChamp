# Paper Crane Blizzard

- **Label:** `paper crane blizzard` · **File:** `src/spells/targeted/paperCraneBlizzard.ts` · **Module:** `paperCraneBlizzardModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Look:** `docs/ART_BIBLE.md` §2 row **Frost / lily**. The shape that makes it ours: **origami paper cranes**: flat faceted folded-paper birds (white / pale blue, flat shaded, a dark crease line) flying in a V formation, flapping, that dive into enemies and burst into snowflakes.
- **Recipes:** `a-dota-lich-chain-frost` (projectile visits several targets with a clear rhythm), `i-frigid-rush-dive-snowflake-slam` (dive into a snowflake burst), `e-yordin-soft-wind-swirl` (soft translucent wind sheets).

## Timeline (~4.4 s)
- 0-0.6: darken 0.6 tint `#0e1f3a`. Paper sheets unfold from the caster's hand and fold into 12 cranes (scale + rotate pop, 0.05 s apart).
- 0.6-1.5: cranes rise into a V formation above the caster, wings flapping (two-triangle wings rotating), soft white wind sheets trailing.
- 1.5-2.6: pairs of cranes peel off in order and dive at each target (curved, accelerating). Each hit: a crisp 6-armed snowflake `StarBurst` (additive false, `#bfe8ff`), frost ring decal, `ctx.hit(e, { damage: 12, knock: 1.5 })`.
- D = 2.8: a final big crane (2x) dives at the primary: impact frames blue, a large snowflake star, ice shards, violet accent 2 frames, `ctx.hit` damage 30, knock 5.
- 2.8-4.4: paper scraps flutter down and dissolve into snow; frost rings fade.

## Layers
darken, cranes (flat shaded, normal), crease lines, wind sheets (soft additive, max 0.4), snowflake stars, frost decals, snow and paper scraps.

## Hits and telegraphs
Small `circle` 1.3 under each target from 1.5 until D.

## Exaggerate
A flock in formation peeling off one pair at a time; the oversized last crane.
