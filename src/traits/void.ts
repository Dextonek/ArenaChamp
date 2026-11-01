import type { Trait } from './types';

/** Seconds Void Mantle's maw stays open (matches the spell's shell). */
const MAW = 2;

/**
 * Oblivion (juggernaut). Passive Event horizon: his hits on an enemy within 3 m slow it. Twist Collapse: Unmaking can be
 * cast once more within 3 s, free, for 60% damage. Void Mantle opens a maw for 2 s that swallows the next enemy spell
 * whole: every hit of that one cast does nothing (a spell shield; his own client decides it, so it holds online).
 */
export const voidTrait: Trait = {
  passive: { name: 'Event horizon', blurb: 'His hits on an enemy within 3 m slow it for 0.5 s. Void Mantle swallows the next enemy spell within 2 s: all of its hits do nothing.' },
  twist: { name: 'Collapse', blurb: 'Cast Unmaking again within 3 s for free: a second collapse at 60% damage.' },
  speed: 3.8,
  attack: { kind: 'melee', range: 2.6, damage: 13, interval: 1.2, windup: 0.3, speed: 0, look: 'cleave' },
  recast: { slot: 3, window: 3, name: 'Collapse', power: 0.6 },
  afterCast(t, slot) {
    if (slot !== 2) return;
    t.mem.mawUntil = t.time + MAW;
    t.mem.mawCast = -1;
  },
  dealt(t, hit) {
    if (hit.victimIsHero && !hit.opts.status && t.enemyDistance() < 3) hit.opts = { ...hit.opts, status: { kind: 'slow', seconds: 0.5 } };
  },
  taken(t, hit) {
    if (hit.kind !== 'spell' || hit.cast === undefined) return;
    const key = hit.cast * 4 + (hit.slot ?? 0);
    // The cast the maw caught: all its hits go in, even after the 2 s.
    if (t.mem.mawCast === key) { hit.blocked = true; return; }
    if (t.mem.mawCast === -1 && t.time < (t.mem.mawUntil ?? 0)) {
      t.mem.mawCast = key;
      hit.blocked = true;
      t.say('SWALLOWED', '#c9a0ff');
    }
  },
  badge: (t) => (t.mem.mawCast === -1 && t.time < (t.mem.mawUntil ?? 0) ? 'MAW' : ''),
};
