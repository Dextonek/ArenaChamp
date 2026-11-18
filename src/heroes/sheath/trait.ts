import type { Trait } from '../../traits/types';
import { P } from './numbers';

/**
 * Kagen's passive, Its Passive (a DRAFT): written on the kit sheet at gate 3, built at gate 4. The hooks a passive
 * may use are `Trait` in src/traits/types.ts; what runs on which screen: pipeline/designs/kit-build-brief.md, "The trait
 * API" (rule 7: every stack, mark and timer shows on both screens; nothing both must agree on uses chance).
 * Gate 5 (rule 8): tell the CPU when to hold each spell (`aiHold`) and where to walk (`aiGoal`, `enemyGoal`).
 */
const trait: Trait = {
  passive: { name: 'Its Passive', blurb: '(What the passive does, in words a player can act on: rule 3.)' },
  speed: P.speed,
};

export default trait;
