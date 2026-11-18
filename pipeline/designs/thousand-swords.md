# Thousand Swords (targeted, ground) — a rain of katanas in the showpiece's style

Asked by the user (2026-11-18), after the showpieces (`/showpiece`): "spell effects in that style, like an ultimate draw or
a thousand swords". This is the thousand swords. It is NOT Flying Sword Formation (violet sky sigil, 36 swords, one giant
sword): this one is ink, paper and red, and its swords are **katanas** (black lacquer, gold guard, red cord), many more of
them, falling in a storm, and they end as a field of blades that all burst into red ink at once.

- **Name:** Thousand Swords · **label:** `thousand swords` · **file:** `src/spells/targeted/thousandSwords.ts`, export
  `thousandSwordsModule`
- **Targeting:** `ground`, radius 5.5 (`ctx.point`, `ctx.targets` within the radius).
- **Recipes:**
  - `g-castorice-sky-rift-blade-rain`: the source tears open above first, blades rake diagonally down, then hang as scars.
  - `b-elden-ring-founding-rain-of-stars`: a staggered field of falling projectiles over time, not one volley.
  - `f-swipe-smoke-crescent-slash`: ghost arcs that linger and the sepia impact frame.
- **Look:** palette row **Blood** (core `#fff1e6`, hot `#ff3b4e`, body `#8c0f22`, accent `#bff4ff`, dark `#140306`) with the
  showpiece's foils: ink `#151012`, paper cream `#ebe8e2`, gold `#d9a43c`. The shape that makes it ours: **a huge red sun
  ring painted in the sky over the spot by one brush stroke, and the katanas drawn as katanas** (a slim curved blade with a
  white edge line, a gold oval guard, a black wrapped hilt, a short red cord), each leaving a red-white streak as it falls.

## Timeline (about 5.2 s)
| t (s) | Beat |
|---|---|
| 0.0–0.8 | **The sun.** `darken` 0.45 with a warm-red tint, `desaturate` keeping red. 9 m above the spot, tilted ~50° toward the caster, a red brush ring paints itself clockwise (toon CrescentArc, thick, `head` 0→1), then fills with a deep red disc with a lighter middle. Black ink arcs wheel round the spot on the ground. A red dashed ground circle telegraphs the radius. |
| 0.8–1.4 | **The blades appear.** Katanas fade in point-down inside the sun disc, in three rings (12 + 18 + 24 = 54 visible, more appear as they fall: total ~120 over the beat), each trembling. Thin gold arcs jump between them. |
| 1.4–3.6 | **The rain.** They fall in waves, staggered (a few every frame), slightly diagonal, accelerating; each leaves a short red-white streak (additive trail) and sticks into the ground inside the radius at a random tilt (8–25°), throwing a small ink splash (black SmokeBall puff + a red flat splat decal) and a tiny gold spark. Enemies inside take small hits on a fast rhythm (`ctx.hit` every 0.25 s on each target, small damage, small knock). Speed lines toward the spot during the heaviest wave (2.2–3.2). |
| 3.6–4.0 | **The hold.** Every stuck sword stands still in the ground; the sun ring dims to a thin line. A beat of silence. |
| 4.0 | **The burst.** All the stuck swords flash white at once and burst into red ink (many red petals/flakes via an Emitter, black ink balls via SmokeBall), impact frames `[1, 3, 2]` with silhouettes, whiteout beat, chroma pulse, a ground ring shockwave (createRing, red-gold). Final big `ctx.hit` on every target in the radius, knock outward. |
| 4.0–5.2 | **Aftermath.** Red ink splats on the ground fade; ink flakes drift down; a red square seal decal with a white 斷 (canvas texture) stamps at the centre at 4.4 s and fades by 5.2 s. |

## Layers
1. ScreenFx: darken/tint/desaturate keepHue red, speed lines, impact frames, whiteout, chroma.
2. The sun ring + disc in the sky (normal blend; red `#ff3b4e` → `#8c0f22` → dark edge `#3a0d0a`).
3. Ink arcs on the ground (toon CrescentArc, ink black with a red edge).
4. Katanas: one InstancedMesh (blade + guard + hilt + cord as one small merged geometry, or 3 instanced meshes), lacquer
   black hilt, gold guard, steel blade with a white edge (emissive a touch for the edge).
5. Falling streaks (additive, red-white, short).
6. Gold arcs between the hanging blades (LightningArc, few).
7. Ink splashes: SmokeBall (black, red rim) and flat red splat decals (normal blend, fading).
8. The burst: red petals/flakes (Emitter, normal blend so they read as red, not pink-white), gold sparks (additive).
9. Ground shockwave ring (createRing, red-gold).
10. The 斷 seal decal (canvas texture).

## Hits and telegraph
- Rain: every 0.25 s from 1.6 to 3.6 s, each target in the radius takes a small hit (small knock).
- Burst at 4.0 s: a big hit on every target in the radius, knock outward from the centre.
- Telegraph from 0.0: a red dashed circle of the radius on the ground, and the sun ring above it.

## Exaggerate
1. **The count:** around 120 katanas over the beat, the ground ends as a field of blades.
2. **The hold then the burst:** a silent second of a frozen sword field, then everything at once.
3. **The red sun overhead**, painted by one stroke, as in the showpieces.
