//! Cover on the floor and what it does to walking, sight and moving bodies. A port of `src/obstacles.ts`, function by
//! function and in the same order of operations: where the two disagree, this file is wrong.
//!
//! Everything is on the ground plane: `x` and `z` as in the game. An obstacle is a capsule: a segment from (ax, az) to
//! (bx, bz) with a radius; a pillar is a capsule of zero length.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct V2 {
    pub x: f64,
    pub z: f64,
}

impl V2 {
    pub const fn new(x: f64, z: f64) -> Self {
        V2 { x, z }
    }
    pub fn len(self) -> f64 {
        self.x.hypot(self.z)
    }
    pub fn dist(self, o: V2) -> f64 {
        (self.x - o.x).hypot(self.z - o.z)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Obstacle {
    pub ax: f64,
    pub az: f64,
    pub bx: f64,
    pub bz: f64,
    /// Half thickness (a wall) or radius (a pillar).
    pub r: f64,
}

pub fn pillar(x: f64, z: f64, r: f64) -> Obstacle {
    Obstacle { ax: x, az: z, bx: x, bz: z, r }
}

pub fn wall(ax: f64, az: f64, bx: f64, bz: f64) -> Obstacle {
    Obstacle { ax, az, bx, bz, r: 0.35 }
}

/// Closest point to (px, pz) on the obstacle's segment.
pub fn closest(o: &Obstacle, px: f64, pz: f64) -> V2 {
    let (dx, dz) = (o.bx - o.ax, o.bz - o.az);
    let len2 = dx * dx + dz * dz;
    let t = if len2 > 0.0 { (((px - o.ax) * dx + (pz - o.az) * dz) / len2).clamp(0.0, 1.0) } else { 0.0 };
    V2::new(o.ax + dx * t, o.az + dz * t)
}

/// True when a point on the floor is inside this obstacle.
pub fn contains(o: &Obstacle, x: f64, z: f64) -> bool {
    let c = closest(o, x, z);
    (x - c.x).hypot(z - c.z) <= o.r
}

/// The first obstacle surface on the way from a to b: how far along it (0..1) and the surface's outward normal there.
pub fn first_surface(a: V2, b: V2, obstacles: &[Obstacle]) -> Option<(f64, V2)> {
    let len = a.dist(b);
    let steps = ((len / 0.08).ceil() as usize).max(1);
    for i in 0..=steps {
        let t = i as f64 / steps as f64;
        let (x, z) = (a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        for o in obstacles {
            let c = closest(o, x, z);
            let (dx, dz) = (x - c.x, z - c.z);
            let d = dx.hypot(dz);
            if d > o.r {
                continue;
            }
            let l = if len > 0.0 { len } else { 1.0 };
            if d < 1e-5 {
                return Some((t, V2::new(-(b.x - a.x) / l, -(b.z - a.z) / l)));
            }
            return Some((t, V2::new(dx / d, dz / d)));
        }
    }
    None
}

/// Moves `p` out of every obstacle, keeping `body` clearance (0.5 for a hero).
pub fn push_out(p: &mut V2, obstacles: &[Obstacle], body: f64) {
    for _ in 0..2 {
        for o in obstacles {
            let c = closest(o, p.x, p.z);
            let (mut dx, mut dz) = (p.x - c.x, p.z - c.z);
            let d = dx.hypot(dz);
            let min = o.r + body;
            if d >= min {
                continue;
            }
            if d < 1e-5 {
                dx = 0.0;
                dz = 1.0;
            } else {
                dx /= d;
                dz /= d;
            }
            p.x = c.x + dx * min;
            p.z = c.z + dz * min;
        }
    }
}

/// How far ahead (m) a walk looks for an obstacle in its way: next to nothing, so the turn comes at contact.
const SLIDE_LOOK: f64 = 0.03;
/// Below this share of the walk left along the edge, the walker is pressing nearly straight at the obstacle.
const HEAD_ON: f64 = 0.35;
/// The least speed along an edge, as a share of the walk.
const SLIDE_SPEED: f64 = 0.6;

/// Pressing straight at an obstacle: which way round this walker goes, kept until it leaves or turns away. In the game
/// this lives in a map keyed by the walker's position object; here each walker carries its own.
#[derive(Clone, Copy, Debug, Default)]
pub struct Slide {
    held: Option<(usize, f64, f64, f64)>, // obstacle index, side, the walk's dx and dz when the side was chosen
}

/// Where a walk goes when an obstacle is in its way (`steer` in the game). `dir` is a unit vector; `reach` how far the
/// walk still goes. Returns a vector of length 1 or less: multiply it by the step.
pub fn steer(p: V2, dir: V2, obstacles: &[Obstacle], body: f64, reach: f64, mem: &mut Slide) -> V2 {
    let look = SLIDE_LOOK.min(reach);
    let (ex, ez) = (p.x + dir.x * look, p.z + dir.z * look);
    let mut hit: Option<usize> = None;
    let mut hit_d = f64::INFINITY;
    for (i, o) in obstacles.iter().enumerate() {
        let c = closest(o, p.x, p.z);
        let (nx, nz) = (c.x - p.x, c.z - p.z);
        let d = nx.hypot(nz);
        if d > o.r + body + look || d < 1e-5 || d >= hit_d {
            continue;
        }
        if (nx * dir.x + nz * dir.z) / d <= 0.05 {
            continue;
        }
        if seg_dist(p.x, p.z, ex, ez, o.ax, o.az, o.bx, o.bz) >= o.r + body - 0.01 {
            continue;
        }
        hit = Some(i);
        hit_d = d;
    }
    let Some(i) = hit else {
        mem.held = None;
        return dir;
    };
    let o = &obstacles[i];
    let c = closest(o, p.x, p.z);
    let d = (c.x - p.x).hypot(c.z - p.z);
    let (nx, nz) = ((c.x - p.x) / d, (c.z - p.z) / d);
    let into = dir.x * nx + dir.z * nz;
    let (vx, vz) = (dir.x - into * nx, dir.z - into * nz);
    let along = vx.hypot(vz);
    if along >= HEAD_ON {
        mem.held = None;
        let speed = along.max(SLIDE_SPEED) / along;
        return V2::new(vx * speed, vz * speed);
    }
    // Nearly straight at it. The edge's tangent turns with the normal, so a side stays the same way round.
    let (tx, tz) = (-nz, nx);
    let keep = matches!(mem.held, Some((j, _, mdx, mdz)) if j == i && mdx * dir.x + mdz * dir.z >= 0.9);
    if !keep {
        let lean = vx * tx + vz * tz;
        let off = (p.x - (o.ax + o.bx) / 2.0) * tx + (p.z - (o.az + o.bz) / 2.0) * tz;
        let side = if lean.abs() > 0.05 { lean.signum() } else if off < 0.0 { -1.0 } else { 1.0 };
        mem.held = Some((i, side, dir.x, dir.z));
    }
    let side = mem.held.map(|h| h.1).unwrap_or(1.0);
    V2::new(tx * side * 0.7, tz * side * 0.7)
}

/// Distance between the segments a-b and c-d.
#[allow(clippy::too_many_arguments)]
pub fn seg_dist(ax: f64, az: f64, bx: f64, bz: f64, cx: f64, cz: f64, dx: f64, dz: f64) -> f64 {
    let cross = |ox: f64, oz: f64, px: f64, pz: f64, qx: f64, qz: f64| (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
    let (d1, d2) = (cross(cx, cz, dx, dz, ax, az), cross(cx, cz, dx, dz, bx, bz));
    let (d3, d4) = (cross(ax, az, bx, bz, cx, cz), cross(ax, az, bx, bz, dx, dz));
    if ((d1 > 0.0 && d2 < 0.0) || (d1 < 0.0 && d2 > 0.0)) && ((d3 > 0.0 && d4 < 0.0) || (d3 < 0.0 && d4 > 0.0)) {
        return 0.0;
    }
    let pt = |px: f64, pz: f64, sx: f64, sz: f64, ex: f64, ez: f64| {
        let c = closest(&Obstacle { ax: sx, az: sz, bx: ex, bz: ez, r: 0.0 }, px, pz);
        (px - c.x).hypot(pz - c.z)
    };
    pt(ax, az, cx, cz, dx, dz).min(pt(bx, bz, cx, cz, dx, dz)).min(pt(cx, cz, ax, az, bx, bz)).min(pt(dx, dz, ax, az, bx, bz))
}

/// Where a moving round body first touches an obstacle (`sweepHit`).
#[derive(Clone, Copy, Debug)]
pub struct Contact {
    /// How far along from to (0..1) the body's centre is at the first touch.
    pub t: f64,
    pub point: V2,
    pub surface: V2,
    /// Unit vector from the obstacle toward the body at the touch.
    pub normal: V2,
    pub obstacle: usize,
}

pub fn sweep_hit(from: V2, to: V2, radius: f64, obstacles: &[Obstacle]) -> Option<Contact> {
    let (dx, dz) = (to.x - from.x, to.z - from.z);
    let mut best: Option<Contact> = None;
    for (i, o) in obstacles.iter().enumerate() {
        let reach = o.r + radius;
        let dist = |t: f64| {
            let (px, pz) = (from.x + dx * t, from.z + dz * t);
            let c = closest(o, px, pz);
            (px - c.x).hypot(pz - c.z)
        };
        let hit_t;
        if dist(0.0) <= reach {
            hit_t = 0.0;
        } else {
            // the distance is convex in t: find its lowest point, then the first crossing
            let (mut lo, mut hi) = (0.0f64, 1.0f64);
            for _ in 0..40 {
                let (m1, m2) = (lo + (hi - lo) / 3.0, hi - (hi - lo) / 3.0);
                if dist(m1) < dist(m2) {
                    hi = m2;
                } else {
                    lo = m1;
                }
            }
            let low = (lo + hi) / 2.0;
            if dist(low) > reach {
                continue;
            }
            lo = 0.0;
            hi = low;
            for _ in 0..40 {
                let m = (lo + hi) / 2.0;
                if dist(m) <= reach {
                    hi = m;
                } else {
                    lo = m;
                }
            }
            hit_t = hi;
        }
        if matches!(best, Some(b) if hit_t >= b.t) {
            continue;
        }
        let (px, pz) = (from.x + dx * hit_t, from.z + dz * hit_t);
        let c = closest(o, px, pz);
        let (mut nx, mut nz) = (px - c.x, pz - c.z);
        let d = nx.hypot(nz);
        if d < 1e-5 {
            nx = -dx;
            nz = -dz;
            let l = nx.hypot(nz);
            let l = if l > 0.0 { l } else { 1.0 };
            nx /= l;
            nz /= l;
        } else {
            nx /= d;
            nz /= d;
        }
        best = Some(Contact { t: hit_t, point: V2::new(px, pz), surface: c, normal: V2::new(nx, nz), obstacle: i });
    }
    best
}

/// True when an obstacle stands between `a` and `b`: no line of sight.
pub fn blocks_sight(a: V2, b: V2, obstacles: &[Obstacle]) -> bool {
    obstacles.iter().any(|o| seg_dist(a.x, a.z, b.x, b.z, o.ax, o.az, o.bx, o.bz) < o.r * 0.9)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pillar_blocks_sight_through_its_middle_only() {
        let cover = [pillar(0.0, 7.0, 0.85)];
        assert!(blocks_sight(V2::new(0.0, 13.0), V2::new(0.0, 1.0), &cover));
        assert!(!blocks_sight(V2::new(3.0, 13.0), V2::new(3.0, 1.0), &cover));
        // the rim does not block: sight is cut at 0.9 of the radius
        assert!(!blocks_sight(V2::new(0.8, 13.0), V2::new(0.8, 1.0), &cover));
    }

    #[test]
    fn a_body_is_pushed_out_to_its_clearance() {
        let cover = [pillar(0.0, 0.0, 1.0)];
        let mut p = V2::new(0.2, 0.0);
        push_out(&mut p, &cover, 0.5);
        assert!((p.x - 1.5).abs() < 1e-9 && p.z.abs() < 1e-9);
    }

    #[test]
    fn a_sweep_finds_the_first_touch() {
        let cover = [wall(-2.0, 5.0, 2.0, 5.0)];
        let hit = sweep_hit(V2::new(0.0, 0.0), V2::new(0.0, 10.0), 0.5, &cover).unwrap();
        assert!((hit.point.z - (5.0 - 0.35 - 0.5)).abs() < 1e-6);
        assert!(hit.normal.z < -0.99);
    }

    #[test]
    fn a_walk_straight_at_a_pillar_goes_round_and_keeps_its_side() {
        let cover = [pillar(0.0, 5.0, 1.0)];
        let mut mem = Slide::default();
        let p = V2::new(0.0, 3.52);
        let a = steer(p, V2::new(0.0, 1.0), &cover, 0.5, f64::INFINITY, &mut mem);
        let b = steer(p, V2::new(0.0, 1.0), &cover, 0.5, f64::INFINITY, &mut mem);
        assert!((a.len() - 0.7).abs() < 1e-9 && a.z.abs() < 1e-6);
        assert_eq!(a, b);
    }
}
