# Jade Dragon Ascension

- **Label:** `jade dragon ascension` · **File:** `src/spells/targeted/jadeDragonAscension.ts` · **Module:** `jadeDragonAscensionModule`
- **Targeting:** `ground`, `radius: 5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Jade qi / dragon**: core `#f2fff6` → hot `#9ff2c8` → body `#2fbf7a` → accent
  gold `#e8b84a` → dark `#0b2a1c`. The shape that makes it ours: **a spirit dragon made of silk ribbons**, coiling
  up out of a drawn jade sigil and diving back down through it.
- **Recipes:**
  - `c-unity-summon-circle`: the circle is *drawn* by a moving point before anything rises (taken: drawn telegraph).
  - `e-geodraws-crimson-pillar`: spiral ribbons wound round a vertical form (taken: the dragon's coil is 3–4
    ribbons spiralling up a pillar axis).
  - `g-castorice-dragon-rise-cutscene`: a dragon rises in a held reveal, then crashes down (taken: hold at the top,
    then the dive is the hit; turn the axis — horizontal sigil, vertical dragon).

## Timeline (~5.2 s)
- **0.0–0.9 anticipation (draw the sigil).** `screen.darken` → 0.7, tint `#0b2a1c`. A gold spark (small `StarFlare`
  or `StarBurst` 4-point glint, gold `#e8b84a`) runs round the ground circle at the target and *draws* it: a
  `createRing` whose visible arc grows 0 → 360° behind the spark (use a ring segment whose thetaLength animates, or
  reveal with a shader). Then an inner ring and 8 radial gold ticks pop in (2 frames apart each). Small jade qi motes
  (`Emitter`, additive, rising, `#9ff2c8` → `#2fbf7a`) drift up from the circle edge.
- **0.9–1.2 implode.** Motes and dust are pulled to the centre; a toon `CrescentArc` spiral (3 arcs, jade/white
  edge, dark green outer) tightens at the centre. One dead beat 1.15–1.2: nothing moves.
- **1.2–2.4 ascension.** The dragon rises: a head (a small bright `StarFlare` cluster + two horn `CrescentArc`
  hooks) leads, its body = 3 `FlowRibbon`s from `src/effects/weapons/kit.ts` scaled up (width ~0.5–0.8 m) or
  thick `TubeGeometry` strips following a helix around the target axis (radius 2.5 → 1.2, 2 turns, up to ~11 m).
  Hot `#f2fff6` leading edge, jade body, ragged eroded tail. One black under-ribbon (normal blend, `#0b2a1c`,
  slightly wider) behind the main one so it reads on any background (§11b "black copy behind"). Gold scales:
  a sparse additive emitter (`#e8b84a`) shed from the head. Enemies in the circle lift 0.5 m and take a small hit
  (`ctx.hit(e, { damage: 10, knock: 0.3 })`) as the coil passes them.
- **2.4–3.0 hold at the top.** The dragon hangs in a tight coil high above; a big four-point gold `StarBurst`
  glint at its head (cold → warm: the glint flashes white first). Speed lines (`screen.speedLines` → 1) with
  `focus` at the head.
- **3.0–3.35 dive (the hit).** The head dives straight down the axis, body following (ribbons re-target to a
  straight vertical line), 3–5× faster than the rise. Impact at **D = 3.35**: `screen.impact = impactFrameAt(t, D,
  [1, 2, 1])`, `impactColor` `#2fbf7a`, silhouettes = targets. Big crisp jade `StarBurst` (12 points,
  `additive: false`, `#9ff2c8`, white core). `ctx.hit(e, { damage: 55, knock: 7, from: center })` for every enemy
  within the radius. Shake 0.9.
- **3.35–4.0 burst.** A jade `LightPillar` flash (0.25 s), a shock ring (`createRing`, 0 → 9 m over 0.45 s,
  jade → dark), 6–8 big dark ground plates (instanced flat triangles, `#0b2a1c`, normal blend) tilting up and
  sinking (§9 "big flat shapes"), a toon `SmokeBall` ring (dark green-grey) bulging outward.
- **4.0–5.2 aftermath.** Colour drains: gold scales drift down and twinkle out, the sigil fades last (eroded),
  a dark green-grey dust vortex keeps spinning slowly. Frame clean except the sigil by ~4.8 s. Restore the screen.

## Layers (9)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | world darken + tint | `ScreenFx` | — | `#0b2a1c` |
| 2 | drawn sigil (rings + ticks) | `createRing` / custom | additive | gold → jade |
| 3 | dragon body ribbons | `FlowRibbon` (scaled) or TubeGeometry | additive | white edge → jade → eroded tail |
| 4 | dragon black under-body | same, wider | normal | `#0b2a1c` |
| 5 | head flare + horns | `StarFlare` / `StarBurst` / `CrescentArc` | additive / normal | white, gold |
| 6 | qi motes + gold scales | `Emitter` ×2 | additive | jade, gold |
| 7 | impact star + impact frames | `StarBurst`, `impactFrameAt` | normal | jade/white |
| 8 | ground plates + shock ring | instanced mesh, `createRing` | normal / additive | dark green, jade |
| 9 | dust vortex | `SmokeBall` / dark `Emitter` | normal | `#1d3a34` |

## Hits and telegraphs
- Telegraph: a `circle` zone at the target, radius 5, from 0 until D = 3.35.
- Hits: small lift hit during the ascension (once per enemy), main hit at D.

## Exaggerate
- The dragon is huge: it rises to ~11 m, 3× the circle's radius, and fills the top of the frame at the hold.
- The dive is 3–5× faster than the rise; the hold before it is completely still.
- The axis turns: flat drawn sigil → vertical dragon → flat breaking ground.

## Changes after review (2026-10-26)
- Round 1: one tapered body ribbon (not three equal strands), serpentine path, gold spine line, two thin whiskers.
- Round 2: the head is a drawn profile (`dragonHeadTexture()`: open jaw, fangs, gold eye, two antlers, mane,
  beard, black outline, white brow edge) on a billboard that points the snout along the travel direction. The
  eye flares gold → white at the top of the rise. No glow ball at the neck. The body flips to stream *above* the
  head at the start of the dive, so the dive is head-first.
