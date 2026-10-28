# Red Lotus Inferno

- **Label:** `red lotus inferno` · **File:** `src/spells/targeted/redLotusInferno.ts` · **Module:** `redLotusInfernoModule`
- **Targeting:** `ground`, `radius: 5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Fire / phoenix**. The shape that makes it ours: **a giant fire lotus** on the ground: 2 rings of 8 broad petals (flat meshes, dark red base, orange body, gold tips, black outline edge) that open, burn, close into a bud and erupt as a fire pillar.
- **Recipes:** `i-fire-rune-burn-in-eruption` (a ground pattern burns in before the eruption), `h-stylizedstation-igni-cone-burst` (primary / secondary / tertiary split, highest values reserved for the damage beat), `h-beyondfx-botw-bomb-explosion` (dark lit smoke body, colour only in small accents).

## Timeline (~4.6 s)
- 0-0.7: darken 0.65. A ring of fire runes burns into the ground (`createRing` + 8 glyph bars revealed in order, dark red to orange).
- 0.7-1.6: the lotus rises out of the circle: outer petals open flat outward, inner ring half-open, rippling. Each petal edge burns with a small flame fringe (short additive strips). Ticks on enemies inside: `ctx.hit(e, { damage: 6, knock: 0 })` at 1.0 and 1.4.
- 1.6-2.0: implode: petals snap closed into a tall bud (ease-in), dead beat 1.95-2.0.
- D = 2.05: the bud bursts: a fire pillar (`LightPillar` orange + dark normal-blended smoke column), petals fly off outward and burn to ash, impact frames orange, cool star at the base for 2 frames. `ctx.hit(e, { damage: 55, knock: 6, from: center })`. Shake 0.9.
- 2.05-4.6: pillar collapses to a line + star, ash petals fall, lit dark smoke bulges outward, a black scorch lotus print stays and fades last.

## Layers
darken, rune ring, lotus petals (normal, flat shaded), petal flame fringe (additive), pillar, dark smoke (`SmokeBall` + column), ash petals, scorch print.

## Hits and telegraphs
`circle` radius 5 from 0.7 until D.

## Exaggerate
A flower bigger than the enemies closing into a bud and exploding; the burnt lotus print left behind.
