import type { BeastDef } from '.';
import { blow, ease } from '.';

/**
 * The Stag-Crowned (blender/tower/beasts/stag.py): an old great stag of the Walking Wood, bark on its flanks, a crown of antlers faintly
 * gold along the tines. Parts: body > neck > head > jaw; legFL > footFL and the other three; tail. The antlers are part of the head. It
 * faces +z, its left +x. About the turns: a part that hangs (a leg) swings its foot forward with a negative turn about x; the neck and
 * the head go down with a positive one; the tail, which points back, goes up with a positive one; a turn about y swings the head to its
 * left.
 *
 * It trots in diagonal pairs, the head high and steady; its blow is a gore: the head thrown up and back and the haunches gathered, then
 * the neck driving down and forward, the head lowered and swept up and across from its right to its left, the forelegs braced.
 */
export const STAG: BeastDef = {
  id: 'stag',
  barY: 2.4,
  stride: 1.5,
  pose(p, s) {
    const t = s.time, g = s.gait, ph = s.stride;
    const { w, k } = blow(s.pose.swing);
    const gore = ease(s, 'gore', w > 0 || k > 0 ? 1 : 0, 10);
    const breath = Math.sin(t * 1.7 + s.seed * 6);

    // The trot: diagonal pairs, each upper leg swinging and its lower bending as it comes forward (the hind lower leg the other way).
    const legs: [string, string, number, boolean][] = [['legFL', 'footFL', 0, true], ['legBR', 'footBR', 0, false], ['legFR', 'footFR', Math.PI, true], ['legBL', 'footBL', Math.PI, false]];
    for (const [leg, foot, off, front] of legs) {
      const a = Math.sin(ph + off), lift = Math.max(0, Math.cos(ph + off));
      let up = -0.42 * a * g, lo = (front ? 0.9 : -0.7) * lift * g;
      // The gore: the forelegs brace forward, the hind legs gather under it, then drive.
      if (front) up += -0.3 * w + 0.4 * k;
      else { up += 0.25 * w - 0.2 * k; lo += -0.25 * w; }
      p.turn(leg, up, 0, 0);
      p.turn(foot, lo, 0, 0);
    }

    // The body: a bob on each step, a slow breath standing; the haunches gather for the gore, then it is thrown forward.
    const bob = Math.abs(Math.sin(ph)) * 0.05 * g;
    p.move('body', 0, bob - 0.07 * g + 0.012 * breath * (1 - g) - 0.07 * w, -0.15 * w + 0.4 * k);
    p.turn('body', -0.06 * w + 0.04 * k + 0.02 * Math.sin(ph * 2) * g, 0, 0.025 * Math.sin(ph) * g);
    for (const leg of ['legFL', 'legFR', 'legBL', 'legBR']) p.keepAbove(leg);

    // The neck and head: carried high and level over the trot, looking about when it stands; up and back for the gore, then down and
    // forward with the head swept across, from its right to its left.
    const look = (1 - g) * (1 - gore) * Math.sin(t * 0.4 + s.seed * 9) * 0.4;
    const sweep = -0.55 * w + 0.95 * Math.min(1, k * 1.2);
    p.turn('neck', -0.08 * g - 0.5 * w + 0.8 * k + 0.02 * breath, look * 0.5 + sweep * 0.5, 0);
    p.turn('head', 0.1 * g + 0.1 * w + 0.35 * k, look * 0.6 + sweep * 0.5, -0.2 * sweep);
    p.turn('jaw', Math.max(0, (0.05 + 0.04 * Math.sin(t * 6)) * g + 0.25 * w * (1 - k)), 0, 0);

    // The tail: a flick; up when it charges.
    p.turn('tail', 0.15 * g + 0.2 * k + 0.12 * breath * (1 - g), 0.2 * Math.sin(t * 1.9 + s.seed * 4), 0);
    p.glow('head', 0.5 + 0.9 * gore);
  },
};
