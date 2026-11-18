import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, R } from '../numbers';

/**
 * Ultimate (Kagen, R): a circle at the aim that lands after its fuse; everyone inside it then is hit once. A DRAFT made by pipeline/tools/new-hero.py.
 *
 * On the spell blocks (src/heroes/framework/blocks.ts): the rules below, numbers from ../numbers.ts. The look is the
 * sketch (the hit's own shape in the accent) until gate 4 draws its own: a class told the moments it needs, as
 * src/heroes/sumo/spells/stomp.ts. Hooks into the passive go in `rules.on` (cast, release, stop, impact, frame).
 */
export const ultimateModule = spell<null>({
  label: 'kagen ultimate',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: R.radius },
  seconds: R.windup + R.delay + 0.8,
  state: () => null,
  rules: {
    windup: R.windup,
    shape: { kind: 'circle', radius: R.radius, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    delay: R.delay,
    hit: { damage: R.damage, knock: R.knock, color: C.accent },
    warn: 0,
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 6,
  maxDamage: 200,
});
