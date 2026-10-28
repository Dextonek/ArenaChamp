# Thousand-Cut Iaido (hero tier, fully cinematic)

- **Label:** `thousand-cut iaido` · **File:** `src/spells/targeted/thousandCutIaido.ts` · **Module:** `thousandCutIaidoModule`
- **Targeting:** `enemies, maxTargets 8`
- **Palette:** blade white `#ffffff` (thin lines only) → steel `#c9d2dc` → cut red `#d81e2a` → gold tsuba accent
  `#d9a441` → ink black `#050505`; the world goes grey during time-stop.
- **The shape that makes it ours:** a samurai duel cut. The caster draws a katana (a drawn model: a curved blade,
  a gold tsuba, a wrapped hilt; it appears in the caster's hand and is the caster's prop) and **time stops**: the
  world desaturates to grey, dust hangs in the air. The caster dashes between the enemies in straight lines, leaving
  dark afterimage silhouettes; then a close-up of the blade sliding back into the scabbard with a click. Only then do
  the cuts appear: thin red-and-white slash lines across every enemy, all at once, and the colour floods back.

## Notes
Do not move the arena caster's real group permanently: animate a separate stand-in (a dark ghost copy or the
afterimages) for the dash and put the caster back where it was. Afterimages are flat dark silhouettes of the caster
figure (clone its meshes with a black unlit material at 0.6 opacity).

## Distortion
A camera-facing `ShockRefraction` at each dash segment start (0.03); at the release, one thin `ShockRefraction`
ring per enemy (radius 0.3 → 3, 0.04).

## Timeline (~16 s)
1. **0–3 Stance.** Low side shot: the caster crouches, a hand on the hilt; wind lifts dust; cut to an extreme
   close-up of the eye area of the caster and the blade edge sliding out a hand's width (a glint).
2. **3–4 Time stops.** Wide: everything freezes, the world drains to grey (ScreenFx desaturate ~0.85), dust
   particles hang still, a single heartbeat ripple (a faint ground ring).
3. **4–8 The dash.** A series of fast cuts (0.5–0.8 s each): the stand-in dashes from enemy to enemy along straight
   lines (one segment per target, in chain order), leaving afterimage silhouettes at every stop and a thin white
   line in the air along the path. Cameras: low behind an enemy, high top-down, side-on tracking.
4. **8–10 Sheath.** Back at the start: extreme close-up of the blade sliding into the scabbard; the tsuba meets the
   mouth: "click" (a tiny white star, shake 0.15). Dead beat 0.4 s.
5. **10–12 Release.** Wide over the enemies: all the slash lines appear at once (drawn red-white crescents across each
   enemy, 2–3 per enemy), the colour floods back, impact frames, the afterimages shatter into black shards, the
   ground rings fire. `ctx.hit(e, { damage: 90, knock: 6 })` for every target. Red petals and ink droplets spray.
6. **12–16 Aftermath.** Slow push past the caster standing still, back turned, as the enemies reel; letterbox out.

## Telegraphs
A small circle (radius 1.5) at each target: start 3, impact 10.


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
