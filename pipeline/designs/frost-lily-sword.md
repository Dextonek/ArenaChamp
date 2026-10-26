# Frost Lily Sword (weapon aura)

- **Label:** `frost lily sword` · **File:** `src/spells/weapons/frostLilySword.ts` · **Module:** `frostLilySwordModule`
- **Mode:** idle loop on `wp-sword-ice`, category `weapons`, period 4 s, ignition 0.8 s.
- **Recipes:** `a-lol-ashe-enchanted-crystal-arrow` (crystal glitter shed from a frost weapon, a bright head),
  `c-ice-spikes-eruption` (cold fog rolling low, snow motes, a frost ring on the ground),
  `f-spiderlily-gauntlet-ignition` (filament bloom, star and lens streak, here with straight crystal spikes).
- **Palette:** white #ffffff → ice #bfeaff → blue #4aa8ff → deep #0a2f7a. Model tint a cold navy (#0a1428),
  rim #9fe0ff.

## Layers (sockets from `SOCKETS['wp-sword-ice']`)
1. Model: `darken` 0.18 (so the translucent blade still reads), tint #0a1428, rim #9fe0ff, power 2.
2. **Frost lily (hero shape):** a `LilyBurst` with `curl: 0` (straight crystal spikes), ice colours, on the guard
   hub, size ~0.26, with an oscillating spin; it blooms on ignition.
3. Focal `StarFlare` on the hub / gem (white-ice, streak ×5). A smaller one on the blade tip glints once per loop.
4. Edge frost: two thin `FlowRibbon`s along both blade edges (x = ±0.03, z +0.012), white → ice → blue, cycles 2:
   cold light creeping up the edges.
5. Cold mist: 3–4 normal-blended, pale `FlowRibbon`s (or a soft eroded emitter) falling slowly from the pommel and
   the scroll tips; the dark-ish layer (#8fb8d8 → #1a2a4a, low opacity).
6. Snowflakes: a `PetalSwarm` (white-blue, small, low gravity) drifting down around the blade, a few per second.
7. Ice glitter: an additive emitter fed along the blade (size 0.008, quick twinkle, rate ~20).
8. Frost ring: a thin flat ring (built locally, or a squashed GlowSphere) under the pommel at y ≈ -0.22, breathing
   slowly.
9. Halo: a pale blue `GlowSphere` round the guard.

**Ignition:** frost creeps up the blade (the edge ribbons fade in bottom → top over 0.6 s), the lily snaps open,
and 20 snowflakes burst out.
