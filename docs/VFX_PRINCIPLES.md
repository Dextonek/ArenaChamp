# VFX principles (applied checklist)

Distilled from realtime-VFX practice (shape / timing / colour, the realtime VFX dictionary, readability talks)
into rules for this project. Every effect should pass this list.

## 1. Read it as Shape → Timing → Colour
- **Shape:** one clear silhouette and direction per beat. You should be able to tell what happens with colour off.
- **Value before colour:** if the effect reads in greyscale it reads in any colour. Keep a value ladder:
  white-hot core (small) → saturated body → dark/desaturated edge or smoke.
- **Restraint:** the cheapest and cleanest layer is the one you don't add. Overdraw (many big additive layers)
  is what blows effects out to white here.

## 2. Timing
- **Anticipation sells the hit** (rule of thumb: ~80% of the impact is felt before contact). Every spell gets a
  gather / charge / wind-up beat: particles pulled in, a growing glow, a pose.
- **Slow-in, fast-out:** ease into the charge, release fast. Falls and throws accelerate.
- **Impact moment:** 1–3 frames of something sharp — flash, impact-frame post effect (raise `shake`), hit-stop.
- **Follow-through and dissipation:** don't end on a fade of everything at once. Let layers decay at different
  rates: flash (0.1 s) → shock ring (0.5 s) → sparks (1 s) → smoke/embers (2–3 s) → ground mark (longest).

## 3. Layer stack (aim for 5–7 layers, each with a job)
| Layer | Job | Typical build |
|---|---|---|
| Anticipation | tells the player what's coming | inward Points, growing `GlowSphere` (`rim:false`), rune `createRing` |
| Core | brightest, smallest, highest value | small `GlowSphere` / emissive mesh |
| Body | the main shape and colour | mesh, beam, ribbon, emitter with `colorMid` |
| Secondary | energy and detail | sparks (`erosion 0`), glints, arcs, particles that spawn particles |
| Tertiary | depth and contrast | **normal-blended dark** smoke/dust with `erosion` behind the bright additive layers |
| Ground | anchors it in the world | scorch / rune decal, dust ring, `groundFade`, point light on the ground |
| Light & camera | sells the force | `PointLight` spike, `shake` (also drives the impact-frame post pass) |

## 4. Depth
- Mix **additive (bright)** and **normal-blended (dark)** layers: dark smoke behind fire gives contrast and depth;
  all-additive effects look flat and wash out.
- Use **size variance** (`sizeJitter`) and several particle scales (big soft + small sharp) so clouds have depth.
- **Erosion** instead of uniform fading — particles break into wisps as they age.
- **Soft ground contact** (`groundFade`) for anything that touches the floor.
- Put something in the foreground/background of the action (debris flying toward camera, mist behind).

## 5. Readability per phase
Cast → travel → hit → resolve must each be readable on its own: a clear cast, a readable travel path, a strong
hit moment, a clean resolution (no leftover clutter in the frame after ~2 s).

## 6. Pro polish (from the recipe library research, `pipeline/library/`)
- **Stagger layers by 2–3 frames, each with its own lifetime.** Flash 2–3 frames, sparks end just after the ring,
  smoke starts early and outlives everything. Everything at t = 0 reads as one sprite.
- **Dark behind, bright in front.** A normal-blended dark core/smoke under the additive layers gives contrast.
  Check the effect in greyscale; it must still read.
- **Drag makes particles brake.** High-drag bursts decelerate hard, hang and fade before stopping: heavy gas.
  Linear drift reads floaty.
- **One noise for distortion and dissolve; size-over-life small → large → small**, randomise lifetime, size and
  rotation per particle.
- **Fade parts at different times.** Small fragments first, the main body a few frames later; flicker lightning
  by dropping frames. Uniform fades and beats look robotic.
- **Linger the readability.** Keep the telegraph a beat longer than feels necessary, leave a cooling scorch/crack,
  and sell the hit with a 2–3 frame over-bright pulse.
- **Channels match at both ends.** The hand effect and the target impact share a look, so caster and target
  feel linked.

