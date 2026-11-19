import type { LandmarkPose } from '.';

/**
 * Frostfall Lake's Hourkeepers' orrery (blender/arenas/landmarks/orrery.py): three nested rings turn about its pole at different
 * speeds (each ring's own turn is added to its parent's, so the three net speeds differ again), three planets circle on brass arms
 * at their own heights, and the little sun breathes. Nothing quick: one slow turn of the outer ring takes about a minute and a half.
 * Parts: ringA > ringB > ringC, arm1..arm3, sun, plinth. In the model's space y is up and +z its front.
 */
export const orreryPose: LandmarkPose = (p, t) => {
  p.turn('ringA', 0, 0.07 * t, 0);
  p.turn('ringB', 0, -0.12 * t, 0);
  p.turn('ringC', 0, 0.19 * t, 0);
  p.turn('arm1', 0, 0.52 * t, 0);
  p.turn('arm2', 0, 0.29 * t, 0);
  p.turn('arm3', 0, 0.17 * t, 0);
  p.glow('sun', 1 + 0.12 * Math.sin(t * 0.5));
};
