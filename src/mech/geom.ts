/**
 * Small pure helpers for the engine pieces of the twenty new heroes (pipeline/designs/heroes20-engine.md): facing, crossing a
 * line or a circle, a strip that carries, and a footprint trail. Nothing here touches the duel; a trait or a spell calls them
 * with positions both screens have (marks from the cast, synced positions) and decides on the screen that owns the rule.
 */

export interface P { x: number; z: number }

/** The smallest angle (rad, 0..π) between yaw `yaw` (0 = toward +z) and the way from `from` to `to`. */
export function angleTo(yaw: number, from: P, to: P) {
  const a = Math.atan2(to.x - from.x, to.z - from.z) - yaw;
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
}

/**
 * Facing (Lithea's gaze): true when `at` lies within `halfDeg` degrees of where a figure at `from` with yaw `yaw` looks. A CPU
 * faces where it walks and turns to its target to cast, as a person's hero does, so walking away is facing away.
 */
export function faces(from: P, yaw: number, at: P, halfDeg: number) {
  return angleTo(yaw, from, at) <= (halfDeg * Math.PI) / 180;
}

/** Twice the signed area of a, b, c: which side of a-b the point c lies on. */
const orient = (a: P, b: P, c: P) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

/** True when the segment p0-p1 crosses the segment a-b (touching counts). A walk from p0 to p1 over a line. */
export function crosses(p0: P, p1: P, a: P, b: P) {
  const d1 = orient(a, b, p0), d2 = orient(a, b, p1);
  // Walking along the line is not crossing it.
  if (d1 === 0 && d2 === 0) return false;
  const d3 = orient(p0, p1, a), d4 = orient(p0, p1, b);
  return (d1 * d2 <= 0) && (d3 * d4 <= 0);
}

/** True when p0-p1 goes in or out through the circle (one end inside, one outside). */
export function crossesCircle(p0: P, p1: P, c: P, r: number) {
  const in0 = Math.hypot(p0.x - c.x, p0.z - c.z) < r, in1 = Math.hypot(p1.x - c.x, p1.z - c.z) < r;
  return in0 !== in1;
}

/** Distance from p to the segment a-b, and how far along it (0..1) the nearest point lies. */
export function toSegment(p: P, a: P, b: P) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
  return { d: Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)), t };
}

/**
 * A strip of ground from `a` to `b`, `width` wide, that carries whoever stands on it along a-b at `speed` m/s (Ostrel's
 * rivers). Returns this frame's step for a figure at `p`, or null off the strip. Call it on the screen that moves that figure:
 * the enemy's in `victimTick` (`t.carryEnemy`), the hero's own in `tick` (`t.carrySelf`).
 */
export function stripStep(p: P, a: P, b: P, width: number, speed: number, dt: number): P | null {
  const s = toSegment(p, a, b);
  if (s.d > width / 2 || s.t <= 0 || s.t >= 1) return null;
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: ((b.x - a.x) / L) * speed * dt, z: ((b.z - a.z) / L) * speed * dt };
}

/** One print of a trail. `gap`: the trail was cut just before it (a dash or a blink). */
export interface Print { x: number; z: number; t: number; yaw: number; gap: boolean }

/**
 * A footprint trail (Arden): the last `life` seconds of a figure's walk, one print every `every` seconds. Standing still adds
 * none; a jump longer than `gapAt` metres between two samples (a dash, a blink, a swap) leaves a gap. Each screen keeps its own
 * from the positions it has (the victim's screen the true ones), so the two may differ by the other hero's drawing lag; the
 * victim's screen decides every hit from its own.
 */
export class Trail {
  readonly prints: Print[] = [];
  private last: { x: number; z: number; t: number } | null = null;
  private cutNext = false;

  constructor(readonly every = 0.25, readonly life = 4, readonly gapAt = 1.6, readonly still = 0.15) {}

  /** Call every frame with the fight clock and the figure's position. */
  sample(t: number, x: number, z: number) {
    while (this.prints.length && t - this.prints[0].t > this.life) this.prints.shift();
    if (this.last && t - this.last.t < this.every) return;
    const prev = this.last;
    this.last = { x, z, t };
    if (!prev) return;
    const d = Math.hypot(x - prev.x, z - prev.z);
    if (d > this.gapAt) { this.cutNext = true; return; }
    if (d < this.still) return;
    this.prints.push({ x, z, t, yaw: Math.atan2(x - prev.x, z - prev.z), gap: this.cutNext });
    this.cutNext = false;
  }

  /** Cuts the trail now (a dash seen some other way). */
  cut() {
    this.cutNext = true;
  }

  clear() {
    this.prints.length = 0;
    this.last = null;
    this.cutNext = false;
  }

  /** The prints since the last gap, oldest first: what hounds can follow. */
  scent(): Print[] {
    let i = this.prints.length - 1;
    while (i > 0 && !this.prints[i].gap) i--;
    return this.prints.slice(this.prints[i]?.gap ? i : 0);
  }

  /**
   * How far (m) a straight flight from `a` to `b` runs within `reach` of the trail: Arden's arrow is stronger when at least 3 m
   * of its way follows the prints. Sampled every 0.25 m.
   */
  along(a: P, b: P, reach = 1) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.25));
    let on = 0;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
      let near = false;
      for (let j = 1; j < this.prints.length && !near; j++) {
        if (this.prints[j].gap) continue;
        near = toSegment({ x, z }, this.prints[j - 1], this.prints[j]).d <= reach;
      }
      if (near) on += L / n;
    }
    return on;
  }
}
