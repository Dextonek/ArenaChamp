import { cycle, type LandmarkPose } from '.';

const PERIOD = 7;

/**
 * The Ember Caldera's forge automaton (blender/arenas/landmarks/automaton.py): every 7 s its right arm lifts the hammer slowly
 * overhead, holds a moment, and brings it down on the ingot in about half a second; the ingot flares at the blow and cools again.
 * The model's rest pose is the blow (hammer on the ingot). Parts: torso > head, armR > foreR > hammer, armL > foreL, ingot.
 * In the model's space y is up and +z its front; a positive turn about x tips a part's front down.
 */
export const automatonPose: LandmarkPose = (p, t) => {
  const up = cycle(t, PERIOD, 0.04, 0.58, 0.65, 0.71);
  p.turn('armR', -1.55 * up, 0, 0);
  p.turn('foreR', -0.75 * up, 0, 0);
  p.turn('hammer', 0.95 * up, 0, 0);
  p.turn('torso', -0.07 * up, 0, 0);
  p.turn('head', -0.06 * up, 0, 0);
  p.turn('armL', 0.04 * Math.sin(t * 0.9) * (1 - up), 0, 0);
  // the glow: low and steady, a short flare at the blow (0.71 of the loop), cooling over a few seconds
  const since = ((((t / PERIOD) % 1) + 1 - 0.71) % 1) * PERIOD;
  p.glow('ingot', 0.8 + 1.3 * Math.exp(-since * 1.6));
};
