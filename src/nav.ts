import * as THREE from 'three';
import { hyp, segDist, type Obstacle } from './obstacles';

/**
 * Pathfinding round the duel's cover. The obstacles are capsules, so the shortest way between two points runs along
 * their edges: the graph is a ring of points round each capsule, grown by the body's radius, linked wherever a body
 * can walk straight between two of them. A plan is the shortest way through that graph (A*). The graph's points are set once
 * per obstacle list and again when the list changes (a wall falls, a spell raises one); its links are found as plans need them.
 */

const BODY = 0.5; // the walker's radius (`pushOut` keeps this clearance)
const NODE_GAP = 0.14; // how far past the touching distance the graph's points lie
const TOUCH = 0.03; // a path may graze an obstacle by this much: a walker pushed out stands exactly at touching distance
const RING_MARGIN = 0.62; // `Arena.keepInside` holds a walker this far inside the ring
const REPLAN_MOVE = 0.6; // a chased goal has to move this far before the route is planned again
const KEEP_ROUTE = 1; // the way it is going stands unless another is this much shorter: no flipping round a pillar
const REACHED = 0.2;
const CELL = 1; // a room with walls of its own: the size of a square of its map of what can be reached (m)

export interface NavBounds {
  x: number;
  z: number;
  r: number;
}

/** The next spot to walk to, and where the walk ends (the order, or the nearest free spot if it lies in cover). */
export interface NavStep {
  point: THREE.Vector3;
  goal: THREE.Vector3;
}

interface Route {
  path: THREE.Vector3[];
  goal: THREE.Vector3;
  /** The order as given, before a spot in cover was moved out. */
  order: THREE.Vector3;
  version: number;
}

interface Pt {
  x: number;
  z: number;
}

const flat = (a: Pt, b: Pt) => hyp(a.x - b.x, a.z - b.z);

function nearestOn(x: number, z: number, o: Obstacle): Pt {
  const sx = o.bx - o.ax, sz = o.bz - o.az, len2 = sx * sx + sz * sz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * sx + (z - o.az) * sz) / len2)) : 0;
  return { x: o.ax + sx * k, z: o.az + sz * k };
}

/** The distance to the obstacle's segment: `nearestOn`'s sums without its object (this runs for every cell of a route's chart). */
function pointDist(x: number, z: number, o: Obstacle) {
  const sx = o.bx - o.ax, sz = o.bz - o.az, len2 = sx * sx + sz * sz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * sx + (z - o.az) * sz) / len2)) : 0;
  return hyp(x - (o.ax + sx * k), z - (o.az + sz * k));
}

export class Navigator {
  private obstacles: readonly Obstacle[] = [];
  private bounds: NavBounds | null = null;
  private signature = NaN;
  private version = 0;
  private nodes: Pt[] = [];
  /** Each point's ways on to the others: found when a plan first comes to that point (`linksOf`), and kept until the map changes. */
  private links: ({ to: number; cost: number }[] | null)[] = [];
  private routes = new WeakMap<object, Route>();
  /**
   * A room with walls of its own (`Obstacle.fixed`: the Hall of Noon) has floor inside its ring that nobody can reach, the stone it is cut
   * from. Each free square of the floor, numbered by the part it belongs to (-1: not free). An order into another part than the
   * walker's ends at the nearest spot of the walker's own: a plan to a spot that can't be reached searches the whole map.
   */
  private parts: { x0: number; z0: number; n: number; id: Int16Array } | null = null;
  private chartSig = NaN;
  private moved = new WeakMap<object, { x: number; z: number; version: number; to: THREE.Vector3 }>();

