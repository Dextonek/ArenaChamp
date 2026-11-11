import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import type { HeroKit } from '../heroes';
import type { Omen, OmenId } from './omens';

/**
 * How rare an upgrade is (user, 2026-11-11: "evolve the raid"). Blue ones are stronger; gold ones change how a fight is played;
 * a dark pact is strong and costs something. Its altar and its card take its colour.
 */
export type Rarity = 'rare' | 'gold' | 'dark';

/** The colours of each rarity: the card's edge and name, the altar's light. */
export const RARITY_COLOR: Record<Rarity | 'common', { edge: string; name: string; light: number }> = {
  common: { edge: '#8a7a52', name: '#ffd27a', light: 0xffe27a },
  rare: { edge: '#4f8fd8', name: '#8cc4ff', light: 0x7ab8ff },
  gold: { edge: '#f0b832', name: '#ffcf4a', light: 0xffb820 },
  dark: { edge: '#9a3048', name: '#ff7a8e', light: 0xc0304a },
};

/** What an upgrade is, on the pick screen. */
export interface Upgrade {
  id: string;
  name: string;
  blurb: string;
  rarity?: Rarity;
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

/** Blue: stronger than the plain ones, a little of a new habit. */
export const RARE: Upgrade[] = [
  { id: 'leech', name: 'Sun Drinker', blurb: 'Heal 5 % of the damage you deal to the boss.', rarity: 'rare' },
  { id: 'surefoot', name: 'Sure Feet', blurb: 'A sun shard no longer slows you, and the boss’s blows push you half as far.', rarity: 'rare' },
  { id: 'bulwark', name: 'Bulwark', blurb: 'When the boss kneels, a shield of 12 % of your max HP.', rarity: 'rare' },
];

/** Gold: they change how a fight is played. */
export const GOLD: Upgrade[] = [
  { id: 'closecall', name: 'Close Call', blurb: 'An orange zone that lands just beside you takes 1.5 s off each of your cooldowns.', rarity: 'gold' },
  { id: 'fury', name: 'Kneel Fury', blurb: 'While the boss kneels or stands open, your cooldowns run twice as fast.', rarity: 'gold' },
  { id: 'phoenix', name: 'Phoenix Heart', blurb: 'Once a fight, a killing hit leaves you at 40 % HP instead.', rarity: 'gold' },
  { id: 'suneater', name: 'Sun Eater', blurb: 'Standing in a gold zone as it lands gives you a shield of 10 % of your max HP.', rarity: 'gold' },
];

/** Dark pacts: strong, with a price. Only ever the third card, and never in the first hall. */
export const DARK: Upgrade[] = [
  { id: 'reckless', name: 'Reckless Pact', blurb: 'Deal 35 % more damage. The boss’s hits cost you 25 % more.', rarity: 'dark' },
  { id: 'haste', name: 'Haste Pact', blurb: 'Cooldowns 30 % shorter. 25 % less max HP.', rarity: 'dark' },
  { id: 'blood', name: 'Blood Pact', blurb: 'Your ultimate comes back 40 % sooner. Nothing can heal you.', rarity: 'dark' },
];

/** The chance a card is gold or blue, rising with each hall of the run (`depth`: 0 for the first). */
const goldChance = (depth: number) => Math.min(0.3, 0.06 + 0.04 * depth);
const rareChance = (depth: number) => Math.min(0.45, 0.2 + 0.05 * depth);
/** The chance the third card is a dark pact, from the second hall on. */
const DARK_CHANCE = 0.35;
/** What a few of them are worth. */
const LEECH = 0.05;
export const CLOSE_CALL = { reach: 1.2, seconds: 1.5 } as const;
export const BULWARK = 0.12;
export const SUN_EATER = 0.1;

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

/**
 * Three upgrades from the seed: what this hero can use and hasn't got. Each card may come up blue or gold, more often deeper in the
 * run (`depth`: how many halls came before this one), and from the second hall the third may be a dark pact. Once the plain ones run
 * out, what can be taken again fills the cards. Time running out takes the first, which is never a pact.
 */
export function offersFor(kit: HeroKit, owned: RunUpgrades, seed: string, depth = 0): Upgrade[] {
  const rng = seeded(seedNumber(seed));
  const can = (u: Upgrade) => !owned.has(u.id) && (u.fits?.(kit) ?? true);
  const common = shuffled(UPGRADES.filter(can), rng), rare = shuffled(RARE.filter(can), rng), gold = shuffled(GOLD.filter(can), rng);
  const dark = shuffled(DARK.filter(can), rng), filler = shuffled(STACKING, rng);
  const out: Upgrade[] = [];
  for (let i = 0; i < 3; i++) {
    const r = rng(), pact = rng();
    if (i === 2 && depth > 0 && dark.length && pact < DARK_CHANCE) { out.push(dark.shift()!); continue; }
    const pool = r < goldChance(depth) && gold.length ? gold
      : r < goldChance(depth) + rareChance(depth) && rare.length ? rare
        : common.length ? common : rare.length ? rare : gold.length ? gold : filler;
    out.push(pool.shift() ?? filler.shift()!);
  }
  return out;
}

/**
 * The upgrades a hero has taken in this run: one more layer on top of its own trait. They live on the hero's own screen, as
 * its HP and cooldowns do. Nothing here lasts past the run.
 */
export class RunUpgrades {
  private ids = new Map<string, number>();
  private saved = false;
  private rose = false;
  /** This tier's omens (./omens.ts): they change a few of the numbers below for both of its fights. */
  omens: readonly Omen[] = [];

