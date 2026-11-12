import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import type { HeroKit } from '../heroes';
import { RunUpgrades } from '../raid/upgrades';
import type { TwistId } from './week';

/**
 * The Tower's boons (pipeline/designs/tower.md): after each floor one of three, always a heal, a power and a relic, so every
 * landing asks the same question: health now, or strength for the floors above. They are the Tower's own set, not the Raid's
 * upgrades. `TowerBoons` is a `RunUpgrades`, so `Duel.startBoss({ upgrades })` takes it and every hook a raid's upgrade has works
 * for a boon; nothing in src/raid/upgrades.ts is changed.
 */
export type BoonKind = 'heal' | 'power' | 'relic';

export interface Boon {
  id: string;
  kind: BoonKind;
  name: string;
  blurb: string;
  /** Only a hero this can do something for is offered it. */
  fits?(kit: HeroKit): boolean;
}

const spellsOf = (kit: HeroKit) => [...kit.spells, ...(kit.alt?.spells ?? [])];

/** What a heal gives at once, as a share of max health. Second Wind also gives `WIND_AFTER` after every floor from then on. */
export const HEAL = { rest: 0.35, wind: 0.15, kindle: 0.25 } as const;
export const WIND_AFTER = 0.05;
/** Each power, each time it is taken. */
const EDGE = 1.12, HANDS = 0.92, STRIDE = 1.08, WARD = 0.92;
/** Thick Hide: what each one multiplies max health by. The health it adds comes filled (src/tower/run.ts). */
export const HIDE = 1.12;
/** A power can be taken this many times; Long Stride fewer, so nobody outruns every zone. */
const POWER_MOST: Record<string, number> = { 'tw-stride': 3 };
/** The relics' numbers. */
const ECHO = 0.5, GLASS = 0.6, THIRST = 0.06, FEATHER = 0.3, CROWN = { stagger: 1.5, open: 1.4 }, STAIR_WARD = 0.12;
/** The twists a floor can lay on the hero (src/tower/week.ts, `TWISTS`). */
const THIN = { walk: 0.9, cooldown: 0.9 }, FRAIL = 1.2;

export const BOONS: Boon[] = [
  { id: 'tw-rest', kind: 'heal', name: 'Lantern Rest', blurb: 'Restore 35 % of your health.' },
  { id: 'tw-wind', kind: 'heal', name: 'Second Wind', blurb: 'Restore 15 % now, and 5 % after every floor from here on.' },
  { id: 'tw-kindle', kind: 'heal', name: 'Kindled Heart', blurb: 'A lost life comes back. With all three, restore 25 % of your health.' },
  { id: 'tw-edge', kind: 'power', name: 'Keen Edge', blurb: 'Deal 12 % more damage.' },
  { id: 'tw-hide', kind: 'power', name: 'Thick Hide', blurb: '12 % more max health.' },
  { id: 'tw-hands', kind: 'power', name: 'Quick Hands', blurb: 'Cooldowns 8 % shorter.' },
  { id: 'tw-stride', kind: 'power', name: 'Long Stride', blurb: 'Walk 8 % faster.' },
  { id: 'tw-ward', kind: 'power', name: 'Warding', blurb: 'Every hit on you costs 8 % less.' },
  { id: 'tw-mirror', kind: 'relic', name: 'Mirror Shard', blurb: 'Your bolts bounce once off pillars and walls.', fits: (k) => spellsOf(k).some((s) => s.aim === 'line' && !s.overCover && !s.bank) },
  { id: 'tw-echo', kind: 'relic', name: 'Echo Stone', blurb: 'Your first spell comes back twice as fast.' },
  { id: 'tw-glass', kind: 'relic', name: 'Hourglass', blurb: 'Your ultimate comes back 40 % sooner.' },
  { id: 'tw-thirst', kind: 'relic', name: 'Thirsting Blade', blurb: 'Your attacks and spells heal you for 6 % of the damage they deal.' },
  { id: 'tw-brink', kind: 'relic', name: 'On the Brink', blurb: 'A zone that lands just beside you takes 1.5 s off every cooldown.' },
  { id: 'tw-feather', kind: 'relic', name: 'Phoenix Feather', blurb: 'Once a floor, a killing hit leaves you at 30 % health instead.' },
  { id: 'tw-crown', kind: 'relic', name: 'Breaker’s Crown', blurb: 'Your control fills a foe’s gauge 50 % faster, and you deal 40 % more to a foe on its knees.', fits: (k) => spellsOf(k).some((s) => s.cc) },
  { id: 'tw-sun', kind: 'relic', name: 'Sunlit', blurb: 'Standing in a gold zone as it lands gives you a shield of 10 % of your max health.' },
  { id: 'tw-stair', kind: 'relic', name: 'Stair Ward', blurb: 'Each floor begins with a shield of 12 % of your max health.' },
];

export const boonById = (id: string) => BOONS.find((b) => b.id === id);

