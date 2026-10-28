# Thunder God Drums

- **Label:** `thunder god drums` · **File:** `src/spells/targeted/thunderGodDrums.ts` · **Module:** `thunderGodDrumsModule`
- **Targeting:** `ground`, `radius: 5.5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Thunder**. The shape that makes it ours: **a ring of eight floating war drums** (dark lacquer cylinders, gold rims and studs, violet glowing drumheads) circling above the area; each beat drops a bolt.
- **Recipes:** `a-dota-zeus-thundergods-wrath` (thick instant bolts with a ground pre-spark), `c-electric-blast-branching-ground` (branching ground arcs after each bolt), `f-moa-storm-call` (a storm channel with escalating rhythm).

## Timeline (~4.8 s)
- 0-0.6: darken 0.8 tint `#120a24`; storm haze gathers. Eight drums fade in at 7 m in a ring of radius 4, rotating slowly.
- 0.6-2.4: beats in order round the ring, accelerating (0.3 to 0.12 s apart): the drumhead flashes violet, a ripple ring pops off it, and a `LightningArc` bolt (with a black under-copy) hits a random spot in the area, after a ground spark. Enemies within 1.5 m of a bolt: `ctx.hit(e, { damage: 8, knock: 1 })`.
- 2.4-2.55: all drums stop and tilt toward the centre; dead beat.
- D = 2.6: all eight beat at once: eight bolts converge on the centre, impact frames violet, cyan star 2 frames, ground discharge. `ctx.hit(e, { damage: 45, knock: 5, from: center })`.
- 2.6-4.8: drums drift up and fade by turning to gold outlines; arcs evaporate into dashes; toon smoke ring.

## Layers
darken, storm haze (normal), drums (lacquer, gold rims, violet heads), beat ripples, bolts + black copies, ground arcs, stars, smoke.

## Hits and telegraphs
`circle` radius 5.5 from 0.6 until D.

## Exaggerate
An accelerating drum roll you can see; eight bolts converging at once.
