# Status

_Last updated: 2026-10-26_

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
- **Targeting + arena** (`src/effects/targeting.ts`, `src/arena.ts`): optional `EffectModule.targeting` and
  `Effect.cast(ctx)`. A shared caster and 1–10 clickable enemies (100 HP, damage numbers, knockback, death). Click
  an enemy (shift = add) or the ground to aim. View → Targets panel: enemy count, shuffle, clear selection.
- **Play mode** (P / View → play mode): WASD walks the caster, the camera follows, and mouse drag orbits. The hotbar
  (`src/hotbar.ts`) casts slots 1–5; click a slot name to assign any effect (localStorage). Non-targeted effects
  are moved onto the caster and turned toward the target (their own ground is hidden).
- **Pipeline `/forge-vfx`** (`.claude/skills/forge-vfx/SKILL.md`, brief `docs/TARGETED_SPELL_BRIEF.md`): design
  note → worker agents → register → `vfx.selfTest` → screenshots → `pipeline/forged.json`.
- **Recipe library** `pipeline/library/`: 54 pro VFX breakdowns (batch a: hero games, b: ARPG/MMO, c: artist
  breakdowns). `node pipeline/build-index.mjs` merges and validates. Most sources are wiki or overview pages, so the
  timings are estimates. Pro polish rules were added to `docs/VFX_PRINCIPLES.md` §6.
- **Targeted spells (4, browser-verified):** starbreaker lance (reference, enemy), glacial ricochet (enemies),
  cataclysm sigil (ground), abyssal gaze (enemy, channel).
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
- `vfx.selfTest(label)` also reports `singularFrames` (a zero-scale lit mesh → NaN normals → black bloomed frame).
- **User reference videos → library:** 21 videos broken down by frame (ffmpeg contact sheets) into batches d–g
  (47 recipes; the library now has 101). Their style rules are `docs/VFX_PRINCIPLES.md` §7–§10.
- **Parts kit** `src/effects/parts/` (usage example: `parts showcase`, category "parts kit"):
  - `ScreenFx` on `effect.screen`: world darken + grade, anime impact frames with flat silhouettes (mask render on
    layer 7 in main.ts), and focus lines (`src/post.ts`);
  - `StarBurst`, `CrescentArc` (soft / toon wind and slash strokes), `LightningArc` (thick, camera-facing,
    flicker), `SmokeBall` (toon black smoke → flakes).
- **Spells forged from the user's videos (browser-verified):** tempest lattice (John Kler lightning cage), gale
  bullet (seo wind bullet), cinder bow (Fuga), ember comet (html meteor).
- **Violet severance** (targeted, `enemy`, `src/spells/targeted/violetSeverance.ts`, design
  `pipeline/designs/violet-severance.md`), forged from `j-aguiar-layered-laser-beam` + `j-cghow-outlined-stylized-bolt`:
  a 3 s laser whose look is all shader layers (dark wide under-beam as an outline, scrolling streak core with
  end-fade + pinch + UV distortion, alpha-clipped electric copy). The beam cuts through the target and scorches
  the ground behind it; 10 ticks + a cut with impact frames. selfTest ok (11 hits, 1 zone, 0 NaN / singular),
  also after shuffle. One fix round: white only in the hottest centre, beam width 0.5, under-beam 2.1× core.
- The world-darken curve keeps bright mids (fire, glows) bright: `smoothstep(0.22, 0.6, lum)` in `src/post.ts`.
- `selfTest` now also renders during the timeline and reports shader compile errors.
- Fixed the zero-scale lit instances in 8 older effects (gate of babylon, meteor shower, black hole, pyroblast,
  frostbolt, earthquake, volley, metamorphosis): hidden instances use scale 1e-4. The sweep of all 54 effects passes.
