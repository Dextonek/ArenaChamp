//! Status effects (crowd control) and buffs on a figure. A port of `src/effects/status.ts`, rule for rule:
//!
//! - Durations are capped per kind; re-applying a kind refreshes it, it never stacks.
//! - Stuns, knock-ups, roots, charms and seals in a row count as one lock, at most `LOCK_CAP` seconds however many
//!   land. When the lock ends, `CC_IMMUNITY` seconds of immunity to all of them follow, so there is no chain-lock.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Stun,
    Root,
    Slow,
    Silence,
    Blind,
    Knockup,
    Charm,
    Sealed,
}

pub const STATUSES: [Status; 8] = [Status::Stun, Status::Root, Status::Slow, Status::Silence, Status::Blind, Status::Knockup, Status::Charm, Status::Sealed];

impl Status {
    /// Longest duration a single hit can give, in seconds.
    pub fn cap(self) -> f64 {
        match self {
            Status::Stun => 1.2,
            Status::Knockup => 0.8,
            Status::Root => 1.5,
            Status::Slow => 2.5,
            Status::Silence => 1.5,
            Status::Blind => 2.0,
            Status::Charm => 1.2,
            Status::Sealed => 1.2,
        }
    }
    fn i(self) -> usize {
        self as usize
    }
    /// The kinds that hold a figure and count toward the lock.
    fn locks(self) -> bool {
        matches!(self, Status::Stun | Status::Knockup | Status::Root | Status::Charm | Status::Sealed)
    }
}

pub const SLOW_FACTOR: f64 = 0.6;
pub const CC_IMMUNITY: f64 = 0.5;
pub const LOCK_CAP: f64 = 1.5;
/// Blind: a cast lands somewhere inside this radius round the aim point.
pub const BLIND_RADIUS: f64 = 2.5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Buff {
    Haste,
    Might,
    Armor,
    Vulnerable,
    Weaken,
    Grounded,
}

pub const BUFFS: [Buff; 6] = [Buff::Haste, Buff::Might, Buff::Armor, Buff::Vulnerable, Buff::Weaken, Buff::Grounded];
pub const BUFF_CAP: f64 = 0.5;
pub const BUFF_MAX_SECONDS: f64 = 6.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Applied {
    Applied,
    Refreshed,
    Immune,
}

#[derive(Clone, Debug, Default)]
pub struct StatusSet {
    left: [f64; 8],
    immune: f64,
    /// Seconds the running lock has held so far.
    lock_age: f64,
    buffs: [(f64, f64); 6], // amount, seconds left
}

impl StatusSet {
    /// Gives a buff or debuff: a new one of the same kind keeps the stronger amount and the longer time.
    pub fn apply_buff(&mut self, kind: Buff, amount: f64, seconds: f64) -> Applied {
        let (a, sec) = (amount.max(0.0).min(BUFF_CAP), seconds.min(BUFF_MAX_SECONDS));
        if !(a > 0.0) || !(sec > 0.0) {
            return Applied::Immune;
        }
        let b = &mut self.buffs[kind as usize];
        let was = b.1 > 0.0;
        b.0 = if was { b.0.max(a) } else { a };
        b.1 = b.1.max(sec);
        if was { Applied::Refreshed } else { Applied::Applied }
    }

    /// The amount of a running buff (0 when none).
    pub fn buff(&self, kind: Buff) -> f64 {
        let b = self.buffs[kind as usize];
        if b.1 > 0.0 { b.0 } else { 0.0 }
    }

    /// Damage this figure deals is multiplied by this (might, weaken).
    pub fn dealt_mul(&self) -> f64 {
        (1.0 + self.buff(Buff::Might)) * (1.0 - self.buff(Buff::Weaken))
    }

    /// Damage this figure takes is multiplied by this (armor, vulnerable).
    pub fn taken_mul(&self) -> f64 {
        (1.0 - self.buff(Buff::Armor)) * (1.0 + self.buff(Buff::Vulnerable))
    }

