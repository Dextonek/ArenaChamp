import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, E } from '../numbers';

/**
 * Third Spell (Kagen, E): a dash down the aim; whoever its front passes in the lane is hit once. A DRAFT made by pipeline/tools/new-hero.py.
 *
 * On the spell blocks (src/heroes/framework/blocks.ts): the rules below, numbers from ../numbers.ts. The look is the
 * sketch (the hit's own shape in the accent) until gate 4 draws its own: a class told the moments it needs, as
 * src/heroes/sumo/spells/stomp.ts. Hooks into the passive go in `rules.on` (cast, release, stop, impact, frame).
 */
export const thirdSpellModule = spell<null>({
  label: 'kagen third spell',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: E.width / 2 },
  seconds: E.windup + E.seconds + 0.8,
  state: () => null,
  rules: {
    windup: E.windup,
    shape: { kind: 'lane', length: E.range, width: E.width, late: 0.05 },
    hit: { damage: E.damage, knock: E.knock, color: C.accent },
    move: { at: 'release', to: 'end', seconds: E.seconds },
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 200,
});