## 7. Stylised "Roblox / anime" look (from the user's reference videos, `pipeline/library/batch-d.json`)
- **Impact frames on finishers.** Stop time for 0.1–0.2 s at the big hit with 2–3 fully opaque full-screen value
  inversions (black + white silhouettes / focus lines, then the inverse), 2–3 frames each, then heavy shake on the
  first normal frame.
- **Implode before you explode.** 0.2–0.4 s of visible contraction toward the impact point (shrink to a point,
  lines pulled in over a tightening ground spiral) right before the release.
- **Darken the world first.** Big spells dim and tint the scene for their duration, so additive layers glow
  without blowing out. Restore it at the end.
- **Black is a colour.** Every effect has at least one solid, normal-blended black or near-black shape on or in
  front of its brightest layer: black cores, spike shards, slash strokes, smoke balls.
- **Hard edges over soft glow.** Main shapes are hard-alpha spiky stars, stretched diamond shards, crescent
  slashes, crisp thin rings and brush strokes. Soft glow is only a thin, small halo.
- **Anime graphic vocabulary.** 1–2 flat 2D elements per effect: radial focus/speed lines, four-point star glints,
  hollow circle pops, crescents.
- **One hue + complementary accent + white core + black.** White only for the hottest ~5%. Push fire toward
  pink/magenta in a purple scene.
- **Scale jumps.** The key beat is 3–5× bigger than its cause and briefly fills most of the screen.
- **Readable order on many targets.** Hit them in a clear spatial order (front → sides → back, ~0.15 s apart),
  then pay it off with one simultaneous hit.
- **Sustain with flicker, not more light.** Holds stay alive through arcs redrawn every 2–3 frames and small spark
  spits. Total brightness stays flat.
- **Bright → dark → clean exit.** Aftermath is dark and normal-blended. The frame is clean ~1–1.5 s after the hit,
  except a fading ground mark.
- **Loops need a hero shape and a beat.** A looping aura gets one iconic silhouette plus a 1–3 s rhythmic pulse.

## 8. Wind, auras and shape language (user reference videos, `batch-e.json`)
- **Wind is shape, not colour.** Tapered crescent ribbons with a bright leading edge and a ragged or hooked tail,
  revealed by an alpha-erosion mask. Never round soft particles alone.
- **Pick one wind dialect per layer.** Soft: translucent white sheets at 0.3–0.5 opacity that build up where they
  overlap. Toon: opaque flat bands (light inner edge, saturated middle, dark outer edge) with thorn or sawtooth
  outer edges and no glow.
- **Spread arcs over many tilted planes**, so flat strips read as a 3D sphere or tornado from any camera. One
  horizontal ring reads as a decal.
- **Drawn shapes, procedural motion.** Author the silhouette (claw spikes, brush strokes, white edge highlight)
  as a custom mesh or mask, then animate it with UV scroll, erosion threshold, rotation and overshoot scale, not
  flipbooks.
- **Telegraph thin, pay off wide.** A star glint plus a needle-thin line on the same axis and in the same colour
  as the payoff makes the big shape feel huge.
- **Hold, then reveal.** A short low-energy hold (the caster hidden in dust, a pale cloud dome) before the release.
- **Fade by changing state, not by lowering alpha.** Arcs darken into ghosts, blades break into shards, pillars
  collapse to a line and a star, beams break into a sparkle trail, embers land and twinkle out.
- **Auras are compositions.** A ground anchor, a vertical element that keeps the silhouette readable, and one
  signature shape (a sun, seeds, a sigil).
- **One detailed focal element per beat.** A detailed rune at the beam source, the beam itself simple. Theme
  props are few and tiny.

## 9. Weapons, telegraphs, cinematic (user reference videos, `batch-f.json`)
- **Weapon trails are multi-strand silk.** 5–7 thin bright parallel strands inside one ribbon with stringy, eroded
  ends, hot at the blade and cooler at the tail. The idle weapon already wears the trail; the swing stretches it.
- **A slash can be smoke.** A soft, semi-opaque, normal-blended grey-white smoke crescent drifting with the swing,
  plus a faint ghost arc lingering ~0.4 s, reads as speed. A hard additive blade reads as a laser.
- **Monochrome effects mark beats with a grade frame**: one sepia frame or one pink-white blowout with black
  silhouettes (a gentler impact frame).
