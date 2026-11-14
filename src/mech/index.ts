import * as THREE from 'three';
import type { Enemy } from '../effects/common';
import type { StatusSet } from '../effects/status';
import type { Projectile } from '../effects/projectile';
import type { BoltWall } from '../effects/projectile';
import type { TelegraphShape } from '../effects/telegraph';
import type { HeroKit, HeroSpell } from '../heroes';
import type { Obstacle } from '../obstacles';
import { crosses, crossesCircle, faces, type P } from './geom';
import { decDigit, decPos, decTime, encDigit, encPos, encTime, msgN, msgName, PREFIX } from './net';

export * from './geom';
export { PREFIX as MECH_PREFIX } from './net';

/**
 * The engine pieces of the twenty new heroes (pipeline/designs/heroes20-engine.md), one `Mech` per duel, cleared every round.
 * Each piece is general: a hero's trait reaches it through `t.mech` (a `MechView` bound to its side), a spell through
 * `mechFor(ctx.caster)`. Every piece says on which screen it acts. In a network duel this screen decides only its own hero
 * (`MechHost.owns`): a call about the other hero does nothing here, because the other screen makes it.
 *
 * Nothing here runs when no hero uses it: every list is empty, and the duel's hooks return before any sum.
 */

export type MechSide = 'hero' | 'opponent';
const other = (s: MechSide): MechSide => (s === 'hero' ? 'opponent' : 'hero');

/** What the mechanics need from the duel. */
export interface MechHost {
  /** The fight clock (s), the same on both screens within a frame or two. */
  time(): number;
  figure(side: MechSide): Enemy | null;
  /** This screen decides that side's hero (its walk, statuses and the hits on it). Offline both; online only 'hero'. */
  owns(side: MechSide): boolean;
  online(): boolean;
  /** For a tie between the two screens: this screen's seat in the match (0 or 1); 0 offline. */
  seat(): number;
  /** Sends an engine message to the other screen (online only). */
  send(name: string, n: number): void;
  status(side: MechSide): StatusSet | undefined;
  say(text: string, color: string, at: THREE.Vector3, scale?: number): void;
  kit(side: MechSide): HeroKit | null;
  /** Slides a hero this screen moves to `p` over `seconds`, as a dash does. */
  dash(side: MechSide, p: THREE.Vector3, seconds: number): void;
  /** Takes the arena's own cover `i` away for the round, falling away from `dir` (x, z). */
  breakCover(i: number, dx: number, dz: number): void;
  /** The arena's own cover this round (indexed as the arena defines it) and whether piece `i` still stands. */
  arenaCover(): readonly Obstacle[];
  stands(i: number): boolean;
  /** Raises a bolt wall owned by `side` (it stops the other side's bolts). */
  boltWall(side: MechSide, a: P, b: P, halfWidth: number, seconds: number): BoltWall;
  /** The bolts in flight, and whose each is. */
  bolts(): readonly Projectile[];
  boltSide(p: Projectile): MechSide;
}

// --- the pieces' records ------------------------------------------------------------------------------------------

interface Sleep { until: number; bonus: number; cap: number }

/** A line or a circle that no spell crosses (Morwen's salt). */
export interface Ward {
  readonly kind: 'line' | 'circle';
  readonly a: P;
  readonly b: P;
  readonly r: number;
  readonly until: number;
  alive: boolean;
  end(): void;
}

/** A leash: the leashed hero cannot go farther than `r` from its anchor (Kessa's chain, her post). */
export interface Leash {
  readonly side: MechSide;
  r: number;
  until: number;
  alive: boolean;
  /** Where its anchor stands now. */
  anchor(): P;
  end(): void;
}

interface LeashRec extends Leash {
  at: () => P;
  breakOnDash: boolean;
  slow: number;
  onBreak?: (why: 'dash' | 'time' | 'end') => void;
}

/** Ground that stops one side's walking only (Itzel's cracks): no wall to sight, bolts, dashes or its maker. */
export interface Barrier {
  readonly o: Obstacle;
  readonly stops: MechSide;
  until: number;
  alive: boolean;
  end(): void;
}

/** Bolts of the other side within `r` of it turn into it and end there (Vela's lantern). */
export interface Attractor {
  x: number;
  z: number;
  r: number;
  readonly owner: MechSide;
  until: number;
  alive: boolean;
  end(): void;
}

interface AttractorRec extends Attractor { onCatch?: (bolt: Projectile) => void }

