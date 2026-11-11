# The heroes' style, as rules for an arena

Written 2026-11-11 after the user rejected two harbours made from scans ("too realistic, does not match the heroes")
and had three agents look at the heroes and the harbour in parallel. They agreed: **the mismatch was the shapes**. A
scan keeps its worn, crooked, lumpy form whatever colour it is painted. Build props as the heroes' own things are
built.

## The rules

1. **Shape:** real proportions, idealised. Everything is a clean turned or boxed form (tube, ellipsoid, torus, bell,
   box with a small bevel), symmetrical and new. No wear, cracks, tears or crookedness.
2. **Surface:** one flat colour per part, smooth shading, no grain and no detail maps. Light alone shows the form.
3. **Colour:** two or three big zones per thing; one clear colour against near-black lacquer. Wood and leather are
   clean flat browns. No muddy mid greys.
4. **Materials:** two kinds only: matte (metal 0, rough 0.5-0.85) or polished metal (metal 0.75-0.9, rough 0.25-0.42).
5. **Trim:** a thin gold line on the edges: hoops, straps, rims, caps, gunwales, the kerb.
6. **Glow:** one small light per thing at most; in an arena only what matters (lanterns, a lighthouse, windows).
7. **Detail:** few big shapes, one rhythm of repeats, readable from the game's high camera.
8. **The arena stays behind the heroes** (Riot's rule for Summoner's Rift: interface, then abilities, then
   characters, then the world): a shade duller and darker than a hero's costume, a narrow band of values, nothing
   tall between the camera and a hero, the far things in three or four flat tones fading into the sky.

## The palette (the heroes' own, from blender/heroes/real/*.py)

| Key | Colour | Rough | Metal |
|---|---|---|---|
| wood | `#4a3220` | 0.7 | 0 |
| plank | `#6b4226` | 0.75 | 0 |
| lacquer | `#1d1b21` | 0.45 | 0 |
| wine | `#5e1a28` | 0.6 | 0 |
| iron | `#3c3f47` | 0.42 | 0.75 |
| gold | `#c9a24a` | 0.32 | 0.85 |
| rope | `#b89a5a` | 0.9 | 0 |
| stone | `#2c3140` | 0.85 | 0 |
| cream | `#d8cfb4` | 0.8 | 0 |
| glow | `#ffcf80`, emits `#ffb03a` | 0.4 | 0 |

Each arena should add one colour of its own (the harbour's is wine) and keep the rest.

## How to build

`A.mat(key, colour, ...)`, then per prop `f = A.fig()`, shapes at life size standing on z = 0 (`f.turned`, `f.box`,
`f.tube`, `f.torus`, `f.ellipsoid`, `f.hull`), `A.built(key, f, bevel=...)`, and `A.put(key, x, z, ...)` under
`A.cover(obstacle)` or `A.back()`. 24-28 segments round anything a player stands next to; a bevel of about 1 cm on
boxes so their edges catch the light. `harbour.py` is the example.

## What not to do again

- Photogrammetry scans for anything a player looks at, painted or not.
- Photographed ground textures: the floor is drawn (`pavingTexture` in `src/arenas/harbour.ts`).
- A sea with fine ripples and a sparkling glint: it is drawn too (`Sea` in `src/arenas/real.ts`).