  /** An omen of this tier is on. */
  omen(id: OmenId) {
    return this.omens.some((o) => o.id === id);
  }

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
    this.rose = false;
  }

  cooldownMul(slot: number) {
    return (this.has('hands') ? 0.85 : 1) * (slot === 3 && this.has('ready') ? 0.75 : 1) * 0.95 ** this.count('breath') * (this.omen('heavy') ? 0.9 : 1) *
      (this.has('haste') ? 0.7 : 1) * (slot === 3 && this.has('blood') ? 0.6 : 1);
  }

  hpMul() {
    return (this.has('glass') ? 0.85 : 1) * (this.has('stone') ? 1.2 : 1) * 1.1 ** this.count('hide') * (this.has('haste') ? 0.75 : 1);
  }

  get speedMul() {
    return (this.has('stride') ? 1.15 : 1) * (this.omen('heavy') ? 0.9 : 1);
  }

  /** What this hero's hits on the boss are multiplied by. `open`: it stands open or kneels. */
  dealtMul(open: boolean) {
    return (this.has('glass') ? 1.25 : 1) * (open && this.has('opportunist') ? 1.6 : 1) * 1.08 ** this.count('whetstone') * (this.has('reckless') ? 1.35 : 1);
  }

  get staggerMul() {
    return (this.has('breaker') ? 1.4 : 1) * (this.omen('brittle') ? 1.5 : 1);
  }

  /** What every hit on this hero is multiplied by (Brittle). */
  get harmMul() {
    return (this.omen('brittle') ? 1.2 : 1) * (this.has('reckless') ? 1.25 : 1);
  }

  /** The share of the damage dealt to the boss that heals this hero (Sun Drinker). */
  get leech() {
    return this.has('leech') ? LEECH : 0;
  }

  /** Whether anything may heal this hero (Blood Pact says no). */
  get healable() {
    return !this.has('blood');
  }

  /** What the boss's blows push this hero by (Sure Feet). */
  get knockMul() {
    return this.has('surefoot') ? 0.5 : 1;
  }

  /** Whether a carried sun shard slows this hero. */
  get shardSlows() {
    return !this.has('surefoot');
  }

  /** How fast the cooldowns run now. `open`: the boss stands open or kneels (Kneel Fury). */
  cooldownRate(open: boolean) {
    return open && this.has('fury') ? 2 : 1;
  }

  /** The share of max HP each phase's shield is worth. */
  get phaseShield() {
    return this.has('fresh') ? 0.1 : 0;
  }

  /**
   * A killing hit: what saves this hero, once a fight each. Phoenix Heart first: the share of max HP it is left at (0.4). Then
   * Stubborn: -1, for 1 HP. 0: nothing does.
   */
  trySave() {
    if (this.has('phoenix') && !this.rose) {
      this.rose = true;
      return 0.4;
    }
    if (!this.has('stubborn') || this.saved) return 0;
    this.saved = true;
    return -1;
  }
}