/** Who holds a token and where it lies (Asenet's circlet, Orren's ember). */
export interface TokenState { holder: MechSide | null; x: number; z: number; version: number; since: number; start: number }

/** A token one hero holds at a time: passed by a hit, picked up from the ground, set down. See `Mech.token`. */
export class Token {
  state: TokenState;
  /** Runs after every change, here or from the other screen (`remote`). */
  onChange: ((t: Token, remote: boolean) => void) | null = null;

  constructor(readonly key: string, private m: Mech, holder: MechSide | null, at: P) {
    this.state = { holder, x: at.x, z: at.z, version: 0, since: m.host.time(), start: 0 };
  }

  get holder() { return this.state.holder; }

  /**
   * A change of holder (`null`: it lies at `at`). Call it on the screen whose word counts: the victim's screen for a pass by a
   * hit (the new holder is its own hero), each hero's own client for picking it up or setting it down. `start` is when the
   * claim began on the fight clock (a cast's start, the first moment of standing on it): if both screens claim at once, the
   * earlier start wins on both (a tie: seat 0).
   */
  claim(holder: MechSide | null, at?: P, start = this.m.host.time()) {
    const s = this.state;
    const p = at ?? s;
    this.state = { holder, x: p.x, z: p.z, version: s.version + 1, since: this.m.host.time(), start };
    this.m.sendToken(this);
    this.onChange?.(this, false);
  }

  /** @internal a claim from the other screen. */
  receive(st: TokenState) {
    const s = this.state;
    const newer = ((st.version - s.version + 1000) % 1000);
    if (newer === 0) {
      if (st.holder === s.holder && Math.abs(st.x - s.x) < 0.2 && Math.abs(st.z - s.z) < 0.2) return;
      // Both screens made claim number v: the earlier start wins, on both.
      const theirsFirst = st.start < s.start - 1e-3 || (Math.abs(st.start - s.start) <= 1e-3 && this.m.host.seat() === 1);
      if (!theirsFirst) return;
    } else if (newer > 500) return; // an older claim than this screen's
    this.state = { ...st, since: this.m.host.time() };
    this.onChange?.(this, true);
  }
}

/** The kind of a spell, for a copy of it (Kohaku): what a person would call it at a glance. */
export type SpellShape = 'bolt' | 'dash' | 'ring' | 'shield';

export function spellShape(spell: HeroSpell, mode?: string): SpellShape {
  if (spell.dash || spell.escape) return 'dash';
  if (spell.summon) return 'ring';
  if (spell.aim === 'line' || mode === 'enemy' || mode === 'enemies') return 'bolt';
  // A spell on oneself with no reach of its own is a guard (armour, a veil, a shield), unless it stuns round the hero.
  if (mode === 'self' && (spell.save || spell.parry || spell.barrier || spell.buff || (spell.range === 0 && !spell.cc))) return 'shield';
  return 'ring';
}

/** A cast as the caster recorded it: where it stood, and where it aimed (for a one-target spell, where it saw its target). */
export interface CastNote { slot: number; time: number; from: P; point: P }

// --- the per-round state ---------------------------------------------------------------------------------------------

const views = new WeakMap<Enemy, MechView>();

/** The engine pieces for the side that `caster` plays (a spell's way in: `mechFor(ctx.caster)`), or null outside a duel. */
export function mechFor(caster: Enemy): MechView | null {
  return views.get(caster) ?? null;
}

const COVER_HP = 150;
const SLEEP_MAX = 1.5;
const STUN_CAP = 1.2;
const SIDES: MechSide[] = ['hero', 'opponent'];

export class Mech {
  private sleeps = new Map<MechSide, Sleep>();
  /** Sleep shown here for a hero the other screen decides, with when its look ends. */
  private wards: Ward[] = [];
  private leashes: LeashRec[] = [];
  private barriers: Barrier[] = [];
  private attractors: AttractorRec[] = [];
  private seals = new Map<string, number>();
  private tokens = new Map<string, Token>();
  private coverHp = new Map<number, number>();
  private casts = new Map<MechSide, CastNote>();
  /** Spell hits each hero took lately (fight clock), for a token's replay: a pass from the other screen may come late. */
  private hits = new Map<MechSide, { time: number; kind: string }[]>();
  /** Anything to do in `update`: false until a piece is used this round. */
  private busy = false;
  readonly views: Record<MechSide, MechView>;

