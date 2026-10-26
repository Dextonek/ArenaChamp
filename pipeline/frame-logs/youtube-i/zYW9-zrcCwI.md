# Narasuna – UNCUT ROBLOX VFX GUIDE: Tornado (zYW9-zrcCwI)
https://www.youtube.com/watch?v=zYW9-zrcCwI · 40:12 uncut build in Roblox Studio (39K views). No chapters or transcript. Frames sampled every ~100-200 s, denser near the finished result (2013-2370 s).

## Frame log (build steps)
| t (s) | on screen | step |
|---|---|---|
| 30 | empty checker baseplate | start |
| 330 | one vertical column of white particles from a single emitter | particles emitted along a vertical line |
| 427 | the column is now a stack of thin flat white rings | particles set to face up (flat, horizontal orientation) with a ring texture, many spawned along the height: a "spring" |
| 520 | a few white C-shaped swirl wisps spinning around a point | a crescent/swirl texture with high rotation speed instead of the ring |
| 625 | close-up of the swirl texture: bright hooked strokes, soft glow, transparent gaps | the key texture: a hand-drawn swirl with 3-4 hooked strands |
| 720 | the plugin manager | helper plugins |
| 900 | swirl particles stacked into a cylinder, fading near the bottom | |
| 1022 | a single swirl ring at the top | building the tornado from separate height slices |
| 1120 | a cone: the slices get bigger with height; light blue | size grows with each attachment's height → cone |
| 1220 | solid saturated-blue cone | colour set to deep blue with light emission |
| 1320-1418 | extra low wide swirls at the foot spreading on the ground | ground wisps added at the base |
| 1520 | bright flat halo at the top | top ring brighter |
| 1617-1700 | a twisted vertical double helix beam runs through the centre, past the top | two Beam objects with a twist texture as a core |
| 1815-1920 | cone with fewer, clearer swirls; the helix is gone | the core beam was removed again: cleaner |
| 2013 | cone of blue swirls + a bright round disc at the foot + a flat wide halo above | base glow disc and top halo |
| 2110 | a size-over-life curve editor window | each slice gets a size curve (grow, hold, shrink) |
| 2250-2370 | final: compact blue cone tornado, narrow foot with a bright ring, wider top, swirls rotating at different speeds | finished |
| 2390-2405 | end-card clips | |

## Technique notes
- **A tornado is a stack of flat swirl slices.** 6-10 emitters (or one emitter with a spawn height range) each spawn horizontal, camera-independent swirl sprites at one height; the sprite size increases with height, which gives the cone. No mesh needed.
- **The texture does the work.** A hand-drawn swirl with 3-4 hooked bright strands and transparent gaps. Fast per-particle rotation makes it read as wind.
- **Different spin per slice.** Neighbouring slices rotate at slightly different speeds so the stack never looks rigid.
- **Anchor the ends.** A bright glow disc at the foot and a flat halo at the top close the shape; low ground wisps connect it to the floor.
- **Remove what doesn't help.** A twisted helix beam was tried as a core and then removed: the cone reads better without the extra bright centre (matches §1 restraint).
- Our kit: `Emitter` with flat horizontal sprites is missing. NEW option `orient: 'up'` (sprites as horizontal quads, e.g. an InstancedMesh of planes) plus a swirl texture; `CrescentArc` rings on many tilted planes (§8) are the closest existing part.
