import * as THREE from 'three';
import type { MinionLook } from '../effects/parts/minion';
import { TREE_HEIGHT, TIMBER_CSS, buildAxeMark, buildStump, buildTree, type TreeStage } from '../effects/parts/timber';
import type { SummonUnit } from '../effects/summon';
import { insideTelegraph, type TelegraphShape } from '../effects/telegraph';
import type { CastContext } from '../effects/targeting';
import { pillar, type Obstacle } from '../obstacles';
import type { GroundMark, Trait, TraitView } from './types';

/**
 * Hank (bruiser, melee). Passive Fresh Cut: his trees (3 at most; the oldest falls over harmlessly) grow from a sapling (30 HP, blocks
 * nothing) to a young tree at 1.2 s (120 HP, real cover, a pillar of radius 0.5) and a full tree at 2.5 s (radius 0.7). Bigger falls
 * harder: a chopped tree hits for 30, 60 or 110. A tree stays until it is chopped, torn up or broken; a stump stays 6 s.
 *
 * The trees are state that outlives every spell, so they live here, in a WeakMap keyed by his figure, and the spell effects write to
 * them at the moment they land, on both screens (`plantTree`, `removeTree`). `marks` draws them, one kind per stage ('sapling',
 * 'young-tree', 'full-tree'), so a later cast cannot cut them off, and runs `advance` every frame on both screens: it builds the
 * obstacle and the HP unit when a tree reaches its stage, from the clock `marks` writes (`timberNow`), so both screens agree and the
 * CPU's habit of restarting one effect per label cannot cut a growing tree off. Each tree keeps the cast context that planted it
 * (`tree.ctx`) to add and remove its obstacle and its unit.
 *
 * HP: a hidden 'turret' unit (damage 0, no reach, an invisible look) at the tree's spot: a 30 HP one for the sapling that times out
 * at young (it is not slain, so nothing breaks) and a 120 HP one from then on, as crystalPillar.ts does. When a unit is slain the
 * tree breaks: the obstacle goes, a stump is left, and the screen that saw it queues a note for the other (`peerNote` on his
 * client after `victimTick`'s `noteOwner`; `ownChanged` on the other screen after his client's `show('broken')`). The five trees
 * of Timber Call have no HP unit (MAX_UNITS is 6 a side, and three normal trees may stand): they are cover until they fall.
 * His axe (Caber Toss with no tree in reach) lies where it landed (`book.axe`, drawn as a mark); Q is gone until he is within 1.5 m.
 */

export const MAX_TREES = 3;
export const SAPLING_S = 1.2;
export const FULL_S = 2.5;
export const HP_SAPLING = 30;
export const HP_TREE = 120;
export const OBSTACLE_YOUNG = 0.5;
export const OBSTACLE_FULL = 0.7;
export const STUMP_S = 6;
export const AXE_REACH = 1.5;
/** A row's trees (Timber Call): young at 0.25 s and full at 0.5 s after each tree's own start; the row stands this long. */
export const ROW_YOUNG = 0.25;
export const ROW_FULL = 0.5;
export const ROW_LIFE = 8;
/** The window to swing at the row (the recast's), and its arm time. */
export const ROW_WINDOW = 4;
export const ROW_ARM = 1;
/** Falling-tree damage by stage (Q's chop) and thrown-tree damage by stage (E). */
export const CHOP_DAMAGE = [30, 60, 110] as const;
export const TOSS_DAMAGE = [30, 60, 90] as const;

export const STAGES: readonly TreeStage[] = ['sapling', 'young', 'full'];
const KINDS = ['sapling', 'young-tree', 'full-tree'] as const;

export interface Tree {
  /** 0..19, the same on both screens (trees are planted in cast order): a break note names it. */
  id: number;
  x: number;
  z: number;
  /** Round clock seconds: when it was planted (a row's later trees: in the future), and when it is young and full. */
  born: number;
  youngAt: number;
  fullAt: number;
  hp: number;
  obstacle: Obstacle | null;
  unit: SummonUnit | null;
  alive: boolean;
  /** 0 for a normal tree; else the number of the row it belongs to (it does not count toward the cap of 3). */
  row: number;
  /** A row tree is quietly gone at this clock time (the effect that owns the row fells it a little earlier). */
  until: number;
  ctx: CastContext | null;
  /** What `advance` has built: the obstacle (0 none, 1 young, 2 full) and the unit (0 none, 1 sapling's, 2 tree's). */
  built: 0 | 1 | 2;
  unitStage: 0 | 1 | 2;
}