  constructor(readonly host: MechHost) {
    this.views = { hero: new MechView(this, 'hero'), opponent: new MechView(this, 'opponent') };
  }

  /** A new round: every piece ends. Call after the figures are placed. */
  reset() {
    for (const w of this.wards) w.alive = false;
    this.sleeps.clear();
    this.wards.length = 0;
    this.leashes.length = 0;
    this.barriers.length = 0;
    this.attractors.length = 0;
    this.seals.clear();
    this.tokens.clear();
    this.coverHp.clear();
    this.casts.clear();
    this.hits.clear();
    this.busy = false;
    for (const s of SIDES) {
      const f = this.host.figure(s);
      if (f) views.set(f, this.views[s]);
    }
  }

  private now() { return this.host.time(); }
  private rel(side: MechSide) { return side === 'hero' ? 'S' : 'R'; }
  private unrel(c: string): MechSide { return c === 'S' ? 'opponent' : 'hero'; }

  // --- sleep (Vela) ---------------------------------------------------------------------------------------------

  /**
   * Puts `side`'s hero to sleep for up to `seconds` (at most 1.5, and a stun's lock and immunity rules hold): it cannot move,
   * cast or attack, and any damage wakes it; the waking hit deals `bonus` more (a share, at most `cap`). Decided where that
   * hero's statuses are: offline always, online only for this screen's own hero (call it from `dealt` or `victimTick`).
   * Told to the other screen, which shows it. Returns false when it did not take (immune, or not this screen's to decide).
   */
  sleep(side: MechSide, seconds: number, o: { bonus?: number; cap?: number } = {}) {
    if (!this.host.owns(side)) return false;
    const st = this.host.status(side), f = this.host.figure(side);
    if (!st || !f) return false;
    const want = Math.min(seconds, SLEEP_MAX);
    // A stun's rules first (immunity, a lock already running cuts it); a sleep alone may then run past a stun's 1.2 s cap.
    const r = st.apply('stun', want);
    if (r === 'immune') {
      this.host.say('IMMUNE', '#9a93a6', f.group.position.clone().setY(0.5), 0.8);
      return false;
    }
    if (r === 'applied' && st.remaining('stun') >= Math.min(want, STUN_CAP) - 1e-6) st.hold(want);
    const left = st.remaining('stun');
    this.sleeps.set(side, { until: this.now() + left, bonus: o.bonus ?? 0.25, cap: o.cap ?? 30 });
    this.busy = true;
    this.host.say('ASLEEP', '#c9b8ff', f.group.position.clone().setY(0.5), 1.1);
    this.host.send(msgName('z', this.rel(side)), msgN(left * 10));
    return true;
  }

  /** True while `side`'s hero sleeps (both screens). */
  asleep(side: MechSide) {
    const s = this.sleeps.get(side);
    return !!s && this.now() < s.until;
  }

  /** Ends a sleep (any damage does it). Only on the screen that decides that hero; told to the other. */
  wake(side: MechSide) {
    if (!this.sleeps.has(side) || !this.host.owns(side)) return;
    this.sleeps.delete(side);
    this.host.status(side)?.end('stun');
    this.host.send(msgName('z', this.rel(side)), 0);
  }

  /**
   * A hit of `damage` is about to land on `side`'s hero: if it sleeps, the extra the waking hit deals (0 otherwise), and it
   * wakes. Called by the duel where hits on that hero are resolved.
   */
  wakingHit(side: MechSide, damage: number) {
    const s = this.sleeps.get(side);
    if (!s || damage <= 0 || !this.host.owns(side)) return 0;
    const live = this.now() < s.until;
    this.wake(side);
    return live ? Math.min(damage * s.bonus, s.cap) : 0;
  }

  // --- wards: lines no spell crosses (Morwen) ----------------------------------------------------------------------

