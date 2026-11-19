import { sketch } from '../../framework/sketch';
import { spell } from '../../framework/spell';
import { C, W } from '../numbers';

/**
 * Noto, The Click (Kagen's W). No aim: he slides the blade home. A ring of 3.5 m shows round where he stands for 0.5 s, then
 * the click. The click itself deals nothing (`none`): every enemy inside the ring then is "hit" for 0, and the passive turns
 * that hit into his cut marks opening, 24 each (`dealt`, slot 1, on the screen that decides the enemy's hits). For 0.4 s after
 * the click, the next attack or spell that hits him is parried (`taken`, his own client).
 * Answer: step out of the ring, 0.9 m from his sword's reach to its edge: 0.25 + 0.9 / 4 = 0.48 s; it shows 0.5 s.
 * On the blocks: a zone round him, judged once.
 */
export const notoModule = spell<null>({
  label: 'noto',
  category: 'hero: sheath',
  targeting: { mode: 'self', radius: W.radius },
  seconds: W.windup + 0.9,
  state: () => null,
  rules: {
    windup: W.windup,
    shape: { kind: 'zone', area: (c) => ({ kind: 'circle', x: c.from.x, z: c.from.z, radius: W.radius }) },
    hit: { damage: 0, none: true, knock: 0, color: C.accent },
  },
  look: sketch<null>(C.accent, C.dark),
  noDamage: true,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 1,
});
