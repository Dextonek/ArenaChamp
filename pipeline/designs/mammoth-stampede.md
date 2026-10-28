# Mammoth Stampede

- **Label:** `mammoth stampede` · **File:** `src/spells/targeted/mammothStampede.ts` · **Module:** `mammothStampedeModule`
- **Targeting:** `enemy` (the charge runs along the caster→target line and through it)
- **Palette (core → hot → body → accent → dark):** frost white `#f0f8ff` → spirit blue `#9ad8ff` → steel blue `#3a6a9a` → amber eye accent `#ffb03a` → tundra dark `#0e141c`
- **The shape that makes it ours:** a **ghostly woolly mammoth spirit** (drawn translucent silhouette with tusks and shaggy fur strokes, black outline, inner light) materialises behind the caster and **charges** along the line through the target, frost trail and hoof-print shockwaves behind it.
- **Recipes:** `a-dota-windranger-powershot` (a charged line shot through targets), `f-swipe-spiral-rush` (a rush with a spiral trail), `b-wuwa-jiyan-tactical-strike` (a heavy dash strike)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.2 s)
- 0-0.8: darken 0.55 cold. Snow wind gusts; the mammoth spirit forms behind the caster from swirling frost motes (silhouette drawn on canvas, camera-facing, side profile turned along the charge line), lowers its head, amber eyes.
- 0.8-1.1: it stamps once (ground ring); dead beat.
- 1.1-1.6: the charge: the mammoth thunders along the line (fast), each stride leaves a frost hoof print and a small shockwave; a frost trail behind it.
- D = 1.45: it hits the target: tusks upward toss, impact frames (blue, short), ice shards burst. `ctx.hit(e, { damage: 60, knock: 8 })`.
- 1.6-4.2: the spirit runs on and dissolves into snow; hoof prints frost over and fade.
