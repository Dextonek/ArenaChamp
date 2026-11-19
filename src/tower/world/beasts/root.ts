import type { BeastDef } from '.';
import { ease } from '.';

/**
 * The feeding root (blender/tower/beasts/root.py): a mound of earth and bark, six thorny roots coiling up round a seed-bulb whose husk is
 * split in five petals over an amber-pink pulp. Parts: mound > bulb > husk1..husk5, mound > root1 > root1b > root1c .. root6 > root6b > root6c. It never
 * moves. The roots start at 10 + 60 i degrees round the mound and the husk petals sit at 18 + 72 j degrees (angles in Blender's xy plane,
 * which is x and -z here); a part leaning outward turns about the horizontal axis at right angles to its direction, (-sin a, 0, -cos a).
 *
 * It breathes slowly standing, the roots curling and the bulb swelling; when the shot leaves, the husk is flung open and the bulb swells and
 * flares, the roots whipping out and back (no wind-up is given for shots: the release is the moment `pose.shot` jumps to 1).
 */
const THROW = 0.55;

/** Leans a part outward by `k` radians, for a part at `deg` degrees round the mound. */
function lean(p: Parameters<BeastDef['pose']>[0], name: string, deg: number, k: number) {
  const a = (deg * Math.PI) / 180;
  p.turn(name, -Math.sin(a) * k, 0, -Math.cos(a) * k);
}

export const ROOT: BeastDef = {
  id: 'root',
  barY: 2.2,
  // The bulb's mouth, over the feet.
  shotY: 1.25,
  pose(p, s) {
    const t = s.time;
    const x = Math.min(1, s.sinceShot / THROW);
    const th = s.sinceShot < THROW ? 1 - x * x * (3 - 2 * x) : 0;
    // The roots' whip: out hard at the release, a little past home, then still.
    const whip = s.sinceShot < THROW ? Math.cos(x * Math.PI * 1.5) * (1 - x) : 0;
    const cast = ease(s, 'cast', s.sinceShot < 1.2 ? 1 : 0, 6);
    const breath = Math.sin(t * 2.2 + s.seed * 6);

    for (let i = 0; i < 6; i++) {
      const deg = 10 + 60 * i;
      const slow = Math.sin(t * 0.8 + i * 1.1 + s.seed * 5), slow2 = Math.sin(t * 0.95 + i * 1.7 + s.seed * 3);
      lean(p, `root${i + 1}`, deg, 0.06 * slow * (1 - cast * 0.6) + 0.25 * whip);
      lean(p, `root${i + 1}b`, deg, 0.1 * slow2 * (1 - cast * 0.6) + 0.3 * whip);
      lean(p, `root${i + 1}c`, deg, 0.14 * slow * (1 - cast * 0.6) + 0.35 * whip);
    }
    for (let j = 0; j < 5; j++) {
      lean(p, `husk${j + 1}`, 18 + 72 * j, 0.06 + 0.05 * breath + 0.85 * th + 0.1 * Math.sin(t * 1.3 + j * 2));
    }
    p.size('bulb', 1 + 0.04 * breath + 0.28 * th);
    p.glow('bulb', 0.7 + 0.2 * breath + 0.45 * th);
  },
};
