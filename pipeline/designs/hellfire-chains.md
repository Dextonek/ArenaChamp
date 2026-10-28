# Hellfire Chains

- **Label:** `hellfire chains` · **File:** `src/spells/targeted/hellfireChains.ts` · **Module:** `hellfireChainsModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Palette (core → hot → body → accent → dark):** flame yellow `#ffe08a` → orange `#ff7a1a` → infernal red `#c01a10` → sulphur green accent `#b8e030` → iron black `#0a0606`
- **The shape that makes it ours:** **demonic glyph gates** open in the ground under each enemy; **heavy iron chains** (linked torus meshes, dark iron with glowing red-hot links) shoot out, wrap the enemies and drag them toward a central **fiery maw** that bites.
- **Recipes:** `d-maxmdp-2-grave-hands-portal-aura` (limbs out of a portal), `f-moa-arm-lightning-lash` (lashes wrapping a target), `c-wow-flamestrike-ground` (a fire column on the ground)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.6 s)
- 0-0.6: darken 0.75 red. A summoning circle (infernal sigil on canvas, red-orange lines, black outline) at the centroid; smaller glyph gates open under each target.
- 0.6-1.5: chains whip out of each gate (link-by-link reveal along a curve), wrap round each enemy (spiral), links glow red-hot then cool; one small hit each (damage 8).
- 1.5-2.0: chains tighten and drag the enemies toward the centre (`ctx.displace`, ~1.5 m); a maw of fire teeth (jagged flame crescents, toon) opens in the central sigil; dead beat.
- D = 2.1: the maw snaps shut on the dragged enemies: flame column (toon flames, black core), impact frames (red, short), chains snap into flying links. `ctx.hit(e, { damage: 45, knock: 5, from: centroid })`.
- 2.1-4.6: links fall and cool to dark iron; embers; sigil burns out last.
