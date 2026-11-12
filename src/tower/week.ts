import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';

/**
 * The week's Tower (pipeline/designs/tower.md): the same floors for everyone, a new Tower every Monday. Everything here comes
 * from the week's name alone ("2026-W46", the ISO week in UTC), so every browser builds the same Tower with no server.
 */

/** The six kinds of floor. A guardian stands on every tenth. */
export type FloorKind = 'gauntlet' | 'horde' | 'duel' | 'break' | 'hold' | 'guardian';
/** What a floor from 11 on borrows from a second kind: sweeping fire, a few of the horde, a turret, a spot to stand on. */
export type FloorMix = 'gauntlet' | 'horde' | 'break' | 'hold';
/** A room's twist, from floor 11 on (src/tower/floors.ts says what each does). */
export type TwistId = 'dark' | 'molten' | 'restless' | 'thin' | 'frail';
/** What a hero that guards the stairs has on its side. */
export type DuelTwist = 'giant' | 'swift' | 'warded';

export const KIND_NAME: Record<FloorKind, string> = {
  gauntlet: 'Gauntlet', horde: 'Horde', duel: 'Duel', break: 'Break it', hold: 'Hold out', guardian: 'Guardian',
};

export const TWISTS: Record<TwistId, { name: string; blurb: string }> = {
  dark: { name: 'Lightless', blurb: 'The room is dark beyond a few steps of you.' },
  molten: { name: 'Molten Steps', blurb: 'A circle that lands leaves fire for a while.' },
  restless: { name: 'Restless', blurb: 'The room rests less between its blows.' },
  thin: { name: 'Thin Air', blurb: 'You walk slower up here, and your spells come back sooner.' },
  frail: { name: 'Frail', blurb: 'Every hit on you costs more.' },
};

/** The heroes the Tower keeps echoes of, for a Duel and a Guardian (why these: src/tower/floors.ts, `echoKit`). */
export const ECHOES = ['Brannoc', 'Lyra', 'Nyx', 'Marin', 'Zephyr', 'Ada', 'Oblivion', 'Bram', 'Sirix', 'Vitriol'];

/** One floor of a week's Tower: what it is. Its numbers follow from `n` (src/tower/floors.ts). */
export interface FloorPlan {
  /** From 1. */
  n: number;
  kind: FloorKind;
  /** From floor 11: what it borrows from a second kind. */
  mix?: FloorMix;
  /** From floor 11: the room's twist. */
  twist?: TwistId;
  /** A Duel and a Guardian: whose echo guards the stairs, and what a Duel's has on its side. */
  foe?: string;
  duel?: DuelTwist;
  /** The floor's own seed: its layout, its brain's rolls and the boons offered after it. */
  seed: string;
}

/** The ISO week of a moment, in UTC: "2026-W46", and when the next one begins. */
export function isoWeek(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // ISO: weeks start on Monday, and a week belongs to the year its Thursday is in.
  const dow = (day.getUTCDay() + 6) % 7;
  const monday = new Date(day.getTime() - dow * 86400000);
  const thursday = new Date(monday.getTime() + 3 * 86400000);
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const first = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
  const week = 1 + Math.round((monday.getTime() - first.getTime()) / (7 * 86400000));
  return { id: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, next: new Date(monday.getTime() + 7 * 86400000) };
}

/** The week before `id`, by its name. */
export function weekBefore(id: string) {
  const m = /^(\d+)-W(\d+)$/.exec(id);
  if (!m) return id;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const first = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000;
  return isoWeek(new Date(first + (Number(m[2]) - 2) * 7 * 86400000)).id;
}

const KINDS: Exclude<FloorKind, 'guardian'>[] = ['gauntlet', 'horde', 'duel', 'break', 'hold'];
/**
 * What each kind may borrow. A gauntlet and a time to hold out are only walked, so no keepers come into them: there would be
 * nothing to do about them. A gauntlet gets no spot to stand on either: it could come up behind a baffle, in a fire's way.
 * And no keepers ward a crystal: its clock would run out behind them.
 */
const MIXES: Record<Exclude<FloorKind, 'guardian'>, FloorMix[]> = {
  gauntlet: ['break'], hold: ['gauntlet', 'break'], horde: ['gauntlet', 'break', 'hold'], break: ['gauntlet', 'hold'],
  duel: ['gauntlet', 'horde', 'break', 'hold'],
};
const TWIST_IDS = Object.keys(TWISTS) as TwistId[];
const DUELS: DuelTwist[] = ['giant', 'swift', 'warded'];

const plans = new Map<string, FloorPlan[]>();

/**
 * Floors 1 to `upTo` of the week's Tower. A guardian on every tenth; between them the five kinds come in shuffled hands of five, so
 * every kind shows early and none comes twice in a row. Built in order and kept, so floor 31 costs no more than floor 3.
 */
export function towerFor(week: string, upTo = 30): FloorPlan[] {
  let list = plans.get(week);
  if (!list) plans.set(week, (list = []));
  if (list.length >= upTo) return list.slice(0, upTo);
  // One stream of rolls for the order of the kinds, replayed from the start, so a longer Tower begins as the shorter one did.
  const rng = seeded(seedNumber(`tower-${week}`));
  const kinds: FloorKind[] = [];
  let hand: FloorKind[] = [];
  for (let n = 1; n <= upTo; n++) {
    if (n % 10 === 0) { kinds.push('guardian'); continue; }
    if (!hand.length) {
      hand = [...KINDS];
      for (let i = hand.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [hand[i], hand[j]] = [hand[j], hand[i]];
      }
      // Never the same kind on both sides of a new hand.
      if (hand[0] === kinds[kinds.length - 1] || (kinds[kinds.length - 1] === 'guardian' && hand[0] === 'duel')) hand.push(hand.shift()!);
    }
    kinds.push(hand.shift()!);
  }
  for (let n = list.length + 1; n <= upTo; n++) {
    const kind = kinds[n - 1], seed = `tower-${week}-${n}`;
    // Each floor's own choices come from its own seed, so they don't shift when the Tower grows.
    const roll = seeded(seedNumber(`${seed}-plan`));
    const pick = <T>(from: readonly T[]) => from[Math.floor(roll() * from.length)];
    const plan: FloorPlan = { n, kind, seed };
    if (kind === 'duel' || kind === 'guardian') plan.foe = pick(ECHOES);
    if (kind === 'duel') plan.duel = pick(DUELS);
    if (n > 10 && kind !== 'guardian') {
      plan.mix = pick(MIXES[kind]);
      // A twist on two floors of three: a plain room now and then is a breath.
      if (roll() < 0.67) plan.twist = pick(TWIST_IDS);
    } else if (n > 10) plan.twist = pick(TWIST_IDS);
    list.push(plan);
  }
  return list.slice(0, upTo);
}

/** Floor `n` of the week's Tower (it has no top: the floors go on). */
export const floorOf = (week: string, n: number) => towerFor(week, Math.max(30, n))[n - 1];

/** "3 days" or "5 hours" until the next Tower. */
export function untilNext(now = new Date()) {
  const ms = isoWeek(now).next.getTime() - now.getTime();
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  return hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 24 ? '1 day' : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
