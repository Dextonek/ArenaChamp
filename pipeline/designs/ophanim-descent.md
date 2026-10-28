# Ophanim Descent (hero tier, fully cinematic)

- **Label:** `ophanim descent` · **File:** `src/spells/targeted/ophanimDescent.ts` · **Module:** `ophanimDescentModule`
- **Targeting:** `ground`, radius 7 (`ctx.point` is the judgement point)
- **Palette (core → hot → body → accent → dark):** white `#ffffff` (tiny cores only) → halo gold `#ffd36a` → aged
  bronze `#8a6a34` → eye iris blue `#5ab8ff` → void `#07060c`
- **The shape that makes it ours:** a "biblically accurate" angel. Three interlocking giant bronze rings (gyroscope
  wheels within wheels), each covered with drawn eyes, descend through a split in the clouds. The rings spin on
  different axes. All the eyes open at once and look at the enemies; then every eye fires a thin light beam. Awe,
  not horror: gold, bronze and calm blue.
- **Craft rules:** `docs/ART_BIBLE.md`, especially the do/don't lines on glowing tori (the bronze rings must NOT
  glow; only the eyes' pupils and the beams may bloom).

## Model (drawn canvas textures)
- **Wheels:** three TorusGeometry rings (radius 6, 5 and 4; tube 0.45), MeshStandard aged bronze (metalness 0.75,
  roughness 0.45) with a canvas texture: engraved glyph bands and panel lines in dark grooves.
- **Eyes:** about 16 eyes per wheel, as camera-facing quads on the torus surface. Each is a drawn eye texture: an
  almond shape with a black outline, a pale sclera, a blue iris with a dark ring and a black pupil, and an eyelid
  that can close. Drive the lid (closed → open) with a texture offset or two textures crossfading. The pupils track
  the target (an offset inside the eye quad toward the target's screen direction).
- **Core:** a small white-gold flame at the centre (toon flame, tiny bright core).
- **Feathers:** 6 large wing shapes behind the wheels (drawn feather fans, ivory with gold edges, below the bloom
  threshold), unfolding late.
- **Clouds:** a ring of dark storm cloud sprites high above the arena that parts to open a circular hole with gold
  light rays (drawn tapered rays, low opacity).

## Distortion
- A camera-facing `ShockRefraction` lens around the core, with a soft pulse (strength 0.03) while the wheels spin.
- When the eyes fire: a ground `ShockRefraction` under each beam's impact (radius 0.5 → 3, strength 0.035), and one
  big expanding ring at the judgement (radius 1 → 16, strength 0.06 → 0).

## Camera (fully cinematic: every second is a placed shot)
Use `createCinematic`, keys built in `cast()`. **Place every shot explicitly** (no auto-fit), clamp every camera to at
most 26 from its look-at, and keep the subject in frame (the rings are big: the wide shots must contain all three).
Hard cuts plus slow moves, letterbox from 0.3 s, `clearCinematic` in reset and at the end.

## Timeline (~22 s)
1. **0–3 Omen.** Low wide from behind the caster, looking up. The sky darkens and the clouds gather over the point,
   then begin to part; gold rays break through the hole. A low hum (shake 0.05).
2. **3–8 Descent.** **Cut** to a very low shot near the enemies looking straight up: the wheels descend through the
   cloud hole, spinning slowly, eyes closed, and grow huge. **Cut** to a wide side shot: the wheels settle about 12
   above the point, all three spinning on different axes (wheels within wheels).
3. **8–11 The eyes open.** **Cut** to a close shot on one wheel: a row of eyes, the lids closed. Dead beat 0.5 s.
   Then all the eyes open at once (a 0.1 s snap, staggered by 0.02 s along the ring). **Cut** to wide: hundreds of
   blue eyes now open on the rings, all pupils snapping to the enemies. Shake 0.2, desaturate the world a little.
4. **11–13 Wings.** **Cut** to a slow orbit at mid-distance: six feathered wings unfold behind the wheels, and the
   wheels speed up.
5. **13–16 Judgement.** **Cut** to behind and above the wheels, looking down at the enemies. Every eye fires a thin
   beam (gold core, blue edge; 2 frames bright, then a 0.3 s fade) onto the targets and the ground around the point,
   in a fast cascade. Each beam leaves a small gold ground burn. Damage: each enemy within 7, three times at 13.4,
   14.2 and 15.0: `ctx.hit(e, { damage: 20, knock: 2 })`. **Cut** to ground level at 15.6: a final converged beam
   from all eyes into the point; impact frames, the big refraction ring, a gold toon shell.
   `ctx.hit(e, { damage: 70, knock: 10 })`. Shake 0.7.
6. **16–20 Ascension.** **Cut** to wide: the eyes close, the wings fold, and the wheels rise back up through the
   clouds, which close behind them.
7. **20–22 Calm.** Gameplay-like framing; letterbox out; gold motes drift down; burn marks stay on the ground in a
   ring pattern.

## Telegraphs
A circle at the point, radius 7: start 8, impact 13.4.

## Exaggerate
All the eyes opening at once, the scale of the wheels against the arena, and the cascade of beams.
