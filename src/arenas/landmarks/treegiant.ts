import { RING } from '../common';
import type { LandmarkPose } from '.';

/**
 * Verdant Glade's tree-giant of the Walking Wood (blender/arenas/landmarks/treegiant.py): it strides slowly past behind the glade on an
 * arc to the east, turns at either end to look toward the ring, and strides back; a loop of 78 s. Its arms of branches and its crown
 * sway the whole time. Parts: body > (head > crown; armL > foreL; armR > foreR; legL > shinL; legR > shinR). In the model's space y is
 * up and +z its front.
 *
 * The path is kept off the z line through the ring's middle (x >= 17 all along) and beyond the floor (23 m from the middle),
 * where the duel's camera catches it when the fight comes to the east side. The arena file places the group each frame from
 * `giantAt` (position and heading) and poses the body with `treegiantPose` (the stride: the same clock).
 */

const LEN = 30; // metres walked from one end of the path to the other
const WALK = 30; // s to walk it, eased at both ends
const TURN = 9; // s to turn round at an end
const LOOP = 2 * (WALK + TURN);
const CYCLE = 12; // metres walked in one full stride of both legs
const ease = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

/** The arc it walks (round the ring's middle): radius from the middle and the angle (0 = due east) its far ends lie at. */
export interface GiantPath { r: number; mid: number }
export const GIANT_PATH: GiantPath = { r: 23, mid: 0.1 };

/** Whether a trunk at (x, z) stands within `margin` m of the arc it walks (the glade clears those trees). */
export function giantNear(x: number, z: number, margin: number, path: GiantPath = GIANT_PATH) {
  const span = LEN / path.r, a0 = path.mid - span / 2;
  for (let i = 0; i <= 24; i++) {
    const a = a0 + (i / 24) * span;
    if (Math.hypot(x - (RING.x + Math.cos(a) * path.r), z - (RING.z + Math.sin(a) * path.r)) < margin) return true;
  }
  return false;
}

/** Where it is in its loop: metres along the path, which way it walks, how far into a turn at an end, and the stride. */
export function giantGait(t: number) {
  const u = ((t % LOOP) + LOOP) % LOOP;
  const leg = Math.floor(u / (WALK + TURN)); // 0 out, 1 back
  const w = u - leg * (WALK + TURN);
  const walking = w < WALK;
  const x = walking ? w / WALK : 0;
  const q = walking ? 0 : ease((w - WALK) / TURN);
  const e = ease(x);
  // the speed in m/s (the slope of the ease)
  const v = walking ? (6 * x * (1 - x) * LEN) / WALK : 0;
  const walked = leg * LEN + (walking ? LEN * e : LEN);
  const s = leg === 0 ? (walking ? LEN * e : LEN) : (walking ? LEN * (1 - e) : 0);
  const phase = (Math.PI * 2 * walked) / CYCLE + Math.PI * (leg + q);
  // the legs swing as far as the walk is brisk; at a turn they only shuffle
  const k = walking ? Math.min(1, v / 0.55) : 0.5 * Math.sin(Math.PI * q);
  return { s, dir: leg === 0 ? 1 : -1, turning: walking ? 0 : q, leg, phase, k };
}

/** Where the giant stands (x, z), and the yaw it faces, `t` seconds in. */
export function giantAt(t: number, path: GiantPath = GIANT_PATH) {
  const g = giantGait(t);
  const span = LEN / path.r;
  const a0 = path.mid - span / 2;
  const a = a0 + (g.s / LEN) * span;
  // walking out it faces along the arc (toward larger angles); at the far end it turns through the way to the ring
  let yaw = g.dir > 0 ? -a : -a + Math.PI;
  if (g.turning > 0) yaw = g.leg === 0 ? -a - Math.PI * g.turning : -a + Math.PI + Math.PI * g.turning;
  return { x: RING.x + Math.cos(a) * path.r, z: RING.z + Math.sin(a) * path.r, yaw };
}

export const treegiantPose: LandmarkPose = (p, t) => {
  const g = giantGait(t);
  const s = Math.sin(g.phase), c = Math.cos(g.phase);
  const k = g.k;
  // The stride: a leg swings back while it is on the ground (it pushes the body on) and forward, with the knee bent, while it is lifted.
  const swing = 0.3 * k;
  p.turn('legL', swing * s, 0, 0);
  p.turn('legR', -swing * s, 0, 0);
  p.turn('shinL', 0.65 * k * Math.max(0, -c), 0, 0);
  p.turn('shinR', 0.65 * k * Math.max(0, c), 0, 0);
  // the hips sink as the legs spread, and the trunk leans and twists a little with each step
  p.move('body', 0, -0.4 * s * s * k, 0);
  p.turn('body', 0.02 * k, 0.07 * k * s, 0.02 * k * c);
  // The arms swing against the legs, and sway on their own like boughs in a light wind.
  p.turn('armL', -0.22 * k * s + 0.03 * Math.sin(t * 0.5), 0, 0.05 + 0.05 * Math.sin(t * 0.37 + 1));
  p.turn('armR', 0.22 * k * s + 0.03 * Math.sin(t * 0.47 + 2), 0, -0.05 - 0.05 * Math.sin(t * 0.41));
  p.turn('foreL', -0.12 - 0.1 * k * (1 + s) + 0.06 * Math.sin(t * 0.7 + 3), 0, 0.04 * Math.sin(t * 0.6));
  p.turn('foreR', -0.12 - 0.1 * k * (1 - s) + 0.06 * Math.sin(t * 0.66 + 1), 0, -0.04 * Math.sin(t * 0.55 + 2));
  p.turn('head', 0.02 * Math.sin(t * 0.3), 0.18 * Math.sin(t * 0.17) - 0.07 * k * s, 0);
  p.turn('crown', 0.025 * Math.sin(t * 0.43 + 1), 0, 0.035 * Math.sin(t * 0.36));
};
