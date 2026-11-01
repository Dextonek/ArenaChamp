import type * as THREE from 'three';
import type { Enemy } from '../effects/common';
import type { BuffKind, StatusSet } from '../effects/status';
import { NO_MODS, type CastMods, type LandedHit, type Side, type Trait, type TraitHit, type TraitView } from './types';

/** What a runtime needs from the duel for its side. */
export interface TraitHost {
  self(): Enemy;
  enemy(): Enemy | null;
  status(of: Enemy): StatusSet | undefined;
  hp(): number;
  maxHp(): number;
  time(): number;
  say(text: string, color: string, at: THREE.Vector3): void;
  heal(amount: number): void;
  buff(kind: BuffKind, amount: number, seconds: number): void;
  setCooldown(slot: number, seconds: number): void;
  cooldownLeft(slot: number): number;
  payHp(amount: number): void;
  shield(amount: number, seconds: number): void;
  unitDeaths(): number;
  /** Positions of this side's live summoned units. */
  units(): THREE.Vector3[];
  /** Stops this side's hero walking and attacking for `seconds`. */
  hold(seconds: number): void;
  /** A passive fired (`big`: stacks popped on the enemy) at `at`; `stack` names the stacks that popped. */
  burst?(at: THREE.Vector3, big: boolean, stack?: string): void;
  /** Stacks changed on the enemy hero (a network duel shows them on the other screen). */
  stacksChanged?(name: string, n: number): void;
}

/**
 * One side's trait state in a duel: the resource, stacks on the enemy, ammo charges, an open recast, the hold charge,
 * and the free `mem` counters. Implements `TraitView` for the trait's hooks.
 */
export class TraitRuntime implements TraitView {
  res = 0;
  still = 0;
  mem: Record<string, number> = {};
  /** Ammo charges left on the charges slot, and the refill clock. */
  ammo = 0;
  private ammoT = 0;
  /** Seconds left on an open recast (0 = none). */
  recastLeft = 0;
  private stackMap = new Map<string, { n: number; left: number }>();
  private lastPos: THREE.Vector3 | null = null;

  constructor(readonly side: Side, readonly trait: Trait | null, private host: TraitHost) {
    this.reset();
  }

  get time() {
    return this.host.time();
  }

  /** A new round: resource to its start, no stacks, full ammo, no recast. */
  reset() {
    this.res = this.trait?.resource?.start ?? 0;
    this.mem = {};
    this.stackMap.clear();
    this.ammo = this.trait?.charges?.count ?? 0;
    this.ammoT = 0;
    this.recastLeft = 0;
    this.still = 0;
    this.lastPos = null;
  }

  self() { return this.host.self(); }
  enemy() { return this.host.enemy(); }
  status(of: Enemy) { return this.host.status(of); }
  hp() { return this.host.hp(); }
  maxHp() { return this.host.maxHp(); }

  addRes(n: number) {
    const max = this.trait?.resource?.max ?? 0;
    this.res = Math.max(0, Math.min(max, this.res + n));
  }

  say(text: string, color = this.trait?.resource?.color ?? '#ffe7b0') {
    this.host.say(text, color, this.self().group.position);
    // A trait's word is a passive firing: a small burst at the hero.
    this.host.burst?.(this.self().group.position, false);
  }

  heal(amount: number) {
    if (amount > 0) this.host.heal(amount);
  }

  buff(kind: BuffKind, amount: number, seconds: number) {
    this.host.buff(kind, amount, seconds);
  }

  setCooldown(slot: number, seconds: number) {
    this.host.setCooldown(slot, seconds);
  }

  cooldownLeft(slot: number) {
    return this.host.cooldownLeft(slot);
  }

  payHp(amount: number) {
    if (amount > 0) this.host.payHp(amount);
  }

  shield(amount: number, seconds: number) {
    if (amount > 0) this.host.shield(amount, seconds);
  }

  unitDeaths() {
    return this.host.unitDeaths();
  }

  units() {
    return this.host.units();
  }

  hold(seconds: number) {
    if (seconds > 0) this.host.hold(seconds);
  }

