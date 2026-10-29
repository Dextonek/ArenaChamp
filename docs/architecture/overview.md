---
title: Architecture overview
tags: [architecture, main, rendering, post-processing, registry]
updated: 2026-10-29
---

# Architecture overview

How the VFX editor is put together: the one-file app shell in [main.ts](../../src/main.ts) (scene, camera, panel, effect registry, render loop, post chain, screen feedback, play mode, debug handle) and the registries that feed it. Read this first if you add an effect, change the render pipeline or script the app from a browser console.

## Source map

| Area | Files |
|---|---|
| App shell, loop, post chain, `window.vfx` | [main.ts](../../src/main.ts) |
| Particle mode (the default "particles" mode) | [emitter.ts](../../src/emitter.ts), [presets.ts](../../src/presets.ts) |
| Final screen pass (`FinishPass`) | [post.ts](../../src/post.ts) |
| Effect contract and registry | [effects/types.ts](../../src/effects/types.ts), [effects/index.ts](../../src/effects/index.ts) |
| Spell registries | `src/spells/{paladin,iconic,original,targeted,weapons}/index.ts` |
| Shared arena, targets, hits | [arena.ts](../../src/arena.ts), [effects/targeting.ts](../../src/effects/targeting.ts) (see [targeting-and-arena.md](targeting-and-arena.md)) |
| Danger zones and dodge dummy | [effects/telegraph.ts](../../src/effects/telegraph.ts), [player.ts](../../src/player.ts) |
| Hotbar (play mode) | [hotbar.ts](../../src/hotbar.ts) |
| Hero mode | [heroMode.ts](../../src/heroMode.ts), [heroes.ts](../../src/heroes.ts), `src/kits/` (see [hero-mode.md](hero-mode.md)) |

## Scene and camera

- `THREE.WebGLRenderer` with `ACESFilmicToneMapping` (applied by `OutputPass`) and PCF-soft shadow maps (only meshes that set `castShadow` cast).
- Background is `scene.background` (not `setClearColor`): the composer's render-target clear skips the sRGB conversion and washed the backdrop out.
- Lighting: `RoomEnvironment` PMREM as `scene.environment` (intensity 0.6, for metal), a hemisphere light, a shadow-casting sun `DirectionalLight`, a cool rim light behind the arena.
- Stage: `skyDome` (gradient night sky shader) and `fog` (48..150). Both are switched off in `render()` while an effect's cinematic camera is active, because cutscenes build their own space far away.
- `PerspectiveCamera` (fov 50, far 400) driven by `OrbitControls` with damping. In hero mode `controls.enabled = false` and [heroMode.ts](../../src/heroMode.ts) positions the camera itself.

## Control panel (lil-gui)

One `GUI` titled "VFX Tool": **category** and **mode** dropdowns, a **preset** dropdown (particle mode only), folders View (pause, time scale, grid, play mode, hero mode, hero pick, danger zones, player dummy), Targets (enemy count, shuffle, clear selection; shown for targeted effects and in play mode), Bloom, Emission, Motion, Appearance. Each built effect adds its own folder (`play`, `frame camera`, plus `module.buildGui`). `setModeOptions` swaps the mode list; lil-gui's `options()` rebuilds the controller, so the code moves it back under the category dropdown.

## Registries and categories

`effectModules` in [effects/index.ts](../../src/effects/index.ts) is the single ordered list the dropdowns are built from:

1. eight set pieces defined in `src/effects/*.ts` (divine sword, gate of babylon, meteor shower, shockwave punch, lightning strike, spiral sphere, energy beam, black hole);
2. `paladinModules`, `iconicModules`, `originalModules`, `targetedModules`, `weaponModules` from `src/spells/*/index.ts`.

Adding an effect means one import and one array entry in the matching registry. Each array is in dropdown order.

Categories come from `EffectModule.category` (default `'set pieces'`, which also holds the built-in `'particles'` mode). Categories actually in use:

