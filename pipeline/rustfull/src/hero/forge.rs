//! Brannoc, the Ashen Smith. Ports of his passive (`src/traits/forge.ts`) and of the rules inside his four spells
//! (`src/spells/targeted/chainHammer.ts`, `forgeRoar.ts`, `redHotRivet.ts`, `moltenCore.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.

use crate::bolt::{bolt_width, BoltSpec, Side};
use crate::fight::{Ctx, Kind, Mods, THit, World, NO_MODS};
use crate::figure::Hit;
use crate::geom::V2;
use crate::hero::{self, Hero, Quiet, Spell, PLAIN};
use crate::status::{Buff, Status};
use crate::zone::{Shape, Zone};

// src/traits/forge.ts
const HEAT_MAX: f64 = 3.0;
const HEAT_SECONDS: f64 = 5.0;
const SLAM_SECONDS: f64 = 3.0;
const SLAM_DAMAGE: f64 = 35.0;
const SLAM_KNOCKUP: f64 = 0.5;
const SLAM_TEMPERED_KNOCKUP: f64 = 0.8;
const CORE_SECONDS: f64 = 6.0;
const CORE_DAMAGE: f64 = 25.0;
const CORE_REACH: f64 = 0.4;
const QUENCH_HOLD: f64 = 0.6;
const TEMPER_STUN: f64 = 0.75;
const TEMPER_VULNERABLE: (f64, f64) = (0.2, 3.0);
const BASE_ATTACK: f64 = 18.0;

/// What his passive and his spells keep between them (`mem`, `forgeFx` and Molten Core's `lastCast`).
#[derive(Clone, Debug, Default)]
pub struct State {
    slam_until: f64,
    core_until: f64,
    swings: u32,
    /// The cast of each slot that has had its once-a-cast rule (`mem.c0` .. `mem.c3`).
    seen: [Option<u32>; 4],
    /// Seconds the core had left when it was Quenched, and when that was decided.
    quench_left: f64,
    quench_at: Option<f64>,
    /// When Molten Core was last cast and whether that cast was the Quench.
    last_core: Option<(f64, bool)>,
}

fn st(w: &World, s: Side) -> &State {
    hero::state(w, s)
}

fn st_mut(w: &mut World, s: Side) -> &mut State {
    hero::state_mut(w, s)
}

fn new_state() -> Box<dyn std::any::Any> {
    Box::new(State::default())
}

fn spell(slot: usize) -> Box<dyn Spell> {
    match slot {
        0 => Box::new(ChainHammer::default()),
        1 => Box::new(Quiet),
        2 => Box::new(RedHotRivet::default()),
        _ => Box::new(MoltenCore::default()),
    }
}

pub const HERO: Hero = Hero { name: "Brannoc", state: new_state, spell, enemy_goal, attack_mods, attack_reach, after_cast, recast_act, tick, dealt, taken, ..PLAIN };

fn slam_on(w: &World, s: Side) -> bool {
    w.time < st(w, s).slam_until
}

fn core_on(w: &World, s: Side) -> bool {
    w.time < st(w, s).core_until
}

fn end_slam(w: &mut World, s: Side) {
    st_mut(w, s).slam_until = 0.0;
    w.rt[s.i()].show("slam", 0.0);
}

fn end_core(w: &mut World, s: Side) {
    st_mut(w, s).core_until = 0.0;
    w.rt[s.i()].show("core", 0.0);
}

fn swallowed(k: Status) -> bool {
    matches!(k, Status::Slow | Status::Root | Status::Knockup)
}

/// The computer player against him walks away from the Molten Core: he is no faster.
pub fn enemy_goal(w: &World, s: Side) -> Option<V2> {
    if !core_on(w, s) || w.enemy_distance(s) > 5.0 {
        return None;
    }
    let (me, p) = (w.pos(s), w.pos(s.other()));
    Some(V2::new(p.x + (p.x - me.x), p.z + (p.z - me.z)))
}

pub fn attack_mods(w: &mut World, s: Side) -> Mods {
    let mut m = NO_MODS;
    let mut extra = 0.0;
    if slam_on(w, s) {
        end_slam(w, s);
        extra += SLAM_DAMAGE;
        m.status = Some((Status::Knockup, SLAM_KNOCKUP));
    }
    if core_on(w, s) {
        extra += CORE_DAMAGE;
        let x = st_mut(w, s);
        x.swings += 1;
        let n = x.swings as f64;
        w.rt[s.i()].show("slag", n);
    }
    if extra > 0.0 {
        m.power = (BASE_ATTACK + extra) / BASE_ATTACK;
    }
    m
}

