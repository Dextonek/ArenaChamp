import type * as THREE from 'three';
import type { DeathSpot, Summon, SummonOptions } from '../effects/summon';
import type { Enemy } from '../effects/common';
import type { HitOptions } from '../effects/targeting';
import type { BuffKind, StatusSet } from '../effects/status';
import { NO_MODS, type CastMods, type HoldSpec, type LandedHit, type RecastSpec, type Side, type Trait, type TraitHit, type TraitView } from './types';

/** How far back `past` can look (s); the history keeps a little more. */
export const HISTORY_SECONDS = 3;

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
  /** Slides this side's hero to `p` over `seconds` (a dash); the opponent's side does nothing in a network duel. */
  moveTo(p: THREE.Vector3, seconds: number): void;
  /** The basic attack is ready at once (a network duel: only this player's own side does anything). */
  resetAttack(): void;
  /** Summons units for this side (`opts.at` is set); null when none can be made or this side cannot (network duel's other player). */
  summon(opts: SummonOptions): Summon | null;
  /** Where units were slain within `maxAge` s (both sides). */
  deathSpots(maxAge: number): DeathSpot[];
  /** A passive fired (`big`: stacks popped on the enemy) at `at`; `stack` names the stacks that popped. */
  burst?(at: THREE.Vector3, big: boolean, stack?: string): void;
  /** Stacks changed on the enemy hero (a network duel shows them on the other screen). */
  stacksChanged?(name: string, n: number): void;
  /** This hero's own shown state changed (a network duel sends it to the other screen). */
  stateChanged?(name: string, n: number): void;
  /** Ends this side's shield now. */
  clearShield(): void;
  /** Frees this side's hero from a hold. */
  release(): void;
  /** A note for this hero's own client (see `TraitView.noteOwner`). */
  note(name: string, n: number): void;
  /** A hit on the enemy hero from this side's passive (see `TraitView.hitEnemy`). */
  hitEnemy(opts: HitOptions): void;
  /** Moves the enemy hero by this step now, where this screen decides it (a passive's drag). */
  carryEnemy?(dx: number, dz: number): void;
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
  /** Seconds left on an open recast, per slot (0 = none). */
  private recastClock = [0, 0, 0, 0];
  /** This hero's position and HP over the last few seconds (`past`), oldest first. */
  private history: { t: number; x: number; z: number; hp: number }[] = [];
  private stackMap = new Map<string, { n: number; left: number }>();
  /** This hero's own shown state (`show`): pips over it, on both screens. */
  private ownMap = new Map<string, number>();
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
    this.ownMap.clear();
    this.ammo = this.trait?.charges?.count ?? 0;
    this.ammoT = 0;
    this.recastClock.fill(0);
    this.history.length = 0;
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

  show(name: string, n: number) {
    if ((this.ownMap.get(name) ?? 0) === n) return;
    if (n === 0) this.ownMap.delete(name);
    else this.ownMap.set(name, n);
    this.host.stateChanged?.(name, n);
  }

  own(name: string) {
    return this.ownMap.get(name) ?? 0;
  }

  /** A shown value that came from the other screen. */
  setOwn(name: string, n: number) {
    if (n === 0) this.ownMap.delete(name);
    else this.ownMap.set(name, n);
    this.trait?.ownChanged?.(this, name, n);
  }

  /** The shown state that has a look, for the pips. A name with no look only travels to the other screen. */
  allOwn() {
    const look = this.trait?.ownLook;
    if (!look) return [];
    return [...this.ownMap.entries()].filter(([k, n]) => n > 0 && look[k]).map(([name, n]) => ({ name, n, look: look[name] }));
  }

  /** This hero's ring and ground marks now (asked by the duel every frame, on both screens). */
  ringNow() {
    return this.trait?.ring?.(this) ?? null;
  }

  marksNow() {
    return this.trait?.marks?.(this) ?? [];
  }

  clearShield() {
    this.host.clearShield();
  }

  release() {
    this.host.release();
  }

  noteOwner(name: string, n: number) {
    this.host.note(name, n);
  }

  hitEnemy(opts: HitOptions) {
    this.host.hitEnemy(opts);
  }

  carryEnemy(dx: number, dz: number) {
    this.host.carryEnemy?.(dx, dz);
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

  moveTo(p: THREE.Vector3, seconds: number) {
    this.host.moveTo(p, Math.max(0, seconds));
  }

  resetAttack() {
    this.host.resetAttack();
  }

  summon(opts: Omit<SummonOptions, 'at'> & { at?: THREE.Vector3 }) {
    return this.host.summon({ ...opts, at: (opts.at ?? this.self().group.position).clone() });
  }

  deathSpots(maxAge: number) {
    return this.host.deathSpots(maxAge);
  }

  past(secondsAgo: number) {
    const h = this.history;
    if (!h.length) return null;
    const want = this.time - Math.max(0, Math.min(HISTORY_SECONDS, secondsAgo));
    if (want <= h[0].t) return { x: h[0].x, z: h[0].z, hp: h[0].hp };
    let i = 0;
    while (i < h.length - 1 && h[i + 1].t <= want) i++;
    const a = h[i], b = h[Math.min(i + 1, h.length - 1)];
    const k = b.t > a.t ? Math.max(0, Math.min(1, (want - a.t) / (b.t - a.t))) : 0;
    // Position glides between the two samples; HP is the value the earlier one had.
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, hp: a.hp };
  }

  /** The hold rule of `slot` (charges while aimed), if the trait has one. */
  holdOf(slot: number): HoldSpec | undefined {
    const h = this.trait?.hold;
    return Array.isArray(h) ? h.find((x) => x.slot === slot) : h && h.slot === slot ? h : undefined;
  }

  /** The recast rule of `slot`, if the trait has one. */
  recastOf(slot: number): RecastSpec | undefined {
    const r = this.trait?.recast;
    return Array.isArray(r) ? r.find((x) => x.slot === slot) : r && r.slot === slot ? r : undefined;
  }

  /** Seconds left on the open recast of `slot` (0 = none). */
  recastLeft(slot: number) {
    return this.recastClock[slot] ?? 0;
  }

  /** Charge 0..1 after aiming `slot` for `aimed` seconds (1 for a slot without a hold rule). */
  charge(slot: number, aimed: number) {
    const h = this.holdOf(slot);
    return h ? Math.max(0, Math.min(1, aimed / h.seconds)) : 1;
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
    this.history.push({ t: this.time, x: p.x, z: p.z, hp: this.hp() });
    while (this.history.length > 2 && this.history[1].t < this.time - HISTORY_SECONDS - 0.5) this.history.shift();
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
    for (let i = 0; i < 4; i++) this.recastClock[i] = Math.max(0, this.recastClock[i] - dt);
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
    const rc = this.recastOf(slot), left = this.recastLeft(slot);
    return !!rc && left > 0 && rc.window - left >= (rc.arm ?? 0);
  }

  /**
   * A cast goes out: its mods (power from the trait and the caster's might / weaken, the kit's own debuff), then the
   * ammo and recast bookkeeping. Returns the mods and the cooldown to set (-1: a recast, keep the cooldown running).
   */
  cast(slot: number, base: number, charge: number, dealtMul: number, debuff?: CastMods['debuff']): { mods: CastMods; cooldown: number; replay: boolean } {
    const t = this.trait;
    if (this.canRecast(slot)) {
      // The free second cast: the first cast's cooldown keeps running. `replay: false` plays no effect (only `recastAct`).
      const rc = this.recastOf(slot)!;
      this.recastClock[slot] = 0;
      t?.recastAct?.(this, slot);
      return { mods: { ...NO_MODS, power: (rc.power ?? 0.6) * dealtMul, debuff }, cooldown: -1, replay: rc.replay !== false };
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
    const rc = this.recastOf(slot);
    if (rc) this.recastClock[slot] = rc.window;
    // Runs here, in the cast's rules: before the effect's play() builds its context (see docs/architecture/traits.md).
    t?.afterCast?.(this, slot);
    return { mods, cooldown, replay: true };
  }

  /** Metres of extra basic-attack reach the trait gives now (0 = none). */
  attackReach(): number {
    return Math.max(0, this.trait?.attackReach?.(this) ?? 0);
  }

  /** The echo share (0..1) of the next basic attack (0 = none). */
  attackEcho(): number {
    return Math.max(0, Math.min(1, this.trait?.attackEcho?.(this) ?? 0));
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
