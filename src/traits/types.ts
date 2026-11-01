import type * as THREE from 'three';
import type { Enemy } from '../effects/common';
import type { HitOptions } from '../effects/targeting';
import type { BuffKind, StatusKind, StatusSet } from '../effects/status';
import type { AttackSpec } from '../attacks';

/**
 * The hero identity layer (pipeline/designs/hero-identity.md): every hero has a passive, a twist (its own resource, a
 * different input on one spell, stacks on the enemy) and its own basic attack and walk speed. A `Trait` is one hero's
 * rules, written as hooks; the duel runs one `TraitRuntime` per side and calls them.
 */

export type Side = 'hero' | 'opponent';

/** What a cast (or a basic attack) carries to every hit it makes. Travels with the cast in a network duel. */
export interface CastMods {
  /** Damage multiplier: charge, combo points, empowered casts, the caster's might / weaken. */
  power: number;
  /** A status every hit of the cast adds (unless the hit has its own). */
  status?: { kind: StatusKind; seconds: number };
  /** A debuff every hit of the cast adds. */
  debuff?: { kind: BuffKind; amount: number; seconds: number };
  /** Extra knockback on every hit (basic attacks: Brannoc's third swing). */
  knock?: number;
}

export const NO_MODS: CastMods = { power: 1 };

/** A hit being resolved: hooks may change `damage` and `opts` (a copy). */
export interface TraitHit {
  kind: 'spell' | 'attack' | 'unit';
  /** Spell slot 0-3 (spells only). */
  slot?: number;
  /** Which cast it came from (unique per side within a round): once-per-cast rules key on it, not on `afterCast`. */
  cast?: number;
  mods: CastMods;
  damage: number;
  opts: HitOptions;
  /** The figure hit, and whether it is the enemy hero (not a summoned unit). */
  victim: Enemy;
  victimIsHero: boolean;
  /**
   * Set by the victim's `taken` hook: the hit is swallowed whole (Isolde's ice block, Oblivion's mantle). No damage,
   * no status, debuff, knockback or pull, and the dealer does not learn it landed.
   */
  blocked?: boolean;
}

/** A hit that landed, as the dealer learns it (in a network duel: when the server confirms it). */
export interface LandedHit {
  kind: 'spell' | 'attack' | 'unit';
  slot?: number;
  damage: number;
  victimIsHero: boolean;
}

/** What a trait hook can see and do, bound to one side. */
export interface TraitView {
  readonly side: Side;
  /** Seconds since the round started. */
  readonly time: number;
  /** Seconds this hero has stood still (0 while it walks). */
  readonly still: number;
  self(): Enemy;
  /** The enemy hero (null between rounds). */
  enemy(): Enemy | null;
  status(of: Enemy): StatusSet | undefined;
  /** HP of this hero now, and its max. */
  hp(): number;
  maxHp(): number;
  /** The resource (0 when the trait has none). */
  res: number;
  addRes(n: number): void;
  say(text: string, color?: string): void;
  heal(amount: number): void;
  buff(kind: BuffKind, amount: number, seconds: number): void;
  /** Stacks this hero keeps on the enemy hero (`name` per mechanic), with the seconds they last. */
  stacks(name: string): number;
  addStacks(name: string, n: number, seconds: number, max: number): number;
  clearStacks(name: string): void;
  /** Free per-trait state (counters, flags), cleared every round. */
  mem: Record<string, number>;
  /** Puts a slot's cooldown to `seconds` now (refunds, resets), and reads it. */
  setCooldown(slot: number, seconds: number): void;
  cooldownLeft(slot: number): number;
  /** Pays HP (Vesper's spells): never below 1. The server counts it online. */
  payHp(amount: number): void;
  /** A shield on this hero. */
  shield(amount: number, seconds: number): void;
  /** Summoned units that died so far this round (both sides; slain by damage, not expired). */
  unitDeaths(): number;
  /** Distance to the enemy hero (Infinity when there is none). */
  enemyDistance(): number;
  /** Where this hero's own summoned units stand now (the live ones). */
  units(): THREE.Vector3[];
  /** This hero cannot walk or attack for `seconds` (casting is gated by the trait's own `canCast`). */
  hold(seconds: number): void;
}

export interface Trait {
  passive: { name: string; blurb: string };
  twist?: { name: string; blurb: string };
  /** An own resource: a bar under HP (shown for both heroes). */
  resource?: { name: string; max: number; color: string; start?: number };
  /** Walk speed in m/s (default 4). */
  speed?: number;
  /** The basic attack's changes to the melee / ranged default. */
  attack?: Partial<AttackSpec>;
  /** Hold: aiming slot `slot` longer charges it, full after `seconds`; `castPower` gets the charge 0..1. */
  hold?: { slot: number; seconds: number };
  /** Ammo: slot `slot` has `count` charges, one back every `every` seconds (its cooldown is only a short gap). */
  charges?: { slot: number; count: number; every: number };
  /**
   * Recast: for `window` seconds after casting `slot`, it can be cast once more, free (no cooldown), at `power` x the
   * damage (default 0.6). `recastAct` runs at that second cast.
   */
  recast?: { slot: number; window: number; name: string; power?: number };
  /** Shields this hero makes are this much stronger (Auriel). */
  shieldMul?: number;

  /** Why slot `slot` can't be cast now (shown to the player), or null. */
  canCast?(t: TraitView, slot: number): string | null;
  /** The cast's mods (called once per cast; may spend the resource). `charge` 0..1 for a hold slot, else 1. */
  castMods?(t: TraitView, slot: number, charge: number): Partial<CastMods>;
  /** After a cast went out. */
  afterCast?(t: TraitView, slot: number): void;
  /** The cooldown slot `slot` gets after a cast (default `base`). */
  cooldown?(t: TraitView, slot: number, base: number): number;
  recastAct?(t: TraitView, slot: number): void;
  /** A basic attack is released: its mods (count hits, empower every third). */
  attackMods?(t: TraitView): Partial<CastMods>;
  /** Dealer side: change a hit of this hero's (damage, status). */
  dealt?(t: TraitView, hit: TraitHit): void;
  /** Victim side: change a hit this hero takes. */
  taken?(t: TraitView, hit: TraitHit): void;
  /** A hit of this hero's landed (gain resources, heal from damage). */
  landed?(t: TraitView, hit: LandedHit): void;
  tick?(t: TraitView, dt: number): void;
  /** A short counter for the passive slot ("3", "80%"), or ''. */
  badge?(t: TraitView): string;
}

/** The position the duel needs for backstab-like rules: is `a` behind `b` (outside b's front `cone` radians)? */
export function isBehind(a: THREE.Vector3, b: THREE.Vector3, bYaw: number, cone = (Math.PI * 2) / 3): boolean {
  const dx = a.x - b.x, dz = a.z - b.z;
  const ang = Math.atan2(dx, dz) - bYaw;
  const d = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
  return d > cone / 2;
}