- **Strobe the flash.** Flash / normal / flash / normal / flash at ~12 fps for ~0.4 s beats one long white-out.
- **The telegraph carries the theme**: the meteor's own shadow sliding and growing, or a glyph that collapses one
  beat before the strike, instead of a plain ring.
- **Big flat shapes for ground breakage.** 6–8 large dark triangular plates tilting up and sinking, or a crater
  "flower" of bright molten petals alternating with dark wedges. Not lots of tiny rocks.
- **A weapon set shares one icon** (the same burst on every item) and follows each object's structure. Idle loops
  use opposing motion (up and down), not more brightness.
- **Cool on warm only at the exact hit, for 2–3 frames.** A blue-white star at the base of a fire pillar works like
  a small local impact frame.
- **Cinematic quality is camera and time.** Fog lit from inside by off-screen flashes, exposure blowouts that
  recover over ~0.3 s, a time ramp into slow motion for the payoff, and lightning in three thicknesses on separate
  clocks. In gameplay keep the slow hold to ~2–3 s, with no shake during it and dark debris in front of the bright
  beam.

## 10. Finishers and cutscene language (user reference videos, `batch-g.json`)
- **Charge in a void, hit in the world.** Finishers stage the charge in a black or starry space with no ground,
  then hard-cut back to the arena for the hit. Leaving and returning is itself an impact.
- **Shot grammar: close → wide → ground-level → reveal (held).** Lead-in shots last 0.15–0.3 s each and alternate
  size. Only the reveal or the charge is held 1–1.6 s, with a slow 10–15% push-in. Stillness is the anticipation.
- **Transitions are VFX.** A 0.3–0.6 s full-screen diagonal speed smear (with themed particles flying through) or
  1-frame flat-colour graphic cards between angles.
- **Escalate long channels in colour stages** (blue → magenta → gold), each switch marked by one inverted frame.
  The hit keeps growing instead of just lasting.
- **Exit through a hold.** Cinematics end on a held whiteout or a hard cut to a calm wide shot. Gameplay moves end
  with a grey, normal-blended dust vortex that keeps spinning after the colour has drained.
- **A dead beat between two hits.** 0.1–0.15 s with no VFX at all (a frozen crouch) between the wind-up and the
  real hit. Repeat the world tint on both beats.
- **Turn the axis at the impact.** A horizontal charge and shot ending in a vertical pillar reads as a new event.
  Give the release one perfect clean shape (a thin golden ring) inside the noisy charge.
- **Draw the telegraph with a moving point.** A spark runs around and draws the rune circle, then a cold white
  glint with a long horizontal flare. Cold cue, warm payoff.
- **Show where it comes from ~0.3 s early.** A rift tears in the sky before the blades rain. Blades have dark
  bodies and hot thin edges, and hang ~1 s as scars.
- **Themed particles give identity.** Butterflies or petals instead of sparks; glitch cubes and red digits for a
  corrupted slash; a tiny graphic full stop (a dotted line with a diamond tip) to end a combo.

## 11. From video tutorials (watched 2026-10-26, `pipeline/library/batch-h.json`)
- **Design from the source.** Ask what the weapon/spell *is* (lore, material, element, strength) before shaping it:
  a beginner sword gets a slash that only says "an attack happened" (onetupthree).
- **Slash = base + highlight + support + impact.** Base sets the silhouette (an arc mesh you can shape on its
  own), highlight is smaller but carries the most weight, support details may leave the base's bounds but never
  outshine the highlight, and the impact reuses the slash's shapes/colours and moves along the swing (specks fly
  back, a thin diamond along the tangent). A fire variant uses a **dark red eroding base** under a bright
  orange→yellow highlight; an ice variant answers with impact curves that **mirror the slash shape** (onetupthree).
- **Deconstruct into primary / secondary / tertiary** (main blast / on-hit ignite / smoke and distortion) and
  **reserve the highest values for damage**; indicators and particles stay lower in value. Give a ground spell
  ~1 s anticipation, ~0.75 s climax, ~2 s aftermath with a visible pulse on every damage tick (Stylized Station).
