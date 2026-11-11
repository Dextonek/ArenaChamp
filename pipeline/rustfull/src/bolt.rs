//! Skillshot bolts. A port of the plain path through `ProjectileSystem.step` in `src/effects/projectile.ts`: a bolt
//! flies from the caster along a direction at a fixed speed and hits the first enemy its path touches (a swept capsule
//! on the ground plane, checked every frame); cover stops it, and it hits what it meets on the way to the cover.
//!
//! NOT ported yet, each to come with the first hero that needs it: curving bolts (`curve`), bank shots (`reflect`),
//! bouncing to the next enemy (`bounce`), splitting (`split`), walls of wind (`BoltWall`) and Wick's doors. A bolt
//! that asks for one of them makes `spawn` panic, so a missing rule is never a silent difference.

use crate::figure::Hit;
use crate::geom::{blocks_sight, first_surface, Obstacle, V2};

/// Half-width of a figure for bolt collisions (m), when it has no measured body.
pub const BODY_RADIUS: f64 = 0.5;

/// How wide a bolt's drawn line is (`boltWidth`): its own radius and a hero's body (about 0.42 m) on each side.
pub fn bolt_width(radius: f64) -> f64 {
    2.0 * (radius + 0.42)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Hero,
    Opponent,
}

impl Side {
    /// 0 for the player's side, 1 for the opponent's: the index into everything kept once per side.
    pub fn i(self) -> usize {
        self as usize
    }

    pub fn other(self) -> Side {
        if self == Side::Hero { Side::Opponent } else { Side::Hero }
    }
}

#[derive(Clone, Debug)]
pub struct BoltSpec {
    pub from: V2,
    /// Flight direction (need not be a unit vector).
    pub dir: V2,
    pub speed: f64,
    pub range: f64,
    pub radius: f64,
    /// What a hit does. `projectile` is set by the engine; `from` is where the bolt was, or where it started when the
    /// hit pulls.
    pub hit: Hit,
    /// Keeps flying after a hit; every enemy is hit once.
    pub pierce: bool,
    /// The rules that are not ported yet (see the head of this file).
    pub curve: f64,
    pub reflect: u32,
    pub bounce: u32,
    pub split: bool,
}

impl BoltSpec {
    pub fn plain(from: V2, dir: V2, speed: f64, range: f64, radius: f64, hit: Hit) -> Self {
        BoltSpec { from, dir, speed, range, radius, hit, pierce: false, curve: 0.0, reflect: 0, bounce: 0, split: false }
    }
}

#[derive(Clone, Debug)]
pub struct Bolt {
    pub id: u64,
    /// Whose it is: it can hit the other side.
    pub side: Side,
    /// The cast it came from (the side's cast number) and the spell slot, for the record and the passives.
    pub cast: u32,
    pub slot: usize,
    pub pos: V2,
    pub dir: V2,
    pub alive: bool,
    pub range_left: f64,
    pub spec: BoltSpec,
    /// Who it has hit already (victim keys the caller chooses: 0 the enemy hero, units after it).
    hit_set: Vec<usize>,
    pub hits: u32,
}

/// Something a bolt can hit this frame: a key the caller knows it by, where it stands and how wide it is.
#[derive(Clone, Copy, Debug)]
pub struct Victim {
    pub key: usize,
    pub pos: V2,
    pub body: f64,
}

/// A bolt touched a victim.
#[derive(Clone, Debug)]
pub struct Touch {
    pub bolt: u64,
    pub side: Side,
    pub cast: u32,
    pub slot: usize,
    pub victim: usize,
    pub at: V2,
    pub hit: Hit,
}

/// Closest distance from a point to the segment a-b, and the position along it (0..1) (`segmentTouch`).
fn segment_touch(a: V2, b: V2, p: V2) -> (f64, f64) {
    let (dx, dz) = (b.x - a.x, b.z - a.z);
    let l2 = dx * dx + dz * dz;
    let t = if l2 > 1e-9 { (((p.x - a.x) * dx + (p.z - a.z) * dz) / l2).clamp(0.0, 1.0) } else { 0.0 };
    (t, (p.x - (a.x + dx * t)).hypot(p.z - (a.z + dz * t)))
}

