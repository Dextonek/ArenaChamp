# TrendyV2 – ROBLOX VFX Guide #1 - Particles (xzZeP65SSlA)
https://www.youtube.com/watch?v=xzZeP65SSlA · 7:14 · beginner guide (368K views). Chapters: Intro 0:00, What is VFX? 0:44, Tween 1:40, Particles 2:26, Particle Emitter Properties 3:08, Making a Fire Effect 4:40, Outro 6:20. No transcript was available in the page; the notes come from the burned-in captions and the Studio panels visible in frames (sampled every ~10-25 s, denser 4:40-6:30).

## Frame log (guide steps)
| t (s) | on screen | what is shown |
|---|---|---|
| 10 | intro montage: a character in a bright sky arena casting | the goal look |
| 50 | slide "Particles": a red beam on one side, white on the other | VFX = two families: tweened parts/meshes and particles |
| 100-146 | talking-head section (Tween) | moving/scaling a part or mesh over time with easing is the other half of Roblox VFX |
| 150-170 | empty Studio baseplate, dark sky; an attachment with a ParticleEmitter added | |
| 200 | "COLOR": a vertical stream of particles going from red to green | Color is a gradient over life |
| 226 | "TRANSPARENCY": particles fade along the stream; a curve editor window | Transparency is a curve over life |
| 250 | "LIFETIME": short stream ending in puffs | Lifetime controls how far they travel before disappearing |
| 265 | "SPEED" | speed sets the length of the stream |
| 276 | "SPREAD ANGLE": particles fan out into a wide cone | spread turns a jet into a burst |
| 284-292 | a free plugin is installed through Manage Plugins | a texture/flipbook helper |
| 310 | a texture id pasted into the emitter; the stream becomes a column of white flame frames | flame flipbook texture |
| 314 | "THE FLIPBOOK": Flipbook layout set in the emitter (grid), FlipbookMode | animated texture per particle |
| 326 | colour picker: the white flipbook is tinted | white texture + Color = any element |
| 332 | tall yellow column | speed too high |
| 338 | a single large yellow-orange flame (speed down, size up) | the flame shape comes from the flipbook, not from motion |
| 343-352 | "THE CORE": a second, smaller, brighter emitter inside the first | outer flame + bright inner core |
| 358 | "TURN DOWN": emission rate lowered | fewer, bigger particles read better |
| 366 | "FADE OUT": transparency keyed to 1 at end of life | |
| 374 | finished flame: orange outer, yellow core | |
| 381-390 | side-by-side: one flame with a dark smoke emitter behind it, one without | dark smoke behind the flame adds depth |

## Technique notes
- **One white flipbook, tinted by colour-over-life.** A greyscale/white flipbook texture is reused for every element; the gradient provides the colour. Keeps a library small.
- **Shape from the texture, motion from speed.** Speed and spread are kept low; the animated texture gives the flame its look. Too much speed turns a flame into a jet.
- **Outer + core.** Two emitters at the same spot: a larger orange outer flame and a smaller, brighter yellow-white core with a shorter life. Our kit: two `Emitter`s, the core with smaller size and `colorStart` near white.
- **Fewer, bigger particles.** Lowering the rate made the fire cleaner.
- **Dark smoke behind** (already §3/§4 in our rules) is demonstrated as a before/after.
- Our kit lacks per-particle flipbook animation in `Emitter`: a NEW option `flipbook: {cols, rows, fps}` on the Points/sprite material would let us use flame/smoke sheets.
