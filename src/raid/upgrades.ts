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

/** Up to three upgrades this hero can use and hasn't got, from the seed. Time running out takes the first. */
export function offersFor(kit: HeroKit, owned: RunUpgrades, seed: string): Upgrade[] {
  const rng = seeded(seedNumber(seed));
  const open = UPGRADES.filter((u) => !owned.has(u.id) && (u.fits?.(kit) ?? true));
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  return open.slice(0, 3);
}

/**
 * The upgrades a hero has taken in this run: one more layer on top of its own trait. They live on the hero's own screen, as
 * its HP and cooldowns do. Nothing here lasts past the run.
 */
export class RunUpgrades {
  private ids = new Set<string>();
  private saved = false;

  has(id: string) {
    return this.ids.has(id);
  }

  add(id: string) {
    this.ids.add(id);
  }

  names() {
    return UPGRADES.filter((u) => this.ids.has(u.id)).map((u) => u.name);
  }

  /** A new fight: what works once a fight is ready again. */
  newFight() {
    this.saved = false;
  }

  cooldownMul(slot: number) {
    return (this.has('hands') ? 0.85 : 1) * (slot === 3 && this.has('ready') ? 0.75 : 1);
  }

  hpMul() {
    return (this.has('glass') ? 0.85 : 1) * (this.has('stone') ? 1.2 : 1);
  }

  get speedMul() {
    return this.has('stride') ? 1.15 : 1;
  }

  /** What this hero's hits on the boss are multiplied by. `open`: it stands open or kneels. */
  dealtMul(open: boolean) {
    return (this.has('glass') ? 1.25 : 1) * (open && this.has('opportunist') ? 1.6 : 1);
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
