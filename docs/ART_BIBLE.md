# Art bible

Read this first, before `VFX_PRINCIPLES.md`. That file is the *technique* (how to build an effect that reads). This
one says **which look is ours** and **how the artist works**. Anything here wins over older work in the repo.

## 1. The look

**Lacquer, gold and jade, lit by hard anime light.** Objects are dark and precious: black lacquer, gold filigree,
jade and cream-bone inlays, with one glowing gem per object (the five Blender weapons, `docs/weapons/weapons_sheet.png`).
Energy is stylised and graphic: hard-edged shapes, black as a colour, white only in the hottest few percent, impact
frames and focus lines on the big beats. The tone is **mythic and elegant**, never cartoon-goofy and never
gritty-realistic. **The theme is open** (user, 2026-10-26: not only xianxia): cosmic, mechanical, nature, abyssal,
ancient-world myths, abstract. What stays is the craft: drawn hard shapes, black as a colour, value ladders, one
focal shape per beat. The eastern-myth set (silk ribbons, qi, dragons, petals) is one theme among many.

Where it comes from: the user's own reference videos (batches d–g: Roblox/anime finishers, Genshin/HSR-style
cutscene beats, the Spiderlily weapon set) and the weapon concepts. The WoW-style paladin and iconic spells are
earlier work. Keep them working, but they are **not** the style reference any more.

## 2. Palette

### Materials (objects, weapons, props)
These are the Blender values (`blender/weapons/_wp.py` `mats()`, per-weapon overrides in each `wp-*.py`). New
objects start from them.
| Role | Hex | Use |
|---|---|---|
| Dark lacquer | `#2a2f2c` (metallic 0.6) | hafts, hammer drums, dark bases |
| Gold | `#c9a24a` (warm `#d2ae55`, pale `#cdb06a`) | filigree, rings, guards, trims, small spikes |
| Jade | `#3fb8a8` teal; green `#2f9a55`, mint `#6fd29a` | blades, leaves, inlays; slightly emissive (0.45) |
| Gem glow | `#8ff5ff` cyan; green `#6dff9c`, ice `#bff0ff` | the one focal gem, strongly emissive |
| Steel / bone | `#dbe5ec` steel, `#d6ddd8` grip, `#efe6cc` tassel | blades, wraps, fan leaves, tassels |

Rule: **dark body, gold structure, one jade or cream face, one glowing gem.** No bright saturated plastic colours
on objects; colour lives in the energy.

### Energy, as value ladders (core → hot → body → accent → dark)
Every effect picks one row, and adds black. The accent is the complementary kick used for 2–3 frames at the hit or
in small details.
| Element | Core | Hot | Body | Accent | Dark |
|---|---|---|---|---|---|
| Fire / phoenix | `#fff4d6` | `#ffc247` | `#ff6a1f` | `#ff4f8b` | `#3a0d0a` |
| Frost / lily | `#f4fbff` | `#bfe8ff` | `#5ab8f0` | `#8a7cff` | `#0e1f3a` |
| Thunder | `#ffffff` | `#e6dcff` | `#9b6bff` | `#5fe3ff` | `#120a24` |
| Wind | `#ffffff` | `#e6fff6` | `#7fd8c0` | `#e8c86a` | `#1d3a34` |
| Jade qi / dragon | `#f2fff6` | `#9ff2c8` | `#2fbf7a` | `#e8b84a` | `#0b2a1c` |
| Solar / holy | `#fffbe8` | `#ffe39a` | `#f2b53c` | `#6fe0ff` | `#2a1a06` |
| Void / shadow | `#f0d8ff` | `#d68cff` | `#8a2ee0` | `#ff3fa0` | `#07030c` |
| Spiderlily (phoenix fan) | `#fff4d6` | `#ffb547` | `#ff5fa8` | `#7a2a8c` | `#2a0f2e` |
| Blood (foil: bone `#e9dcc6`) | `#fff1e6` | `#ff3b4e` | `#8c0f22` | `#bff4ff` | `#140306` |
| Forge (foil: ash `#cfc6b8`) | `#fff3d0` | `#ffb03a` | `#ff5a12` | `#6fe0ff` | `#120a08` |
| Frost (foil: rime `#e8f4fa`) | `#f6fcff` | `#c9efff` | `#4fb4e8` | `#ff9ec4` | `#081626` |
| Astral (foil: chart `#e8e0c8`) | `#fffbe8` | `#ffe08a` | `#5a3fc0` | `#7ff3ff` | `#070414` |
| Alchemy (foil: glass `#dcefe6`, gold `#e8b84a`) | `#f4ffe0` | `#c8ff4a` | `#4fbf2a` | `#ff5ad8` | `#0c1606` |
| Storm (foil: rain `#c8d4de`) | `#ffffff` | `#d6f2ff` | `#4aa8ff` | `#ffe36a` | `#0a1220` |
| Sand (foil: sandstone `#e8d8b4`) | `#fff6dc` | `#ffd27a` | `#c8913f` | `#3fd4c8` | `#2a1a0c` |
| Shadow (foil: moon `#cfcad8`) | `#f4e8ff` | `#c88cff` | `#6a2ec0` | `#5affd2` | `#050308` |

