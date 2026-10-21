# Status

_Last updated: 2026-10-21_

## Done
- Vite + TypeScript + Three.js scaffold, exact versions pinned (three 0.186.1, vite 8.3.5, typescript 7.0.2).
- Particle emitter: point/sphere/box/cone shapes, height, rate, lifetime, speed, spread, gravity, drag,
  size/colour/opacity over life, additive blending, one-shot `burst()`.
- Bloom (UnrealBloomPass) + ACES tone mapping, with panel controls.
- Presets: fire, smoke, sparks, magic, snow (each sets emitter + bloom).
- **Divine Sword** mode (`src/effects/divineSword.ts`): giant sword summoned in the sky, ~1000 small swords fly in
  and form a spinning conical drill ahead of its tip plus orbit rings around the blade; accelerating fall with a
  light pillar and golden motes; impact with flash, shockwave ring, glowing crater, sparks, dust, camera shake,
  enemy crushed; the swarm scatters and sticks into the ground, then everything fades. Space replays.
- Verified in browser by stepping the timeline (summon, fall, close-up of drill, impact, aftermath); no console
  errors. `npm run build` passes (only Vite's >500 kB chunk-size warning).

## In progress
- Nothing.

## Blocked
- Nothing.

## Waiting on you
- Watch the sword effect in real time and say what to tune (timing, size, colours, more/less glow).
- Nothing is committed yet; work is on branch `feat/particle-editor` (no commits on `main`).

## Notes
- The browser pane only animates while visible; automated checks step the sim through `window.vfx.step()`.
- Background is set via `scene.background`: with the composer, `setClearColor` skipped sRGB→linear and
  washed the backdrop to grey.

## Next step candidates
- Save/load effect as JSON (+ localStorage autosave); PNG / WebM export (handy for recording the sword).
- Cinematic camera for the sword (follow the fall, cut to impact).
- Slanted fall angle, multiple enemies, ground cracks decal.
- Multiple emitters / layers in particle mode.
