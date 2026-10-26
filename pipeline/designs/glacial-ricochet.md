# Glacial Ricochet

- **Label:** `glacial ricochet` · **File:** `src/spells/targeted/glacialRicochet.ts` · **Module:** `glacialRicochetModule`
- **Targeting:** `enemies`, `maxTargets: 7`
- **Recipes:**
  - `a-dota-lich-chain-frost`: a spiky, spinning ice orb hops target to target with the same strong beat at each hit, and each hop is a little faster.
  - `c-flipbook-lightning-bolt-spell`: a frost-lightning tether flickers between the current and next target for a few frames before each hop. Fragments fade before the trunk.
  - `c-ice-spikes-eruption`: an ice-spike crown erupts under each struck enemy.

## Timeline (~4.6 s for 7 targets; fewer targets = shorter)
- 0.0–0.8 anticipation: cold mist (dark blue-grey, normal blend) swirls around the caster. A hexagonal frost rune
  under the caster spins. A frost orb grows above the caster's hands (GlowSphere + a spiky icosahedron mesh that
  spins 4 rev/s). Inward snow motes.
- 0.8 release: the orb launches with a muzzle flash.
- Hops: the first hop takes 0.42 s, each later one ×0.85, minimum 0.2 s. Each hop is a slight arc (peak 1.5 + 0.15·distance) with a
  comet trail (burst the trail emitter every frame).
  - Telegraph flicker: 0.12 s before each arrival, a jagged frost-lightning arc (8–12 segments, rerolled every 2
    frames) from the orb to the next target.
  - At each arrival: `ctx.hit(target, { damage: 22 + 6·hopIndex, knock: 3 })` (the last hit is ≥ 40 so it shows
    gold), a ring shockwave, 6–8 ice spikes erupting from the ground in a crown (instanced cones that shoot up in
    0.08 s, hold 0.5 s, then sink and fade), 14 ice shards (instanced, gravity), a spark burst, camera shake 0.18
    (the last hop 0.5). The orb grows ×1.12 per hop.
- Last target: the orb shatters in a big flash, a burst shell, a double ring, 40 shards and frost wisps.
- Aftermath 1.4 s: frost wisps rise and snow drifts down. The spike crowns sink one after another (the older ones
  first).

## Layers (hot → mid → cool: `#ffffff → #8fd8ff → #1a5ac0`)
1. Mist around the caster: normal Emitter `#6a7f9a → #1c2430`, erosion 0.6.
2. Frost rune ring (createRing, 6 segments) under the caster.
3. Orb core: spinning icosahedron (MeshStandard, emissive cyan ≤ 1) + GlowSphere halo.
4. Comet trail: additive Emitter, sizeJitter 0.4, erosion 0.5, drag 2.
5. Frost-lightning tether: custom line segments or thin quads, additive, rerolled.
6. Hit ring shockwave per target (a small pool of createRing).
7. Ice-spike crowns: one InstancedMesh of ConeGeometry, pale cyan, emissive cyan pulse on spawn.
8. Shards: InstancedMesh of tetrahedra, gravity 20.
9. Sparks: additive, speed 9, drag 1.
10. Aftermath frost wisps (additive, rising) + dark mist (normal).

## Telegraphs
One circle (radius 1.8) per target, all starting at 0.1. Each one's `impact` is that hop's arrival time.

## Exaggerate
The accelerating rhythm (the hops get faster, the hits get bigger), the ice-spike crowns, and the final shatter.
