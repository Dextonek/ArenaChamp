import type { LandmarkPose } from '.';

/**
 * The Fallen Battlefield's trebuchet (blender/arenas/landmarks/trebuchet.py): in a loop of 30 s the arm is wound back slowly on the
 * windlass, rests cocked, whips over and throws its stone, which arcs far off out of sight; it comes back to the sling unseen while
 * the arm is wound back. Parts: arm > (weight, sling), windlass, stone, flag1 > flag2. The machine throws toward the model's -x; in
 * the model's space y is up. Every number is the model's (H the axle's height, the arm built cocked at ALPHA below the horizontal with
 * its long end at +x, the rope SLING long, the stone lying at (S0X, S0Y)); the angles here turn counter-clockwise looking along -z, which
 * is the way the arm goes over.
 */
const RAD = Math.PI / 180;
const H = 5.4, ALPHA = 36 * RAD, LONG = 6.4, SLING = 4.0;
const S0X = 9.0, S0Y = 0.45;
const PERIOD = 30;
const THROW0 = 2, THROW = 1.4, FOLLOW = 0.94, WIND0 = 9, WIND1 = 26, FLIGHT = 4.5, BACK = 24.5;
/** The arm's turn at the release and how fast it goes then (rad/s); the sling is let go at the top of the swing. */
const PHI_REL = 125 * RAD, V_REL = (PHI_REL * 1.6) / THROW;
const PHI_END = PHI_REL + (V_REL * FOLLOW) / 2;
const REST = PHI_END - 6 * RAD;
const RELEASE = THROW0 + THROW;
const PSI0 = Math.asin((S0Y - (H - LONG * Math.sin(ALPHA))) / SLING);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

/** The arm's turn from the cocked pose at time `t` of the loop. */
function phi(t: number) {
  if (t < THROW0) return 0;
  if (t < RELEASE) return PHI_REL * ((t - THROW0) / THROW) ** 1.6;
  if (t < RELEASE + FOLLOW) { const u = (t - RELEASE) / FOLLOW; return PHI_REL + V_REL * FOLLOW * (u - (u * u) / 2); }
  const v = t - (RELEASE + FOLLOW);
  const osc = (x: number) => REST + 6 * RAD * Math.exp(-x / 1.6) * Math.cos(2.6 * x);
  if (t < WIND0) return osc(v);
  if (t < WIND1) return osc(WIND0 - RELEASE - FOLLOW) * (1 - smooth((t - WIND0) / (WIND1 - WIND0)));
  return 0;
}

/** The long end's tip. */
const tipOf = (ph: number) => ({ x: LONG * Math.cos(ph - ALPHA), y: H + LONG * Math.sin(ph - ALPHA) });

/** The sling's direction in the world: lying back on the ground, dragged in as the arm rises, whipped over at the end, then hanging. */
function psi(t: number, ph: number) {
  if (t < THROW0) return PSI0;
  if (t < RELEASE) {
    const s = (t - THROW0) / THROW, s1 = 0.39;
    if (s < s1) return Math.asin(clamp((S0Y - tipOf(ph).y) / SLING, -1, 1));
    const q = (s - s1) / (1 - s1);
    return -Math.PI / 2 + (130 * RAD + Math.PI / 2) * q * q;
  }
  const swing = 130 * RAD + (-90 * RAD - 130 * RAD) * smooth((t - RELEASE) / 1.4);
  const hang = swing + 0.1 * Math.sin(t * 1.3) * smooth((t - RELEASE - 1.4) / 1.5);
  const w = smooth(1 - ph / (60 * RAD));
  return hang * (1 - w) + PSI0 * w;
}

/** Where the stone is while it rides the sling at `t` (before the release). */
function carried(t: number) {
  const ph = phi(t), tip = tipOf(ph), a = psi(t, ph);
  return { x: tip.x + SLING * Math.cos(a), y: tip.y + SLING * Math.sin(a) };
}

export const trebuchetPose: LandmarkPose = (p, tt) => {
  const t = ((tt % PERIOD) + PERIOD) % PERIOD;
  const ph = phi(t);
  const a = psi(t, ph);
  p.turn('arm', 0, 0, ph);
  // the counterweight stays upright and swings on its rods after the throw
  const since = Math.max(0, t - RELEASE);
  p.turn('weight', 0, 0, -ph + 0.25 * Math.exp(-since / 1.8) * Math.sin(3 * since) * (t >= RELEASE ? 1 : 0));
  p.turn('sling', 0, 0, a - PSI0 - ph);
  p.turn('windlass', 0, 0, 2.2 * ph);
  // the stone: in the sling, then along its arc, then out of sight until the arm is wound back
  let sx = S0X, sy = S0Y, size = 1;
  if (t < RELEASE) ({ x: sx, y: sy } = carried(t));
  else if (t < RELEASE + FLIGHT) {
    const r = carried(RELEASE), u = t - RELEASE;
    sx = r.x - 24 * u;
    sy = r.y + 18 * u - 4.9 * u * u;
  } else if (t < BACK) size = 0;
  else size = smooth((t - BACK) / 0.6);
  p.move('stone', sx - S0X, sy - S0Y, 0);
  p.size('stone', size);
  // the torn banner in a slow wind
  p.turn('flag1', 0.1 * Math.sin(tt * 0.9), 0.08 * Math.sin(tt * 0.7 + 1), 0.03 * Math.sin(tt * 1.3));
  p.turn('flag2', 0.16 * Math.sin(tt * 1.7 + 1), 0.18 * Math.sin(tt * 1.1), 0);
};
