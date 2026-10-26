# Style notes from batch-f (new insights, not already in VFX_PRINCIPLES §6-§7)

- **Weapon trails are multi-strand silk, not one band.** The scythe ribbon (Zedkiel) is 5-7 thin bright parallel
  strands inside one ribbon, with eroded, stringy ends, coloured hot at the blade and cooler pink at the tail.
  The trail already exists on the idle weapon, so the swing only stretches it and idle and swing look the same.
- **A slash can be smoke.** The Roblox "swipe" moves draw the crescent as soft, semi-opaque, normal-blended grey-white
  smoke that drifts in the swing direction, plus a 25% ghost arc that lingers ~0.4 s. That reads as speed and wind,
  where a hard additive blade reads as a laser.
- **Monochrome works if beats are marked by colour grade.** A zero-hue effect (white / greys / black on a dark blue
  scene) never clashes. Its beats are marked by one sepia/brown graded frame or a pink-white blowout frame with
  black silhouettes, a gentler impact frame than full value inversion.
- **Strobe the impact flash.** The meteor hit alternates flash / normal / flash / normal / flash at 12 fps for ~0.4 s.
  Three short flashes feel bigger than one long white-out and keep the scene readable in between.
- **The telegraph is a shadow or a glyph, not a ring.** The meteor's warning is its own shadow sliding and growing on
  the ground. The Beyond-FX pillar's warning is a half-sun glyph that collapses one beat before the strike. Both
  carry the theme and the timing in one shape.
- **Big flat shapes for ground breakage.** Use 6-8 large dark triangular plates that tilt up around the crater and
  later sink (swipe slam), or dark rock wedges between molten petals (Beyond-FX). Avoid many tiny rocks. The
  crater reads as a flower: bright petals alternating with dark wedges.
- **Give each weapon of a set one icon, then repeat it.** The Spiderlily set reuses one gold stamen-burst
  (radial curved strands) on every item. The effect follows the object's structure: a fan gets a radial fan of
  flame tongues, a book gets mirrored wings, a staff orb gets a petal cage. Idle loops use opposing motion (petals
  scroll up, dust drips down) instead of more brightness. Ignition is a ~1 s ramp: falling petals, then strand
  bloom, then a tiny white core with a horizontal anamorphic lens streak.
- **Cool-on-warm only at the exact impact point, only for 2-3 frames.** A blue-white four-point star sits at the
  base of a warm fire pillar (Beyond-FX), and a thin magenta line crosses an orange explosion (meteor). The rest of
  the effect stays in one temperature. A cool accent placed exactly where and when the hit lands works like a
  small, local impact frame.
- **The cinematic (Niagara/Houdini) quality comes mostly from the camera.** Compared with the stylised Roblox
  work, the UE5 piece gets its quality from fog lit from inside by off-screen flashes, exposure blowouts that
  recover over ~0.3 s, chromatic-aberration fringes, motion blur, and a time ramp into slow motion for the payoff.
  It has no hard 2D shapes. Lightning there uses three thicknesses at once (main / branch / micro-filament), each
  redrawn on its own clock, and the energy visibly travels ground -> body -> arm -> target.
- **Make the beauty shot the longest hold.** The cinematic piece spends ~6 s on the slow-motion aftermath (beam
  through floating dark rock plates) and ~1 s on the strike. In gameplay, shorten this to a ~2-3 s slow fade. Stop
  camera shake during the slow hold, slow the arc redraw rate to fake the time ramp, and keep dark foreground debris
  in front of the bright beam for depth.
