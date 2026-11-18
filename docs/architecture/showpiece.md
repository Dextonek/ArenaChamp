---
title: Showpieces
tags: [architecture, showpiece, 2d, video]
updated: 2026-11-18
---

# Showpieces (`/showpiece`)

Short 2D anime "special move" pieces, 12 to 15 seconds each, played on their own page beside the VFX tool and saved as
videos. The user asked for one after a reference clip (2026-11-18: a katana on paper whose draw tears the world open
onto a burning eye), then for four more "similar looking, theme and effect you decide". They are not in the game.

Open `http://localhost:5173/showpiece` (the first piece) or `/showpiece?piece=<id>`. The page has a piece picker, a
timeline of the piece's beats (drag to scrub, tap a beat to jump), play, loop and **Save video** (it plays the piece once
in real time and records it: mp4 where the browser can, else webm). Space plays and pauses; the arrows step a frame.

## How it is built

| Part | File | What it does |
|---|---|---|
| Page | `showpiece.html`, `src/showpiece/main.ts` | Picker, timeline, play, save; finds every piece by itself (`import.meta.glob('./pieces/*.ts')`); loads each piece's font |
| Piece contract | `src/showpiece/piece.ts` | `Piece`: id, title, subtitle, about, order, duration, beats, fonts, `draw(layers, t)` |
| Layers on screen | `src/showpiece/compositor.ts` | Two 2D canvases put on screen by WebGL (three.js): the **flat** layer as it is, the **glow** layer laid over it and bloomed (UnrealBloomPass, tight mips only); then flash, colour fringes, a warm-grey impact frame, vignette, grain, and linear light back to screen colours (a flat colour comes out as drawn) |
| Helpers | `src/showpiece/core.ts` | Time windows (`seg`, `env`), easing, seeded random (`rng`), noise (`wobble`), `ribbon`, `bolt`, `ScreenParams` |
| Shared art | `src/showpiece/art/*.ts` | Paper, halftone, specks, title card, seal (`paper.ts`); the katana (`katana.ts`); the rift, lightning, shards, embers (`rift.ts`); the eye (`eye.ts`); the sun, sparks, the dark burst (`sun.ts`); slashes, speed lines, the paper flood, red strokes (`ink.ts`) |
| Pieces | `src/showpiece/pieces/<id>.ts` | One file a piece; its own art in `src/showpiece/art/<id>/` |
| 3D creatures | `src/showpiece/stage3d.ts`, `blender/creatures/` | Real models drawn into the 2D layers (below) |

Rules every piece keeps:
- **A frame is a pure function of time.** Random numbers come from `rng(seed)`; nothing is carried between frames, so
  scrubbing, stills and a frame-by-frame film all show the same picture for the same time.
- **Glow belongs on the glow layer.** Light, fire, sparks and lightning go there; paper, ink, figures and dark grounds go on
  the flat layer. A bloom over paper would make the whole sheet glow. An opaque dark shape on the glow layer hides what is
  under it (the title card uses that).
- **No `ctx.filter`, no `shadowBlur`:** slow, and missing on some phones. Softness comes from the bloom.
- **Picture units are 1920 by 1080** whatever the canvas's size (phones draw at 1280 at most).
- **Kanji** come from Google Fonts' Noto Serif JP, only the piece's own characters (`fonts.text`), a few kilobytes.

## 3D creatures

The user asked (2026-11-18) for the creatures to be "more real, with continuous bodies, like the champs", then for the
heads to match real dragons ("look at more sources", "maybe even fantasy dragons"). So the creatures are models built in
Blender like the heroes (clean forms, one flat colour per part, gold trim, the eyes the only glow) and drawn by a small
three.js stage of their own, then laid into the flat layer like any drawn figure:

