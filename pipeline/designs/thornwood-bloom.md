# Thornwood Bloom

- **Label:** `thornwood bloom` · **File:** `src/spells/targeted/thornwoodBloom.ts` · **Module:** `thornwoodBloomModule`
- **Targeting:** `ground`, `radius: 5`
- **Palette (value ladder core → hot → body → accent → dark):** pale green `#e8ffd8` → leaf `#7ad04a` → vine `#2f6a2a` → rose crimson `#e02a4a` → bark dark `#140c06`
- **The shape that makes it ours:** **giant thorned vines** erupt in a spiral, arch over the area into a **cage of briars**, then the cage **blooms into huge crimson roses** that burst into petals and thorns.
- **Recipes:** `c-ice-spikes-eruption` (eruption in sequence), `i-ice-cathedral-line-cone-eruption` (spires rising in a pattern), `e-geodraws-crimson-pillar` (spiral ribbons round a pillar)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.8 s)
- 0-0.6: darken 0.55, green-dark grade. Roots crack the ground in a spiral (dark lines), leaves rustle up.
- 0.6-1.6: 8 thick vines (tubes, bark-dark with green highlights, hard black thorn cones along them) burst up in spiral order and arch over the centre into a dome cage; small hits (damage 6) as they rise.
- 1.6-2.0: rose buds swell at the vine tips (flat-shaded petal clusters, crimson with dark edges); dead beat.
- D = 2.05: the roses burst open (big, 1.5 m), petals and thorns spray outward, impact frames (crimson, short), a pale green star; `ctx.hit(e, { damage: 50, knock: 4, from: center })`.
- 2.05-4.8: vines wither (darken, shrink back into the ground), petals drift and settle, fade.

## Exaggerate
A cage that becomes a garden; roses bigger than the enemies.
