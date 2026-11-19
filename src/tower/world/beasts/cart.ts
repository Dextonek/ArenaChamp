import type { BeastDef } from '.';
import { ease } from '.';

/**
 * The caravan cart (blender/tower/beasts/cart.py): the Sands' two-wheeled covered cart, a quest's helper (the hero leads it, it has no
 * animal and never fights). Parts: cart > bed > (hood, lantern), wheelL, wheelR. It faces +z, its left +x. The wheels turn about x at
 * the axle (a positive turn rolls them forward); the lantern hangs from the crook and swings about x and z.
 *
 * `stride` is the wheels' circumference (2 pi times their 0.4 m radius): one stride of the gait is one turn of a wheel, so they roll
 * at the speed it goes. The gait also creeps a little when it stands (the legs' idle sway), which the wheels leave out. The bed rocks on
 * its axle as it goes and the lantern swings after it; standing, the cart rests on its prop and is still but for the lantern's drift.
 */
const WHEEL_R = 0.4;
export const CART: BeastDef = {
  id: 'cart',
  barY: 1.6,
  stride: 2 * Math.PI * WHEEL_R,
  pose(p, s) {
    const t = s.time, g = s.gait, m = s.mem;
    // The wheels: the way it has gone since the last frame, less the standing creep.
    const last = m.last ?? s.stride;
    const dist = Math.max(0, s.stride - last - s.dt * 0.4 * (1 - g));
    m.last = s.stride;
    m.roll = ((m.roll ?? 0) + dist) % (Math.PI * 2);
    p.turn('wheelL', m.roll, 0, 0);
    p.turn('wheelR', m.roll, 0, 0);
    // The bed: it rocks sideways on the road's bumps and nods a little on the axle; nothing standing.
    const rock = ease(s, 'rock', g, 3);
    const ph = s.stride;
    p.turn('bed', 0.012 * Math.sin(ph * 2) * rock, 0, 0.018 * Math.sin(ph * 1.5 + 1) * rock);
    p.move('bed', 0, 0.008 * Math.abs(Math.sin(ph * 3)) * rock, 0);
    // The lantern swings on its hook: in time with the bumps going, slow and small standing, and lags the way it goes.
    const sw = Math.sin(t * 2.0 + s.seed * 5) * 0.04 * (1 - g) + Math.sin(ph * 1.5 - 0.6) * 0.13 * g;
    p.turn('lantern', sw * 0.6 - 0.08 * rock, 0, sw);
    p.glow('lantern', 0.9 + 0.1 * Math.sin(t * 7 + s.seed * 4) * Math.sin(t * 2.3));
  },
};
