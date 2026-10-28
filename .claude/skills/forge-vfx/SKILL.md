---
name: forge-vfx
description: Prompt-to-effect pipeline for the VFX tool. Turns effect ideas or recipe ids from the pro-VFX library (pipeline/library) into targeted spells (src/spells/targeted) that aim at clickable enemies, then type-checks, registers and browser-verifies them. Trigger - /forge-vfx, "forge", "make new targeted effects", "build effects from the library".
---

# forge-vfx

Turns ideas into verified, targetable spells in `C:\VFXTool`. Arguments are any mix of:
- free-text ideas (`"void comet that splits into 12 shards"`),
- recipe ids from `pipeline/library/index.json` (`c-rookies-meteor-strike`),
- a query (`"3 chain lightning"`, `"5 random ground"`), which picks matching recipes from the library.

## 0. Orient
- Read `docs/ART_BIBLE.md` and `docs/STATUS.md`. Run `node pipeline/build-index.mjs` (it rebuilds and validates the library; stop if it
  fails).
- List the existing targeted spells in `src/spells/targeted/index.ts` and `pipeline/forged.json`, so you don't
  make the same spell twice.

## 1. Design (you, not an agent)
For each effect, write `pipeline/designs/<slug>.md`:
- **Name** (original, ours; not the source ability's name), **label** (lowercase), **file**
  (`src/spells/targeted/<camelCase>.ts`), **targeting** mode (+ `maxTargets` / `radius`).
- **Recipes:** 1–3 library ids it draws from. For a free-text idea, pick the closest recipes by archetype and
  element. Name the one technique taken from each.
- **Look:** the palette row from `docs/ART_BIBLE.md` §2 and the one shape that makes it ours.
- **Timeline** in seconds: anticipation → release → impact(s) → aftermath, 3–6 s total.
- **Layers** (aim for 7–10), each mapped to a kit piece: first the parts kit (`ScreenFx` darken / impact frames /
  speed lines, `StarBurst`, `CrescentArc`, `LightningArc`, `SmokeBall`), then `GlowSphere`, `Emitter`, `createRing`,
  `LightPillar`, instanced debris, custom meshes. Each has a job, a blend mode and a hot → mid →
  cool colour.
- **Hits:** when `ctx.hit` fires, for whom, with what damage and knock.
- **Telegraphs:** shapes and times.
- **Exaggerate:** the two or three things that make it "insane" (scale, multi-stage impacts, screen-filling
  shockwave, slow-mo hang before impact, ...).

## 2. Build (worker agents, at most 3 at once)
Spawn one `worker` agent per spell (run them in parallel, at most 3 at a time; queue the rest). Prompt template:

> Write one targeted spell for the Three.js VFX editor at C:\VFXTool (Windows, absolute paths).
> Read, in order: docs/ART_BIBLE.md, docs/TARGETED_SPELL_BRIEF.md, docs/SPELL_BRIEF.md, docs/VFX_PRINCIPLES.md,
> src/spells/targeted/starbreakerLance.ts (reference: copy its structure), src/spells/targeted/partsShowcase.ts
> (how to use the parts kit), src/effects/parts/*.ts, src/effects/targeting.ts,
> src/effects/common.ts, src/emitter.ts, then your design note pipeline/designs/<slug>.md and the recipes it
> names in pipeline/library/index.json.
> Write ONLY <file>, exporting `<camelCase>Module`. Do not edit any index.ts, main.ts, arena.ts or shared file.
> No git, no npm install, no dev server, no browser. Verify with `Set-Location C:\VFXTool; npx tsc --noEmit`
> (ignore errors only in files that aren't yours, and say so). Report as the brief says.

## 3. Register and check (you)
- Add one import + entry per spell to `src/spells/targeted/index.ts`.
- `npx tsc --noEmit` and `npm run build` must pass. Fix small type errors yourself; send bigger ones back to the
  worker with `SendMessage`.

## 4. Browser verification (you)
- `preview_start {name: "vfx-dev"}` (reuses the running server). Reload the page before testing: shader compile errors
  are only caught for materials compiled during `selfTest`.
- For each label: `JSON.stringify(vfx.selfTest('<label>', <duration + 1>))` must give `ok: true` (no errors, no shader errors, `nanFrames` and `singularFrames` 0), `arenaHits > 0`
  and, for damaging spells, `zones > 0`.
- Retarget test: `vfx.arena.shuffle()`, then `selfTest` again (the spell has to work in any direction). For
  `enemies` / `ground`, also try `vfx.arena.setCount(10)`.
- Look at it: `vfx.selectMode('<label>'); vfx.scrub(t)` for the anticipation, impact and aftermath times, and take
  a screenshot of each. Run the self-critique list in `docs/ART_BIBLE.md` §5 and check against the brightness rules: no white-out blobs, readable silhouettes, dark layer
  present. Fix it yourself or send it back to the worker. At most 2 fix rounds per spell, then report what's off.
- If `tabs_context` says the browser pane is hidden, screenshots show stale frames: use the contact-sheet capture
  instead (`pipeline/tools/contact-sheet.js` in the page, `pipeline/tools/decode-sheets.py` on the saved result).
- `vfx.view.paused = false` when done.

## 5. Record
- Append to `pipeline/forged.json`: `{ "label", "file", "mode", "recipes": [...], "date", "selfTest": {...} }`.
- Update `docs/STATUS.md` (the targeted spells list, known look issues, the next suggested recipes).
- Do not commit or push unless the user asks.