| Category | Where it comes from |
|---|---|
| `set pieces` | the eight `src/effects/*.ts` modules, plus `particles` |
| `paladin` (13), `iconic` (20), `original` (4) | `src/spells/paladin`, `iconic`, `original` |
| `targeted` | most of `src/spells/targeted/` (aim at arena enemies, `targeting` set) |
| `hero: blood`, `hero: forge`, `hero: frost`, `hero: astral`, `hero: alchemy` | four spells per hero kit, also registered in `targetedModules` (see [hero-mode.md](hero-mode.md)) |
| `parts kit` | `partsShowcase` in `targeted/` |
| `weapons` | five weapon idle auras (see [the weapons kit](effects-and-parts.md#weapons-kit-srceffectsweapons)) |
| `weapon attacks` | five weapon strikes in `src/spells/weapons/strikes/` |

`targetedModules` therefore holds 89 entries, including the 20 hero-kit spells and the parts showcase.

## Effect slots: lazy build, `setMode`, `active`

`slots` maps each module label to an `EffectSlot { module, effect?, folder?, error? }`.

- **`ensureEffect(slot)`** builds on first use: `module.create()`, then wraps `effect.play` so every play (including an effect's own loop restart) runs the same sequence: call `effect.cast(arena.context(targeting))` for targeted modules, `placeEffect(...)`, the original `play()`, then `onEffectPlay` (restarts `effectClock`, loads the module's `telegraphs`, tells the dummy). It then hides the group, adds it to the scene, scales its emitters, and creates the panel folder. A throwing `create()` is caught and stored in `slot.error` (shown red in the stats overlay), so one broken effect cannot take down the app.
- **`setMode()`** reads `mode.name`: hides every non-lingering effect group and folder, sets `active`, clears zones, toggles particle-mode widgets, shows the arena and Targets folder for targeted effects or play mode, copies `module.bloom` into the live bloom settings, builds and shows the effect, and plays it. Targeted effects play first (they learn their targets in `play()`) and then frame the camera; others frame then play. In play mode the camera is left with the caster.
- **`active`** is the one slot whose effect is stepped and framed. `selectMode(label)` picks any effect by label from any category (syncs the dropdowns); re-selecting the active one just replays it.
- **`lingering`** (a `Set<EffectSlot>`) is used by hero mode only. While `keepLingering` is true, `setMode` moves the previous `active` slot into `lingering` if it is still `playing`, so casts overlap like in a MOBA. `step` updates lingering effects and drops them when they stop; `setMode` removes a slot from the set when it becomes active again; leaving hero mode calls `dropLingering()`. `liveEffects()` returns the active effect plus visible lingering ones and feeds shake, screen feedback and the distortion check.
- `arena.onPick` replays the active effect when a click changes the target.

## Render loop

`renderer.setAnimationLoop` each frame: clamp `dt` to 0.1 s; unless `view.paused`, `step(dt * timeScale)`; `controls.update()` (not in hero mode); `render()`; update hotbar progress (`effect.duration` over `effectClock`); refresh the stats overlay every 0.5 s.

**`step(dt)`**: update the particle `emitter` when no effect is active, else `active.effect.update`; update every lingering effect (removing finished ones); advance `effectClock` and the telegraph layer; `walk(dt)` in play mode (not hero mode); `arena.update` when visible; `heroMode.update`; `player.update(dt, effectClock, zones)`.

**`render()`**:
1. If the active effect's `cinematic.active`, save the camera and render through the scripted position/target/roll/fov (sky and fog off).
2. Camera shake: the max `shake` of live effects becomes a random per-frame offset (removed after the frame, so OrbitControls keeps the real position); `finish.update(shake)`.
3. Pick one `ScreenFx` (below) and project its `focus` to UV.
4. `renderDistortion()`, then `renderSilhouetteMask()` if the screen state is an impact frame, then `finish.setScreen(...)`.
5. `composer.render()`; undo shake; if cinematic, `drawLetterbox` (bars drawn straight into the canvas, so frame captures include them) and restore the camera.

## Post chain

Order in the `EffectComposer`:

| # | Pass | Role |
|---|---|---|
| 1 | `RenderPass` | the scene |
| 2 | distortion `ShaderPass` | bends the frame by the distortion buffer (`uOn` 0/1), with a small per-channel split |
| 3 | `UnrealBloomPass` | settings from the active module's `bloom` / the particle preset |
| 4 | `OutputPass` | ACES tone mapping and output colour space |
| 5 | `FinishPass` ([post.ts](../../src/post.ts)) | vignette, grain, shake-driven chromatic aberration and flash, and all `ScreenFx` features |
| 6 | `FXAAShader` pass | last, because the composer targets have no MSAA; its `resolution` uniform is set in `resize()` |

`ShaderPass` clones uniforms, so `distortPass.uniforms.tDistort.value` is re-linked to `distortTarget.texture` after construction.

## Distortion layer

`DISTORT_LAYER = 6` ([parts/distortion.ts](../../src/effects/parts/distortion.ts)). Distortion meshes (`HeatHaze`, `ShockRefraction`) sit only on that layer, so the normal pass never draws them. `renderDistortion()` first scans `liveEffects()` for any visible object whose `layers.mask === 1 << DISTORT_LAYER`; with none (and no leftover from the previous frame) it only sets `uOn = 0` and returns. Otherwise it renders the scene with `camera.layers` set to that layer, background and fog off, into a half-resolution `HalfFloatType` target cleared to transparent black. The additive output is a signed UV offset, so overlapping fields add. Background, fog, layer mask and clear colour are restored afterwards.

## Screen feedback (`ScreenFx`)

An effect owns an optional `screen: ScreenFx` ([parts/screen.ts](../../src/effects/parts/screen.ts)) and sets its fields in `update()`, like `shake`. `pickScreen(effects)` chooses one state per frame when several effects overlap: any state with `impact > 0` scores +10, otherwise the sum of `darken + whiteout + speedLines + desaturate + chroma + crack` decides. The winner's `focus` is projected to screen UV and passed to `FinishPass.setScreen`.

**Impact-frame silhouettes:** for `impact > 0`, `renderSilhouetteMask(fx.silhouettes)` enables `SILHOUETTE_LAYER = 7` on the listed objects and their children, then renders the scene to a half-size `maskTarget` with `overrideMaterial` = flat white, black background and only layer 7 visible. `FinishPass` reads the mask as `tMask` to draw dark / light / X-ray / outline cards.

## Cinematic camera

Effects may set `cinematic` ([parts/cinematic.ts](../../src/effects/parts/cinematic.ts)). While `active`, `render()` renders through it and draws letterbox bars (2.39:1 at `letterbox = 1`), then restores the orbit camera. Only the **active** effect's cinematic is read (and only while its group is visible), not lingering ones.

## Play mode

`P` toggles `setPlayMode`. On: the dummy is switched off (one walker at a time), `arena.homeCaster()`, camera placed behind/above the caster, hotbar shown, then `setMode()`. WASD / arrows move the caster through `walk(dt)` at 9 units/s relative to the camera heading; the camera and orbit target follow the caster by the same delta. Digits 1-5 cast hotbar slots ([hotbar.ts](../../src/hotbar.ts), defaults `tempest lattice`, `gale bullet`, `cinder bow`, `ember comet`, `starbreaker lance`); casting from the hotbar outside play mode turns it on. `Space` replays the active effect; `H` toggles hero mode (which implies play mode).

`placeEffect(effect, onCaster)` moves non-targeted effects (authored around `CASTER_POS` facing -Z) onto the arena caster, rotated toward the current target, and hides the effect's own child named `ground`; the telegraph group gets the same transform. Targeted effects are called with `onCaster = false` (identity transform) and read positions from the cast context instead.

## Danger zones and the dummy

`TelegraphLayer` draws `module.telegraphs(effect)` on every play; `PlayerDummy` (WASD, toggled in View) is tested against the zones. Details: [targeting-and-arena.md](targeting-and-arena.md).

## Hero mode wiring (summary)

`setHeroMode(on)` sets `keepLingering`, turns on play mode, hides the hotbar, resets the arena, disables orbit controls, enables `HeroMode` and applies kit bloom `{ enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 }`. Full description in [hero-mode.md](hero-mode.md).

## `window.vfx` debug handle

Assigned at the bottom of [main.ts](../../src/main.ts). Typical use: `vfx.selectMode('<label>')`, `vfx.scrub(t)`, screenshot.

| Member | What it is |
|---|---|
| `selectMode(label)` | select and play any effect by label (throws on unknown label) |
| `mode`, `setMode()` | set `vfx.mode.name = '<label>'` then call `vfx.setMode()` (does not sync the category dropdown; prefer `selectMode`) |
| `scrub(t)` | pauses, replays the active effect, steps it to `t` seconds at 60 fps, renders |
| `step(dt)`, `render()` | advance the simulation / draw one frame manually |
| `selfTest(label, seconds = 6)` | automated check used by the forge-vfx pipeline: plays paused at 60 fps, collects shader compile errors, build/runtime exceptions, frames with non-finite transforms (`nanFrames`), lit meshes with zero-scale matrices (`singularFrames`; they give NaN normals that bloom spreads over the frame), peak shake, zone count, arena hits and emitter count. Returns `{ label, ok, errors, nanFrames, singularFrames, frames, maxShake, zones, targeted, arenaHits, emitters }` |
| `slots` | the `Map<label, EffectSlot>` |
| `effect` (getter) | the active effect object |
| `arena`, `player`, `telegraphs`, `hotbar` | the shared subsystems |
| `setPlayMode(on)`, `setHeroMode(on)`, `heroMode`, `heroPickCtrl` | mode switches; `heroPickCtrl.setValue('<hero name>')` changes the hero |
| `emitter`, `controls`, `bloom`, `view` | particle emitter, OrbitControls, live bloom settings, `{ paused, timeScale, showGrid }` |

## See also

- [Effects and parts](effects-and-parts.md): the `Effect` contract and the shared parts
- [Targeting and arena](targeting-and-arena.md)
- [Hero mode](hero-mode.md)
- [Models pipeline](models.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md), [VFX principles](../VFX_PRINCIPLES.md)
