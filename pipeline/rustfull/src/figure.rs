//! The two fighters of a duel as the game keeps them: how they walk, stay in the ring, dash, carry a shield and take a
//! hit. Ports of the relevant parts of `src/arena.ts` (`hit`, `walk`, `moveFoe`, `keepInside`, `moveFigure`,
//! `shieldFigure`, `soak`, `stepDash`, `update`) and of `damagePlayer` in `src/duel.ts`.
//!
//! THE TWO ARE NOT THE SAME, and the port keeps every difference:
//! - The player's hero stands where it stands. A push moves it at once by 0.18 m per unit of knock (8 at most), and a hit
//!   with no knock given does not push it.
//! - The opponent is an arena "foe": a home it walks, plus an offset that a push drives as a speed that dies away
//!   (`exp(-7t)`: a push of v moves it v / 7 m in all), and a hit with no knock given pushes it with 4.

use crate::geom::{push_out, steer, Obstacle, Slide, V2};
use crate::status::{Buff, Status, StatusSet};

/// The walkable ring (`RING` in `src/arenas/common.ts`).
#[derive(Clone, Copy, Debug)]
pub struct Ring {
    pub x: f64,
    pub z: f64,
    pub r: f64,
}

pub const RING: Ring = Ring { x: 0.0, z: 7.0, r: 12.0 };
pub const PLAYER_START: V2 = V2::new(0.0, 13.0);
pub const OPPONENT_START: V2 = V2::new(0.0, 1.0);

