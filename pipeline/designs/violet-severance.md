# Violet Severance

- **Label:** `violet severance` · **File:** `src/spells/targeted/violetSeverance.ts` · **Module:** `violetSeveranceModule`
- **Targeting:** `enemy`
- **Recipes:**
  - `j-aguiar-layered-laser-beam` (main): ONE duration drives every layer; the beam LENGTH shoots out in the first
    10 % of the channel (pivot at the source), WIDTH shrinks to 0 over the last 10 %. Three copies of one shape: a
    dark wider under-beam drawn first, a bright scrolling streak core with an end-fade mask and UV distortion, and a
    blue electric copy with a higher alpha clip (eroded into tendrils) and more distortion. Stretched sparks
    streaming along the beam, repeated soft flashes at the source.
  - `j-cghow-outlined-stylized-bolt`: the dark under-beam doubles as a black outline so the beam reads on any
    background; pinch both ends with a sine mask.
  - `c-wow-channeled-beam`: three linked parts (hand / beam / impact) with a matching look.
- **Not abyssal gaze:** no eye, no lift, no helix ribbons, no overload. This one is about the *beam material*
  (scrolling, eroded, distorted shader layers) and a beam that cuts *through* the target and scorches a line on the
  ground behind it.

## Timeline (~4.2 s)
- 0.0–0.7 anticipation: at the caster's hand (chest height, 0.8 in front, facing the target): a small violet
  StarBurst flare grows, 3 thin CrescentArc-free glow rings (createRing, upright, facing the target) contract
  toward the hand, violet motes sucked inward (Emitter, negative radial speed). Ease-in hard (slow, slow, fast).
- 0.7 release: shake 0.3, a big source flash (GlowSphere), the beam LENGTH goes 0 → full in 0.3 s (10 % of the
  3 s channel). The beam ends 6 m BEYOND the target (it cuts through).
- 0.7–3.7 channel (duration 3 s, every layer reads `u = (t − 0.7) / 3`):
  1. **Dark under-beam** (ShaderMaterial, NormalBlending, drawn first via renderOrder): `#14040c` → `#2a0618`,
     width 1.5 × core, opacity 0.85, same end-fade + sine pinch.
  2. **Core beam** (custom ShaderMaterial, additive): a procedural seamless streak (stretched value noise along the
     length, 2–3 bright strands) scrolling toward the target at speed 2, × end-fade mask (0 → 1 → 0.6 → 0 along
     the length), × sine pinch across, UV distortion `uv += (noise(uv*k + t*3) − 0.5) * 0.15`, colour ramp
     white `#ffffff` centre → `#c070ff` → `#6a20c0` edge. Emissive kept ≤ 1 in sRGB, additive opacity ≤ 0.5 per
     layer (brightness rules). Width 0.45, pulsing ±10 % at 7 Hz.
  3. **Electric copy** (same shader, different uniforms): blue `#e0f0ff` → `#4a9aff`, alpha clip 0.55 (eroded
     tendrils), distortion 0.25, scroll 3.5, width 0.8.
  4. **LightningArc** × 2 crawling along the beam (thin, blue-white, rerolled every 0.08 s), offset ±0.2.
  5. **Stretched sparks**: Emitter at the source, 40/s, velocity along the beam 20–40, life 0.2–0.45, streak look,
     size big → small, `#fff0ff` → `#c070ff`.
  6. **Source flashes**: GlowSphere at the hand, re-triggered every 0.25 s, life 0.15 s, scale 2.5 → 5 big → small.
  7. **Impact at the target** (chest height): a StarBurst (6 points, violet) flickering, sparks spraying back
     toward the caster (Emitter cone), a small ground ring every hit.
  8. **Scorch line** on the ground from the target to the beam end: a thin dark-violet decal strip that grows with
     the beam and glows `#c070ff` at its edge, fading to dark `#1a0612` in the aftermath; small dark smoke puffs
     (normal blend) rising along it.
  - Hits: every 0.3 s from 0.8 to 3.5 → `ctx.hit(target, { damage: 7, knock: 0.4 })` (10 ticks); shake 0.08 per tick.
  - At 3.6 (u = 0.97): the cut — `ctx.hit(target, { damage: 45, knock: 7 })`, shake 0.5, `screen.impact` frame,
    flash at the target.
- 3.4–3.7 the WIDTH of every beam layer shrinks 1 → 0 (last 10 %), the length stays (the beam is spent, not pulled).
- 3.7–4.2 aftermath: violet embers drift from the scorch line, dark smoke rises, the source flare closes.

## Palette
Hot `#ffffff` → mid `#c070ff` → cool `#6a20c0`, electric `#4a9aff`, dark `#14040c`.

## Telegraphs
A line from the caster through the target to the beam end (width 1.4): start 0.05, impact 0.7, until 3.7.

## Exaggerate
The instant length snap with a big source flash; the beam cutting through and scorching the ground behind the
target; the three-copy material depth (dark / bright / eroded electric) — it must look layered from any angle.
