//! One figure's basic attack: the cooldown, the wind-up of the current attack, and its release (a melee hit at once, or
//! a homing bolt that lands when it arrives). A port of `Attacker` in `src/attacks/attacker.ts`.
//!
//! In the game the attacker reaches into the arena for positions, sight and statuses and calls back to land a hit. Here
//! the caller hands those in (`Sight`) and gets back what happened (`Fired`), so the same code serves both sides.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AttackSpec {
    pub melee: bool,
    /// Reach, centre to centre (m).
    pub range: f64,
    pub damage: f64,
    /// Seconds from one attack to the next (wind-up included).
    pub interval: f64,
    /// Seconds from the start of the attack to the hit (melee) or the bolt's release (ranged); moving cancels it.
    pub windup: f64,
    /// Bolt speed (m/s), ranged only.
    pub speed: f64,
}

/// The game's defaults (`MELEE_ATTACK`, `RANGED_ATTACK`); a hero's own changes come from its sheet.
pub const MELEE_ATTACK: AttackSpec = AttackSpec { melee: true, range: 2.6, damage: 13.0, interval: 1.2, windup: 0.3, speed: 0.0 };
pub const RANGED_ATTACK: AttackSpec = AttackSpec { melee: false, range: 6.5, damage: 10.0, interval: 1.0, windup: 0.25, speed: 18.0 };

/// Seconds from an attack's release to its echo's second hit.
pub const ECHO_DELAY: f64 = 0.12;
/// How far past its range a wind-up survives the target walking away (m).
const LEASH: f64 = 0.8;

/// What the attacker needs to know this frame.
#[derive(Clone, Copy, Debug)]
pub struct Sight {
    /// Metres to the target, centre to centre; `None` when the target is gone.
    pub dist: Option<f64>,
    /// Nothing stands between them.
    pub clear: bool,
    /// The attacker is stunned (or knocked up, sealed, charmed).
    pub stunned: bool,
    /// The attacker is blind: what it releases misses.
    pub blind: bool,
    /// Metres added to the spec's range now (a trait's `attackReach`).
    pub reach: f64,
}

/// An attack that went out this frame.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Fired {
    pub damage: f64,
    /// Knockback speed away from the attacker.
    pub knock: f64,
    /// 0 for the attack itself, the share (0..1) for the second hit of an echo.
    pub echo: f64,
    /// A blind attacker's attack: it goes out and misses.
    pub miss: bool,
    /// Ranged: the bolt's speed (it lands when it has flown to the target). Melee: 0, it lands at once.
    pub bolt_speed: f64,
}

#[derive(Clone, Debug)]
pub struct Attacker {
    cd: f64,
    wind: f64,
    echo_t: f64,
    echo_share: f64,
}

impl Default for Attacker {
    fn default() -> Self {
        Attacker { cd: 0.0, wind: -1.0, echo_t: -1.0, echo_share: 0.0 }
    }
}

impl Attacker {
    /// In the middle of a wind-up (the figure stands and faces the target).
    pub fn winding(&self) -> bool {
        self.wind >= 0.0
    }

    /// The attack is ready at once: its interval restarts now (a wind-up already running goes on).
    pub fn ready(&mut self) {
        self.cd = 0.0;
    }

    /// Close enough to attack, with line of sight: no attack, melee or ranged, goes through cover.
    pub fn in_range(&self, spec: &AttackSpec, s: &Sight) -> bool {
        matches!(s.dist, Some(d) if d <= spec.range + s.reach.max(0.0)) && s.clear
    }

    /// Starts an attack if the last one has recovered. Returns true when a wind-up began.
    pub fn start(&mut self, spec: &AttackSpec, stunned: bool) -> bool {
        if self.wind >= 0.0 || self.cd > 0.0 || stunned {
            return false;
        }
        self.wind = spec.windup;
        true
    }

    /// Drops the current wind-up (no hit); the cooldown stays as it was.
    pub fn cancel(&mut self) {
        self.wind = -1.0;
    }

