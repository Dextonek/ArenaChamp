# Bifrost Strike

- **Label:** `bifrost strike` · **File:** `src/spells/targeted/bifrostStrike.ts` · **Module:** `bifrostStrikeModule`
- **Targeting:** `ground`, `radius: 4.5`
- **Palette (value ladder core → hot → body → accent → dark):** white `#ffffff` → a 7-band rainbow (`#ff5a5a` `#ffa04a` `#ffe45a` `#5aff8a` `#4ac8ff` `#6a6aff` `#c45aff`), kept as thin bands → dark storm `#0c0e18`
- **The shape that makes it ours:** a **rainbow bridge** arcs down from the sky (a wide ribbon of 7 hard colour bands, each band a separate strip, with a black outline on the edges) and lands like a hammer on a **Norse rune circle** (Elder Futhark runes, knotwork ring).
- **Recipes:** `e-yougelly-twin-sky-beams` (beams from the sky), `f-beyondfx-sunrise-pillar-strike` (pillar from above, held hang), `a-lol-lux-final-spark` (a beam with a long build and a short release)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.4 s)
- 0-0.7: darken 0.7, storm tint. A knotwork rune ring draws on the ground (canvas: futhark runes, interlaced band, black outline, pale gold-white).
- 0.7-1.6: high in the sky (tilted toward the caster) a prism point appears; the rainbow ribbon grows from it in an arc toward the circle, band by band (red first), slowly.
- 1.6-1.8: the ribbon hangs just short of the ground; the runes light one by one; dead beat.
- D = 1.85: the bridge slams down: impact frames (white, short), each colour band splashes out as a flat ring in order (7 rings, staggered 0.03 s), the runes flash, small dark storm debris. `ctx.hit(e, { damage: 55, knock: 5, from: center })`.
- 1.85-4.4: the bridge dissolves from the sky end down into falling prism shards; the rune ring fades last.

## Exaggerate
A rainbow used as a weapon; colour rings splashing out in order.
