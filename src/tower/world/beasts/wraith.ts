import type { BeastDef } from '.';
import { blow, ease } from '.';

/**
 * The dust wraith (blender/tower/beasts/wraith.py): a spirit of the Sands' storm, a hooded robe tapering into a whirl, four rings of
 * bone and sand that turn round it, two arms of sand that end in blades. Parts: body > (hood, armL > bladeL, armR > bladeR, ring1..ring4).
 * It faces +z, its left +x; it has no legs and does not walk: it glides, leaning into the way it goes with its rings spinning faster.
 * About the turns: the vertical axis is y (a ring spins with a turn about y); a turn about x leans the top forward when positive and
 * lowers an arm's hand; a turn about y swings an arm's hand to its left when positive.
 *
 * Its blow is both arms swept across: drawn back wide and up in the wind-up, then each blade cutting across the front to the other side.
 */
export const WRAITH: BeastDef = {
  id: 'wraith',
  barY: 2.65,
  pose(p, s) {
    const t = s.time, g = s.gait;
    const { w, k } = blow(s.pose.swing);
    const swing = ease(s, 'swing', w > 0 || k > 0 ? 1 : 0, 10);
    const breath = Math.sin(t * 1.6 + s.seed * 6);

    // The rings turn about the axis, alternately one way and the other, faster as it goes and when it strikes.
    const rate = 1.2 + 4 * g + 5 * swing;
    s.mem.spin = (s.mem.spin ?? s.seed * 6) + s.dt * rate;
    const spin = s.mem.spin;
    for (let i = 1; i <= 4; i++) p.turn(`ring${i}`, 0.04 * Math.sin(t * 1.3 + i), (i % 2 ? 1 : -1) * spin * (0.7 + 0.15 * i), 0.04 * Math.cos(t * 1.1 + i));

    // The glide: a hover that rises and falls, the top leaning into the way it goes, a sway side to side; it draws back for the blow,
    // then leans in as it lands.
    p.move('body', 0, 0.05 + 0.04 * breath + 0.03 * g * Math.sin(t * 5), 0);
    p.turn('body', 0.22 * g - 0.18 * w + 0.3 * k + 0.02 * breath, 0.05 * Math.sin(t * 0.7 + s.seed * 5) * (1 - g), 0.04 * Math.sin(t * 1.4) + 0.05 * Math.sin(t * 3) * g);

    // The hood: looks about when it is still; the head follows the sweep.
    const look = (1 - g) * (1 - swing) * Math.sin(t * 0.5 + s.seed * 9) * 0.4;
    p.turn('hood', -0.05 * g - 0.12 * w + 0.15 * k, look + 0.3 * (0.5 * w - k), 0);

    // The arms: hung forward and loose while it drifts; for the blow each is drawn out wide and up, then swept across to the other side.
    for (const [side, sd] of [['L', 1], ['R', -1]] as const) {
      const sway = Math.sin(t * 1.8 + (sd > 0 ? 0 : 1.7)) * (0.1 + 0.15 * g);
      const sweepY = sd * (1.0 * w - 1.35 * Math.min(1, k * 1.15));
      const lift = -0.15 + 0.1 * sway - 0.6 * w + 0.45 * k;
      p.turn(`arm${side}`, lift + 0.2 * g, sd * (0.15 + 0.08 * sway) * (1 - swing) + sweepY, -sd * 0.25 * (w - k));
      p.turn(`blade${side}`, 0.1 * sway + 0.2 * k, sd * (0.7 * w - 0.9 * Math.min(1, k * 1.2)), 0);
    }
    p.glow('hood', 0.7 + 0.8 * swing);
  },
};
