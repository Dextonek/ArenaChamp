# Vermilion Phoenix Dive

- **Label:** `vermilion phoenix dive` · **File:** `src/spells/targeted/vermilionPhoenixDive.ts` · **Module:** `vermilionPhoenixDiveModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Fire / phoenix**: core `#fff4d6` → hot `#ffc247` → body `#ff6a1f` → accent
  pink `#ff4f8b` → dark `#3a0d0a`. The shape that makes it ours: **a drawn phoenix** (a canvas silhouette like the
  jade dragon's head in `src/spells/targeted/jadeDragonAscension.ts` `dragonHeadTexture()`): spread wings of long
  flame feathers, a crested head, a trailing tail of 3–5 long plumes. It rises behind the caster, then folds its
  wings and dives onto the target like a spear.
- **Recipes:**
  - `g-castorice-wing-nova-finisher`: wings open huge behind the caster as the held reveal (taken: the wing spread
    is the anticipation pose).
  - `f-spiderlily-tome-wings`: wings made of flowing ribbons with scrolling flame (taken: the tail plumes are
    `FlowRibbon`-style scrolling strips).
  - `f-html-meteor-slam`: a falling body that hits as a meteor, crater flower of molten petals (taken: the impact).

## Timeline (~4.6 s)
- **0.0–0.4 cast.** `screen.darken` → 0.6, tint `#3a0d0a`. Embers spiral up around the caster (additive emitter,
  gold → orange → pink, rising, drag). A cold white four-point glint at the caster's chest (cold cue).
- **0.4–1.5 the phoenix rises and spreads.** Behind and above the caster (~5 m up, 2 m behind, facing the target):
  the phoenix sprite (billboard, ~7 m wingspan) scales in from the glint with overshoot. Wings open over 0.5 s
  (two sprite halves, or one sprite + scale.x ramp), then hold 0.5 s wide: this is the pose. Hard alpha, black
  outline, hot → body → dark value ramp from the body out to the wing tips, pink accent only on the crest and the
  eye. 3–5 tail plumes: thin scrolling ribbons (custom strip, additive, orange → pink → eroded tip) streaming down
  behind it. Feathers shed: a `PetalSwarm`-like emitter with pointed feather sprites or small orange flakes.
- **1.5–1.75 fold and aim.** The wings fold back (scale.x of the wing → 0.35), the phoenix turns its beak toward the
  target. A needle-thin hot line from the phoenix to the target flashes once (telegraph thin, pay off wide).
  Dead beat 1.7–1.75.
- **1.75–2.05 dive.** The folded phoenix streaks to the target along a slight arc (ease-in, fast). A wide fire
  `CrescentArc` (soft dialect) trails it like a slipstream; the tail plumes stretch long behind it.
  Black normal-blended smoke puffs pop along the path.
- **D = 2.05 impact.** `impactFrameAt(t, D, [1, 2, 1])`, `impactColor` `#ff6a1f`, silhouettes = target. The phoenix
  bursts: the wings open one last time huge (2× scale, 3 frames) and shatter into feathers. A crater flower on the
  ground: 8 bright molten petals alternating with 8 dark wedges (§9), flat, scaling out. A cool `#cfe8ff` star at
  the base for 2 frames (§9 cool-on-warm). `ctx.hit(e, { damage: 65, knock: 6 })`. Shake 0.9.
- **2.05–4.6 aftermath.** A short fire pillar collapses to a line and a star (fade by changing state). Feathers
  drift down and burn out (orange → dark). Toon black `SmokeBall`s (2–3) roll from the crater. Scorch mark
  fades last. Frame clean by ~3.6 s.

## Layers (9)
| # | Layer | Kit | Blend | Colour |
|---|---|---|---|---|
| 1 | darken + tint | `ScreenFx` | — | `#3a0d0a` |
| 2 | embers round the caster | `Emitter` | additive | gold → orange → pink |
| 3 | phoenix sprite (wings, body, head) | canvas texture on billboards | normal, hard alpha | hot → body → dark, black outline |
| 4 | tail plumes | scrolling strips | additive | orange → pink → eroded |
| 5 | slipstream crescent | `CrescentArc` soft | additive | orange |
| 6 | feathers | sprite emitter / instanced | normal | orange → dark |
| 7 | impact frames + cool star | `impactFrameAt`, `StarBurst` | normal | `#ff6a1f`, `#cfe8ff` |
| 8 | crater flower | custom flat mesh | additive petals + normal wedges | molten / `#3a0d0a` |
| 9 | smoke + scorch | `SmokeBall`, disc | normal | black / dark red |

## Hits and telegraphs
- Telegraph: a `circle` (radius 2.5) at the target from 1.5 until D.
- Hit: `ctx.hit` on the target at D.

## Exaggerate
- The wing spread fills the top of the frame behind the caster (7 m), then everything folds into a thin spear.
- The fast dive after a still pose and a dead beat.
- The final burst: the wings open one last time, 2× bigger, for 3 frames before they shatter.
