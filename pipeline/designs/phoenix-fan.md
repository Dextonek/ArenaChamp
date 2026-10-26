# Phoenix Fan (weapon aura, reference)

- **Label:** `phoenix fan` · **File:** `src/spells/weapons/phoenixFan.ts` · **Module:** `phoenixFanModule`
- **Mode:** idle loop on `wp-fan-fire`, category `weapons`, period 4 s, ignition 0.9 s.
- **Recipes:** `f-spiderlily-fan-tufts` (a radial fan of flame tongues that follows the fan's own ribs, dark puffs
  off the top), `f-spiderlily-gauntlet-ignition` (a gold filament bloom with a white-gold core and lens streak,
  petal flecks scattering).

## Layers
1. Model darkened to a plum (`darken` 0.08, tint #2a1030), with a pink fresnel rim breathing once per loop.
2. Flame fringe: 31 `FlowRibbon` tongues (5 per leaf tip, 1 per rib tip) rooted inside the leaves at z +0.014,
   growing out over 0.25–0.75 s; colours #ffb070 → #ff506a → #7a2070; noise streaked along the length.
3. `LilyBurst` on the pivot gem (blooms open over 0.35 s, sways ±0.25 rad).
4. `StarFlare` on the pivot: white-gold, streak ×5, a pop at 0.28 s.
5. Rib-tip glints: 6 small `StarFlare`s twinkling in a wave from left to right once per loop.
6. Halo: a soft pink `GlowSphere` behind the pivot.
7. Embers rising off the leaf rim (an additive emitter fed along the rim).
8. Dark puffs off the top (a normal-blended eroded emitter): the dark layer.
9. Petals: a 28-petal burst at ignition, then one every 0.35 s off the rim.
