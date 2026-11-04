import * as THREE from 'three';
import type { GroundMark, Trait, TraitView } from './types';
import { YARN_CSS, snipLook, yarnLook, yarnLooseLook } from '../effects/parts/yarn';
import type { SummonUnit } from '../effects/summon';
import type { BoltWall } from '../effects/projectile';
import type { CastContext } from '../effects/targeting';
import type { MinionLook } from '../effects/parts/minion';

/** Knitting Needle (Q): damage, reach (m), speed (m/s), wind-up (s) and the bolt's radius (m; the drawn line is `boltWidth(radius)`). */
export const NEEDLE_DAMAGE = 50;
export const NEEDLE_RANGE = 9;
export const NEEDLE_SPEED = 22;
export const NEEDLE_WIND = 0.3;
export const NEEDLE_RADIUS = 0.3;

/** Cast On (W): reach (m), seconds until the line is tied, how far ahead of her it starts (m), most lines at once, charges and the seconds for one back. */
export const CAST_RANGE = 9;
export const CAST_RISE = 0.4;
export const CAST_AHEAD = 0.6;
export const LINE_MAX = 3;
export const CAST_CHARGES = 2;
export const CAST_EVERY = 6;
export const CAST_GAP = 0.6;
/** A line stands until it is cut: its unit and bolt wall are made for this long (s) so that they outlast any round. */
export const LINE_SECONDS = 600;
/** Half the thickness of the bolt wall on a line (m); a bolt adds its own radius. */
export const LINE_HALF = 0.12;
/** The CPU strings a line only with the enemy this far away (m). */
export const CAST_AI_MIN = 3;
export const CAST_AI_MAX = 9;

/** Crossing a line: seconds stuck, seconds slowed after, the shortest gap before one line catches the same hero again, and the longest step counted as walking (m). */
export const CROSS_ROOT = 0.4;
export const CROSS_SLOW = 1;
export const CROSS_GUARD = 1.5;
const CROSS_STEP = 3;
/** How long a cut line's wool lies (s). */
export const SNIP_SECONDS = 0.7;

/** Sweater (E): reach (m), wind-up (s), the circle drawn on the enemy (m), the slow (s) and the shrink's damage. */
export const SWEATER_RANGE = 7;
export const SWEATER_WIND = 0.5;
export const SWEATER_RADIUS = 1;
export const SWEATER_SLOW = 2;
export const SWEATER_DAMAGE = 40;

/** Mr. Biscuit (R): HP, seconds, speed (m/s), damage a second (one hit of 25 a second), the slow each hit gives (s), the cat plays with a cut line within this reach (m) for this long (s), and the CPU's reach (m). */
export const BISCUIT_HP = 200;
export const BISCUIT_LIFE = 6;
export const BISCUIT_SPEED = 4.5;
export const BISCUIT_DAMAGE = 25;
export const BISCUIT_EVERY = 1;
export const BISCUIT_SLOW = 1;
export const BISCUIT_NEAR = 4;
export const BISCUIT_PLAY = 1;
export const BISCUIT_AI_MAX = 9;

/** One line of yarn. `x1,z1`: her end. `x2,z2`: the far end, tied to cover (`tied`) or to nothing, 9 m out. Times are `performance.now()` milliseconds. */
export interface YarnLine {
  /** Unique per figure, the same on both screens (a count of lines made at the casts, wrapping at 900: a `show` value is capped at 999): the cut message names it. */
  id: number;
  x1: number; z1: number; x2: number; z2: number;
  tied: boolean;
  raised: boolean;
  bornAt: number;
  gone: boolean;
  goneAt: number;
  /** It ended by a hit (not because a new line made room, or a new round). */
  cut: boolean;
  /** The other screen has been told it was cut (or told us). */
  told: boolean;
  /** `t.time` of the last time it caught the enemy hero (where hits are decided). */
  hitAt: number;
  /** The cast context that made it, the 1 HP unit that takes the hits (only where `ctx.summon` exists) and the bolt wall. */
  ctx: CastContext | null;
  unit: SummonUnit | null;
  bw: BoltWall | null;
  book: YarnBook;
}