export interface Row {
  no: number;
  /** Clock time of the cast. */
  cast: number;
  /** The direction along the row (unit). */
  dx: number;
  dz: number;
  trees: Tree[];
  /** Clock time of the swing (the recast), or -1. */
  swung: number;
}

export interface Axe { x: number; z: number; landAt: number }

interface Stump { x: number; z: number; born: number }

interface Book {
  trees: Tree[];
  stumps: Stump[];
  next: number;
  row: Row | null;
  rowNo: number;
  axe: Axe | null;
  /** Ids of trees broken on this screen, waiting to be told to the other screen (one list per way it goes). */
  noteOwner: number[];
  noteFoe: number[];
}

const books = new WeakMap<object, Book>();
const clocks = new WeakMap<object, number>();

/** The seconds a figure's trait last wrote (its round clock); in the VFX tool, where no trait runs, real time. */
export function timberNow(fig: object): number {
  return clocks.get(fig) ?? performance.now() / 1000;
}

/** True when a trait is writing this figure's clock (a duel): the effects then leave the trees to `marks`. */
export function timberLive(fig: object): boolean {
  return clocks.has(fig);
}

/** Writes the clock. A clock that went back (a new round) empties the book. */
function syncClock(fig: object, time: number) {
  const prev = clocks.get(fig);
  if (prev !== undefined && time < prev - 0.5) books.delete(fig);
  clocks.set(fig, time);
}

export function bookOf(fig: object): Book {
  let b = books.get(fig);
  if (!b) { b = { trees: [], stumps: [], next: 0, row: null, rowNo: 0, axe: null, noteOwner: [], noteFoe: [] }; books.set(fig, b); }
  return b;
}

export const stageIndex = (tr: Tree, now: number): 0 | 1 | 2 => (now >= tr.fullAt ? 2 : now >= tr.youngAt ? 1 : 0);
export const stageOf = (tr: Tree, now: number): TreeStage => STAGES[stageIndex(tr, now)];

/** Trees that stand now: planted, not yet gone. */
export const standing = (fig: object, now: number): Tree[] => bookOf(fig).trees.filter((t) => t.alive && now >= t.born);

/** The nearest standing tree within `reach` of (x, z), or null. Caber Toss rips it up; the trait's rule and the effect use the same one. */
export function reachTree(fig: object, x: number, z: number, reach: number): Tree | null {
  const now = timberNow(fig);
  let best: Tree | null = null, bd = reach;
  for (const tr of standing(fig, now)) {
    const d = Math.hypot(tr.x - x, tr.z - z);
    if (d <= bd) { bd = d; best = tr; }
  }
  return best;
}

/**
 * The trees a swing cone touches: a tree is inside when the point of its trunk nearest the caster is (its centre moved 0.5 m back toward
 * him), so a trunk the cone's edge reaches is chopped. Static positions: both screens find the same ones.
 */
export function treesInCone(fig: object, cone: Extract<TelegraphShape, { kind: 'cone' }>): Tree[] {
  const now = timberNow(fig);
  return standing(fig, now).filter((tr) => {
    const dx = tr.x - cone.x, dz = tr.z - cone.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.min(OBSTACLE_YOUNG, d) / d;
    return insideTelegraph(cone, tr.x - dx * k, tr.z - dz * k);
  });
}

/**
 * Plants a tree for `fig`. `delay`: seconds from now it starts (a row's later trees). A fourth normal tree makes the oldest fall over:
 * it is removed and returned as `evicted` (the caller draws its fall). Call it at the moment a spell lands, on both screens.
 */
export function plantTree(fig: object, x: number, z: number, ctx: CastContext | null, o: { row?: number; delay?: number; until?: number } = {}): { tree: Tree; evicted: Tree | null } {
  const b = bookOf(fig);
  const born = timberNow(fig) + (o.delay ?? 0);
  const row = o.row ?? 0;
  const tree: Tree = {
    id: b.next, x, z, born,
    youngAt: born + (row ? ROW_YOUNG : SAPLING_S),
    fullAt: born + (row ? ROW_FULL : FULL_S),
    hp: HP_SAPLING, obstacle: null, unit: null, alive: true, row, until: o.until ?? Infinity, ctx, built: 0, unitStage: 0,
  };
  b.next = (b.next + 1) % 20;
  b.trees.push(tree);
  let evicted: Tree | null = null;
  if (!row) {
    const own = b.trees.filter((t) => !t.row && t.alive);
    if (own.length > MAX_TREES) { evicted = own[0]; removeTree(fig, evicted); }
  }
  return { tree, evicted };
}

