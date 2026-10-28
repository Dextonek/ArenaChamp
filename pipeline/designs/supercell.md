# Supercell (hero tier, fully cinematic)

- **Label:** `supercell` · **File:** `src/spells/targeted/supercell.ts` · **Module:** `supercellModule`
- **Targeting:** `ground, radius 8`
- **Palette:** lightning white `#f4f6ff` (bolt cores only) → storm violet `#8a7cff` → cloud slate `#4a5266` →
  hail cyan accent `#bfefff` → storm dark `#07080c`
- **The shape that makes it ours:** a rotating supercell forms over the arena: a huge anvil cloud with a rotating
  wall cloud under it (drawn toon cloud layers with dark undersides). A funnel lowers and touches down as a tornado
  at the point, a twisting tube of dust and debris that sucks the enemies up and spins them, with lightning
  crawling through the clouds. It ends in a huge cloud-to-ground strike and hail.

## Model
Cloud: stacked toon cloud billboards with a dark underside gradient and a lighter rim, rotating slowly. Funnel: a
twisting, tapered tube with a scrolling streak texture (grey-brown, semi-transparent, darker edges), plus orbiting
debris (planks, rocks, small drawn shards) and a dust skirt at the base. Lightning: the `LightningArc` part.

## Distortion
`HeatHaze` along the funnel as air turbulence (0.015); a camera-facing `ShockRefraction` on the final strike
(radius 1 → 16, 0.07) and smaller ones for the hail.

## Timeline (~20 s)
1. **0–3 Darkening.** Wide, low: the sky turns slate and the wind picks up dust; the cloud base rolls in overhead.
2. **3–7 Rotation.** Cut to looking up under the wall cloud: it rotates, with lightning crawling inside; cut to a wide
   shot of the anvil with flashes.
3. **7–9 Touchdown.** Cut to the side: the funnel lowers and touches down at the point; the dust skirt explodes out.
4. **9–13 Vortex.** Cut to ground level near the enemies: they are pulled in and lifted, spinning with the debris.
   Cut to a high orbit around the funnel. Ticks: `ctx.hit(e, { damage: 15, knock: 0 })` at 10, 11 and 12.
5. **13–14 Hold.** The funnel thins; everything hangs; dead beat 0.5 s.
6. **14–16 Strike.** Cut wide: a massive bolt down the funnel's core to the point; impact frames, refraction, a toon
   blast; the enemies are flung outward. `ctx.hit(e, { damage: 75, knock: 11 })`. Hail rains down for 1.5 s.
7. **16–20 Clearing.** The funnel ropes out and lifts, the clouds break, letterbox out.

## Telegraphs
A circle at the point, radius 8: start 3, impact 9.


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
