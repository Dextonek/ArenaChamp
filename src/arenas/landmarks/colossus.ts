import type { LandmarkPose } from '.';

/** Where the colossus looks (radians of yaw off straight ahead), one place every 8 s: across the ring and back, with a pause at each. */
const GAZE = [0, -0.5, -0.15, 0.45, 0.1, 0.55, -0.35, 0];
const STEP = 8, TURN = 2.6;

/**
 * The Sandstone Canyon's Colossus of the Dune Throne (blender/arenas/landmarks/colossus.py): a seated king carved out of the cliff. A
 * landmark reads nothing of the fight, so his head sweeps slowly across the ring and rests at each place, as if watching; his eyes
 * burn a little brighter and dimmer on a long breath. Parts: head > eyes; the rest is rock. In the model's space y is up and +z its front.
 */
export const colossusPose: LandmarkPose = (p, t) => {
  const n = GAZE.length, k = Math.floor(t / STEP), u = (t - k * STEP) / STEP * (STEP / TURN) - (STEP - TURN) / TURN;
  const e = Math.max(0, Math.min(1, u)), ease = e * e * (3 - 2 * e);
  const yaw = GAZE[k % n] + (GAZE[(k + 1) % n] - GAZE[k % n]) * ease;
  p.turn('head', 0.03 * Math.sin(t * 0.21), yaw, 0);
  p.glow('eyes', 0.85 + 0.2 * Math.sin(t * 0.5));
};
