# righteous – vfx practice | Roblox animation (cL3SOjXcMlU)
https://www.youtube.com/watch?v=cL3SOjXcMlU · 15.9 s · 1920x1080 · Roblox Moon Animator cutscene, JJK-style fight. Gore in the video is described here only as stylised red splash strokes. Two VFX moments: a cyan punch with an X-ray impact frame (0.3-2.4) and an "invisible" slash told through black-screen graphics (8.6-11.3).

## Frame log – A: cyan punch (0.3-2.4)
| t (s) | on screen | visible layers | change since previous |
|---|---|---|---|
| 0.40 | close-up of the target's face, big translucent cyan wisps cross the frame | soft cyan sheets (additive, ~30 %) | wind-up wash |
| 0.50 | a cyan glowing ball (white core, soft cyan halo, slight refraction) appears at the target's forehead | glow sphere | the fist's energy arrives |
| 0.57 | 2-3 hard-edged cyan brush strokes shoot in from the left at eye level | flat toon strokes (opaque cyan #3fd6ff) | |
| 0.63 | ball bigger, strokes stretch across the face | | |
| 0.70 | the ball becomes a ring of cyan shards and straight cyan slivers radiating | radial shard strokes | |
| 0.77 | the face is tinted cyan, a faint dome outline | full-face colour wash | |
| 0.83 | dark frame: black and cyan speed lines cross diagonally | speed lines (black + cyan) | darkening |
| 0.90 | dark navy frame filled with straight parallel neon cyan bars (white core, cyan glow) | neon bars | |
| 0.97 | diagonal split: black upper-right, white lower-left | 2-tone impact card | impact frame 1 |
| 1.03 | X-ray: a flat cyan skeleton silhouette of the target on pure black | skeleton card (flat #2fb8ff on #000) | impact frame 2 |
| 1.10 | split card again, inverted (white wedge top-left, black elsewhere) | | impact frame 3 |
| 1.17 | back to 3D: the target's head with a white skull drawn over it, horizontal motion-smear streaks across the frame | white skull overlay, smear streaks | transition frame |
| 1.23 | contact shot: fist in the face, thin black horizontal speed lines, red splash starts | | real-time again |
| 1.30-1.50 | red splash strokes (thin, curved, brush-like, dark red #8a0010 to #d01020) fan out and hang | ink strokes (normal) | hit-stop: the image barely moves for ~1 s |
| 1.60-2.20 | strokes still hanging, more thin drips, camera static | | slow decay |
| 2.40 | cut to a new shot | | |

## Frame log – B: invisible slash (8.6-11.3)
| t (s) | on screen | visible layers | change since previous |
|---|---|---|---|
| 8.60-9.80 | slow close-ups of the hands and the body, no VFX at all | | 1.2 s held stillness |
| 9.83 | last 3D frame (hand edge) | | |
| 9.87 | dark navy screen with a thick vertical black band outlined in white glow | black band with white rim | cut to the graphic |
| 9.90 | the band rotates (≈30°) | | |
| 9.93 | ≈45°, band slightly thinner | | |
| 9.97 | ≈60°, thinner | | |
| 10.00 | ≈70°, thinner | | |
| 10.07 | almost horizontal, now a hairline with white glow | | |
| 10.13 | hairline, steady | | the cut "closes" |
| 10.20 | full white frame | | flash |
| 10.27 | white frame with a black outline skeleton of the target and a black diagonal band | inverted X-ray card | impact frame |
| 10.33 | black frame with a white diagonal wedge | 2-tone card | impact frame |
| 10.40 | 3D close-up of the attacker, a thin white line still across the frame | | back in the world |
| 10.47-10.60 | the target: a red diagonal line across the torso, red splash strokes and specks | | result |
| 10.70-11.30 | specks drift slowly, splash hangs | | hold |
| 11.70+ | attacker reaction close-ups | | |

## Technique notes
- **Impact frames as a 3-card sequence:** split card → X-ray skeleton card → inverted split card, each 2 frames. The X-ray uses one flat colour (cyan on black, or black outline on white) and reads instantly as "this hit goes through the bone".
- **Show the cut path, not the blade.** The slash is told on a dark screen: a thick black band with glowing white edges rotates and thins to a hairline in 0.25 s, i.e. the blade's swept plane seen edge-on. Then white, then the X-ray card.
- **Stillness first.** 1.2 s of close-ups with no effects before the slash. The quiet makes the graphic sequence hit harder (extends §10 "dead beat" to a longer held tension).
- **Energy arrives before the fist.** In A the glowing ball appears on the target's face before contact; strokes come in from the side; the face gets tinted the move's colour.
- **Hit-stop with hanging splash.** After contact, the splash strokes freeze in the air for ~1 s while the camera holds: the frozen splash *is* the hit-stop.
- Build: a camera-attached overlay plane for the cards (ScreenFx), a skeleton silhouette texture (new), a rotating band quad with a white rim shader, thin brush-stroke ribbons for the splash (normal-blended, dark red or the element colour).
