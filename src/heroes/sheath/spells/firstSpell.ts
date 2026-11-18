import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, Q } from '../numbers';

/**
 * First Spell (Kagen, Q): a bolt down the aim; it hits the first enemy it touches and stops there, at a wall or at its reach. A DRAFT made by pipeline/tools/new-hero.py.
 *
 * On the spell blocks (src/heroes/framework/blocks.ts): the rules below, numbers from ../numbers.ts. The look is the
 * sketch (the hit's own shape in the accent) until gate 4 draws its own: a class told the moments it needs, as
 * src/heroes/sumo/spells/stomp.ts. Hooks into the passive go in `rules.on` (cast, release, stop, impact, frame).
 */
export const firstSpellModule = spell<null>({
  label: 'kagen first spell',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: Q.radius },
  seconds: Q.windup + Q.range / Q.speed + 0.6,
  state: () => null,
  rules: {
    windup: Q.windup,
    shape: { kind: 'bolt', speed: Q.speed, range: Q.range, radius: Q.radius },
    hit: { damage: Q.damage, knock: Q.knock, color: C.accent },
  },
  look: sketch<null>(C.accent, C.dark),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 200,
});
