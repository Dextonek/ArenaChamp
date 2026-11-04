import type * as THREE from 'three';
import type { Enemy } from '../effects/common';
import type { HitOptions } from '../effects/targeting';
import type { BuffKind, StatusKind, StatusSet } from '../effects/status';
import type { AttackSpec } from '../attacks';
import type { DeathSpot, Summon, SummonOptions } from '../effects/summon';

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

/**
 * A hit being resolved: hooks may change `damage` and `opts` (a copy). `trait`: a hit from a passive or something a spell
 * left behind (`TraitView.hitEnemy`). A `dealt` hook that itself calls `hitEnemy` must ignore this kind.
 */
export interface TraitHit {
  kind: 'spell' | 'attack' | 'unit' | 'trait';
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
  kind: 'spell' | 'attack' | 'unit' | 'trait';
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
  /**
   * Shows this hero's own count, stance or armed attack to both players: `n` pips over the hero (looks in
   * `Trait.ownLook`), 0 hides it. Cheap to call every frame (only a change is sent). Online it reaches the other screen,
   * where `own` reads the same value and `Trait.ownChanged` runs. Cleared every round.
   */
  show(name: string, n: number): void;
  /** The value last shown under `name`, on either screen (0 when none). */
  own(name: string): number;
  /** Ammo charges left on the charges slot (0 without one). Only meaningful on this hero's own client. */
  readonly ammo: number;
  /** Ends this hero's shield now (and on the other screen). */
  clearShield(): void;
  /** The HP left in this hero's shield (0 when none). A trait watches it in `tick` to learn how a shield ended. */
  shieldAmount(): number;
  /**
   * Sets how fast each of this hero's live summoned units attacks: `rate(position)` is a multiplier (1 = its own speed,
   * 2 = twice as fast). Call it every frame from `tick`. Ada's Overclock and Siege Mode.
   */
  unitRate(rate: (pos: THREE.Vector3) => number): void;
  /** Frees this hero from a `hold` early (a broken channel). */
  release(): void;
  /**
   * Tells this hero's own client something only the screen that resolved a hit knows (`Trait.peerNote` runs there). A
   * refund decided in `dealt` goes this way: online `dealt` runs on the victim's screen, where `setCooldown` does nothing
   * for the real hero. Offline it runs at once.
   */
  noteOwner(name: string, n: number): void;
  /**
   * A hit on the enemy hero from a passive or from something a spell left behind (arcs, crossings, a curse's price), at any
   * time. Only where the hit is really decided does anything happen: offline always, online on the victim's screen (the
   * other hero's trait there). So call it from `dealt` or `victimTick`, which run on that screen. `dealt` and `taken`
   * hooks see it with kind 'trait'.
   */
  hitEnemy(opts: HitOptions): void;
  /** Moves the enemy hero by this step now, out of cover and inside the ring (a passive's drag). Call it from `victimTick`. */
  carryEnemy(dx: number, dz: number): void;
  /**
   * Brings in the other half of a two-kit hero (`HeroKit.alt`; false: the first half), here only. Call it on the own client and
   * `show` the change, and call it again from `ownChanged` on the other screen.
   */
  swapKit(alt: boolean): void;
  /** Moves this hero now, kept inside the ring. Run it on this hero's own client (`tick`): online, the other screen follows its moves. */
  carrySelf(dx: number, dz: number): void;
  say(text: string, color?: string): void;
  heal(amount: number): void;
  /** Heals the enemy hero, up to their maximum. Run it where the enemy's position is decided (`victimTick`): Cleaver's stolen dishes. */
  healEnemy(amount: number): void;
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
  /**
   * Where this hero stood `secondsAgo` ago (at most about 3 s back) and the HP it had then; null before the first
   * sample of the round. A round younger than `secondsAgo` gives the oldest sample. Only this player's own hero is
   * sampled: in a network duel the other side's view returns null.
   */
  past(secondsAgo: number): { x: number; z: number; hp: number } | null;
  /**
   * Slides this side's hero to `p` over `seconds` (0: at once), the way a dash does, clamped into the ring and out of
   * the obstacles. Nothing else moves it meanwhile. Online the other player's hero moves on its own client, so the
   * opponent side's call does nothing there.
   */
  moveTo(p: THREE.Vector3, seconds: number): void;
  /**
   * The hero's basic attack is ready at once: its interval restarts now (a wind-up already running goes on). Zephyr: a
   * dash resets the attack. Online the other player's side does nothing (its own client keeps its attack).
   */
  resetAttack(): void;
  /**
   * Summons units for this side, from a trait (Mortis: every fifth basic attack raises a skeleton). The same options as
   * `CastContext.summon` (`SummonOptions`, see src/effects/summon.ts), but `at` is optional and defaults to this hero's
   * feet. At most 6 units per side. Returns the handle (`units`, `alive`, `onDeath`), or null when no unit can be made.
   * The hero's units hit like a spell's units without a cast: their hits count as 'unit' hits (power 1, `dealt` /
   * `taken` hooks run). Online only this player's own side summons (the units live on this screen); the other
   * player's side does nothing, its own client raises its units (and they are not shown on this screen). The units' hits on the
   * other hero are dropped online (only the victim's client decides them): there they only hit the pack.
   */
  summon(opts: Omit<SummonOptions, 'at'> & { at?: THREE.Vector3 }): Summon | null;
  /**
   * Where summoned units (of either side; `side` says whose: `d.side === t.side` for this hero's own) were slain by
   * damage within the last `maxAge` seconds (at most 30), oldest first: `{ x, z, age, side }`, `age` in seconds since
   * the death. A unit that ran out of time leaves nothing. Cleared every round. Same shape as
   * `CastContext.deathSpots`. (`unitDeaths()` is still the plain count.) Online: only units this screen simulates.
   */
  deathSpots(maxAge: number): DeathSpot[];
}

