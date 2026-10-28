# Sandstorm Djinn

- **Label:** `sandstorm djinn` · **File:** `src/spells/targeted/sandstormDjinn.ts` · **Module:** `sandstormDjinnModule`
- **Targeting:** `self`, `radius: 6` (copy self-mode handling from `src/spells/targeted/goldenBellSutra.ts`)
- **Palette (core → hot → body → accent → dark):** sand white `#fff0d0` → sand gold `#e8b860` → dune ochre `#b8803a` → djinn teal accent `#3ad8c8` → storm brown `#2a1a0c`
- **The shape that makes it ours:** a **sand vortex** spins up around the caster and a **giant djinn** (drawn upper body with folded arms and a smoky tail that IS the vortex, teal eyes, gold jewelry) rises out of it, then claps its hands to blast the sand outward.
- **Recipes:** `j-lelu-twisted-wind-tornado` (twisted funnel shape), `e-yordin-soft-wind-swirl` (soft swirl sheets), `a-marvel-rivals-doctor-strange-eye-of-agamotto` (a big figure/sigil rising behind the caster)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.8 s)
- 0-0.7: darken 0.5 warm. Sand ripples spiral on the ground; a sand funnel (twisted lathe, toon sand bands, normal blend, sand colours) spins up around the caster.
- 0.7-1.8: the djinn rises from the funnel behind the caster (canvas drawing, 6 m, camera-facing, the funnel as its tail), arms crossed, teal eyes open; sand particles stream. Enemies within the radius get pulled slightly and a tick (damage 6).
- 1.8-2.05: the djinn raises its hands; dead beat.
- D = 2.1: CLAP: a ring shock of sand blasts outward (flat toon ring + sand sheets), impact frames (gold, short). `ctx.hit(e, { damage: 45, knock: 9, from: caster })`.
- 2.1-4.8: the djinn dissolves into sand that falls; the funnel slows and sinks; dust settles.
