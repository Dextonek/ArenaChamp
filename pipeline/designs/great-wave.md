# Great Wave

- **Label:** `great wave` · **File:** `src/spells/targeted/greatWave.ts` · **Module:** `greatWaveModule`
- **Targeting:** `ground`, `radius: 6`
- **Palette (core → hot → body → accent → dark):** foam white `#f4fbff` → wave cyan `#7fd0e8` → deep blue `#1a4a8a` → indigo `#0e1e4a` → ink `#040814`
- **The shape that makes it ours:** a **huge stylised curling wave** (woodblock-print style: a deep blue wall with white foam claws along the crest, hard edges, black outline) rises behind the area, curls over it and **crashes down**.
- **Recipes:** `a-ow-hanzo-dragonstrike` (a water projectile with a sweeping path), `b-zzz-ellen-joe-ultimate` (water slashes, cartoon water shapes), `e-yordin-toon-color-cyclone` (toon bands with a light edge and dark outer edge)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.6 s)
- 0-0.8: darken 0.5 blue. Water seeps up on the ground around the area (flat dark-blue disc with foam rings), small droplets.
- 0.8-1.9: the wave rises on the far side of the area (facing the caster): a curved wall mesh (curl shape, 7 m tall) with toon colour bands (deep blue bottom, cyan middle, white foam crest), foam claws (drawn spiky shapes) along the crest, rising and curling forward.
- 1.9-2.1: the crest hangs over the area; spray hangs in the air; dead beat.
- D = 2.15: the wave crashes: the curl collapses forward onto the area, a ring of foam and spray bursts out, impact frames (cyan, short). `ctx.hit(e, { damage: 55, knock: 7, from: wave back side })`.
- 2.15-4.6: foam rings spread, water drains into the ground, droplets and mist fade.
