# VoxyDev – Roblox Studio: VFX showcase Lanza Del Relampago (l_sIXrFQdZE)
https://www.youtube.com/watch?v=l_sIXrFQdZE · 14.5 s · 1920x1080 · Roblox, blue-sky baseplate with a yellow-lit grid floor; Bleach-inspired green lightning spear thrown at the horizon.

Brightness scan (0.1 s): base L≈82. 0.7 small pop. 2.1 small flash (throw). 3.9 far flash (L102). 4.4 big whiteout (L154, W33). 4.7-8.4 the whole frame is dark (B 52-67 %, L≈30) with green as the only colour (#2fae7e): a 3.7 s darkened hold. 8.6 second whiteout (L197, W44). 8.9 back to normal sky. 13.5-14.4 fade to black (end of video).

## Frame log
| t (s) | on screen | visible layers | change since previous |
|---|---|---|---|
| 0.50 | caster standing mid-frame, calm sky | | |
| 0.63-0.67 | nothing yet | | 2 still frames |
| 0.73 | burst at the caster: 6-8 flat green-cyan leaf/blade shapes fanned upward like a flower, white cores; a black smoke cloud billows behind them | hard-edged blade sprites (additive #3dffb0 / white), black smoke (normal) | 1-frame pop at full size |
| 0.80 | blades fly out radially as long thin green streaks (some 4-6 m), a faint pale dome outline, green spark crackles, black smoke spreading | streak particles, dome shell, sparks | burst expands |
| 0.90 | small green lightning ticks scatter on the ground and in the air, smoke dissolving | lightning-arc bits | |
| 1.20 | a few green crackles around the caster | | decay |
| 1.80 | the caster crouches, a green glow at the hand | glow sphere (green) | charge |
| 2.00 | green aura flame around the caster | | |
| 2.07 | throw: a vertical green-cyan bulb of energy above the hand, pale white wind arcs sweep around the screen (big translucent white sheets) | soft wind crescents (normal white, 30-40 % opacity), green flame | release |
| 2.13 | a thin green beam shoots straight up, wind arcs still on screen | beam ribbon green | |
| 2.20 | beam thins, a small green spark at its tip | | spear leaves |
| 2.60 | a small green star high in the sky, travelling away | glint | travel ~1.2 s |
| 3.00 | the spark is a speck above the horizon | | |
| 3.80 | camera now looks at the far horizon; a tiny flash | | |
| 3.87 | a flat green-cyan disc flash on the horizon + grey dust band | horizon flash, ring dust | IMPACT (far) |
| 3.93 | a white mushroom/horned blob rises (white hard-edged shape with two horns) | white flat cloud shape | |
| 4.00 | a twisted tall white-cyan pillar with a grey ring at its base | pillar | |
| 4.20 | a green dome with dark centre on the horizon, sky behind turns stormy | dome | |
| 4.37 | white blowout covering the horizon band, green rays shooting up | screen blowout (horizontal band) | |
| 4.43 | white | | flash peak |
| 4.50 | the sky is now dark; a huge translucent grey-white ring shockwave (horizontal) spreads along the horizon; green blades inside | horizontal ring wall (normal, light grey) | world darkens |
| 4.60 | ring passes the camera; inside it a cluster of tall green blade shapes | | |
| 4.70 | ring gone; green blades slanting like a burning bush on the horizon, pitch-dark sky | | dark hold begins |
| 5.00-6.20 | a pulsing cluster of green flame/lightning blades on the horizon, white-green core, small blades thrown sideways | hard blade sprites (additive green/white) re-spawned every ~0.2 s | sustained flicker |
| 7.00 | blades lean outward like a crown | | |
| 7.80 | a vertical green light column grows out of the cluster | light pillar | build |
| 8.30 | column brighter and taller | | |
| 8.47 | the column is wide and bright, sky regains a bit of colour | | pre-flash |
| 8.57 | full white frame | | 2nd IMPACT |
| 8.70 | normal sky returns; green blades flying sideways, dark smoke clouds on the horizon, a long white streak | blades, smoke | world restored |
| 8.90-13.4 | calm wide shot, debris gone, caster still | | long clean hold |

## Technique notes
- **Leaf-flower burst.** The cast pop is 6-8 flat, hard-edged leaf/blade sprites fanned upward from one point like a flower, with a big black normal-blended smoke cloud behind them. Then the blades fly off as long streaks. Shape first, the colour just green and white.
- **Throw = thin vertical beam + wind sheets.** At the throw the effect is very thin (a needle beam) while big pale wind sheets sweep the screen around it: thin focal shape, big soft framing.
- **Distant impact staged on the horizon.** The payoff is seen far away: a flat flash on the horizon, a white horned mushroom silhouette, a twisted pillar, then a whiteout band. The far distance makes it look huge.
- **The world goes dark after the hit, not before.** Right after the whiteout the sky and floor drop to near black (B ≈ 60 %) for 3.7 s, while the green blade cluster keeps flickering on the horizon. The darkness is the aftermath and lets the green glow carry the frame.
- **Horizontal ring wall.** A giant translucent grey ring travels along the ground toward the camera and passes it (0.2 s): a shockwave you feel because it crosses the lens.
- **Second blowout ends the darkness.** A column grows out of the cluster, then one white frame, and the normal sky returns. Bright → dark hold → bright → normal.
- Build parts: blade sprites (hard alpha leaf shape, additive), black smoke ball, horizon pillar, very large ring (ring-shockwave scaled to 60+ m), ScreenFx darken for 3.7 s.
