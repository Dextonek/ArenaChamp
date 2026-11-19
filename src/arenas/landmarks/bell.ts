import { cycle, type LandmarkPose } from '.';

/**
 * The Night Temple's great bell (blender/arenas/landmarks/bell.py): in a loop of 30 s it is set swinging, swings slowly (6 s a swing
 * there and back) for most of the loop and dies down to a faint sway before it is set going again. Its clapper hangs back against the
 * swing and strikes at each end of it; the ring of light on the lip answers each stroke, kept low. Parts: bellbody > (clapper, ring).
 * The bell swings along the model's x about its headstock (the part's own origin), so it turns about z.
 */
const SWING = 6;
const CLAP = 0.42; // how far the clapper leans from the bell at a stroke (rad)
export const bellPose: LandmarkPose = (p, t) => {
  const e = cycle(t, 30, 0.04, 0.2, 0.68, 0.92);
  const amp = 0.05 + 0.23 * e;
  const ph = (2 * Math.PI * t) / SWING;
  const a = amp * Math.sin(ph);
  p.turn('bellbody', 0, 0, a);
  p.turn('clapper', 0, 0, (-CLAP * a) / 0.28);
  // a stroke at each end of the swing: the light flares there and fades, never above a low glow
  const hit = Math.abs(Math.sin(ph)) ** 40 * Math.min(1, amp / 0.2);
  p.glow('ring', 0.2 + 0.8 * hit);
};
