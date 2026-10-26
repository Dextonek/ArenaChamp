# Neon Fracture Jab

- **Label:** `neon fracture jab` · **File:** `src/spells/targeted/neonFractureJab.ts` · **Module:** `neonFractureJabModule`
- **Targeting:** `enemy`
- **Recipes (YouTube, righteous "vfx practice"; frame log `pipeline/frame-logs/youtube-i/cL3SOjXcMlU.md`):**
  - `i-xray-cyan-punch-impact-cards`: big translucent cyan wisps cross, a cyan glowing ball lands on the target
    first, hard cyan brush strokes shoot in from the side, and the ball turns into radial shards. Then a dark frame
    with cyan speed lines, straight neon cyan bars on navy, a diagonal black/white split card, an X-ray card (cyan
    skeleton on black), an inverted split card, back to 3D with horizontal smear streaks, and thin splash strokes
    that hang almost frozen for ~1 s (hit-stop).
  - Rules: VFX_PRINCIPLES §12 (impact cards can carry meaning), §7 (impact frames, focus lines), §10 (a dead beat).
- **Screen parts:** `impact` modes 1 / 2 / 3 / 4 in a pattern, `speedLines`, `chroma`, `darken`.

## Timeline (~2.8 s)
The caster dashes/punches the target from where it stands. The caster moves via `ctx.caster.group.position`
toward the target and stops 1.2 m short, then the arena resets it on the next cast.
- 0.0–0.35: 3 big translucent cyan soft `CrescentArc`s (edge white, mid `#3fd6ff`, outer `#0a3a6a`, opacity ~0.5)
  sweep across around the caster. The caster crouches (squash its group scale y to 0.85; never 0).
- 0.35: a cyan glowing ball (GlowSphere soft core + a small 4-point StarBurst) appears ON the target's head (the
  hit lands visually before the fist).
- 0.4–0.55: the caster dashes to the target in 0.12 s with hard cyan brush strokes (2–3 toon `CrescentArc`s,
  edge white, mid `#2fb8ff`, outer `#0a1428`, nearly straight, aligned with the dash) shooting in from the side.
  `speedLines` 1 (cyan `#3fd6ff`), focus on the target.
- 0.55–0.85 card sequence (use `impactFrameAt(t, 0.55, [1, 4, 3, 2, 0, 1], 0.05)`) with `impactColor` set per
  frame: frame 0 cyan `#3fd6ff` (dark frame, cyan silhouettes), frame 1 white (outline card), frame 2 cyan
  (X-ray card), frame 3 white (light frame, black silhouettes), frame 4 normal, frame 5 cyan dark frame.
  Silhouettes: caster + target. `ctx.hit(target, { damage: 62, knock: 0 })` at 0.55; the knockback is applied
  after the hit-stop.
- 0.85–1.85 hit-stop: no shake. Thin curved splash strokes (6–8 small soft `CrescentArc`s, cyan / white, fanned
  out from the contact point) appear and HANG almost frozen: animate at 5% speed for ~1 s. Horizontal smear streaks
  (2 long thin white arcs) at the contact. `darken` 0.4 with a navy tint `#0a1428`. `chroma` 0.3 steady.
- 1.85: release. Everything resumes at full speed: the splash strokes fly out and erode, the target is knocked back
  (`ctx.hit(target, { damage: 8, knock: 9 })`), a radial burst of cyan shards (an emitter plus a 10-point
  `StarBurst`, `additive: false`), shake 0.7, `chroma = chromaPulse(t, 1.85, 0.8)`.
- 1.85–2.8: cyan wisps fade, a black `SmokeBall` (small) at the contact, and a clean exit.

## Telegraphs
A line from the caster to the target (width 1.2): start 0.05, impact 0.55. A circle at the target (radius 1.8):
start 0.35, impact 0.55.

## Exaggerate
The card sequence (6 different frames in 0.3 s), the frozen hang of the splash strokes, and the delayed knockback.