/** Takes a tree out (chopped, torn up, broken, expired, evicted): its obstacle and unit go and a stump stays. False if it was gone. */
export function removeTree(fig: object, tree: Tree): boolean {
  if (!tree.alive) return false;
  tree.alive = false;
  if (tree.obstacle) { tree.ctx?.removeObstacle?.(tree.obstacle); tree.obstacle = null; }
  if (tree.unit?.alive) tree.unit.left = 0;
  tree.unit = null;
  const b = bookOf(fig), now = timberNow(fig);
  b.trees = b.trees.filter((t) => t !== tree);
  if (now >= tree.born) {
    b.stumps.push({ x: tree.x, z: tree.z, born: now });
    while (b.stumps.length > 10) b.stumps.shift();
  }
  return true;
}

/** A tree's HP unit was slain on this screen: the tree breaks, and both notes are queued. */
function breakTree(fig: object, tree: Tree) {
  const id = tree.id;
  if (!removeTree(fig, tree)) return;
  const b = bookOf(fig);
  b.noteOwner.push(id);
  b.noteFoe.push(id);
}

/** The unit's look: nothing. The marks draw the tree; the unit gives the HP bar (over a sapling, in the crown of a tree) and a target. */
const hidden = (barY: number): MinionLook => () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY });

/**
 * Brings every tree up to date with the clock: the HP unit and the obstacle of a stage, a unit pinned on its tree, a row that is over.
 * Idempotent: `marks` calls it every frame on both screens, the VFX tool's effects call it through `ToolTrees`.
 */
export function advance(fig: object, now: number) {
  const b = books.get(fig);
  if (!b || !b.trees.length) return;
  for (const tr of b.trees.slice()) {
    if (!tr.alive) continue;
    if (tr.row && now >= tr.until + 0.5) { removeTree(fig, tr); continue; }
    if (now < tr.born) continue;
    const st = stageIndex(tr, now);
    const ctx = tr.ctx;
    if (ctx && !tr.row) {
      // The unit first, so the engine does not push it out of the obstacle; the obstacle second.
      const want = st === 0 ? 1 : 2;
      if (tr.unitStage < want) {
        if (tr.unit?.alive) tr.unit.left = 0;
        const sm = ctx.summon?.({
          kind: 'turret', at: new THREE.Vector3(tr.x, 0, tr.z), hp: want === 1 ? HP_SAPLING : HP_TREE, seconds: want === 1 ? Math.max(0.1, tr.youngAt - now + 0.05) : 600,
          damage: 0, attackEvery: 999, range: 0.01, color: TIMBER_CSS.body, look: hidden(want === 1 ? TREE_HEIGHT.sapling + 0.4 : TREE_HEIGHT.young + 0.8),
        });
        tr.unit = sm?.units[0] ?? null;
        tr.unitStage = want;
        sm?.onDeath((u) => { if (u.slain) breakTree(fig, tr); });
      }
    }
    if (tr.unit?.alive) {
      tr.unit.pos.set(tr.x, 0, tr.z);
      tr.unit.knock.set(0, 0, 0);
    }
    if (st >= 1 && ctx) {
      if (!tr.obstacle && tr.built < 1) {
        const o = pillar(tr.x, tr.z, OBSTACLE_YOUNG);
        o.height = TREE_HEIGHT.young;
        tr.obstacle = ctx.addObstacle ? ctx.addObstacle(o, tr.row ? Math.max(1, tr.until - now + 1) : 600) : null;
        tr.built = 1;
      }
      if (st === 2 && tr.obstacle && tr.built < 2) {
        tr.obstacle.r = OBSTACLE_FULL;
        tr.obstacle.height = TREE_HEIGHT.full;
        tr.built = 2;
      }
    }
  }
  b.stumps = b.stumps.filter((s) => now - s.born < STUMP_S + 1);
}

