//! The computer player's rules that both of the game's computer players share: which spell to cast (`pickSpell`), how to
//! walk (`steer`), and when to give up on a goal (`reachableGoal`). A port of those functions in `src/duel.ts`.
//!
//! The game has TWO computer players and they are not the same (docs/pipeline/rust-sim.md): the opponent's (`ai`) and
//! the autopilot that plays the player's hero in a simulated fight (`pilot`). What differs between them is in the fight
//! loop, not here; what is here is called by both.

use crate::geom::V2;

pub const SAVE_HP: f64 = 0.45;
pub const SAVE_REACH: f64 = 12.0;
pub const ESCAPE_REACH: f64 = 3.5;
pub const PARRY_LEAD: f64 = 0.6;
pub const BARRIER_LEAD: f64 = 1.0;
pub const BARRIER_GAP: f64 = 2.6;
pub const GOAL_CHECK: f64 = 1.5;
pub const GOAL_REST: f64 = 4.0;
/// A melee computer player closes to about this distance (m).
pub const MELEE_GAP: f64 = 2.0;
/// The computer player reacts to a bolt that will cross its position within this many seconds.
pub const BOLT_WINDOW: f64 = 0.6;
/// Having lost sight, it keeps walking round the cover this long after it sees again.
pub const SIGHT_HOLD: f64 = 0.5;
/// It does not strafe the way that would hide the other side within this far (m).
pub const STRAFE_LOOK: f64 = 0.9;
/// It casts a summon spell when the enemy is within this distance (m).
pub const SUMMON_REACH: f64 = 10.0;

/// A difficulty of the computer player (`CpuLevel` in `src/cpuLevels.ts`). Simulated fights use `BALANCE` on both sides.
#[derive(Clone, Copy, Debug)]
pub struct CpuLevel {
    pub speed: f64,
    pub cast_gap: (f64, f64),
    pub cooldown: f64,
    pub damage: f64,
    pub aim_error: f64,
    pub lead: f64,
    pub bolt_dodge: f64,
    pub bolt_reaction: f64,
    pub zone_dodge: f64,
    pub zone_reaction: f64,
    pub hazard_dodge: f64,
    pub guard: f64,
    pub ult_hp: f64,
    pub ult_time: f64,
}

pub const BALANCE: CpuLevel = CpuLevel {
    speed: 3.5, cast_gap: (0.0, 0.0), cooldown: 1.0, damage: 1.0, aim_error: 0.0, lead: 0.0, bolt_dodge: 0.65, bolt_reaction: 0.12,
    zone_dodge: 0.0, zone_reaction: 0.0, hazard_dodge: 0.9, guard: 0.6, ult_hp: 0.55, ult_time: 20.0,
};

/// Walk speed of a computer-played hero (`aiSpeed`): the level's, scaled by the hero's own speed over the usual 4.
pub fn ai_speed(lv: &CpuLevel, hero_speed: f64, bonus: f64) -> f64 {
    lv.speed * bonus * hero_speed / 4.0
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    /// Cast on the caster itself: its reach is the module's radius.
    Myself,
    Enemy,
    Enemies,
    Ground,
}

/// What the computer player reads of a spell: the kit's flags and the spell module's targeting.
#[derive(Clone, Copy, Debug)]
pub struct SpellInfo {
    pub range: f64,
    pub mode: Mode,
    pub radius: Option<f64>,
    pub cc: bool,
    pub dash: bool,
    pub escape: bool,
    pub summon: bool,
    pub save: bool,
    pub parry: bool,
    pub barrier: bool,
    pub anytime: bool,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Guard {
    pub parry: bool,
    pub barrier: bool,
}

/// What `pick_spell` is told about the moment.
pub struct Moment<'a> {
    /// Slot `i` cannot be cast now (cooling down, held by the hero's own rule, blocked).
    pub cooling: &'a dyn Fn(usize) -> bool,
    /// Slot `i` is a parry or wall that answers the hit that `guard` says is on its way (`guarded` in the game).
    pub answers: &'a dyn Fn(usize) -> bool,
    /// Distance to what it shoots at (the hero, or a unit in the way).
    pub d: f64,
    /// Distance to the enemy hero.
    pub d_hero: f64,
    /// The other side's HP share, and this side's.
    pub other_hp: f64,
    pub own_hp: f64,
    pub sees: bool,
    /// The other side is stunned or rooted already.
    pub other_held: bool,
    /// This side has the most units it may have.
    pub full: bool,
    pub guard: Guard,
    /// Seconds since the round began.
    pub time: f64,
}

