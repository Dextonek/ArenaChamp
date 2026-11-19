import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, Q } from '../numbers';

/**
 * Issen, One Flash (Kagen's Q). A thin line shows down the aim for 0.45 s (6 m by 1.2 m), then he crosses it in 0.15 s and
 * stands at its end (or where a wall or the ring stops him). Everyone the cut's front passes inside the lane, on their live
 * position, takes 32 once, and the passive leaves a cut mark on them (`dealt`, slot 0).
 * Answer: step off the line, 0.6 m to its edge: 0.25 + 0.6 / 4 = 0.40 s; it warns 0.45 s.
 * On the blocks: a lane with a move at the release, as Anka's Firebird.
 */
export const issenModule = spell<null>({
  label: 'issen',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: Q.width / 2 },
  seconds: Q.windup + Q.seconds + 0.8,
  state: () => null,
  rules: {
    windup: Q.windup,
    shape: { kind: 'lane', length: Q.range, width: Q.width, late: 0.05 },
    hit: { damage: Q.damage, knock: Q.knock, color: C.accent },
    move: { at: 'release', to: 'end', seconds: Q.seconds },
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 120,
});
