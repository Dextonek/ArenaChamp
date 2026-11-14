import * as THREE from 'three';
import type { BrainMove, BrainTools, SummonBrain, SummonUnit } from '../../effects/summon';
import { TelegraphLayer, insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { segDist, sweepHit } from '../../obstacles';
import type { Enemy } from '../../effects/common';
import type { GameApi } from '../../runtime';
import type { EnemySpec } from './def';

/**
 * How the Climb's enemies fight (the user, 2026-11-14: "those mobs should also have a pattern of attack and focusing logic"). Before
 * this, every unit walked at the nearest victim and struck or shot; now a pack thinks as one, and each kind has its own way:
 *
 * **Focus (the pack):** a pack picks one victim together and holds it (at least `HOLD` s, unless it falls or runs far): the hero, or a
 * unit of the hero's side that stands in the pack's face. A melee unit goes for the focus unless something bites it from closer; a
 * ranged unit shoots the focus, or whoever came within `SELF` m of it.
 * **Surround and take turns:** melee units come at the focus from different sides (slots round it, spread from the pack's side), and at
 * most `TOKENS` strike at once; the others wait a step back, circling, until a place is free.
 * **Patterns (each kind its own):**
 * - *line* (dockers, raiders, footmen, ashen soldiers): surround and take turns, nothing more.
 * - *hunter* (hounds, mites, dust wraiths): surround wide and, now and then, one of them lunges a few metres (a short red line first).
 * - *pouncer* (the lurker): keeps off at the edge of the dark, then leaps far (a long red line), and stands open a moment after.
 * - *brute* (crabs, moss giants): every few blows a slam (a red circle round it fills, then it lands).
 * - *charger* (knights, the Stag-Crowned): from a distance, a charge along a red line; it stands winded after.
 * - *caster* (slingers, sprites, bowmen, golems, feeding roots): every third shot a fan of three, each weaker.
 * - *warden* (the guards and the named): slam and charge in turn (with its victim in reach when the charge is due, it falls back first,
 *   as a knight does); below 40% health it attacks a third faster.
 * Kinds not in the table (a set piece's own) fight as before.
 *
 * Fair by rule: every special shows its zone first, long enough to walk out (`WIND`), never starts on a held hero (rooted, stunned,
 * slowed), one special at a time a pack, and it takes the place of a blow (it starts only when a blow is due, and the attack wait starts
 * again after it). A run (charge, lunge, pounce) is drawn only as far as the ground is free: its line ends where the unit's body would
 * first touch cover, an edge of the floor or a wall of roots, and a run that cannot reach its victim so is not begun; a run that is
 * stopped (a wall rose, it is pushed off its line) ends there. Its hit goes
 * through the pack's own delivery (shields, boons, leech and the tallies as any blow), its size as `damage` / 30 of the kind's blow.
 * No random numbers: who goes when comes from the unit's place in the pack and the clock, so the route bot and the perf scenes replay.
 */
export type Role = 'line' | 'hunter' | 'pouncer' | 'brute' | 'charger' | 'caster' | 'warden';

/** By the look's first word (`footman-crimson` is a footman). */
const ROLE: Record<string, Role> = {
  docker: 'line', raider: 'line', footman: 'line', ashen: 'line',
  hound: 'hunter', mite: 'hunter', wraith: 'hunter',
  lurker: 'pouncer',
  crab: 'brute', giant: 'brute',
  knight: 'charger', stag: 'charger',
  netter: 'caster', sprite: 'caster', slinger: 'caster', bowman: 'caster', golem: 'caster', root: 'caster',
  mate: 'warden', barnacle: 'warden', oak: 'warden', chief: 'warden', mother: 'warden', thief: 'warden', pale: 'warden',
  bearer: 'warden', deserter: 'warden',
};

export function roleOf(spec: EnemySpec): Role | null {
  const r = ROLE[String(spec.look).split('-')[0]] ?? null;
  // A look worn by the other kind of fighter (the Deep's second named is a golem that strikes): a striker is a brute, a shooter a caster.
  if (r === 'caster' && spec.melee) return 'brute';
  if (r && r !== 'caster' && !spec.melee) return 'caster';
  return r;
}

/** The base blow's `damage` (packs.ts): a hit's share of the hero is the kind's `share` times `damage / BLOW`. */
export const BLOW = 30;
const HOLD = 2.5, TOKENS = 3, SELF = 4, REACH = 1.4;
/** Wind-ups (s): the zone fills this long before it lands. */
const WIND = { slam: 1.0, charge: 0.85, lunge: 0.6, pounce: 0.8 } as const;
/** The blow's size against a plain blow. */
const MUL = { slam: 1.8, charge: 1.5, lunge: 1.2, pounce: 1.6, fan: 0.6 } as const;
/** Seconds between two of a unit's specials. */
const EVERY = { slam: 5.5, charge: 7, lunge: 6, pounce: 8 } as const;

type Victim = { figure: Enemy; pos: THREE.Vector3 };
type Kind = keyof typeof WIND;

interface Special {
  kind: Kind;
  t: number;
  shape: TelegraphShape;
  layer: TelegraphLayer;
  dir?: THREE.Vector3;
  len?: number;
  went?: number;
  speedWas?: number;
  hit: Set<Enemy>;
  /** Whom it was aimed at (kept by `pick` while it goes on). */
  aim: Enemy;
  /** After it lands: the unit stands winded this long. */
  rest: number;
  /** Where the unit stood last frame of its run (a run that does not move is over). */
  last?: THREE.Vector3;
}

interface Mind {
  spec: EnemySpec;
  role: Role;
  /** Its place in the pack (who goes when, which slot). */
  i: number;
  ready: number;
  shots: number;
  sp: Special | null;
  rest: number;
  /** In reach and striking (holds a token). */
  striking: boolean;
  /** Blows struck so far (a new one is seen when its attack wait starts again) and the wait last frame. */
  blows: number;
  lastCd: number;
  /** Falling back (s left): a hound after its bite, a knight after two blows, before it comes again with its special. */
  fade: number;
}

/** One pack's mind. Packs make one (`packs.ts`) and hand each unit `brainFor`. */
export class PackMind {
  private minds = new Map<SummonUnit, Mind>();
  private focus: Victim | null = null;
  private held = 0;
  private busy: SummonUnit | null = null;
  private clock = 0;
  private thought = false;
  /** What it did, for the probes (pipeline/tools/tactics-probe.py): specials started, fans shot, blows landed by a special. */
  readonly stats: Record<string, number> = {};
  /** The same by kind (the enemy's id): which kinds' specials fire (pipeline/tools/tactics-all.py). */
  readonly byKind: Record<string, Record<string, number>> = {};
  private count(spec: EnemySpec, what: string) {
    this.stats[what] = (this.stats[what] ?? 0) + 1;
    const k = (this.byKind[spec.id] ??= {});
    k[what] = (k[what] ?? 0) + 1;
  }

  constructor(
    private api: GameApi,
    /** True while the pack fights (asleep, leashed and gone: the brains do nothing). */
    private awake: () => boolean,
  ) {}

  /** Once a frame, from the pack (its own clock: no wall time, so a replay is the same). */
  tick(dt: number) {
    this.clock += dt;
    this.held += dt;
    this.thought = false;
  }

  /** The brain the pack's units are made with (only kinds in the table: `roleOf`); each unit is then told who it is (`add`). */
  readonly brain: SummonBrain = {
    pick: (unit, victims) => this.pick(unit, victims),
    act: (unit, tgt, dist, dt, tools) => this.act(unit, tgt, dist, dt, tools),
  };

  /** A unit made with `brain`: its kind and its place in the pack. */
  add(u: SummonUnit, spec: EnemySpec, i: number) {
    const role = roleOf(spec);
    const quick = role === 'charger' || role === 'pouncer';
    if (role) this.minds.set(u, { spec, role, i, ready: quick ? 0.6 + i * 0.4 : 2 + i * 0.9, shots: i % 3, sp: null, rest: 0, striking: false, blows: 0, lastCd: 0, fade: 0 });
  }

  /** A unit left (fell, went away): its zone goes with it. */
  forget(u: SummonUnit) {
    const m = this.minds.get(u);
    if (m) this.drop(u, m);
    this.minds.delete(u);
  }

  /** The pack stops fighting (leashed, asleep, hidden, gone): every zone goes, every walk is its own again. */
  calm() {
    for (const [u, m] of this.minds) this.drop(u, m);
    this.focus = null;
    this.busy = null;
  }

  private drop(u: SummonUnit, m: Mind) {
    if (m.sp) {
      m.sp.layer.set([]);
      m.sp.layer.group.removeFromParent();
      Zones.live--;
      if (m.sp.speedWas !== undefined) u.opts.speed = m.sp.speedWas;
      m.sp = null;
    }
    m.striking = false;
    m.rest = 0;
    if (this.busy === u) this.busy = null;
  }

  // --- whom ----------------------------------------------------------------------------------------------------------------------------

  private live() {
    return [...this.minds.keys()].filter((u) => u.alive);
  }

  /** Once a frame (on the first unit asked): the pack's focus, held `HOLD` s. */
  private think(victims: Victim[]) {
    if (this.thought) return;
    this.thought = true;
    const units = this.live();
    if (!units.length || !victims.length) { this.focus = null; return; }
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.pos.x; cz += u.pos.z; }
    cx /= units.length; cz /= units.length;
    const still = this.focus && victims.find((v) => v.figure === this.focus!.figure);
    if (still && this.held < HOLD) { this.focus = still; return; }
    const hero = this.api.arena.caster as unknown as Enemy;
    let best: Victim | null = null, bestScore = -Infinity;
    for (const v of victims) {
      const d = Math.hypot(v.pos.x - cx, v.pos.z - cz);
      const inFace = units.some((u) => Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 3);
      let score = (v.figure === hero ? 1 : inFace ? 1.2 : 0.5) - d / 20;
      if (still && v.figure === still.figure) score += 0.25; // it keeps what it has unless another is clearly better
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (!still || best!.figure !== still.figure) this.held = 0;
    this.focus = best;
  }

  private pick(u: SummonUnit, victims: Victim[]): Victim | null {
    let near: Victim | null = null, nd = Infinity;
    for (const v of victims) {
      const d = Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z);
      if (d < nd) { nd = d; near = v; }
    }
    if (!this.awake()) return near;
    this.think(victims);
    const m = this.minds.get(u);
    const f = this.focus;
    if (!m || !f) return near;
    if (m.sp) return victims.find((v) => v.figure === m.sp!.aim) ?? f; // mid-special: keep its aim
    const fd = Math.hypot(f.pos.x - u.pos.x, f.pos.z - u.pos.z);
    if (m.role === 'caster') return nd < SELF && near !== f ? near : f;
    // Melee: the focus, unless something bites from much closer.
    return near && nd < REACH + 0.6 && fd > 4 ? near : f;
  }

  // --- how -----------------------------------------------------------------------------------------------------------------------------

  private pinned(v: Victim) {
    const s = this.api.arena.statusOf(v.figure);
    return !!s && (s.cannotMove || s.has('slow'));
  }

  private act(u: SummonUnit, tgt: Victim | null, dist: number, dt: number, tools: BrainTools): BrainMove | null {
    const m = this.minds.get(u);
    if (!m) return null;
    if (!this.awake()) { if (m.sp || m.striking) this.drop(u, m); return null; }
    if (m.role === 'warden') u.rate = u.hp < u.max * 0.4 ? 1.33 : 1;
    m.ready -= dt;
    if (m.sp) return this.carry(u, m, dt);
    if (m.rest > 0) { m.rest -= dt; return { face: tgt?.pos }; }
    if (!tgt) return null;
    // A blow just struck (its wait started again): a hound falls back after each bite, a knight after every second blow.
    if (u.cd > m.lastCd + 0.05 && m.role !== 'caster') {
      m.blows++;
      if (m.role === 'hunter') m.fade = 1.1;
      if (m.role === 'charger' && m.blows % 2 === 0) m.fade = 2.4;
    }
    // A warden whose charge is due with its victim in reach steps back for it (slam and charge in turn, as the table says).
    if (m.role === 'warden' && m.i % 2 === 1 && m.fade <= 0 && m.ready <= 0 && !this.busy && dist <= 4 && !this.pinned(tgt)) m.fade = 2.4;
    m.lastCd = u.cd;
    if (m.fade > 0) {
      m.fade -= dt;
      m.striking = false;
      // How far it falls back: a knight far, a warden just past a charge's least reach (4 m), a hound a step.
      const want = m.role === 'charger' ? 7.5 : m.role === 'warden' ? 5 : 3.6;
      if (dist < want) {
        const away = new THREE.Vector3(u.pos.x - tgt.pos.x, 0, u.pos.z - tgt.pos.z);
        if (m.role === 'hunter') away.applyAxisAngle(UP, (m.i % 2 ? 1 : -1) * 0.7); // it circles off, not straight back
        return { dir: away, face: m.role === 'hunter' ? tgt.pos : undefined };
      }
      m.fade = 0;
    }

    // A special, when it is its time and the pack has none going.
    // It takes the place of a blow: only when one is due (`u.cd` run out), never on top of one just struck.
    const start = (kind: Kind) => !this.busy && m.ready <= 0 && u.cd <= 0 && !this.pinned(tgt) && this.begin(u, m, kind, tgt, dist);
    switch (m.role) {
      case 'brute': if (dist <= REACH + 0.8 && start('slam')) return this.carry(u, m, 0); break;
      case 'charger': if (dist > 4 && dist < 12 && tools.sees(u.pos, tgt.pos) && start('charge')) return this.carry(u, m, 0); break;
      case 'hunter': if (dist > 2 && dist < 5 && tools.sees(u.pos, tgt.pos) && start('lunge')) return this.carry(u, m, 0); break;
      case 'pouncer':
        if (dist > 4 && dist < 9 && tools.sees(u.pos, tgt.pos) && start('pounce')) return this.carry(u, m, 0);
        // It keeps off at the edge until it can leap.
        if (m.ready > 0 && dist < 6) return { dir: new THREE.Vector3(u.pos.x - tgt.pos.x, 0, u.pos.z - tgt.pos.z), face: tgt.pos };
        break;
      case 'warden': {
        const kind: Kind = m.i % 2 === 0 ? (dist <= REACH + 0.8 ? 'slam' : 'charge') : (dist > 4 ? 'charge' : 'slam');
        if (kind === 'slam' ? dist <= REACH + 0.8 : dist > 4 && dist < 12 && tools.sees(u.pos, tgt.pos)) {
          if (start(kind)) { m.i++; return this.carry(u, m, 0); }
        }
        break;
      }
      case 'caster':
        if (u.cd <= 0 && u.rate > 0 && dist <= u.opts.range && tools.sees(u.pos, tgt.pos)) {
          m.shots++;
          if (m.shots % 3 === 0 && m.spec.look !== 'netter') {
            for (const a of [-0.26, 0, 0.26]) tools.shoot(turned(u.pos, tgt.pos, a), BLOW * MUL.fan);
            this.count(m.spec, 'fan');
          } else tools.shoot(tgt.pos);
          return { face: tgt.pos };
        }
        return null;
    }

    // Melee: surround the focus and take turns.
    const units = this.live().filter((x) => { const o = this.minds.get(x); return o && o.role !== 'caster'; });
    const striking = units.filter((x) => this.minds.get(x)!.striking).length;
    if (dist <= REACH) {
      if (m.striking || striking < TOKENS) { m.striking = true; return null; } // the system's own swing
    } else m.striking = false;
    const waits = !m.striking && striking >= TOKENS;
    if (dist > 7 && !waits) return null; // far: the system's own chase (the arena's route)
    let cx = 0, cz = 0;
    for (const x of units) { cx += x.pos.x; cz += x.pos.z; }
    cx /= units.length || 1; cz /= units.length || 1;
    const base = Math.atan2(cx - tgt.pos.x, cz - tgt.pos.z);
    const k = units.indexOf(u);
    const spread = m.role === 'hunter' ? 1.25 : 0.95;
    const a = base + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * spread) + (waits ? this.clock * 0.35 : 0);
    const r = waits ? 3.2 : REACH * 0.8;
    const slot = new THREE.Vector3(tgt.pos.x + Math.sin(a) * r, 0, tgt.pos.z + Math.cos(a) * r);
    if (Math.hypot(slot.x - u.pos.x, slot.z - u.pos.z) < 0.3) return { face: tgt.pos };
    return { to: slot, face: dist < 4 ? tgt.pos : undefined };
  }

  /** Starts a special: its zone on the ground, the pack's one special. */
  private begin(u: SummonUnit, m: Mind, kind: Kind, tgt: Victim, dist: number) {
    const dir = new THREE.Vector3(tgt.pos.x - u.pos.x, 0, tgt.pos.z - u.pos.z);
    if (dir.lengthSq() < 1e-6) return false;
    dir.normalize();
    let shape: TelegraphShape, len = 0;
    const sc = m.spec.scale ?? 1;
    if (kind === 'slam') {
      const r = 1.5 + 0.55 * sc;
      shape = { kind: 'circle', x: u.pos.x + dir.x * 0.8, z: u.pos.z + dir.z * 0.8, radius: r };
    } else {
      len = kind === 'charge' ? Math.min(10, dist + 2.5) : kind === 'pounce' ? Math.min(8.5, dist + 1.5) : Math.min(5, dist + 1);
      len = this.free(u.pos, dir, len);
      // A run that cannot reach its victim (cover in the way of its body) is not begun: it walks as before.
      if (len < dist - 0.3) return false;
      const width = kind === 'charge' ? 1.7 : 1.3;
      shape = { kind: 'line', x1: u.pos.x, z1: u.pos.z, x2: u.pos.x + dir.x * len, z2: u.pos.z + dir.z * len, width };
    }
    const layer = new TelegraphLayer();
    layer.set([{ shape, start: 0, impact: WIND[kind] }]);
    layer.group.position.y = u.pos.y + 0.04;
    layer.group.name = 'tactics-zone';
    this.api.arena.group.add(layer.group);
    m.sp = { kind, t: 0, shape, layer, dir, len, went: 0, hit: new Set(), aim: tgt.figure, rest: kind === 'slam' ? 0.5 : kind === 'lunge' ? 0.5 : 1.0 };
    m.ready = EVERY[kind];
    this.busy = u;
    this.count(m.spec, kind);
    Zones.live++;
    return true;
  }

  /**
   * How far a run from `from` along `dir` can go, up to `len`: to where the unit's body (0.45 m) first touches a piece of cover (the
   * floor's edges and the Wood's walls of roots are cover too), and inside the arena's ring.
   */
  private free(from: THREE.Vector3, dir: THREE.Vector3, len: number) {
    const arena = this.api.arena;
    const to = new THREE.Vector3(from.x + dir.x * len, 0, from.z + dir.z * len);
    const near = (arena.obstacles ?? []).filter((o) => segDist(o.ax, o.az, o.bx, o.bz, from.x, from.z, to.x, to.z) <= o.r + 0.5);
    const hit = near.length ? sweepHit(new THREE.Vector3(from.x, 0, from.z), to, 0.45, near) : null;
    if (hit) len = Math.max(0, hit.t * len - 0.1);
    const b = arena.bounds;
    if (b) {
      // The ring: the run ends 0.5 m inside it (the walk's own margin).
      const r = b.r - 0.5, fx = from.x - b.x, fz = from.z - b.z, p = fx * dir.x + fz * dir.z, q = fx * fx + fz * fz - r * r;
      if (q < 0) len = Math.min(len, -p + Math.sqrt(p * p - q));
    }
    return len;
  }

  /** A special going on: the wind-up, then the blow (or the run), then the rest. */
  private carry(u: SummonUnit, m: Mind, dt: number): BrainMove {
    const sp = m.sp!;
    sp.t += dt;
    sp.layer.update(sp.t);
    const w = WIND[sp.kind];
    const face = sp.kind === 'slam' ? new THREE.Vector3(sp.shape.kind === 'circle' ? sp.shape.x : u.pos.x, 0, sp.shape.kind === 'circle' ? sp.shape.z : u.pos.z) : u.pos.clone().add(sp.dir!);
    if (sp.t < w) return { face, pose: sp.t / w };
    const world = u.summon.world;
    const blow = (v: Victim, mul: number) => (this.count(m.spec, 'landed'), world.hit(v.figure, { damage: BLOW * mul, knock: sp.kind === 'slam' ? 3 : 4, from: u.pos.clone(), color: m.spec.color, projectile: true }));
    if (sp.kind === 'slam') {
      if (sp.went === 0) {
        sp.went = 1;
        for (const v of world.victims()) if (insideTelegraph(sp.shape, v.pos.x, v.pos.z)) blow(v, MUL.slam);
        u.cd = u.opts.attackEvery;
      }
      if (sp.t > w + 0.25) return this.end(u, m, sp.rest);
      return { face };
    }
    // A run along the line: fast, striking each it touches once.
    if (sp.speedWas === undefined) sp.speedWas = u.opts.speed;
    const speed = sp.kind === 'lunge' ? 10 : 13;
    u.opts.speed = speed;
    for (const v of world.victims()) {
      if (sp.hit.has(v.figure)) continue;
      if (Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 1.1 + 0.2 * (m.spec.scale ?? 1)) { sp.hit.add(v.figure); blow(v, MUL[sp.kind]); }
    }
    const step = speed * dt;
    // Stopped: it did not move last frame (a wall rose before it, a body in the way), or it was set off its line (a rising wall of
    // roots sets whoever stands under it aside): the run is over where it is.
    const moved = sp.last ? Math.hypot(u.pos.x - sp.last.x, u.pos.z - sp.last.z) : Infinity;
    const off = sp.shape.kind === 'line' ? offLine(sp.shape, u.pos) : 0;
    const stuck = sp.last !== undefined && dt > 0 && moved < 0.35 * step;
    sp.last = (sp.last ?? new THREE.Vector3()).copy(u.pos);
    sp.went = (sp.went ?? 0) + step;
    if (stuck || off > 0.9 || sp.went >= sp.len! || sp.t > w + sp.len! / speed + 0.4) {
      u.opts.speed = sp.speedWas;
      u.cd = u.opts.attackEvery;
      return this.end(u, m, sp.rest);
    }
    return { dir: sp.dir, face: u.pos.clone().add(sp.dir!) };
  }

  private end(u: SummonUnit, m: Mind, rest: number): BrainMove {
    const sp = m.sp!;
    sp.layer.set([]);
    sp.layer.group.removeFromParent();
    Zones.live--;
    if (sp.speedWas !== undefined) u.opts.speed = sp.speedWas;
    m.sp = null;
    m.rest = rest;
    if (this.busy === u) this.busy = null;
    return {};
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/** Zones on the ground now, over every pack (the probe checks none is left behind). */
export const Zones = { live: 0 };

/** How far `p` is from a line zone's middle line (m). */
function offLine(sh: Extract<TelegraphShape, { kind: 'line' }>, p: THREE.Vector3) {
  const ex = sh.x2 - sh.x1, ez = sh.z2 - sh.z1, l2 = ex * ex + ez * ez || 1;
  const t = Math.max(0, Math.min(1, ((p.x - sh.x1) * ex + (p.z - sh.z1) * ez) / l2));
  return Math.hypot(p.x - (sh.x1 + ex * t), p.z - (sh.z1 + ez * t));
}

/** `to` turned round `from` by `a` radians (a fan's side bolts). */
function turned(from: THREE.Vector3, to: THREE.Vector3, a: number) {
  const dx = to.x - from.x, dz = to.z - from.z, c = Math.cos(a), s = Math.sin(a);
  return new THREE.Vector3(from.x + dx * c - dz * s, to.y, from.z + dx * s + dz * c);
}
