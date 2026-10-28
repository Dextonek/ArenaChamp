# Ink Moon Severance

- **Label:** `ink moon severance` · **File:** `src/spells/targeted/inkMoonSeverance.ts` · **Module:** `inkMoonSeveranceModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Void / shadow**: core `#f0d8ff` → hot `#d68cff` → body `#8a2ee0` → accent
  magenta `#ff3fa0` → dark `#07030c`. The shape that makes it ours: **a calligraphy ink crescent moon**: a huge black
  brush-stroke crescent with a thin violet-white edge, painted across the sky, that then cuts down through every
  target. Ink is the black-as-a-colour layer; the light is a thin edge.
- **Recipes:**
  - `g-castorice-void-moon-wedge-sweep`: a moon-shaped wedge sweeps across many targets (taken: the sweep).
  - `i-acheron-petal-wipe-monochrome-slashes`: the world turns monochrome and slashes land as flat black/white
    strokes, colour returns at the end (taken: monochrome beat with one colour accent).
  - `b-elden-ring-transient-moonlight`: a crescent of moonlight released as a travelling arc (taken: the moon
    travels as one clean shape).

## Timeline (~4.2 s)
- **0.0–0.5 the brush.** `screen.darken` → 0.8, tint `#07030c`, and the world desaturates (use the grade if
  `ScreenFx` has one; otherwise a heavy dark tint). Ink drops (small black normal-blended blobs) drip upward from
  the caster's hand. A thin violet line draws itself on the ground through the targets' positions (the cut path:
  a polyline through all targets, nearest first), like a brush guide.
- **0.5–1.3 the moon is painted.** Above the caster, a giant crescent moon (~9 m) is painted by a moving brush tip:
  a `CrescentArc` (toon dialect, outer black `#07030c`, mid `#8a2ee0`, edge `#f0d8ff`) whose length grows 0 → 1
  with a ragged brush tail, plus a black under-copy slightly wider (normal blend). Ink splatter dots fly off the
  brush tip (black, normal). A thin magenta rim pulses once when the stroke completes.
- **1.3–1.55 hold + dead beat.** The moon hangs; violet sparks crawl along its edge. 1.5–1.55 nothing moves.
- **1.55–2.0 the cut.** The moon tilts to vertical and sweeps down and along the ground path, passing through the
  targets in order (~0.08 s apart). Each target, as it is crossed: a flat black ink slash stroke (a `CrescentArc`
  toon, black body, white edge) appears across it at a sharp angle and stays, `ctx.hit(e, { damage: 15, knock: 0 })`
  and a small magenta `StarBurst` (additive: false).
- **D = 2.15 sever.** One frame of full monochrome impact: `impactFrameAt(t, D, [2, 1, 2])`, `impactColor`
  `#8a2ee0`, silhouettes = targets. Then every slash stroke **splits**: each stroke breaks into two halves that
  slide apart along the cut and fade, and an ink burst (a ring of black blobs + violet spray) bursts from each
  target. `ctx.hit(e, { damage: 40, knock: 4, from: along the cut })`. Shake 0.8.
- **2.15–4.2 aftermath.** The moon dissolves into falling ink petals (black flakes with violet edges), the ground
  path line fades last. Colour returns over 0.6 s. Frame clean by ~3.6 s.

## Layers (8)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | darken + monochrome tint | `ScreenFx` | — | `#07030c` |
| 2 | ink drips + splatter | `Emitter` / instanced blobs | normal | black |
| 3 | ground cut path | thin line mesh | additive | `#d68cff` |
| 4 | painted moon + black under-copy | `CrescentArc` toon ×2 | normal | black / violet / edge `#f0d8ff` |
| 5 | edge sparks | `Emitter` / `LightningArc` thin | additive | `#d68cff` |
| 6 | slash strokes per target | `CrescentArc` toon | normal | black body, white edge |
| 7 | magenta accents + impact frame | `StarBurst`, `impactFrameAt` | normal | `#ff3fa0`, `#8a2ee0` |
| 8 | ink burst + petals | instanced blobs, `SmokeBall` (black) | normal | black, violet edge |

## Hits and telegraphs
- Telegraph: a `line` zone along each segment of the cut path (or a small `circle` 1.4 under each target), from
  0.5 until D.
- Hits: small hit per target as the moon crosses it, main hit on all at D.

## Exaggerate
- The moon is painted in the sky as one big brush stroke before it is used.
- Everything is black and violet; magenta appears only at the hits, 2–3 frames each.
- The split: every slash halves and slides apart at once.