#[derive(Clone, Debug, Default)]
pub struct Bolts {
    pub live: Vec<Bolt>,
    next_id: u64,
}

impl Bolts {
    pub fn spawn(&mut self, side: Side, cast: u32, slot: usize, spec: BoltSpec) -> u64 {
        assert!(spec.curve == 0.0 && spec.reflect == 0 && spec.bounce == 0 && !spec.split, "a bolt rule that is not ported yet (see src/bolt.rs)");
        self.next_id += 1;
        let l = spec.dir.len();
        let dir = if l * l < 1e-8 { V2::new(0.0, -1.0) } else { V2::new(spec.dir.x / l, spec.dir.z / l) };
        self.live.push(Bolt { id: self.next_id, side, cast, slot, pos: spec.from, dir, alive: true, range_left: spec.range, spec, hit_set: Vec::new(), hits: 0 });
        self.next_id
    }

    pub fn clear(&mut self) {
        self.live.clear();
    }

    /// The other side's bolts in flight, as the computer player's dodge sees them.
    pub fn threats(&self, to: Side) -> Vec<crate::ai::Threat> {
        self.live.iter().filter(|b| b.alive && b.side != to).map(|b| crate::ai::Threat { id: b.id, pos: b.pos, dir: b.dir, radius: b.spec.radius, range_left: b.range_left, speed: b.spec.speed }).collect()
    }

    /// One bolt's frame: it flies on and touches what its path meets. The fight loop calls this bolt by bolt and
    /// delivers each bolt's hits before the next one flies, as the game does.
    pub fn step_one(&mut self, i: usize, dt: f64, cover: &[Obstacle], victims: &[Victim]) -> Vec<Touch> {
        let mut out = Vec::new();
        if self.live[i].alive {
            let v = victims.to_vec();
            Self::step(&mut self.live[i], dt, cover, &move |_| v.clone(), &mut out);
        }
        out
    }

    /// Drops the bolts that ended.
    pub fn sweep(&mut self) {
        self.live.retain(|b| b.alive);
    }

    /// One frame: every bolt flies on and touches what its path meets. `victims(side)` lists what a bolt of that side
    /// can hit now. Returns the touches in the order they happened; the caller delivers the hits.
    pub fn update(&mut self, dt: f64, cover: &[Obstacle], victims: &dyn Fn(Side) -> Vec<Victim>) -> Vec<Touch> {
        let mut out = Vec::new();
        let n = self.live.len();
        for i in 0..n {
            if self.live[i].alive {
                Self::step(&mut self.live[i], dt, cover, victims, &mut out);
            }
        }
        self.live.retain(|b| b.alive);
        out
    }