/// The spell to cast now, if any: the first ready one in the order R, E, W, Q that is in reach (`pickSpell`).
/// R waits until the other side is under the level's `ult_hp` or the round is `ult_time` s old; without sight only
/// spells cast on oneself can go; a crowd-control spell goes first unless the other side is held already; a parry or a
/// wall goes only when a hit is on its way, and then first.
pub fn pick_spell(spells: &[SpellInfo; 4], q_range: f64, m: &Moment, lv: &CpuLevel) -> Option<usize> {
    let ready = |i: usize| -> Option<usize> {
        if (m.cooling)(i) {
            return None;
        }
        let s = &spells[i];
        if s.anytime {
            return Some(i);
        }
        if s.summon {
            return if m.full || m.d_hero > SUMMON_REACH { None } else { Some(i) };
        }
        // A last stand waits for the caster's own HP, not the enemy's.
        if s.save {
            return if m.own_hp <= SAVE_HP && m.d_hero <= SAVE_REACH { Some(i) } else { None };
        }
        if s.escape {
            return if m.d_hero <= ESCAPE_REACH { Some(i) } else { None };
        }
        if s.parry || s.barrier {
            if (s.parry && m.guard.parry) || (s.barrier && m.guard.barrier) {
                return Some(i);
            }
            if !s.dash {
                return None;
            }
        }
        let reach = if s.mode == Mode::Myself { s.radius.unwrap_or(5.0) - 0.6 } else { s.range };
        if m.d > reach || (s.mode != Mode::Myself && !m.sees) {
            return None;
        }
        // A gap closer only when the target is out of Q's range. An ultimate that leaps in goes in its own range.
        if s.dash && i != 3 && m.d <= q_range + 0.5 {
            return None;
        }
        if i == 3 && m.other_hp > lv.ult_hp && m.time < lv.ult_time {
            return None;
        }
        Some(i)
    };
    const ORDER: [usize; 4] = [3, 2, 1, 0];
    if m.guard.parry || m.guard.barrier {
        for i in ORDER {
            if (m.answers)(i) {
                if let Some(p) = ready(i) {
                    return Some(p);
                }
            }
        }
    }
    if !m.other_held {
        for i in ORDER {
            if spells[i].cc {
                if let Some(p) = ready(i) {
                    return Some(p);
                }
            }
        }
    }
    ORDER.into_iter().find_map(ready)
}

/// What the walking rules ask of the arena.
pub trait Nav {
    /// Nothing stands between the two spots.
    fn sees(&self, a: V2, b: V2) -> bool;
    /// A body can walk straight from a to b (`aiPathClear`).
    fn path_clear(&self, a: V2, b: V2) -> bool;
    /// The next spot on the planned way round the cover from a to b (`aiRoute`).
    fn route(&mut self, a: V2, b: V2) -> V2;
}

/// One computer player's walking state (`opponentAi` / `playerAi` in the game).
#[derive(Clone, Debug)]
pub struct Walk {
    pub strafe: f64,
    pub strafe_t: f64,
    pub closing: bool,
    pub routed: bool,
    pub hidden_t: f64,
    pub goal_t: f64,
    pub goal_seen: bool,
    pub goal_off: f64,
    pub goal_from: V2,
}

