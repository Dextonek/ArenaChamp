import type { BeastDef } from '.';
import { blow, ease } from '.';

/**
 * The bark hound (blender/tower/beasts/hound.py): a wolf of the Walking Wood in bark shingles with a leaf mane. Parts: body > neck >
 * head > jaw; legFL > footFL and the other three; tail1 > tail2. It faces +z, its left +x. About the turns: a part that hangs (a leg)
 * swings its foot forward with a negative turn about x; the head and the jaw go down with a positive one; the tail, which points back,
 * goes up with a positive one.
 *
 * It trots in diagonal pairs, the body bobbing on each step and the head steady; its bite is a crouch with the head drawn back and up,
 * then a lunge, the jaws wide and snapping shut as the blow lands.
 */
export const HOUND: BeastDef = {
  id: 'hound',
  barY: 1.2,
  stride: 1.15,
  pose(p, s) {
    const t = s.time, g = s.gait, ph = s.stride;
    const { w, k } = blow(s.pose.swing);
    const bite = ease(s, 'bite', w > 0 || k > 0 ? 1 : 0, 10);
    const breath = Math.sin(t * 2.1 + s.seed * 6);

    // The trot: diagonal pairs, each upper leg swinging and its lower bending as it comes forward.
    const legs: [string, string, number, boolean][] = [['legFL', 'footFL', 0, true], ['legBR', 'footBR', 0, false], ['legFR', 'footFR', Math.PI, true], ['legBL', 'footBL', Math.PI, false]];
    for (const [leg, foot, off, front] of legs) {
      const a = Math.sin(ph + off), lift = Math.max(0, Math.cos(ph + off));
      let up = -0.55 * a * g, lo = (front ? 0.75 : -0.6) * lift * g;
      // The bite: the forelegs brace forward, the hind legs gather under it, then drive.
      if (front) up += -0.25 * w + 0.35 * k;
      else { up += 0.3 * w - 0.25 * k; lo += -0.3 * w; }
      p.turn(leg, up, 0, 0);
      p.turn(foot, lo, 0, 0);
    }

    // The body: a bob on each step, a slow breath standing; drawn back and down for the bite, then thrown forward.
    const bob = Math.abs(Math.sin(ph)) * 0.05 * g;
    p.move('body', 0, bob + 0.012 * breath * (1 - g) - 0.08 * w, -0.12 * w + 0.28 * k);
    p.turn('body', 0.05 * w - 0.1 * k + 0.03 * Math.sin(ph * 2) * g, 0, 0.03 * Math.sin(ph) * g);
    for (const leg of ['legFL', 'legFR', 'legBL', 'legBR']) p.keepAbove(leg);

    // The neck and head: steady over the trot, looking about when it stands; up and back for the bite, then out low and forward.
    const look = (1 - g) * (1 - bite) * Math.sin(t * 0.45 + s.seed * 9) * 0.35;
    p.turn('neck', -0.1 * g - 0.45 * w + 0.5 * k + 0.02 * breath, look * 0.5, 0);
    p.turn('head', 0.12 * g + 0.15 * w - 0.25 * k, look * 0.6, 0);
    // The jaws: a little open as it pants, wide at the wind-up's end, shut hard as the blow lands.
    const pant = (0.06 + 0.04 * Math.sin(t * 9)) * g;
    p.turn('jaw', Math.max(0, pant + 0.55 * Math.min(1, w * 1.4) * (1 - k * 1.6)), 0, 0);

    // The tail: up when it runs, swinging; low and still when it bites.
    p.turn('tail1', 0.25 * g + 0.1 * breath * (1 - g) - 0.2 * bite, 0.25 * Math.sin(ph) * g + 0.15 * Math.sin(t * 1.3) * (1 - g), 0);
    p.turn('tail2', 0.1 * g, 0.2 * Math.sin(ph - 0.8) * g + 0.12 * Math.sin(t * 1.3 - 0.7) * (1 - g), 0);
    p.glow('head', 0.6 + 0.4 * bite);
  },
};