  /**
   * A line from `a` to `b` (or, with `r`, a circle round `a`) that no spell crosses, from either side, for `seconds`. Feet cross
   * it freely. Bolts of both sides stop on it; a one-target spell aimed across it fails at the cast (its cooldown spent); an
   * area spell's hit does not reach past it (the hit is tested from the zone's own centre, or a lane's start). Build it from the
   * cast (`sentFrom`, `point`) in the spell, which plays on both screens, so both have it. `halfWidth`: how close a bolt may
   * pass. Returns the ward; `end()` takes it away early.
   */
  ward(a: P, b: P | null, seconds: number, o: { r?: number; halfWidth?: number } = {}): Ward {
    const until = this.now() + seconds;
    const circle = !b && (o.r ?? 0) > 0;
    const walls: BoltWall[] = [];
    const hw = o.halfWidth ?? 0.15;
    const segs: [P, P][] = [];
    if (circle) {
      const n = 16, r = o.r!;
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
        segs.push([{ x: a.x + Math.sin(t0) * r, z: a.z + Math.cos(t0) * r }, { x: a.x + Math.sin(t1) * r, z: a.z + Math.cos(t1) * r }]);
      }
    } else segs.push([a, b ?? a]);
    for (const [p, q] of segs) for (const s of SIDES) walls.push(this.host.boltWall(s, p, q, hw, seconds));
    const w: Ward = {
      kind: circle ? 'circle' : 'line', a: { x: a.x, z: a.z }, b: b ? { x: b.x, z: b.z } : { x: a.x, z: a.z }, r: o.r ?? 0, until, alive: true,
      end: () => { w.alive = false; for (const x of walls) x.end(); },
    };
    this.wards.push(w);
    this.busy = true;
    return w;
  }

  /** The wards standing now (both screens): for the look and the CPU. */
  wardsNow(): readonly Ward[] {
    return this.wards;
  }

  /** True when a spell's way from `a` to `b` crosses a ward. Costs nothing when none stands. */
  wardBlocks(a: P, b: P) {
    if (!this.wards.length) return false;
    for (const w of this.wards) {
      if (!w.alive) continue;
      if (w.kind === 'circle' ? crossesCircle(a, b, w.a, w.r) : crosses(a, b, w.a, w.b)) return true;
    }
    return false;
  }

  /**
   * An area spell's hit on a figure at `p`: false when every zone it stands in is cut off from it by a ward (the zone's centre,
   * a cone's tip or a lane's start lies across one). `aimed`: where the cast aimed, for a cast with no drawn zone.
   */
  zoneReaches(zones: readonly { shape: TelegraphShape }[], aimed: P, p: P, inside: (s: TelegraphShape, x: number, z: number) => boolean) {
    if (!this.wards.length) return true;
    if (!zones.length) return !this.wardBlocks(aimed, p);
    let any = false;
    for (const z of zones) {
      if (!inside(z.shape, p.x, p.z)) continue;
      any = true;
      const s = z.shape;
      const from = s.kind === 'line' ? { x: s.x1, z: s.z1 } : { x: s.x, z: s.z };
      if (!this.wardBlocks(from, p)) return true;
    }
    return !any;
  }

  // --- leashes and a swap of places (Kessa) ----------------------------------------------------------------------

  /**
   * Leashes `side`'s hero to `anchor` (a point, or a function: her figure as it moves) for `seconds`: it cannot go farther than
   * `r` from it; held at the end, walking against it is `slow` slower (a share). `breakOnDash`: a dash or a blink of the
   * leashed hero ends it (`onBreak('dash')`). Kept by the screen that moves that hero: offline always, online only this
   * screen's own hero (call it from `dealt` or `victimTick` for the enemy, from the own client for oneself). Returns the leash,
   * or null when it is not this screen's to keep.
   */
  leash(side: MechSide, anchor: P | (() => P), r: number, seconds: number, o: { breakOnDash?: boolean; slow?: number; onBreak?: (why: 'dash' | 'time' | 'end') => void } = {}): Leash | null {
    if (!this.host.owns(side)) return null;
    const at = typeof anchor === 'function' ? anchor : () => anchor;
    const rec: LeashRec = {
      side, r, until: this.now() + seconds, alive: true, at, anchor: () => at(), breakOnDash: !!o.breakOnDash, slow: o.slow ?? 0, onBreak: o.onBreak,
      end: () => this.endLeash(rec, 'end'),
    };
    this.leashes.push(rec);
    this.busy = true;
    return rec;
  }

  leashesOf(side: MechSide): readonly Leash[] {
    return this.leashes.filter((l) => l.alive && l.side === side);
  }

  private endLeash(l: LeashRec, why: 'dash' | 'time' | 'end') {
    if (!l.alive) return;
    l.alive = false;
    this.leashes = this.leashes.filter((x) => x !== l);
    // The other screen draws the chain from the trait's own stacks; a break it cannot see (a dash) is told.
    if (why === 'dash') this.host.send(msgName('l', this.rel(l.side)), 0);
    l.onBreak?.(why);
  }

  /** Arena hook: a walk of `who` from `prev` ended at `p`; holds it inside its leashes. No leash: nothing at all. */
  holdWalk(who: Enemy, p: THREE.Vector3, prev: P) {
    if (!this.leashes.length) return;
    for (const l of this.leashes) {
      if (!l.alive || this.host.figure(l.side) !== who) continue;
      const c = l.at(), dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d <= l.r) continue;
      const hx = c.x + (dx / d) * l.r, hz = c.z + (dz / d) * l.r;
      // Held: what is left of the step goes along the chain's end, slowed.
      const k = 1 - l.slow;
      p.x = prev.x + (hx - prev.x) * k;
      p.z = prev.z + (hz - prev.z) * k;
      const d2 = Math.hypot(p.x - c.x, p.z - c.z);
      if (d2 > l.r) { p.x = c.x + ((p.x - c.x) / d2) * l.r; p.z = c.z + ((p.z - c.z) / d2) * l.r; }
    }
  }

  /** Arena hook: `who` starts a dash to `to`: a leash that a dash breaks ends; one that holds keeps the landing inside it. */
  holdDash(who: Enemy, to: THREE.Vector3) {
    if (!this.leashes.length) return;
    for (const l of [...this.leashes]) {
      if (!l.alive || this.host.figure(l.side) !== who) continue;
      if (l.breakOnDash) { this.endLeash(l, 'dash'); continue; }
      const c = l.at(), dx = to.x - c.x, dz = to.z - c.z, d = Math.hypot(dx, dz);
      if (d > l.r) { to.x = c.x + (dx / d) * l.r; to.z = c.z + (dz / d) * l.r; }
    }
  }

  /**
   * Kessa's Exchange: the caster and the enemy hero trade places over `seconds`, each to where the other stood as the cast
   * recorded it (`noteCast`). Each screen moves only the heroes it moves; online both screens play the spell, so both happen.
   * Call it from the spell at the cast moment. `reach`: the swap fails beyond this distance between the two.
   */
  swap(caster: MechSide, seconds: number, reach = Infinity) {
    const c = this.casts.get(caster);
    if (!c || Math.hypot(c.point.x - c.from.x, c.point.z - c.from.z) > reach) return false;
    const to = (p: P) => new THREE.Vector3(p.x, 0, p.z);
    if (this.host.owns(caster)) this.host.dash(caster, to(c.point), seconds);
    if (this.host.owns(other(caster))) this.host.dash(other(caster), to(c.from), seconds);
    return true;
  }

  /** The duel notes every cast before its effect plays: where its caster stood and where it aimed, as the caster's screen had them. */
  noteCast(side: MechSide, slot: number, from: P, point: P) {
    this.casts.set(side, { slot, time: this.now(), from: { x: from.x, z: from.z }, point: { x: point.x, z: point.z } });
  }

  /** The last cast of `side` this round (on this screen: online the other hero's casts arrive a moment late). */
  lastCast(side: MechSide): CastNote | null {
    return this.casts.get(side) ?? null;
  }

  // --- a sealed key (Kohaku) -------------------------------------------------------------------------------------

  /**
   * Seals `side`'s spell key `slot` for `seconds`, whatever its cooldown: that hero's own client refuses it, and its CPU counts it
   * as cooling. Decided on that hero's screen (offline always; online call it from `dealt` or `victimTick`), and told to the
   * other screen for the look.
   */
  seal(side: MechSide, slot: number, seconds: number) {
    if (!this.host.owns(side) || slot < 0 || slot > 3) return false;
    this.seals.set(side + slot, this.now() + seconds);
    this.busy = true;
    const f = this.host.figure(side);
    if (f) this.host.say('SEALED', '#ffb36a', f.group.position.clone().setY(0.6), 1);
    this.host.send(msgName('s', this.rel(side) + encDigit(slot)), msgN(seconds * 10));
    return true;
  }

  /** Seconds left on the seal of `side`'s key `slot` (0: none). Both screens. Costs nothing when none is set. */
  sealedLeft(side: MechSide, slot: number) {
    if (!this.seals.size) return 0;
    const until = this.seals.get(side + slot);
    return until === undefined ? 0 : Math.max(0, until - this.now());
  }

  // --- tokens (Asenet, Orren) ------------------------------------------------------------------------------------

  /**
   * A token one hero holds at a time, `key` one character (a hero has a few at most). Made on both screens alike (in a trait's
   * first `tick` or `ownChanged`, or from a cast); `claim` changes the holder on the screen whose word counts, and the other
   * screen follows. See `Token`.
   */
  token(key: string, holder: MechSide | null, at: P = { x: 0, z: 0 }): Token {
    let t = this.tokens.get(key);
    if (!t) {
      t = new Token(key[0], this, holder, at);
      this.tokens.set(key[0], t);
    }
    return t;
  }

  /** @internal */
  sendToken(t: Token) {
    const s = t.state, h = s.holder ? this.rel(s.holder) : 'G';
    this.host.send(msgName('k', t.key + h + encPos(s.x) + encPos(s.z) + encTime(s.start)), s.version % 1000);
  }

  /** Spell hits `side`'s hero took since `time` (fight clock), on the screen that decides it: a token's late pass is checked against it. */
  hitsOn(side: MechSide, since: number) {
    return (this.hits.get(side) ?? []).filter((h) => h.time >= since);
  }

  /** The duel: a hit landed on a hero this screen decides. */
  noteHit(side: MechSide, kind: string) {
    if (!this.tokens.size) return;
    const list = this.hits.get(side) ?? [];
    list.push({ time: this.now(), kind });
    while (list.length && this.now() - list[0].time > 2) list.shift();
    this.hits.set(side, list);
  }

  // --- one-sided ground (Itzel) ----------------------------------------------------------------------------------

  /**
   * Ground that `stops` side's hero cannot walk across for `seconds` (a chasm to them; a dash or a blink crosses), and that is no
   * wall to anything else: not to sight, not to bolts, not to its maker. Each screen holds back the hero it moves; the CPU's
   * route plans round it. Build it from the cast (marks, `sentFrom` and `point`) so both screens have it.
   */
  barrier(o: Obstacle, stops: MechSide, seconds: number): Barrier {
    const b: Barrier = { o, stops, until: this.now() + seconds, alive: true, end: () => { b.alive = false; this.barriers = this.barriers.filter((x) => x !== b); } };
    this.barriers.push(b);
    this.busy = true;
    return b;
  }

  /** The ground `who` may not walk across now (empty, and no new array, when there is none). */
  walkBlocks(who: Enemy): readonly Obstacle[] {
    if (!this.barriers.length) return NONE;
    const side = SIDES.find((s) => this.host.figure(s) === who);
    if (!side) return NONE;
    const out: Obstacle[] = [];
    for (const b of this.barriers) if (b.alive && b.stops === side) out.push(b.o);
    return out.length ? out : NONE;
  }

  // --- bolts that bend into a point (Vela) -------------------------------------------------------------------------

  /**
   * A point that catches the other side's bolts: one that passes within `r` turns into it and ends there, and `onCatch` runs
   * (the lantern takes it as a hit). Both screens fly the bolts aimed at their own hero and replay the rest, and both have the
   * point from the cast, so a bolt bends alike. `end()` takes it away (the lantern broke).
   */
  attractor(x: number, z: number, r: number, owner: MechSide, seconds: number, onCatch?: (bolt: Projectile) => void): Attractor {
    const a: AttractorRec = { x, z, r, owner, until: this.now() + seconds, alive: true, onCatch, end: () => { a.alive = false; } };
    this.attractors.push(a);
    this.busy = true;
    return a;
  }

  private bendBolts(dt: number) {
    const bolts = this.host.bolts();
    for (const a of this.attractors) {
      if (!a.alive) continue;
      for (const p of bolts) {
        if (!p.alive || this.host.boltSide(p) === a.owner) continue;
        const dx = a.x - p.pos.x, dz = a.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d > a.r) continue;
        if (d < 0.45) {
          p.alive = false;
          a.onCatch?.(p);
          continue;
        }
        // Turn toward the point fast enough to reach it from the edge of its pull.
        const want = Math.atan2(dx, dz), now = Math.atan2(p.dir.x, p.dir.z);
        const turn = Math.atan2(Math.sin(want - now), Math.cos(want - now));
        const step = Math.sign(turn) * Math.min(Math.abs(turn), 14 * dt);
        const y = now + step;
        p.dir.set(Math.sin(y), 0, Math.cos(y));
        p.curve = 0;
        p.rangeLeft = Math.max(p.rangeLeft, d + 0.5);
      }
    }
  }

  // --- the arena's own cover (Tova) --------------------------------------------------------------------------------

  /**
   * Damage to the arena's own cover piece `i` (pillars and walls; a fixed one never breaks) from `by`'s spells: each piece has
   * 150 a round. At 0 it is gone for the round, falling away from `from`. Decided on `by`'s own client and told to the other
   * screen; offline at once. Returns the piece's HP left (-1: it does not stand, or it is not this screen's to decide).
   */
  hurtCover(i: number, damage: number, by: MechSide, from?: P) {
    const o = this.host.arenaCover()[i];
    if (!o || o.fixed || !this.host.stands(i) || !this.host.owns(by)) return -1;
    const hp = Math.max(0, (this.coverHp.get(i) ?? COVER_HP) - damage);
    this.coverHp.set(i, hp);
    if (hp <= 0) {
      const cx = (o.ax + o.bx) / 2, cz = (o.az + o.bz) / 2;
      // Away from the blast (else from the ring's middle).
      const f = from ?? { x: 0, z: 7 };
      let dx = cx - f.x, dz = cz - f.z;
      const L = Math.hypot(dx, dz) || 1;
      dx /= L; dz /= L;
      this.host.breakCover(i, dx, dz);
      this.host.send(msgName('c', encDigit(Math.floor(i / 36)) + encDigit(i % 36)), msgN(((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360 / 2));
    }
    return hp;
  }

  /** HP left on the arena's cover piece `i` this round (150 untouched, 0 gone). */
  coverLeft(i: number) {
    return this.host.stands(i) ? this.coverHp.get(i) ?? COVER_HP : 0;
  }

  /** Cover pieces within `r` of a point (their capsule's nearest point), by index: what a blast reaches. */
  coverNear(p: P, r: number) {
    const out: number[] = [];
    this.host.arenaCover().forEach((o, i) => {
      if (!this.host.stands(i)) return;
      const sx = o.bx - o.ax, sz = o.bz - o.az, l2 = sx * sx + sz * sz;
      const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - o.ax) * sx + (p.z - o.az) * sz) / l2)) : 0;
      if (Math.hypot(p.x - (o.ax + sx * k), p.z - (o.az + sz * k)) <= o.r + r) out.push(i);
    });
    return out;
  }

  // --- every frame, both screens ---------------------------------------------------------------------------------

  update(dt: number) {
    if (!this.busy) return;
    const now = this.now();
    for (const [side, s] of this.sleeps) {
      // A sleep ends at its time, or when its stun ended some other way (a cleanse, a new round's clear).
      if (now >= s.until || !this.host.status(side)?.has('stun')) this.sleeps.delete(side);
    }
    if (this.wards.length) this.wards = this.wards.filter((w) => (w.alive &&= now < w.until));
    for (const l of [...this.leashes]) {
      if (now >= l.until) { this.endLeash(l, 'time'); continue; }
      // A knock or a carry took it past the end: back at walking pace.
      const f = this.host.figure(l.side);
      if (!f) continue;
      const p = f.group.position, c = l.at(), d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d > l.r + 0.05) {
        const back = Math.min(d - l.r, 6 * dt);
        p.x -= ((p.x - c.x) / d) * back;
        p.z -= ((p.z - c.z) / d) * back;
      }
    }
    if (this.barriers.length) this.barriers = this.barriers.filter((b) => (b.alive &&= now < b.until));
    if (this.attractors.length) {
      this.attractors = this.attractors.filter((a) => (a.alive &&= now < a.until));
      this.bendBolts(dt);
    }
  }

  // --- the engine channel ----------------------------------------------------------------------------------------

  /**
   * An engine message from the other screen (`#` + key + data). `fromPeer`: it came from the other player's screen (always,
   * except on a watcher's screen, where the watched hero's own messages come too: then the sides turn round).
   */
  receive(name: string, n: number, fromPeer = true) {
    if (name[0] !== PREFIX || name.length < 3) return;
    const key = name[1], data = name.slice(2);
    const side = (c: string) => (fromPeer ? this.unrel(c) : c === 'S' ? 'hero' : 'opponent') as MechSide;
    switch (key) {
      case 'z': {
        const s = side(data[0]), st = this.host.status(s), f = this.host.figure(s);
        if (!st) return;
        if (n > 0) {
          st.hold(n / 10);
          this.sleeps.set(s, { until: this.now() + n / 10, bonus: 0, cap: 0 });
          this.busy = true;
          if (f) this.host.say('ASLEEP', '#c9b8ff', f.group.position.clone().setY(0.5), 1.1);
        } else if (this.sleeps.delete(s)) st.end('stun');
        return;
      }
      case 's': {
        const s = side(data[0]), slot = decDigit(data[1]);
        if (n > 0) this.seals.set(s + slot, this.now() + n / 10);
        else this.seals.delete(s + slot);
        this.busy = true;
        return;
      }
      case 'l': {
        // The other screen's leash on its own hero broke by a dash: nothing is kept here but the trait's stacks, which it clears.
        return;
      }
      case 'k': {
        const t = this.tokens.get(data[0]);
        if (!t || data.length < 9) return;
        const h = data[1] === 'G' ? null : side(data[1]);
        t.receive({ holder: h, x: decPos(data.slice(2, 4)), z: decPos(data.slice(4, 6)), version: n, since: 0, start: decTime(data.slice(6, 9)) });
        return;
      }
      case 'c': {
        const i = decDigit(data[0]) * 36 + decDigit(data[1]);
        if (!this.host.stands(i)) return;
        const a = (n * 2 * Math.PI) / 180;
        this.coverHp.set(i, 0);
        this.host.breakCover(i, Math.sin(a), Math.cos(a));
        return;
      }
    }
  }
}