impl Default for Walk {
    fn default() -> Self {
        Walk { strafe: 1.0, strafe_t: 0.0, closing: false, routed: false, hidden_t: 0.0, goal_t: 0.0, goal_seen: false, goal_off: 0.0, goal_from: V2::new(0.0, 0.0) }
    }
}

/// A unit step for a computer player (`steer`): hold about 70% of Q's range from `other`, strafe round it and flip the
/// strafe every 1.5 to 3.5 s. Without sight: close in to half that, so the strafe comes round the cover. A melee kit
/// closes to about 2 m, never backs off, and strafes only a little. `enemy_melee_units`: enemy melee units to step
/// away from (a ranged hero only). `random` gives numbers in 0..1.
#[allow(clippy::too_many_arguments)]
pub fn steer(st: &mut Walk, melee: bool, q_range: f64, at: V2, other: V2, dt: f64, blocked: bool, reach: f64, nav: &mut dyn Nav, enemy_melee_units: &[V2], random: &mut dyn FnMut() -> f64) -> V2 {
    let d = at.dist(other);
    // Sight lost: it stays "hidden" a moment after it comes back, or the strafe would walk it behind the corner again.
    st.hidden_t = if blocked { SIGHT_HOLD } else { (st.hidden_t - dt).max(0.0) };
    let blocked = st.hidden_t > 0.0;
    let want = if melee { MELEE_GAP.min(reach - 0.4) } else { (q_range * if blocked { 0.35 } else { 0.7 }).min(reach - 0.6) };
    let len = d.max(1e-3);
    let to = V2::new((other.x - at.x) / len, (other.z - at.z) / len);
    st.strafe_t -= dt;
    if st.strafe_t <= 0.0 {
        st.strafe = -st.strafe;
        st.strafe_t = 1.5 + random() * 2.0;
    }
    let mut mv = V2::new(0.0, 0.0);
    // Closing in starts past the far edge of the band and goes on to its near edge: one exact distance would flip it
    // between walking in and strafing on every frame.
    let band = if melee { 0.3 } else { 1.0 };
    if d > want + band || (blocked && (d > 1.5 || !nav.sees(at, other))) {
        st.closing = true;
    } else if d <= want + band * 0.4 || blocked {
        st.closing = false;
    }
    let closing = st.closing;
    // Cover in the way: the planned way round it, without the strafe, which would walk it off the route.
    st.routed = closing && !nav.path_clear(at, other);
    if st.routed {
        let p = nav.route(at, other);
        mv = V2::new(p.x - at.x, p.z - at.z);
    } else {
        if closing {
            mv.x += to.x;
            mv.z += to.z;
        } else if !melee && d < want - 2.0 {
            mv.x -= to.x;
            mv.z -= to.z;
        }
        // Strafe the way that keeps the other side in sight; if neither does, not at all.
        let sees_from = |side: f64, nav: &dyn Nav| nav.sees(V2::new(at.x - to.z * side * STRAFE_LOOK, at.z + to.x * side * STRAFE_LOOK), other);
        if !sees_from(st.strafe, nav) && sees_from(-st.strafe, nav) {
            st.strafe = -st.strafe;
            st.strafe_t = 1.5 + random() * 2.0;
        }
        if sees_from(st.strafe, nav) {
            let k = (if melee { 0.3 } else { 0.8 }) * st.strafe;
            mv.x += -to.z * k;
            mv.z += to.x * k;
        }
    }
    // Step away from enemy melee units in contact, so they do not hit for free.
    if !melee {
        for u in enemy_melee_units {
            let ud = u.dist(at);
            if ud < 2.4 {
                let k = 1.6 / ud.max(0.2);
                mv.x += (at.x - u.x) * k;
                mv.z += (at.z - u.z) * k;
            }
        }
    }
    let l = mv.len();
    if l > 0.0 { V2::new(mv.x / l, mv.z / l) } else { mv }
}

