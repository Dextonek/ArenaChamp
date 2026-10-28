# Golden Bell Sutra

- **Label:** `golden bell sutra` · **File:** `src/spells/targeted/goldenBellSutra.ts` · **Module:** `goldenBellSutraModule`
- **Targeting:** `self`, `radius: 6` (enemies within the radius around the caster are hit). Check
  `src/effects/targeting.ts` for how `self` mode fills `ctx.targets`; if it does not, hit nothing but still draw.
- **Look:** `docs/ART_BIBLE.md` §2 row **Solar / holy**: core `#fffbe8` → hot `#ffe39a` → body `#f2b53c` → accent cyan
  `#6fe0ff` → dark `#2a1a06`. Material: the bell is an *object*, so it follows the bible's object rules (dark
  bronze body, gold structure, one glowing focal point). The shape that makes it ours: **a giant translucent
  temple bell** (zhong) that drops over the caster, rings once, and the ring of the bell is a visible sound wave of
  sutra script that blasts enemies outward.
- **Recipes:**
  - `c-ue4-energy-shield-dome`: a dome shield with a fresnel rim and a line where it cuts the floor (taken: the
    bell's surface is a fresnel shell, `VFX_PRINCIPLES.md` §11b shields).
  - `f-beyondfx-sunrise-pillar-strike`: a golden pillar of light from above with a held hang (taken: the bell is
    lowered on a pillar of light).
  - `e-seo-wind-bullet`: a nova that pushes out from the caster in rings (taken: the sound-wave rings).

## Timeline (~4.4 s)
- **0.0–0.5 call.** `screen.darken` → 0.6, tint `#2a1a06`. A thin gold pillar of light comes down onto the caster
  (`LightPillar`, narrow). Gold dust motes fall through it. A cold white glint where the bell will appear, 10 m up.
- **0.5–1.25 the bell descends.** A bell (~4 m tall, ~3.2 m wide mouth) made from a `LatheGeometry` profile (classic
  Chinese bell: flat top with a dragon-loop knob, slightly flared mouth, 2 raised bands): **dark bronze body**
  (`MeshStandardMaterial` or basic, `#3a2a10`, low opacity ~0.35 so the caster shows through) with an **additive
  fresnel rim** shader (`#ffe39a`), gold bands (thin tori), and a ring of 8 raised nipples/studs. One glowing focal
  point: the strike spot on its side. It descends slowly (ease-out), turning slightly, then drops the last 0.5 m
  fast and **lands** at 1.25: dust ring, a gold ground ring decal, a small shake (0.3). Where it cuts the floor, a
  bright intersection line (a thin ring at the mouth).
- **1.25–1.7 hold.** Still. Sutra script glows on the bell: a band of glyphs (canvas texture of simple strokes, not
  real text — short bars/dots in rows) scrolling slowly round the middle band. Dead beat 1.65–1.7.
- **D = 1.7 the ring (strike).** An unseen strike: the focal spot flashes, the bell **shakes** (scale wobble
  1 → 1.06 → 0.98 → 1 with a 3-cycle decay over 0.6 s). `impactFrameAt(t, D, [1, 2])`, `impactColor` `#f2b53c`,
  silhouettes = caster + enemies in range. A cyan `#6fe0ff` star on the strike spot for 2 frames. Sound-wave
  rings: 3 thick flat rings (`createRing`, gold → dark) burst out from the mouth at 0, 0.12, 0.24 s, each carrying
  a band of sutra glyphs on a cylinder wall (a short vertical band, additive, scrolling outward). Enemies within
  `radius`: `ctx.hit(e, { damage: 50, knock: 9, from: caster })`. Shake 0.8.
- **1.7–2.6 echo.** Two weaker echo rings at 0.35 s and 0.7 s (smaller, fainter), the bell keeps a gentle wobble.
  Gold leaf flakes (small flat quads, normal blend, gold with dark edge) shower off the bell.
- **2.6–4.4 lift.** The bell rises back up the pillar and fades by changing state: it turns to a gold outline only
  (body opacity → 0, rim stays), then the outline breaks into a ring of motes that drift up. The ground ring fades
  last. Frame clean by ~4.0 s.

## Layers (9)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | darken + tint | `ScreenFx` | — | `#2a1a06` |
| 2 | light pillar + falling motes | `LightPillar`, `Emitter` | additive | `#ffe39a` |
| 3 | bell body | `LatheGeometry`, translucent | normal | dark bronze `#3a2a10` |
| 4 | bell rim + bands + studs | fresnel shader, tori | additive / normal | `#ffe39a`, gold |
| 5 | sutra glyph band | canvas texture, scrolling | additive | `#ffe39a` |
| 6 | strike flash + cool star | `StarBurst`, `impactFrameAt` | normal | `#6fe0ff` |
| 7 | sound-wave rings + glyph walls | `createRing`, cylinder band | additive | gold → dark |
| 8 | gold leaf + dust | instanced quads, `Emitter` | normal | gold / dark edge |
| 9 | ground ring + intersection line | `createRing` | additive | `#f2b53c` |

## Hits and telegraphs
- Telegraph: a `circle` (radius 6) around the caster from 0.5 until D.
- Hit: every enemy within the radius at D, knocked outward.

## Exaggerate
- A temple bell bigger than the caster drops out of the sky and lands with weight.
- The sound is visible: rings of sutra script blast outward.
- The bell's wobble after the strike sells the ring without audio.