/// Moves `p` back inside the ring, `margin` from its edge, and out of the cover (`keepInside`). Confine rings (Cantor's
/// Duet) come with that hero.
pub fn keep_inside(p: &mut V2, cover: &[Obstacle], ring: &Ring, margin: f64) {
    push_out(p, cover, 0.5);
    let (dx, dz) = (p.x - ring.x, p.z - ring.z);
    let d = dx.hypot(dz);
    let r = ring.r - margin;
    if d > r {
        p.x = ring.x + dx / d * r;
        p.z = ring.z + dz / d * r;
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Shield {
    pub amount: f64,
    pub max: f64,
    pub left: f64,
}

#[derive(Clone, Copy, Debug)]
struct Dash {
    from: V2,
    to: V2,
    t: f64,
    dur: f64,
}

/// What both fighters have: statuses, a shield, a dash in progress.
#[derive(Clone, Debug, Default)]
pub struct Slot {
    pub status: StatusSet,
    pub shield: Option<Shield>,
    dash: Option<Dash>,
}

impl Slot {
    /// A shield of `amount` HP for `seconds`: casting again keeps the larger one (`shieldFigure`).
    pub fn shield_up(&mut self, amount: f64, seconds: f64) {
        if !(amount > 0.0) || !(seconds > 0.0) {
            return;
        }
        let keep = match self.shield {
            Some(s) if s.amount > amount => s.amount,
            _ => amount,
        };
        self.shield = Some(Shield { amount: keep, max: keep, left: seconds });
    }

    /// Takes up to `damage` off the shield; returns the amount absorbed. Breaks the shield at 0 (`soak`).
    pub fn soak(&mut self, damage: f64) -> f64 {
        let Some(sh) = self.shield.as_mut() else { return 0.0 };
        if !(damage > 0.0) {
            return 0.0;
        }
        let soaked = sh.amount.min(damage);
        sh.amount -= soaked;
        if sh.amount <= 0.0 {
            self.shield = None;
        }
        soaked
    }

    fn tick_shield(&mut self, dt: f64) {
        if let Some(sh) = self.shield.as_mut() {
            sh.left -= dt;
            if sh.left <= 0.0 {
                self.shield = None;
            }
        }
    }

    pub fn dashing(&self) -> bool {
        self.dash.is_some()
    }

    /// Starts a slide from `from` to `to` over `seconds`, easing out (`moveFigure`). Returns the spot it will reach.
    /// Grounded (Sefu's Judged): it goes less far.
    pub fn dash_to(&mut self, from: V2, to: V2, seconds: f64, cover: &[Obstacle], ring: &Ring) -> V2 {
        let short = self.status.buff(Buff::Grounded);
        let mut end = if short > 0.0 { V2::new(from.x + (to.x - from.x) * (1.0 - short), from.z + (to.z - from.z) * (1.0 - short)) } else { to };
        keep_inside(&mut end, cover, ring, 0.6);
        self.dash = Some(Dash { from, to: end, t: 0.0, dur: seconds.max(0.05) });
        end
    }

    /// Moves a dash on: where the figure is now, or `None` when no dash runs (`stepDash`).
    fn step_dash(&mut self, dt: f64, cover: &[Obstacle], ring: &Ring) -> Option<V2> {
        let d = self.dash.as_mut()?;
        d.t = d.dur.min(d.t + dt);
        let k = d.t / d.dur;
        let e = 1.0 - (1.0 - k).powi(3);
        let mut out = V2::new(d.from.x + (d.to.x - d.from.x) * e, d.from.z + (d.to.z - d.from.z) * e);
        keep_inside(&mut out, cover, ring, 0.6);
        if d.t >= d.dur {
            self.dash = None;
        }
        Some(out)
    }
}

/// What a hit carries (`HitOptions`). `knock: None` is "not given": the two fighters read that differently.
#[derive(Clone, Copy, Debug, Default)]
pub struct Hit {
    pub damage: f64,
    pub knock: Option<f64>,
    /// Where the push comes from (default: the other fighter).
    pub from: Option<V2>,
    /// Metres the hit drags the target toward `from`, stopping 1 m short of it (4 m at most).
    pub pull: f64,
    pub status: Option<(Status, f64)>,
    pub debuff: Option<(Buff, f64, f64)>,
    /// A skillshot's touch, or a basic attack: the zones do not judge it.
    pub projectile: bool,
    pub attack: bool,
    /// Swallowed whole by the victim's passive: nothing lands.
    pub blocked: bool,
}

/// What a hit did.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Landed {
    /// Off the HP.
    pub dealt: f64,
    /// Taken by a shield.
    pub soaked: f64,
}

/// The player's hero.
#[derive(Clone, Debug)]
pub struct Player {
    pub pos: V2,
    pub yaw: f64,
    pub hp: f64,
    pub max: f64,
    pub slot: Slot,
    slide: Slide,
}

impl Player {
    pub fn new(max: f64) -> Self {
        Player { pos: PLAYER_START, yaw: std::f64::consts::PI, hp: max, max, slot: Slot::default(), slide: Slide::default() }
    }

    /// One frame of the arena for it: statuses, a dash, the shield, in that order (`arena.update`).
    pub fn update(&mut self, dt: f64, cover: &[Obstacle], ring: &Ring) {
        self.slot.status.update(dt);
        if let Some(p) = self.slot.step_dash(dt, cover, ring) {
            self.pos = p;
        }
        self.slot.tick_shield(dt);
    }

    /// Walks by `step` and turns to face the way it goes (`arena.walk`). Nothing while it dashes. `slide`: turn along
    /// cover in the way; off for a walk on a planned route.
    pub fn walk(&mut self, step: V2, reach: f64, slide: bool, cover: &[Obstacle], ring: &Ring) {
        let len = step.len();
        if len * len < 1e-8 || self.slot.dashing() {
            return;
        }
        let mut mv = step;
        if slide {
            let dir = steer(self.pos, V2::new(step.x / len, step.z / len), cover, 0.5, reach, &mut self.slide);
            mv = V2::new(dir.x * len, dir.z * len);
        }
        self.pos.x = (self.pos.x + mv.x).clamp(-55.0, 55.0);
        self.pos.z = (self.pos.z + mv.z).clamp(-55.0, 55.0);
        keep_inside(&mut self.pos, cover, ring, 0.6);
        self.yaw = mv.x.atan2(mv.z);
    }

    /// A hit on it, after the zones have judged it (`damagePlayer`). `foe`: where the opponent stands (the push's
    /// source when the hit names none).
    pub fn take(&mut self, hit: &Hit, foe: V2, cover: &[Obstacle], ring: &Ring) -> Landed {
        if hit.blocked {
            return Landed::default();
        }
        let dmg = hit.damage.round();
        let soaked = self.slot.soak(dmg);
        let left = dmg - soaked;
        self.hp = (self.hp - left).max(0.0);
        let from = hit.from.unwrap_or(foe);
        let knock = hit.knock.unwrap_or(0.0).min(8.0);
        if knock > 0.0 {
            let (mut ax, mut az) = (self.pos.x - from.x, self.pos.z - from.z);
            if ax * ax + az * az < 1e-4 {
                ax = 0.0;
                az = 1.0;
            }
            let l = ax.hypot(az);
            self.pos.x += ax / l * knock * 0.18;
            self.pos.z += az / l * knock * 0.18;
            keep_inside(&mut self.pos, cover, ring, 0.6);
        }
        if hit.pull > 0.0 {
            let (tx, tz) = (from.x - self.pos.x, from.z - self.pos.z);
            let l = tx.hypot(tz);
            let m = hit.pull.min(4.0).min((l - 1.0).max(0.0));
            if m > 0.0 {
                self.pos.x += tx / l * m;
                self.pos.z += tz / l * m;
            }
            keep_inside(&mut self.pos, cover, ring, 0.6);
        }
        if let Some((kind, amount, seconds)) = hit.debuff {
            self.slot.status.apply_buff(kind, amount, seconds);
        }
        if let Some((kind, seconds)) = hit.status {
            self.slot.status.apply(kind, seconds);
        }
        Landed { dealt: left, soaked }
    }
}

/// The opponent: an arena foe.
#[derive(Clone, Debug)]
pub struct Opponent {
    /// Where it walks.
    pub home: V2,
    /// What pushes have added to it.
    offset: V2,
    /// The push's speed now (m/s), dying away.
    knock: V2,
    pub yaw: f64,
    pub hp: f64,
    pub max: f64,
    pub slot: Slot,
    slide: Slide,
}

impl Opponent {
    pub fn new(max: f64) -> Self {
        Opponent { home: OPPONENT_START, offset: V2::new(0.0, 0.0), knock: V2::new(0.0, 0.0), yaw: 0.0, hp: max, max, slot: Slot::default(), slide: Slide::default() }
    }

    /// Where it is: its home plus what pushes have added.
    pub fn pos(&self) -> V2 {
        V2::new(self.home.x + self.offset.x, self.home.z + self.offset.z)
    }

    /// One frame of the arena for it (`arena.update`): a dash moves its home and wipes the push; the push moves the
    /// offset and dies away; it cannot be pushed out of the ring; then statuses and the shield.
    pub fn update(&mut self, dt: f64, cover: &[Obstacle], ring: &Ring) {
        if self.hp > 0.0 {
            if let Some(p) = self.slot.step_dash(dt, cover, ring) {
                self.home = p;
                self.offset = V2::new(0.0, 0.0);
                self.knock = V2::new(0.0, 0.0);
            }
        }
        self.offset.x += self.knock.x * dt;
        self.offset.z += self.knock.z * dt;
        let decay = (-dt * 7.0).exp();
        self.knock.x *= decay;
        self.knock.z *= decay;
        let mut p = self.pos();
        keep_inside(&mut p, cover, ring, 0.6);
        self.offset = V2::new(p.x - self.home.x, p.z - self.home.z);
        if self.hp > 0.0 {
            self.slot.status.update(dt);
            self.slot.tick_shield(dt);
        }
    }

    /// Walks its home by `step` and turns to face the way it goes (`moveFoe`). `slide`: turn round cover in the way.
    pub fn walk(&mut self, step: V2, slide: bool, cover: &[Obstacle], ring: &Ring) {
        if self.hp <= 0.0 {
            return;
        }
        let len = step.len();
        let mut mv = step;
        if slide && len * len > 1e-10 {
            let dir = steer(self.home, V2::new(step.x / len, step.z / len), cover, 0.5, f64::INFINITY, &mut self.slide);
            mv = V2::new(dir.x * len, dir.z * len);
        }
        self.home.x += mv.x;
        self.home.z += mv.z;
        keep_inside(&mut self.home, cover, ring, 0.6);
        if mv.x * mv.x + mv.z * mv.z > 1e-8 {
            self.yaw = mv.x.atan2(mv.z);
        }
    }

    /// A hit on it (`arena.hit`), after the duel's filter has let it through. `player`: where the player's hero stands
    /// (the push's source when the hit names none).
    pub fn take(&mut self, hit: &Hit, player: V2) -> Landed {
        if self.hp <= 0.0 || hit.blocked {
            return Landed::default();
        }
        let dmg = hit.damage.round();
        let soaked = self.slot.soak(dmg);
        let dealt = dmg - soaked;
        self.hp = (self.hp - dealt).max(0.0);
        let from = hit.from.unwrap_or(player);
        let at = self.pos();
        let knock = hit.knock.unwrap_or(4.0);
        if knock > 0.0 {
            let (mut ax, mut az) = (at.x - from.x, at.z - from.z);
            if ax * ax + az * az < 1e-4 {
                ax = 0.0;
                az = -1.0;
            }
            let l = ax.hypot(az);
            self.knock.x += ax / l * knock;
            self.knock.z += az / l * knock;
        }
        if hit.pull > 0.0 {
            // The push dies away as exp(-7t), so a speed of v moves the figure v / 7 metres in all.
            let (tx, tz) = (from.x - at.x, from.z - at.z);
            let l = tx.hypot(tz);
            let m = hit.pull.min(4.0).min((l - 1.0).max(0.0));
            if m > 0.0 {
                self.knock.x += tx / l * m * 7.0;
                self.knock.z += tz / l * m * 7.0;
            }
        }
        if self.hp > 0.0 {
            if let Some((kind, seconds)) = hit.status {
                self.slot.status.apply(kind, seconds);
            }
            if let Some((kind, amount, seconds)) = hit.debuff {
                self.slot.status.apply_buff(kind, amount, seconds);
            }
        }
        Landed { dealt, soaked }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_push_moves_the_two_fighters_differently() {
        let hit = Hit { damage: 30.0, knock: Some(4.0), ..Hit::default() };
        let mut p = Player::new(600.0);
        p.take(&hit, OPPONENT_START, &[], &RING);
        // 4 x 0.18 m at once, straight away from the opponent
        assert!((p.pos.z - (13.0 + 0.72)).abs() < 1e-9 && p.hp == 570.0);
        let mut o = Opponent::new(600.0);
        o.take(&hit, PLAYER_START);
        for _ in 0..240 {
            o.update(1.0 / 60.0, &[], &RING);
        }
        // a speed of 4 that dies away as exp(-7t): 4 / 7 m in all
        assert!((o.pos().z - (1.0 - 4.0 / 7.0)).abs() < 0.03, "{}", o.pos().z);
    }

    #[test]
    fn a_hit_without_a_knock_pushes_the_opponent_but_not_the_player() {
        let hit = Hit { damage: 10.0, ..Hit::default() };
        let mut p = Player::new(600.0);
        p.take(&hit, OPPONENT_START, &[], &RING);
        assert_eq!(p.pos, PLAYER_START);
        let mut o = Opponent::new(600.0);
        o.take(&hit, PLAYER_START);
        o.update(0.1, &[], &RING);
        assert!(o.pos().z < 1.0);
    }

    #[test]
    fn a_shield_takes_the_damage_first_and_the_larger_one_is_kept() {
        let mut p = Player::new(600.0);
        p.slot.shield_up(40.0, 3.0);
        p.slot.shield_up(25.0, 3.0);
        let got = p.take(&Hit { damage: 55.0, ..Hit::default() }, OPPONENT_START, &[], &RING);
        assert_eq!(got, Landed { dealt: 15.0, soaked: 40.0 });
        assert!(p.slot.shield.is_none() && p.hp == 585.0);
    }

    #[test]
    fn nobody_leaves_the_ring_and_a_dash_eases_out() {
        let mut p = Player::new(600.0);
        p.walk(V2::new(0.0, 30.0), f64::INFINITY, true, &[], &RING);
        assert!((p.pos.z - (7.0 + 12.0 - 0.6)).abs() < 1e-9);
        let mut o = Opponent::new(600.0);
        let end = o.slot.dash_to(o.pos(), V2::new(6.0, 1.0), 0.3, &[], &RING);
        assert_eq!(end, V2::new(6.0, 1.0));
        o.update(0.15, &[], &RING);
        // half the time: 1 - 0.5^3 = 0.875 of the way
        assert!((o.pos().x - 5.25).abs() < 1e-9);
        o.update(0.2, &[], &RING);
        assert!((o.pos().x - 6.0).abs() < 1e-9 && !o.slot.dashing());
    }
}
