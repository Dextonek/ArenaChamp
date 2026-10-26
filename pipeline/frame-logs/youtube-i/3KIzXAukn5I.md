# Divergent Vfx – Acheron Ultimate | Roblox VFX (3KIzXAukn5I)
https://www.youtube.com/watch?v=3KIzXAukn5I · 11.4 s · 1920x1080 · Roblox recreation of a Honkai: Star Rail ultimate (Acheron). Palette: greyscale world, crimson red, white, black. Two effects: petal wipe + slashes in a monochrome void (0.5-6.0), crack-web finisher (7.4-10.4).

## Frame log – A: drain, petal wipe, laser slashes
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 0.50 | close-up: caster (blue hair) in a normal grey studio, a few red petals drift | petal particles (normal-blended red #e01830 with white highlight) | |
| 0.90 | petals around, hair still blue | | |
| 1.30 | the caster's hair and clothes are now grey: the character has been desaturated | character colour drain | colour switch |
| 1.70 | close-up of the sheathed blade, everything grey except red accents | | |
| 2.00 | top-down: the caster draws a long red blade; a thin red trail follows the tip | trail ribbon (red) | |
| 2.20 | wide top-down, small | | |
| 2.40 | red petals swirl in a ring around the caster, a grey spiral vortex on the floor | petals in orbit, ground vortex (normal grey) | |
| 2.55 | a red concentric spiral ring around the caster; petals rush toward the camera | ring + petals | |
| 2.70-3.10 | giant glossy red petals fill the whole frame (wipe) | petals scaled ×20, normal-blended | full-screen wipe 0.5 s |
| 3.30 | petals clear: a new world – black starry sky with a galaxy, wet reflective dark floor | world swap | |
| 3.50 | a large white crescent-moon ring (3/4 circle, glowing) stands behind the target; its reflection in the floor | glowing arc mesh + floor reflection | |
| 3.80 | a thin red laser streak from the blade tip to the target | thin beam ribbon (red, white core) | |
| 4.10 | a burst of red petals at the target | | |
| 4.40 | a red six-petal "flower star" (thin pointed petals, white centre) on the target; long red streaks cross the frame | flower-star sprite | hit 1 |
| 4.80 | the caster walks, streaks fade | | |
| 5.10-5.30 | more horizontal red laser streaks cross at different heights | | |
| 5.45 | big red-white starburst with thin needle spikes, a horizontal laser line through it | | hit 2 |
| 5.55 | a jagged red starburst with BLACK spikes inside it + a white arc sweep | red + black star | hit 2 peak |
| 5.65-5.75 | over-the-shoulder: red flower-star sparks at the target | | |
| 5.90-6.10 | close: a pink-white streak burst with orange sparks (slash) | | hit 3 |
| 6.30 | red streak + flower star at the target, moon arc | | |
| 6.50-6.70 | calm, petals fall | | |

## Frame log – B: crack web finisher
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 6.90-7.35 | slow close-up of the caster's face and raised blade, red petals floating, small bubbles | | pose hold 0.45 s |
| 7.45 | one full-screen pink-red frame with a thin horizontal cut line | flat colour card | cut flash |
| 7.55 | wide: a web of glowing red polygon crack lines covers the screen and the floor, radiating from the target; white moon arc still behind | screen-space crack overlay (additive red #ff1a2a with white centres) + floor cracks | appears at full size in 1 frame |
| 7.62-8.90 | the web holds still, a few red flakes fly; nothing else moves | | 1.35 s hold |
| 9.05 | white radial light shafts burst from the crack centre | ray fan (additive white) | release |
| 9.25 | full-screen radial speed lines, red on black | ScreenFx focus lines | impact frame 1 |
| 9.45 | the same, white on black (inverted) | | impact frame 2 |
| 9.65 | the screen breaks into red/black glass shards falling away, revealing a red wash | shattered screen | |
| 9.90 | pink-red wash | | |
| 10.20 | cream-white (#fde8dc) whiteout | | exit |

## Technique notes
- **Desaturate the world, keep one colour.** First the character, then the whole world turns greyscale; red is the only hue left. The colour switch itself is the "ultimate starts" signal.
- **Wipe with the theme particle.** The transition into the void is not a flash but the theme's own petals scaled up until they cover the screen (0.5 s), then cleared to reveal the new place.
- **A static arc as a stage prop.** A big glowing white crescent ring stands behind the target for the whole move and is mirrored in a wet floor. One calm, clean shape that all the busy hits happen in front of.
- **Red stars with black inside.** The hit stars are red with black needle spikes in them: black is used inside the bright layer (adds to §7 "black is a colour").
- **Crack the screen and hold.** The finisher draws a full-screen crack web in one frame, then holds it motionless for 1.35 s. The stillness after the sudden crack is the anticipation; then rays, two speed-line impact frames, and the screen shatters.
- Build: ScreenFx gets a crack-web overlay (polyline texture or generated Voronoi edges) and a shatter pass (screen split into ~20 triangles that fall with gravity). Petals = Emitter with a petal mesh, normal blending. Laser slashes = very thin beam ribbons that cross the whole screen in 2-3 frames.
