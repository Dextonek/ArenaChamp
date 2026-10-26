# Ember Comet

- **Label:** `ember comet` · **File:** `src/spells/targeted/emberComet.ts` · **Module:** `emberCometModule`
- **Targeting:** `ground`, `radius: 4`
- **Recipes (user reference video, html "small little meteor skill"):**
  - `f-html-meteor-slam`: the telegraph is the meteor's own shadow sliding and growing on the ground. A dark faceted
    rock with fire only on its leading edge crosses in ~4 frames. The hit strobes a full-screen yellow-white flash
    3× at 12 fps, with orange crescent arcs and one thin magenta line for 2 frames. Then a cluster of round red
    cartoon puffs with black crescent rings swirling, red sparks and black shards, and the frame is clean ~0.8 s
    after the hit.
  - `f-html-meteor-volley`: optional finale. Two smaller rocks land 0.25 s apart around the main crater, each with a
    small starburst and a crown of black spikes; the last hit is the biggest. Add them as aftershocks 0.35 s and
    0.6 s after the main hit, 3 m from it.
  - Rules: VFX_PRINCIPLES §9 (strobe the flash; the telegraph carries the theme; big flat shapes for ground
    breakage), §7 (black is a colour; clean exit).

## Timeline (~3.0 s)
- 0.0–0.55 anticipation: a dark normal-blended rock-silhouette shadow (a flattened dark disc or a jagged polygon,
  opacity 0.3 → 0.7, scale 0.6 → 1.2) slides along the incoming direction (from the caster's side) toward
  `ctx.point` and grows. `screen.darken` 0.3.
- 0.55–0.9 release: a big dark low-poly rock (an icosahedron with displaced vertices, normal lit material, never
  zero scale) falls from 25 up and 15 back to the point in 0.35 s with ease-in, tumbling slowly. Fire only on its
  leading edge: an additive emitter burst per frame at the front, a trail of flame streaks, and a few black spike
  shards trailing.
- 0.9 impact:
  - Strobe: `screen.impact = impactFrameAt(t, 0.9, [2, 0, 2, 0, 2], 2 / 60)` with `impactColor` `#fff3c0` and
    silhouettes = targets + caster.
  - A big crisp `StarBurst` (12 points, `additive: false`, `#ffd060` / `#fffbe0`) at the point, 6 m, popping.
  - 2–3 orange toon `CrescentArc` segments lying flat around the impact, expanding 0 → 4 m in 0.1 s.
  - One thin straight magenta `LightningArc` (jitter 0.01, branches 0, glow `#ff60e0`) across the impact for 2 frames.
  - Shake 0.9. `ctx.hit(e, { damage: 60, knock: 9, from: point })` for each target.
  - 6–8 big dark triangular ground plates (normal lit meshes) tilt up around the crater and later sink.
- 0.9–1.8 aftermath: 8 round red cartoon puffs (instanced spheres with a toon shader, or `SmokeBall` with colour
  `#e0201a` and rim `#ff8a5a`) scale 0.5 → 1.4 and then darken toward `#3a0a0a` and shrink. 2–3 black toon
  `CrescentArc` rings swirl round the puff cluster, rotating fast while expanding and thinning. Black shards and red
  sparks (emitters, gravity 10).
- 1.25 / 1.5 aftershocks: two smaller rocks land 3 m from the point, each with a small StarBurst, a black spike crown
  (instanced cones, ≥ 1e-4 scale) and red puffs. `ctx.hit` with damage 20 for targets within 2 m of each. The
  last one is bigger.
- The frame is clean by ~2.4. The plates sink by 3.0.

## Telegraphs
Main circle at the point (radius 4): start 0.05, impact 0.9. Two smaller circles (radius 2) at the aftershock spots:
start 0.9, impacts 1.25 / 1.5.

## Exaggerate
The sliding shadow telegraph, the 3× strobe, the red cartoon puffs with black rings (the signature), and the clean
exit.