- **Every cloud layer has a bright twin and a dark twin.** The bright one is the flash and dies fast; the dark one
  carries the shape. Ground clouds burst flat and wide; rings scale fast, then keep drifting slowly (onetupthree mech).
- **Charge-ups ease in hard:** slow, slow, then fast at the end. A two-part shine: ease-out to appear, ease-in to
  follow the ramp (onetupthree mech).
- **Alpha-threshold everything.** One smoothstep(threshold, threshold+feather) function erodes alpha, and a second
  threshold on the emissive makes the hot core burn out before the smoke does (Beyond-FX). Thresholding a 0..1
  gradient is the root of almost every stylised shape: grow, dissolve, inner-glow bands (Noggi).
- **Smoke is lit and dark.** The explosion body is dark grey lit smoke that bulges outward; colour lives in small
  accents (core, streaks, ember trails). Normals flatten near the end of life (Beyond-FX).
- **Spawn secondary from primary.** Trails and embers are emitted at each debris piece's position with its
  velocity pushed back; ribbon randomness is per ribbon, never per segment; tile ribbon UVs by distance
  (Beyond-FX). Debris spin follows its speed, so it stops spinning when it lands.
- **Geometry over simulation for stylised work.** Lumpy mesh puffs (overlapped icospheres, remeshed) with a hard
  masked erosion and a light→dark *value* ramp beat simulated smoke for a toon look (Gabriel Aguiar, Noggi).
- **Texture kinds:** non-tileable erosion maps (bright parts survive longer, e.g. a bolt whose lingering bits are
  brighter), tileable strips for scrolling streaks, flipbooks for exact motion, sprite-sheet variants so particles
  differ. Make only the signature textures; use free packs for common fire/smoke (Le Lu, Noggi).
- **Glow = a blurred copy under the crisp shape.** Radial-symmetry strokes turn a few marks into an ornate magic
  circle (Le Lu).

### 11b. Second tutorial round (`pipeline/library/batch-j.json`)
- **Lightning lives on single frames.** At 24 fps: thick bolt → thin line on the same path → the shape *mirrored*
  thick → thin → broken dashes → only the dash ends (energy evaporating). Anticipate with a spark on the ground
  where it will hit. One frame of the bolt in **black** right after a white frame burns an afterimage; keep it to one
  frame and a small area for photosensitivity. Alternate thickness and use sharp elbows (Dan Root).
- **Black is a colour.** A black copy of a bolt or beam drawn *behind* the bright one (same random path, a bit
  wider) makes it read on any background. One texture can hold crisp core in R and blurred glow in G; pinch both
  ends of a ribbon with a sine mask (CGHOW).
- **One duration drives every layer.** A beam is one particle with its pivot at the source: length 0→1 in the first
  10 % of life, width 1→0 over the last 10 %. Three copies of one shape give depth: a dark wider under-beam drawn
  first, the bright scrolling core, and a blue copy with a higher alpha clip and more UV distortion
  (`lerp(uv, noise, 0.2)`, noise scrolling faster) as the electric layer (Gabriel Aguiar).
- **Shields change what is behind them.** A refraction swirl (screen texture sampled with a twirled noise
  offset, clear in the centre) sells glass more than colour does. Add a fresnel rim and a depth-intersection line
  where it cuts the floor. Make hits *local*: a sphere mask at the hit point drives a dimple and a magnify. Dissolve
  with a height gradient + noise and a second offset threshold for the glowing edge (A Bit Of Game Dev).
- **Two noises in different coordinate systems** (polar-spun noise × twirled Voronoi over a soft disc mask) never
  repeat visibly: a portal in one plane (Flex Unit).
- **Mesh shape does the motion.** A hollow funnel with flared ends, an off-centre base and a hard twist at the top
  makes any scrolled texture follow a spiral; spin the mesh one way and scroll the UVs the other way. Subtract a
  clamped vertical gradient to hide the hard ends; sample a 1D colour ramp *with the texture value* to get core and
  edge colours from one texture. Hide the floor intersection with small spinning "wave" meshes. On mobile/VR use
  alpha clip instead of transparency to avoid overdraw (Le Lu tornado).

