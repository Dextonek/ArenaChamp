# Hero kits: shared rules (read before any kit sheet)

The blood kit (`blood-kit.md`, code in `src/effects/parts/blood.ts`, `src/spells/targeted/hemolance.ts`,
`thornGarden.ts`, `crimsonPact.ts`, `sanguineEclipse.ts`, kit data in `src/heroes.ts`) is the template. Every new
kit follows its structure; what its review taught is written down here so the first build already passes.

## Files (one kit, one owner)
- Parts: `src/effects/parts/<theme>.ts`, exporting a palette constant (numbers and a `_CSS` string twin, like
  `BLOOD`/`BLOOD_CSS`) and the kit's pooled parts. Spells import it directly (`../../effects/parts/<theme>`).
- Spells: `src/spells/targeted/<camelName>.ts`, each exporting `<camelName>Module` with `category: 'hero: <theme>'`.
- Kit data: `src/kits/<theme>.ts` exporting `<theme>Kit: HeroKit` (type from `../heroes`), with canvas-drawn icons
  and a portrait in the kit's palette, like the blood entry in `src/heroes.ts`.
- Do not edit shared files (`parts/index.ts`, `targeted/index.ts`, `heroes.ts`, `main.ts`, `heroMode.ts`,
  `blood.ts`): the reviewer registers and wires everything.

## MOBA timing (user rule)
Q, W and E are normal abilities under the gameplay camera: the hit lands 0.4–0.8 s after the cast and the frame is
clean by about 2 s (an E aura may run ~3 s). R is the ultimate: the biggest of the four, still under the gameplay
camera (no cinematic, no letterbox), the hit around 2.0–2.5 s and clean by about 4.5 s, with one dead beat and one
short impact frame (`impactFrameAt(t, T, [1, 2], 0.04)`). Impact frames only on Q (one frame, optional) and R.

## Balance budget (from the duel tournament, 2026-10-29)
New kits start inside this budget so they need no big balance pass (check with `pipeline/tools/duel-tourney.js`):
| Slot | Damage | Cooldown | Hit lands | Notes |
|---|---|---|---|---|
| Q | ~50 single target (a multi-target Q does the same per target) | 3 s | ≤ 0.55 s after the cast | a later first hit gets dodged; keep the windup short |
| W | ~55 (or a hit + 1–2 small ticks totalling ~55) | 7 s | 0.6–0.8 s | ground zone radius 3.5–4.5 |
| E | 2 pulses × 12–15 | 9 s | first pulse ~1.0 s | self aura radius 4–6 |
| R | ~125 (or two hits totalling ~130) | 20 s | 2.0–2.4 s | ground radius 7 |
Ranges: Q 10–12, W 10–11, R 13–14. Damage lives in each spell's `default<Name>()` settings, cooldown and range in
the kit data.

## Look lessons from the blood review
- Shapes must read at gameplay distance (camera ~12–16 behind and 6–8 above): ropes and beams ≥ 0.15 wide,
  spikes chunky, threads ≥ 0.06. Thin needles and hairlines vanish.
- Every kit has a **pale foil** near its dark/saturated energy (a sigil, a moon, rime, bone, glass) and a **dark
  layer** under its brightest layer. Dark colours on the darkened floor vanish without the foil.
- No big white specular on smooth spheres (it reads as a billiard ball or a cherry): a pinpoint dot at most.
- Regular repeats read mechanical: vary widths, lengths and spacing (a comb of identical drips read as teeth).
- `StarBurst` accents small (scale ≤ 1.1, ~2 for an ultimate's centre), 2–3 frames.
- Debris, splats and flakes are capped (≤ 12 decals per spell) and gone by the end; give flake/shard pools a short
  life. Sigils with busy centres need a way to hide the centre under a pool or a big object.
- Hits: `ctx.hit(e, { damage, knock, color: <PALETTE>_CSS.body })` so the arena flash takes the kit colour.
  Few ticks (≤ 3 per spell).
- Instanced meshes: never scale an instance to exactly 0 (≥ 1e-4). Never name a GLSL variable `flat`.
- Ground decals that sit on the same plane: set `renderOrder` so the intended one is on top.
- Big ultimate objects (a hammer, a crown, a stag) are built inside the gameplay frame: ~4–9 above the ground near
  the point, visible during the build and the dead beat. The gameplay camera is 16 back and 8 up from the caster,
  looking ~3 up at the point, fov 50.
- Steam, smoke and fumes are small toon wisps with eroding edges, never smooth opaque spheres.
- A self aura's telegraph ends at its first pulse (no `until`); a long telegraph disk floods the frame.
- Things that cling to enemies (rime, goo, shells) follow the robe's outline with an irregular edge, never a straight
  cylinder.
- Pass the kit's hot or body colour as the hit `color`; a dark violet hit colour tints enemies purple for a long beat.

## Zone hits
Area spells re-check each enemy's position at the impact moment (see `overgrowth.ts` `eachInside`); never loop the
cast-time `ctx.targets` or a victim list frozen at cast, or enemies who walked out of the zone still get hit.

## Summon budget
Summon kits (wave 3-5) stay inside the numbers the summon test kit was tuned to (600 HP hero, 40-60% in the tournament):
a melee summon is 2 units of 40 HP for 6 s at 6 damage per 1 s; a ranged summon is 2 units of 35 HP for 6 s at 8 per 1.5 s;
a turret is 1 unit of 80 HP for 6 s at 10 per 1.4 s, range 8. Cooldowns 9 s (melee), 12 s (turret), 20 s (ranged ultimate).
At most 6 units per side. The AI shoots the hero first, and a unit only when nothing can be cast at the hero and the unit is
within 2.5 m.

## Verify
`npx tsc --noEmit` clean for your files. No browser: the reviewer renders contact sheets and sends notes.
