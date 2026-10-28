# Murder of Crows

- **Label:** `murder of crows` · **File:** `src/spells/targeted/murderOfCrows.ts` · **Module:** `murderOfCrowsModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Palette (core → hot → body → accent → dark):** bone white `#e8e4dc` → pale violet `#b8a0d8` → crow black-blue `#1a1a2a` → blood red eye accent `#e0203a` → ink `#050508`
- **The shape that makes it ours:** a **flock of crows** (drawn canvas silhouettes with flapping wings, red eyes) bursts from the caster's cloak, swirls into a **giant spectral raven** shape in the sky, then dives on the enemies as a storm of birds and feathers.
- **Recipes:** `e-yougelly-starfall-comets` (many projectiles with trails), `i-blood-splat-crescent-kit` (crescent slashes across targets), `g-castorice-wing-nova-finisher` (wings as the held reveal)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.8 s)
- 0-0.6: darken 0.7 grey-violet, desaturate a little. Black feathers spill from the caster; 40-60 crows burst out (flapping sprite pairs).
- 0.6-1.6: the flock swirls up and assembles into a giant raven silhouette (the birds arrange along the raven outline: wings spread, head, tail) above and behind the caster, red eyes glinting.
- 1.6-1.9: the raven screams (wings flare, a shock ring of feathers); dead beat.
- D = 2.0: the raven breaks into crows that dive on the targets in streams; each target gets 2-3 crimson slash crescents; impact frames (black/red, short). `ctx.hit(e, { damage: 40, knock: 2 })`.
- 2.0-4.8: crows scatter outward and fly off; feathers drift down and fade.
