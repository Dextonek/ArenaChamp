# Pew – Ice Moveset Showcase | Roblox Studio VFX (HOeAQEvFDNA)
https://www.youtube.com/watch?v=HOeAQEvFDNA · 1:37 · 1920x1080 · Roblox, sepia overcast sky, dark grid floor, far wide camera, lots of dark rubble blocks from earlier moves. Three moves logged: spiral sweep (56.9-58.0), frost pillar dome (62.4-64.2), ice cathedral eruption (74.5-78).

## Frame log – A: spiral sweep (56.9-58.0)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 56.90-57.13 | caster among dark rubble blocks, nothing | | |
| 57.20 | a small blue glint at the hand | glint | 1 frame cue |
| 57.27-57.33 | nothing (crouch) | | dead frames |
| 57.40 | ~20 thin white comma-shaped streaks burst outward around the waist, bent in a spiral; blue slivers | curved streak particles (additive white, blue tail) | release |
| 57.50 | streaks longer; a white flash at the centre, blue shards spray | | |
| 57.60 | two big flat crescent arcs sweep around on the ground (radius ~5 m), thick white leading edge, thin cyan tail | ground crescent ribbons | scale jump |
| 57.80 | arcs widen to ~7 m and break into thin fragments at their ends | | erosion |
| 58.00 | clean | | total 0.6 s |
| 60.40-61.20 | same move again with a tighter double spiral (2 rings of comma streaks) | | variant |

## Frame log – B: frost pillar dome (62.4-64.2)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 62.40-62.70 | pale light shafts through the clouds above the spot | sky light rays | telegraph from the sky |
| 62.90 | calm | | |
| 63.00 | warm cream-white spiky starburst (~4 m) with long upward spikes | starburst sprite (additive #fff6d8) | IMPACT 1 |
| 63.07 | spikes stretch upward (taller than wide) | | |
| 63.13 | collapses to a vertical white column with a blue swirl at the base | pillar | |
| 63.20 | a white-blue dome (~4 m) made of puffy snow, with a crisp white arc outline hugging its top, a dark streak inside | toon puff dome (normal white, blue shade), thin outline ring | |
| 63.27 | same, slightly bigger | | |
| 63.40 | dark rubble cubes appear out of the dome surface | mesh debris (dark brown) | debris spawns from inside |
| 63.55 | dome breaks up, cubes fly outward | | |
| 63.75 | only dark cubes arcing away | | bright layer gone first |
| 64.10 | cubes falling far out | | |

## Frame log – C: ice cathedral eruption (74.5-78)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 74.50-74.60 | caster alone | | |
| 74.80 | an inverted cone ("lampshade") of thin vertical blue light lines appears above the caster, ~6 m wide at the top, converging to the caster | line-ribbon cone (additive #6fb8ff, white top rim) | telegraph |
| 75.00 | cone grows a little, white top rim brighter | | |
| 75.20 | cone at max width | | |
| 75.35 | cone narrows (top ring shrinks to ~3 m) | | implode |
| 75.40-75.43 | cone narrow, tall | | |
| 75.47 | eruption: cream-white crystal spikes burst outward 3-4 m, cyan base | spike shards (hard-edged, normal-blended white with cyan edges) | IMPACT |
| 75.50-75.53 | spikes thicken into a dense cluster with frost cloud puffs | | |
| 75.60 | mound of crystals ~6 m wide, white-cream with cyan rim puffs | | |
| 75.70-76.20 | cluster at full size, small shards still spraying, frost puffs rolling at the rim | | hold |
| 76.60-77.40 | camera orbits, cluster shrinks slightly, dark rubble passes in the foreground | | slow decay |
| ~78 | gone | | |
| 82, 85-87 | bigger variants: wider clusters, a V-shaped cyan wing flash at 87 | | |

## Technique notes
- **Light cone telegraph that implodes.** Thin vertical light lines arranged on an inverted cone mark the spot; it widens, then narrows for 0.1 s before the eruption. A cheap, very readable "something comes down here".
- **Warm white for the flash, cold for the body.** The starburst at 63.0 is cream-white, the dome and crystals cold blue-white. The temperature shift separates the hit from the result.
- **Debris comes out of the bright volume.** Dark cubes appear from inside the snow dome and outlive it by ~0.6 s: bright volume first, dark debris last.
- **Crystal cluster = spikes + frost puffs.** Hard spike shards in the middle, soft cloud puffs only at the rim. Solid ice reads because the puffs are kept small and outside.
- **Spiral comma streaks.** The sweep is many short curved streaks that all bend the same way, then two large ground crescents. Many small → two big.
- Build: line cone (16-24 thin vertical quads on a cone, additive), StarBurst for the flash, instanced crystal mesh (cone/prism shards, normal-blended white with cyan fresnel), SmokeBall puffs at the rim, instanced dark cubes with gravity.
