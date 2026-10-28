# Aurora Veil

- **Label:** `aurora veil` · **File:** `src/spells/targeted/auroraVeil.ts` · **Module:** `auroraVeilModule`
- **Targeting:** `ground`, `radius: 5.5`
- **Palette (core → hot → body → accent → dark):** white `#f4fff8` → aurora green `#6aff9a` → teal `#3ad0c8` → magenta fringe `#d050c8` → polar night `#04081a`
- **The shape that makes it ours:** **aurora curtains** (tall wavy ribbon sheets with vertical streaks, green body and magenta lower fringe) descend from the sky in a ring around the area like drapes, ripple, then **freeze** into ice and shatter.
- **Recipes:** `e-onlyxyz-sunset-cloud-aura` (layered sky colour bands), `i-ice-spiral-comma-sweep` (an ice sweep), `i-frost-pillar-snow-dome-rubble` (ice structure + snow + rubble)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.8 s)
- 0-0.8: darken 0.85 to a polar night; stars appear (points); a faint aurora band waves high in the sky.
- 0.8-1.9: the curtains descend in a ring around the area (6-8 ribbon sheets with scrolling vertical streak texture, rippling; additive ≤0.3 so they don't white out), touching the ground; snow falls; enemies inside take a tick (damage 6).
- 1.9-2.1: the curtains stop rippling and turn to ice from the bottom up (colour drains to pale cyan, crystal facets drawn in); dead beat.
- D = 2.15: the ice curtains shatter inward: shards fly to the centre, impact frames (teal, short), a frost nova ring. `ctx.hit(e, { damage: 50, knock: 4, from: center })`.
- 2.15-4.8: shards fall and melt, the aurora fades back to a faint sky band.