pub fn attack_reach(w: &World, s: Side) -> f64 {
    if core_on(w, s) { CORE_REACH } else { 0.0 }
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    let now = w.time;
    if slot == 1 {
        st_mut(w, s).slam_until = now + SLAM_SECONDS;
        w.rt[s.i()].show("slam", 1.0);
    }
    if slot == 3 {
        st_mut(w, s).core_until = now + CORE_SECONDS;
        w.rt[s.i()].show("core", 1.0);
    }
}

/// Quench: the core ends, and what was left of it is the burst's strength.
pub fn recast_act(w: &mut World, s: Side, slot: usize) {
    if slot != 3 {
        return;
    }
    let now = w.time;
    let x = st_mut(w, s);
    x.quench_left = (x.core_until - now).max(0.0);
    x.quench_at = Some(now);
    end_core(w, s);
    w.hold(s, QUENCH_HOLD);
}

pub fn tick(w: &mut World, s: Side, _dt: f64) {
    if st(w, s).slam_until != 0.0 && !slam_on(w, s) {
        end_slam(w, s);
    }
    if st(w, s).core_until != 0.0 && !core_on(w, s) {
        end_core(w, s);
    }
}

pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if !hit.victim_is_hero {
        return;
    }
    if hit.kind == Kind::Attack {
        // The slam carries a knock-up in its mods; a core swing adds one Heat.
        let slam = matches!(hit.mods.status, Some((Status::Knockup, _)));
        if slam && w.rt[s.i()].stacks("heat") >= HEAT_MAX {
            w.rt[s.i()].clear_stacks("heat");
            hit.opts.status = Some((Status::Knockup, SLAM_TEMPERED_KNOCKUP));
            return;
        }
        let n = (if slam { 2.0 } else { 0.0 }) + (if w.rt[s.i()].own("core") > 0.0 { 1.0 } else { 0.0 });
        if n > 0.0 {
            w.rt[s.i()].add_stacks("heat", n, HEAT_SECONDS, HEAT_MAX);
        }
        return;
    }
    let Some(slot) = hit.slot.filter(|_| hit.kind == Kind::Spell) else { return };
    // Once per cast: a burn tick, or a second hit of the same cast, neither Tempers nor adds Heat.
    if let Some(cast) = hit.cast {
        if st(w, s).seen[slot] == Some(cast) {
            return;
        }
        st_mut(w, s).seen[slot] = Some(cast);
    }
    if w.rt[s.i()].stacks("heat") >= HEAT_MAX {
        // Tempered: the Heat is spent for the bonus of the slot that hit.
        w.rt[s.i()].clear_stacks("heat");
        if slot == 0 || slot == 3 {
            hit.opts.status = Some((Status::Stun, TEMPER_STUN));
        }
        if slot == 2 {
            hit.opts.debuff = Some((Buff::Vulnerable, TEMPER_VULNERABLE.0, TEMPER_VULNERABLE.1));
        }
        return;
    }
    if slot == 2 {
        w.rt[s.i()].add_stacks("heat", 2.0, HEAT_SECONDS, HEAT_MAX);
    }
}

