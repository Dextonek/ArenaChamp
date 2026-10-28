# Orbital Lance

- **Label:** `orbital lance` · **File:** `src/spells/targeted/orbitalLance.ts` · **Module:** `orbitalLanceModule`
- **Targeting:** `enemy`
- **Palette (core → hot → body → accent → dark):** white `#ffffff` → laser cyan `#7ff0ff` → tech blue `#2a8aff` → warning red `#ff3a3a` → hull dark `#0a0e14`
- **The shape that makes it ours:** a **satellite** (a small drawn/mesh space station with solar panels, tilted toward the caster, high in the sky) locks on with a **hex-grid targeting reticle** on the ground, then fires a **thick orbital beam** that drills down.
- **Recipes:** `a-val-sova-hunters-fury` (a tech beam with a lock-on), `c-gnomon-charged-energy-beam` (charge then a thick beam), `a-dota-invoker-sun-strike` (strike from above at a point)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.4 s)
- 0-0.6: darken 0.6 cold. A hex-grid reticle unfolds on the ground at the target (hexes popping outward, thin cyan lines, a red centre crosshair that rotates).
- 0.6-1.6: the satellite slides into view high above (tilted toward the caster so its panels read), panels unfold, a red lock-on laser pointer (thin) touches the target; countdown ticks (3 red pulses on the reticle).
- 1.6-1.8: charge glow at the satellite's dish (small, cyan, hard flare); dead beat.
- D = 1.85: a thick beam (dark under-beam wider, cyan core, white only in a thin centre) drills down; impact frames (cyan, short); the hex grid shatters outward as flat tiles; molten ring on the ground. `ctx.hit(e, { damage: 70, knock: 3 })`.
- 1.85-4.4: the beam narrows to a line and stops; the satellite retracts its panels and slides away; a glowing hex scorch cools.
