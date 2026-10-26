# Weapon VFX guide (learned from the reference, nothing built yet)

Reference: *Zedkiel - "Spiderlily" weapon VFX set, made for Virekai* (41 s video in the user's Downloads,
`Zedkiel_-_Spiderlily_-_Weapon_VFX_...mp4`). It shows a staff, a bow, a scythe, a fan pair, a book and paired
daggers, each with a looping "enchant" glow. Only the technique is used here. The look is rebuilt in our own style.
This guide covers how to apply it to the five weapons in `public/models/weapons/`.

## 1. What the reference does

All of these are idle loops. The weapon is held still and nothing gets cast. The glow "breathes" over a cycle
of about 3–4 s.

| # | Part | What you see | Why it works |
|---|---|---|---|
| 1 | **Focal flare** | One white-gold star on the key spot (staff orb, bow grip, scythe joint, centre of the book). It has a short horizontal anamorphic streak and a soft halo, and pulses gently. | It gives the eye one place to land. There is a single hot point per weapon, with at most a smaller one at each end (pommel, butt, tips). |
| 2 | **Spider-lily burst** | Sitting on the flare is a radial flower of thin, curling, golden petal-filaments, like a spider lily. It turns slowly and the filaments flicker. | This is the theme of the set. It is a hand-drawn shape rather than particles, so it reads crisp. |
| 3 | **Flowing flame ribbons** | Long ribbons rise from the weapon: flames off the bow's upper limb, a silk banner trailing back from the scythe blade, tendrils curling out of the book's covers. The texture scrolls along each ribbon and the tip breaks up. | Motion comes from the **texture scrolling along a fixed ribbon**, while the mesh itself barely moves. That is cheap, loops cleanly and reads like fire or silk. |
| 4 | **Edge flames (fan)** | Short flame tendrils point outward all around the fan's outer edge, densest at the rim and fading inward. They read as a fringe. | It is the same ribbon technique, repeated radially. |
| 5 | **Edge glow / tint** | The weapon itself is darkened to a near-black plum. Its edges and inlays glow pink-violet (a fresnel rim). | A dark base lets the additive layers pop. A bright model would wash everything out. |
| 6 | **Soft halo** | A large, faint pink sphere of light behind the hot spot. | It lifts the dark weapon off a black background and adds atmosphere. |
| 7 | **Motes and petals** | A few gold specks drift slowly upward with a little sway. Pink/orange petal flakes flutter down or outward, larger on activation. | Kept sparse: 5–20 on screen at once. They add life without clutter. |
| 8 | **Activation beat** | The weapon starts dark. The flare and ribbons ramp in over about 0.5 s, and a ring of petals sprays outward and falls (the "set complete" moments). Then it settles into the idle loop. | This is the anticipation → release → settle pattern from `VFX_PRINCIPLES.md` §2, applied to an idle. |