/** A line that was cut: its two ends and when, so Mr. Biscuit can run to the loose end. */
export interface YarnCut { ax: number; az: number; bx: number; bz: number; at: number }

/**
 * What Grandma leaves behind, per figure (the effects play on both screens and the CPU reuses one effect per spell, so it lives
 * here). `lines`: her lines. `cuts`: the last few cuts. `sweater`: when the last Sweater landed (`at`). `tangleAt`: when the enemy
 * last crossed a line. `cat`: Mr. Biscuit's unit, where the unit exists.
 */
export interface YarnBook {
  seq: number;
  lines: YarnLine[];
  cuts: YarnCut[];
  sweater: { at: number } | null;
  tangleAt: number;
  cat: SummonUnit | null;
}
export const yarnBooks = new WeakMap<object, YarnBook>();

export function bookOf(who: object): YarnBook {
  let b = yarnBooks.get(who);
  if (!b) { b = { seq: 0, lines: [], cuts: [], sweater: null, tangleAt: -1e9, cat: null }; yarnBooks.set(who, b); }
  return b;
}

/** The lines that stand now. */
export function liveLines(b: YarnBook) {
  return b.lines.filter((l) => l.raised && !l.gone);
}

/** A line made at a cast, not tied yet. Writes it to the book (both screens do, so the ids agree). */
export function newLine(b: YarnBook, x1: number, z1: number, x2: number, z2: number, tied: boolean): YarnLine {
  const l: YarnLine = {
    id: (b.seq = (b.seq % 900) + 1), x1, z1, x2, z2, tied, raised: false, bornAt: 0, gone: false, goneAt: 0, cut: false, told: false,
    hitAt: -99, ctx: null, unit: null, bw: null, book: b,
  };
  // Forget what ended long ago.
  const now = performance.now();
  b.lines = b.lines.filter((k) => !k.gone || now - k.goneAt < 1500);
  b.lines.push(l);
  return l;
}

/** The summoned unit's look: nothing (the marks draw the line), and its HP bar is sent far below the floor, so no bar gives the line away. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: -300 });

/** Ends a line now: the bolt wall goes, the unit runs out. `cut`: a hit did it. Safe to call twice. */
export function dropLine(l: YarnLine, cut: boolean) {
  if (l.gone) return;
  l.gone = true;
  l.cut = cut;
  l.goneAt = performance.now();
  l.bw?.end();
  l.bw = null;
  if (l.unit?.alive) l.unit.left = 0;
  if (cut) {
    const cuts = l.book.cuts;
    cuts.push({ ax: l.x1, az: l.z1, bx: l.x2, bz: l.z2, at: l.goneAt });
    if (cuts.length > 8) cuts.shift();
  }
}

/** Clears everything: a new round. */
function clearBook(b: YarnBook) {
  for (const l of b.lines) dropLine(l, false);
  b.lines = [];
  b.cuts = [];
  b.sweater = null;
  b.tangleAt = -1e9;
  b.cat = null;
}

/** The first call of a round (`mem` is cleared with it) forgets last round's lines on this screen. */
function fresh(t: TraitView) {
  if (t.mem.y === 1) return;
  t.mem.y = 1;
  const b = yarnBooks.get(t.self());
  if (b) clearBook(b);
}

/**
 * Makes room for one more line: at most `LINE_MAX` stand, so the oldest goes (it is not "cut": no loose end for the cat).
 * `keep`: the line this cast is about to tie.
 */
export function makeRoom(b: YarnBook, keep: YarnLine) {
  for (let guard = 0; guard < 6; guard++) {
    const live = liveLines(b).filter((l) => l !== keep);
    if (live.length < LINE_MAX) return;
    dropLine(live.reduce((a, c) => (c.bornAt < a.bornAt ? c : a)), false);
  }
}

/** Gives a tied line its 1 HP unit, where `ctx.summon` exists. Called again a frame later by `victimTick` if the unit cap was full. */
function attachUnit(ctx: CastContext, l: YarnLine) {
  const sm = ctx.summon?.({
    kind: 'turret', at: new THREE.Vector3((l.x1 + l.x2) / 2, 0, (l.z1 + l.z2) / 2), hp: 1, seconds: LINE_SECONDS,
    damage: 0, attackEvery: 999, range: 0.01, color: YARN_CSS.pink, look: HIDDEN,
  });
  l.unit = sm?.units[0] ?? null;
  sm?.onDeath((u) => dropLine(l, u.slain));
}

