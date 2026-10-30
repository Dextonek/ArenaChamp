---
title: Models pipeline (Blender)
tags: [architecture, models, blender, weapons, heroes, glb]
updated: 2026-10-29
---

# Models pipeline (Blender)

How the 3D models in `public/models/` are made and used: the weapons pipeline (`blender/weapons/`), the hero-figure pipeline (`blender/heroes/`), how to run both through the Blender MCP server, and the runtime side that loads and poses them ([hero.ts](../../src/effects/weapons/hero.ts), [kit.ts](../../src/effects/weapons/kit.ts)). Needed by anyone who changes a model, adds a hero or weapon, or debugs how a figure is posed in the browser.

## Overview

| Output | Source | Runtime consumer |
|---|---|---|
| `public/models/weapons/wp-*.glb` (5, plain glTF) | [blender/weapons/](../../blender/weapons/) | `WeaponModel` in [kit.ts](../../src/effects/weapons/kit.ts) (plain `GLTFLoader`) |
| `public/models/heroes/{blood,forge,frost,astral,alchemy}.glb` (skinned, meshopt) | [blender/heroes/hero_figures.py](../../blender/heroes/hero_figures.py) | `Hero` in [hero.ts](../../src/effects/weapons/hero.ts), via `MODELS` in [heroes.ts](../../src/heroes.ts) |
| `public/models/heroes/<theme>.glb` from an unrigged Meshy (or other) GLB | [blender/heroes/meshy_rig.py](../../blender/heroes/meshy_rig.py): decimates, scales, fits the hero rig to an A-pose, skins by bone distance, puts the arms down and re-adds hand-held props | same as the hero figures (bone names and rest orientations of the hero rig) |
| `public/models/figures/hero.glb` (the weapon wielder) | copied from the Dao Archive, not built here | `Hero` default url |