`new THREE.Color(0x…)`, `setHex` and `'#hex'` strings take these codes as they are (sRGB). `setRGB` / `setHSL` are
linear: pass `THREE.SRGBColorSpace` with them.

## 3. Shape and material language

**VFX** (technique detail in `VFX_PRINCIPLES.md` §7–§11; the kit is `src/effects/parts` and `src/effects/weapons`):
- Main shapes are hard-alpha: four-point stars, crescents, diamond shards, thin crisp rings, thick bent lightning,
  toon smoke balls. Soft glow is only a small halo under a crisp shape.
- Every effect has a black or near-black, normal-blended shape on or behind its brightest layer.
- Themed particles over generic sparks: petals, scales, snowflakes, gold leaf, gears, glyphs, feathers, shards.
- Loops (auras) breathe once per period, phases travel over the object, sparse motes (5–20 on screen).
- Big moves: darken the world, implode, impact frame, one scale jump, clean frame ~1.5 s after the hit.

**Objects** (weapons, props; conventions in `public/models/weapons/README.md`):
- Silhouette first: one readable outline at thumbnail size, a clear head/handle split, one rhythm of repeats
  (studs, spikes, leaves) rather than noise.
- Ornament sits on structure: gold at joints, ends and edges; inlays follow the main line of the form.
- One focal gem per object (plus at most two small ones at the ends). That gem is where the VFX flare attaches.
- 10–30k triangles per hand-held weapon, plain glTF, origin at the grip, emissive ≤ 1 for bloom.
- Leave the aura out of the mesh; energy is built as VFX on sockets.

**2D and textures:**
- Magic circles: radial symmetry, 2–3 rings, one script band, one sharp outer line. Drawn on canvas, crisp plus a
  blurred copy under it for glow.
- Slash and wind strokes: tapered, bright leading edge, ragged or hooked tail, eroded by a mask.
- Make only the signature textures; procedural canvas is the default.

## 4. Reference set (the current look, built with the current kits)
| Piece | File | Why it is the reference |
|---|---|---|
| phoenix fan (weapons) | `src/spells/weapons/phoenixFan.ts` | aura structure: flare, lily, ribbons, rim, motes, seamless loop |
| tempest lattice | `src/spells/targeted/tempestLattice.ts` | thick `LightningArc` in two widths, toon crescents, black scorch and smoke |
| gale bullet | `src/spells/targeted/galeBullet.ts` | wind as shape: six `CrescentArc`s, star bursts, a toon smoke ball |
| cinder bow | `src/spells/targeted/cinderBow.ts` | fire as hard crescents and pillars, a cool star at the hot base (§9) |
| starbreaker lance | `src/spells/targeted/starbreakerLance.ts` | full timeline and code structure (predates the parts kit) |
| parts showcase | `src/spells/targeted/partsShowcase.ts` | every parts-kit piece in one place |
| weapon sheet | `docs/weapons/weapons_sheet.png` | material palette and object style |

When something new is made and is better than these, swap it in here.

## 5. How I work as the artist

1. **Ask what it is.** Name, element, material, who uses it, how strong. A starter blade gets a small slash; a
   finisher gets a cutscene. Write it in one line before building.