- `npm run build` passes (only the >500 kB chunk warning).
- **Weapon models (5, Blender)** from `C:\projectG\weapons\`: dragon sword, ice sword, guandao, thunder hammer,
  fire fan → `public/models/weapons/*.glb` (14–30k tris, plain glTF, origin at the grip, head +Y in three).
  Build scripts `blender/weapons/` (`_wp.run("<id>")`), renders `docs/weapons/`, conventions + per-weapon VFX
  notes in `public/models/weapons/README.md`.
- **Weapon auras (5, browser-verified, category "weapons")** made with /forge-vfx from the user's Spiderlily
  reference: phoenix fan (reference, hand-written), frost lily sword, azure dragon sword, thunder drum hammer,
  green dragon crescent. Kit `src/effects/weapons/` (WeaponModel: GLB load + darken + fresnel rim; FlowRibbon;
  StarFlare; LilyBurst; PetalSwarm; PolylineSpawner; sockets), base `WeaponAura` + `weaponModule`, brief
  `docs/WEAPON_AURA_BRIEF.md`, designs in `pipeline/designs/`, entries in `pipeline/forged.json`. All selfTest ok
  (0 NaN / singular frames); idle loops of 4 s (hammer 3 s) with a one-time ignition.
- **Weapon attacks (5, browser-verified, category "weapon attacks")**: a rigged hero
  (`public/models/figures/hero.glb`, the Azure Cloud disciple copied from the Dao Archive, meshopt, scaled ×1.3)
  replaces the capsule caster, holds the weapon with its aura and attacks the arena enemies: azure dragon slash,
  frost lily thrust, green dragon sweep (enemies), thunder drum slam, phoenix gale (enemies, ranged). Framework
  `src/effects/weapons/hero.ts` (bone posing, calibrated hand grip) + `strike.ts` (key poses, dash, capsule
  hide/restore via the group's `visible`, hits, telegraph, close camera); `BladeTrail` in the kit. Design
  `pipeline/designs/weapon-attacks.md`. Verified: selfTest ok + after shuffle, mode switch restores the capsule,
  play mode (hero follows WASD, hotbar casts).

- **Art bible** `docs/ART_BIBLE.md` (2026-10-26): the target look (lacquer, gold, jade + hard anime light),
  material and per-element palettes with hex codes, shape language, reference set, the artist's workflow and
  self-critique list, and the taste calls made (§6, waiting on the user's yes/no). Linked from the forge-vfx skill,
  both briefs and the README. **Read it first in a new session.**

## In progress
- Nothing.

## Blocked
- Nothing.

## Waiting on you
- Nothing. Committed on `feat/particle-editor` (no remote): a4b9d65 targeting / play mode / parts kit / pipeline,
  d89f0b7 weapons (models, auras, hero, weapon attacks).

## Known look issues (small)
- Weapon auras: the ice sword's frost ring reads a bit heavy from the low front camera; hammer eye/bell flares are
  depth-test-off sprites and show through the head from behind (turntable). Kit wish: a `reveal` / travelling-band
  uniform on `FlowRibbon` (the dragon sword and guandao fake it with group scaling and overlapping pieces).
- Weapon attacks: the arena's hit flash (white, bloomed) briefly swallows the impact VFX on the enemy; the hero
  slides during the dash (no leg walk cycle); poses are hand-keyed (no IK), so the off-hand never touches the weapon.
- Glacial ricochet / abyssal gaze: the lightning arcs are 1px lines and read thin.
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
- Run `/forge-vfx` on more video recipes: `d-kler-1-singularity-*` (black hole), `g-castorice-*` (cutscene finishers
  need a scripted camera, which the kit does not have yet), `f-swipe-*` (smoke slashes), `g-dark-lord-slash`.
- A cutscene camera part (shot list: close → wide → ground → held reveal, whip-pan smears) for the §10 finishers.
- Forge the new tutorial recipes, e.g. `h-onetupthree-ember-blade-slash`, `h-beyondfx-botw-bomb-explosion`,
  `h-onetupthree-mech-self-destruct`, and from batch j `j-lelu-twisted-wind-tornado`, `j-cghow-outlined-stylized-bolt` (the black outline also fixes the thin-arc issue).
- Run `/forge-vfx` on more library recipes, e.g. `5 random ground`, `a-lol-ashe-enchanted-crystal-arrow`,
  `b-genshin-raiden-musou-isshin`, and on the user's reference videos (batch d).
- Export: PNG frame / WebM recording / sprite sheet (to use the effects in other engines and 2D games).
- Save/load effect settings as JSON.
- Shared `Debris` class (duplicated in ~5 spell files).
