# Poom – Roblox VFX | Astral Shot | Ishtar(HSR)-inspired (y083IZMPV7g)
https://www.youtube.com/watch?v=y083IZMPV7g · 13.2 s (the 6.5 s cutscene plays twice; log covers 0-6.5) · 1920x1080 · Roblox cutscene, deep navy night sky with a mountain horizon.

Brightness scan (0.1 s): base L≈32 with 44% saturated navy (#11306e). 1.2 first sparkle peak (L54). 2.0-3.9 slow ramp (L50→76) as the portal charges. 4.0 hard cut to a near-black frame (B59), 4.4 white beam head (W35), 4.5 cut back to blue, 4.7 dark, 4.8 bright (L143) dome hit, 5.0-5.4 dark frame with dome (B48→30), 5.5-6.1 ramp to whiteout, 6.2-6.5 full white hold (W99), then restart.

## Frame log
| t (s) | on screen | visible layers | change since previous |
|---|---|---|---|
| 0.20 | low close shot of the caster, hands raised, faint cyan glow on the body | rim light (cyan) | |
| 0.80 | same, hands framing | | idle hold 1 s |
| 1.15 | wide sky shot: 3-4 huge four-point stars (white core, cyan halo, long thin points) | flat 4-point star sprites, additive #bff8ff/#2fe0ff | stars pop in at full size in 1 frame |
| 1.25 | each star now sits inside a thick cyan ring (white inner edge) | crisp ring + star | rings added, stars shrink |
| 1.50 | rings gone; 4 small white star glints around the caster and 4 short magenta slivers pointing inward | small glints, pink streaks | everything converges inward |
| 1.90 | one magenta glowing orb (white centre, soft pink halo) with a thin cross flare | glow sphere #ff5ad8 | merge into one point |
| 2.05 | the orb opens into a portal: black disc core, white then pink concentric rings, 4 cyan compass points (long diamonds), magenta crescent arcs orbiting outside | black core (normal), crisp rings, diamond spikes, crescents | scale jump ~4× |
| 2.40 | black smoke puffs with pink/cyan rims bubble around the ring, compass rotates slightly | toon smoke (normal black, coloured rim) | dark layer grows |
| 2.80 | puffs fill out to a cloud collar; a white spark forms in the core | | |
| 3.20 | white particle stream shoots from the core to the right (beam charge), a thin cyan horizontal line on the horizon | stream of white specks, horizon line | charge direction shown |
| 3.60 | stream thicker, horizon line brighter | | |
| 3.90 | burst of thin cyan spike rays around the portal, beam emerges | spike fan (additive cyan) | RELEASE |
| 3.93 | rays maxed, pink-white core | | |
| 3.97 | hard cut: empty wide landscape (the target zone) – 1 frame | | establishing flash-cut |
| 4.00 | black frame with grey diagonal speed streaks | streak lines on black | tracking shot begins |
| 4.03 | streaks denser | | |
| 4.10 | streaks tinted blue/magenta, a white comet head enters at top-left | | |
| 4.20 | magenta/violet diagonal streak field, white head growing | | |
| 4.30 | white beam body fills a diagonal band, magenta streaks around it | beam ribbon (white core, magenta flanks) | |
| 4.40 | white band covers ~50% of frame | | brightest (W35) |
| 4.47 | white band passing | | |
| 4.60 | cut to wide: thin cyan beam crossing the sky with 3-4 white rings threaded on it at intervals, moon in sky | beam + spaced ring hoops | |
| 4.70 | beam hits the far ground: a magenta half-dome flash with white core, ring hoops still flying | dome flash | IMPACT |
| 4.80 | a big translucent white dome swallows the frame edge (camera close) | fresnel dome (additive white) | L143 |
| 4.87 | dome rim visible, magenta-white hemisphere glowing at the base, 2 white tilted ring outlines floating in the sky | dome + floating rings | |
| 4.93 | dome shrinks back to a hot magenta-white hemisphere, black rubble specks on its base | | |
| 5.00 | dome hemisphere with cyan streaks inside, black rubble chunks around the base | black rubble (normal) | |
| 5.10 | dome grows; blue-cyan interior, pink rim, black debris rising | | slow growth phase |
| 5.25 | dome with rotating cyan interior swirl, white top rim | | |
| 5.40 | black jagged smoke clumps on the dome's outline | toon black smoke on the edge | |
| 5.55 | dome bigger, white rim brighter, magenta skirt at the base | | |
| 5.70 | dome fills half the frame, black chunks and cyan smoke spray outward | | |
| 5.85 | camera very close, dome surface cyan/teal with white highlights, black smoke in front | | push-in |
| 5.95 | frame dominated by pale cyan/magenta wash | | |
| 6.05 | pink-white | | |
| 6.15 | white | | |
| 6.20-6.50 | pure white hold | | exit through white |

## Technique notes
- **Stars become rings become one orb.** The charge is built from flat 4-point star sprites (hard-edged, long thin points) that first appear huge, then gain a ring, then shrink and converge to one magenta orb. Three states in 0.75 s, each a different simple shape.
- **Compass portal.** Black disc + 2 crisp concentric rings + 4 long diamond spikes at N/E/S/W + orbiting crescents. All flat camera-facing meshes; only rotation and scale animate.
- **Toon smoke collar.** Black, normal-blended cloud puffs with a coloured (pink/cyan) rim hug the portal. The dark collar makes the neon ring pop.
- **Tracking shot through the beam.** For 0.5 s the camera rides beside the beam: a black frame with diagonal speed streaks that change from grey to blue/magenta, then the white beam head fills half the frame. It reads as speed without showing the world.
- **Beam with hoops.** In the wide shot the beam is thin and has 3-4 white rings threaded along it at even spacing (the rings travel with the beam and keep flying after it ends).
- **Dome impact grows slowly.** The hit is a magenta-white flash, then a hemisphere that grows for ~1 s (cyan swirling interior, white rim, pink skirt, black rubble and black jagged smoke on its outline) while the camera pushes in, ending in a white hold.
- Palette: navy #0c1f4a, cyan #2fe0ff, white, magenta #ff3fc8, violet #7a3cff, black. Cyan for charge and beam, magenta for the hit.
- What reads well: one hue swap per phase (cyan charge → magenta impact), black shapes (core, smoke collar, rubble) framing every bright element, and a big scale jump at every state change.
