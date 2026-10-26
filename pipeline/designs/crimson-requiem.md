# Crimson Requiem

- **Label:** `crimson requiem` · **File:** `src/spells/targeted/crimsonRequiem.ts` · **Module:** `crimsonRequiemModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Recipes (YouTube, Divergent Vfx "Acheron Ultimate"; frame log `pipeline/frame-logs/youtube-i/3KIzXAukn5I.md`):**
  - `i-acheron-petal-wipe-monochrome-slashes`: the colour drains to grey except red. A red blade is drawn, petals
    orbit, a giant petal wipe crosses the screen, a white crescent-moon arc stands behind the targets, then red
    laser slashes and flower-shaped hit stars.
  - `i-acheron-crack-web-shatter-finisher`: a full-screen red crack web appears in one frame and holds completely
    still ~1.35 s, then light rays, two focus-line frames (red on black, white on black), the screen shatters, and a
    pink-red wash fades into a cream whiteout.
  - Rules: VFX_PRINCIPLES §12 (drain the colour and keep one hue; crack, freeze, shatter; anti-flash), §7 (impact
    frames).
- **Screen parts:** `desaturate` + `keepHue` `#ff2030`, `crack`, `shatter`, `impact` patterns, `flashBeat`,
  `chroma`.

## Timeline (~6.0 s)
- 0.0–0.8 drain: `desaturate` ramps 0 → 1 (keep red `#ff2030`), `darken` → 0.6 (tint `#2a2a32`). A thin red line
  is drawn upward from the caster's hand (a long thin red `CrescentArc`, toon, sweep small, standing vertical) as
  the blade. A grey toon spiral (3 `CrescentArc`s lying flat) forms at the caster's feet.
- 0.8–1.6 petals: 18 red petal shapes orbit the caster (instanced flat petals, normal-blended glossy red
  `#e8283a` with dark `#6a0010` edges via a 2-band toon shader or MeshBasic; scale ≥ 1e-4), rising and widening.
- 1.6–1.9 petal wipe: the petals rush toward the camera (move each petal along the camera direction toward the
  camera and scale up) so for ~0.15 s they fill the frame. `speedLines` 0.6, red.
- 1.9 the world returns (still monochrome): a big white crescent-moon arc (a soft white `CrescentArc`, radius
  ~5, standing upright behind the target centroid, facing the camera side) appears and stays.
- 2.1–3.2 slashes: for each target in order, a thin straight red laser (a `LightningArc` with jitter 0.005,
  branches 0, core white, glow `#ff2030`, width 0.12) flashes from the caster's blade tip to the target for
  3 frames, plus a red 6-point `StarBurst` "flower" (inner 0.45, `additive: false`, `#ff2030` / white core) and
  `ctx.hit(e, { damage: 14, knock: 1, color: '#ff4050' })`. Hits are 0.18 s apart, plus 2 extra horizontal laser
  streaks across the screen area at 2.9 and 3.0. `chroma = chromaPulse(t, hitTime, 0.5)` on each hit.
- 3.3 crack: in ONE frame `crack` jumps to 1, with `focus` at the target centroid (y 1.2). Everything freezes: hold
  all motion (stop the petals, stop the moon, no shake) for 1.3 s.
- 4.6 rays and frames: `impact = impactFrameAt(t, 4.6, [1, 1, 3, 2], 0.05)` with `impactColor` red `#ff1a2a`, then
  white; set `impactColor` per frame. Focus lines at 1.
- 4.8 shatter: `shatter` 0 → 1 over 0.5 s (the crack stays 1). Big red `StarBurst` on every target,
  `ctx.hit(e, { damage: 55, knock: 8, from: centroid })`, shake 0.8.
- 5.3–6.0 exit: `whiteColor` `#fde8dc`. Use `flashBeat(t, 5.3, 0.25, 0.45)` for an anti-flash → cream whiteout,
  and drop crack, shatter and desaturate to 0 under the whiteout. Red petals drift down when the whiteout clears.

## Telegraphs
One circle (radius 1.6) per target: start 0.2, impact = that target's slash time. Plus one circle at the centroid
(radius = spread + 1.5): start 3.3, impact 4.8.

## Exaggerate
The colour drain (only red survives), the dead-still 1.3 s crack hold, and the shatter into the cream whiteout.
