# Glitch Purge

- **Label:** `glitch purge` · **File:** `src/spells/targeted/glitchPurge.ts` · **Module:** `glitchPurgeModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Palette (value ladder core → hot → body → accent → dark):** white `#ffffff` → cyan `#3af2ff` → magenta `#ff3ad0` → yellow accent `#ffe03a` → void black `#05050a`
- **The shape that makes it ours:** **reality glitches**: each enemy gets **pixel blocks** tearing off it, **RGB-split ghost copies** and a **data-cube cage**; the world stutters (stepped frames) and then each target is **deleted** with a vertical scanline wipe.
- **Recipes:** `i-xray-cyan-punch-impact-cards` (X-ray / card impact frames), `i-chromatic-ink-charge-prism-burst` (prism split), `i-void-cut-rotating-band-slash` (rotating band cut)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.2 s)
- 0-0.5: `screen.desaturate` partly, chroma pulse; a cursor-like cyan reticle locks onto each target in order (hard square brackets, blinking).
- 0.5-1.6: glitch phase: around each target, flat square pixel blocks (instanced quads, cyan/magenta/black) jump to random offsets every 3-4 frames (stepped, not smooth); two RGB-offset ghost copies of a vertical bar flicker; a wireframe cube cage forms around each. Small hits (damage 8) per target in order.
- 1.6-1.9: the whole screen "freezes": everything holds still for 0.15 s (dead beat), then a scanline sweeps.
- D = 1.95: delete: per target a vertical scanline wipe (a thin bright bar moving up through the enemy, cyan core, magenta edge) while the cube cage collapses to a point; impact frame type 3 (X-ray card) short; `ctx.hit(e, { damage: 40, knock: 1 })`. Small black pixel debris falls.
- 1.95-4.2: leftover pixels fall and wink out one by one; reticles fade.

## Exaggerate
Stepped, jittery motion (it should feel like a broken frame rate) against otherwise smooth spells.
