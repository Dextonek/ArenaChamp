# Stained Glass Sanctum

- **Label:** `stained glass sanctum` · **File:** `src/spells/targeted/stainedGlassSanctum.ts` · **Module:** `stainedGlassSanctumModule`
- **Targeting:** `ground`, `radius: 5`
- **Palette (core → hot → body → accent → dark):** white `#fff8e8` → amber `#ffc85a` → glass ruby `#d02a4a` / sapphire `#2a5ad0` / emerald `#2aa060` → lead black `#0c0a0c`
- **The shape that makes it ours:** a ring of **tall gothic stained-glass windows** (pointed arches, black lead lines, coloured panes drawn on canvas) rises around the area; light shafts pour through them onto the enemies, then every window **shatters inward** into coloured shards.
- **Recipes:** `f-beyondfx-sunrise-pillar-strike` (light from above, held hang), `i-acheron-crack-web-shatter-finisher` (crack web then shatter), `c-ue4-energy-shield-dome` (a ring of panes as a shield)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.6 s)
- 0-0.8: darken 0.75. Six to eight pointed-arch windows (3.5 m tall) rise from the ground in a ring facing inward, each a canvas drawing: lead tracery, rose motif, saint-less abstract patterns (no religious figures), coloured panes. Panes are normal-blended mid colours, not additive.
- 0.8-1.8: soft coloured light shafts (thin additive quads, ≤0.25) fall through each window onto the centre; coloured light patches dance on the ground. Two small ticks (damage 5).
- 1.8-2.05: cracks spread across all panes (crack web drawn over the canvases); dead beat.
- D = 2.1: all windows shatter inward: hundreds of coloured flat shards fly to the centre and burst, lead frames fall; impact frames (amber, short); `ctx.hit(e, { damage: 55, knock: 4, from: center })`.
- 2.1-4.6: shards rain down and twinkle (colour, not white), lie on the ground and fade.
