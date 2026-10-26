# Art bible

Read this first, before `VFX_PRINCIPLES.md`. That file is the *technique* (how to build an effect that reads). This
one says **which look is ours** and **how the artist works**. Anything here wins over older work in the repo.

## 1. The look

**Lacquer, gold and jade, lit by hard anime light.** Objects are dark and precious: black lacquer, gold filigree,
jade and cream-bone inlays, with one glowing gem per object (the five Blender weapons, `docs/weapons/weapons_sheet.png`).
Energy is stylised and graphic: hard-edged shapes, black as a colour, white only in the hottest few percent, impact
frames and focus lines on the big beats. Motion is eastern-fantasy: silk ribbons, qi spirals, dragons, petals,
drifting motes, not sci-fi beams. The tone is **mythic and elegant**, never cartoon-goofy and never gritty-realistic.

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

`new THREE.Color(0x…)`, `setHex` and `'#hex'` strings take these codes as they are (sRGB). `setRGB` / `setHSL` are
linear: pass `THREE.SRGBColorSpace` with them.

## 3. Shape and material language

**VFX** (technique detail in `VFX_PRINCIPLES.md` §7–§11; the kit is `src/effects/parts` and `src/effects/weapons`):
- Main shapes are hard-alpha: four-point stars, crescents, diamond shards, thin crisp rings, thick bent lightning,
  toon smoke balls. Soft glow is only a small halo under a crisp shape.
- Every effect has a black or near-black, normal-blended shape on or behind its brightest layer.
- Themed particles over generic sparks: petals, scales, snowflakes, qi motes, gold leaf.
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

## 6. Taste calls I made (tell me if any is wrong)
- **How anime:** impact frames and focus lines only on finishers and big hits; everyday moves stay clean.
- **How dark:** objects dark (lacquer) and the world darkened during big moves; energy is the only bright thing.
- **Saturation:** rich but not neon. Body colours are saturated mid-tones; neon is only the 2–3 frame accent.
- **Realism:** none. Stylised shapes over simulation; smoke is toon smoke.
- **Theme:** eastern myth (dragons, phoenix, lilies, qi, taiji) is the default flavour for new pieces.
