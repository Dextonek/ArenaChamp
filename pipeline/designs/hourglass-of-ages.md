# Hourglass of Ages (hero tier, fully cinematic)

- **Label:** `hourglass of ages` · **File:** `src/spells/targeted/hourglassOfAges.ts` · **Module:** `hourglassOfAgesModule`
- **Targeting:** `ground, radius 6`
- **Palette:** sand gold `#f2c66d` → brass `#b3863a` → glass teal tint `#9fd9d0` (low opacity) → time violet accent
  `#9a7bff` → dark `#0a0806`
- **The shape that makes it ours:** a giant brass-framed hourglass descends over the enemies and lands, trapping them
  in the lower bulb. Sand pours from the top bulb and fills around them while clock gears turn on the frame. Then the
  caster reverses time: the sand streams back up, the enemies age-flicker (their colour flashes grey and back), and
  the glass shatters outward in big sharp drawn shards.

## Model
Frame: two brass discs and four turned brass pillars (a LatheGeometry profile), with a drawn engraving texture.
Glass: two LatheGeometry bulbs, translucent with a faint teal tint and a fresnel-like rim (a thin bright edge, not a
glow). Sand: a falling stream (a thin cylinder with a scrolling grain texture) plus a rising cone of sand (a lathe
whose height grows) and grain particles. Gears: drawn gear textures on discs on the frame that rotate.

## Distortion
A camera-facing `ShockRefraction` lens inside the glass (0.02) while it's trapped; on the shatter a wide ring
(radius 1 → 14, 0.06).

## Timeline (~18 s)
1. **0–3 Toll.** The caster raises a hand; a deep clock chime: a violet ring pulses out; cut to the sky above the
   enemies, where a giant hourglass materialises from gold dust.
2. **3–6 Descent.** Cut to low wide: the hourglass descends and lands over the enemies with a ground slam (dust, a
   ring, shake 0.4). `ctx.hit(e, { damage: 10, knock: 0 })` at 5.2.
3. **6–10 Fill.** Cut to the glass at eye level: the sand stream pours and rises around the enemies' feet and up to
   their waists; the gears turn on the frame; a slow orbit.
4. **10–11 Reverse.** Close on the caster's hand turning; a violet flash; dead beat 0.4 s.
5. **11–14 Rewind.** Wide: the sand streams back UP into the top bulb, the gears spin backwards, the enemies flicker
   grey (aging) three times. Ticks: `ctx.hit(e, { damage: 15, knock: 0 })` at 11.6, 12.4 and 13.2.
6. **14–15 Shatter.** Cut to a low three-quarter view: the glass shatters outward in big sharp shards, sand bursts,
   impact frames, the refraction ring. `ctx.hit(e, { damage: 65, knock: 9 })`.
7. **15–18 Settle.** Shards and sand fall and fade, the frame dissolves into gold dust; letterbox out.

## Telegraphs
A circle at the point, radius 6: start 2, impact 5.2.


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