**Palette (value ladder):** core `#fff4d6` → gold `#ffb547` → hot pink `#ff5fa8` → violet `#7a2a8c` → dark plum
`#2a0f2e` (the weapon's own tint). Pink/violet and gold appear together everywhere.
**Restraint:** one main ribbon group and one flare per weapon. Each ring of emission sits at a rhythm point of the
silhouette (tips, joints, gems).

## 2. Mapping onto our kit

| Reference part | What we already have | What needs adding |
|---|---|---|
| Focal flare | `GlowSphere` (`rim:false`) for the halo | **`StarFlare`**: a camera-facing quad with a canvas texture (cross plus a long horizontal streak), with scale and opacity pulsing |
| Spider-lily | none | **`LilyBurst`**: a camera-facing quad with a procedurally drawn canvas of 20–30 curled filaments with dot tips, slow rotation, shader flicker. A 3D variant is thin `TubeGeometry` curls around a point, as in `solarVerdict.ts`. |
| Flowing ribbons | `TubeGeometry` and the scrolling-bands shader in `abyssalGaze.ts`, plus `Ribbon` in `heroicLeap.ts` | **`FlowRibbon`**: a flat strip along a `CatmullRomCurve3`, additive. The shader scrolls noise along U (`uTime * speed`), applies a hot→mid→cool gradient along the length, and erodes the alpha towards the tip with the same noise as the emitter's `erosion`. A light vertex wiggle (sine along U) adds sway. |
| Fan edge flames | none | Many short `FlowRibbon`s placed radially along the fan's rim, with offset phases |
| Edge glow | none | **`RimOverlay`**: a clone of the weapon mesh with an additive fresnel shader (as in `GlowSphere`'s rim), scaled ~1.01 and pulsing with the loop. The base material is darkened by multiplying its colour by ~0.35 and its emission by ~0.6. |
| Motes | `Emitter` (`erosion 0`, low `gravity` < 0 for a rise, `drag`, `sizeJitter`) | Spawn points sampled on the weapon's surface. The emitter must follow the weapon in local space. |
| Petals | `Emitter` | Petals need a shaped sprite (a pointed oval texture) and per-particle spin. Our emitter only draws soft dots, so either add a sprite `map` option or use a small instanced petal mesh. |
| Activation | effect timeline (`Effect.update(t)`) | `t < 0.5`: ramp everything in, plus a one-shot petal burst. After that the loop runs on `t mod period`. |
| Loading the weapon | none | `GLTFLoader` from `three/examples/jsm` loads `public/models/weapons/<id>.glb` (plain glTF, no decoder). Attach points are in the weapon's local space, from the README conventions (origin at the grip, +Y up the blade). |

### Rules for looping cleanly
- Every periodic value uses `sin(2π · t / P)` with the same period `P` (or `P / n`). Ribbon scroll speeds must be
  whole numbers of texture repeats per `P`.
- Emitters run continuously, so a loop has no seam. Pre-warm them for one lifetime so the first frame isn't empty.
- Offset the phases between parts (flare, ribbons, rim) by 0.2–0.4 of `P` so the glow travels over the weapon
  instead of pulsing all at once.

## 3. Recipes for our five weapons

Each recipe keeps the reference's structure (flare, signature shape, ribbons, rim, motes) and uses the element
from the weapon's concept art instead of the reference's pink-gold palette.

| Weapon | Focal flare (+ end flares) | Signature shape | Ribbons | Rim and motes |
|---|---|---|---|---|
| **Dragon sword** | Teal-white star on the guard orb; small ones on the pommel ring and the blade tip | A **spirit dragon**: a long `FlowRibbon`-textured tube spiralling up around the blade (2 turns, head near the tip), translucent cyan, with scales scrolling along it | 2–3 thin cyan qi wisps curling off the vertebrae spine | Cyan rim on the blade edges, light running up the centre line (scrolling band on the inlay), cyan sparkles rising |
| **Ice sword** | Ice-blue star at the guard gem; a cold pinpoint at the tip | **Frost lily**: the same `LilyBurst`, but with straight, faceted, crystal-like spikes | Cold mist ribbons falling from the pommel (normal-blended, pale, slow) | White-blue rim, crack lines flickering, snowflake sprites drifting down, a faint frost ring under the weapon |
| **Guandao** | Jade-gold star on the collar orb; one on the butt orb | The **relief dragon lights up**: a light band runs along it from tail to head each loop | Two long green and gold silk ribbons spiralling down the haft (as in the reference scythe) | Green rim on the blade edge, jade motes, a crescent glint sweeping along the edge once per loop |
| **Thunder hammer** | White-violet star on the taiji, which turns slowly; small ones on the eyes and the bell | **Lightning** instead of a lily: 3–5 jagged arcs jumping between the drum studs, re-randomised every few frames (flicker by dropping frames) | A white qi spiral rising up the haft | Violet rim, glowing crack lines pulsing, a few tiny sparks, a dark normal-blended storm haze at the head |
| **Fire fan** | Gold-white star on the pivot gem | **Spider-lily burst** on the pivot: the reference's own motif, a natural fit for this fan | **Flame fringe**: 20–30 short ribbons radiating from the leaf tips, orange → pink → violet (the reference's fan shot, almost exactly) | Pink-gold rim on the ribs, embers rising, petals fluttering off on activation |

## 4. Build order (when the go-ahead comes)

1. Add a `WeaponStage` that loads a GLB, darkens it, adds the `RimOverlay` and a dark background preset. Add a "Weapons" category to the dropdown.
2. Add `FlowRibbon` (the most reused block), then `StarFlare` and `LilyBurst`. Each is a small class next to `GlowSphere` in `common.ts`, or in a new `src/effects/weaponKit.ts`.
3. Build the fire fan first, since it is closest to the reference, and compare its frames side by side with the video. Then build the other four.
4. Verify each in the browser by stepping `vfx.step(1/60)` over one full period. Check that the first and last frames match (a seamless loop), and check greyscale readability.
