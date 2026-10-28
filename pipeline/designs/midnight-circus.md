# Midnight Circus (hero tier, fully cinematic)

- **Label:** `midnight circus` · **File:** `src/spells/targeted/midnightCircus.ts` · **Module:** `midnightCircusModule`
- **Targeting:** `enemies, maxTargets 6`
- **Palette:** spotlight cream `#fff1c9` (tiny cores only) → circus red `#c8233a` → tent stripe cream `#e8d8b0`
  (as a material, below the bloom threshold) → gold trim accent `#d9a441` → velvet dark `#0b0610`
- **The shape that makes it ours:** a sinister midnight circus. A striped big-top tent erupts from the floor around
  the enemies, the lights go down, a spotlight picks out each enemy in turn, a drumroll builds, and then a giant
  jack-in-the-box springs up from the centre ring: a grinning harlequin head on a coiled spring that lunges at each
  enemy. It ends in a burst of confetti and a curtain fall.

## Model
Tent: a conical big top (a lathe) with drawn red-and-cream stripes, scalloped gold-trimmed edges, and a pennant on
top; it rises around the enemies (enemies inside, camera partly inside for some shots, but never inside a wall).
Box: a drawn gift-box with a crank handle. Jack: a harlequin head (a drawn face texture on a sphere: a white face, a
black diamond eye, a wide red grin, a jester hat with bells) on a coiled spring (a TubeGeometry helix). Spotlights:
cone meshes with low-opacity cream and a hard ellipse on the floor.

## Distortion
A camera-facing `ShockRefraction` on each lunge (0.04); a wide ring on the final burst (0.05).

## Timeline (~20 s)
1. **0–3 Calliope.** The caster snaps fingers; cut to the floor at the enemies: the ground ripples, striped tent
   panels burst up around them.
2. **3–6 Big top.** Wide: the tent completes, the pennant unfurls, the lights go down to velvet dark.
3. **6–10 Spotlights.** Cut inside: spotlights sweep and then lock on each enemy in turn (one hard ellipse each),
   drumroll shake rising (0.05 → 0.2).
4. **10–11 Hush.** Dead beat: total silence and darkness except the spotlights; the jack-in-the-box crank turns once.
5. **11–15 Jack.** The lid bursts open and the jack springs up on its coil, the head swaying; cut to a close-up of
   the grin; then a lunge at each enemy in turn (0.5 s each), each lunge a hit: `ctx.hit(e, { damage: 40, knock: 6 })`.
6. **15–17 Finale.** Wide: the jack spins, the tent bursts open, confetti cannons (red, cream, gold), impact frames;
   a final `ctx.hit(e, { damage: 30, knock: 8 })` for every target.
7. **17–20 Curtain.** A red curtain falls across the frame (a drawn velvet curtain plane lowered in front of the
   camera), then lifts on the empty arena with confetti settling; letterbox out.

## Telegraphs
A circle (radius 2) at each target: start 3, impact 11.5.


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
