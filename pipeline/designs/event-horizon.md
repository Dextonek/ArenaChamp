# Event Horizon (hero tier)

- **Label:** `event horizon` · **File:** `src/spells/targeted/eventHorizon.ts` · **Module:** `eventHorizonModule`
- **Targeting:** `ground`, radius 6 (it hits every enemy inside the pull radius; `ctx.point` is the hole)
- **Palette (core → hot → body → accent → dark):** black `#000000` (the hole itself) → photon ring `#ffe6b0` → accretion
  `#ff9a3a` → doppler blue side `#6ab8ff` → space dark `#06040c`
- **The shape that makes it ours:** a real black hole. A pure-black sphere, a thin bright photon ring around it, and a
  drawn accretion disk tilted toward the caster that spins fast. A permanent **gravitational lens**, a strong
  `ShockRefraction` ring hugging the hole, bends the floor and the enemies around it. This is the first spell where
  distortion is the hero, not a garnish.
- **Recipes:** `c-gnomon-charged-energy-beam` (the escalation in stages), plus whatever implosion/vortex recipes in
  `pipeline/library` fit (search "vortex", "implosion", "singularity", "gravity").
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects below the bloom
  threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Drawn assets (canvas textures, black outline, value ramp)
- **Accretion disk:** a ring texture (inner r 0.35, outer r 1) with 5–7 spiral arms of hot gas: orange bands with
  darker gaps and a thin black line between bands. Brighter on one half (doppler beaming). Use the cool `#6ab8ff`
  accent on the receding edge. Map it on a RingGeometry and spin it (~1.5 rev/s at the inner edge feel; two layers at
  different speeds for parallax). Tilt it ~20° toward the caster so it reads as a disk, not a line.
- **Photon ring:** a thin camera-facing ring sprite, a crisp line, not a glow blob. Its brightness sits just at the
  bloom threshold so it glints.
- **Hole:** a `MeshBasicMaterial` black sphere, slightly larger than the photon ring's inner edge, `depthWrite` on.
  It must read as a hole in the world.

## Distortion (the hero)
- **Lens:** a camera-facing `ShockRefraction` with a wide band (width ~0.5). Radius ≈ 2.2× the hole radius, strength
  0.05–0.07 while the hole is stable. Because it pushes outward from the centre, the scene appears pulled around the
  rim. Pulse it gently (±10 % at 1.5 Hz). Check the sign in a test frame: a positive strength samples from farther out,
  which should read as a pull; if it reads as a push, set `mesh.material.uniforms.uStrength` negative directly.
- **Infall ripples:** every 0.6 s a ground `ShockRefraction` ring runs **inward** (the radius shrinks from 7 to 1),
  strength 0.025.
- **Collapse:** a camera-facing ring that expands fast and wide (radius 1 → 14 in 0.5 s, strength 0.08 → 0).

## Timeline (~7 s)
- 0.0–0.8 **Seed.** A small dark mote drops from the caster's raised hand to the point. Where it lands, space puckers:
  the lens appears at small radius and grows. Light streaks (thin lines) bend toward it.
- 0.8–1.6 **Birth.** The hole opens (radius 0 → 1.1 with overshoot), the disk unfolds from a thin ring outward, the
  photon ring snaps on. Shake 0.15. Dust and pebbles on the floor start creeping toward it.
- 1.6–4.6 **Pull.** Enemies inside radius 6 are dragged in: `ctx.displace(e, …)` toward the hole and slightly up,
  accelerating. As they get close, stretch them toward the hole (spaghettification; scale their group along the
  pull axis up to 1.6× and squash the others to 0.75×, by scaling `target.group` (an `Enemy` from `ctx.targets`; the
  arena only drives its position). Restore scale 1 at the end, in reset and before every cast). Debris (small dark drawn rock shards)
  spirals in along the disk plane and vanishes at the photon ring with a tiny orange spark. Damage ticks: three
  ticks at 2.2, 3.2 and 4.2: `ctx.hit(e, { damage: 10, knock: 0 })`. The disk speeds up; the screen darkens slightly
  (ScreenFx darken 0.25) and desaturates a bit outside the focus.
- 4.6–5.0 **Dead beat.** Everything freezes for 0.25 s: the disk stops, there is silence, the lens strength jumps to
  0.1.
- 5.0 **Collapse.** The hole collapses to a point; then a camera-facing burst. Use impact frames (2 frames, black on
  white silhouettes), a ring of orange gas flung outward on the disk plane (a toon shell, not a white blob), the
  collapse refraction ring, and a ground ring. `ctx.hit(e, { damage: 70, knock: 10 })` for every pulled enemy,
  pushing them outward. Shake 0.7.
- 5.0–7.0 **Aftermath.** A faint residual lens fades out over 1.5 s; drifting cool-blue embers; a dark scorched ring
  on the ground (a drawn decal with a spiral scar).

## Telegraphs
A circle at the point, radius 6: start 0.0, impact 0.8, until 5.0.

## Exaggerate
The lens bending the world, the stretch of the enemies, and the freeze before the collapse.
