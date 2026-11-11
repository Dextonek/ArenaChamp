import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';

/**
 * Omens (user, 2026-11-11: "evolve the raid"): each tier the hall shows one or two twists that hold for both of its fights, so no
 * two runs play alike. Both screens of a raid for two roll them from the same seed (the match's id and the tier), so the hub needs
 * to know nothing: every omen acts on this screen's own hero, on its own clock, or on the brain. What each does: `RunUpgrades`
 * (walk, cooldowns, gauge), `BossFight` (the enrage, the dark, the lava, the brain's rests), `BossScript` (the lava, the hits).
 */
export interface Omen {
  id: OmenId;
  name: string;
  blurb: string;
  /** Kind enough for a first tier. */
  mild?: boolean;
}

export type OmenId = 'molten' | 'quick' | 'night' | 'brittle' | 'fuse' | 'heavy';

export const OMENS: Omen[] = [
  { id: 'molten', name: 'Molten Ground', blurb: 'Where an orange circle lands, lava stays for 4 s.', mild: true },
  { id: 'night', name: 'Long Night', blurb: 'The room is dark beyond a few metres of you.', mild: true },
  { id: 'brittle', name: 'Brittle', blurb: 'Hits on you cost 20 % more, but your control fills the gauge 50 % faster.', mild: true },
  { id: 'heavy', name: 'Heavy Air', blurb: 'You walk 10 % slower, but your cooldowns are 10 % shorter.', mild: true },
  { id: 'quick', name: 'Quickened Court', blurb: 'The boss rests 25 % less between its moves.' },
  { id: 'fuse', name: 'Short Fuse', blurb: 'The boss enrages 25 % sooner.' },
];

/** What Molten Ground's lava does: how long a pool stays (s), its widest (m), what a second in it costs (share of max HP). */
export const LAVA = { seconds: 4, radius: 2.4, every: 1, share: 0.04 } as const;
/** Quickened Court: how much of its rest between moves the boss keeps. */
export const QUICK_GAP = 0.75;
/** Short Fuse: how much of its enrage time is left. */
export const FUSE = 0.75;

/** The omens of one tier, from the run's seed: one at the first tier (a kind one), two from then on. */
export function omensFor(seed: string, tier: number): Omen[] {
  const rng = seeded(seedNumber(`${seed}-omens-${tier}`));
  const pool = OMENS.filter((o) => tier > 1 || o.mild);
  const out: Omen[] = [];
  const count = tier > 1 ? 2 : 1;
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/** "Molten Ground, Long Night" */
export const omenNames = (list: readonly Omen[]) => list.map((o) => o.name).join(', ');
