# YAZEEN RYU – Real-Time VFX Showreel | Unreal Engine 5 Niagara (NComttnprDU)
https://www.youtube.com/watch?v=NComttnprDU · 1:34 · recent UE5 reel in a realistic Korean courtyard at dusk (cherry trees, round sand pad). Semi-realistic fire. Two effects logged: fire rune eruption (21-28) and golden flame-slash sphere (50-57.5).

## Frame log – A: fire rune eruption
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 21.0 | empty sand pad | | |
| 22.5 | a golden rune circle burns itself onto the pad (thin bright lines, arcs and glyphs), small flame tongues along the lines | burning rune decal (additive #ffc040), flame sprites | telegraph = the circle itself |
| 23.5 | a tall single flame jet in the centre (~3 m), rune bright | flame column | first eruption |
| 24.3 | several flame columns of different heights inside the circle, embers rising | flipbook flames, ember emitter | |
| 25.0 | flames thicker, sparks drift up and sideways in the wind | | peak |
| 25.8 | new thin flame spikes pop at random spots | | flicker sustain |
| 26.8 | 3-4 thin flame spikes, rune fading | | decay |
| 28.0 | clean pad, a faint scorch | | |
| 29.5-34.0 | variant: one ember spark, then a horizontal flame sweep over the pad, a fire burst, embers | | |

## Frame log – B: golden flame-slash sphere
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 50.0 | a small fire bolt flies in horizontally from the left | projectile with flame trail | travel |
| 51.0 | empty | | dead beat |
| 51.7 | a sphere cage of golden fire crescents around a figure: 3-4 wide arcs on tilted planes, bright yellow edges, orange body, ragged flame tails | flame crescent ribbons on many planes (additive) | 1-frame appearance |
| 52.3 | arcs redrawn on new planes, gold spark specks inside | | re-spawn every ~0.5 s |
| 52.8 | a near-complete sphere outline | | |
| 53.3 | a horizontal ring arc + a vertical arc (gyroscope look) | | |
| 53.8-54.4 | arcs thinner, more sparks | | |
| 55.0 | arcs gone, a cloud of gold embers floats | | |
| 55.8 | embers sink to the pad | | |
| 57.5 | clean | | |

## Technique notes
- **The rune burns in before the fire.** The telegraph is the burning rune itself: lines light up as thin fire before anything erupts (similar to §10 "draw the telegraph", here with fire instead of a moving spark).
- **Uneven eruption.** Several flame columns of different heights, popping at random places inside the circle, instead of one big pillar; sustain by new spikes, not by brightness.
- **Gyroscope of slashes.** The sphere is made from 3-4 crescent arcs on tilted planes, redrawn every ~0.5 s on new planes (§8 "many tilted planes"); the slash reads as a sphere of blade energy.
- **Embers end it.** Every fire effect ends with floating embers drifting down, not a smoke cloud.
- Build: rune ground-decal with a radial "burn-in" reveal, Emitter flames (needs flipbook, see guide notes), CrescentArc ×4 with random tilt, re-spawned twice; ember Emitter with gravity 0.3 and drag.
