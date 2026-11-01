import type { Trait } from './types';

/**
 * Opaline (marksman). Passive Refraction: hits on a blinded enemy deal +15% (adapted: there is no "bolt missed" event to
 * split). Twist Prism charges: each of her damage spells that lands stores a light (max 3); Mirror Shell spends them
 * all, +10 shield per light on top of its own 45 (lights used to power the ultimate, which copied Nyx's combo points).
 */
export const prismTrait: Trait = {
  passive: { name: 'Refraction', blurb: 'Hits on a blinded enemy deal 15% more damage.' },
  twist: { name: 'Prism charges', blurb: 'Each of her spells that hits the enemy hero stores a light (max 3). Mirror Shell spends them all: 10 more shield per light.' },
  resource: { name: 'Light', max: 3, color: '#9fe8ff' },
  speed: 4.2,
  attack: { kind: 'ranged', range: 8.5, damage: 13, interval: 1.4, windup: 0.32, speed: 22, look: 'prism' },
  dealt(t, hit) {
    if (hit.victimIsHero && t.status(hit.victim)?.blind) {
      hit.damage *= 1.15;
      t.say('REFRACT', '#bff4ff');
    }
  },
  landed(t, hit) {
    if (hit.kind === 'spell' && hit.victimIsHero && hit.slot !== undefined && hit.slot !== 2 && !t.mem[`lt${hit.slot}`]) {
      // One light per cast, however many times the spell hits.
      t.mem[`lt${hit.slot}`] = 1;
      t.addRes(1);
    }
  },
  afterCast(t, slot) {
    if (slot !== 2) {
      t.mem[`lt${slot}`] = 0;
      return;
    }
    if (t.res <= 0) return;
    const lights = t.res;
    t.res = 0;
    // The shell's own shield is 45; a shield keeps the bigger of two, so this one carries both.
    t.shield(45 + 10 * lights, 3);
    t.say(`${lights} LIGHT`, '#bff4ff');
  },
  badge: (t) => (t.res > 0 ? String(t.res) : ''),
};
