# Cinder Bow

- **Label:** `cinder bow` · **File:** `src/spells/targeted/cinderBow.ts` · **Module:** `cinderBowModule`
- **Targeting:** `enemy`
- **Recipes (user reference video, "Fuga" by A):**
  - `g-fuga-fire-arrow-pillar`: a flat horizontal disc of flame ribbons whips around the caster with white wind
    streaks, flame spikes flicking up and black curls spat out. A thin golden ring snaps open as the "bow", a fan of
    black-red ribbon curls fires, and a tall narrow white-yellow fire pillar erupts at the target with flame petals
    at the base. It collapses into licking tongues and leaves a scorch.
  - Rules: VFX_PRINCIPLES §10 ("turn the axis at the impact": horizontal charge → vertical pillar; one perfect clean
    shape inside the noisy charge; a dead beat between two hits), §7 (black is a colour; impact frames), §9 ("cool
    on warm only at the exact hit": a blue-white StarBurst at the pillar base for 2–3 frames).

## Timeline (~4.6 s)
- 0.0–1.9 charge: 4 `CrescentArc`s (style 'soft', edge `#fff2b0`, mid `#ff9a20`, outer `#ff4a10`) lying almost flat
  around the caster at waist height (radius 1–1.4, tilt ±10–15°), sweeping round at ~2 rev/s (re-sweep head
  0 → 1.35 repeatedly). White wind streaks: a few thin soft white CrescentArcs on slightly bigger radii, or a
  velocity trail emitter. Every 0.3 s a short vertical flame spike flicks up (a small additive GlowSphere/flame
  emitter burst). Black scrap curls: a normal-blended dark Emitter (spin 6, drag 2, gravity 3). `screen.darken`
  0.5 with a warm-dark tint `#3a1a14`.
- 1.9 bow: a thin golden ring (createRing, inner 0.94, about 1.5 m) stands vertical in front of the caster, facing the
  target. It snaps from 0 to full in 1 frame, holds 0.3 s, and is the only clean shape. The charge arcs stop.
- 2.2–2.3 dead beat: no VFX change, everything holds.
- 2.3 release: a fan of 5 large black-red toon CrescentArcs (style 'toon', edge `#ff5a1a`, mid `#8a1a0a`, outer
  `#0a0303`) sweeps out toward the target in 0.2 s, then curls and erodes. A fast small fireball streak flies to the
  target in 0.15 s with a trail. `screen.speedLines` 0.6 for 0.15 s, focus on the target.
- 2.45 impact at the target: one impact frame `impactFrameAt(t, 2.45, [2], 0.05)` with `impactColor` `#ffe070`
  (bright gold screen, black silhouettes). Then a tall narrow pillar: `LightPillar` (radius 0.5, height 14) with
  white-yellow colour, rising in 2 frames, width flickering 0.8–1.2 every 3 frames, held ~1.4 s. Plus a second, wider
  dim orange pillar behind it. At the base: a blue-white `StarBurst` (12 points, `additive: false`, `#cfe8ff` /
  white) for 3 frames only (cool on warm), flame petals (additive emitter, spin, up-velocity 6, drag 1.5), black-red
  curls (normal emitter), a GlowSphere, and a ring shockwave. `ctx.hit(target, { damage: 55, knock: 3 })` and lift
  with `ctx.displace` up to 2.5 over the pillar's life, dropping at the end. Small tick hits
  (`damage: 6, knock: 0`) every 0.3 s while it burns. Shake 0.6, then 0.1 while it holds.
- 3.85–4.6: the pillar collapses into a few licking flame tongues in ~0.3 s. A dark scorch disc (normal blend,
  radius 3) fades. A grey normal-blended dust swirl keeps spinning slowly after the colour has drained.

## Telegraphs
A line from the caster to the target (width 1.4): start 1.9, impact 2.45. A circle at the target (radius 2.2):
start 0.3, impact 2.45, until 3.85.

## Exaggerate
The pillar height (more than 5× the character), the single clean golden ring, the dead beat, and the cool star at
the base.