2. **Pick the palette row and 2–3 references** (this file §4, `pipeline/library/index.json`, the user's videos).
   Name the one thing taken from each.
3. **Thumbnail the beats** in the design note: silhouette at anticipation, impact and aftermath, and the one shape
   that makes it ours.
4. **Build** with the kits. Reuse before inventing; a new shape that works goes into the kit.
5. **Self-critique before showing** (all must pass):
   - Greyscale: still reads with colour off.
   - Silhouette: each beat readable at a small size.
   - Value ladder: white only in the core; one dark layer present; no white-out blob in bloom.
   - Palette: colours come from one row of §2, accent only at the hit or in small details.
   - Clean exit: frame clean ~1.5 s after the hit (a fading ground mark is fine); loops have no seam.
   - Restraint: remove the weakest layer and check whether it got worse. If not, keep it removed.
6. **Show, don't tell.** Screenshots at the key beats, a turntable or loop strip for objects and auras, a
   side-by-side with the reference when there is one. Never report "it compiles" as done.
7. **When taste is the question, offer two variants** (for example clean vs. heavy, warm vs. cold) and let the
   user pick, instead of asking abstract questions.
8. **Record what was learned** here (a new rule, a new reference) or in `VFX_PRINCIPLES.md` (a new technique).

### Do / don't
| Do | Don't |
|---|---|
| a black core under the fire | stacked big additive spheres (white-out) |
| crescents and ribbons for wind | round soft dots for wind |
| one gem flare per weapon | flares on every gem and tip |
| petals, scales, qi motes | generic yellow sparks everywhere |
| darken the world for a big move | raise the brightness of everything |
| gold on joints and edges | gold all over the surface |
| a dead beat before the real hit | a constant stream of effects |
| tilt a sky sigil ~55° toward the caster | a flat sky disc (an edge-on ellipse from the play camera) |
| open a bloom to ≤ 40°, a cup | open petals to 70° (they lie flat and vanish) |
| one tapered body ribbon for a creature | several equal strands (reads as a DNA helix) |
| paper, leaves, bronze are materials: keep them below the bloom threshold | white/near-white fills (they read as lights) |
| black ink against a pale shape (a moon disc, a paper screen) | black on a black, darkened sky (it vanishes) |
| short impact frames, `[1, 2]` at 0.04 s, so the payoff shows right after | long impact frames that hide the burst |
| objects: dark body, gold trim, one glowing part (drums, bell, seal, mask) | glowing gold rims that read as rings of light |
| few damage ticks while enemies are on screen | rapid ticks (the arena flashes them white each time) |
| place hero cutscene shots explicitly and clamp the distance to the look-at | auto-fitting a camera to a whole serpent or body (it backs off 40-60 units) |
| water: smooth normals, unlit or rough material, foam as a soft gradient band on the tips | faceted glossy `MeshStandard` sheets (they read as ice crystals) |
| charge glow on a thin inner band of a coil or ring | a glowing full torus (it blooms into a blob) |
| at the payoff, frame the line and the target with the prop as a small silhouette | a camera inside or right behind the prop when it fires |
| distortion as the hero (a lens, a refraction tunnel) at 0.04-0.07, haze at 0.01-0.02 | distortion so faint it only shows in a pixel diff |
| a creature reveal as a black silhouette on a light impact card (the shape does the work) | lighting a dark creature with a rim or key light (it turns into a glowing blob) |
| "lights down" means a dark interior plus ONE narrow low-opacity cone per subject | many wide cream cones (they wash the scene back to bright) |
| huge sky objects (moon, tree, hourglass): an establishing shot that shows the whole object and tiny enemies for scale | cameras that only ever frame part of the big object |
| water and translucent sheets small and around the subject, faded near the camera | sheets big enough to become walls between the camera and the subject |
| cloud sprites with transparent margins and lumpy edges, 2-3 soft value bands | textures that fill the quad (straight rectangle edges) or many even stripes |
| liquid blood: dark crimson body, dark fresnel rim, one thin hot rim line, a pinpoint specular, a pale foil (bone sigil, moon) near it | a big white highlight on a smooth red sphere (it reads as a billiard ball or a cherry) |
| drips and runs with uneven widths and lengths, rounded tips with a bead | a regular comb of identical drips (it reads as teeth or a saw blade) |
| a hero kit: one shared parts file, one palette row, one signature shape in every spell, a scale ladder Q → R | four spells built from prose alone (four different bloods) |
| big ultimate objects (a hammer, a crown, a stag) built inside the gameplay frame: ~4–9 above the ground near the point | forming them 10+ up, where the gameplay camera only sees their tips |
| steam, fumes and smoke as small toon wisps with eroding edges | smooth opaque spheres (they read as grey or green balls) |
| a self-cast aura's telegraph ends at its first pulse | a telegraph disk held for the whole aura (it floods the frame orange) |
| hero figures: the spell theme on the body (a chest forge, an ice-shard fan, a star halo, vials), the silhouette first | a generic robed figure with the theme only in its colours |

## 6. Taste calls I made (tell me if any is wrong)
- **How anime:** impact frames and focus lines only on finishers and big hits; everyday moves stay clean.
- **How dark:** objects dark (lacquer) and the world darkened during big moves; energy is the only bright thing.
- **Saturation:** rich but not neon. Body colours are saturated mid-tones; neon is only the 2–3 frame accent.
- **Realism:** none. Stylised shapes over simulation; smoke is toon smoke.
- **Theme:** open. Pick the theme that serves the move; avoid repeating the eastern/xianxia set unless asked.
