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

## Sources
- Shape/timing/colour, value before colour, anticipation, restraint: practitioner "vfx-realtime" framework
  (playbooks.com/skills/omer-metin/skills-for-antigravity/vfx-realtime).
- Animation principles (anticipation, slow-in/out) for VFX timing: Gnomon "Real-Time VFX Fundamentals for UE5".
- Soft particles / depth fade, alpha erosion, flipbooks: Realtime VFX Dictionary (realtimevfx.com), NVIDIA
  Soft Particles whitepaper (2007).
- Readable projectile phases: Riot-project VFX artist notes; GDC "Attention Overload: Creating Readable VFX".
