//! The way round cover. A port of `src/nav.ts`: the cover is capsules, so the shortest way between two points runs along
//! their edges. The graph is a ring of points round each capsule, grown by a body's radius, linked wherever a body can
//! walk straight between two of them; a plan is the shortest way through it. The graph is rebuilt when the cover
//! changes (a wall falls, a spell raises one).
//!
//! In the game every walker's route is kept in a map keyed by the walker; here each walker carries its own `Route`.

use crate::figure::Ring;
use crate::geom::{seg_dist, Obstacle, V2};

/// The walker's radius (`pushOut` keeps this clearance).
const BODY: f64 = 0.5;
/// How far past the touching distance the graph's points lie.
const NODE_GAP: f64 = 0.14;
/// A path may graze cover by this much: a walker pushed out stands exactly at touching distance.
const TOUCH: f64 = 0.03;
/// `keepInside` holds a walker this far inside the ring.
const RING_MARGIN: f64 = 0.62;
/// A chased goal has to move this far before the route is planned again.
const REPLAN_MOVE: f64 = 0.6;
/// The way it is going stands unless another is this much shorter: no flipping round a pillar.
const KEEP_ROUTE: f64 = 1.0;
const REACHED: f64 = 0.2;

fn nearest_on(x: f64, z: f64, o: &Obstacle) -> V2 {
    let (sx, sz) = (o.bx - o.ax, o.bz - o.az);
    let len2 = sx * sx + sz * sz;
    let k = if len2 > 0.0 { (((x - o.ax) * sx + (z - o.az) * sz) / len2).clamp(0.0, 1.0) } else { 0.0 };
    V2::new(o.ax + sx * k, o.az + sz * k)
}

fn point_dist(x: f64, z: f64, o: &Obstacle) -> f64 {
    let c = nearest_on(x, z, o);
    (x - c.x).hypot(z - c.z)
}

fn length(from: V2, path: &[V2]) -> f64 {
    let mut sum = 0.0;
    let mut a = from;
    for b in path {
        sum += a.dist(*b);
        a = *b;
    }
    sum
}

/// Whether a body can walk straight from `a` to `b` (leaving cover it already touches is allowed).
pub fn clear(a: V2, b: V2, cover: &[Obstacle]) -> bool {
    for o in cover {
        let reach = o.r + BODY - TOUCH;
        let d = seg_dist(a.x, a.z, b.x, b.z, o.ax, o.az, o.bx, o.bz);
        if d >= reach {
            continue;
        }
        // Starting inside the touching distance: fine as long as the walk does not go deeper.
        let start = point_dist(a.x, a.z, o);
        if start >= reach || d < start - 0.01 {
            return false;
        }
    }
    true
}

/// One walker's planned way.
#[derive(Clone, Debug, Default)]
pub struct Route {
    path: Vec<V2>,
    goal: V2Opt,
    /// The order as given, before a spot in cover was moved out.
    order: V2Opt,
    version: u64,
}

type V2Opt = Option<V2>;

/// The next spot to walk to, and where the walk ends.
#[derive(Clone, Copy, Debug)]
pub struct NavStep {
    pub point: V2,
    pub goal: V2,
}

#[derive(Clone, Debug, Default)]
pub struct Navigator {
    cover: Vec<Obstacle>,
    bounds: Option<(f64, f64, f64)>,
    version: u64,
    nodes: Vec<V2>,
    links: Vec<Vec<(usize, f64)>>,
}

impl Navigator {
    /// Takes the cover as it is now; the graph is rebuilt only when it changed.
    fn sync(&mut self, cover: &[Obstacle], ring: Option<&Ring>) {
        let bounds = ring.map(|r| (r.x, r.z, r.r));
        if self.version > 0 && self.cover.as_slice() == cover && self.bounds == bounds {
            return;
        }
        self.version += 1;
        self.cover = cover.to_vec();
        self.bounds = bounds;
        self.build();
    }

    /// Free for a body: not in touching distance of cover, inside the ring.
    fn free(&self, x: f64, z: f64, pad: f64) -> bool {
        if let Some((bx, bz, br)) = self.bounds {
            if (x - bx).hypot(z - bz) > br - RING_MARGIN {
                return false;
            }
        }
        self.cover.iter().all(|o| point_dist(x, z, o) >= o.r + BODY + pad)
    }

    /// Out of the margin round cover, on the spot's own side; `None` if the spot is inside cover or no body fits there.
    fn beside_cover(&self, p: V2) -> Option<V2> {
        if self.cover.iter().any(|o| point_dist(p.x, p.z, o) < o.r) {
            return None;
        }
        let o = self.cover.iter().find(|q| point_dist(p.x, p.z, q) < q.r + BODY)?;
        let c = nearest_on(p.x, p.z, o);
        let d = (p.x - c.x).hypot(p.z - c.z);
        let out = o.r + BODY + 0.03;
        let (x, z) = (c.x + (p.x - c.x) / d * out, c.z + (p.z - c.z) / d * out);
        if self.free(x, z, 0.02) { Some(V2::new(x, z)) } else { None }
    }

