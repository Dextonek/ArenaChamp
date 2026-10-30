# Status

_Last updated: 2026-10-29_

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
- **Cinematic hero batch (2026-10-28):** three fully cinematic hero effects (every second a placed shot,
  letterbox, explicit cameras), each through 2-3 contact-sheet review rounds: **ghost galleon broadside**
  (~24 s: a spectral galleon sails out of a fog bank, two rippling broadsides of ghost-fire cannonballs, sinks into
  the stone like water), **ophanim descent** (~22 s: three bronze wheels covered in eyes descend through a cloud
  hole, all eyes open, wings unfold, a cascade of eye beams and a converged final beam) and **caldera awakening**
  (~22 s: a stamp, a racing crack, a basalt volcano grows from the floor, a lava fountain, lava bombs, lava rivers
  and an ash cloud). Designs in `pipeline/designs/ghost-galleon-broadside.md`, `ophanim-descent.md`,
  `caldera-awakening.md`; sheets `docs/spells/ghost-galleon_sheet.jpg`, `ophanim_sheet.jpg`, `caldera_sheet.jpg`.
  117 effects registered; the full `selfTest` sweep passes.
- **Seven more cinematic heroes (2026-10-28):** **lunar tide** (the moon rises huge, lifts the enemies, cracks and
  drops a shard), **thousand-cut iaido** (time-stop to greyscale, a dash between enemies with afterimages, the
  sheath click, then every cut appears at once), **abyssal angler** (the arena sinks into the deep sea, a lure, a
  silhouette reveal, the jaws snap), **world tree rising** (a colossal tree grows from a seed, roots coil the enemies,
  fruit falls, autumn), **supercell** (a wall cloud, a tornado lifts the enemies, a bolt down the funnel, hail),
  **hourglass of ages** (a brass hourglass traps the enemies in sand, time reverses, the glass shatters) and
  **midnight circus** (a big top rises, the lights go down, spotlights, a jack-in-the-box lunges, confetti and a
  curtain). Each went through 2-4 contact-sheet review rounds. Designs in `pipeline/designs/<slug>.md`, sheets in
  `docs/spells/` (lunar-tide, iaido, angler, world-tree, supercell, hourglass, midnight-circus). 124 effects
  registered; the full `selfTest` sweep passes. One real bug found and fixed on the way: a GLSL variable named
  `flat` (reserved) broke Lunar Tide's moon-glow shader on first compile.
- **Blood hero kit (Vesper, the Crimson Countess)**, the first four-spell hero kit, MOBA style (user: Q/W/E are
  normal abilities, R is the ultimate, all under the gameplay camera). Kit sheet `pipeline/designs/blood-kit.md`
  (palette, shapes, materials, timings), new art-bible palette row "Blood" (foil: bone). Shared parts in
  `src/effects/parts/blood.ts`: `BLOOD`/`BLOOD_CSS`, `BloodTendril`, `BloodDrops` (+`BloodSplats`), `BloodPool`,
  `BloodThorns` (`shatter(perSpike, speed, life)`), `BloodSigil` (`inner: false` hides the centre marks).
  Spells (category `hero: blood`): **hemolance** (Q, `enemy`, hit 0.55 s), **thorn garden** (W, `ground` 4.5,
  hit 0.75 s), **crimson pact** (E, `self` 6, two heartbeats, loopable), **sanguine eclipse** (R, `ground` 7,
  bleeding moon, blood sphere freezes into a thorn-star, hit 2.4 s, 4.5 s total). 2-3 contact-sheet rounds each;
  sheets in `docs/spells/` (hemolance, thorn-garden, crimson-pact, sanguine-eclipse). 128 effects registered;
  the full `selfTest` sweep passes.
- **Hero balance pass**: spell damage and cooldowns tuned with AI vs AI tournaments (`pipeline/tools/duel-tourney.js`,
  `_tourney(5)` = 100 fights). Win rates over 200 fights: Vesper 57%, Brannoc 53%, Lyra 48%, Isolde 46%, Vex 46%
  (before: 88 / 67 / 8 / 50 / 38). Starshot's first hit moved 0.75 → 0.52 s. Numbers in `docs/catalog/heroes/README.md`.