/** The card's colours for each kind of boon: green heals, the gold of a power, the blue of a relic. */
export const BOON_COLOR: Record<BoonKind, { edge: string; name: string; light: number; word: string }> = {
  heal: { edge: '#4f9a6a', name: '#9df0b4', light: 0x8dffb0, word: 'Heal' },
  power: { edge: '#8a7a52', name: '#ffd27a', light: 0xffe27a, word: 'Power' },
  relic: { edge: '#4f8fd8', name: '#8cc4ff', light: 0x7ab8ff, word: 'Relic' },
};

/** What the engine asks a raid's upgrades by name, and the boon that answers for it here. */
const ENGINE_IDS: Record<string, string> = { ricochet: 'tw-mirror', closecall: 'tw-brink', suneater: 'tw-sun' };

/**
 * The boons a hero has taken in this climb. Every number the duel reads from a run's upgrades is answered here from the
 * Tower's own boons and the floor's twist; the Raid's ids mean nothing here, except the three the engine asks for by name
 * (`ENGINE_IDS`).
 *
 * TOWER-HOOK: `RunUpgrades` has no declared return types, so each of its getters has the type of the Raid's own numbers
 * (`0 | 0.05` for `leech`, `-1 | 0 | 0.4` for `trySave`). A boon with another number is cast to that type below. The class
 * should say `: number` on them (no behaviour changes), or the duel should take an interface instead of the class.
 */
export class TowerBoons extends RunUpgrades {
  private owned = new Map<string, number>();
  private risen = false;
  /** This floor's twist: two of them act on the hero. */
  twist: TwistId | undefined;

  override has(id: string) {
    return this.owned.has(ENGINE_IDS[id] ?? id);
  }

  override add(id: string) {
    this.owned.set(id, this.count(id) + 1);
  }

  override count(id: string) {
    return this.owned.get(id) ?? 0;
  }

  /** What was taken, for the saved climb: ids with how often. */
  list(): [string, number][] {
    return [...this.owned];
  }

  static from(list: [string, number][]) {
    const b = new TowerBoons();
    for (const [id, n] of list) if (boonById(id)) b.owned.set(id, n);
    return b;
  }

  override newFight() {
    this.risen = false;
  }

  override cooldownMul(slot: number) {
    return HANDS ** this.count('tw-hands') * (slot === 0 && this.has('tw-echo') ? ECHO : 1) * (slot === 3 && this.has('tw-glass') ? GLASS : 1) *
      (this.twist === 'thin' ? THIN.cooldown : 1);
  }

  override hpMul() {
    return HIDE ** this.count('tw-hide');
  }

  override get speedMul() {
    return STRIDE ** this.count('tw-stride') * (this.twist === 'thin' ? THIN.walk : 1);
  }

  override dealtMul(open: boolean) {
    return EDGE ** this.count('tw-edge') * (open && this.has('tw-crown') ? CROWN.open : 1);
  }

  override get staggerMul() {
    return this.has('tw-crown') ? CROWN.stagger : 1;
  }

  override get harmMul() {
    return WARD ** this.count('tw-ward') * (this.twist === 'frail' ? FRAIL : 1);
  }

  override get leech() {
    return (this.has('tw-thirst') ? THIRST : 0) as RunUpgrades['leech'];
  }

  override get healable() {
    return true;
  }

  override get knockMul() {
    return 1 as RunUpgrades['knockMul'];
  }

  override get shardSlows() {
    return true;
  }

  override cooldownRate() {
    return 1 as ReturnType<RunUpgrades['cooldownRate']>;
  }

  override get phaseShield() {
    return (this.has('tw-stair') ? STAIR_WARD : 0) as RunUpgrades['phaseShield'];
  }

  /** A killing hit: the Phoenix Feather saves this hero once a floor, at 30 % of max health. */
  override trySave() {
    if (!this.has('tw-feather') || this.risen) return 0;
    this.risen = true;
    return FEATHER as ReturnType<RunUpgrades['trySave']>;
  }

  /** What every floor's end gives back, as a share of max health (Second Wind, each time it was taken). */
  get regen() {
    return WIND_AFTER * this.count('tw-wind');
  }
}

function shuffled<T>(list: T[], rng: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The three boons offered after a floor, from its seed: a heal, a power and a relic, in that order. The order of each kind is the
 * seed's alone, the same for everyone that week; what a hero cannot use or already has is passed over. Once the relics run out a
 * second power takes the third card. `lives`: Kindled Heart is only offered to a hero that has lost one.
 */
export function boonsFor(seed: string, kit: HeroKit, owned: TowerBoons, lives: number): Boon[] {
  const rng = seeded(seedNumber(`${seed}-boons`));
  const of = (kind: BoonKind) => shuffled(BOONS.filter((b) => b.kind === kind), rng);
  const heals = of('heal'), powers = of('power'), relics = of('relic');
  const open = (b: Boon) => (b.fits?.(kit) ?? true) && (b.kind === 'power' ? owned.count(b.id) < (POWER_MOST[b.id] ?? 99) : b.kind === 'relic' ? !owned.has(b.id) : true);
  const heal = heals.find((b) => b.id !== 'tw-kindle' || lives < 3) ?? heals[0];
  const power = powers.filter(open);
  const relic = relics.find(open);
  return [heal, power[0], relic ?? power[1] ?? power[0]];
}
