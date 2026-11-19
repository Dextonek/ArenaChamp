import type { BeastDef } from '.';
import { blow, ease } from '.';

/**
 * The brine crab (blender/tower/beasts/crab.py): a big shore crab of the drowned harbour, a barnacled sea-green shell, rust claws, pale
 * eyes on stalks. Parts: body > (eyeL, eyeR, armL > clawL > pinchL, armR > clawR > pinchR, legL1..4 > tipL1..4, legR1..4 > tipR1..4);
 * legs number front to back. It faces +z, its left +x; the RIGHT claw is the crusher. About the turns: a leg that points out sideways
 * lifts with a turn about z (positive for the left legs, negative for the right ones) and sweeps with a turn about y; an arm or a claw
 * that points forward goes up with a negative turn about x; a finger opens inward with a positive turn about y on the right, a negative
 * one on the left.
 *
 * It scuttles on its eight legs in two alternating sets (a leg up, forward and down as its neighbour pushes back), the shell steady and
 * a little low; its blow is the crusher raised high over the shell with the pincer half up, held, then brought down hard as the blow
 * lands, the shell lunging with it. A tactic's slam is the same blow.
 */
export const CRAB: BeastDef = {
  id: 'crab',
  barY: 1.1,
  stride: 0.9,
  pose(p, s) {
    const t = s.time, g = s.gait, ph = s.stride;
    const { w, k } = blow(s.pose.swing);
    const hit = ease(s, 'hit', w > 0 || k > 0 ? 1 : 0, 10);
    const breath = Math.sin(t * 1.7 + s.seed * 6);

    // The legs: alternate sets, the sweep fore and aft, the lift on the forward half of it; a front leg reaches ahead, a rear one behind.
    for (const [side, sg] of [['L', 1], ['R', -1]] as const) {
      for (let i = 0; i < 4; i++) {
        const phi = ph + (((i + (sg > 0 ? 0 : 1)) & 1) ? Math.PI : 0) + i * 0.35;
        const a = Math.sin(phi), lift = Math.max(0, Math.cos(phi));
        const reach = (i < 2 ? -1 : 1) * 0.12;
        // standing, the legs twitch a little, one at a time
        const idle = (1 - g) * 0.03 * Math.sin(t * 1.3 + i * 2.1 + sg);
        p.turn(`leg${side}${i + 1}`, 0, sg * (0.33 * a * g + reach * g * 0.5 - 0.1 * w * (i < 2 ? 1 : -1)), sg * (0.3 * lift * g + idle + 0.04 * w));
        p.turn(`tip${side}${i + 1}`, 0, 0, sg * (0.35 * lift * g - 0.12 * a * g));
      }
    }

    // The shell: a quick sway on each step, a slow breath standing; sunk a little and tipped back for the wind-up, then thrown forward.
    const sway = Math.sin(ph) * g;
    p.move('body', 0, 0.012 * breath * (1 - g) - 0.04 * w - 0.03 * k, 0.16 * k - 0.05 * w);
    p.turn('body', -0.1 * w + 0.07 * k + 0.02 * Math.sin(ph * 2) * g, 0.04 * sway + 0.05 * Math.sin(t * 0.5 + s.seed * 5) * (1 - g), 0.035 * sway);
    for (let i = 1; i <= 4; i++) { p.keepAbove(`legL${i}`); p.keepAbove(`legR${i}`); p.keepAbove(`tipL${i}`); p.keepAbove(`tipR${i}`); }

    // The crusher (right): up and out over the shell, the finger open, held; brought down hard on the blow. The pincer (left) half follows.
    p.turn('armR', -1.0 * w + 0.35 * k + 0.04 * Math.sin(ph) * g, -0.25 * w + 0.15 * k + 0.06 * Math.sin(ph) * g, 0);
    p.turn('clawR', -0.5 * w + 0.5 * k, 0, 0);
    p.turn('armL', -0.55 * w + 0.2 * k + 0.04 * Math.sin(ph + 1) * g, 0.15 * w - 0.1 * k - 0.06 * Math.sin(ph) * g, 0);
    p.turn('clawL', -0.3 * w + 0.3 * k, 0, 0);
    // The fingers: a slow idle snap, wide for the wind-up, shut hard as it lands.
    const snapR = 0.04 + 0.03 * Math.sin(t * 0.9 + s.seed * 4) * (1 - hit) + 0.5 * Math.min(1, w * 1.3) * (1 - k * 1.8);
    const snapL = 0.05 + 0.18 * Math.max(0, Math.sin(t * 1.4 + s.seed * 8) - 0.6) * (1 - hit) + 0.35 * Math.min(1, w * 1.3) * (1 - k * 1.8);
    p.turn('pinchR', 0, Math.max(0, snapR), 0);
    p.turn('pinchL', 0, -Math.max(0, snapL), 0);
    for (const n of ['R', 'L']) { p.keepAbove(`arm${n}`); p.keepAbove(`claw${n}`); p.keepAbove(`pinch${n}`); }

    // The eyes on their stalks: look about when it stands, tuck back and low in the blow.
    const look = (1 - g) * (1 - hit) * Math.sin(t * 0.8 + s.seed * 7);
    p.turn('eyeL', 0.25 * w + 0.1 * look, 0.2 * look, 0.1 * Math.sin(t * 1.9 + 1));
    p.turn('eyeR', 0.25 * w - 0.1 * look, 0.2 * look + 0.08, 0.1 * Math.sin(t * 1.7));
    p.glow('eyeL', 0.7 + 0.5 * hit);
    p.glow('eyeR', 0.7 + 0.5 * hit);
  },
};
