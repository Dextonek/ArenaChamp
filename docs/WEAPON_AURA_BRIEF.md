# Weapon aura brief (for forge-vfx workers)

You are writing **one looping idle "enchant" aura for one Blender weapon**, in the style of the user's Spiderlily
reference (`docs/WEAPON_VFX_GUIDE.md`, recipes `f-spiderlily-*` in `pipeline/library/index.json`). These are not
targeted spells: no `targeting`, `cast`, hits or telegraphs.

## Read first
0. `docs/ART_BIBLE.md`: our look, the material and energy palettes, the self-critique list.
1. `docs/WEAPON_VFX_GUIDE.md`: the technique (§1) and the recipe for your weapon (§3).
2. `src/spells/weapons/phoenixFan.ts`: **the reference. Copy its structure** (class extends `WeaponAura`, layers
   built in the constructor into `this.rig`, everything animated in `animate()`, `weaponModule(...)` export).
3. `src/effects/weapons/kit.ts` (`FlowRibbon`, `StarFlare`, `LilyBurst`, `PetalSwarm`, `PolylineSpawner`, `wave`,
   `TAU`), `src/effects/weapons/aura.ts` (`WeaponAura`, `this.emitter(...)`, `weaponModule`),
   `src/effects/weapons/sockets.ts` (**your weapon's attach points**: use only these, never the loaded geometry).
4. Your design note `pipeline/designs/<slug>.md`, and the parts kit if it names one (`src/effects/parts`:
   `LightningArc`, `StarBurst`, ...), plus `GlowSphere` in `src/effects/common.ts` and `src/emitter.ts`.

## Rules
- Weapon space: origin = grip centre, head up +Y, face +Z, metres. The weapon is ~1 m, so sizes are small:
  emitter `sizeStart` 0.005–0.06, flares 0.03–0.14, ribbons 0.02–0.08 wide, GlowSphere scale 0.05–0.35.
- **Seamless loop with period P** (the constructor's `period`): drive every periodic value from `loopT` with
  whole cycles per P (`wave(loopT, P, phase)`, `FlowRibbon.update(loopT, P, cycles, swayCycles)` with integer
  cycles, rotations as oscillations `a * sin(TAU * f)` or whole turns). One-shot things (ignition burst) only use
  `t` and happen once (reset them in `reset()`).
- Ignition: everything ramps in with `ramp` (or its own curve on `t`) during `activation`. Then it is a steady loop
  with one slow "breath" per P, and phases offset between layers so the glow travels over the weapon.
- One hot focal point (a `StarFlare`) per weapon plus at most 2–3 small ones. Additive opacity ≤ ~0.9 for flares and
  ≤ 0.6 for big glows. Keep one dark, normal-blended layer (smoke / mist / haze) for contrast.
- Set the model look in `super(...)`: `darken` is a **linear** multiplier (0.08–0.2 reads dark, like the
  reference), `tint`, `rim` colour, `emissiveMax` (≤ 1).
- Hide with `visible = false` or opacity 0. Never set a scale below 1e-4 (the selfTest flags singular matrices).
- Put every `FlowRibbon` a few mm **in front of** the surface it sits on (`z` ≈ +0.01 on faces), or depth hides it.
- Write ONLY your file `src/spells/weapons/<camelCase>.ts`, exporting `<camelCase>Module`. Do not edit
  `index.ts`, `kit.ts`, `aura.ts`, `sockets.ts`, `main.ts` or any shared file. If the kit lacks something, build
  it inside your file (a small class) and say so in your report.
- No git, no npm install, no dev server, no browser. Verify with `Set-Location C:\VFXTool; npx tsc --noEmit`.

## Report
The file, the layers you built (one line each, with their kit piece), the loop period and cycles used, anything
you had to build locally that belongs in the kit, and the tsc result.
