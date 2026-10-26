# Status

_Last updated: 2026-10-21_

## Done
- Vite + TypeScript + Three.js scaffold, exact versions pinned (three 0.186.1, vite 8.3.5, typescript 7.0.2).
- Particle mode: emitter with presets (fire, smoke, sparks, magic, snow), bloom + ACES tone mapping.
- Effect framework: `src/effects/types.ts` (`Effect`, `EffectModule` with `category` and `telegraphs`),
  `src/effects/common.ts` kit, registries in `src/effects/index.ts` and `src/spells/*/index.ts`. Effects are built
  lazily; a failing one shows its error in the overlay. Category dropdown: set pieces / paladin / iconic / original.
- **49 effects, all verified in the browser** (stepping the timeline via `window.vfx`):
  - Set pieces (8): divine sword, gate of babylon, meteor shower, shockwave punch, lightning strike, spiral sphere,
    energy beam, black hole.
  - Paladin (13): judgment, crusader strike, divine storm, wake of ashes, consecration, avenging wrath, divine shield,
    hammer of wrath, avenger's shield, hammer of justice, lay on hands, light of dawn, divine toll.
  - Iconic (20): fireball, pyroblast, frostbolt, blizzard, arcane missiles, chain lightning, chaos bolt, rain of fire,
    death coil, army of the dead, starfall, penance, earthquake, bladestorm, heroic leap, volley, eye beam,
    metamorphosis, spinning crane kick, deep breath.
  - Original from the user's names (4): corpse finger gravity pull, illusionist rain of doom, solar verdict,
    crown of the final star.
- **Refinement pass** (`docs/REFINE_BRIEF.md`, research in `docs/VFX_PRINCIPLES.md`) applied to every effect:
  3-stop colours, eroded wisps, size variance, dark normal-blended smoke/dust layers, GlowSphere flashes, staggered
  dissipation, soft sprites. Avenging wrath has two real wings now.
- **Emitter look options:** `colorMid`, `sizeJitter`, `erosion`, `spin`, `groundFade` (opt-in).
- **FinishPass** (`src/post.ts`): vignette, grain, chromatic aberration ∝ shake, impact-frame flash on shake jumps.
- **Danger zones + player dummy:**
  - `src/effects/telegraph.ts`: circle / ring / cone / line zones that fill as a countdown, flash on impact,
    optional lingering `until`. Every damaging effect declares `telegraphs(effect)`; heals/buffs have none.
    View → danger zones toggles them.
  - `src/player.ts`: blue player dummy (View → player dummy, WASD/arrows, camera-relative). Inside a zone at
    impact → HIT (flash + knockback), near but outside → DODGED; counts in the stats line.
- `npm run build` passes (only the >500 kB chunk warning).
- **Video tutorials → batch h** (`pipeline/library/batch-h.json`, 9 recipes, ids `h-…`): watched 7 YouTube
  tutorials in the built-in browser (full transcripts from the caption track + paused frames): onetupthree slash
  anatomy (basic/ember/frost variants) and mech explosion, Stylized Station Igni cone, Beyond-FX Zelda explosion,
  Gabriel Aguiar mesh smoke, Noggi anime wind streaks, Le Lu magic-circle textures. Techniques in
  `docs/VFX_PRINCIPLES.md` §11.
  - Incident: this batch was first written to `batch-g.json` and overwrote the other session's batch g (user
    reference videos). Moved to batch-h; the other session was asked to re-write its batch-g.json and re-run
    `build-index`.
- **Video tutorials, round 2 → batch j** (`pipeline/library/batch-j.json`, 6 recipes, ids `j-…`): Dan Root 2D
  lightning timing, CGHOW outlined stylised bolt, Gabriel Aguiar layered laser beam, A Bit Of Game Dev refraction
  bubble shield, Flex Unit swirl portal, Le Lu twisted wind tornado. Techniques in `docs/VFX_PRINCIPLES.md` §11b.
  `build-index` validates (116 recipes with a–h + j; the other session's batch i is not on disk yet).
- **Violet severance** (targeted, `enemy`, `src/spells/targeted/violetSeverance.ts`, design
  `pipeline/designs/violet-severance.md`), forged from `j-aguiar-layered-laser-beam` + `j-cghow-outlined-stylized-bolt`:
  a 3 s laser whose look is all shader layers (dark wide under-beam as an outline, scrolling streak core with
  end-fade + pinch + UV distortion, alpha-clipped electric copy). The beam cuts through the target and scorches
  the ground behind it; 10 ticks + a cut with impact frames. selfTest ok (11 hits, 1 zone, 0 NaN / singular),
  also after shuffle. One fix round: white only in the hottest centre, beam width 0.5, under-beam 2.1× core.

## In progress
- Nothing.

## Blocked
- Nothing.

## Waiting on you
- Commit of the refinement + zones + original moves work (last commit 7bd4aaa on `feat/particle-editor`; no remote).

## Known look issues (small)
- Violet severance: from the default side camera the beam is still fairly thin, and the dark outline only shows
  up close; the beam runs flat at hand height, so it passes the target at 1.5 m instead of chest height.
- Spinning crane kick: surrounding enemies still look pale under the jade light.
- Starfall's `dust` emitter is never burst (harmless).
- FinishPass impact-frame also fires on every earthquake pulse.

## Notes
- The browser pane only animates while visible; checks pause the loop (View → paused) and step with
  `vfx.step(1/60)` + `vfx.render()`. Screenshots can show a stale frame when the pane is hidden.
- Brightness rules: emissive ≤ 1, additive opacity ≤ 0.5, bloom threshold ≥ 0.8, mid-tone colours for lit surfaces,
  `setRGB`/`setHSL` are linear (pass `THREE.SRGBColorSpace`), PointsMaterial needs `softDotTexture()`.

## Next step candidates
- Export: PNG frame / WebM recording / sprite sheet (to use the effects in other engines and 2D games).
- Save/load effect settings as JSON.
- Shared `Debris` class (duplicated in ~5 spell files).
