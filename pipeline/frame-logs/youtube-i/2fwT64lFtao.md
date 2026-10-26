# Hazaze – Frigid Rush | Roblox Animation and VFX Showcase (2fwT64lFtao)
https://www.youtube.com/watch?v=2fwT64lFtao · 19.9 s · 1920x1080 · Roblox, bright anime sky, grey tiled floor. The same 9.7 s sequence plays twice (second time from another angle, 10.3-19.6), separated by a 0.3 s fade to dark (9.7-10.0).

Brightness scan (0.1 s): base L≈143 (bright sky). Small bumps at 1.8 and 2.3 (kick hits, W2-3), 3.9-4.1 (L147), one big hit at 6.9-7.1 (L184-189, W18-20, saturation up to 44 %), decaying to base by 7.8. Fade out 9.7-9.9.

## Frame log
| t (s) | on screen | visible layers | change since previous |
|---|---|---|---|
| 0.00-1.00 | wide shot, attacker dashes to a dummy | small dust | |
| 1.40 | spin kick: 3-4 thin concentric vertical arcs around the attacker (white leading edge, cyan body, grey fading tail) | crescent ribbons, additive, 25-50 % opacity | arcs start |
| 1.60 | arcs rotate with the leg, a faint ground swirl | + ground dust swirl (normal grey) | |
| 1.73 | arcs tighten into a near-full vertical circle around the kicker, brightest edge on the leading side | | peak of swing |
| 1.80 | 2 big arcs stretch up and back (2× size), a small white ground ring at the feet | crisp ring decal | scale jump |
| 1.87 | arcs detach and drift up-left, thinning, a short spark | | release |
| 1.95 | arcs fade to faint grey ghosts | | decay 0.15 s |
| 2.10 | attacker repositions, no VFX | | rest beat |
| 2.23 | contact: small cyan-white puff at the dummy and a long thin diagonal light streak shooting right | core puff, streak (beam ribbon thin) | HIT 1 |
| 2.30 | streak at full length (~5 m) with a rainbow fringe on its edge; puff ring with chromatic fringe | streak + RGB fringe | |
| 2.37 | spin again: new set of crescent arcs | | next swing |
| 2.45 | arcs + small star glint, sparks | | |
| 2.60 | arcs complete a circle around the attacker; ice flecks | | |
| 3.00-3.40 | grab/turn, small arcs, dust swirl at the feet | | |
| 3.80 | attacker winds up, no VFX | | rest beat |
| 3.87 | contact: one-frame spiky white-cyan starburst (~2 m) with thin needle rays | starburst sprite (hard spikes) | HIT 2, 1 frame |
| 3.93 | burst collapses to a small bright core, short blue spikes | | -1 frame |
| 4.00 | long thin white needle lines radiate outward at a low angle (4-6 m), a cyan ground ring appears | needle streaks, ring | |
| 4.07 | needles at full length; ring spins flat on the ground | | |
| 4.13-4.20 | needles thin out; ring becomes a cyan spiral swirl with grey dust | | |
| 4.30 | swirl + dust only | | |
| 4.50-4.80 | dust fades, dummy knocked back | | clean ~0.9 s after hit |
| 5.60 | dash ring around the attacker (thin white arc), then a jump | | |
| 5.85-6.35 | attacker high in the air above the dummy, its shadow on the ground | | hang ~0.5 s |
| 6.45 | first four-point white star glint at the dummy | 4-pt glint | telegraph |
| 6.60 | attacker dives, a white glint at the foot | | |
| 6.70 | big four-point white star glint (long horizontal and vertical points) on the diving attacker | 4-pt glint | telegraph peak |
| 6.77 | the attacker lands on the dummy; NO VFX for 1 frame | | dead frame |
| 6.83 | huge white starburst blowout centred on the impact, covers ~50 % of the frame, radial spikes, faint blue | screen-space burst (additive white) | IMPACT |
| 6.87 | burst drops to a flat radial spray on the ground: white streaks fan out, a crisp white ring on the floor | radial ground streaks, ring | -1 frame: from sphere to ground |
| 6.90 | a thin vertical white light pillar, and under it a circular frost decal with a rune band | light pillar, rune circle | |
| 6.93-7.00 | decal at full size (~6 m): six-fold frost-crystal pattern, white rim, blue body; a blue ice block encases the target; ice chunks and sparkles float upward | ground decal, ice mesh, sparkles | |
| 7.03-7.13 | pillar fading, crystals rising, white streak shards on the ground | | |
| 7.20-7.40 | decal fades from the rim inward; a thin horizontal ring hangs at chest height | ring | |
| 7.60 | soft blue ring only, sparkles twinkle | | |
| 8.00 | clean except sparkles | | |
| 9.70-10.00 | fade to dark before the replay | | |

## Technique notes
- **Kick arcs are stacks.** Each kick spawns 3-4 thin crescent ribbons at slightly different radii and tilts. They grow 2× in one frame at the end of the swing, then detach and drift away while fading to grey. That stacked look reads as speed and as a 3D sphere of motion.
- **A dead frame before the slam.** At 6.77 the attacker touches the dummy and nothing happens for one frame; the blowout comes on the next frame. Same as §10's "dead beat", but only 1 frame long.
- **The flash collapses onto the ground.** The burst is a big sphere for 1 frame, then it is flattened into a radial ground spray and a ring on the next frame. The energy visibly "lands".
- **Light streak with a rainbow edge.** Normal hits use a long thin streak with a chromatic fringe instead of a burst.
- **Rest beats between hits.** 0.15-0.3 s with no VFX between each hit, so each hit stands alone.
- **Ice signature.** A six-fold snowflake decal, a blue ice block on the target, crystals floating up. The decal keeps the ice theme after the flash is gone.
- Palette: #ffffff, #d8f2ff, #6fd0ff, #2f8ae0, dark navy #10203a for the characters.
