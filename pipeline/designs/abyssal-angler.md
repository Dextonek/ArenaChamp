# Abyssal Angler (hero tier, fully cinematic)

- **Label:** `abyssal angler` · **File:** `src/spells/targeted/abyssalAngler.ts` · **Module:** `abyssalAnglerModule`
- **Targeting:** `ground, radius 6`
- **Palette:** lure cyan `#bffcff` (tiny core only) → bio blue `#3fd0ff` → abyss teal `#0f3a4a` → bone accent
  `#d8d0b8` → abyss black `#010406`
- **The shape that makes it ours:** the arena **sinks into the deep sea**. Darkness floods in from the edges, light
  dies, bioluminescent motes drift, and silt hangs in the water. A single glowing lure appears in the dark and
  sways, and the enemies drift toward it, hypnotised. Then the giant anglerfish behind it is revealed for one frame
  by a flash, and its maw (huge needle teeth) erupts from the darkness and snaps shut on them.

## Model
Anglerfish head: built from shapes. A huge lower jaw (a wide extruded profile), rows of long, thin, curved
translucent teeth (bone white, dark tips), tiny pale eyes, a ragged dark skin texture (a drawn canvas texture with
pores and scars), and the illicium rod with the lure bulb (the only bright thing). Only the lure and the motes may
bloom.

## Distortion
`HeatHaze` everywhere as underwater refraction (a big wide quad in front of the camera at 0.008 for the whole
underwater part); a camera-facing `ShockRefraction` when the jaw snaps (radius 1 → 10, 0.06).

## Timeline (~18 s)
1. **0–3 Descent.** Wide: the light dims, a blue-black grade sweeps over the scene from the edges (ScreenFx darken
   0.7 with a teal tint), rising bubbles and silt motes; the fog comes in close.
2. **3–7 Lure.** Cut to a low shot: a pinpoint of cyan light appears beyond the enemies and sways on its rod; slow
   push in. Cut to the enemies: they turn and drift toward it (`ctx.displace`, slow), bubbles rising off them.
3. **7–8 Reveal.** A one-frame flash lights the whole anglerfish behind the lure (a huge silhouette of the head and
   teeth), then darkness again. Dead beat 0.6 s.
4. **8–10 Strike.** Cut to the side: the maw erupts out of the dark, jaw wide open around the enemies; impact frames
   as it snaps shut; a refraction ring, silt and bubble burst, shake 0.8. `ctx.hit(e, { damage: 95, knock: 3 })`.
5. **10–14 Retreat.** Cut to wide: the fish sinks back into the darkness, the lure going out last.
6. **14–18 Surface.** The darkness drains away, light returns, the enemies drop back to the floor; letterbox out.

## Telegraphs
A circle at the point, radius 6: start 3, impact 8.6.


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
