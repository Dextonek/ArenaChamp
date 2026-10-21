# VFX Tool

A personal browser-based particle effects editor (Three.js + Vite + TypeScript).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Drag to orbit, scroll to zoom, tweak the emitter in the right-hand panel.

Pick a **mode** at the top of the panel. In any effect mode press **Space** or **▶ play** to replay; the
effect's own folder holds its timings, sizes and colours.

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
- `src/main.ts` — scene, lighting, bloom, camera, lil-gui panel, render loop. Effects are built lazily; a broken
  one shows its error in the bottom-left overlay.

## Scripts

- `npm run dev` — dev server on port 5173
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production build into `dist/`