Both pipelines reuse the **Dao Archive** modelling kit at `C:\projectG\xianxia\blender` (`kit`, `dao_blender`, `figure_kit`, `figure_looks`, `_azure_common`, `_treasure_common`, ...) strictly **read-only**: the scripts add that folder to `sys.path` and import from it, and write only into this repository (never into the game's models or manifest). Both need Blender with the MCP add-on connected, and the Dao folder present on the machine.

## Running a script through the Blender MCP

Use the Blender MCP `execute_blender_code` tool. The snippets are in the file headers.

### Weapons ([blender/weapons/_wp.py](../../blender/weapons/_wp.py))

```python
import sys, importlib
sys.path.insert(0, r"C:\VFXTool\blender\weapons")
import _wp; importlib.reload(_wp)
_wp.run("wp-sword-dragon")                   # build, preview, export, then clear it from the scene
_wp.run("wp-sword-dragon", export_it=False)  # build and preview only (stays in the scene)
```

- `_wp.run(wid, export_it=True, previews=True, keep=False, **kw)` returns stats, preview paths and (when exported) the glb path and size in MB.
- Weapon ids: `wp-sword-dragon`, `wp-sword-ice`, `wp-glaive-guandao`, `wp-hammer-thunder`, `wp-fan-fire`. Each `wp-<id>.py` defines `build()` that returns the weapon's collection; `_wp.build` loads that module by path, reloads the Dao helper modules, and names the single joined mesh after the id (the glTF node name).
- `_wp.mats(wid, **colors)` provides the usual named materials (`<id>_gold`, `_steel`, `_jade`, `_gem`, `_glow`, `_grip`, `_dark`, ...); override a colour with `part='#hex'`.
- Output: `public/models/weapons/<id>.glb`, **plain glTF without Draco or meshopt**, so `GLTFLoader` needs no decoder. Previews: `docs/weapons/<id>_<angle>.png`. The existing `public/models/weapons/README.md` lists sizes, triangle counts and the aura ideas per weapon.
- `clear` removes only the collection and the data the run created (meshes not present before, materials with the `<id>_` prefix); the shared scene is not purged.

**Weapon convention (what the VFX attaches to):** metres, Blender z-up exported as three y-up; origin = centre of the grip; blade or head along +Y in three (+Z in Blender); the face (blade flat, medallion, fan) toward +Z in three (-Y in Blender, Front view); width along X. Attach points are copied from the scripts into [sockets.ts](../../src/effects/weapons/sockets.ts) (three `(x, y, z)` = Blender `(x, z, -y)`); change both together.

### Hero figures ([blender/heroes/hero_figures.py](../../blender/heroes/hero_figures.py))

```python
import sys, importlib
sys.path.insert(0, r"C:\VFXTool\blender\heroes")
import hero_figures; importlib.reload(hero_figures)
hero_figures.build("forge")      # into the collection "Fig forge" (stays for previews)
hero_figures.export("forge")     # build + public/models/heroes/forge.glb, then clear
hero_figures.preview("forge")    # build + docs/heroes/forge_*.png turnaround renders
```

- Hero names: `blood`, `forge`, `frost`, `astral`, `alchemy` (the `LOOKS` dict). Each look is a set of `figure_kit` options (robe and trim colours, hair, headwear, eye glow, extras) plus a `props` dict of `HeroFigure` methods (e.g. `blood_gem`, `slag_pauldrons`, `ice_crown`, `star_halo`, `plague_mask`); `HeroFigure` is `figure_kit.Figure` plus those props, added before the kit merges and skins the parts (rigid parts are skinned to one bone). `look["broad"]` scales a heavier build in x/y.
- `export(name, keep=False)` writes `public/models/heroes/<name>.glb` as a skinned GLB **with meshopt compression** (no Draco, no animations), so the browser needs `MeshoptDecoder` (`Hero` sets it). It returns hero, triangle count, size in KB and path.
- `preview(name, views=(20, 200), size=640)` renders turnarounds into `docs/heroes/` (`<name>_15.png`, `<name>_165.png` and similar). The design concept for the lineup is [lineup_concept.svg](../heroes/lineup_concept.svg) (a PNG of it sits beside it); the in-game and model sheets are `docs/heroes/ingame_sheet.jpg` and `models_sheet.jpg`.
- Same rig and bone names as `figures/hero.glb`, which is what lets `Hero` pose all of them with one table of bone names.
- Coordinates: metres, z up, the figure faces -Y, +X is the figure's left.

To add a hero: add a `LOOKS` entry (and any new prop methods), export it, add the name to `MODELS` in [heroes.ts](../../src/heroes.ts) (see [hero-mode.md](hero-mode.md)).

## Runtime: [src/effects/weapons/hero.ts](../../src/effects/weapons/hero.ts)

`Hero` is the rigged humanoid wielder, scaled by `HERO_SCALE = 1.3` (the arena capsules are about 2.3 tall, the figure is 1.75 m). Feet at the origin of `root`, facing +Z.

### `HeroOptions`

| Option | Default | Meaning |
|---|---|---|
| `url` | `'models/figures/hero.glb'` | model under `public/` (loaded with `import.meta.env.BASE_URL`); any figure on the Dao rig works |
| `shade` | 0.45 | base-colour multiplier (the white Azure Cloud robe blows out under bloom; hero mode passes 0.9 for the darker costumes) |
| `maxEmissive` | 0.3 | cap on material emissive intensity (hero mode passes 1 so glowing props such as gems keep their glow) |
| `tintSheen` | false | recolour the cloth sheen with the cloth's own colour (the kit exports white sheen, which turns dark robes near-white from the high gameplay camera); hero mode passes true |

Loading: one `GLTFLoader` with `MeshoptDecoder`; each url's scene is loaded once (promise cache) and every `Hero` gets its own skeleton through `SkeletonUtils.clone`. Materials are cloned and adjusted per hero; skinned meshes have `frustumCulled = false`. The figure appears when loading finishes (`loaded`); until then pose calls are no-ops.

### Bones and posing

`BoneName`: `pelvis`, `chest`, `neck`, `head`, `armR`, `foreR`, `handR`, `armL`, `foreL`, `handL`, `thighR`, `shinR`, `thighL`, `shinL`. glTF names such as `upper_arm.R` lose their dots in three, so bones are matched loosely on the lower-cased alphanumeric name (`upperarmr`, `forearmr`, `handr`, `thighr`, ...).

Per frame: `resetPose()` (all bones back to rest), then `rot(bone, axis, angle)` for each bone, parents before children, with the axis in the **figure's own space** (X = its left, Y = up, Z = forward); then `updateGrip()` to move the held weapon. Other members:

- `root`: move and turn this. `grip`: the held weapon's frame (weapon space: grip at origin, blade +Y, face +Z, at hero scale); add the weapon to it.
- `calibrate()` (internal, on load) measures the right hand's rest orientation and derives the hand-to-weapon rotation so the weapon points forward and 35 degrees up at rest with its face turned outward (-X).
- `updateGrip()` places `grip` at a point 0.07 above the right hand's origin with the calibrated rotation, expressed in the grip's parent space.
- `bone(name)`, `boneWorld(name, out)`: access a bone or its world position (e.g. for trails).

Users: `HeroMode.poseFigure` (walk / breath / cast, see [hero-mode.md](hero-mode.md#figures-walk-breath-cast)) and `WeaponStrike` ([strike.ts](../../src/effects/weapons/strike.ts), key poses sampled with `samplePose`; uses the default Azure Cloud figure). The weapons' loop-time rules are in [WEAPON_VFX_GUIDE.md](../WEAPON_VFX_GUIDE.md).

## See also

- [Architecture overview](overview.md)
- [Effects and shared parts](effects-and-parts.md#weapons-kit-srceffectsweapons)
- [Hero mode](hero-mode.md)
- [Targeting and arena](targeting-and-arena.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md), [VFX principles](../VFX_PRINCIPLES.md)