    /// Gives `kind` for `seconds` (capped). A locking status inside the immunity is refused, and one that lands during
    /// a running lock only takes that lock up to `LOCK_CAP`.
    pub fn apply(&mut self, kind: Status, seconds: f64) -> Applied {
        let mut sec = seconds.min(kind.cap());
        if !(sec > 0.0) {
            return Applied::Immune;
        }
        if kind.locks() {
            if !self.locked() && self.immune > 0.0 {
                return Applied::Immune;
            }
            if self.locked() {
                sec = sec.min(LOCK_CAP - self.lock_age);
            }
            if !(sec > 0.0) {
                return Applied::Immune;
            }
        }
        let was = self.left[kind.i()] > 0.0;
        self.left[kind.i()] = self.left[kind.i()].max(sec);
        if was { Applied::Refreshed } else { Applied::Applied }
    }

    pub fn update(&mut self, dt: f64) {
        let was_locked = self.locked();
        for l in self.left.iter_mut() {
            *l = (*l - dt).max(0.0);
        }
        for b in self.buffs.iter_mut() {
            b.1 = (b.1 - dt).max(0.0);
        }
        let locked = self.locked();
        if was_locked && locked {
            self.lock_age += dt;
        }
        if was_locked && !locked {
            self.immune = CC_IMMUNITY;
            self.lock_age = 0.0;
        } else {
            self.immune = (self.immune - dt).max(0.0);
        }
    }

    pub fn clear(&mut self) {
        *self = StatusSet::default();
    }

    pub fn remaining(&self, kind: Status) -> f64 {
        self.left[kind.i()]
    }

    pub fn has(&self, kind: Status) -> bool {
        self.left[kind.i()] > 0.0
    }

    /// Stunned, knocked up, sealed or charmed: no cast, no attack, and only a charm walks (toward the enemy).
    pub fn stunned(&self) -> bool {
        self.has(Status::Stun) || self.has(Status::Knockup) || self.has(Status::Sealed) || self.has(Status::Charm)
    }

    pub fn charmed(&self) -> bool {
        self.has(Status::Charm)
    }

    /// Sealed: nothing can hit this figure.
    pub fn sealed(&self) -> bool {
        self.has(Status::Sealed)
    }

    /// Any status that counts toward the lock cap is running.
    pub fn locked(&self) -> bool {
        self.stunned() || self.has(Status::Root)
    }

    pub fn cannot_move(&self) -> bool {
        self.stunned() || self.has(Status::Root)
    }

    pub fn cannot_cast(&self) -> bool {
        self.stunned() || self.has(Status::Silence)
    }

    pub fn blind(&self) -> bool {
        self.has(Status::Blind)
    }

    /// 0.6 while slowed, else 1; times 1 + haste.
    pub fn speed_mul(&self) -> f64 {
        (if self.has(Status::Slow) { SLOW_FACTOR } else { 1.0 }) * (1.0 + self.buff(Buff::Haste))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stun_is_capped_and_followed_by_immunity() {
        let mut s = StatusSet::default();
        assert_eq!(s.apply(Status::Stun, 5.0), Applied::Applied);
        assert!((s.remaining(Status::Stun) - 1.2).abs() < 1e-9);
        for _ in 0..73 {
            s.update(1.0 / 60.0);
        }
        assert!(!s.stunned());
        // inside the half second after the lock: refused
        assert_eq!(s.apply(Status::Root, 1.0), Applied::Immune);
        for _ in 0..31 {
            s.update(1.0 / 60.0);
        }
        assert_eq!(s.apply(Status::Root, 1.0), Applied::Applied);
    }

    #[test]
    fn locks_in_a_row_are_one_lock_of_a_second_and_a_half() {
        let mut s = StatusSet::default();
        s.apply(Status::Stun, 1.2);
        for _ in 0..60 {
            s.update(1.0 / 60.0);
        }
        // one second in: a root of 1.5 s may only take the lock to 1.5 s in all
        s.apply(Status::Root, 1.5);
        assert!((s.remaining(Status::Root) - 0.5).abs() < 0.02);
    }

    #[test]
    fn a_slow_does_not_lock_and_buffs_keep_the_stronger() {
        let mut s = StatusSet::default();
        s.apply(Status::Slow, 9.0);
        assert!(!s.locked() && (s.speed_mul() - 0.6).abs() < 1e-9);
        s.apply_buff(Buff::Might, 0.2, 3.0);
        s.apply_buff(Buff::Might, 0.9, 1.0);
        assert!((s.buff(Buff::Might) - 0.5).abs() < 1e-9);
        assert!((s.dealt_mul() - 1.5).abs() < 1e-9);
    }
}