    /// A spot in the margin round cover: just out of it. Else the nearest free spot on the line from the walker;
    /// failing that, round it.
    fn snap(&self, to: V2, from: V2) -> V2 {
        let mut p = to;
        if let Some((bx, bz, br)) = self.bounds {
            let (dx, dz) = (p.x - bx, p.z - bz);
            let d = dx.hypot(dz);
            let max = br - RING_MARGIN - 0.02;
            if d > max {
                p = V2::new(bx + dx / d * max, bz + dz / d * max);
            }
        }
        if let Some(b) = self.beside_cover(p) {
            return b;
        }
        let line = from.dist(p);
        let mut t = 0.1;
        while t < line {
            let (x, z) = (p.x + (from.x - p.x) / line * t, p.z + (from.z - p.z) / line * t);
            if self.free(x, z, 0.02) {
                return V2::new(x, z);
            }
            t += 0.1;
        }
        let mut r = 0.2;
        while r < 4.0 {
            for k in 0..16 {
                let a = k as f64 / 16.0 * std::f64::consts::TAU;
                let (x, z) = (p.x + a.sin() * r, p.z + a.cos() * r);
                if self.free(x, z, 0.02) {
                    return V2::new(x, z);
                }
            }
            r += 0.2;
        }
        p
    }

    fn walkable(&self, from: V2, path: &[V2]) -> bool {
        let mut a = from;
        for b in path {
            if !clear(a, *b, &self.cover) {
                return false;
            }
            a = *b;
        }
        true
    }

    fn build(&mut self) {
        let mut nodes = Vec::new();
        for o in &self.cover {
            let reach = o.r + BODY + NODE_GAP;
            let len = (o.bx - o.ax).hypot(o.bz - o.az);
            let mut add = |x: f64, z: f64| {
                if self.free(x, z, 0.05) {
                    nodes.push(V2::new(x, z));
                }
            };
            if len < 1e-4 {
                // A polygon whose edges just clear the circle.
                let n = 8;
                let r = reach / (std::f64::consts::PI / n as f64).cos();
                for k in 0..n {
                    let a = k as f64 / n as f64 * std::f64::consts::TAU;
                    add(o.ax + a.sin() * r, o.az + a.cos() * r);
                }
            } else {
                // Half a polygon round each end; the long sides need no points of their own.
                let (ux, uz) = ((o.bx - o.ax) / len, (o.bz - o.az) / len);
                let n = 4;
                let r = reach / (std::f64::consts::PI / (2.0 * n as f64)).cos();
                for (cx, cz, sign) in [(o.bx, o.bz, 1.0), (o.ax, o.az, -1.0)] {
                    for k in 0..=n {
                        let a = (k as f64 / n as f64 - 0.5) * std::f64::consts::PI;
                        let (cos, sin) = (a.cos(), a.sin());
                        add(cx + sign * (ux * cos - uz * sin) * r, cz + sign * (uz * cos + ux * sin) * r);
                    }
                }
            }
        }
        let mut links = vec![Vec::new(); nodes.len()];
        for i in 0..nodes.len() {
            for j in i + 1..nodes.len() {
                if !clear(nodes[i], nodes[j], &self.cover) {
                    continue;
                }
                let cost = nodes[i].dist(nodes[j]);
                links[i].push((j, cost));
                links[j].push((i, cost));
            }
        }
        self.nodes = nodes;
        self.links = links;
    }

    /// The shortest way from `from` to `goal` through the graph; straight at the goal if there is none.
    fn plan(&self, from: V2, goal: V2) -> Vec<V2> {
        let n = self.nodes.len();
        let end = n;
        let mut best = vec![f64::INFINITY; n + 1];
        let mut prev = vec![usize::MAX; n + 1];
        let mut done = vec![false; n + 1];
        let guess = |i: usize| if i == end { 0.0 } else { self.nodes[i].dist(goal) };
        for i in 0..n {
            if clear(from, self.nodes[i], &self.cover) {
                best[i] = from.dist(self.nodes[i]);
            }
        }
        let into_goal: Vec<f64> = (0..n).map(|i| if clear(self.nodes[i], goal, &self.cover) { self.nodes[i].dist(goal) } else { -1.0 }).collect();
        loop {
            let (mut u, mut low) = (usize::MAX, f64::INFINITY);
            for i in 0..=n {
                if !done[i] && best[i] + guess(i) < low {
                    low = best[i] + guess(i);
                    u = i;
                }
            }
            if u == usize::MAX {
                return vec![goal];
            }
            if u == end {
                break;
            }
            done[u] = true;
            for &(to, cost) in &self.links[u] {
                if best[u] + cost < best[to] {
                    best[to] = best[u] + cost;
                    prev[to] = u;
                }
            }
            if into_goal[u] >= 0.0 && best[u] + into_goal[u] < best[end] {
                best[end] = best[u] + into_goal[u];
                prev[end] = u;
            }
        }
        let mut path = vec![goal];
        let mut i = prev[end];
        while i != usize::MAX {
            path.insert(0, self.nodes[i]);
            i = prev[i];
        }
        path
    }