const NONE: readonly Obstacle[] = [];

/** The engine pieces as one side's trait and spells reach them (`t.mech`, `mechFor(ctx.caster)`). */
export class MechView {
  constructor(readonly m: Mech, readonly side: MechSide) {}

  get enemySide(): MechSide { return other(this.side); }

  /** True when this side's hero (`who: 'self'`) or the enemy faces `at` within `halfDeg` degrees. Both screens. */
  faces(who: 'self' | 'enemy', at: P, halfDeg: number) {
    const f = this.m.host.figure(who === 'self' ? this.side : this.enemySide);
    return !!f && faces(f.group.position, f.group.rotation.y, at, halfDeg);
  }

  sleepEnemy(seconds: number, o?: { bonus?: number; cap?: number }) { return this.m.sleep(this.enemySide, seconds, o); }
  enemyAsleep() { return this.m.asleep(this.enemySide); }
  ward(a: P, b: P | null, seconds: number, o?: { r?: number; halfWidth?: number }) { return this.m.ward(a, b, seconds, o); }
  wardBlocks(a: P, b: P) { return this.m.wardBlocks(a, b); }
  /** Leashes the enemy hero (to this hero's figure unless `anchor` says otherwise). */
  leashEnemy(r: number, seconds: number, o: { anchor?: P | (() => P); breakOnDash?: boolean; slow?: number; onBreak?: (why: 'dash' | 'time' | 'end') => void } = {}) {
    const me = this.m.host.figure(this.side);
    const anchor = o.anchor ?? (() => (me ? { x: me.group.position.x, z: me.group.position.z } : { x: 0, z: 0 }));
    return this.m.leash(this.enemySide, anchor, r, seconds, o);
  }
  leashSelf(anchor: P | (() => P), r: number, seconds: number, o?: { breakOnDash?: boolean; slow?: number; onBreak?: (why: 'dash' | 'time' | 'end') => void }) {
    return this.m.leash(this.side, anchor, r, seconds, o);
  }
  swap(seconds: number, reach?: number) { return this.m.swap(this.side, seconds, reach); }
  sealEnemy(slot: number, seconds: number) { return this.m.seal(this.enemySide, slot, seconds); }
  /** The enemy's last cast this round, and its kind (for a copy). */
  enemyLastCast() {
    const c = this.m.lastCast(this.enemySide), kit = this.m.host.kit(this.enemySide);
    return c ? { ...c, shape: kit ? spellShape(kit.spells[c.slot]) : ('bolt' as SpellShape) } : null;
  }
  token(key: string, holder: MechSide | null, at?: P) { return this.m.token(key, holder, at); }
  /** One-sided ground: the enemy cannot walk across it. */
  chasm(o: Obstacle, seconds: number) { return this.m.barrier(o, this.enemySide, seconds); }
  attractor(x: number, z: number, r: number, seconds: number, onCatch?: (bolt: Projectile) => void) { return this.m.attractor(x, z, r, this.side, seconds, onCatch); }
  hurtCover(i: number, damage: number, from?: P) { return this.m.hurtCover(i, damage, this.side, from); }
  coverLeft(i: number) { return this.m.coverLeft(i); }
  coverNear(p: P, r: number) { return this.m.coverNear(p, r); }
}
