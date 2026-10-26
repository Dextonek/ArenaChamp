# Azure Dragon Sword (weapon aura)

- **Label:** `azure dragon sword` · **File:** `src/spells/weapons/azureDragonSword.ts` · **Module:** `azureDragonSwordModule`
- **Mode:** idle loop on `wp-sword-dragon`, category `weapons`, period 4 s, ignition 1.0 s.
- **Recipes:** `a-ow-genji-dragonblade` (a spectral dragon wrapping the blade: a translucent ribbon body that reads
  as a living spirit), `f-spiderlily-scythe-ribbon` (a long flame ribbon wrapped round the blade, texture
  scrolling, tip eroding), `f-spiderlily-gauntlet-ignition` (a focal star, lens streak and filament bloom on
  ignition).
- **Palette:** core #f0ffff → cyan #6ff2ff → teal #1aa6a0 → deep #0a3a4a. Model tint a dark teal-navy (#0a1a24),
  rim #5ff0ff.

## Layers (sockets from `SOCKETS['wp-sword-dragon']`)
1. Model: `darken` 0.12, tint #0a1a24, rim #5ff0ff (thin, power 3), breathing once per loop.
2. **Spirit dragon (hero shape):** one long `FlowRibbon` (`cross: true`, width ~0.05 tapering) spiralling up and
   round the blade from the guard (y 0.15) to past the tip (y 1.15): 2 turns, radius 0.09 → 0.05, the "head" end at
   the top. Colours cyan → teal → deep, cycles 2 (the scales scroll up), sway 0.02. A second, thinner, fainter
   ribbon on the same helix, offset by half a turn, as its after-image.
3. Dragon head: a small `StarFlare` (cyan, streak 2) at the top end of the spiral, with two short `FlowRibbon`
   whiskers trailing back from it.
4. Focal `StarFlare` on the guard orb (white-cyan, streak ×5, size ~0.09), with a pop on ignition.
5. Centre-line light: a thin `FlowRibbon` (width 0.012) up the blade's centre line at z +0.008 (and one at -0.008),
   white → cyan → teal, cycles 3: light running up the blade.
6. Qi wisps off the vertebrae spine: 3 short `FlowRibbon`s curling out and up from the `spine` points.
7. Sparkles: an additive emitter fed along the blade line (rate ~14, size 0.01, rising slowly).
8. Halo: a faint cyan `GlowSphere` (rim:false) round the guard.
9. Dark layer: a slow, normal-blended deep-teal mist (eroded emitter) drifting down off the pommel.

**Ignition:** the spiral fades in bottom → top (the dragon uncoils from the guard over 0.6 s), the orb pops, and a
ring of 16 cyan sparkles bursts from the orb.
