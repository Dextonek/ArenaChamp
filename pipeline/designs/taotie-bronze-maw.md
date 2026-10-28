# Taotie Bronze Maw

- **Label:** `taotie bronze maw` · **File:** `src/spells/targeted/taotieBronzeMaw.ts` · **Module:** `taotieBronzeMawModule`
- **Targeting:** `ground`, `radius: 4.5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Void / shadow, with a bronze object (dark bronze `#3a2a10`, gold highlights, one violet glow)**. The shape that makes it ours: **the taotie mask** of ancient bronze vessels: a huge symmetrical bronze monster face (eyes, horns, spiral motifs) rising out of the ground as two jaw halves that snap shut on the area.
- **Recipes:** `d-kler-1-singularity-accretion-pull` (enemies pulled toward a centre), `i-violet-void-pillar-crystal-skirt` (void pillar), `b-bdo-sorceress-reapers-scythe` (dark sweeping maw).

## Timeline (~4.6 s)
- 0-0.7: darken 0.8. The ground cracks in a taotie face pattern (canvas decal: symmetric spirals, eyes) glowing violet.
- 0.7-1.6: two huge bronze jaw halves (curved shells with the taotie face drawn on canvas, bronze palette, gold highlights, black outline) rise on either side, tilting open; enemies inside are pulled toward the centre (`ctx.displace`), ticks `damage: 5`.
- 1.6-1.75: the eyes flare violet; dead beat.
- D = 1.8: the jaws snap shut: impact frames violet/black, a violet void pillar from the seam, bronze fragments and dust. `ctx.hit(e, { damage: 55, knock: 3 })`.
- 1.8-4.6: the jaws sink back, the decal fades from the edges; violet embers.

## Layers
darken, face decal, bronze jaws (normal, canvas texture), pull streaks, eye flares, void pillar, fragments, dust, embers.

## Hits and telegraphs
`circle` radius 4.5 from 0.7 until D.

## Exaggerate
A face the size of the arena section closing like a trap.
