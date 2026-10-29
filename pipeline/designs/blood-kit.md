# Blood kit: Vesper, the Crimson Countess (a four-spell hero kit)

One hero, four spells that read as one character. The cohesion is the deliverable: the same blood, the same
shapes, the same pale foil and a scale ladder from a quick strike to one cinematic ultimate.

- **Hero (one line):** a gothic hemomancer noble. She bleeds on purpose: a pale cut on her palm, and her blood
  becomes whips, lances and thorns. What she spills she takes back from her enemies.
- **Category:** every module uses `category: 'hero: blood'` (its own group in the category dropdown).
- **Mechanic motif (the visual through-line):** every small spell ends with **blood drops flying back from the
  enemies into the caster's chest** (life drain). The ultimate opens by spending them: three blood beads orbit her
  and are thrown up into the sky.
- **Not crimson requiem:** no petals, no grey-world colour drain, no red laser slashes. Blood here is a liquid that
  hardens into crystal, not a flower.

## Palette (art bible §2 row "Blood")
| Core | Hot | Body | Accent | Dark | Foil |
|---|---|---|---|---|---|
| `#fff1e6` | `#ff3b4e` | `#8c0f22` | `#bff4ff` | `#140306` | bone `#e9dcc6` |

- **Core** only in tiny specular dots and the 1–2 frame tip glints.
- **Hot** arterial red is the thin rim light on wet surfaces and the bright edge line on crystals.
- **Body** is the liquid itself and the crystal fill. **Dark** is the shadow side, the dried pool and the smoke.
- **Accent** cold pale cyan, 2–3 frames only at the hit (a small `StarBurst`), never in the body.
- **Foil** bone: the sigils, the cut on the palm, impact cards and the moon. Dark red on a darkened world vanishes
  (black on black); every spell keeps one pale bone shape near the blood so the red reads against it.
- `ctx.hit(e, { ..., color: 0x8c0f22 })` on every hit, so the arena hit flash is crimson, not white.

## Shape language
1. **The tendril (signature shape).** A tapered, viscous rope of blood with a round bead at the tip (surface
   tension). Smooth, never faceted. Whips, threads and lances all start as tendrils.
2. **The crystal thorn.** Blood that hardens: a long, sharp, slightly curved ruby spike with hard facets, a dark
   body and a thin hot edge line. Liquid is smooth; crystal is faceted. That contrast is the kit's idea.
3. **The pool.** A dark wet decal with a lumpy, rounded edge that spreads and later dries to near-black.
4. **The bone sigil.** A pale crest: a thorned circle, two inward fang crescents, one script band. Drawn on with a
   reveal; it is the pale foil on the floor.
5. **Drops.** Teardrops stretched along their velocity, falling with gravity and leaving small splats; or arcing
   home to the caster (the drain).

## Material rules (blood is a fluid, see the art bible water lesson)
- Liquid: smooth normals, a custom toon shader: body crimson, fresnel to the dark colour at the rim, ONE thin
  hot rim line on the light side, one tiny core specular dot. Normal-blended. No `MeshStandard` gloss (it turns
  into ruby glass), no additive spheres (white blobs).
- Crystal: flat facets, dark body, the hot edge line; below the bloom threshold except a 1–2 frame tip glint.
- Smoke after the hit is dark `#140306` toon smoke (`SmokeBall`), small.

## Shared parts: `src/effects/parts/blood.ts` (built first, exported from `parts/index.ts`)
- `BLOOD`: the palette constants above.
- `BloodTendril`: a tapered tube on a curve you set per frame (`setPoints(points)` or a function), with `width`,
  `reveal` (head/tail 0..1, so it can be drawn on and pulled back in), a tip `bead` scale and a small wobble.
- `BloodDrops`: an instanced teardrop pool: `spray(pos, dir, count, speed, spread)`, gravity, a splat on ground
  contact (adds to a `BloodSplats` decal pool), and `drain(from, toFn, count)` for drops that arc home to a moving
  target (the caster's chest) and pop there.
- `BloodPool`: a ground decal: `spread(radius, seconds)`, a slow ripple, then `dry()` to the dark colour and fade.
- `BloodThorns`: instanced crystal spikes: `erupt(center, radius, count, height)` with a staggered grow-out,
  `shatter()` into dark crystal flakes. Also usable as one big spike (the lance).
- `BloodSigil`: the bone crest as a ground decal (canvas-drawn), with a `reveal` (draw-on) and a `fade`.

## The four spells (the scale ladder)
| Slot | Name | Targeting | Length | Camera |
|---|---|---|---|---|
| Q | Hemolance | `enemy` | hit at 0.55 s, clean by 1.6 s | gameplay |
| W | Thorn Garden | `ground`, radius 4.5 | hit at 0.75 s, clean by 2.2 s | gameplay |
| E | Crimson Pact | `self`, radius 6 | ~3.2 s (loopable) | gameplay |
| R | Sanguine Eclipse | `ground`, radius 7 | hit at 2.4 s, clean by 4.5 s | gameplay (MOBA ultimate) |

**MOBA timing (user, 2026-10-29):** Q, W and E are normal MOBA abilities: a short wind-up (0.3–0.75 s to
the hit), readable from the top-down/over-the-shoulder gameplay camera, done in about 2 s. R is a MOBA
ultimate: the biggest, most dramatic one of the four, but still played from the gameplay camera (no cinematic, no
letterbox) and over in about 4.5 s. The per-spell designs list the exact times.

Designs: `hemolance.md`, `thorn-garden.md`, `crimson-pact.md`, `sanguine-eclipse.md`.

## Craft rules
`docs/ART_BIBLE.md` (value ladder, black as a colour, a dead beat before the real hit, few damage ticks, short impact
frames `[1, 2]` at 0.04 s, a clean frame ~1.5 s after the hit). No spell uses a cinematic camera or letterbox.
Impact frames only in Hemolance (one, short) and the ultimate. Distortion is a seasoning in the small spells
(a ring at the hit, 0.03–0.04) and a hero in the ultimate.