/** A slot that charges while it is aimed (see `Trait.hold`). */
export interface HoldSpec { slot: number; seconds: number }

/**
 * A slot that can be cast once more after the first cast (see `Trait.recast`). `arm`: seconds after the first cast
 * before the second one opens, so the first cast's answer stays true. `aiWait`: the duel AI does not fire it (it lets the
 * spell run its course).
 */
export interface RecastSpec { slot: number; window: number; name: string; power?: number; replay?: boolean; arm?: number; aiWait?: boolean }

/** How an own-state pip looks (`Trait.ownLook`), the same tokens as stacks. */
export interface PipLook { color: string; shape?: 'drop' | 'flake' | 'sprout' | 'mark' | 'gem' | 'balloon' }

/** A ring at a hero's feet, drawn on both screens (`Trait.ring`). `fill` 0..1 draws an inner arc (time left). */
export interface HeroRing { radius: number; color: string; fill?: number; opacity?: number }

/**
 * Something a passive keeps on the ground, drawn on both screens for its whole life (`Trait.marks`): Mortis's piles, Kaia's
 * rods, Fenna's flowers, Shiori's strokes. `kind` picks the look: 'bones', or a builder in `Trait.markLook`. `yaw` and
 * `length` turn and stretch it along its own z axis (a stroke of ink). It pops in, and shrinks away in the last second.
 */
export interface GroundMark { x: number; z: number; kind: string; age: number; life: number; yaw?: number; length?: number }

