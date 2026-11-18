# World Sever (targeted, one enemy) — the showpiece's draw as a spell

Asked by the user (2026-11-18), after the showpieces (`/showpiece`, Scarlet Sheath): "spell effects in that style, like an
ultimate draw or a thousand swords". This is the ultimate draw. It is NOT Thousand-Cut Iaido (a dash through many
enemies, grey time-stop) nor Ink Moon Severance: it is ONE cut, the Scarlet Sheath way: paper, ink, a red sun, a tear.

- **Name:** World Sever · **label:** `world sever` · **file:** `src/spells/targeted/worldSever.ts`, export `worldSeverModule`
- **Targeting:** `enemy` (one target, `ctx.targets[0]`).
- **Recipes:**
  - `g-dark-lord-slash`: the crouch hold before the hit, and the full-screen red hit.
  - `b-genshin-raiden-musou-isshin`: one giant cut that crosses the whole field, the world split along it.
  - `f-swipe-smoke-crescent-slash`: the monochrome (sepia) impact frame and ghost arcs that linger.
- **Look:** palette row **Blood** (core `#fff1e6`, hot `#ff3b4e`, body `#8c0f22`, accent `#bff4ff`, dark `#140306`) with the
  showpiece's foils: ink `#151012`, paper cream `#ebe8e2`, gold `#d9a43c`. The shape that makes it ours: **a red sun disc
  painted behind the caster with one brush stroke, and the tear: a long lens of burning red-gold edges opening along the
  cut, dark inside** (like Scarlet Sheath's rift, but in the world, on the ground plane, through the enemy).

## Timeline (about 4.6 s)
| t (s) | Beat |
|---|---|
| 0.0–0.9 | **Stillness.** Screen `desaturate` toward paper (keepHue red), `darken` 0.3 warm. Behind the caster a vertical red sun disc (camera-facing, ~3.2 m) is painted in by one brush stroke clockwise (a CrescentArc `toon` growing 0→1 round it, then the disc fills). Black ink arcs wheel round the caster (thin toon crescents, 8–10, rotating). The caster crouches (if the arena caster can lean; otherwise skip). |
| 0.9–1.15 | **The draw.** A white-gold StarBurst at the caster's hip (the blade leaving the scabbard), speed lines toward the caster. |
| 1.15–1.25 | **The cut.** One flash: a long thin white-red slash plane from beside the caster THROUGH the target and 6 m past it, flat across the ground at knee height (a stretched quad/CrescentArc, `head` 0→1 in 0.08 s). Impact frames `[1, 3, 2]` with silhouettes; whiteout beat. |
| 1.25–2.2 | **The still after.** Nothing moves. The cut stays as a thin glowing red line in the air. The sun disc fades to a ring. Dust motes hang. Silence (no hit yet). |
| 2.2–2.5 | **The tear.** The line opens into a lens (two red-gold burning rims parting, ~8 m long, ~1.2 m wide at the middle), dark (`#140306`) inside, gold spikes thrown off the rims, LightningArcs crawling off the edges. `crack` grows from the target, held. |
| 2.5 | **The hit.** `ctx.hit` on the target, big damage, knock along the cut's normal. Second impact frame `[1, 2]`, chroma pulse, the screen `shatter`s along the crack, shards of the tear fly. |
| 2.5–4.6 | **Aftermath.** The lens seals from both tips to the middle (gold sparks at the closing point), SmokeBall black ink smoke rolls along the cut line, red ink splatter decals on the ground (flat red discs, halftone-dotted if possible) along the line, and a red square **seal** (a flat red square decal with a white 斷 — a canvas texture) stamps onto the ground beside the target at 3.3 s and fades by 4.6 s. |

## Layers (each: job, blend, hot → mid → cool)
1. ScreenFx: desaturate/darken/keepHue red; impact frames; whiteout; speed lines; crack → shatter.
2. Red sun disc + its brush ring (normal blend; `#ff3b4e` → `#8c0f22` → `#3a0d0a` edge).
3. Ink arcs (toon CrescentArc, normal, ink black `#151012` with a red edge).
4. Draw glint (StarBurst, `additive: false`, `#fff1e6` → `#ff3b4e`).
5. The cut line (thin additive plane, white core → red; stays as a red line).
6. The tear: lens rims (additive bands, gold `#ffc247` inner → red `#ff3b4e` → dark red outer), dark inside (normal, `#140306`).
7. Rim lightning (LightningArc, gold-red) and gold spikes (thin additive triangles).
8. Ink smoke (SmokeBall, black with a red rim).
9. Ground: red ink splatters and the 斷 seal decal (normal blend, canvas texture).
10. Embers/gold sparks (Emitter, additive, small).

## Hits and telegraph
- One hit at 2.5 s on `ctx.targets[0]`: high damage (the module's tier as other ultimates), knock 2.5 along the cut's normal.
- Telegraph from 0.0: a thin red dashed line on the ground along the future cut through the target.

## Exaggerate
1. **The still before the hit**: 1.3 s between the cut and the damage, everything held.
2. **The tear across the field**: the lens is far longer than the target, as if the world itself was cut.
3. **Paper and ink**: the screen drains to a warm paper grade with only red left, and the seal stamps at the end.
