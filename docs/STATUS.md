# Status

_Last updated: 2026-10-28_

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
- **YouTube study (batch i):** 14 videos studied frame by frame in the browser (view only) → 28 recipes, frame
  logs in `pipeline/frame-logs/youtube-i/`, rules in VFX_PRINCIPLES §12. The library has 144 recipes.
- **New screen parts** (ScreenFx): `flashBeat` (anti-flash → whiteout), `chromaPulse` + `edgeTint`,
  `desaturate` + `keepHue`, `crack` → `shatter`, impact modes 3 (X-ray card) and 4 (outline card).
- **Forged from batch i (browser-verified):** crimson requiem (Acheron), prism overture (Chromatic Opus), neon
  fracture jab (righteous X-ray punch). The sweep of all 71 effects passes.
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

- **First art-bible batch (3 targeted spells, browser-verified, 1 art-review fix round each)**, designs in
  `pipeline/designs/`, review frames in `docs/spells/`:
  - **jade dragon ascension** (ground, jade qi row): a gold spark draws a sigil, a silk-ribbon dragon coils up to
    11 m, holds, dives head-first through the sigil; jade impact frames, ground plates, dust vortex. Second pass:
    the head is a drawn eastern-dragon profile (canvas texture: open jaw, fangs, gold eye that flares at the top,
    antlers, mane, beard, black outline, white brow edge); the body turns over for the dive.
  - **hundred lily frost** (enemies, frost row): crystal lily buds close round each enemy in order, bloom into
    cups, snap shut, then all shatter at once into petal-shaped shards.
  - **taiji thunder seal** (enemy, thunder row): a 7 m taiji seal tilted toward the caster spins up, freezes, drops
    one bolt with a black under-copy; ground discharge and toon smoke.
  - selfTest ok for all three (also after shuffle and with 10 enemies).

- **Art-bible batches 2 + 3 (18 targeted spells, all browser-verified, 0-2 art-review fix rounds each)**, designs in
  `pipeline/designs/`, one contact sheet per spell in `docs/spells/<slug>_sheet.jpg`:
  golden bell sutra (self), ink moon severance, vermilion phoenix dive, red lotus inferno, nine tail foxfire,
  paper crane blizzard, mirror ice prison, flying sword formation, thunder god drums, bamboo leaf gale,
  jade imperial seal, cloud step cyclone (self), heavenly buddha palm, golden halberd comet,
  ghost lantern procession, shadow puppet execution, spider lily soul field, taotie bronze maw.
  selfTest ok for all (0 NaN / singular frames, hits land; self-mode spells need enemies within the radius, so
  test them with the caster moved into the pack, e.g. `vfx.arena.caster.group.position.set(0,0,-1)`).
- **Reliable frame capture when the browser pane is hidden:** screenshots of a hidden pane show stale frames. Render
  frames inside the page and copy the WebGL canvas into a 2D contact sheet in the same task (paste
  `pipeline/tools/contact-sheet.js` into the page, return `'NAME:<slug>|' + _sheet(times, cam)`; the tool saves the
  large result to a file; decode it with `python pipeline/tools/decode-sheets.py <result.txt> docs/spells`).

- **Tinted arena hit flash** (2026-10-26): `ctx.hit` no longer flashes enemies bloomed white. `Enemy.setFlash(v, tint)`
  in `src/effects/common.ts` takes an optional tint (peak 0.45 x the colour, below the bloom threshold); the arena
  passes the hit's `color` (else warm orange, gold for big hits). Calls without a tint (older set pieces) keep the
  old white flash. Before/after check: `docs/spells/hit-flash-after_sheet.jpg`.

- **Open-theme batch (11 targeted spells incl. a 60 s cutscene, browser-verified via contact sheets, 0-2 fix rounds
  each)** after the user asked for "not xianxia, anything, even a 2 min cutscene" (art bible theme opened, §1/§6):
  clockwork judgement, supernova seed, kraken grasp, bifrost strike (Norse), sun disk of ra (Egypt), glitch purge,
  thornwood bloom, titan fist, jellyfish bloom, checkmate, and **genesis collapse** (~60 s cinematic ultimate:
  ascend → orbit → forge a star → hurl it → impact seen from orbit → aftermath). Sheets in
  `docs/spells/<slug>_sheet.jpg`; designs in `pipeline/designs/`.
- **Cinematic camera part** `src/effects/parts/cinematic.ts` (`createCinematic`, `sampleShots` with keyed shots, cuts,
  easing, fov, roll; letterbox bars drawn into the canvas): optional `Effect.cinematic`; main.ts renders through it
  while `active` and restores the orbit camera after each frame.

