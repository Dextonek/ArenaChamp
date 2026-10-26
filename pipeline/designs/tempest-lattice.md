# Tempest Lattice

- **Label:** `tempest lattice` · **File:** `src/spells/targeted/tempestLattice.ts` · **Module:** `tempestLatticeModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Recipes (user reference video, John Kler):**
  - `d-kler-3-lightning-chain-cage`: the world grades dark blue first. The bolt hops caster → nearest → neighbours
    at ~0.15 s per hop, and each enemy flashes blue as it is reached. The lattice closes into a cage, and every
    edge crackles during the hold.
  - `d-kler-3-cage-detonation-impact-frame`: the lines pull inward over a tightening ground spiral, then 3 impact
    frames (black + blue silhouettes, cyan + black silhouettes, a blue-tinted frame), a spiky white-cyan star on
    every enemy, a white smoke ring with a dark blue disc, heavy shake, and black smoke balls that break into
    flakes.

## Timeline (~4.6 s)
- 0.0–0.35 anticipation: `screen.darken` → 0.85, tint `#1e2a5a`. A blue GlowSphere gathers around the caster.
  Black flecks spit off (a small dark Emitter).
- 0.35–(0.35 + 0.15·n) chain: one `LightningArc` per link (caster → t0, t0 → t1, ...), revealed in order, one hop
  per 0.15 s. When a link arrives: a small `StarBurst` pop (`additive: false`, cyan), a blue GlowSphere flash on
  the enemy, and `ctx.hit(e, { damage: 12, knock: 0.5 })`.
- Then the cage closes: one more link from the last target back to the first, so all targets form a loop. A thin
  white ring pulses once around the caster.
- Hold ~1.2 s: every link keeps crackling (LightningArc reroll every 0.04 s, dropChance 0.15). Sparks spit at
  random nodes every ~0.1 s. Small dark scorch discs (normal blend) sit under each node.
- Implode (0.35 s before detonation): a toon `CrescentArc` spiral (3 arcs, white/blue) at the target centroid
  contracts and spins. `screen.speedLines` → 1 with `focus` = the centroid at y 1.2. The links visually pull
  inward: lerp each arc's endpoints 25% toward the centroid.
- Detonation (time D): `screen.impact = impactFrameAt(t, D, [1, 2, 1])`, `impactColor` `#3aa8ff`, silhouettes =
  caster + targets. On frame D + 0.15: a big crisp `StarBurst` on every target (12 points, `additive: false`,
  `#bff4ff` / white core), `ctx.hit(e, { damage: 45, knock: 8, from: centroid })`, shake 0.9. A white smoke torus:
  a thick createRing at the centroid expanding 0 → 14 over 0.5 s, plus a dark blue disc under it (normal blend).
  The arcs vanish.
- D + 0.3: `SmokeBall.trigger` on each target (size 1.5). Black flakes blow away. Darken releases over 0.8 s. The
  frame is clean by ~D + 1.4.

## Palette
White `#ffffff` → `#8ac8ff` → `#5a6cff`, violet accent `#b46cff`, dark `#141a24`.

## Telegraphs
One circle (radius 1.6) per target: start 0.1, impact = the time the chain reaches it. Plus one circle at the
centroid (radius = max target distance from the centroid + 1.5): start = the time the cage closes, impact = D.

## Exaggerate
The ordered hop rhythm, the darkened world, the 3-step impact frames, and the black smoke clear-out.
