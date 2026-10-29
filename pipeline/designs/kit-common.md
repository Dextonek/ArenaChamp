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

## Verify
`npx tsc --noEmit` clean for your files. No browser: the reviewer renders contact sheets and sends notes.