/** Starts the row record of Timber Call for `fig`: the number of the row, and the record the recast reads. */
export function startRow(fig: object, dx: number, dz: number): Row {
  const b = bookOf(fig);
  const row: Row = { no: ++b.rowNo, cast: timberNow(fig), dx, dz, trees: [], swung: -1 };
  b.row = row;
  return row;
}

/** True while the row can be swung at (the recast's window is open: from its arm time to 4 s, not yet swung, a tree left). */
export function rowOpen(fig: object, now: number): Row | null {
  const r = books.get(fig)?.row;
  if (!r || r.swung >= 0) return null;
  const a = now - r.cast;
  return a >= ROW_ARM - 0.15 && a <= ROW_WINDOW + 0.5 && r.trees.some((t) => t.alive) ? r : null;
}

/** Distance from (x, z) to the row's line (its first standing tree to its last). Infinity with no tree standing. */
function rowDistance(row: Row, x: number, z: number): number {
  const alive = row.trees.filter((t) => t.alive);
  if (!alive.length) return Infinity;
  const a = alive[0], c = alive[alive.length - 1];
  const dx = c.x - a.x, dz = c.z - a.z, l2 = dx * dx + dz * dz;
  const k = l2 > 1e-6 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
  return Math.hypot(x - (a.x + dx * k), z - (a.z + dz * k));
}

// ---------------------------------------------------------------------------------------------------------------
// The VFX tool: no trait runs there, so the effects that plant trees draw and advance them themselves
// ---------------------------------------------------------------------------------------------------------------

/** Draws a figure's trees from its book when no trait does (the tool). In a duel (`timberLive`) it hides and does nothing. */
export class ToolTrees {
  readonly group = new THREE.Group();
  private shown = new Map<Tree, { stage: number; obj: THREE.Object3D }>();

  update(fig: object) {
    if (timberLive(fig)) { this.clear(); return; }
    const now = timberNow(fig);
    advance(fig, now);
    const live = new Set<Tree>();
    for (const tr of standing(fig, now)) {
      live.add(tr);
      const st = stageIndex(tr, now);
      let s = this.shown.get(tr);
      if (!s || s.stage !== st) {
        if (s) this.group.remove(s.obj);
        s = { stage: st, obj: buildTree(STAGES[st]) };
        s.obj.position.set(tr.x, 0.02, tr.z);
        this.group.add(s.obj);
        this.shown.set(tr, s);
      }
    }
    for (const [tr, s] of this.shown) {
      if (!live.has(tr)) { this.group.remove(s.obj); this.shown.delete(tr); }
    }
  }

  clear() {
    for (const s of this.shown.values()) this.group.remove(s.obj);
    this.shown.clear();
  }
}

