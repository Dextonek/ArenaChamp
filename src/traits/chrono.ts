import type { Trait } from './types';

/**
 * Tempo (mage). Passive Echo: each spell he casts winds the cooldowns of his other spells back 1.3 s. Twist Rewind
 * again: Rewind can be cast once more within 6 s, free.
 */
export const chronoTrait: Trait = {
  passive: { name: 'Echo', blurb: 'Every spell he casts winds the cooldowns of his other spells back 1.3 s.' },
  twist: { name: 'Rewind again', blurb: 'Cast Rewind a second time within 6 s, free: another trip back to the mark.' },
  speed: 4,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'gear' },
  recast: { slot: 2, window: 6, name: 'Rewind again', power: 0.6 },
  attackMods: () => ({ status: { kind: 'slow', seconds: 0.5 } }),
  afterCast(t, slot) {
    for (let s = 0; s < 4; s++) {
      if (s === slot) continue;
      const left = t.cooldownLeft(s);
      if (left > 0) t.setCooldown(s, Math.max(0, left - 1.3));
    }
  },
};
