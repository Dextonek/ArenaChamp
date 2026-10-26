# Taiji Thunder Seal

- **Label:** `taiji thunder seal` · **File:** `src/spells/targeted/taijiThunderSeal.ts` · **Module:** `taijiThunderSealModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Thunder**: core `#ffffff` → hot `#e6dcff` → body `#9b6bff` → accent cyan
  `#5fe3ff` → dark `#120a24`. The shape that makes it ours: **a giant taiji (yin-yang) seal** in the sky above the
  target, its two halves (violet light / black) spinning faster and faster until a single thick bolt drops through
  its centre.
- **Recipes:**
  - `b-genshin-yae-tenko-kenshin`: a sigil in the sky releases lightning down onto the target (taken: sky seal →
    bolt).
  - `f-moa-thunder-dive-discharge`: the strike discharges in a ground nova with arcs crawling outward (taken: the
    ground discharge after the bolt).
  - `a-dota-zeus-thundergods-wrath`: a single instant, very thick bolt with a pre-spark on the ground (taken: the
    ground spark where it will hit, §11b).

## Timeline (~4.4 s)
- **0.0–0.5 anticipation.** `screen.darken` → 0.8, tint `#120a24`. Storm haze: a dark normal-blended eroded
  emitter (`#120a24` → `#2a1a40`, big soft, low opacity) gathers 8 m above the target. A small cyan spark sputters
  on the ground at the target (the spot it will hit).
- **0.5–1.0 the seal forms.** A taiji disc (custom: one flat circle of radius 3.5 at y ≈ 8, facing down, drawn with
  a small shader or two half-disc meshes + two small dot discs: light half `#9b6bff` additive at opacity ≤ 0.45
  with a `#e6dcff` S-curve edge, dark half `#120a24` normal-blended) scales in with overshoot 0 → 1.08 → 1.
  A crisp thin outer ring (`createRing`, white) and 8 trigram bars (short flat boxes, violet) around it pop in
  one by one, ~0.04 s apart. Small `LightningArc`s (width 0.12, `#e6dcff` core, `#9b6bff` glow) crawl round the rim.
- **1.0–2.2 charge.** The taiji spins: slow, slow, then fast (ease-in, 0.3 → 6 turns/s). Arcs on the rim get more
  frequent. Every ~0.3 s a thin needle bolt licks down from the seal toward the target and dies half-way (the
  telegraph axis, §8 "telegraph thin"). Speed lines (`screen.speedLines` → 0.8) focused on the seal. At 2.0–2.1
  a dead beat: the spin freezes, everything holds still.
- **D = 2.15 strike.** One very thick `LightningArc` (width 1.0, white core, violet glow) from the seal centre to
  the target, with a **black copy behind it** (same path, wider, normal blend, `#120a24`, §11b). Lightning lives
  on single frames: thick → thin → mirrored thick → thin → dashes over ~0.25 s (reroll each frame). Strobe:
  impact frames `impactFrameAt(t, D, [1, 2, 1, 2])`, `impactColor` `#9b6bff`, silhouettes = target. A cool cyan
  `#5fe3ff` `StarBurst` (12 points, `additive: false`) at the target for 2–3 frames only. `ctx.hit(e, { damage: 70,
  knock: 3 })`. Shake 1.0.
- **2.15–2.9 discharge.** Ground nova: 6–8 `LightningArc`s crawl outward along the ground from the target (length
  2 → 6 m, reroll every 0.04 s, dropChance 0.2), a flat violet shock ring (`createRing` 0 → 8 m), black scorch
  disc (normal blend, `#05040a`) under the target. The taiji cracks: its two halves split apart (slide out 1 m
  each way) and fade.
- **2.9–4.4 aftermath.** Arcs die into short dashes, then only their ends (energy evaporating). A dark grey-violet
  smoke ring (`SmokeBall` toon smoke, 3–4 balls) rolls outward and breaks into flakes. Scorch fades last. Frame
  clean by ~3.9 s.

## Layers (9)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | world darken + tint | `ScreenFx` | — | `#120a24` |
| 2 | storm haze | `Emitter` | normal | `#120a24` → `#2a1a40` |
| 3 | taiji seal + ring + trigrams | custom meshes, `createRing` | additive light half / normal dark half | violet / black / white |
| 4 | rim arcs + needle licks | `LightningArc` (thin) | additive | `#e6dcff` / `#9b6bff` |
| 5 | main bolt + black under-bolt | `LightningArc` ×2 | additive / normal | white+violet / `#120a24` |
| 6 | impact star (cool accent) | `StarBurst` | normal | `#5fe3ff` |
| 7 | ground nova arcs + ring | `LightningArc`, `createRing` | additive | violet |
| 8 | scorch | disc mesh | normal | `#05040a` |
| 9 | smoke ring | `SmokeBall` | normal | dark grey-violet |

## Hits and telegraphs
- Telegraph: a `circle` (radius 2.2) at the target from 0.5 until D, plus a `ring` 2.2–6 from D to D + 0.6 for the
  ground nova (second, weaker hit: `ctx.hit(e, { damage: 15, knock: 2 })` for other enemies within 6 m at D + 0.2).
- Hits: main hit at D on the target; nova hit at D + 0.2 on others nearby.

## Exaggerate
- The seal is 7 m across, hanging over the target like a lid: it fills the top of the frame.
- The spin-up eases in hard, then a frozen dead beat, then the strike lands in one frame.
- The bolt is drawn in black and white on alternating frames (a strobe), then evaporates as dashes.