export interface Trait {
  passive: { name: string; blurb: string };
  twist?: { name: string; blurb: string };
  /** The CPU playing this hero holds `slot` back for now (`dist`: metres to the enemy hero). Vesper: R only within 4 m. */
  aiHold?(t: TraitView, slot: number, dist: number): boolean;
  /**
   * Where the CPU playing against this hero should walk now, or null: touch a rod, trample a flower, walk away from a core.
   * `t` is this hero's view, so its enemy is the CPU in question.
   */
  enemyGoal?(t: TraitView): { x: number; z: number } | null;
  /**
   * Where the CPU playing this hero should walk now, or null for its usual steering: catch a mirror, stay by a pillar, get behind
   * the enemy. It beats `enemyGoal`.
   */
  aiGoal?(t: TraitView): { x: number; z: number } | null;
  /**
   * This hero's rule that acts on the enemy hero, run every frame on the screen where that enemy's position and hits are
   * decided: offline always, online on the victim's screen (`t` is this trait's view there). Oblivion's pull, Fenna's
   * flowers, Kaia's rods, Shiori's ink. Read shared state from a WeakMap the spells write, because spells play on both screens.
   */
  victimTick?(t: TraitView, dt: number): void;
  /** The enemy hero cast `slot` (a spell or its recast), on both screens: `t` decides what it may do there (Vesper's curse). */
  enemyCast?(t: TraitView, slot: number): void;
  /** The look of each `TraitView.show` name. A name with no look draws nothing and only travels to the other screen. */
  ownLook?: Record<string, PipLook>;
  /** A `show` value changed on the other screen of a network duel (`t` is this trait's view there). */
  ownChanged?(t: TraitView, name: string, n: number): void;
  /** See `TraitView.noteOwner`: runs on this hero's own client. */
  peerNote?(t: TraitView, name: string, n: number): void;
  /**
   * A ring at this hero's feet, asked every frame on both screens, so it may only read what both have (`time`, `own`,
   * `mem` written by `ownChanged`). Null: no ring.
   */
  ring?(t: TraitView): HeroRing | null;
  /** What this hero's passive keeps on the ground, asked every frame on both screens (Mortis's bone piles). */
  marks?(t: TraitView): GroundMark[];
  /**
   * How veiled this hero's figure looks now, 0..1, asked every frame on both screens: dark and see-through, never hidden
   * (Nyx). May only read what both screens have.
   */
  figureVeil?(t: TraitView): number;
  /**
   * True while this hero's figure is not drawn at all (Mabel underground, Zambini under a hat), asked every frame on both screens.
   * The rest of the rule is the kit's: show where they are some other way, and make them safe with the `sealed` status if they are.
   */
  figureHidden?(t: TraitView): boolean;
  /**
   * How big the enemy hero is drawn and judged now (1: as usual; the duel eases to it), asked every frame on both screens, so it
   * may only read what both have, such as `stacks`. Professor Puff's Air: a swollen hero is also easier to hit.
   */
  enemyScale?(t: TraitView): number;
  /**
   * A word or number over the enemy hero's head, asked every frame on both screens, so it may only read what both have.
   * Mr. Ledger's tab, Whistler's rule. Null: nothing.
   */
  enemyLabel?(t: TraitView): { text: string; color?: string } | null;
  /** Stacks that draw no pips, because they are a count for `enemyLabel` or a rule (a tab is in the hundreds). */
  hiddenStacks?: string[];
  /** A builder per mark kind (called once per pooled copy): the object's feet at y 0, its length along z at 1 m. */
  markLook?: Record<string, () => THREE.Object3D>;
  /** An own resource: a bar under HP (shown for both heroes). */
  resource?: { name: string; max: number; color: string; start?: number };
  /** Walk speed in m/s (default 4). */
  speed?: number;
  /** The basic attack's changes to the melee / ranged default. */
  attack?: Partial<AttackSpec>;
  /**
   * Hold: aiming slot `slot` longer charges it, full after `seconds`; `castMods` gets the charge 0..1. One slot
   * or several (each slot charges on its own).
   */
  hold?: HoldSpec | HoldSpec[];
  /** Ammo: slot `slot` has `count` charges, one back every `every` seconds (its cooldown is only a short gap). */
  charges?: { slot: number; count: number; every: number };
  /**
   * Recast: for `window` seconds after casting `slot`, it can be cast once more, free (no cooldown), at `power` x the
   * damage (default 0.6). `recastAct` runs at that second cast. One slot or several. With `replay: false` the second
   * cast plays no effect and is not aimed: only `recastAct` runs (a blink to the orb, a pop of the mark). Online it
   * sends no cast message: whatever it does must move this hero (`moveTo`) or change its own state.
   */
  recast?: RecastSpec | RecastSpec[];
  /** Shields this hero makes are this much stronger (Auriel). */
  shieldMul?: number;

  /** Why slot `slot` can't be cast now (shown to the player), or null. */
  canCast?(t: TraitView, slot: number): string | null;
  /** The cast's mods (called once per cast; may spend the resource). `charge` 0..1 for a hold slot, else 1. */
  castMods?(t: TraitView, slot: number, charge: number): Partial<CastMods>;
  /** After the cast's rules ran: before the effect plays (the hero has not moved yet; a `moveTo` here starts a dash the effect sees as it begins). */
  afterCast?(t: TraitView, slot: number): void;
  /** The cooldown slot `slot` gets after a cast (default `base`). */
  cooldown?(t: TraitView, slot: number, base: number): number;
  recastAct?(t: TraitView, slot: number): void;
  /** A basic attack is released: its mods (count hits, empower every third). */
  attackMods?(t: TraitView): Partial<CastMods>;
  /**
   * Metres added to this hero's basic-attack reach while it returns more than 0 (Zephyr: +1 m after a Gust). Asked
   * every frame: for the in-range check (walk-up, attack-move, the AI's and the autopilot's approach) and for the
   * attack itself (a wind-up survives the target walking out to the longer reach). Keep it cheap and side-effect free.
   * Not relayed online: the other player's client applies its own, and the server does not check reach.
   */
  attackReach?(t: TraitView): number;
  /**
   * An echo for the next basic attack: a share 0..1 (0 = none). While it returns more than 0 a released basic attack is
   * followed about 0.12 s later by a second hit (a second bolt for a ranged attack, a second strike for a melee one)
   * for that share of the damage (the first hit's mods, with `power` x the share). `attackMods` runs once, for the
   * first hit only. Asked once per released attack, so it may read `mem`. Lyra's Twin Stars returns 0.5.
   * Online: a second message would be dropped by the server's attack gap, so against the other hero the echo is folded
   * into the one hit (power x (1 + share), the server caps power at 3) with no second bolt drawn; offline and against
   * units it plays as two hits.
   */
  attackEcho?(t: TraitView): number;
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
