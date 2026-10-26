# Thunder Drum Hammer (weapon aura)

- **Label:** `thunder drum hammer` · **File:** `src/spells/weapons/thunderDrumHammer.ts` · **Module:** `thunderDrumHammerModule`
- **Mode:** idle loop on `wp-hammer-thunder`, category `weapons`, period 3 s (a faster, nervier rhythm), ignition 0.7 s.
- **Recipes:** `d-kler-3-lightning-chain-cage` (crackling arcs locked between fixed points, redrawn every few
  frames), `f-moa-arm-lightning-lash` (bolts wrapping a limb; here they crawl down the haft),
  `d-wolf-4-pink-plasma-slash-orb` (a looping orb with curly arcs and four-point sparkles; a warm/cool split).
- **Palette:** white #ffffff → violet-white #dccfff → violet #9a6aff → deep #2a1050; warm bronze-gold accent
  #ffd080 on the taiji. Model tint a dark violet-iron (#141020), rim #b49aff.

## Layers (sockets from `SOCKETS['wp-hammer-thunder']`)
1. Model: `darken` 0.15, tint #141020, rim #b49aff.
2. **Lightning (hero):** 4–6 `LightningArc`s (from `src/effects/parts`) jumping between random points on the drum
   surfaces (studs at x = `studRingX`, radius `drumRadius` round the head axis at `headY`), from the spike top to a
   drum, and from the beast mouth outward. Re-randomise each arc's endpoints every 3–5 frames, with on/off flicker;
   each arc is visible ~40% of the time. One arc crawls down the haft (y 0.3 → -0.3) once per loop.
3. Taiji: a `StarFlare` on `taijiFront` (white with a gold streak ×4), pulsing, with a slowly oscillating
   `LilyBurst` (`curl: 0.4`, violet-white) behind it as the medallion's charge.
4. Beast eyes: two tiny violet `StarFlare`s on `beastEyes`, flaring together once per loop.
5. White qi spiral: a `FlowRibbon` (`cross: true`, width 0.025) winding up the haft (2 turns), white → violet.
6. Sparks: an additive emitter bursting 3–6 tiny sparks wherever an arc lands (fast, drag 3, short life).
7. Storm haze (dark layer): a slow, low-opacity, normal-blended dark violet-grey eroded emitter round the head.
8. Halo: a violet `GlowSphere` round the head, pulsing with the arcs.
9. Bell glint: a small `StarFlare` on `bell`, twinkling once per loop.

**Ignition:** a 2-frame bright pop on the taiji, all arcs fire at once for 0.15 s, and the haft spiral fades in.