- **Play / run duel** (user 2026-10-29): **play duel (B)** you vs the AI, **run duel (N)** AI vs AI with a ring
  camera and a "<HERO> WINS" card. Both sides share the AI (`pickSpell`, `steer`; the player's hero through hero
  mode's `autoCast` with `spectate` and `focus`), and both sides dodge (arena `hitFilter` checks the opponent
  against the player's recent cast zones). All 20 matchups × 3 runs (AI vs AI, by stepping): Vesper 21/24 wins,
  Brannoc 16/24, Isolde 12/24, Vex 9/24, Lyra 2/24; no timeouts; fights 15–43 s. Lyra is far behind (her AI holds
  ~8.4 away, so Orbit Veil never fires, and Starshot's 45 damage is meant for three targets).
- **1v1 duel** (B, or View → duel; `src/duel.ts`, `src/heroFigure.ts`): the hero vs an AI hero of another kit in a
  ring (radius 12, gold rim). 600 HP each, HUD bars with portraits, the opponent's spells via `castAs` (one-shot
  context override, lingering) with their own danger zones, impact-time dodge check (DODGED), AI (distance, strafe,
  R/E/W/Q priority, rooted to impact), VICTORY / DEFEAT card, rematch, opponent picker. Arena gained `maxHp`,
  `bounds`/`keepInside`, `moveFoe`, `placeFoe`, `hpOf`, `contextFor`, public `say`. Verified by stepping: AI casts
  and damages, standing still in Anvil Drop costs 65 while walking out shows DODGED and costs 0, defeat after
  17.6 s idle, victory card, old-round hits ignored. Sweep 144/144. Screenshot `docs/heroes/duel.jpg`.
- **Documentation knowledge base** (user 2026-10-29: "rewrite the whole thing like docs"): `docs/README.md` (home,
  map of content), `guide/using-the-tool.md`, `architecture/` (overview, effects-and-parts, targeting-and-arena,
  hero-mode, models), `pipeline/` (workflow, review-tools), `catalog/` (effects.md: all 144 by category with links;
  `heroes/` roster + one page per hero), `knowledge/` (lessons, glossary). Existing docs (art bible, principles,
  briefs, status) stay at their paths (the skill and the design notes link them) and are part of the map. Front
  matter on every new page, relative links only (784 links checked). Root README rewritten as a short front door.
- **Four more hero kits + hero models** (user 2026-10-29): forge (Brannoc, the Ashen Smith: rivet shot, anvil drop,
  bellows ward, forgefall), frost (Isolde, the Winter Warden: rime spear, frostfern field, glacial mantle, winter's
  crown), astral (Lyra, the Star Archer: starshot, constellation snare, orbit veil, celestial hunt), alchemy (Vex, the
  Plague Alchemist: volatile flask, caustic pool, mutagen, grand transmutation). Shared rules
  `pipeline/designs/kit-common.md`, sheets `pipeline/designs/kit-<theme>.md`, parts `src/effects/parts/<theme>.ts`,
  kit data `src/kits/<theme>.ts`, categories `hero: <theme>`. Every spell reviewed in 2 rounds (sheets in
  `docs/spells/`, incl. the multi-spell `_multi` helper now in `pipeline/tools/contact-sheet.js`). Hero switcher (View
  → hero, or click the portrait). Hero models: hand-drawn concept `docs/heroes/lineup_concept.svg`, rigged figures from
  `blender/heroes/hero_figures.py` in `public/models/heroes/`, shown in hero mode with walk / breath / cast poses
  (`docs/heroes/ingame_sheet.jpg`). 144 effects registered; the full `selfTest` sweep passes (names from `vfx.slots`).
- **Hero mode (H, or View → hero mode)**: a MOBA-style test of a hero kit on top of play mode. Click (or
  right-click) the ground to walk there; Q/W/E/R aim (range ring at the hero, a strip to the hovered enemy for
  single-target spells, the area circle at the cursor clamped to range for ground spells), click casts, right-click
  / Esc / the same key cancels; self spells (Crimson Pact) cast at once. An enemy out of range: the hero walks into
  range, then casts. Rooted until the spell's impact (from its danger zones). HUD: portrait and name, four slots with
  canvas icons, key badges, cooldown sweep and seconds, tooltips; R is the gold ultimate slot. Fixed top-down follow
  camera, wheel zoom. Enemies keep HP between casts and respawn 4 s after dying. Kits are data in `src/heroes.ts`
  (blood kit: Q hemolance r11 cd2.5, W thorn garden r10 cd6, E crimson pact self cd9, R sanguine eclipse r13 cd20);
  code in `src/heroMode.ts`, Arena got `setTarget`, `setGroundPoint`, `liveFoes`, `pickEnabled`, `persist`.
  Verified by driving it in the browser (move, aim, cast each slot, kills and respawn); screenshots
  `docs/spells/hero-mode_aim.jpg`, `docs/spells/hero-mode_ult.jpg`. Sweep still 128/128.
  Spells overlap: in hero mode an earlier cast that is still playing when a new spell is cast keeps updating and
  drawing until it ends (`lingering` in `main.ts`); shake is the max over live effects, distortion covers all of
  them, and one screen-feedback state is picked per frame (`pickScreen`). Editor and play mode still play one
  effect at a time. Verified W then Q 0.3 s apart: both visible, both hit (50 and 60), Thorn Garden dropped when it
  ended. Fresh sweep 128/128.

- **Multiplayer duel game "Arena of Kits" (2026-10-29)** at `/game.html` (editor unchanged at `/`): login /
  register (local accounts, scrypt, `server/data/accounts.json`, git-ignored), main menu, heroes overview (kits, spells,
  icons, portraits, turning model), profile (wins, losses, matches, win rate, favourite hero, per-hero table, last 20
  matches), lobbies (create / join by code or list, pick heroes, the other seat's hero greyed, ready up) and a
  matchmaking queue that pairs two different heroes. Network matches run in the duel ring (`Duel.startNet`); server
  referee (HP, winner, stats), each client owns its hero and the hits it takes. Server `server/game-server.mjs` on
  `/ws`, attached to Vite by a plugin (`npm run dev`) or standalone (`npm run build && npm run game:server`, port
  8787). New dependency `ws` 8.18.3. Docs: `docs/architecture/multiplayer.md`.
  - Verified: `npm run test:server` (20 checks); two built-in-browser tabs on the built page with real input events:
    queue match (22.6 s), lobby match in the ring with cover (24.5 s), dodges on both screens, knockback replicated,
    disconnect = forfeit, session resume, Back to menu, profile. `tsc --noEmit` clean; selfTest sweep 156/156 ok.
  - Background tabs keep simulating in game mode (a timer steps the scene when no frame came for 250 ms).
- **Cloudflare deployment (2026-10-29; live since 2026-10-30 at https://arena-of-kits.arenachamp.workers.dev):** the server core is runtime-free (`server/hub.mjs`,
  accounts with a pluggable store and PBKDF2), hosted by Node (`server/game-server.mjs`) or by a Cloudflare Worker +
  SQLite Durable Object (`worker/index.mjs`, `wrangler.jsonc`, wrangler 4.150.0 pinned). `npm run cf:dev` (local,
  8788) passed the smoke test, a two-tab match and a restart. Deployed with `npm run cf:deploy` (workers.dev
  subdomain `arenachamp`); page and game socket answer.
  **Deploy freeze (user, 2026-10-30): do not run `npm run cf:deploy` / `wrangler deploy` until the user says so.**
- **Duel ring cover + line of sight (2026-10-29, user request):** centre wall, four pillars, two side walls
  (`src/obstacles.ts`, `DUEL_OBSTACLES`) in both the AI duel and the network duel. They block walking (push-out +
  sliding round edges) and sight; targeted spells need sight of their target (hero mode: toast "No line of sight",
  walks round, then casts; the AI only picks spells it can see with). AI duels still finish (17-24 s).

## In progress
- **15 more heroes** (user 2026-10-29), five waves of three; same pipeline as the four kits (kit sheet → worker →
  2 review rounds → model → register → sweep → tournament). Balance budget now in `pipeline/designs/kit-common.md`.
  - Wave 1 DONE: storm (Kaia), sand (Sefu), shadow (Nyx). Kits built, reviewed (sand 1 round; storm, shadow 2),
    registered; concept `docs/heroes/wave1_concept.svg/.jpg`; models exported (`storm/sand/shadow.glb`); tournament
    with 8 heroes × 3 (168 fights): 38–60% each, no outliers (Isolde and Sefu lowest at 38%).
  - Wave 2 DONE: grove (Fenna), dawn (Auriel), tide (Marin). Kits built, reviewed (grove, dawn 2 rounds; tide 4,
    the serpent ultimate needed framing work), registered; concept `docs/heroes/wave2_concept.svg/.jpg`; models
    `grove/dawn/tide.glb`; full sweep 168/168 (only the known corpse-finger long-run quirk). Tournament, each new
    hero × 10 opponents × 5 × both sides: Auriel 58%, Marin 54%, Fenna 47%, after balance tweaks (Auriel and Marin
    Q range 11 → 10, Fenna Verdant Ward 13 → 15 per pulse, Bloom Lash knock 1 → 3). Docs: hero pages, catalog,
    parts page, art bible palettes, forged.json (123 entries).
    `duel-tourney.js` now yields through a MessageChannel: the hidden pane throttled its `setTimeout` waits to ~1/min.
    A run longer than 45 s must be started without awaiting it (push results to a window array, read it later).
  - Wave 3 DONE (first kits on the combat mechanics): sky (Zephyr, melee: dash, knock-ups, shield), bone (Mortis,
    summoner: pierce skillshot, skeletons, archers), clockwork (Ada, ranged control: bouncing skillshot + slow, turret,
    root). Reviewed 2-3 rounds (sky's giant crescent and bone's hand needed measuring); concept
    `docs/heroes/wave3_concept.svg/.jpg`; models `sky/bone/clockwork.glb`; `MinionRig.barY` added for tall unit looks.
    First tournament Zephyr 92%, Mortis 82%, Ada 26%; after the mechanics budget (kit-common.md) 60 / 60 / 56%
    (each × 13 opponents × 3 × both sides). Sweep 193/193 (known quirk only). Q of Ada is `clockwork rivet shot`
    (forge owns `rivet shot`).
  - Wave 4 DONE: prism (Opaline, mage: splitting skillshot, blind field, mirror shield, spectrum-lance ultimate),
    hive (Sirix, melee: claw cone + slow, swarm leap with wasp summons, chitin shield, queen-wasp dive + stun),
    bard (Cantor, support: bouncing note skillshot, silence, shield + heal, giant-lyre crescendo + stun). Reviewed
    1-2 rounds (bard passed first sheet; prism crystals rendered white, hive swarm read as confetti); concept
    `docs/heroes/wave4_concept.svg/.jpg`; models `prism/hive/bard.glb` (load checked in game,
    `docs/heroes/wave4-ingame_sheet.jpg`). Tournament with the mechanics budget on the first try: Opaline 63% → 53%
    after Refraction Field 45 → 40, Sirix 45%, Cantor 46% (each × 16 opponents × 3 × both sides). Sweep 205/205
    (known quirk only). Contact sheets need a wide canvas: the pane once shrank to 510×846 and zoomed every frame;
    set the viewport to 1400×850 before `_multi`.
    Committed `3379f3c`.
  - Wave 5 DONE (uncommitted): void (Oblivion, melee juggernaut: rift cleave, null tether pull + slow, void mantle
    shield + silence, unmaking R with pull + silence), ink (Shiori, control mage: brushstroke skillshot that splits at
    the end of its range, ink snare root, paper familiars ranged crane summons, final calligraphy R with blind), chrono
    (Tempo: piercing second-hand bolt with slow, stopped moment stun, rewind dash back + heal, twelfth hour R stun).
    Sheets `pipeline/designs/kit-{void,ink,chrono}.md`. New engine option `HitOptions.pull` (arena.ts, duel.ts; docs
    in mechanics.md "Pull" and the kit-common budget). Review: chrono passed the first sheet; void needed 1 fix (Null
    Tether's effects were not added to the scene); ink needed 1 round (purple hit tint, thin strokes, R paper flooded
    the frame). Rewind has no `dash` flag on purpose (the duel AI aims dash spells at the enemy). Concept
    `docs/heroes/wave5_concept.svg/.jpg`; models `void/ink/chrono.glb` (load checked in game,
    `docs/heroes/wave5-ingame_sheet.jpg`). Tournament first run: Oblivion 26%, Shiori 72%, Tempo 51%; after Rift
    Cleave 40 -> 46, Null Tether 30 -> 36 and pull 3 -> 4, Unmaking 100 -> 110, Brushstroke 55 -> 48 (split 15 -> 12),
    Final Calligraphy 105 -> 95 and blind 2.0 -> 1.5 s: Oblivion 54%, Shiori 58%, Tempo 51% (each x 19 opponents x 3
    x both sides). Sweep 217/217 clean.
    Committed `e8e4326`.
  - Final balance pass (2026-10-30, committed): full 20-hero tournament (`_tourney`, every ordered pairing).
    Run 1 (3 reps): Vesper 70, Cantor 68, Ada 64, Opaline 61 high; Isolde 33, Sefu 34, Lyra 35, Zephyr 37 low.
    Three tuning rounds (damage only, in each spell's `default<Name>()`): Hemolance 53 -> 47, Sanguine Eclipse slam
    120 -> 110, Discordant Note 50 -> 47, Crescendo 100 -> 95, Clockwork Rivet Shot 55 -> 50, Gearfall 125 -> 115,
    Prism Bolt 45 -> 42, Spectrum Lance 125 -> 118, Rime Spear 50 -> 53, Winter's Crown 125 -> 130, Frostfern Field
    56 -> 58, Sand Lash 50 -> 53, Quicksand 45 -> 48, Tomb of Kings 125 -> 130, Starshot 52 -> 55, Celestial Hunt
    135 -> 138, Gale Edge 40 -> 45, Thousand Winds 125 -> 132, Rivet Shot 46 -> 50, Forgefall 115 -> 122, Volatile
    Flask 45 -> 49, Grand Transmutation gold 80 -> 86, Bloom Lash 50 -> 54, World Blossom 125 -> 130, Brushstroke
    48 -> 45. Final run (4 reps, 152 fights per hero, no timeouts): Vesper 46, Brannoc 59, Isolde 59, Lyra 52, Vex
    55, Kaia 49, Sefu 47, Nyx 43, Fenna 55, Auriel 44, Marin 51, Zephyr 53, Mortis 54, Ada 41, Sirix 41, Cantor 43,
    Opaline 43, Oblivion 61, Shiori 45, Tempo 58. Run-to-run noise is about +-6 points. Hero pages and the heroes README
    carry the new numbers.
- **Combat mechanics** (user 2026-10-29; plan `pipeline/designs/mechanics.md`; used by waves 3-5 only, the 11 existing
  heroes stay as they are). Engine built in 4 steps, committed in `0cd338d`:
  1. Statuses: `HitOptions.status` (stun, root, slow, silence, blind, knockup), `src/effects/status.ts`, markers
     `parts/status.ts`; AI obeys them and prefers `cc` spells. Zone-hit fix in 6 spells.
  2. Shield / heal / dash (`ctx.shieldSelf`, `healSelf`, `moveCaster`, `parts/shield.ts`), melee support
     (`HeroKit.maxHp`, `melee`, `HeroSpell.dash`). Duel side-bias fix: `opponentHit` checks the hit's own cast.
  3. Skillshots: `ctx.projectile` (pierce, bounce, split; `src/effects/projectile.ts`, `parts/bolt.ts`); duel filters
     accept projectile hits; AI dodges ~65%.
  4. Summons: `ctx.summon` (melee, ranged, turret; `src/effects/summon.ts`, `parts/minion.ts` with a pluggable look);
     AI shoots the hero first; hero-mode line aim (`HeroSpell.aim: 'line'`); hero-mode recast keeps the old instance.
  Test kits (not in the roster): `vfx.testKits.melee` / `ranged` / `summon`; test spells in category
  `test: mechanics`. Duel recipe for kit objects: comment above `Duel.start()`. Results: melee 59%, ranged 59%,
  summoner 48%. Budgets: `kit-common.md` (Summon budget). Network duels ignore shields, dashes, projectiles and
  summons for now (phantom units on the player side): the sync goes to the multiplayer session, which holds off
  `arena.ts`, `heroMode.ts`, `duel.ts` and `targeting.ts` until told.
  Melee heroes: Zephyr, Sirix and Oblivion (mechanics.md 2b).
  After the engine (new AI targeting, per-cast dodge rule): 11-hero tournament `_tourney(3)` = 330 fights, 0 timeouts,
  wins out of 60: Vesper 45 (75%, outlier), Kaia 35, Nyx 33, Auriel 32, Marin 32, Brannoc 29, Lyra 29, Vex 27,
  Fenna 24, Isolde 23, Sefu 21 (35%). Vesper checked: dodges against her casts are normal on both sides, so it is
  balance, not a filter leak. Left for the planned balance pass after waves 3-5. Sweep 181/181 (known
  corpse-finger quirk only).

## Blocked
- Nothing.

## Waiting on you
- Push: all commits were rewritten to author Dextonek (old history in `refs/backup/before-dextonek`); remote
  `origin` = https://github.com/Dextonek/ArenaChamp; pushed as `main` up to e8e4326 (wave 5). Later pushes:
  `git push origin feat/particle-editor:main`.
- Cloudflare deploy freeze: no new build goes live until you lift it.
- Play online: https://arena-of-kits.arenachamp.workers.dev in two browsers (online accounts start empty).
- Try it in two windows: `npm run dev`, then http://localhost:5173/game.html twice (see the guide's duel game section).
- Uncommitted: play/run duel, balance pass. 95638f0 duel + docs knowledge base. Branch `feat/particle-editor` has no remote; earlier
  commits 6329099 four hero kits, models, switcher; fa60c09 blood kit, hero mode; earlier a7f26de, 60ec4cb,
  108ce68, d89f0b7, a4b9d65.

## Known look issues (small)
- Duel game: not cheat-proof (clients report their own hits); a reload during a match forfeits it; no mirror
  matches (one effect per spell label); projectiles fly through pillars (sight is checked at the cast); a pillar can
  hide a hero from the high camera. The kit balance numbers predate the ring's cover: re-run the duel tournament.
- Duel v1: the opponent uses one telegraph set at a time (a new cast replaces the old zones); it never dodges; the
  two heroes can't share a kit. Not watched in real time (the browser pane doesn't animate while hidden).
- Hero figures: poses are procedural (walk swing, one casting arm); not checked closely from the gameplay camera.
  Isolde's back still glows fairly bright (ice fan emission + pale robe).
- Volatile flask: a faint stain is still on the floor at 1.75 (gone at 1.8).
- Hero mode: a hero who walks during Crimson Pact leaves the heart behind; the follow camera centres on the hero, so
  the ultimate's moon sits at the top edge unless you zoom out with the wheel. With overlapping spells, only the
  newest one's danger zones are drawn, and one screen-feedback state wins per frame (an impact frame, else the
  strongest darken/whiteout).
- Sweep flake (2026-10-29, not reproduced): one sweep run reported errors for abyssal angler, supercell, world tree
  rising, hourglass of ages and midnight circus; the error text was not captured. Each passed alone, the same chunk
  passed when re-run, and a fresh full sweep passed 128/128. If it comes back, capture `r.errors[0]`.
- Thorn garden: the thicket thorns still read a little thin from far away.
- Sanguine eclipse: the blood sphere keeps a small specular highlight.
- World tree rising: the 6.2-8 s canopy shot frames only the upper tree (the 17-21.8 s wide shot shows the full scale).
- Supercell: the enemies take a light violet tint from the arena hit flash during the vortex ticks.
- Thousand-cut iaido: the 2.8 s blade glint star is still a bit large.
- Ophanim descent: the opening omen shot (0-3 s) is sparse: dark sky, small clouds, the caster's head at the frame edge.
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

- Zone hits that skip a position check at impact: `aegisWall`, `judgementOfDawn` (loop `ctx.targets`, chosen at cast),
  `whirlpool`, `leviathansWaltz` (`victims`, frozen at cast), `graspOfTheDeep` tick, `eclipseExecution`. An enemy that
  walks out of the zone before impact is still hit. The duel hides it (`opponentHit` re-checks the telegraph); hero
  mode does not. Fix: re-check position at impact like `overgrowth.eachInside`. Planned with the status-effect work.
- `docs/architecture/effects-and-parts.md` has no sections yet for the wave 1 parts files (storm, sand, shadow).

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
