import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import type { HeroKit } from '../heroes';

/** What an upgrade is, on the pick screen. */
export interface Upgrade {
  id: string;
  name: string;
  blurb: string;
  /** Only heroes this can do anything for are offered it. */
  fits?(kit: HeroKit): boolean;
}

const spellsOf = (kit: HeroKit) => [...kit.spells, ...(kit.alt?.spells ?? [])];

export const UPGRADES: Upgrade[] = [
  { id: 'ricochet', name: 'Ricochet', blurb: 'Your bolts bounce once off cover.', fits: (k) => spellsOf(k).some((s) => s.aim === 'line' && !s.overCover && !s.bank) },
  { id: 'hands', name: 'Quick Hands', blurb: 'Cooldowns 15 % shorter.' },
  { id: 'ready', name: 'Ready Again', blurb: 'Your ultimate comes back 25 % sooner.' },
  { id: 'stride', name: 'Long Stride', blurb: 'Walk 15 % faster.' },
  { id: 'glass', name: 'Glass Edge', blurb: 'Deal 25 % more damage. 15 % less max HP.' },
  { id: 'stone', name: 'Stone Skin', blurb: '20 % more max HP.' },
  { id: 'stubborn', name: 'Stubborn', blurb: 'Once a fight, a killing hit leaves you 1 HP.' },
  { id: 'opportunist', name: 'Opportunist', blurb: '60 % more damage while the boss stands open or kneels.' },
  { id: 'breaker', name: 'Bone Breaker', blurb: 'Your control fills the stagger gauge 40 % faster.', fits: (k) => spellsOf(k).some((s) => s.cc) },
  { id: 'fresh', name: 'Fresh Start', blurb: 'A shield of 10 % of your max HP as each phase begins.' },
];

/** What fills the cards once fewer than three of the others are left: small, and they can be taken again and again. */
export const STACKING: Upgrade[] = [
  { id: 'whetstone', name: 'Whetstone', blurb: 'Deal 8 % more damage. You can take this again.' },
  { id: 'hide', name: 'Thick Hide', blurb: '10 % more max HP. You can take this again.' },
  { id: 'breath', name: 'Steady Breath', blurb: 'Cooldowns 5 % shorter. You can take this again.' },
];

function shuffled<T>(list: T[], rng: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Three upgrades from the seed: what this hero can use and hasn't got, then what can be taken again. Time running out takes the first. */
export function offersFor(kit: HeroKit, owned: RunUpgrades, seed: string): Upgrade[] {
  const rng = seeded(seedNumber(seed));
  const open = shuffled(UPGRADES.filter((u) => !owned.has(u.id) && (u.fits?.(kit) ?? true)), rng);
  return [...open, ...shuffled(STACKING, rng)].slice(0, 3);
}

/**
 * The upgrades a hero has taken in this run: one more layer on top of its own trait. They live on the hero's own screen, as
 * its HP and cooldowns do. Nothing here lasts past the run.
 */
export class RunUpgrades {
  private ids = new Map<string, number>();
  private saved = false;

  has(id: string) {
    return this.ids.has(id);
  }

  add(id: string) {
    this.ids.set(id, this.count(id) + 1);
  }

  /** How many times it was taken (`STACKING` can be taken again). */
  count(id: string) {
    return this.ids.get(id) ?? 0;
  }

  /** A new fight: what works once a fight is ready again. */
  newFight() {
    this.saved = false;
  }

  cooldownMul(slot: number) {
    return (this.has('hands') ? 0.85 : 1) * (slot === 3 && this.has('ready') ? 0.75 : 1) * 0.95 ** this.count('breath');
  }

  hpMul() {
    return (this.has('glass') ? 0.85 : 1) * (this.has('stone') ? 1.2 : 1) * 1.1 ** this.count('hide');
  }

  get speedMul() {
    return this.has('stride') ? 1.15 : 1;
  }

  /** What this hero's hits on the boss are multiplied by. `open`: it stands open or kneels. */
  dealtMul(open: boolean) {
    return (this.has('glass') ? 1.25 : 1) * (open && this.has('opportunist') ? 1.6 : 1) * 1.08 ** this.count('whetstone');
  }

  get staggerMul() {
    return this.has('breaker') ? 1.4 : 1;
  }

  /** The share of max HP each phase's shield is worth. */
  get phaseShield() {
    return this.has('fresh') ? 0.1 : 0;
  }

  /** A killing hit: whether Stubborn takes it, once a fight. */
  trySave() {
    if (!this.has('stubborn') || this.saved) return false;
    this.saved = true;
    return true;
  }
}