    fn step(p: &mut Bolt, dt: f64, cover: &[Obstacle], victims: &dyn Fn(Side) -> Vec<Victim>, out: &mut Vec<Touch>) {
        let mut dist = (p.spec.speed * dt).min(p.range_left);
        let a = p.pos;
        let mut b = V2::new(a.x + p.dir.x * dist, a.z + p.dir.z * dist);
        // Cover on the path: the bolt flies up to it and hits what it meets on the way, so a hero with its back to a
        // wall is hit before the bolt stops.
        let mut covered = false;
        if blocks_sight(a, b, cover) {
            match first_surface(a, b, cover) {
                None => {
                    p.alive = false;
                    return;
                }
                Some((t, _)) => {
                    covered = true;
                    dist *= t;
                    b = V2::new(a.x + p.dir.x * dist, a.z + p.dir.z * dist);
                }
            }
        }
        // Enemies the swept capsule touches this frame, in the order the bolt meets them. Each has the size of its model.
        let mut touched: Vec<(f64, Victim)> = victims(p.side)
            .into_iter()
            .filter(|v| !p.hit_set.contains(&v.key))
            .filter_map(|v| {
                let (t, d) = segment_touch(a, b, v.pos);
                if d <= p.spec.radius + v.body { Some((t, v)) } else { None }
            })
            .collect();
        touched.sort_by(|x, y| x.0.partial_cmp(&y.0).unwrap());
        let mut moved = dist;
        for (t, v) in touched {
            let at = V2::new(a.x + p.dir.x * dist * t, a.z + p.dir.z * dist * t);
            p.hit_set.push(v.key);
            p.hits += 1;
            let origin = if p.spec.hit.pull > 0.0 { p.spec.from } else { at };
            let mut hit = p.spec.hit;
            hit.projectile = true;
            hit.from = Some(p.spec.hit.from.unwrap_or(origin));
            out.push(Touch { bolt: p.id, side: p.side, cast: p.cast, slot: p.slot, victim: v.key, at, hit });
            if p.spec.pierce {
                continue;
            }
            // The first hit of a bolt that does not pierce ends it here.
            p.pos = at;
            moved = dist * t;
            p.range_left -= moved;
            p.alive = false;
            return;
        }
        p.pos = V2::new(a.x + p.dir.x * moved, a.z + p.dir.z * moved);
        if covered {
            p.alive = false;
            return;
        }
        p.range_left -= moved;
        if p.range_left <= 1e-4 {
            p.alive = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geom::pillar;

    fn fly(bolts: &mut Bolts, cover: &[Obstacle], victim: Option<Victim>) -> Vec<Touch> {
        let mut all = Vec::new();
        for _ in 0..120 {
            let v = victim;
            all.extend(bolts.update(1.0 / 60.0, cover, &move |_| v.into_iter().collect()));
        }
        all
    }

    #[test]
    fn a_bolt_hits_what_stands_on_its_line_and_misses_what_stepped_off() {
        let spec = || BoltSpec::plain(V2::new(0.0, 13.0), V2::new(0.0, -1.0), 22.0, 10.0, 0.3, Hit { damage: 54.0, knock: Some(1.0), ..Hit::default() });
        let mut bolts = Bolts::default();
        bolts.spawn(Side::Hero, 1, 0, spec());
        let hit = fly(&mut bolts, &[], Some(Victim { key: 0, pos: V2::new(0.7, 6.0), body: 0.5 }));
        assert_eq!(hit.len(), 1);
        assert!(hit[0].hit.projectile && (hit[0].at.z - 6.0).abs() < 0.4 && bolts.live.is_empty());
        bolts.spawn(Side::Hero, 2, 0, spec());
        // 0.85 m off the line: outside the bolt's 0.3 and the body's 0.5
        assert!(fly(&mut bolts, &[], Some(Victim { key: 0, pos: V2::new(0.85, 6.0), body: 0.5 })).is_empty());
    }

    #[test]
    fn cover_stops_a_bolt_before_what_stands_behind_it() {
        let cover = [pillar(0.0, 9.0, 0.85)];
        let mut bolts = Bolts::default();
        bolts.spawn(Side::Hero, 1, 0, BoltSpec::plain(V2::new(0.0, 13.0), V2::new(0.0, -1.0), 22.0, 10.0, 0.3, Hit::default()));
        assert!(fly(&mut bolts, &cover, Some(Victim { key: 0, pos: V2::new(0.0, 6.0), body: 0.5 })).is_empty());
        assert!(bolts.live.is_empty());
    }

    #[test]
    fn a_bolt_ends_at_its_range_and_shows_as_a_threat_meanwhile() {
        let mut bolts = Bolts::default();
        bolts.spawn(Side::Opponent, 1, 0, BoltSpec::plain(V2::new(0.0, 1.0), V2::new(0.0, 2.0), 20.0, 9.0, 0.35, Hit::default()));
        bolts.update(0.1, &[], &|_| Vec::new());
        let t = bolts.threats(Side::Hero);
        assert_eq!(t.len(), 1);
        assert!((t[0].pos.z - 3.0).abs() < 1e-9 && (t[0].range_left - 7.0).abs() < 1e-9 && bolts.threats(Side::Opponent).is_empty());
        for _ in 0..60 {
            bolts.update(1.0 / 60.0, &[], &|_| Vec::new());
        }
        assert!(bolts.live.is_empty());
    }
}
