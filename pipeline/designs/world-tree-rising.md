# World Tree Rising (hero tier, fully cinematic)

- **Label:** `world tree rising` · **File:** `src/spells/targeted/worldTreeRising.ts` · **Module:** `worldTreeRisingModule`
- **Targeting:** `ground, radius 8`
- **Palette:** blossom white `#fff6e8` (tiny only) → leaf green `#5fbf5a` → bark brown `#4a3524` → amber fruit
  accent `#ffb43a` → root dark `#120d08`
- **The shape that makes it ours:** a colossal tree grows from a seed at the point in one continuous rise. The trunk
  twists up 25 tall (a tube along a twisting curve with a drawn bark texture), branches fork outward, the canopy
  unfolds as layered leaf clusters, and roots erupt from the floor to coil around the enemies. The canopy blooms with
  glowing amber fruit that ripen and drop, bursting on the enemies.

## Model
Bark: a drawn canvas texture (dark furrows, lighter ridges, moss patches). Trunk and branches: TubeGeometry along
CatmullRom curves grown by revealing segments (or a draw range) over time. Roots: tapered tubes that burst from the
ground with dirt chunks and coil (a helix) around each enemy. Canopy: clustered billboard leaf cards from a drawn
leaf-cluster texture, below the bloom threshold. Fruit: spheres with a drawn amber skin and a small glowing core.

## Distortion
`HeatHaze` as a life-shimmer around the trunk while it grows (0.01); each fruit burst gets a small ground
`ShockRefraction` (0.03); the final bloom pulse gets one wide ring (radius 2 → 16, 0.05).

## Timeline (~22 s)
1. **0–2.5 Seed.** Close: the caster drops a glowing seed; it sinks into the floor at the point; cracks spread.
2. **2.5–8 Growth.** Low wide: the sapling bursts up and grows into a giant trunk, twisting; branches fork out; cut
   to a crane shot rising along the trunk as it grows; cut to wide as the canopy unfolds.
3. **8–11 Roots.** Cut to ground level: roots tear out of the floor and coil around each enemy, lifting them slightly.
   `ctx.hit(e, { damage: 20, knock: 0 })` at 9.5.
4. **11–14 Bloom.** Cut to under the canopy looking up: the blossoms open in a wave (white petals, small), then amber
   fruit swell. Dead beat 0.4 s.
5. **14–17 Harvest.** Cut to a three-quarter view: fruit drop in a cascade onto the enemies and burst (amber toon
   bursts, juice droplets, small rings). Two hits per target at about 14.6 and 15.6:
   `ctx.hit(e, { damage: 35, knock: 4 })`; the roots release. Final bloom pulse at 16.4 with impact frames.
6. **17–22 Autumn.** Wide: the leaves turn amber and fall, the tree withers and sinks back into the floor; letterbox
   out; a ring of fallen petals remains.

## Telegraphs
A circle at the point, radius 8: start 2.5, impact 9.5.


## Camera (fully cinematic: every second is a placed shot)
`createCinematic`, keys built in `cast()` from the caster, the point and the targets. **Place every shot explicitly**
(no auto-fit on bounding boxes), clamp every camera to at most 24 from its look-at, keep every camera outside solid
props, and keep the subject in frame. Hard cuts plus slow moves inside shots, letterbox from 0.3 s, letterbox out
and `clearCinematic` at the end and in reset. At the payoff, frame the targets and the action, never the inside of a
prop.

## Craft rules
`docs/ART_BIBLE.md`, including the whole Do / don't table (its last rows are lessons from the hero batches: explicit
cameras, water vs ice, no glowing full tori, framing the payoff, distortion strengths). Drawn hard shapes on canvas
with dark outlines; materials below the bloom threshold; white only in tiny cores; short impact frames
`impactFrameAt(t, D, [1, 2], 0.04)`; small dark smoke; few damage ticks; no speed lines that read as lasers.
