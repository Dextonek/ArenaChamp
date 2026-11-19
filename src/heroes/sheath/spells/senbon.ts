import { insideTelegraph } from '../../../effects/telegraph';
import type { Enemy } from '../../../effects/common';
import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, E } from '../numbers';

/**
 * Senbon, Thousand Swords (Kagen's E). A ring of 3 m is painted at a spot within 8 m for 1.0 s, then katanas rain into it in
 * three waves, at 1.0, 1.4 and 1.8 s after the cast. Each wave that finds an enemy inside (live position): 10, and the
 * passive leaves a cut mark (`dealt`, slot 2). The ring stays drawn until the last wave.
 * Answer: walk out, 3 m from the very middle: 0.25 + 3 / 4 = 1.0 s; the first wave lands at 1.0 s.
 * On the blocks: a zone judged at 1.0 s (the first wave); the next two waves are this spell's own rule (`on.frame`), judged in
 * the same ring, which is the danger zone until the last.
 */
interface Rain { wave: number }

export const senbonModule = spell<Rain>({
  label: 'senbon',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: E.radius },
  seconds: E.waves[E.waves.length - 1] + 0.8,
  state: () => ({ wave: 1 }),
  rules: {
    windup: 0,
    delay: E.waves[0],
    shape: {
      kind: 'zone',
      area: (c) => ({ kind: 'circle', x: c.ctx!.point.x, z: c.ctx!.point.z, radius: E.radius }),
      until: E.waves[E.waves.length - 1] - E.waves[0] + 0.05,
    },
    hit: { damage: E.damage, knock: E.knock, color: C.accent },
    on: {
      frame(c, t) {
        const ctx = c.ctx, area = c.area;
        if (!ctx || !area) return;
        while (c.state.wave < E.waves.length && t >= E.waves[c.state.wave]) {
          c.state.wave++;
          const caught: Enemy[] = [];
          for (const en of ctx.enemies?.() ?? ctx.targets) {
            const q = en.group.position;
            if (!insideTelegraph(area, q.x, q.z)) continue;
            ctx.hit(en, c.hitOptions(undefined, c.from.clone()));
            caught.push(en);
          }
          c.caught = caught;
        }
      },
    },
  },
  look: sketch<Rain>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 5,
  maxDamage: 60,
});
