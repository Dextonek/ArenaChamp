import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, W } from '../numbers';

/**
 * Second Spell (Kagen, W): a circle at the aim that lands after its fuse; everyone inside it then is hit once. A DRAFT made by pipeline/tools/new-hero.py.
 *
 * On the spell blocks (src/heroes/framework/blocks.ts): the rules below, numbers from ../numbers.ts. The look is the
 * sketch (the hit's own shape in the accent) until gate 4 draws its own: a class told the moments it needs, as
 * src/heroes/sumo/spells/stomp.ts. Hooks into the passive go in `rules.on` (cast, release, stop, impact, frame).
 */
export const secondSpellModule = spell<null>({
  label: 'kagen second spell',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: W.radius },
  seconds: W.windup + W.delay + 0.8,
  state: () => null,
  rules: {
    windup: W.windup,
    shape: { kind: 'circle', radius: W.radius, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    delay: W.delay,
    hit: { damage: W.damage, knock: W.knock, color: C.accent },
    warn: 0,
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 200,
});