/// A hero's own goal for its computer player, unless it has stood still short of it (`reachableGoal`): it then fights
/// for a while, because two computer players each waiting on a goal would wait for ever.
pub fn reachable_goal(st: &mut Walk, at: V2, goal: Option<V2>, dt: f64) -> Option<V2> {
    st.goal_off = (st.goal_off - dt).max(0.0);
    if st.goal_off > 0.0 {
        return None;
    }
    st.goal_t += dt;
    st.goal_seen |= goal.is_some();
    if st.goal_t >= GOAL_CHECK {
        let short = match goal {
            None => true,
            Some(g) => at.dist(g) > 0.5,
        };
        let still = st.goal_seen && at.dist(st.goal_from) < 0.3 && short;
        st.goal_t = 0.0;
        st.goal_seen = false;
        st.goal_from = at;
        if still {
            st.goal_off = GOAL_REST;
            return None;
        }
    }
    goal
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spell(range: f64, mode: Mode) -> SpellInfo {
        SpellInfo { range, mode, radius: None, cc: false, dash: false, escape: false, summon: false, save: false, parry: false, barrier: false, anytime: false }
    }

    fn moment<'a>(cooling: &'a dyn Fn(usize) -> bool, d: f64, other_hp: f64, time: f64) -> Moment<'a> {
        Moment { cooling, answers: &|_| false, d, d_hero: d, other_hp, own_hp: 1.0, sees: true, other_held: false, full: false, guard: Guard::default(), time }
    }

    #[test]
    fn the_ultimate_waits_for_a_hurt_enemy_or_twenty_seconds() {
        let kit = [spell(10.0, Mode::Ground), spell(10.0, Mode::Ground), spell(10.0, Mode::Ground), spell(10.0, Mode::Ground)];
        let none = |_: usize| false;
        assert_eq!(pick_spell(&kit, 10.0, &moment(&none, 5.0, 1.0, 3.0), &BALANCE), Some(2));
        assert_eq!(pick_spell(&kit, 10.0, &moment(&none, 5.0, 0.5, 3.0), &BALANCE), Some(3));
        assert_eq!(pick_spell(&kit, 10.0, &moment(&none, 5.0, 1.0, 21.0), &BALANCE), Some(3));
    }

    #[test]
    fn crowd_control_goes_first_unless_the_enemy_is_held() {
        let mut kit = [spell(10.0, Mode::Ground); 4];
        kit[0].cc = true;
        let none = |_: usize| false;
        assert_eq!(pick_spell(&kit, 10.0, &moment(&none, 5.0, 1.0, 3.0), &BALANCE), Some(0));
        let mut held = moment(&none, 5.0, 1.0, 3.0);
        held.other_held = true;
        assert_eq!(pick_spell(&kit, 10.0, &held, &BALANCE), Some(2));
    }

    #[test]
    fn a_dash_is_kept_for_a_target_out_of_q_range_and_no_sight_leaves_only_self_spells() {
        let mut kit = [spell(6.0, Mode::Ground), spell(9.0, Mode::Ground), spell(9.0, Mode::Ground), spell(9.0, Mode::Ground)];
        kit[2].dash = true;
        let only_e = |i: usize| i != 2;
        assert_eq!(pick_spell(&kit, 6.0, &moment(&only_e, 5.0, 1.0, 3.0), &BALANCE), None);
        assert_eq!(pick_spell(&kit, 6.0, &moment(&only_e, 8.0, 1.0, 3.0), &BALANCE), Some(2));
        let mut kit2 = [spell(6.0, Mode::Ground); 4];
        kit2[1] = SpellInfo { mode: Mode::Myself, radius: Some(4.0), ..spell(0.0, Mode::Myself) };
        let none = |_: usize| false;
        let mut blind = moment(&none, 3.0, 1.0, 3.0);
        blind.sees = false;
        assert_eq!(pick_spell(&kit2, 6.0, &blind, &BALANCE), Some(1));
    }
}