/// Molten Core: slows, roots and knock-ups do nothing to him, from the hit's own options and from the cast's mods.
pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    if !core_on(w, s) {
        return;
    }
    if matches!(hit.opts.status, Some((k, _)) if swallowed(k)) {
        hit.opts.status = None;
    }
    if matches!(hit.mods.status, Some((k, _)) if swallowed(k)) {
        hit.mods.status = None;
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

// src/spells/targeted/chainHammer.ts
const HAMMER_RELEASE: f64 = 0.3;
const HAMMER_SPEED: f64 = 18.0;
const HAMMER_RANGE: f64 = 9.0;
const HAMMER_RADIUS: f64 = 0.45;
const HAMMER_MUZZLE: f64 = 0.7;
const HAMMER_DURATION: f64 = 1.7;

/// Q Chain Hammer: after the wind-up a hammer flies down the aim; the first enemy it touches is hurt, slowed and
/// dragged toward where it was thrown from.
#[derive(Clone, Debug, Default)]
pub struct ChainHammer {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    fired: bool,
}

impl Spell for ChainHammer {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = ChainHammer { ctx: Some(ctx), time: 0.0, playing: true, fired: false };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        let f = c.fwd();
        let line = Shape::Line { x1: c.from.x, z1: c.from.z, x2: c.from.x + f.x * HAMMER_RANGE, z2: c.from.z + f.z * HAMMER_RANGE, width: bolt_width(HAMMER_RADIUS) };
        vec![Zone { shape: line, start: 0.0, impact: HAMMER_RELEASE, until: Some(HAMMER_RELEASE + HAMMER_RANGE / HAMMER_SPEED) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if !self.fired && self.time >= HAMMER_RELEASE {
            self.fired = true;
            let spell = &w.kits[c.side.i()].spells[c.slot];
            let hit = Hit { damage: spell.num("damage"), knock: Some(0.0), pull: spell.num("pull"), status: Some((Status::Slow, spell.num("slowSeconds"))), ..Hit::default() };
            let f = c.fwd();
            let from = V2::new(c.from.x + f.x * HAMMER_MUZZLE, c.from.z + f.z * HAMMER_MUZZLE);
            w.fire(&c, BoltSpec::plain(from, f, HAMMER_SPEED, HAMMER_RANGE - HAMMER_MUZZLE, HAMMER_RADIUS, hit));
        }
        if self.time >= HAMMER_DURATION {
            self.playing = false;
        }
    }
}

// src/spells/targeted/redHotRivet.ts
const RIVET_HIT: f64 = 0.55;
const RIVET_TICKS: [f64; 2] = [1.55, 2.55];
const RIVET_DURATION: f64 = 3.2;

/// E Red-Hot Rivet: a sure hit on the enemy he clicked, then two burn ticks.
#[derive(Clone, Debug, Default)]
pub struct RedHotRivet {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    hit: bool,
    ticked: [bool; 2],
}

impl Spell for RedHotRivet {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = RedHotRivet { ctx: Some(ctx), time: 0.0, playing: true, hit: false, ticked: [false; 2] };
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        let t = self.time;
        let (damage, tick) = {
            let spell = &w.kits[c.side.i()].spells[c.slot];
            (spell.num("damage"), spell.num("tickDamage"))
        };
        if !self.hit && t >= RIVET_HIT {
            self.hit = true;
            if c.has_target {
                w.spell_hit(&c, Hit { damage, knock: Some(1.5), from: Some(c.from), projectile: true, ..Hit::default() });
            }
        }
        if self.hit {
            for i in 0..2 {
                if self.ticked[i] || t < RIVET_TICKS[i] {
                    continue;
                }
                self.ticked[i] = true;
                if c.has_target {
                    w.spell_hit(&c, Hit { damage: tick, knock: Some(0.0), from: Some(c.from), projectile: true, ..Hit::default() });
                }
            }
        }
        if t >= RIVET_DURATION {
            self.playing = false;
        }
    }
}

// src/spells/targeted/moltenCore.ts
const CORE_FADE: f64 = 0.4;
const QUENCH_RING_T: f64 = 0.6;
const QUENCH_DURATION: f64 = 2.4;
const QUENCH_RING_R: f64 = 3.0;
/// A second cast inside this, after a core, is the Quench (seconds).
const CORE_RECAST_CLOCK: f64 = 6.6;

/// R Molten Core: the stance is the passive's work; the recast Quench draws a ring round him and bursts.
#[derive(Clone, Debug, Default)]
pub struct MoltenCore {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    quench: bool,
    burst: bool,
    left: f64,
}

impl Spell for MoltenCore {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let now = w.time;
        let x = st_mut(w, ctx.side);
        let prev = x.last_core;
        let quench = matches!(prev, Some((at, false)) if now - at < CORE_RECAST_CLOCK);
        x.last_core = Some((now, quench));
        let mut left = 0.0;
        if quench {
            // The passive wrote the seconds left just before this cast; without it the clock says.
            let fresh = x.quench_at.map_or(false, |at| now - at < 1.5);
            left = if fresh { x.quench_left } else { (CORE_SECONDS - prev.map_or(CORE_SECONDS / 2.0, |(at, _)| now - at)).max(0.0) };
        }
        *self = MoltenCore { ctx: Some(ctx), time: 0.0, playing: true, quench, burst: false, left };
    }

    fn zones(&self) -> Vec<Zone> {
        match self.ctx {
            Some(c) if self.quench => vec![Zone { shape: Shape::Circle { x: c.from.x, z: c.from.z, radius: QUENCH_RING_R }, start: 0.0, impact: QUENCH_RING_T, until: None }],
            _ => Vec::new(),
        }
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.quench && !self.burst && self.time >= QUENCH_RING_T {
            self.burst = true;
            // whoever of the cast's targets stands inside the ring now
            let p = w.pos(c.side.other());
            if c.has_target && p.dist(c.from) <= QUENCH_RING_R {
                let spell = &w.kits[c.side.i()].spells[c.slot];
                let damage = spell.num("damage") + spell.num("perSecond") * self.left;
                w.spell_hit(&c, Hit { damage, knock: Some(3.5), from: Some(c.from), projectile: true, ..Hit::default() });
            }
        }
        let end = if self.quench { QUENCH_DURATION } else { CORE_SECONDS + CORE_FADE };
        if self.time >= end {
            self.playing = false;
        }
    }
}
