# Tesla Coil Field

- **Label:** `tesla coil field` · **File:** `src/spells/targeted/teslaCoilField.ts` · **Module:** `teslaCoilFieldModule`
- **Targeting:** `ground`, `radius: 5.5`
- **Palette (core → hot → body → accent → dark):** white `#ffffff` → electric violet-white `#e0d8ff` → tesla blue `#5a7aff` → copper accent `#c87a3a` → iron dark `#14100c`
- **The shape that makes it ours:** **four brass-and-copper tesla coils** (copper toroid tops, coiled windings, iron bases) burst up around the area, crackle between each other, form a **lightning cage**, then all discharge into the centre.
- **Recipes:** `c-electric-blast-branching-ground` (branching ground arcs), `a-smite-zeus-chain-lightning` (chain between points), `j-cghow-outlined-stylized-bolt` (outlined stylised bolt with a black copy)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.6 s)
- 0-0.8: darken 0.75. Four coils pop up from the ground at the corners of the area (lathe meshes: iron base, copper winding bands, brass toroid top; mid-tone materials, the toroid edge the only glow).
- 0.8-1.9: arcs jump coil to coil (thin bolts with black copies), forming a square cage, then cross arcs to the centre; small hits (damage 6) on enemies near arcs; a hum of small sparks.
- 1.9-2.1: all arcs stop; the toroids glow violet; dead beat.
- D = 2.15: all four coils discharge into the centre: four thick bolts converge, a ground nova of branching arcs, impact frames (violet, short). `ctx.hit(e, { damage: 50, knock: 4, from: center })`.
- 2.15-4.6: coils smoke (small) and sink; arcs die into dashes; scorch fades.