    /// The next spot on a walker's way from `from` to `to` (`Navigator.step`). Its route is kept, so a chase does not
    /// flip between two ways round a pillar. An order inside cover ends at its edge on the walker's side.
    pub fn step(&mut self, route: &mut Route, from: V2, to: V2, cover: &[Obstacle], ring: Option<&Ring>) -> NavStep {
        self.sync(cover, ring);
        let open = self.free(to.x, to.z, -TOUCH);
        let has = route.version == self.version && !route.path.is_empty() && route.goal.is_some();
        // Planned anew when the map or the goal changed, or when a dash or a shove put cover between the walker and its
        // next point; also when the last order lay in cover and this one is free.
        let stale = !has
            || route.order.map_or(true, |o| o.dist(to) > REPLAN_MOVE)
            || !clear(from, route.path[0], &self.cover)
            || (open && route.goal.map_or(true, |g| g.dist(to) > REPLAN_MOVE));
        let goal = if open { to } else if stale { self.snap(to, from) } else { route.goal.unwrap_or(to) };
        if clear(from, goal, &self.cover) {
            *route = Route { path: vec![goal], goal: Some(goal), order: Some(to), version: self.version };
            return NavStep { point: goal, goal };
        }
        if stale {
            let mut path = self.plan(from, goal);
            if has && route.path.len() > 1 {
                let mut kept = route.path[..route.path.len() - 1].to_vec();
                kept.push(goal);
                if self.walkable(from, &kept) && length(from, &kept) <= length(from, &path) + KEEP_ROUTE {
                    path = kept;
                }
            }
            *route = Route { path, goal: Some(goal), order: Some(to), version: self.version };
        }
        // On to the next point once this one is reached, or the next one is in straight reach.
        while route.path.len() > 1 && (from.dist(route.path[0]) < REACHED || clear(from, route.path[1], &self.cover)) {
            route.path.remove(0);
        }
        NavStep { point: route.path[0], goal: route.goal.unwrap_or(goal) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::figure::RING;
    use crate::geom::{pillar, wall};

    #[test]
    fn open_floor_is_walked_straight() {
        let mut nav = Navigator::default();
        let mut route = Route::default();
        let s = nav.step(&mut route, V2::new(0.0, 13.0), V2::new(4.0, 3.0), &[], Some(&RING));
        assert_eq!(s.point, V2::new(4.0, 3.0));
    }

    #[test]
    fn a_wall_in_the_way_is_gone_round_by_its_nearer_end() {
        let cover = [wall(-3.0, 7.0, 1.0, 7.0)];
        let mut nav = Navigator::default();
        let mut route = Route::default();
        let (from, to) = (V2::new(0.0, 11.0), V2::new(0.0, 3.0));
        assert!(!clear(from, to, &cover));
        let s = nav.step(&mut route, from, to, &cover, Some(&RING));
        // the nearer end is the one at x = 1: the first point lies beyond it, clear of the wall by a body
        assert!(s.point.x > 1.5 && (s.point.z - 7.0).abs() < 1.2, "{:?}", s.point);
        assert!(clear(from, s.point, &cover));
        assert_eq!(s.goal, to);
    }

    #[test]
    fn walking_the_route_arrives_and_never_enters_cover() {
        let cover = [pillar(0.0, 7.0, 0.85), wall(-4.0, 4.0, -1.5, 5.0), wall(1.5, 9.0, 4.0, 10.0)];
        let mut nav = Navigator::default();
        let mut route = Route::default();
        let mut at = V2::new(0.0, 13.0);
        let goal = V2::new(0.0, 1.5);
        for _ in 0..2000 {
            let s = nav.step(&mut route, at, goal, &cover, Some(&RING));
            let d = at.dist(s.point);
            if at.dist(goal) < 0.05 {
                break;
            }
            let step = (3.5_f64 / 60.0).min(d);
            at = V2::new(at.x + (s.point.x - at.x) / d * step, at.z + (s.point.z - at.z) / d * step);
            for o in &cover {
                assert!(point_dist(at.x, at.z, o) >= o.r + BODY - 0.05, "inside cover at {at:?}");
            }
        }
        assert!(at.dist(goal) < 0.1, "stopped at {at:?}");
    }
}
