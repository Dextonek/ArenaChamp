# Abyssal Gaze

- **Label:** `abyssal gaze` · **File:** `src/spells/targeted/abyssalGaze.ts` · **Module:** `abyssalGazeModule`
- **Targeting:** `enemy`
- **Recipes:**
  - `c-wow-channeled-beam`: three linked parts (hand, beam, impact) with a matching look. A dark wide ribbon under a
    bright narrow core, with thin ribbons orbiting the beam, and the width pulsing at ~6 Hz.
  - `a-dota-lina-laguna-blade`: a jagged arc rerolled at 20 Hz around a straight core so the beam never goes thin, with forked
    branches.
  - `c-gnomon-charged-energy-beam`: the charge ramps up (the beam starts thin and grows) and ends in a final overload burst.

## Timeline (~5.2 s)
- 0.0–0.9 anticipation: a violet void eye opens in front of the caster at chest height (a dark violet soft
  GlowSphere core plus a bright rim GlowSphere, and a vertical slit made from a scaled ring). Dark wisps are sucked
  inward. A rune ring stands upright behind the eye and faces the target.
- 0.9 release: the beam snaps to the target in 0.06 s.
- 0.9–3.6 channel: the beam is camera-facing quads from the eye to the target's chest, recomputed each frame:
  - a dark wide ribbon (normal blend, `#1a0830`, opacity 0.5);
  - a bright core (additive, `#f4e8ff`), width pulsing at 6 Hz, growing from 0.15 to 0.6 over the channel;
  - 2 helix ribbons orbiting the beam (additive violet);
  - 3 jagged arcs around the core, rerolled every 3 frames, with branches;
  - wisps streaming along the beam toward the target.
  - Target end: an impact sprite that mirrors the eye (the same GlowSphere look), sparks spraying back, a small
    ground ring, the target lifted with `ctx.displace(target, (0, 0.6·k, 0))` ramping up.
  - Ticks: every 0.3 s, `ctx.hit(target, { damage: 8 + tick, knock: 0.6 })`, with shake 0.06 → 0.2 ramping.
- 3.6 overload: the beam swells ×3 for 0.15 s and detonates at the target: a flash, a burst shell, 2 rings, a dark
  void implosion sphere (it shrinks and then pops), 700 violet sparks, dark smoke. `ctx.hit(target, { damage: 60,
  knock: 9 })`, shake 0.7. The displace drops back to 0 with a little bounce.
- Aftermath to 5.2: the beam retracts toward the eye in 0.2 s, the eye closes, violet embers and dark wisps linger.

## Palette
Hot `#f4e8ff` → mid `#a05aff` → cool `#3a0a7a`, dark `#14061f`, with cyan accent sparks `#8fe8ff`.

## Telegraphs
A line from the caster to the target, width 1.6: start 0.1, impact 0.9, until 3.6. Plus a circle at the target
(radius 3): start 2.6, impact 3.6.

## Exaggerate
The ramping beam width and shake, the lift of the target during the channel, and the overload detonation.
