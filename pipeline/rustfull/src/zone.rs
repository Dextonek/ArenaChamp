//! Danger zones on the floor and the rule that a spell's hit lands only inside what was drawn. Ports of
//! `insideTelegraph` (`src/effects/telegraph.ts`) and of `grownShape`, `inCastReach` and the cast records in
//! `src/duel.ts`.

use crate::geom::V2;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Shape {
    Circle { x: f64, z: f64, radius: f64 },
    Ring { x: f64, z: f64, inner: f64, outer: f64 },
    /// `angle`: full width in degrees; `dir`: the yaw it points along (atan2(dx, dz)).
    Cone { x: f64, z: f64, radius: f64, angle: f64, dir: f64 },
    Line { x1: f64, z1: f64, x2: f64, z2: f64, width: f64 },
}

impl Shape {
    /// True when a ground point lies inside the shape.
    pub fn contains(&self, x: f64, z: f64) -> bool {
        match *self {
            Shape::Circle { x: cx, z: cz, radius } => (x - cx).hypot(z - cz) <= radius,
            Shape::Ring { x: cx, z: cz, inner, outer } => {
                let d = (x - cx).hypot(z - cz);
                d >= inner && d <= outer
            }
            Shape::Cone { x: cx, z: cz, radius, angle, dir } => {
                let (dx, dz) = (x - cx, z - cz);
                let d = dx.hypot(dz);
                if d > radius {
                    return false;
                }
                if d < 1e-6 {
                    return true;
                }
                let diff = dx.atan2(dz) - dir;
                let diff = diff.sin().atan2(diff.cos());
                diff.abs() <= angle.to_radians() / 2.0
            }
            Shape::Line { x1, z1, x2, z2, width } => {
                let (ax, az) = (x2 - x1, z2 - z1);
                let len2 = ax * ax + az * az;
                let len2 = if len2 == 0.0 { 1.0 } else { len2 };
                let t = ((x - x1) * ax + (z - z1) * az) / len2;
                if !(0.0..=1.0).contains(&t) {
                    return false;
                }
                let (px, pz) = (x1 + ax * t, z1 + az * t);
                (x - px).hypot(z - pz) <= width / 2.0
            }
        }
    }

    /// The shape made `pad` metres bigger all round (`grownShape`).
    pub fn grown(&self, pad: f64) -> Shape {
        match *self {
            Shape::Circle { x, z, radius } => Shape::Circle { x, z, radius: radius + pad },
            Shape::Ring { x, z, inner, outer } => Shape::Ring { x, z, inner: (inner - pad).max(0.0), outer: outer + pad },
            Shape::Cone { x, z, radius, angle, dir } => Shape::Cone { x, z, radius: radius + pad, angle, dir },
            Shape::Line { x1, z1, x2, z2, width } => Shape::Line { x1, z1, x2, z2, width: width + 2.0 * pad },
        }
    }
}

/// One zone of a cast (`TelegraphSpec`): times are seconds after the cast.
#[derive(Clone, Copy, Debug)]
pub struct Zone {
    pub shape: Shape,
    /// When it appears.
    pub start: f64,
    /// When the damage lands. It also roots the caster until then (2.5 s at most).
    pub impact: f64,
    /// A lingering zone keeps hurting until this time.
    pub until: Option<f64>,
}

/// A hit of a cast with no drawn shape still lands within this distance of where it aimed.
pub const DODGE_RADIUS: f64 = 1.6;
/// The duel forgets a cast after this long: no hit of it lands later.
pub const CAST_MEMORY: f64 = 4.5;

/// A cast as the duel remembers it, to judge its hits (`EnemyCast`).
#[derive(Clone, Debug)]
pub struct CastRecord {
    /// Which cast (unique per side within a round).
    pub seq: u32,
    pub slot: usize,
    /// The round clock when it was cast.
    pub t: f64,
    pub zones: Vec<Zone>,
    /// Where it aimed.
    pub aimed: V2,
    /// "DODGED" was counted for it already.
    pub dodged: bool,
}

impl CastRecord {
    /// The hit box of a cast (`inCastReach`): inside a drawn shape if it has any, so nobody takes a hit from outside what
    /// was shown. Only a cast with no drawn shape falls back on the distance from where it aimed.
    pub fn reaches(&self, p: V2, pad: f64) -> bool {
        if !self.zones.is_empty() {
            return self.zones.iter().any(|z| if pad > 0.0 { z.shape.grown(pad).contains(p.x, p.z) } else { z.shape.contains(p.x, p.z) });
        }
        p.dist(self.aimed) <= DODGE_RADIUS + pad
    }

    /// The latest moment a zone of this cast lands, in seconds after the cast (0.5 with no zone): how long the cast
    /// roots its caster, before the 2.5 s cap.
    pub fn impact(&self) -> f64 {
        if self.zones.is_empty() { 0.5 } else { self.zones.iter().map(|z| z.impact).fold(f64::MIN, f64::max) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_line_is_a_strip_between_its_ends() {
        let s = Shape::Line { x1: 0.0, z1: 0.0, x2: 0.0, z2: 10.0, width: 3.0 };
        assert!(s.contains(1.4, 5.0) && !s.contains(1.6, 5.0));
        assert!(!s.contains(0.0, 10.5) && !s.contains(0.0, -0.1));
        assert!(s.grown(0.35).contains(1.8, 5.0));
    }

    #[test]
    fn a_cone_opens_along_its_yaw() {
        // pointing along +x: yaw = atan2(1, 0)
        let s = Shape::Cone { x: 0.0, z: 0.0, radius: 5.0, angle: 90.0, dir: std::f64::consts::FRAC_PI_2 };
        assert!(s.contains(3.0, 1.0) && s.contains(3.0, -2.9));
        assert!(!s.contains(1.0, 3.0) && !s.contains(-1.0, 0.0) && !s.contains(5.1, 0.0));
    }

    #[test]
    fn a_hit_lands_inside_what_was_drawn_and_nowhere_else() {
        let cast = CastRecord { seq: 1, slot: 1, t: 0.0, zones: vec![Zone { shape: Shape::Circle { x: 0.0, z: 0.0, radius: 2.2 }, start: 0.04, impact: 0.8, until: None }], aimed: V2::new(9.0, 9.0), dodged: false };
        assert!(cast.reaches(V2::new(2.0, 0.0), 0.0) && !cast.reaches(V2::new(2.4, 0.0), 0.0));
        // where it aimed does not matter when a shape was drawn
        assert!(!cast.reaches(V2::new(9.0, 9.0), 0.0));
        let plain = CastRecord { zones: vec![], ..cast.clone() };
        assert!(plain.reaches(V2::new(9.0, 10.5), 0.0) && !plain.reaches(V2::new(9.0, 10.7), 0.0));
        assert!((cast.impact() - 0.8).abs() < 1e-12 && (plain.impact() - 0.5).abs() < 1e-12);
    }
}