  /** Whether a body can walk straight from `a` to `b` (leaving an obstacle it already touches is allowed). */
  clear(a: Pt, b: Pt, obstacles: readonly Obstacle[] = this.obstacles) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    for (const o of obstacles) {
      const reach = o.r + BODY - TOUCH;
      // Cover whose box the walk's box doesn't come near is out of reach: most of it, in a room with much cover (a boss's hall).
      if (x1 < Math.min(o.ax, o.bx) - reach || x0 > Math.max(o.ax, o.bx) + reach || z1 < Math.min(o.az, o.bz) - reach || z0 > Math.max(o.az, o.bz) + reach) continue;
      const d = segDist(a.x, a.z, b.x, b.z, o.ax, o.az, o.bx, o.bz);
      if (d >= reach) continue;
      // Starting inside the touching distance: fine as long as the walk does not go deeper.
      const start = pointDist(a.x, a.z, o);
      if (start >= reach || d < start - 0.01) return false;
    }
    return true;
  }

  /**
   * The next spot on `key`'s walk from `from` to `to`. `key` is whoever walks (a figure, a unit): its route is kept, so
   * a chase does not flip between two ways round a pillar. An order inside cover ends at its edge on the walker's side; one
   * close enough to cover that a body does not fit, on open ground, ends at the nearest spot on its own side of the cover.
   */
  step(key: object, from: THREE.Vector3, to: THREE.Vector3, obstacles: readonly Obstacle[], bounds: NavBounds | null): NavStep {
    this.sync(obstacles, bounds);
    to = this.within(key, from, to);
    let route = this.routes.get(key);
    const open = this.free(to.x, to.z, -TOUCH);
    // Planned anew when the map or the goal changed, or when a dash or a shove put cover between the walker and its next point.
    // Also when the last order lay in cover: it ended on the walker's side, and a free spot close to that order can be across
    // the cover, where the old goal does not lead. The walker would stand on it as if it had arrived.
    const stale = !route || route.version !== this.version || flat(route.order, to) > REPLAN_MOVE || !this.clear(from, route.path[0]) || (open && flat(route.goal, to) > REPLAN_MOVE);
    // Someone standing pressed against cover is at touching distance, which a rounding error can put just inside: that spot
    // is free. Snapped, it would land on the walker's side of the wall, and the walker would stop there as if it had arrived.
    // Snapped only when the order changes (or lies free): the walker's own position would keep moving the spot.
    const goal = open ? to.clone().setY(0) : stale ? this.snap(to, from) : route!.goal;
    if (this.clear(from, goal)) {
      this.routes.set(key, { path: [goal], goal, order: to.clone(), version: this.version });
      return { point: goal, goal };
    }
    if (stale) {
      let path = this.plan(from, goal);
      if (route && route.version === this.version && route.path.length > 1) {
        const kept = [...route.path.slice(0, -1), goal];
        if (this.walkable(from, kept) && length(from, kept) <= length(from, path) + KEEP_ROUTE) path = kept;
      }
      route = { path, goal, order: to.clone(), version: this.version };
      this.routes.set(key, route);
    }
    const path = route!.path;
    // On to the next point once this one is reached, or the next one is in straight reach.
    while (path.length > 1 && (flat(from, path[0]) < REACHED || this.clear(from, path[1]))) path.shift();
    return { point: path[0], goal: route!.goal };
  }

  /** Forgets `key`'s route (its order ended). */
  forget(key: object) {
    this.routes.delete(key);
  }

  private sync(obstacles: readonly Obstacle[], bounds: NavBounds | null) {
    // The list is edited in place (walls fall, spells raise some), so it is compared by value.
    let sig = obstacles.length + (bounds?.r ?? 0);
    for (const o of obstacles) sig = (sig * 31 + o.ax * 7 + o.az * 11 + o.bx * 13 + o.bz * 17 + o.r * 19) % 1000003;
    if (sig === this.signature) return;
    this.signature = sig;
    this.version++;
    this.obstacles = obstacles;
    this.bounds = bounds;
    this.build();
  }

  /** Which part of the floor (x, z) lies in, or -1 (cover, or outside the map). */
  private partAt(x: number, z: number) {
    const m = this.parts;
    if (!m) return -1;
    const i = Math.floor((x - m.x0) / CELL), j = Math.floor((z - m.z0) / CELL);
    return i < 0 || j < 0 || i >= m.n || j >= m.n ? -1 : m.id[j * m.n + i];
  }

  /**
   * `to`, or the nearest spot to it in the part of the floor the walker stands in, when the room's own walls part them (or `to` lies
   * in such a wall). An order inside the walker's own part is left as it is, cover and all.
   */
  private within(key: object, from: THREE.Vector3, to: THREE.Vector3) {
    const m = this.parts;
    if (!m) return to;
    let mine = this.partAt(from.x, from.z);
    // Pressed against cover, its own square is not free: the one beside it is.
    for (let k = 0; mine < 0 && k < 8; k++) mine = this.partAt(from.x + Math.sin((k / 8) * Math.PI * 2) * CELL, from.z + Math.cos((k / 8) * Math.PI * 2) * CELL);
    if (mine < 0 || this.partAt(to.x, to.z) === mine) return to;
    // The same order as last frame: the same answer.
    const last = this.moved.get(key);
    if (last && last.version === this.version && last.x === to.x && last.z === to.z) return last.to;
    let best = -1, bd = Infinity;
    for (let c = 0; c < m.id.length; c++) {
      if (m.id[c] !== mine) continue;
      const d = (m.x0 + ((c % m.n) + 0.5) * CELL - to.x) ** 2 + (m.z0 + (Math.floor(c / m.n) + 0.5) * CELL - to.z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    const out = best < 0 ? to : new THREE.Vector3(m.x0 + ((best % m.n) + 0.5) * CELL, 0, m.z0 + (Math.floor(best / m.n) + 0.5) * CELL);
    this.moved.set(key, { x: to.x, z: to.z, version: this.version, to: out });
    return out;
  }

  /**
   * The room's floor in squares, each numbered by the part it can be reached in (see `parts`). Only the room's own walls part it: they
   * never change, so it is drawn once a room, not each time a stone falls or a screen breaks.
   */
  private chart() {
    const b = this.bounds, walls = this.obstacles.filter((o) => o.fixed);
    if (!b || !walls.length) {
      this.chartSig = NaN;
      return null;
    }
    let sig = walls.length + b.x * 3 + b.z * 5 + b.r * 7;
    for (const o of walls) sig = (sig * 31 + o.ax * 7 + o.az * 11 + o.bx * 13 + o.bz * 17 + o.r * 19) % 1000003;
    if (sig === this.chartSig) return this.parts;
    this.chartSig = sig;
    const n = Math.ceil((b.r * 2) / CELL), x0 = b.x - b.r, z0 = b.z - b.r;
    // -2: free and not numbered yet.
    const id = new Int16Array(n * n).fill(-1);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
        if (Math.hypot(x - b.x, z - b.z) <= b.r - RING_MARGIN && walls.every((o) => pointDist(x, z, o) >= o.r + BODY)) id[j * n + i] = -2;
      }
    }
    let next = 0;
    const stack: number[] = [];
    for (let c = 0; c < id.length; c++) {
      if (id[c] !== -2) continue;
      id[c] = next;
      stack.push(c);
      while (stack.length) {
        const u = stack.pop()!, i = u % n;
        for (const v of [i > 0 ? u - 1 : -1, i < n - 1 ? u + 1 : -1, u - n, u + n]) {
          if (v < 0 || v >= id.length || id[v] !== -2) continue;
          id[v] = next;
          stack.push(v);
        }
      }
      next++;
    }
    return { x0, z0, n, id };
  }

  /** Free for a body: not in touching distance of cover, inside the ring. */
  private free(x: number, z: number, pad = 0) {
    if (this.bounds && Math.hypot(x - this.bounds.x, z - this.bounds.z) > this.bounds.r - RING_MARGIN) return false;
    for (const o of this.obstacles) if (!(pointDist(x, z, o) >= o.r + BODY + pad)) return false;
    return true;
  }

  /** Out of the margin round cover, on the spot's own side; null if the spot is inside cover or no body fits there either. */
  private besideCover(p: Pt) {
    if (this.obstacles.some((o) => pointDist(p.x, p.z, o) < o.r)) return null;
    const o = this.obstacles.find((q) => pointDist(p.x, p.z, q) < q.r + BODY);
    if (!o) return null;
    const c = nearestOn(p.x, p.z, o), d = Math.hypot(p.x - c.x, p.z - c.z), out = o.r + BODY + 0.03;
    const x = c.x + ((p.x - c.x) / d) * out, z = c.z + ((p.z - c.z) / d) * out;
    return this.free(x, z, 0.02) ? new THREE.Vector3(x, 0, z) : null;
  }

  /** A spot in the margin round cover: just out of it. Else the nearest free spot on the line from the walker; failing that, round it. */
  private snap(to: THREE.Vector3, from: THREE.Vector3) {
    const p = new THREE.Vector3(to.x, 0, to.z);
    if (this.bounds) {
      const dx = p.x - this.bounds.x, dz = p.z - this.bounds.z, d = Math.hypot(dx, dz), max = this.bounds.r - RING_MARGIN - 0.02;
      if (d > max) p.set(this.bounds.x + (dx / d) * max, 0, this.bounds.z + (dz / d) * max);
    }
    const beside = this.besideCover(p);
    if (beside) return beside;
    const line = flat(from, p);
    for (let t = 0.1; t < line; t += 0.1) {
      const x = p.x + ((from.x - p.x) / line) * t, z = p.z + ((from.z - p.z) / line) * t;
      if (this.free(x, z, 0.02)) return new THREE.Vector3(x, 0, z);
    }
    for (let r = 0.2; r < 4; r += 0.2) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        if (this.free(x, z, 0.02)) return new THREE.Vector3(x, 0, z);
      }
    }
    return p;
  }

  private walkable(from: Pt, path: readonly Pt[]) {
    let a = from;
    for (const b of path) {
      if (!this.clear(a, b)) return false;
      a = b;
    }
    return true;
  }

  private build() {
    this.nodes = [];
    for (const o of this.obstacles) {
      const reach = o.r + BODY + NODE_GAP;
      const add = (x: number, z: number) => {
        if (this.free(x, z, 0.05)) this.nodes.push({ x, z });
      };
      const len = Math.hypot(o.bx - o.ax, o.bz - o.az);
      if (len < 1e-4) {
        // A polygon whose edges just clear the circle.
        const n = 8, r = reach / Math.cos(Math.PI / n);
        for (let k = 0; k < n; k++) add(o.ax + Math.sin((k / n) * Math.PI * 2) * r, o.az + Math.cos((k / n) * Math.PI * 2) * r);
      } else {
        // Half a polygon round each end; the long sides need no points of their own.
        const ux = (o.bx - o.ax) / len, uz = (o.bz - o.az) / len;
        const n = 4, r = reach / Math.cos(Math.PI / (2 * n));
        for (const [cx, cz, sign] of [[o.bx, o.bz, 1], [o.ax, o.az, -1]] as const) {
          for (let k = 0; k <= n; k++) {
            const a = (k / n - 0.5) * Math.PI, cos = Math.cos(a), sin = Math.sin(a);
            add(cx + sign * (ux * cos - uz * sin) * r, cz + sign * (uz * cos + ux * sin) * r);
          }
        }
      }
    }
    this.links = this.nodes.map(() => null);
    this.parts = this.chart();
  }

  /**
   * Where a body can walk straight to from point `i`. Not worked out for the whole map at once: with the Hall of Noon's 86 pieces of
   * cover that took two seconds every time a stone fell, and a plan only ever comes to a few of the points.
   */
  private linksOf(i: number) {
    let list = this.links[i];
    if (list) return list;
    list = this.links[i] = [];
    const a = this.nodes[i];
    for (let j = 0; j < this.nodes.length; j++) {
      if (j === i) continue;
      const b = this.nodes[j];
      // Always from the lower point to the higher, so both ends of a link agree.
      if (i < j ? this.clear(a, b) : this.clear(b, a)) list.push({ to: j, cost: flat(a, b) });
    }
    return list;
  }

  /** The shortest way from `from` to `goal` through the graph; straight at the goal if there is none. */
  private plan(from: THREE.Vector3, goal: THREE.Vector3) {
    const n = this.nodes.length, END = n;
    const best = new Float64Array(n + 1).fill(Infinity), prev = new Int32Array(n + 1).fill(-1), done = new Uint8Array(n + 1);
    const guess = (i: number) => (i === END ? 0 : flat(this.nodes[i], goal));
    for (let i = 0; i < n; i++) {
      if (this.clear(from, this.nodes[i])) best[i] = flat(from, this.nodes[i]);
    }
    const intoGoal = new Float64Array(n).fill(-1);
    for (let i = 0; i < n; i++) if (this.clear(this.nodes[i], goal)) intoGoal[i] = flat(this.nodes[i], goal);
    for (;;) {
      let u = -1, low = Infinity;
      for (let i = 0; i <= n; i++) {
        if (!done[i] && best[i] + guess(i) < low) { low = best[i] + guess(i); u = i; }
      }
      if (u < 0) return [goal];
      if (u === END) break;
      done[u] = 1;
      for (const l of this.linksOf(u)) {
        if (best[u] + l.cost < best[l.to]) { best[l.to] = best[u] + l.cost; prev[l.to] = u; }
      }
      if (intoGoal[u] >= 0 && best[u] + intoGoal[u] < best[END]) { best[END] = best[u] + intoGoal[u]; prev[END] = u; }
    }
    const path = [goal];
    for (let i = prev[END]; i >= 0; i = prev[i]) path.unshift(new THREE.Vector3(this.nodes[i].x, 0, this.nodes[i].z));
    return path;
  }
}

function length(from: Pt, path: readonly Pt[]) {
  let sum = 0, a = from;
  for (const b of path) {
    sum += flat(a, b);
    a = b;
  }
  return sum;
}