  enemyDistance() {
    const e = this.enemy(), p = this.self().group.position;
    return e ? Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z) : Infinity;
  }

  stacks(name: string) {
    const s = this.stackMap.get(name);
    return s && s.left > 0 ? s.n : 0;
  }

  addStacks(name: string, n: number, seconds: number, max: number) {
    const now = this.stacks(name);
    const next = Math.max(0, Math.min(max, now + n));
    this.stackMap.set(name, { n: next, left: seconds });
    if (next !== now) this.host.stacksChanged?.(name, next);
    return next;
  }

  clearStacks(name: string) {
    if (this.stacks(name) > 0) {
      this.host.stacksChanged?.(name, 0);
      const e = this.enemy();
      if (e) this.host.burst?.(e.group.position, true, name);
    }
    this.stackMap.delete(name);
  }

  /** Stacks set from outside (a network duel: the other screen says how many it has). */
  setStacks(name: string, n: number, seconds = 4) {
    if (n <= 0) this.stackMap.delete(name);
    else this.stackMap.set(name, { n, left: seconds });
  }

  /** All running stacks, for the bars. */
  allStacks() {
    return [...this.stackMap.entries()].filter(([, s]) => s.left > 0 && s.n > 0).map(([name, s]) => ({ name, n: s.n }));
  }

  // --- the duel calls these ---------------------------------------------------------------------------------

  /** Every frame (both sides offline; only this player's own side online, plus `tickClocks` for the other). */
  tick(dt: number) {
    this.tickClocks(dt);
    const p = this.self().group.position;
    if (this.lastPos && Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) > dt * 0.5) this.still = 0;
    else this.still += dt;
    this.lastPos = p.clone();
    const ch = this.trait?.charges;
    if (ch && this.ammo < ch.count) {
      this.ammoT += dt;
      if (this.ammoT >= ch.every) { this.ammoT = 0; this.ammo++; }
    }
    this.trait?.tick?.(this, dt);
  }

  /** Timers only (stack expiry, the recast window): the other player's side in a network duel. */
  tickClocks(dt: number) {
    for (const [k, s] of this.stackMap) {
      s.left -= dt;
      if (s.left <= 0) { this.stackMap.delete(k); this.host.stacksChanged?.(k, 0); }
    }
    this.recastLeft = Math.max(0, this.recastLeft - dt);
  }

  /** Seconds until the next ammo charge (0 when full or no ammo slot). */
  get ammoWait() {
    const ch = this.trait?.charges;
    return ch && this.ammo < ch.count ? ch.every - this.ammoT : 0;
  }

  /** Why `slot` can't be cast (null = it can). Ammo and the trait's own gate. */
  blocked(slot: number): string | null {
    const ch = this.trait?.charges;
    if (ch && ch.slot === slot && this.ammo <= 0) return 'No charges';
    return this.trait?.canCast?.(this, slot) ?? null;
  }

  /** True when `slot` can be cast once more now (its recast window is open): no cooldown check. */
  canRecast(slot: number) {
    return this.recastLeft > 0 && this.trait?.recast?.slot === slot;
  }

  /**
   * A cast goes out: its mods (power from the trait and the caster's might / weaken, the kit's own debuff), then the
   * ammo and recast bookkeeping. Returns the mods and the cooldown to set (-1: a recast, keep the cooldown running).
   */
  cast(slot: number, base: number, charge: number, dealtMul: number, debuff?: CastMods['debuff']): { mods: CastMods; cooldown: number } {
    const t = this.trait;
    if (this.canRecast(slot)) {
      // The free second cast: the first cast's cooldown keeps running.
      this.recastLeft = 0;
      t?.recastAct?.(this, slot);
      return { mods: { ...NO_MODS, power: (t?.recast?.power ?? 0.6) * dealtMul, debuff }, cooldown: -1 };
    }
    const m = t?.castMods?.(this, slot, charge) ?? {};
    const mods: CastMods = { ...NO_MODS, ...m, power: (m.power ?? 1) * dealtMul };
    if (!mods.debuff && debuff) mods.debuff = debuff;
    let cooldown = t?.cooldown?.(this, slot, base) ?? base;
    const ch = t?.charges;
    if (ch && ch.slot === slot) {
      if (this.ammo === ch.count) this.ammoT = 0;
      this.ammo = Math.max(0, this.ammo - 1);
      cooldown = Math.min(cooldown, 0.4);
    }
    if (t?.recast && t.recast.slot === slot) this.recastLeft = t.recast.window;
    t?.afterCast?.(this, slot);
    return { mods, cooldown };
  }

  /** A basic attack is released: its mods. */
  attack(dealtMul: number): CastMods {
    const m = this.trait?.attackMods?.(this) ?? {};
    return { ...NO_MODS, ...m, power: (m.power ?? 1) * dealtMul };
  }

  dealt(hit: TraitHit) { this.trait?.dealt?.(this, hit); }
  taken(hit: TraitHit) { this.trait?.taken?.(this, hit); }
  landed(hit: LandedHit) { this.trait?.landed?.(this, hit); }

  badge() {
    return this.trait?.badge?.(this) ?? '';
  }
}