- **Open-theme batch 2 (11 targeted spells incl. a 45 s cutscene, browser-verified via contact sheets, 0-1 fix
  rounds each):** orbital lance (sci-fi), stained glass sanctum (gothic), hellfire chains (infernal), murder of crows
  (gothic horror), great wave (woodblock print), tarot judgement (occult), mammoth stampede (ice age), tesla coil
  field (steampunk), sandstorm djinn (desert, self), aurora veil (polar), and **colossus drop** (~45 s mecha
  cutscene: drop from orbit, landing, cannon charge, beam sweep, exit). Sheets in `docs/spells/<slug>_sheet.jpg`.

- **Stage upgrade (2026-10-28)** lifting every effect at once: canvas-drawn stone-slab ground with radial
  darkening (`createGround` in `src/effects/common.ts`), a gradient night-sky dome with stars and a horizon glow,
  distance fog (both off while an effect's cinematic camera runs), soft shadows from the sun on figures, a cool rim
  light, FXAA at the end of the post chain, grid off by default. Figures (`Enemy`) are now hooded robed figures with
  curved horns, a bone mask and glowing eye slits (caster: gold robe, mantle, circlet), same footprint and API
  (`material` + new `trim`, both driven by `setFlash`). All 111 registered effects pass `selfTest`; both cutscenes
  re-checked. Before/after: `docs/spells/stage/before-after_sheet.jpg`.

- **Screen distortion (2026-10-28):** `src/effects/parts/distortion.ts` (`HeatHaze`, `ShockRefraction`, `DISTORT_LAYER`)
  plus a distortion pass in `src/main.ts` (a half-res float buffer of UV offsets, bent before bloom, with a slight
  RGB split; skipped when nothing is on the layer). Fix found on the way: `ShaderPass` clones uniforms, so the buffer
  texture is re-linked after construction. Added to 15 big spells (red lotus, titan fist, phoenix dive, supernova,
  hellfire chains, colossus, clockwork, orbital lance, halberd comet, genesis, tesla, thunder drums, golden bell,
  jade seal, taiji seal); all 15 pass `selfTest`. Before/after: `docs/spells/stage/distort-before-after_sheet.jpg`.

- **Hero batch (2026-10-28), a higher bar:** three new effects, each through 2-3 contact-sheet review rounds:
  **event horizon** (a black hole with a live gravitational lens, an accretion disk, enemies dragged in and
  stretched, a freeze, then a collapse), **hyperion railgun** (an ~8.5 s cutscene: a rail cannon assembles,
  copper coils charge with heat haze, one hypersonic shot with a refraction tunnel and a muzzle shock, then it
  disassembles) and **leviathan breach** (an ~11 s cutscene: a sea dragon erupts from a whirlpool, arcs over the
  arena, a head close-up, a dive into a water crown splash). Designs in `pipeline/designs/event-horizon.md`,
  `hyperion-railgun.md`, `leviathan-breach.md`; sheets in `docs/spells/<slug>_sheet.jpg`. 114 effects registered;
  the full `selfTest` sweep passes except the known corpse-finger item below.

## In progress
- Nothing.

## Blocked
- Nothing.

## Waiting on you
- Uncommitted on `feat/particle-editor`: the distortion pass, 15 spells with distortion, the 3 hero effects,
  `index.ts`, `forged.json`, designs and sheets (commit when you want).
- Nothing. Committed on `feat/particle-editor` (no remote): a4b9d65 targeting / play mode / parts kit / pipeline,
  d89f0b7 weapons (models, auras, hero, weapon attacks).

## Known look issues (small)
- `corpse finger gravity pull` (old set piece, untouched): `selfTest` reports 19 singular frames only when run
  longer than its own length (7 s); it passes at 6.5 s. Something scales to 0 after the effect ends.
- Event horizon: the lens bends the disk's tips into two small leaf shapes at the disk ends (likely the lens bending the disk tips; kept).
- Hyperion railgun: the arena telegraph line shows as a red slab in the low cutscene shots (arena owned).
- Batch 2: mammoth spirits cover the caster at the start; the djinn could be bigger; murder of crows leaves
  heavy dark smoke at the targets; colossus drop's 12 s falling shot is a fireball more than a mech.
- Open-theme batch: glitch purge reads small at gameplay distance; jellyfish chain lightning is faint; checkmate's
  ivory tile edges catch white specular highlights; genesis collapse's orbit-impact ring blooms bright (intended
  whiteout beat) and the 43-47 s orbit shot was not re-framed after the planet grew.
- Nine tail foxfire: the cream tail tips bloom a little. Flying swords: the giant sword reads thin. Heavenly palm:
  the hand is cartoonish. Thunder drums: the converging strike is white-heavy at D.
- Jade dragon ascension: a faint glow remains where the body coil turns edge-on near the neck, and the hold glint
  briefly sits over the snout. The impact centre is still near white. The head is a camera-facing drawing, so it
  shows the same profile from every side.
- Taiji thunder seal: the strike frame still blooms white round the target for ~2 frames (partly the arena's hit
  flash, see weapon attacks). The design's nova hit on nearby enemies is not possible in `enemy` mode, so it is
  visual only.
- The red danger-zone rings dominate the ground sigils of every targeted spell (global telegraph look).
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
