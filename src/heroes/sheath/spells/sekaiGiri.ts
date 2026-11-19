import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, R } from '../numbers';

/**
 * Sekai-giri, World Sever (Kagen's R, the ultimate). He draws one cut along a 12 m line from his feet (2.4 m wide); the line
 * is drawn on the floor and he stands still for 1.3 s (the world going grey round it is the look only: nobody else is held).
 * Then it tears open all along at once: 110 to everyone on the line (live position), once. At the same moment the passive
 * opens every cut mark on the enemy wherever they stand, at 36 each (`victimTick`, on the screen that decides the enemy's
 * hits, told by `show('sever')` from `afterCast`).
 * Answer: leave the line, 1.2 m to its edge: 0.25 + 1.2 / 4 = 0.55 s; it shows 1.3 s. The ultimate never lands when cast.
 * On the blocks: a lane whose front is the whole line at once, no move.
 */
export const sekaiGiriModule = spell<null>({
  label: 'sekai giri',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: R.width / 2 },
  seconds: R.windup + 1.2,
  state: () => null,
  rules: {
    windup: R.windup,
    shape: { kind: 'lane', length: R.range, width: R.width, late: 0.08, front: () => R.range },
    hit: { damage: R.damage, knock: R.knock, color: C.accent },
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.84 },
  frame: 7,
  maxDamage: 250,
});
