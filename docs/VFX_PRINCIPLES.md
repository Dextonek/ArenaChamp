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