## 12. Frame-by-frame lessons from YouTube showcases (`batch-i.json`, frame logs per video)
- **Anti-flash.** One frame 10–15% darker than normal, or a soft black blob for 1–2 frames, right before a
  whiteout. Dark-to-white reads much stronger than normal-to-white.
- **Collapse the flash onto the ground.** The blowout is a sphere for one frame, then a flat radial spray plus a floor
  ring. One empty frame between contact and blowout.
- **Chromatic aberration can be the only colour.** A black/grey/white move whose only hue is a 2–3 px RGB-split
  fringe plus pink/teal screen edges, pulsed on each hit.
- **Drain the colour, keep one hue.** Desaturate the character, then the world, keeping only the move's colour.
  Put a calm static prop (a white crescent mirrored in a wet floor) behind the target.
- **Impact cards can carry meaning.** An X-ray card (skeleton fill on black, or outline on white). A slash shown as
  its cut path: a white-rimmed black band that rotates and thins on a dark screen after 1+ s with no effects.
- **Crack, freeze, shatter.** A full-screen crack web in one frame, everything holds ~1.3 s, then rays, two
  focus-line frames and a screen shatter.
- **Darkness can be the aftermath.** After a distant whiteout, dim the world to ~35% for 3–4 s while one flickering
  element carries the frame, then end with a second whiteout. A giant ring wall rolling through the camera sells a
  horizon hit.
- **Toon explosions are shape, not light.** Average brightness barely changes. Pop at ~70% of final size in one
  frame, add the dark core 2 frames later, ramp through pastels, and let the fill vanish before the outline. Spikes
  last ~0.15 s; rings are scribbles.
- **Hot for 2 frames, dark for the rest, and the floor remembers.** A gold flash for 2–3 frames that lights the whole
  floor, then dark thorns carry the shape. Glossy dark splats from every hit stay 5–8 s.
- **Auras: one spin direction, speed near zero, brightness by transparency.** The rotation-speed range stays on one
  side of zero; speed ~0, spread 0–1°. Floor rings spin both ways. Fix over-brightness by raising transparency
  (0.3–0.9), not by darkening colours. One static ring anchors the moving layers.

## Sources
- Shape/timing/colour, value before colour, anticipation, restraint: practitioner "vfx-realtime" framework
  (playbooks.com/skills/omer-metin/skills-for-antigravity/vfx-realtime).
- Animation principles (anticipation, slow-in/out) for VFX timing: Gnomon "Real-Time VFX Fundamentals for UE5".
- Soft particles / depth fade, alpha erosion, flipbooks: Realtime VFX Dictionary (realtimevfx.com), NVIDIA
  Soft Particles whitepaper (2007).
- Readable projectile phases: Riot-project VFX artist notes; GDC "Attention Overload: Creating Readable VFX".
- §11 video tutorials (transcripts + frames): onetupthree "Anatomy Of A Slash" (youtube.com/watch?v=QyI8ZS-G9nw)
  and "Mini Mech Explosion" (watch?v=eLzQ9eX3flI); Stylized Station / Nicolas Trevisan, Igni redesign
  (watch?v=IHAEL6g7ZnI); Beyond-FX / Nathan Huang, Zelda-inspired explosion (watch?v=LzZ_9tmWPS8); Gabriel Aguiar,
  Stylized Smoke (watch?v=HRagD5L-WF8); Noggi, "How to Create ANY Stylized VFX in 3D" (watch?v=oogSjfL1jpY);
  Le Lu, "VFX Texture Creation: The ULTIMATE guide" (watch?v=dMthnzpR-eU).
- §11b: Dan Root, "How to Animate a Lightning Strike" (youtube.com/watch?v=TRyhaBmEvSA); CGHOW, stylised lightning
  in UE5 Niagara (watch?v=NwdUdaotzNA); Gabriel Aguiar, stylised laser beam in VFX Graph (watch?v=_SaBXY-Ejqo);
  A Bit Of Game Dev, bubble shield in Shader Graph (watch?v=jdAbVkre8cw); Flex Unit, stylised portal
  (watch?v=Jwy3JOhMmdc); Le Lu, Godot tornado (watch?v=thOuxupumtI).
