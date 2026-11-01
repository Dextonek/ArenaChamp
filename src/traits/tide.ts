import type { Trait } from './types';

/**
 * Marin (controller). Passive Undertow: enemies she pulls or knocks up are slowed (or weakened) a second after. Twist
 * Tide: rises 25 a second; at 100 her next spell has no cooldown and spends the tide.
 */
export const tideTrait: Trait = {
  passive: { name: 'Undertow', blurb: 'Enemies she pulls or knocks up are slowed for 1 s (weakened by 15% if the hit already stuns them).' },
  twist: { name: 'Tide', blurb: 'The tide rises 25 a second. At full tide her next spell comes back at once, and the tide drains.' },
  resource: { name: 'Tide', max: 100, color: '#4fc3e8', start: 0 },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'wave' },
  tick(t, dt) {
    t.addRes(25 * dt);
  },
  cooldown(t, _slot, base) {
    if (t.res < 100) return base;
    t.res = 0;
    t.say('HIGH TIDE', '#9fe8ff');
    return 0;
  },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    const o = hit.opts;
    if (!o.pull && o.status?.kind !== 'knockup') return;
    if (!o.status) o.status = { kind: 'slow', seconds: 1 };
    else if (!o.debuff) o.debuff = { kind: 'weaken', amount: 0.15, seconds: 1 };
  },
  badge: (t) => (t.res >= 100 ? 'FULL' : `${Math.floor(t.res)}%`),
};
