# Spell brief (for agents writing spell effects)

You are adding spell effects to a Three.js + TypeScript + Vite VFX editor at `C:\VFXTool` (Windows; use absolute
paths). Each spell is one file exporting one `EffectModule` plus its effect class implementing `Effect`.

## Style
WoW-inspired spells, **reworked in our own style**: same idea and gameplay feel, more over-the-top and cinematic,
original visuals. Spell names as labels are fine. Do not copy Blizzard icon art, model shapes, sounds or text.

## Read first (do not modify)
- `src/effects/types.ts` — `Effect` / `EffectModule` contract. Set `category` on your module.
- `src/effects/common.ts` — the kit:
  - `ENEMY_POS` (origin) and `CASTER_POS` (0, 0, 14). The caster faces the enemy (-Z).
  - `Enemy` (target dummy; `reset`, `setFlash`, `setCrush`, `setHome`; its `group` may be moved/rotated —
    `reset()` restores home position, rotation, scale, visibility, emissive).
  - `createCaster(color?)` — golden caster figure at CASTER_POS (an `Enemy` without horns). Call `reset()` in play().
  - `createGround()`, `smoothstep`, `mergeParts`.
  - Geometry: `createSwordGeometry` (tip at origin, -Y), `createSpearGeometry`, `createHammerGeometry` (handle 0..1
    on +Y, head at y = 1), `createShieldGeometry` (radius 0.5, faces +Z).
  - `GlowSphere` — fresnel energy sphere (`mesh`, `opacity`, `color`; `{ rim: false }` for a soft core). Use it
    for bursts/auras instead of plain additive spheres.
  - `LightPillar` — vertical beam: `set(x, z, bottom, top, opacity)`, `color`.
  - `createRing(color, inner, outer, segments)` → `{ mesh, material }`: flat additive ring lying on the ground
    (segments 4 = diamond, 6 = hexagon). Animate `mesh.scale`, `mesh.rotation.z`, `material.opacity`.
  - `frameArena(camera, controls, center, radius)` — **use this in every `frameCamera`.** It frames a side view
    from +X with the caster on screen-left and the content kept clear of the control panel on the right.
- `src/emitter.ts` — `Emitter`, `defaultSettings()`, `burst(count, at?)`, `clear()`, `update(dt)`. Emits in a
  cone around +Y (`spread` degrees, 180 = all directions). For inward/orbiting/curved motion animate your own
  `THREE.Points` or `InstancedMesh`. **Use the optional look settings:** `colorMid` (3-stop hot → saturated →
  cool), `sizeJitter` (0.3–0.5), `erosion` (0.4–0.65 for fire/smoke/dust/magic wisps; 0 for sparks), `spin`,
  `groundFade` (~0.3 for particles that settle on the ground).
- `docs/ART_BIBLE.md` — our look and palettes; read it before anything else.
- `docs/VFX_PRINCIPLES.md` — the layering checklist every spell should satisfy.
- **Reference spell: `src/spells/paladin/judgment.ts`.** Copy its structure exactly: settings interface +
  `defaultX()`, `time`-driven timeline, `play()` → `reset()`, `update(dt)` always updates emitters even when not
  playing, `layout()` positions everything from `time`, module object with `label`, `category`, `create`,
  `bloom`, `frameCamera` (via `frameArena`), `buildGui` (always include `loop`).
- Bigger references: `src/effects/divineSword.ts`, `src/effects/gateOfBabylon.ts`.
- **Danger zones:** every damaging spell declares `telegraphs(effect)` on its module (red ground zones the
  player must leave; see `src/effects/telegraph.ts` and the examples in `meteorShower.ts` / `energyBeam.ts`).

## Hard rules
- Write only the files you were assigned. Do not edit `main.ts`, any `index.ts`, `common.ts`, `types.ts`,
  `emitter.ts`, `presets.ts` or other spells. No git, no npm install, no dev servers, no browser tools.
- Verify with `Set-Location C:\VFXTool; npx tsc --noEmit` — zero errors in your files (strict, noUnusedLocals).
  Other agents write other files in parallel; ignore errors that are only in files that aren't yours, and say so.
- Each spell: 3–6 s total, with readable anticipation → release → impact → short aftermath.
- Brightness (ACES tone mapping + UnrealBloom; learned the hard way):
  - emissiveIntensity ≤ 1 at rest, brief spikes ≤ 3.
  - additive particle opacity ≤ 0.5 (small sparks up to 0.9).
  - MeshBasicMaterial colour components ≤ 2. `Color.setRGB` and `setHSL` values are **linear** (0.12 already
    looks grey; `setHSL(h, s, 0.35)` displays as pale) — pass `THREE.SRGBColorSpace` as the last argument when you
    think in screen colours. Hex values (`0x…`, `'#…'`) are sRGB and safe.
  - `THREE.PointsMaterial` must get `map: softDotTexture()` (from common), or points render as hard squares.
  - Dense overlapping additive layers blow out to white — keep layer count and opacity low.
  - A large plain additive sphere reads as a solid wall above ~0.15 opacity — use `GlowSphere`.
  - Piles of pale lit metal go white — use mid-tone colours for lit surfaces.
  - Module `bloom.threshold` ≥ 0.8, `strength` ≤ 0.7.
- ≤ ~5k particles/instances per spell. Everything inside `this.group`.

## Report back
Per spell: file path, 2–3 lines on what happens, and anything you're unsure of visually. Plus the exact tsc result.
