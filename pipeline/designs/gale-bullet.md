# Gale Bullet

- **Label:** `gale bullet` · **File:** `src/spells/targeted/galeBullet.ts` · **Module:** `galeBulletModule`
- **Targeting:** `enemy`
- **Recipes (user reference videos):**
  - `e-seo-wind-bullet` (seo): a ground swirl at the feet and a dust burst that hides the caster for a beat, then a
    cyclone of hard-edged white and mint crescent blades on many tilted planes, a mint ground ring and flying
    rocks. The arcs fade into dark-teal ghost crescents that keep turning slowly.
  - `e-yordin-soft-wind-swirl` (wind sheets with hooked tips, straight gust lines through the swirl) for the bullet
    itself.
  - Rules: VFX_PRINCIPLES §8 (wind is shape; one dialect per layer; tilted planes; fade by changing state).

## Timeline (~3.4 s)
- 0.0–0.45 anticipation at the caster: a flat spinning swirl ring (createRing + a small soft CrescentArc lying on the
  ground) at the feet, a white puff at waist height, grey dust plumes (normal-blended Emitter, drag 3).
- 0.45 release: a dust burst engulfs the caster (hold, then reveal), shake 0.25. The **wind bullet** fires: a
  compact ball of 4 small soft CrescentArcs on tilted planes, spinning fast (white → mint) around a GlowSphere
  core. It flies straight (slightly arcing) to the target chest in 0.35 s, trailing straight gust lines (2–3
  stretched thin soft arcs or a trail emitter) and dust.
- 0.8 impact at the target: the bullet bursts into the **cyclone**: 7 hard-edged crescents (CrescentArc style
  'soft', edge white, mid `#c8fff0`, outer `#40d8a0`, opacity ~0.9) on random tilted planes (yaw random, tilt 20–70°)
  around the target, each sweeping 120–200° in 0.15–0.25 s with ease-out, re-sweeping 2–3 times during
  0.8–1.9. Plus 2–3 large normal-blended grey-white toon crescents further out, sweeping slower. A mint ground
  ring expands 0.8 → 3 (thick, then thin). 20 dark rock chunks fly radially (instanced, gravity 18, scale ≥ 1e-4).
  Four-point `StarBurst` glints (4 points, inner 0.12, white) flick at random points on the arcs.
  - Hits: `ctx.hit(target, { damage: 8, knock: 1 })` at 0.8, 1.1 and 1.4 (the cyclone grinds). The target is lifted
    with `ctx.displace` up to 1.5 during 0.8–1.9, then dropped with a final `ctx.hit(target, { damage: 40, knock: 6 })`
    at 1.9.
  - `screen.speedLines` 0.5 for 0.15 s at 0.8, focus on the target.
- 1.9–3.4 aftermath: the crescents lose their white edge and turn dark teal (`#2a6a5a` / `#1a3a3a`). Lerp their
  colours, keep them turning at 30% speed, erode them away over 1 s. Dust settles.

## Telegraphs
A line from the caster to the target (width 1.2): start 0.1, impact 0.8. A circle at the target (radius 3):
start 0.45, impact 0.8, until 1.9.

## Exaggerate
The dust hold before the reveal, the many tilted crescents (the cyclone must read as 3D from any camera), the
lift, and the slam drop.
