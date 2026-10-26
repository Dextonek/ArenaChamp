# Targeted spell brief (for agents writing targeted effects)

Read `docs/ART_BIBLE.md` first (our look, palette rows and self-critique list), then `docs/SPELL_BRIEF.md`: its style, kit, brightness and hard rules all still apply. This brief covers
what is different for **targeted** spells: effects that hit enemies or ground spots the user picks in the shared
arena, instead of the fixed caster at (0, 0, 14) and the enemy at the origin.

**Reference spell: `src/spells/targeted/starbreakerLance.ts`.** Copy its structure exactly. It is verified in the
browser: charge → arc flight → impact on the clicked enemy, with hit reactions and a telegraph.

You also get a **design note** (`pipeline/designs/<slug>.md`) that names the recipes from
`pipeline/library/index.json` the spell is built from. Read those recipes for layers, timing and colours. Build an
**original** spell in our own style: take the technique, not the look of the source game's ability. Make it more
over-the-top than the reference: more layers with clear jobs, stronger anticipation, a bigger impact, a longer
aftermath.

## The parts kit (`src/effects/parts`): use these, do not re-invent them
Usage example for every part: `src/spells/targeted/partsShowcase.ts` (browser-verified).
- **ScreenFx**: `readonly screen = createScreenFx()` on the effect, `clearScreenFx(this.screen)` in reset() and when
  the timeline ends. Set its fields in `layout()`:
  - `darken` 0..1 + `tint` (world grade);
  - `impact = impactFrameAt(t, hitTime, [1, 2])` (dark frame → light frame, 3 frames each), `impactColor`,
    `silhouettes = [ctx.caster.group, ...ctx.targets.map(e => e.group)]` (set in cast());
  - `speedLines` 0..1 + `focus` (world point) + `speedLineColor` for implode / dash / impact.
  Main renders all of it; you only set numbers.
- **StarBurst** (`points`, `inner`, `jitter`, `color`, `core`, `additive`): hard-edged camera-facing star.
  `star.set(pos, size, opacity, spin)` with `StarBurst.pop(age)` for the 2-frame pop → hold → shrink. Use
  `additive: false` for crisp toon stars (additive ones bloom into blobs at large sizes). 4 points + `inner: 0.12`
  = glint.
- **CrescentArc** (`radius`, `width`, `sweep`, `style: 'soft' | 'toon'`, `edge`, `mid`, `outer`): wind / slash /
  crescent stroke in the mesh's local XY plane. Each frame set `head` (0 → 1 + length), `length`, `erosion`,
  `opacity` and `time`. Put several in tilted parent groups for cyclones. Toon arcs are normal-blended: use bright
  mids if the screen is darkened.
- **LightningArc** (`width`, `segments`, `jitter`, `branches`, `rerollEvery`, `dropChance`, `core`, `glow`):
  thick camera-facing bolt. `setEnds(a, b)` + `opacity`, and call `arc.update(dt)` in your update().
- **SmokeBall** (`color`, `rim`, `flake`, `maxBalls`): toon black smoke balls that break into flakes.
  `trigger(pos, size, life)`, `update(dt)` in your update(), `clear()` in reset(), and push `smoke.emitter` into
  `emitters`.
- Rules from the reference videos that these parts serve: `docs/VFX_PRINCIPLES.md` §7–§9. The design note says
  which recipe each beat comes from.

## The targeting contract (`src/effects/targeting.ts`)
- The module sets `category: 'targeted'` and `targeting: { mode, maxTargets?, radius? }`:
  - `enemy`: one target, `ctx.targets[0]`.
  - `enemies`: a chain or a volley, `ctx.targets` in chain order (up to `maxTargets`, default 5).
  - `ground`: an AoE at `ctx.point`; `ctx.targets` = the enemies within `radius` (may be empty).
  - `self`: around the caster; `ctx.targets` = the enemies within `radius`.
- The effect implements `cast(ctx: CastContext)`. main.ts calls it right before **every** `play()`, including your
  own `loop` restart. Store `this.ctx = ctx` (public, `CastContext | null`) and compute all positions from it:
  `ctx.from` (caster feet), `ctx.aim` (yaw toward the target), `ctx.targetPos[i]` (feet positions snapshotted at
  cast), `ctx.point` (ground aim point, y = 0).
- **Never** use `ENEMY_POS`, `CASTER_POS`, `new Enemy()`, `createCaster()` or `createGround()`. The arena owns the
  caster, the enemies and the ground. Do not add `ctx.caster` or the enemies to your group.
- **Hit reactions:** at each impact moment call `ctx.hit(enemy, { damage, knock, from, color })`, once per enemy
  per hit. Multi-hit spells call it several times. Damage ≥ 40 shows as a big gold number. Enemies die at 0 HP
  (100 HP each). Do **not** call `setFlash` / `setCrush` on arena enemies.
- **Moving enemies** (lift, pull, juggle): `ctx.displace(enemy, offset)` every frame. It resets on every cast.
- You may animate `ctx.caster` (`group.position`, `rotation`, `material.emissive`). The arena resets it on cast.
- Before the first cast, `ctx` is null. `reset()` / `layout()` must not crash then: use fallbacks
  (`this.ctx?.from ?? new THREE.Vector3()`).
- **Telegraphs** (`telegraphs(effect)`) read `effect.ctx`, return `[]` when it's null, and use world positions
  from it. For cones and lines the yaw is `ctx.aim` or `yawTo(a, b)` from `targeting.ts` (atan2(dx, dz)), never a
  constant π.
- **frameCamera:** `if (e.ctx) frameCast(camera, controls, e.ctx, peakHeight)`, where `peakHeight` is the highest
  thing the effect draws (meteor start height, beam height, ...).
- Targets can be anywhere in x ∈ [-9, 9], z ∈ [-15, 4], and the caster is at (0, 0, 14). Anything that travels must
  work in any direction (orient with `setFromUnitVectors` / `lookAt`, not fixed rotations). Things that scale
  with distance (beams, chains, trails) must use the real distance.
- **Never give a lit mesh or instance (MeshStandard / Phong / Lambert) a zero scale**, not even on one axis. To hide
  one, use `visible = false`, or a scale of at least 1e-4 for instances. A singular matrix gives NaN normals, and
  bloom spreads them into a fully black frame. `selfTest` reports this as `singularFrames`.
- Emit particles at world positions with `emitter.burst(n, worldPos)`. Trails: burst a few every frame at the
  projectile position (see the lance).

## Verification
1. `Set-Location C:\VFXTool; npx tsc --noEmit`: zero errors in your file.
2. The orchestrator then runs `vfx.selfTest('<label>')` in the browser. It must return `ok: true`, `zones > 0` for
   damaging spells, and `arenaHits > 0`. Keep that in mind: call `ctx.hit` on time and guard against NaN
   (normalising zero vectors, dividing by zero distance when a target stands on the caster).

## Report back
File path, the label, the targeting mode, 3 lines on the timeline (with seconds), which recipe ideas you used, and
anything you're unsure of visually. Plus the exact tsc result.
