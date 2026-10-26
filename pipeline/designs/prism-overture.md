# Prism Overture

- **Label:** `prism overture` · **File:** `src/spells/targeted/prismOverture.ts` · **Module:** `prismOvertureModule`
- **Targeting:** `ground`, `radius: 5` (the burst happens at `ctx.point`)
- **Recipes (YouTube, Plebarae "Chromatic Opus"; frame log `pipeline/frame-logs/youtube-i/V-zNBHnx1kY.md`):**
  - `i-chromatic-ink-charge-prism-burst`: a soft orb shrinks to a speck, a thin black-and-white smoky ink tendril
    rises and two white hook strands knot while pink/teal fringes appear at the screen edges. A fluffy white
    star-puff and a white disc with a rainbow rim bloom with prism chips, collapse to grey haze, then ONE frame
    darker than normal, then a white blowout with RGB-split fringes, a tunnel of white shards and black slivers, a
    thin-outline glass bubble with prism flakes, a flat white flare and spike crown, then a forest of tall white
    wisps swaying, iridescent ribbons, and curling white ring trails.
  - `i-chromatic-comet-ring-stack` (optional finale): three stacked rings rise and collapse.
  - Rules: VFX_PRINCIPLES §12 (anti-flash; chromatic aberration as the only colour; collapse the flash onto the
    ground).
- **Screen parts:** `flashBeat` (anti-flash → whiteout), `chroma` + `edgeTint` (pink `#ff5ab4` / teal `#4ff0e0`
  alternating), `darken`, `speedLines`.

## Timeline (~4.2 s)
The palette is monochrome: black, greys, white. The only hue comes from chroma fringes and thin prism/rainbow
accents.
- 0.0–0.5: a small soft white orb at the caster's chest shrinks to a speck. `darken` → 0.5 (tint `#303034`).
- 0.4–1.4 ink charge at `ctx.point`: a thin rising tendril of black smoke with white edges (a normal-blended dark
  emitter stream + white soft `CrescentArc` hooks on vertical planes) climbs ~3 m. Two white hook strands curl
  and knot at the top. `chroma` ramps 0 → 0.35 with `edgeTint` pink, flicking to teal every 0.2 s.
- 1.45: a fluffy white star-puff (a white `StarBurst`, 8 points, inner 0.5, `additive: false`, size 1.4) above the
  point, and a flat white disc with a rainbow rim (createRing plus a thin rainbow ring: several thin rings in
  red/yellow/teal/violet at slightly different radii) on the ground. Prism chips: a few small 4-point StarBursts
  in pastel colours.
- 1.6: collapse to grey haze (a normal-blended grey emitter puff, everything shrinks).
- 1.68 anti-flash then blowout: `Object.assign(screen, flashBeat(t, 1.7, 0.05, 0.35))` (one frame darker, then
  white). `chroma = chromaPulse(t, 1.7, 1, 6)`. `speedLines` 1 for 0.12 s, white, focus on the point. Shake 0.8.
  `ctx.hit(e, { damage: 50, knock: 7, from: point })` for each target.
- 1.75–2.2 after the white: a tunnel of white shards and black slivers flying out (two emitters: white additive
  streaks and normal-blended black slivers, high speed, high drag). A thin-outline glass bubble: a GlowSphere with
  rim (low opacity) plus 2 thin rings, with prism flakes inside. It grows and pops at 2.1 with a small chroma pulse
  (0.4). A flat white flare (a squashed white StarBurst, scale x4 y0.3) and a crown of vertical white spikes
  (instanced thin cones, ≥ 1e-4 scale) around the point.
- 2.2–3.4 aftermath: a forest of 14 tall thin white wisps (vertical soft `CrescentArc`s with a small sweep, or
  tall thin additive quads) rising from a ring, swaying ~0.8 s; 2 iridescent ribbons (soft CrescentArcs with
  edge `#ff9ad8`, mid `#9af0ff`) wrapping them. Green flecks (a tiny emitter, `#7aff9a`).
- 3.4–4.2: curling white ring trails and grey dust, then clean. Everything returns to normal values.

## Telegraphs
Circle at the point (radius 5): start 0.4, impact 1.7.

## Exaggerate
The single anti-flash frame before the blowout, the monochrome look with only chroma fringes as colour, and the
wisp forest.
