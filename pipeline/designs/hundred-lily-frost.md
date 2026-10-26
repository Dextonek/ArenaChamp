# Hundred Lily Frost

- **Label:** `hundred lily frost` · **File:** `src/spells/targeted/hundredLilyFrost.ts` · **Module:** `hundredLilyFrostModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Look:** `docs/ART_BIBLE.md` §2 row **Frost / lily**: core `#f4fbff` → hot `#bfe8ff` → body `#5ab8f0` → accent
  violet `#8a7cff` → dark `#0e1f3a`. The shape that makes it ours: **a crystal lily** that blooms under each enemy
  (6 faceted petals opening from a closed bud), then all of them shatter at once.
- **Recipes:**
  - `c-ice-spikes-eruption`: spikes erupt from the ground in a sequence (taken: the sequence, but the spikes are
    lily petals).
  - `h-onetupthree-frost-blade-slash`: ice impact curves **mirror** the slash shape (taken: the shatter shards fly
    out in the petal's own curved shape).
  - `f-spiderlily-staff-orb`: a lily burst of thin filaments on a focal point (taken: a `LilyBurst` with straight
    crystal spikes as the bloom's stamen glow).

## Timeline (~4.6 s)
- **0.0–0.6 anticipation.** `screen.darken` → 0.65, tint `#0e1f3a`. A cold white four-point glint at the caster's
  hand with a long horizontal flare (§10 "cold cue"). Frost mist (normal-blended, pale `#bfe8ff` at 0.3 opacity,
  low, slow) rolls out from the caster along the ground toward the targets.
- **0.6–(0.6 + 0.18·n) the buds.** In a clear spatial order (nearest first, ~0.18 s apart, §7 "readable order"):
  under each enemy a closed bud of 6 tall petals punches up out of the ground (custom mesh: each petal a thin
  faceted diamond/lancet, ~1.6 m tall, flat-shaded, `MeshStandardMaterial` or basic with value ramp; dark
  `#0e1f3a` base → `#5ab8f0` body → `#f4fbff` tips; one additive copy slightly larger for the rim glow, opacity ≤ 0.4).
  A small `StarBurst` pop (`additive: false`, `#bfe8ff`) and `ctx.hit(e, { damage: 10, knock: 0 })` when each bud
  lands; the enemy is held in place.
- **Hold ~0.9 s: bloom.** All buds open together (petals rotate outward 0 → ~55°, overshoot to 62° and settle).
  A `LilyBurst` (from `src/effects/weapons/kit.ts`, scaled ~10×, `curl` low so the filaments are straight crystal
  spikes, `#bfe8ff` / white) glows in each flower's centre. Ice glitter (additive emitter, tiny, twinkling) rises
  out of every flower. Sustain with flicker, not more light.
- **Implode 0.3 s.** Petals snap shut again fast (ease-in), the glitter is sucked in, a thin white ring tightens
  around each flower. Dead beat 0.1 s.
- **Shatter at D.** All flowers at once: `screen.impact = impactFrameAt(t, D, [1, 2, 1])`, `impactColor`
  `#5ab8f0`, silhouettes = targets. Each flower bursts into ~18 curved petal shards (instanced, same lancet shape
  scaled down, flat dark-blue bodies with a hot white edge) flying outward and up, spinning, with drag, then
  falling. Violet accent for 2–3 frames only: a `#8a7cff` `StarBurst` flash at each centre. `ctx.hit(e, { damage:
  45, knock: 6, from: flowerCenter })`. Shake 0.8.
- **Aftermath (~1.4 s).** Shards land and twinkle out; snowflake sprites drift down; each spot keeps a frosted
  ground mark (a pale ring decal, eroding). Cold mist settles. Screen restored. Frame clean by ~D + 1.4.

## Layers (9)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | world darken + tint | `ScreenFx` | — | `#0e1f3a` |
| 2 | cold glint + flare at the hand | `StarBurst` 4-point / `StarFlare` | additive | white |
| 3 | ground frost mist | dark-ish `Emitter` | normal | `#bfe8ff` @ 0.3 |
| 4 | crystal lily petals | custom instanced mesh | normal (+ additive rim copy) | dark → body → white tips |
| 5 | flower centre glow | `LilyBurst` (scaled) | additive | `#bfe8ff` |
| 6 | glitter + snowflakes | `Emitter` ×2 | additive | white / pale blue |
| 7 | bud pops + shatter flash | `StarBurst` | normal / additive | `#bfe8ff`, violet 2–3 frames |
| 8 | petal shards | instanced mesh | normal | dark blue, white edge |
| 9 | frost ground marks | `createRing` | additive → fade | pale blue |

## Hits and telegraphs
- Telegraph: a small `circle` (radius 1.6) under each target from its bud time until D.
- Hits: small hit per bud (in order), main hit at D for every target simultaneously.

## Exaggerate
- Readable order then one payoff: buds land one by one, the shatter is all at once.
- The flowers are taller than the enemies (1.6 m petals), and the shards mirror the petal shape.
- Snap-shut implode before the shatter.
