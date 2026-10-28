# Lunar Tide (hero tier, fully cinematic)

- **Label:** `lunar tide` · **File:** `src/spells/targeted/lunarTide.ts` · **Module:** `lunarTideModule`
- **Targeting:** `ground, radius 7`
- **Palette:** moon white `#f4f1e6` (tiny cores only) → silver `#b9c4d6` → tide blue `#2a6fa8` → pearl accent `#9fe6ff` → night `#04060d`
- **The shape that makes it ours:** the caster raises a hand and the **moon itself comes down**. A huge drawn moon
  (a cratered canvas texture with dark maria and a lit limb, MeshStandard, below the bloom threshold) rises over the
  horizon and swells until it fills half the sky. Its gravity pulls everything up: enemies float, rocks and water lift
  in rising sheets and droplet columns, and the arena floor ripples like a tide. Then a crack splits the moon and one
  shard falls onto the point.

## Distortion
A wide camera-facing lens around the moon's limb (strength 0.04); `HeatHaze` as tidal shimmer under the floating
enemies (0.012); the shard impact gets a big ground `ShockRefraction` (radius 1 → 14, 0.06 → 0).

## Timeline (~20 s)
1. **0–3 Call.** Close on the caster's raised hand against the night sky; cut to a wide over the arena: the horizon
   brightens silver.
2. **3–7 Moonrise.** Low wide: the moon rises fast and huge behind the enemies (radius ~40, about 120 away, sized to
   fill about half the frame), with the stage fog off. Slow push.
3. **7–11 Pull.** Cut among the enemies looking up: the enemies lift 2–4 off the ground (`ctx.displace`), rocks and
   water sheets rise around them, droplets stream upward; a tide ripple runs across the floor. Cut to a side shot of
   the floating enemies silhouetted against the moon. Ticks: `ctx.hit(e, { damage: 12, knock: 0 })` at 8.5 and 10.
4. **11–12 Crack.** Close on the moon: a black crack line draws across it (a drawn decal), light leaking from it;
   dead beat 0.5 s.
5. **12–15 Shard.** Cut: a moon shard (a jagged drawn rock with a glowing pearl edge) breaks off and falls with a
   trail; cut to ground level as it slams the point; impact frames, the big refraction ring, a silver toon shell,
   rocks and water crash down; the enemies drop. `ctx.hit(e, { damage: 80, knock: 9 })`. Shake 0.8.
6. **15–20 Set.** Wide: the moon sinks back below the horizon, the crack closing; pearl motes drift down; letterbox
   out; the shard stays planted, slowly dissolving.

## Telegraphs
A circle at the point, radius 7: start 3, impact 12.6.


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
