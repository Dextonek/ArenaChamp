# Sun Disk of Ra

- **Label:** `sun disk of ra` · **File:** `src/spells/targeted/sunDiskOfRa.ts` · **Module:** `sunDiskOfRaModule`
- **Targeting:** `enemy`
- **Palette (value ladder core → hot → body → accent → dark):** white `#fffbe8` → gold `#ffd860` → deep gold `#c8901a` → lapis `#2a5ad8` / turquoise `#3ad0c8` accents → sand dark `#20140a`
- **The shape that makes it ours:** a **winged sun disk** (Egyptian: a gold disk flanked by two long feathered wings and two uraeus cobras, drawn on canvas, gold + lapis bands) rises behind the caster; a **scarab** rolls the sun forward and the disk fires a sun beam onto the target.
- **Recipes:** `e-yougelly-rune-portal-beam` (a sigil that fires a beam), `j-aguiar-layered-laser-beam` (three-copy beam: dark under-beam, bright core, alpha-clipped electric copy), `a-dota-invoker-sun-strike` (beam from above at a point)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.4 s)
- 0-0.6: darken 0.55 warm. Hieroglyph cartouche glyphs float up around the caster (canvas glyphs, gold on dark).
- 0.6-1.5: the winged sun disk unfolds behind and above the caster (wings open from folded), facing the caster's view; a scarab silhouette rolls across the disk face.
- 1.5-1.8: the disk tilts toward the target; a thin gold aim line; the cobras' eyes glint turquoise; dead beat.
- D = 1.85: the beam fires (dark wider under-beam, gold core, white only in its thin centre), lands on the target as a sun-strike column; impact frames (gold, short); sand ring + small dark dust; a lapis star 2 frames. `ctx.hit(e, { damage: 65, knock: 4 })`.
- 1.85-4.4: the beam holds 0.4 s then pinches to a line; a burned ankh mark stays on the ground; the disk folds its wings and sinks.

## Exaggerate
The wing spread behind the caster; the scarab rolling the sun; the ankh scorch.
