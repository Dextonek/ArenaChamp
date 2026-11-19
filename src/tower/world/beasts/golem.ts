import type { BeastDef } from '.';
import { ease } from '.';

/**
 * The crystal golem (blender/tower/beasts/golem.py): basalt plates on short thick legs, arms to its knees, crystals on the back and
 * shoulders, one crystal eye. Parts: body > head, armL > foreL > handL, armR > foreR > handR, legL, legR. It faces +z, its left +x. About
 * the turns: a part that hangs (an arm, a leg) swings its end forward and up with a negative turn about x; the body and head lean forward
 * with a positive one.
 *
 * It breathes heavily and its crystals pulse when it stands; it walks slowly, each leg swinging from the hip and the body dropping on every
 * step. It throws overhand with the right arm: the release is the moment the shot leaves (`pose.shot` jumps to 1, no wind-up is given), so the
 * arm is thrown up and forward at that moment and comes down over half a second, the body leaning into it and the crystals flaring.
 */
const THROW = 0.5;

export const GOLEM: BeastDef = {
  id: 'golem',
  barY: 2.4,
  // The right hand at the release, over the feet (the arm up and forward, about 115 degrees from hanging).
  shotY: 2.1,
  stride: 1.3,
  pose(p, s) {
    const t = s.time, g = s.gait, ph = s.stride;
    const breath = Math.sin(t * 1.5 + s.seed * 6);
    const x = Math.min(1, s.sinceShot / THROW);
    // The throw's shape: 1 at the release, falling to 0 as the arm comes home; `kick` is the first moments only.
    const th = s.sinceShot < THROW ? 1 - x * x * (3 - 2 * x) : 0;
    const kick = Math.max(0, 1 - s.sinceShot / 0.12);
    const cast = ease(s, 'cast', s.sinceShot < 1.2 ? 1 : 0, 6);

    // The legs: slow and heavy, each swinging from the hip, the forward one lifting a little.
    for (const [leg, off] of [['legL', 0], ['legR', Math.PI]] as const) {
      const a = Math.sin(ph + off), lift = Math.max(0, Math.cos(ph + off));
      p.turn(leg, -0.42 * a * g, 0, 0);
      p.move(leg, 0, 0.07 * lift * g, 0);
    }
    // The body: drops on each step and sways its weight; a heavy breath standing; leans into the throw.
    p.move('body', 0, -0.05 * Math.abs(Math.sin(ph)) * g, 0);
    p.turn('body', 0.02 * breath * (1 - g) + 0.04 * g + 0.2 * th - 0.04 * kick, 0.08 * Math.sin(ph) * g - 0.25 * th, 0.05 * Math.sin(ph) * g);
    for (const leg of ['legL', 'legR']) p.keepAbove(leg);

    // The head: looks about slowly when it stands, down at the target when it throws.
    const look = (1 - g) * (1 - cast) * Math.sin(t * 0.35 + s.seed * 9) * 0.35;
    p.turn('head', -0.08 * g + 0.12 * th, look - 0.1 * Math.sin(ph) * g + 0.25 * th, 0);

    // The arms: swinging against the legs; the right thrown up and forward at the release, the elbow straightening, then home.
    const sw = 0.3 * g * Math.sin(ph), idle = 0.03 * breath * (1 - g);
    p.turn('armL', sw + idle + 0.35 * th, 0, 0.04);
    p.turn('foreL', -0.12 * g - 0.1 * th, 0, 0);
    p.turn('armR', -sw + idle - 2.1 * th, 0, -0.04 + 0.1 * th);
    p.turn('foreR', -0.12 * g - 0.5 * th - 0.4 * kick, 0, 0);
    p.turn('handR', -0.4 * kick, 0, 0);

    // The crystals: a slow pulse standing, a flare as the shot leaves (the eye with them).
    const pulse = 0.85 + 0.2 * Math.sin(t * 1.8 + s.seed * 4);
    p.glow('body', pulse * (1 + 0.6 * th * th));
  },
};
