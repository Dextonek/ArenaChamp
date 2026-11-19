import { RING } from '../common';
import type { LandmarkPose } from '.';

/**
 * Sky Ruins' sky whale (blender/arenas/landmarks/skywhale.py): it glides in one slow wide circle round the floating ruins, below the
 * platform's edge and out beyond it in the cloud, a lap in 80 s, its long fins rowing slowly down and back and its tail swinging up and down. Parts:
 * body > (finL > finTipL; finR > finTipR; tail1 > tail2 > fluke). In the model's space y is up and +z its front (its way of flight).
 *
 * The circle is 21 m from the ring's middle, low (its back about 3 m under the platform's top), so it is always beyond the floor and
 * below the cameras' line of sight to the ring, never between a camera and a hero. It crosses the z line only far out (z = 28 and
 * z = -14), where the cameras do not look. The arena file places the group each frame from `whaleAt`.
 */

const LAP = 80; // s for one circle
const BEAT = 7; // s for one beat of the fins
const ORBIT = 21; // m from the ring's middle
const TAU = Math.PI * 2;

/** Where the whale is (x, z) and which way it flies (yaw), banked a little into the turn, `t` seconds in. */
export function whaleAt(t: number) {
  const a = 0.6 + (TAU * t) / LAP;
  return {
    x: RING.x + Math.cos(a) * ORBIT,
    z: RING.z + Math.sin(a) * ORBIT,
    yaw: -a,
    bank: -0.1,
    bob: 0.5 * Math.sin(t * 0.31),
  };
}

export const skywhalePose: LandmarkPose = (p, t) => {
  const w = (TAU * t) / BEAT;
  // The pectoral fins hang down and back and row slowly: a down-and-back stroke (about the body's cross axis) with a little roll out and
  // in, the outer half a beat behind the inner (the right fin mirrors the left in the roll).
  const stroke = 0.28 * Math.sin(w), roll = 0.12 * Math.sin(w - 0.7);
  p.turn('finL', stroke, 0, roll);
  p.turn('finR', stroke, 0, -roll);
  p.turn('finTipL', 0.18 * Math.sin(w - 0.9), 0, 0.1 * Math.sin(w - 1.5));
  p.turn('finTipR', 0.18 * Math.sin(w - 0.9), 0, -0.1 * Math.sin(w - 1.5));
  // The body rises a little with each stroke; a whale swims with its tail up and down, the wave running back along the stock.
  p.move('body', 0, 0.35 * Math.sin(w - 1.3), 0);
  p.turn('body', 0.03 * Math.sin(w - 1.6), 0, 0.02 * Math.sin(w * 0.5));
  p.turn('tail1', 0.1 * Math.sin(w - 2.2), 0, 0);
  p.turn('tail2', 0.16 * Math.sin(w - 2.9), 0, 0);
  p.turn('fluke', 0.2 * Math.sin(w - 3.6), 0, 0);
};
