import type { BeastDef } from '../../tower/world/beasts';
import { ease } from '../../tower/world/beasts';

/**
 * The Eclipse Wyrm's Cast shade (blender/raid/castshade.py): a shadow that stood up, hunched and faceless, long arms to its knees,
 * torn violet membranes at the shoulders, no legs (the body frays into tatters that hover), one pale gold eye at 1.9 m where its beam
 * leaves. Parts: body > (head > eye, armL > handL, armR > handR, memL, memR, tatters, tatters2). It faces +z, its left +x. About the
 * turns: a turn about x leans a part forward when positive (a hanging arm swings its hand back); a turn about z spreads an arm's hand
 * outward when positive on the left and negative on the right.
 *
 * It never walks: it hangs in the air with a slow sway and breath, the tatters stirring, the head tracking a little. At its shot
 * (`pose.shot` jumps to 1 as the beam leaves) it straightens, the arms flare back and out, the membranes open and the eye flares, then it
 * settles within half a second.
 */
const SETTLE = 0.5;

export const CAST_SHADE: BeastDef = {
  id: 'castshade',
  url: 'models/raid/castshade.glb',
  barY: 2.55,
  shotY: 1.9,
  pose(p, s) {
    const t = s.time, ph = s.seed * 6.3;
    const breath = Math.sin(t * 1.4 + ph);
    const x = Math.min(1, s.sinceShot / SETTLE);
    // The shot's shape: 1 at the release, easing to 0; `kick` is the first moments only.
    const th = s.sinceShot < SETTLE ? 1 - x * x * (3 - 2 * x) : 0;
    const kick = Math.max(0, 1 - s.sinceShot / 0.12);
    const aim = ease(s, 'aim', s.sinceShot < 1.2 ? 1 : 0, 6);

    // The body hangs a hand's breadth off the floor and sways on a slow cycle; it straightens up out of its stoop for the shot.
    p.move('body', 0.03 * Math.sin(t * 0.7 + ph), 0.04 * breath + 0.03 * th, 0);
    p.turn('body', -0.3 * th - 0.05 * kick + 0.02 * breath, 0.06 * Math.sin(t * 0.5 + ph) * (1 - aim), 0.035 * Math.sin(t * 0.9 + ph));

    // The head: tracks about slowly, and rears back with the eye lifted at the shot.
    p.turn('head', -0.1 * th + 0.03 * breath, Math.sin(t * 0.45 + ph * 1.3) * 0.3 * (1 - aim), 0.04 * Math.sin(t * 0.8 + ph));

    // The arms: hang loose and swing a little with the sway; flung back and out at the shot.
    for (const [side, sd] of [['L', 1], ['R', -1]] as const) {
      const sw = Math.sin(t * 1.1 + (sd > 0 ? 0 : 1.9) + ph);
      p.turn(`arm${side}`, 0.06 * sw + 0.04 * breath + 0.95 * th + 0.3 * kick, 0, sd * (0.05 + 0.04 * sw + 0.55 * th));
      p.turn(`hand${side}`, -0.1 * sw + 0.3 * th, 0, sd * 0.3 * th);
      // The membranes: breathe open and shut a little; spread wide at the shot.
      p.turn(`mem${side}`, 0.05 * Math.sin(t * 2.2 + (sd > 0 ? 0 : 1) + ph) + 0.1 * th, 0, sd * (0.1 * Math.sin(t * 2.2 + (sd > 0 ? 0 : 1) + ph) + 0.35 * th));
    }

    // The tatters stir, the two groups out of step.
    p.turn('tatters', 0.06 * Math.sin(t * 1.9 + ph), 0.12 * Math.sin(t * 1.1 + ph), 0.05 * Math.sin(t * 1.5 + ph * 2));
    p.turn('tatters2', 0.06 * Math.sin(t * 1.6 + 2 + ph), -0.12 * Math.sin(t * 0.9 + ph), 0.05 * Math.sin(t * 1.3 + ph));

    // The eye: a slow pulse, flaring as the beam leaves.
    p.glow('eye', 0.85 + 0.15 * Math.sin(t * 2.4 + ph) + 1.6 * th * th);
  },
};
