# Hoj Dee – UE4 Niagara: Improve fights: 110 VFX [Animtrail - Dash - projectile - Explosion...] (gSQUO3htovo)
https://www.youtube.com/watch?v=gSQUO3htovo · 2:50 · asset-pack showcase (stylised Niagara), 5 years old. Mostly small effects on a mannequin in a curved showroom. Overview sampled every 7 s; the "ground landing" set (100-116) logged in detail, and one landing (107.2-109.0) frame by frame.

## Overview
| t (s) | content |
|---|---|
| 3-32 | in-game demo in realistic and stylised forest environments (dash trails, hits) |
| 39-96 | anim trails, projectiles, sparks, small explosions in the showroom |
| 100-116 | ground landing / stomp rings in 6 element colours (ice, gold, nature, earth-fire, frost, arcane) |
| 117-160 | hit sparks, flashes, coloured puffs, star pops |

## Frame log – earth-fire landing ring (looping preview)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 106.50 | dark brown dirt patch on the floor under the mannequin, green dust balls, a glowing orange ring | ground decal (normal #3a2010), ring (additive orange) | |
| 107.20 | two concentric rings: white-hot inner edge, orange outer glow; small dark chunks thrown out; green motes | createRing ×2, mesh-debris | |
| 107.40 | rings expand, a third ring spawns at the centre | | new ring every ~0.3 s |
| 107.50-107.63 | three rings at different radii, the outer one fading; chunks in the air | | |
| 107.70-107.95 | outer ring gone, inner rings grow; ember specks rise | | |
| 108.10-108.30 | dirt patch darker and wider; rings 2-3 | | |
| 108.60-109.00 | cycle repeats | | loop ~0.9 s |
| 112.50-114.00 | arcane variant: violet floor glow, magenta ring of sparks, dark chunks | | |

## Technique notes
- **Element variants share one structure:** ground decal + 2-3 expanding rings + small chunks + a few motes. Only colours and the decal texture change (ice: white frost; earth: dark dirt; arcane: violet glow).
- **Rings with a white-hot inner edge.** Each ring is brightest on its inside edge, fading outward, so the ring reads as heat pushed outward.
- **Dark dirt patch under bright rings.** The normal-blended dark decal makes the additive rings readable on a light floor.
- Our kit already covers this (createRing, ground decal, instanced debris); the recipe is a compact "landing stomp" template.