    /// Forgets everything (a new round).
    pub fn reset(&mut self) {
        *self = Attacker::default();
    }

    /// One frame. `echo` is asked once, when an attack is released: the share (0 = none) of a second hit that follows
    /// `ECHO_DELAY` later. Returns what went out this frame: at most the echo of an earlier attack and one new attack.
    pub fn update(&mut self, dt: f64, spec: &AttackSpec, s: &Sight, echo: impl FnOnce() -> f64) -> [Option<Fired>; 2] {
        let mut out = [None, None];
        self.cd = (self.cd - dt).max(0.0);
        if self.echo_t >= 0.0 {
            self.echo_t -= dt;
            if self.echo_t <= 0.0 {
                self.echo_t = -1.0;
                // dropped when the target is gone or behind cover, or the attacker stunned
                if s.dist.is_some() && !s.stunned && s.clear {
                    out[0] = Some(self.fire(spec, s.blind, self.echo_share));
                }
            }
        }
        if self.wind < 0.0 {
            return out;
        }
        // Cover between them drops it too: no swing lands through a wall.
        let gone = match s.dist {
            None => true,
            Some(d) => s.stunned || d > spec.range + s.reach.max(0.0) + LEASH || !s.clear,
        };
        if gone {
            self.wind = -1.0;
            return out;
        }
        self.wind -= dt;
        if self.wind > 0.0 {
            return out;
        }
        self.wind = -1.0;
        self.cd = (spec.interval - spec.windup).max(0.0);
        out[1] = Some(self.fire(spec, s.blind, 0.0));
        let share = echo();
        if share > 0.0 {
            self.echo_t = ECHO_DELAY;
            self.echo_share = share.min(1.0);
        }
        out
    }

    fn fire(&self, spec: &AttackSpec, blind: bool, echo: f64) -> Fired {
        let share = if echo > 0.0 { echo } else { 1.0 };
        Fired { damage: spec.damage * share, knock: if spec.melee { 0.8 } else { 0.3 }, echo, miss: blind, bolt_speed: if spec.melee { 0.0 } else { spec.speed } }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NEAR: Sight = Sight { dist: Some(2.0), clear: true, stunned: false, blind: false, reach: 0.0 };

    #[test]
    fn a_melee_attack_lands_after_its_wind_up_and_then_recovers() {
        let mut a = Attacker::default();
        assert!(a.start(&MELEE_ATTACK, false));
        let mut hits = 0;
        let mut frames_to_hit = 0;
        for f in 1..=200 {
            let out = a.update(1.0 / 60.0, &MELEE_ATTACK, &NEAR, || 0.0);
            if out[1].is_some() {
                hits += 1;
                if frames_to_hit == 0 {
                    frames_to_hit = f;
                }
            }
            a.start(&MELEE_ATTACK, false);
        }
        // 0.3 s wind-up; then one attack every 1.2 s: three in 200 frames (3.33 s)
        assert!((17..=19).contains(&frames_to_hit));
        assert_eq!(hits, 3);
    }

    #[test]
    fn a_wind_up_is_dropped_when_cover_comes_between() {
        let mut a = Attacker::default();
        a.start(&RANGED_ATTACK, false);
        let hidden = Sight { clear: false, ..NEAR };
        assert_eq!(a.update(1.0 / 60.0, &RANGED_ATTACK, &hidden, || 0.0), [None, None]);
        assert!(!a.winding());
    }

    #[test]
    fn an_echo_follows_for_its_share() {
        let mut a = Attacker::default();
        a.start(&RANGED_ATTACK, false);
        let mut seen = Vec::new();
        for _ in 0..40 {
            for f in a.update(1.0 / 60.0, &RANGED_ATTACK, &NEAR, || 0.5).into_iter().flatten() {
                seen.push((f.damage, f.echo));
            }
        }
        assert_eq!(seen, vec![(10.0, 0.0), (5.0, 0.5)]);
    }
}