/**
 * Ties a line now: its 1 HP unit (spells and basic attacks hit it) and a bolt wall on the same segment. A bolt that reaches the
 * line anywhere along its length is caught by the bolt wall at once and cuts it, so "one hit of any size" holds for the whole
 * line, not only near the unit. A line is no obstacle: nobody is stopped by it except through the crossing rule. Where there is no
 * `ctx.summon` or `ctx.boltWall` (the other screen of a network duel) the line is still drawn and is told when it is cut.
 */
export function raiseLine(ctx: CastContext, l: YarnLine) {
  l.raised = true;
  l.ctx = ctx;
  l.bornAt = performance.now();
  attachUnit(ctx, l);
  l.bw = ctx.boltWall?.({
    a: new THREE.Vector3(l.x1, 0, l.z1), b: new THREE.Vector3(l.x2, 0, l.z2), halfWidth: LINE_HALF, seconds: LINE_SECONDS,
    onBlock: () => dropLine(l, true),
  }) ?? null;
}

/**
 * Where a line's unit stands: on the line, at the point where the way from the enemy to her crosses it (so a bolt aimed at her
 * meets the unit's reach), else the point of the line nearest the enemy.
 */
function unitSpot(l: YarnLine, me: THREE.Vector3, en: THREE.Vector3 | undefined, out: THREE.Vector3) {
  const dx = l.x2 - l.x1, dz = l.z2 - l.z1, len2 = dx * dx + dz * dz || 1;
  let k = 0.5;
  if (en) {
    const sx = me.x - en.x, sz = me.z - en.z, den = dx * sz - dz * sx;
    const hit = Math.abs(den) > 1e-6 ? { k: ((en.x - l.x1) * sz - (en.z - l.z1) * sx) / den, s: ((en.x - l.x1) * dz - (en.z - l.z1) * dx) / den } : null;
    if (hit && hit.k >= 0 && hit.k <= 1 && hit.s >= 0 && hit.s <= 1) k = hit.k;
    else k = ((en.x - l.x1) * dx + (en.z - l.z1) * dz) / len2;
  }
  k = THREE.MathUtils.clamp(k, 0.1, 0.9);
  return out.set(l.x1 + dx * k, 0, l.z1 + dz * k);
}

