import * as THREE from 'three';
import { segDist, type Obstacle } from './obstacles';

/**
 * Pathfinding round the duel's cover. The obstacles are capsules, so the shortest way between two points runs along
 * their edges: the graph is a ring of points round each capsule, grown by the body's radius, linked wherever a body
 * can walk straight between two of them. A plan is the shortest way through that graph (A*). The graph is built once
 * per obstacle list and rebuilt when the list changes (a wall falls, a spell raises one).
 */

const BODY = 0.5; // the walker's radius (`pushOut` keeps this clearance)
const NODE_GAP = 0.14; // how far past the touching distance the graph's points lie
const TOUCH = 0.03; // a path may graze an obstacle by this much: a walker pushed out stands exactly at touching distance
const RING_MARGIN = 0.62; // `Arena.keepInside` holds a walker this far inside the ring
const REPLAN_MOVE = 0.6; // a chased goal has to move this far before the route is planned again
const KEEP_ROUTE = 1; // the way it is going stands unless another is this much shorter: no flipping round a pillar
const REACHED = 0.2;

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

const flat = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);

function pointDist(x: number, z: number, o: Obstacle) {
  const sx = o.bx - o.ax, sz = o.bz - o.az, len2 = sx * sx + sz * sz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * sx + (z - o.az) * sz) / len2)) : 0;
  return Math.hypot(x - (o.ax + sx * k), z - (o.az + sz * k));
}

export class Navigator {
  private obstacles: readonly Obstacle[] = [];
  private bounds: NavBounds | null = null;
  private signature = NaN;
  private version = 0;
  private nodes: Pt[] = [];
  private links: { to: number; cost: number }[][] = [];
  private routes = new WeakMap<object, Route>();

  /** Whether a body can walk straight from `a` to `b` (leaving an obstacle it already touches is allowed). */
  clear(a: Pt, b: Pt, obstacles: readonly Obstacle[] = this.obstacles) {
    for (const o of obstacles) {
      const reach = o.r + BODY - TOUCH;
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
   * a chase does not flip between two ways round a pillar. An order inside cover ends at its edge on the walker's side.
   */
  step(key: object, from: THREE.Vector3, to: THREE.Vector3, obstacles: readonly Obstacle[], bounds: NavBounds | null): NavStep {
    this.sync(obstacles, bounds);
    let route = this.routes.get(key);
    // Planned anew when the map or the goal changed, or when a dash or a shove put cover between the walker and its next point.
    const stale = !route || route.version !== this.version || flat(route.order, to) > REPLAN_MOVE || !this.clear(from, route.path[0]);
    // Someone standing pressed against cover is at touching distance, which a rounding error can put just inside: that spot
    // is free. Snapped, it would land on the walker's side of the wall, and the walker would stop there as if it had arrived.
    // Snapped only when the order changes (or lies free): the walker's own position would keep moving the spot.
    const goal = this.free(to.x, to.z, -TOUCH) ? to.clone().setY(0) : stale ? this.snap(to, from) : route!.goal;
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

  /** Free for a body: not in touching distance of cover, inside the ring. */
  private free(x: number, z: number, pad = 0) {
    if (this.bounds && Math.hypot(x - this.bounds.x, z - this.bounds.z) > this.bounds.r - RING_MARGIN) return false;
    return this.obstacles.every((o) => pointDist(x, z, o) >= o.r + BODY + pad);
  }

  /** The nearest free spot to `to` on the line from the walker; failing that, the nearest free spot round it. */
  private snap(to: THREE.Vector3, from: THREE.Vector3) {
    const p = new THREE.Vector3(to.x, 0, to.z);
    if (this.bounds) {
      const dx = p.x - this.bounds.x, dz = p.z - this.bounds.z, d = Math.hypot(dx, dz), max = this.bounds.r - RING_MARGIN - 0.02;
      if (d > max) p.set(this.bounds.x + (dx / d) * max, 0, this.bounds.z + (dz / d) * max);
    }
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
    this.links = this.nodes.map(() => []);
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        if (!this.clear(this.nodes[i], this.nodes[j])) continue;
        const cost = flat(this.nodes[i], this.nodes[j]);
        this.links[i].push({ to: j, cost });
        this.links[j].push({ to: i, cost });
      }
    }
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
      for (const l of this.links[u]) {
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