export const timberTrait: Trait = {
  passive: {
    name: 'Fresh Cut',
    blurb: 'His trees (3 at most, the oldest falls over) grow from a sapling (30 HP, blocks nothing) to a young tree at 1.2 s (120 HP, real cover) and a full tree at 2.5 s. Bigger trees fall harder when chopped: 30, 60 or 110. A stump stays 6 s.',
  },
  twist: {
    name: 'Grow or Chop',
    blurb: 'Let this tree grow for more damage, or chop it now? Every tree is cover now or damage later, and saplings are weak. Break them early.',
  },
  speed: 3.8,
  attack: { kind: 'melee', range: 2.5, damage: 16, interval: 1.3, windup: 0.4, speed: 0, look: 'cleave' },
  charges: { slot: 1, count: 2, every: 7 },
  recast: { slot: 3, window: ROW_WINDOW, arm: ROW_ARM, name: 'Timber', power: 1, replay: true },
  markLook: {
    sapling: () => buildTree('sapling'),
    'young-tree': () => buildTree('young'),
    'full-tree': () => buildTree('full'),
    stump: () => buildStump(),
    axe: () => buildAxeMark(AXE_REACH),
  },
  // Both screens, every frame: the trees by stage, their stumps and the axe on the ground.
  marks(t) {
    const fig = t.self();
    syncClock(fig, t.time);
    advance(fig, t.time);
    const b = books.get(fig);
    if (!b) return [];
    const out: GroundMark[] = [];
    for (const tr of b.trees) {
      if (!tr.alive || t.time < tr.born) continue;
      const st = stageIndex(tr, t.time);
      const start = st === 2 ? tr.fullAt : st === 1 ? tr.youngAt : tr.born;
      out.push({ x: tr.x, z: tr.z, kind: KINDS[st], age: t.time - start, life: 99999, yaw: tr.id * 1.7 });
    }
    for (const s of b.stumps) {
      const age = t.time - s.born;
      if (age >= 0 && age < STUMP_S) out.push({ x: s.x, z: s.z, kind: 'stump', age, life: STUMP_S, yaw: s.x * 3 });
    }
    if (b.axe && t.time >= b.axe.landAt) out.push({ x: b.axe.x, z: b.axe.z, kind: 'axe', age: t.time - b.axe.landAt, life: 99999 });
    return out;
  },
  // The CPU holds Fast Growth within 2 m of the enemy unless Q is ready, and fires the recast only with the enemy near the row.
  aiHold(t, slot, dist) {
    if (slot === 1) return dist < 2 && (t.cooldownLeft(0) > 0 || !!t.mem.noAxe);
    if (slot === 3) {
      const row = rowOpen(t.self(), t.time);
      const e = t.enemy();
      if (!row || !e) return false;
      return rowDistance(row, e.group.position.x, e.group.position.z) > 2.5;
    }
    return false;
  },
  canCast(t, slot) {
    if (slot !== 0 || !t.mem.noAxe) return null;
    const a = books.get(t.self())?.axe, p = t.self().group.position;
    if (a && Math.hypot(p.x - a.x, p.z - a.z) <= AXE_REACH) return null;
    return 'Fetch your axe';
  },
  afterCast(t, slot) {
    // Caber Toss with no tree within 3 m throws the axe: Q is gone until he walks to where it lands (the effect writes the spot).
    if (slot !== 2) return;
    const p = t.self().group.position;
    if (reachTree(t.self(), p.x, p.z, 3)) return;
    t.mem.noAxe = 1;
    t.mem.axeAt = t.time;
    t.show('axe', 1);
  },
  // His own client: the axe is picked up within 1.5 m, and a broken tree is told to the other screen.
  tick(t) {
    const fig = t.self();
    syncClock(fig, t.time);
    advance(fig, t.time);
    const b = books.get(fig);
    if (!b) return;
    if (t.mem.noAxe) {
      const a = b.axe, p = fig.group.position;
      const near = !!a && t.time >= a.landAt && Math.hypot(p.x - a.x, p.z - a.z) <= AXE_REACH;
      // The CPU does not walk to its axe: it has it back a few seconds after it lands.
      const cpu = t.side === 'opponent' && !!a && t.time >= a.landAt + 3;
      if (near || cpu || (!a && t.time - (t.mem.axeAt ?? 0) > 2)) pickUp(t);
    }
    if (b.noteOwner.length) {
      t.show('broken', 0);
      t.show('broken', b.noteOwner[b.noteOwner.length - 1] + 1);
      b.noteOwner.length = 0;
    }
  },
  ownChanged(t, name, n) {
    const b = bookOf(t.self());
    if (name === 'axe' && n === 0) b.axe = null;
    // His client says a tree of his broke: the same tree goes here.
    if (name === 'broken' && n > 0) {
      const tr = b.trees.find((x) => x.alive && x.id === n - 1);
      if (tr) removeTree(t.self(), tr);
    }
  },
  // The screen that decides the enemy's hits: a tree whose unit it saw slain is told to his own client.
  victimTick(t) {
    const fig = t.self();
    syncClock(fig, t.time);
    const b = books.get(fig);
    if (!b || !b.noteFoe.length) return;
    for (const id of b.noteFoe) t.noteOwner('broke', id);
    b.noteFoe.length = 0;
  },
  peerNote(t, name, n) {
    if (name !== 'broke') return;
    const tr = bookOf(t.self()).trees.find((x) => x.alive && x.id === n);
    if (tr) removeTree(t.self(), tr);
  },
  badge(t) {
    const n = standing(t.self(), t.time).length;
    return n > 0 ? String(n) : '';
  },
};

/** The axe is back in his hands (his own client). */
function pickUp(t: TraitView) {
  t.mem.noAxe = 0;
  const b = books.get(t.self());
  if (b) b.axe = null;
  t.show('axe', 0);
  t.say('AXE BACK', TIMBER_CSS.hot);
}
