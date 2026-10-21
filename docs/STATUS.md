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

## Blocked
- Nothing.

## Waiting on you
- Commit of this round (last commit: 67c19e3 on `feat/particle-editor`; no remote).

## Notes
- The browser pane only animates while visible; checks pause the loop (View → paused) and step with
  `vfx.step(1/60)` + `vfx.render()`. Screenshots can show a stale frame when the pane is hidden.
- Brightness rules that keep effects from blowing out: emissive ≤ 1, additive opacity ≤ 0.5, bloom threshold ≥ 0.8,
  mid-tone colours for lit surfaces (pale metal piles go white), `setRGB` values are linear (0.12 already looks grey).

## Next step candidates
- WoW-style ability kit (data-driven spell archetypes + per-class signature spells).
- Save/load effect as JSON; PNG / WebM export.