/** True when the segments ab and cd cross. */
export function segCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz, den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((cx - ax) * d2z - (cz - az) * d2x) / den, u = ((cx - ax) * d1z - (cz - az) * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** What Mr. Biscuit is doing about a cut line: `seen` the newest cut it has noticed, the loose end it plays with, until when, and whether it plays now (the look reads it). */
export interface CatPlay { seen: number; x: number; z: number; until: number; playing: boolean }

/**
 * Where Mr. Biscuit walks now instead of at the enemy (`SummonOptions.goal`): the loose end of a line cut within `BISCUIT_NEAR` m
 * of it, then it stays about `BISCUIT_PLAY` s playing with it. Null: its usual run. `out` is reused.
 */
export function catGoal(b: YarnBook, st: CatPlay, pos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 | null {
  const now = performance.now();
  for (const c of b.cuts) {
    if (c.at <= st.seen) continue;
    st.seen = c.at;
    const da = Math.hypot(c.ax - pos.x, c.az - pos.z), db = Math.hypot(c.bx - pos.x, c.bz - pos.z);
    const end = da < db ? { x: c.ax, z: c.az, d: da } : { x: c.bx, z: c.bz, d: db };
    if (end.d > BISCUIT_NEAR) continue;
    st.x = end.x;
    st.z = end.z;
    st.until = now + (Math.max(0, end.d - 1) / BISCUIT_SPEED + BISCUIT_PLAY) * 1000;
  }
  if (now >= st.until) { st.playing = false; return null; }
  st.playing = Math.hypot(st.x - pos.x, st.z - pos.z) < 1.6;
  return out.set(st.x, 0, st.z);
}

const spot = new THREE.Vector3();

/**
 * Grandma Ironknit (support, ranged). Passive Keep Warm: she ties up to three yarn lines (Cast On, to the nearest cover or 9 m out).
 * An enemy who walks across one is stuck for 0.4 s, then slowed for 1 s, and the line stays until it is cut: one hit of any size
 * cuts it. She walks over her own lines. The oldest goes when a fourth is tied.
 *
 * Where each rule runs. The lines are `yarnBooks` records the spells write on BOTH screens at the cast (ids count the lines made),
 * and tie at the rise: `raiseLine` makes a bolt wall and, where `ctx.summon` exists (the screen that decides hits: the only screen
 * offline, the victim's online), a 1 HP unit. `marks` draws every line on both screens. A cut is learned where the hit is decided:
 * from the unit's death or the bolt wall's block. `victimTick` (that screen) keeps each unit on the line between the enemy and her,
 * runs the crossing test (the enemy's last place to this one against every line: stuck, then slowed, `t.hitEnemy`) and tells her
 * client of a cut with `noteOwner('cut', id)` and of a tangle with `noteOwner('tangle')`; `tick` (her client) tells the other screen
 * of a cut with `show('cut', id)`, whose `ownChanged` drops the same line. The units count toward the cap of 6 a side: 3 lines and
 * Mr. Biscuit are 4. Mr. Biscuit's hits carry a slow (`dealt`, where the hit is decided). `enemyLabel` writes the words over the
 * enemy: TANGLED and KEEP WARM (the Sweater, see `src/spells/targeted/sweater.ts`); "ooh, it suits you" is hers (`landed`).
 */
export const yarnTrait: Trait = {
  meter: { name: 'YARN', max: LINE_MAX, value: (t) => { const b = yarnBooks.get(t.self()); return b ? liveLines(b).length : 0; } },
  passive: {
    name: 'Keep Warm',
    blurb: 'Her yarn lines tie between her, pillars and walls (Cast On): three at most, the oldest goes. An enemy who walks across one is stuck 0.4 s, then slowed 1 s, and the line stays until it is cut. One hit of any size cuts it. She crosses her own freely.',
  },
  twist: {
    name: 'Where To String It',
    blurb: 'Yarn on your path, or round her for safety. A line tied to nothing, out in the open, is easy to walk round and easy to cut.',
  },
  speed: 3.8,
  attack: { kind: 'ranged', range: 5.5, damage: 9, interval: 0.9, windup: 0.25, speed: 20, look: 'dart' },
  charges: { slot: 1, count: CAST_CHARGES, every: CAST_EVERY },
  // The CPU strings a line only with the enemy 3 to 9 m away and fewer than 3 lines standing; Mr. Biscuit only within 9 m.
  aiHold(t, slot, dist) {
    if (slot === 1) {
      const b = yarnBooks.get(t.self());
      const n = b ? liveLines(b).length : 0;
      return dist < CAST_AI_MIN || dist > CAST_AI_MAX || n >= LINE_MAX;
    }
    if (slot === 3) return dist > BISCUIT_AI_MAX;
    return false;
  },
  marks(t) {
    fresh(t);
    const b = yarnBooks.get(t.self());
    if (!b || b.lines.length === 0) return [];
    const now = performance.now(), out: GroundMark[] = [];
    for (const l of b.lines) {
      if (!l.raised) continue;
      const len = Math.hypot(l.x2 - l.x1, l.z2 - l.z1), yaw = Math.atan2(l.x2 - l.x1, l.z2 - l.z1);
      const x = (l.x1 + l.x2) / 2, z = (l.z1 + l.z2) / 2;
      if (!l.gone) out.push({ x, z, kind: l.tied ? 'yarn' : 'yarnLoose', age: (now - l.bornAt) / 1000, life: 1e6, yaw, length: len });
      else if (l.cut && now - l.goneAt < SNIP_SECONDS * 1000) out.push({ x, z, kind: 'snip', age: (now - l.goneAt) / 1000, life: SNIP_SECONDS, yaw, length: len });
    }
    return out;
  },
  markLook: {
    yarn: () => yarnLook(),
    yarnLoose: () => yarnLooseLook(),
    snip: () => snipLook(),
  },
  enemyLabel(t) {
    const b = yarnBooks.get(t.self());
    if (!b) return null;
    const now = performance.now(), s = b.sweater;
    if (s && now < s.at + SWEATER_SLOW * 1000) return { text: 'KEEP WARM', color: YARN_CSS.hot };
    if (now - b.tangleAt < 1400) return { text: 'TANGLED', color: YARN_CSS.hot };
    return null;
  },
  /** Her own client: tells the other screen of a cut that was decided here (a bolt wall's block), one a frame. */
  tick(t) {
    fresh(t);
    const b = yarnBooks.get(t.self());
    if (!b || b.lines.length === 0) return;
    const l = b.lines.find((k) => k.cut && !k.told);
    if (l) { l.told = true; t.show('cut', l.id); }
  },
  /** The screen that decides hits: units follow the shot, the crossing test, a cut by a unit is told to her client. */
  victimTick(t) {
    fresh(t);
    const b = yarnBooks.get(t.self());
    const en = t.enemy(), me = t.self().group.position;
    if (!en) return;
    const p = en.group.position, had = t.mem.had === 1, lx = t.mem.lx, lz = t.mem.lz;
    t.mem.had = 1;
    t.mem.lx = p.x;
    t.mem.lz = p.z;
    if (!b || b.lines.length === 0) return;
    const step = had ? Math.hypot(p.x - lx, p.z - lz) : Infinity;
    for (const l of b.lines) {
      if (!l.raised || l.gone) continue;
      if (!l.unit && l.ctx?.summon) attachUnit(l.ctx, l);
      if (l.unit?.alive) {
        l.unit.pos.copy(unitSpot(l, me, p, spot));
        l.unit.knock.set(0, 0, 0);
      }
      // The crossing: the enemy's way since the last frame against the line. Only the enemy hero is caught.
      if (step > 1e-6 && step < CROSS_STEP && t.time - l.hitAt >= CROSS_GUARD && segCross(lx, lz, p.x, p.z, l.x1, l.z1, l.x2, l.z2)) {
        l.hitAt = t.time;
        b.tangleAt = performance.now();
        t.hitEnemy({ damage: 0, knock: 0, color: YARN_CSS.pink, status: { kind: 'root', seconds: CROSS_ROOT } });
        t.hitEnemy({ damage: 0, knock: 0, color: YARN_CSS.pink, status: { kind: 'slow', seconds: CROSS_ROOT + CROSS_SLOW } });
        t.noteOwner('tangle', 1);
      }
    }
    const c = b.lines.find((k) => k.cut && !k.told && k.unit);
    if (c) { c.told = true; t.noteOwner('cut', c.id); }
  },
  /** Mr. Biscuit's hit (the only damaging hit of slot 3; the lines' units deal 0): he sits on them, so no shove, and a slow. */
  dealt(t, hit) {
    if (!hit.victimIsHero || !(hit.damage > 0)) return;
    if (hit.kind === 'unit' || (hit.kind === 'spell' && hit.slot === 3)) {
      hit.opts.knock = 0;
      hit.opts.status = { kind: 'slow', seconds: BISCUIT_SLOW };
    }
  },
  /** Her own client: the shrink landed (the Sweater's 40), and she is pleased. */
  landed(t, hit) {
    if (hit.kind === 'spell' && hit.slot === 2 && hit.victimIsHero && hit.damage > 0) t.say('ooh, it suits you', YARN_CSS.cream);
  },
  peerNote(t, name, n) {
    const b = yarnBooks.get(t.self());
    if (!b) return;
    if (name === 'tangle') { b.tangleAt = performance.now(); return; }
    if (name !== 'cut') return;
    const l = b.lines.find((k) => k.id === n);
    if (l) { l.told = true; dropLine(l, true); }
  },
  ownChanged(t, name, n) {
    if (name !== 'cut') return;
    const l = yarnBooks.get(t.self())?.lines.find((k) => k.id === n);
    if (l) { l.told = true; dropLine(l, true); }
  },
  badge(t) {
    const b = yarnBooks.get(t.self());
    const n = b ? liveLines(b).length : 0;
    return n > 0 ? String(n) : '';
  },
};
