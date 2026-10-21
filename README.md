# VFX Tool

A personal browser-based particle effects editor (Three.js + Vite + TypeScript).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Drag to orbit, scroll to zoom, tweak the emitter in the right-hand panel.

Two modes (top of the panel):

- **particles** — one emitter with presets (fire, smoke, sparks, magic, snow) and bloom.
- **divine sword** — a giant sword falls from the sky onto an enemy while ~1000 small swords spin in a drill
  around its tip and orbit the blade. Press **Space** or **▶ play** to replay; every timing/size/colour is in the
  *Divine Sword* folder.

## Layout

- `src/emitter.ts` — CPU-simulated particle emitter (`EmitterSettings` is plain JSON-able data), drawn as one `THREE.Points` with a small shader for size/colour/opacity over life.
- `src/presets.ts` — particle presets (emitter + bloom settings).
- `src/effects/divineSword.ts` — the divine sword set piece (instanced swarm, timeline, impact effects).
- `src/main.ts` — scene, lighting, bloom, camera, lil-gui panel, render loop.

## Scripts

- `npm run dev` — dev server on port 5173
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production build into `dist/`
