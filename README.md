# VFX Tool

A personal browser-based particle effects editor (Three.js + Vite + TypeScript).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Drag to orbit, scroll to zoom, tweak the emitter in the right-hand panel.

Pick a **category** (set pieces / paladin / iconic / original) and then a **mode** at the top of the panel.
The paladin and iconic categories hold WoW-inspired spells reworked in our own style (no Blizzard assets);
**original** holds moves designed from names (corpse finger gravity pull, illusionist rain of doom, solar
verdict, crown of the final star).

**Danger zones:** damaging effects draw red ground zones that fill as a countdown and flash when the hit lands.
Turn on **View → player dummy (WASD)** and move the blue figure out of the red in time: you get HIT or DODGED. In any effect mode press **Space** or **▶ play** to replay; the
effect's own folder holds its timings, sizes and colours.

**Play mode (P, or View → play mode):** walk the golden caster with **WASD** (camera-relative), drag the mouse to
orbit the camera that follows you, and cast with **1–5** from the hotbar at the bottom. Click a slot's name to put
any effect in it (remembered per browser). Click an enemy to target it (shift-click adds more), or click the
ground to aim there. Enemies have 100 HP, show damage numbers, get knocked back and die. **Targeted** spells aim
at what you picked; the other effects are moved onto your caster and turned toward your target.

**Targeted category:** spells that hit enemies or spots you pick. They are made by the prompt-to-effect pipeline:
`/forge-vfx <ideas or recipe ids>` in Claude Code (`.claude/skills/forge-vfx/SKILL.md`). It draws on
`pipeline/library/index.json`, 101 breakdowns: 54 of pro game VFX (hero shooters, MOBAs, ARPGs, artist
breakdowns) and 47 from 21 of the user's own reference videos (batches d–g, broken down frame by frame). Each is
split into the layers our kit builds. The shared **parts kit** (`src/effects/parts`) gives every spell anime impact
frames with silhouettes, world darkening, focus lines, crisp star bursts, wind / slash crescents, thick lightning
and toon smoke balls; see the **parts kit → parts showcase** effect. Rebuild and validate the library with `node pipeline/build-index.mjs`.

- **particles** — one emitter with presets (fire, smoke, sparks, magic, snow) and bloom.
- **divine sword** — a giant sword falls onto an enemy while ~1000 small swords spin in a drill around its tip.
- **gate of babylon** — golden portals open in the sky and fire volleys of swords and spears.
- **meteor shower** — the sky reddens and burning meteors rain down; a final giant meteor.
- **shockwave punch** — a charged punch sends an air blast, dust wall and debris, launching the enemy.
- **lightning strike** — a storm cloud charges and hammers the enemy with branching bolts.
- **spiral sphere** — a spinning energy sphere forms, grinds into the enemy and bursts.
- **energy beam** — a charged ball fires a huge beam that explodes on contact.
- **black hole** — a black hole opens, devours debris and the enemy, then collapses.

## Layout

- `src/emitter.ts` — CPU-simulated particle emitter (`EmitterSettings` is plain JSON-able data), drawn as one `THREE.Points` with a small shader for size/colour/opacity over life. `burst(count, at?)` for one-shot bursts.
- `src/presets.ts` — particle presets (emitter + bloom settings).
- `src/effects/types.ts` — `Effect` / `EffectModule` contract every set piece implements.
- `src/effects/common.ts` — shared pieces: sword/spear geometry, `Enemy`, ground, `smoothstep`.
- `src/effects/index.ts` — registry; add one import + entry per effect.
- `src/effects/*.ts` — one file per effect.
- `src/spells/paladin/*.ts`, `src/spells/iconic/*.ts` — one file per spell, registered in each folder's `index.ts`.
- `src/effects/telegraph.ts` — danger zones (circle/ring/cone/line); `src/player.ts` — WASD player dummy.
- `src/spells/original/*.ts` — original moves.
- `src/post.ts` — final screen pass: vignette, grain, shake-driven chromatic aberration and impact frames.
- `docs/ART_BIBLE.md` — our look: palettes, shape language, reference set, how the artist works (read first).
- `docs/VFX_PRINCIPLES.md` — layering/timing checklist; `docs/SPELL_BRIEF.md`, `docs/REFINE_BRIEF.md` — briefs
  for writing and refining effects.
- `src/main.ts` — scene, lighting, bloom, camera, lil-gui panel, render loop. Effects are built lazily; a broken
  one shows its error in the bottom-left overlay.

## Scripts

- `npm run dev` — dev server on port 5173
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production build into `dist/`