| Model | Built by | Used in |
|---|---|---|
| `public/models/showpiece/water.glb` | `blender/creatures/dragon.py -- water` | Tidebreaker's water dragon (`art/tide/dragon3d.ts`) |
| `public/models/showpiece/jade.glb` | `blender/creatures/dragon.py -- jade` | Jade Serpent's serpent, gliding and coiling (`art/jade/serpent3d.ts`) |
| `public/models/showpiece/eye.glb` | `blender/creatures/eye.py` | Scarlet Sheath's eye in the rift (`art/eye3d.ts`) |

- **One continuous body.** The dragon's skull, snout, nose pad, brows, cheeks, jaw and body are overlapping forms fused by
  a voxel remesh into one skin, then smoothed. The head follows Chinese, Japanese and fantasy references (the Summer
  Palace bronzes, the Kowloon Walled City Park dragon, Hokusai, Chen Rong's Nine Dragons; fantasy anatomy: a wedge of a
  skull, the eye sunk under a hard brow). Run `D:/blender/blender.exe --background --factory-startup --python
  blender/creatures/dragon.py -- water jade --shots <folder>` for the models and a check sheet beside a v4 hero.
- **Bent in code, not rigged.** A model lies straight along +x; `pose()` lays each vertex along a `Path` by how far behind
  the head it is, every frame, with frames that turn as little as they can (or face where `upAt` asks: a dragon's back
  out of its spiral). The head's distance along the path animates it.
- **Drawn into the layers.** `drawCreature()` renders it (lit like the game's heroes: a room for reflections, a key, a rim,
  ACES), draws it into the flat layer under the piece's own transform (so the piece's camera moves carry it), cuts its
  silhouette out of the glow layer, and adds its glowing parts back there. `shift` moves the lens, `roll` turns the view,
  `clipBelow` hides what is under water.
- **A piece waits for its models** (`preload`), and `showpiece.ready` with it, so a film never runs without them.
- The drawn versions stay behind a switch: `?dragon=2d`, `?serpent=2d`, `?eye=2d`.

## Pictures and films

`pipeline/tools/showpiece-shots.py` draws frames in a headless Edge with the page's own `showpiece.draw(t)`:

```bash
python -I pipeline/tools/showpiece-shots.py stills scarlet 0.2,6.5,14.2 --sheet --out <folder>
python -I pipeline/tools/showpiece-shots.py stills scarlet 0.2,6.5,14.2 --ref <reference.mp4> --out <folder>
python -I pipeline/tools/showpiece-shots.py film scarlet --out <folder>
```

It starts its own dev server without hot reload (`pipeline/tools/showpiece.vite.config.ts`, port 5186 by default, `--port`
for another) and stops it, so several runs and the main dev server do not disturb each other. A film of 14.6 s at 30 frames
takes about three and a half minutes. `--ref` lays a reference video's frame beside each still: such sheets hold someone
else's footage and stay out of git.

## The pieces

| id | Title | Beats |
|---|---|---|
| `scarlet` | Scarlet Sheath · Issen, World Sever | The sword on paper, the draw (ink swirl, the red sun painted), the red sun in the dark, the cut, the rift, the eye (3D), the hole, the second cut (back to paper in halftone), sheathed, the seal 斷 |
| `raijin` | Raijin's Verdict | A war drum on paper, the strike, the storm, the lightning tree, a tomoe of lightning in a hoop of drums, the bolt at the viewer, scorched paper, the seal 雷 |
| `tide` | Tidebreaker | A drop in a still pool, the great wave in woodblock style, the teal moon, the whirlpool, the water dragon (3D) rising and roaring, the crash, still water, the seal 潮 |
| `frost` | Frost Lotus | An ice bud on paper, frost creeping, night, the lotus opening, a ring of ice blades, the frame frozen and shattered, snow on paper, the seal 氷 |
| `jade` | Jade Serpent | A bamboo grove in ink, the wind, the serpent (3D) gliding through, three wind cuts, the coil in the dark, the release as a storm of leaves, fallen bamboo, the seal 蛇 |

Films and stills: `docs/showpiece/`.
