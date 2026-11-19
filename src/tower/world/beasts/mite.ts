import type { BeastDef } from '.';
import { blow, ease } from '.';

/**
 * The shard mite (blender/tower/beasts/mite.py): a cave tick the size of a dog, dark chitin, a back grown over with cold cyan crystals.
 * Parts: body > (head > mandL, mandR; legL1..3 > shinL1..3; legR1..3 > shinR1..3); legs number front to back. It faces +z, its left +x.
 * About the turns: a leg that points out sideways lifts with a turn about z (positive on the left, negative on the right) and sweeps with
 * a turn about y; the body and the head go down with a positive turn about x; a mandible opens outward with a positive turn about y on
 * the left, a negative one on the right.
 *
 * It runs a fast tripod gait (front and rear on one side with the middle one on the other), the shell low and jittering; standing it
 * breathes, its head and mandibles twitching. Its bite is a rear-up (the front legs off the ground, the mandibles wide), then a lunge,
 * the head thrown down and the mandibles snapping shut as the blow lands. Its crystals brighten a little with it.
 */
export const MITE: BeastDef = {
  id: 'mite',
  barY: 0.95,
  stride: 0.5,
  pose(p, s) {
    const t = s.time, g = s.gait, ph = s.stride;
    const { w, k } = blow(s.pose.swing);
    const bite = ease(s, 'bite', w > 0 || k > 0 ? 1 : 0, 12);
    const breath = Math.sin(t * 3.0 + s.seed * 6);

    // The tripod gait: each leg's sweep fore and aft, the lift on the forward half; the front legs reach ahead, the rear ones behind.
    for (const [side, sg] of [['L', 1], ['R', -1]] as const) {
      for (let i = 0; i < 3; i++) {
        const phi = ph + (((i + (sg > 0 ? 0 : 1)) & 1) ? Math.PI : 0);
        const a = Math.sin(phi), lift = Math.max(0, Math.cos(phi));
        const reach = (i - 1) * -0.1;
        const front = i === 0;
        // standing, the legs twitch a little; in the rear-up the front legs come off the ground and the rear ones brace
        const idle = (1 - g) * 0.04 * Math.sin(t * 2.3 + i * 1.9 + sg);
        p.turn(`leg${side}${i + 1}`, 0, sg * (0.4 * a * g + reach * 0.5 * g + (front ? 0.25 * w : -0.1 * w)), sg * (0.35 * lift * g + idle + (front ? 0.55 * w - 0.2 * k : 0)));
        p.turn(`shin${side}${i + 1}`, 0, 0, sg * (0.4 * lift * g - 0.12 * a * g + (front ? 0.5 * w : 0)));
      }
    }

    // The body: a quick jitter on each step, a fast breath standing; reared up and back for the bite, then thrown forward and down.
    const bob = Math.abs(Math.sin(ph)) * 0.025 * g;
    p.move('body', 0, bob + 0.006 * breath * (1 - g) + 0.12 * w - 0.02 * k, -0.1 * w + 0.3 * k);
    p.turn('body', -0.3 * w + 0.25 * k + 0.03 * Math.sin(ph * 2) * g, 0.03 * Math.sin(ph) * g, 0.03 * Math.sin(ph) * g);
    for (let i = 1; i <= 3; i++) { p.keepAbove(`legL${i}`); p.keepAbove(`legR${i}`); p.keepAbove(`shinL${i}`); p.keepAbove(`shinR${i}`); }

    // The head: looks about when it stands, tilts up in the rear-up, snaps down on the blow.
    const look = (1 - g) * (1 - bite) * Math.sin(t * 0.9 + s.seed * 9);
    p.turn('head', -0.2 * w + 0.25 * k + 0.03 * breath, 0.35 * look, 0.05 * look);
    // The mandibles: a twitch standing, wide at the wind-up, shut hard as it lands.
    const twitch = (0.04 + 0.05 * Math.max(0, Math.sin(t * 6 + s.seed * 5))) * (1 - bite) + 0.03 * g;
    const open = Math.max(0, twitch + 0.7 * Math.min(1, w * 1.4) * (1 - k * 1.7));
    p.turn('mandL', 0.15 * k, open, 0);
    p.turn('mandR', 0.15 * k, -open, 0);
    for (const n of ['head', 'mandL', 'mandR']) p.keepAbove(n);
    // The crystals: a slow pulse, a little brighter in the bite.
    p.glow('body', 0.85 + 0.12 * Math.sin(t * 1.6 + s.seed * 6) + 0.3 * bite);
  },
};
