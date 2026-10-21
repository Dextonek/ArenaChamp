# Refinement brief (for agents polishing existing effects)

You are refining existing effect files in `C:\VFXTool` (Three.js + TypeScript). Read first:
`docs/VFX_PRINCIPLES.md`, `docs/SPELL_BRIEF.md` (rules still apply), then each file you were assigned in full.
You cannot see the result, so apply **concrete, mechanical transformations** — not "make it look better".

## Transformations (apply every one that fits; skip ones that don't)
1. **Emitters for smoke / dust / fire / mist / ash / magic wisps:** add `colorMid` (3-stop: hot/bright →
   saturated → cool/dark), `sizeJitter` 0.3–0.5, `erosion` 0.4–0.65, `spin` 0.3–0.6. Add `groundFade` ~0.3 for
   anything that settles on or rolls along the ground (not for bursts spawned exactly at y = 0 that must show at
   birth). **Sparks and glints:** `erosion: 0`, small sizes, may add `sizeJitter` 0.3.
2. **Every `THREE.PointsMaterial`:** add `map: softDotTexture()` (import from `effects/common`).
3. **Plain additive `MeshBasicMaterial` spheres** used as flash / burst / aura / halo → replace with `GlowSphere`
   (rim for shells and shockwave bubbles, `{ rim: false }` for soft cores). Keep their timing.
4. **Dark tertiary layer:** every bright impact/explosion should have a normal-blended (`additive: false`) dark
   smoke or dust emitter with erosion behind it. Add one if missing (≤ 400 particles).
5. **Staggered dissipation:** after an impact, layers must decay at different rates —
   flash ≈ 0.1 s < shock ring ≈ 0.5 s < sparks ≈ 1 s < smoke ≈ 2–3 s < ground mark (longest). Fix any place
   where several layers share the same fade curve.
6. **Anticipation:** there must be ≥ 0.4 s of wind-up (gather / glow / rune) before the main release. If missing,
   add one by shifting the timeline (keep total duration within ±10%).
7. **Value ladder:** the hottest part should be small and near-white; bodies saturated; edges darker. If a large
   area is near-white, reduce opacity or saturate it.
8. **Ground anchoring:** something must touch the ground near every impact (decal, dust ring, light, scorch).
9. Per-file items listed in your assignment.

## Hard constraints
- Edit only the files you were assigned. Do not touch `common.ts`, `emitter.ts`, `types.ts`, `main.ts`,
  `post.ts`, any `index.ts`, or files assigned to others. No git, no npm install, no servers, no browser.
- Do not change a module's `label`, `category`, or settings keys/defaults' meaning (GUI must keep working).
  Total duration within ±10%. Keep `frameCamera` as is unless the assignment says otherwise.
- Brightness limits from SPELL_BRIEF still apply. When in doubt, lower opacity rather than raise it.
- `Set-Location C:\VFXTool; npx tsc --noEmit` must pass with zero errors in your files.

## Report (per effect) — as a checklist I can verify against the diff
```
<file>
  added:   …
  changed: …
  removed: …
  unsure:  …
```
Plus the exact tsc result.
