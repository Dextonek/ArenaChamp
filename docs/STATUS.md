# Status

_Last updated: 2026-10-21_

## Done
- Vite + TypeScript + Three.js scaffold, exact versions pinned (three 0.186.1, vite 8.3.5, typescript 7.0.2).
- Particle mode: emitter with presets (fire, smoke, sparks, magic, snow), bloom + ACES tone mapping.
- Effect framework: `src/effects/types.ts` (`Effect`, `EffectModule`), `src/effects/common.ts` (sword/spear
  geometry, `Enemy`, ground), `src/effects/index.ts` registry. `main.ts` builds each effect lazily on first
  selection; a failing effect shows its error in the bottom-left overlay instead of breaking the app.
  `Emitter.burst(count, at?)` spawns at a world position.
- Set-piece effects, each verified in the browser by stepping its timeline (`window.vfx`):
  - **divine sword** — giant sword falls; ~1000-sword drill + orbit; impact, crater, scatter.
  - **gate of babylon** — wall of golden ripple portals fires swords/spears; weapons stick in the ground; final volley.
  - **meteor shower** — red sky, warning rings, diagonal meteors with fire trails, craters, final big meteor.
  - **shockwave punch** — wind-up, cone/ring air blast, dust wall, debris, enemy launched.
  - **lightning strike** — storm cloud, flickering branching bolts, flash, scorch mark, ground arcs.
  - **spiral sphere** — inward spiral streams, spinning rings, thrust, grind, burst, enemy launched.
  - **energy beam** — charge ball, layered beam with travelling rings, explosion dome, ground scar.
  - **black hole** — horizon + photon ring + accretion disk, debris/enemy pulled in and spaghettified, collapse flash.
- `npm run build` passes (only the >500 kB chunk warning).

## In progress
- WoW ability rework (user picked: Paladin first + top 20 iconic spells, own reworked style, no Blizzard assets).
  - Kit added to `common.ts`: `CASTER_POS`/`ENEMY_POS`, `createCaster`, hammer/shield geometry, `GlowSphere`,
    `LightPillar`, `createRing`, `frameArena`. Category dropdown in the panel (`EffectModule.category`).
  - Agent brief: `docs/SPELL_BRIEF.md`. Reference spell: `src/spells/paladin/judgment.ts` (verified).
  - **Paladin done (13, all verified in browser):** judgment, crusader strike, divine storm, wake of ashes,
    consecration, avenging wrath, divine shield, hammer of wrath, avenger's shield, hammer of justice,
    lay on hands, light of dawn, divine toll.
  - **Iconic done (20, verified):** fireball, pyroblast, frostbolt, blizzard, arcane missiles, chain lightning,
    chaos bolt, rain of fire, death coil, army of the dead, starfall, penance, earthquake, bladestorm, heroic leap,
    volley, eye beam, metamorphosis, spinning crane kick, deep breath.
- Original moves from the user's names (category 'original', `src/spells/original/`), agents running:
  corpse finger gravity pull, illusionist rain of doom / solar verdict, crown of the final star.
- Refinement work (user asked: refine, multi-layer depth, research VFX):
  - Research distilled into `docs/VFX_PRINCIPLES.md`.
  - Emitter look options: `colorMid`, `sizeJitter`, `erosion`, `spin`, `groundFade` (opt-in). Fire/smoke presets use them.
  - `src/post.ts` FinishPass: vignette, grain, chromatic aberration ∝ shake, impact-frame flash on shake jumps
    (note: also fires on every earthquake pulse — acceptable).
  - `softDotTexture()` in common; `setHSL`/`setRGB` are linear (documented in SPELL_BRIEF).
  - Next: commit, then refinement pass with `docs/REFINE_BRIEF.md` — pilot on divine sword, gate of babylon,
    meteor shower, shockwave punch; verify; then 4–5 effects per agent, 3 at a time.
  - Later (not now): a shared `Debris` class (duplicated in ~5 spell files).
  - `Enemy.setFlash` capped (was blowing hits out to white).
  - Known look issues to revisit: avenging wrath wings read as a radial fan; light of dawn sun glow is large.
  - Spells are added to `src/spells/*/index.ts` only after a browser check.

## Blocked
- Nothing.

## Waiting on you
- Confirm or edit the proposed WoW spell lists before agents start. Work is committed up to 719a56e on
  `feat/particle-editor` (no remote).

## Notes
- The browser pane only animates while visible; checks pause the loop (View → paused) and step with
  `vfx.step(1/60)` + `vfx.render()`. Screenshots can show a stale frame when the pane is hidden.
- Brightness rules that keep effects from blowing out: emissive ≤ 1, additive opacity ≤ 0.5, bloom threshold ≥ 0.8,
  mid-tone colours for lit surfaces (pale metal piles go white), `setRGB` values are linear (0.12 already looks grey).

## Next step candidates
- WoW-style ability kit (data-driven spell archetypes + per-class signature spells).
- Save/load effect as JSON; PNG / WebM export.
