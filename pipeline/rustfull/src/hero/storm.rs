//! Kaia, the Tempest Caller. Ports of her passive (`src/traits/storm.ts`) and of the rules inside her four spells
//! (`src/spells/targeted/skyStrike.ts`, `thunderRod.ts`, `polarity.ts`, `supercellStorm.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.
//!
//! Habits of the game that are kept here, none of them written down in the game:
//! - Rods are aged by `marks` (the hook that draws them), not by `tick`. The duel asks for the marks right before the
//!   passives' ticks, and nothing reads the rods in between, so here the ageing is the first thing in `tick`.
//! - A rod's birth is the round clock as `marks` last wrote it (`now`): for a rod a spell plants, the frame before.
//! - Thunder Rod tells its Discharge from a first cast by the PAGE's clock (3.3 s), the recast window runs on the
//!   round's clock (3 s). See `ThunderRod::cast` for the one case where the two disagree, which is NOT ported.

use crate::bolt::Side;
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::V2;
use crate::hero::{self, Hero, Spell, PLAIN};
use crate::status::Status;
use crate::zone::{Shape, Zone};

// src/traits/storm.ts
const ROD_MAX: usize = 3;
const ROD_LIFE: f64 = 6.0;
const GREAT_LIFE: f64 = 3.0;
const ARC_RANGE: f64 = 5.0;
const ARC_DAMAGE: f64 = 18.0;
const GROUND_RANGE: f64 = 0.99;
const STORM_SECONDS: f64 = 6.0;
/// Rod ids go round after this many (`addRod`).
const ROD_IDS: u32 = 20;
/// The CPU against her walks to a rod within this of it (`enemyGoal`).
const GOAL_RANGE: f64 = 3.0;
/// The CPU playing her holds R while the enemy is farther than this and not this near a rod (`aiHold`).
const HOLD_DIST: f64 = 6.8;
const HOLD_ROD: f64 = 2.8;

/// One rod (`Rod`). `born` and `life` are round seconds.
#[derive(Clone, Copy, Debug)]
struct Rod {
    id: u32,
    x: f64,
    z: f64,
    born: f64,
    life: f64,
    great: bool,
    /// Can the enemy ground it now? Not decided until `victim_tick` has seen it once (the game's `undefined`).
    touchable: Option<bool>,
}

/// What her passive and her spells share (`StormState`, `mem.stormUntil`, and Thunder Rod's `lastCast`).
#[derive(Clone, Debug, Default)]
pub struct State {
    /// The round clock as `marks` last wrote it.
    now: f64,
    next: u32,
    rods: Vec<Rod>,
    /// Thunder Rod's great rod for its recast: id and spot.
    w: Option<(u32, f64, f64)>,
    storm_until: f64,
    /// When Thunder Rod was last cast (the page's clock, ms) and whether that cast was the Discharge.
    last_w: Option<(f64, bool)>,
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
        0 => Box::new(SkyStrike::default()),
        1 => Box::new(ThunderRod::default()),
        2 => Box::new(Polarity::default()),
        _ => Box::new(SupercellStorm::default()),
    }
}

pub const HERO: Hero = Hero { name: "Kaia", state: new_state, spell, ai_hold, enemy_goal, after_cast, tick, dealt, victim_tick, ..PLAIN };

/// Plants a rod now (`addRod`): more than three, the oldest goes. Returns its id.
fn add_rod(w: &mut World, s: Side, x: f64, z: f64, great: bool) -> u32 {
    let x0 = st_mut(w, s);
    let id = x0.next;
    x0.next = (x0.next + 1) % ROD_IDS;
    x0.rods.retain(|r| r.id != id);
    x0.rods.push(Rod { id, x, z, born: x0.now, life: if great { GREAT_LIFE } else { ROD_LIFE }, great, touchable: None });
    while x0.rods.len() > ROD_MAX {
        x0.rods.remove(0);
    }
    id
}

/// Removes rod `id`; false when it was already gone (`removeRod`).
fn remove_rod(w: &mut World, s: Side, id: u32) -> bool {
    let rods = &mut st_mut(w, s).rods;
    match rods.iter().position(|r| r.id == id) {
        Some(i) => {
            rods.remove(i);
            true
        }
        None => false,
    }
}

/// The rod nearest to `p` within `within` metres (`nearestRod`): of two equally near, the later one.
fn nearest_rod(w: &World, s: Side, p: V2, within: f64) -> Option<V2> {
    let (mut best, mut bd) = (None, within);
    for r in &st(w, s).rods {
        let d = (r.x - p.x).hypot(r.z - p.z);
        if d <= bd {
            bd = d;
            best = Some(V2::new(r.x, r.z));
        }
    }
    best
}

/// Big Mop wipes the ground (`addGroundWiper` at the end of `src/traits/storm.ts`): her rods within `r` of the spot
/// go. Nothing calls this yet: the port of the hero with Big Mop must.
pub fn wipe(w: &mut World, s: Side, x: f64, z: f64, r: f64) {
    st_mut(w, s).rods.retain(|rod| (rod.x - x).hypot(rod.z - z) > r);
}

/// The CPU against her walks to a rod that is close, to ground it.
pub fn enemy_goal(w: &World, s: Side) -> Option<V2> {
    nearest_rod(w, s, w.pos(s.other()), GOAL_RANGE)
}

/// The CPU playing her keeps R until the enemy is in its reach (7 m, or a rod that is within 3 m of them).
pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    if slot != 3 {
        return false;
    }
    dist > HOLD_DIST && nearest_rod(w, s, w.pos(s.other()), HOLD_ROD).is_none()
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    if slot == 3 {
        let until = w.time + STORM_SECONDS;
        st_mut(w, s).storm_until = until;
        w.rt[s.i()].show("storm", 1.0);
    }
}

pub fn tick(w: &mut World, s: Side, _dt: f64) {
    // `marks`, which the duel asks for right before the ticks: the clock the rods are born by, and their ageing
    let now = w.time;
    let x = st_mut(w, s);
    x.now = now;
    x.rods.retain(|r| !(now - r.born >= r.life));
    // `tick`
    if x.storm_until != 0.0 && !(now < x.storm_until) {
        x.storm_until = 0.0;
        w.rt[s.i()].show("storm", 0.0);
    }
}

/// A spell of hers that damages the enemy hero: every rod within 5 m of them arcs for 18 and is used up. Her own
/// arcs ('trait'), basic attacks and units do not arc.
pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if hit.kind != Kind::Spell || !hit.victim_is_hero {
        return;
    }
    if hit.slot == Some(2) && hit.damage > 0.0 {
        w.rt[s.i()].add_stacks("magnet", 1.0, 1.0, 1.0);
    }
    if hit.damage <= 0.0 {
        return;
    }
    let rods = st(w, s).rods.clone();
    for r in rods {
        // The great rod is not used up by its own Thunder Rod hits, or its first pulse would end it.
        if r.great && hit.slot == Some(1) {
            continue;
        }
        let v = w.pos(s.other());
        if (r.x - v.x).hypot(r.z - v.z) > ARC_RANGE {
            continue;
        }
        if !remove_rod(w, s, r.id) {
            continue;
        }
        w.trait_hit(s, Hit { damage: ARC_DAMAGE, knock: Some(0.0), ..Hit::default() });
    }
}

/// An enemy that comes within 1 m of a rod grounds it: it fizzles. A rod that lands on them is not a touch: they
/// step off, then back on.
pub fn victim_tick(w: &mut World, s: Side, _dt: f64) {
    let p = w.pos(s.other());
    let ids: Vec<u32> = st(w, s).rods.iter().map(|r| r.id).collect();
    for id in ids {
        let Some(r) = st_mut(w, s).rods.iter_mut().find(|r| r.id == id) else { continue };
        let near = (r.x - p.x).hypot(r.z - p.z) < GROUND_RANGE;
        if r.touchable.is_none() {
            r.touchable = Some(!near);
        }
        if !near {
            r.touchable = Some(true);
            continue;
        }
        if r.touchable != Some(true) {
            continue;
        }
        remove_rod(w, s, id);
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

/// The enemy hero as a spell's `ctx.enemies()` lists it: the player's hero always (`contextFor`), the opponent while
/// it lives (`liveFoes`).
fn enemy_listed(w: &World, c: &Ctx) -> bool {
    c.side == Side::Opponent || w.hp(Side::Opponent) > 0.0
}

// src/spells/targeted/skyStrike.ts
const STRIKE_T: f64 = 0.35;
const STRIKE_DURATION: f64 = 1.4;
const STRIKE_MARK_R: f64 = 1.2;
const ROD_GAP: f64 = 1.5;

/// Q Sky Strike: 0.35 s after the cast a strike falls on the enemy she clicked, wherever it stands by then; then a
/// rod is planted 1.5 m in front of it, toward her.
#[derive(Clone, Debug, Default)]
pub struct SkyStrike {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    struck: bool,
    /// Where the enemy stood at the cast: the warning circle's spot.
    mark: V2,
}

impl Spell for SkyStrike {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        let mark = if ctx.has_target { ctx.target_pos } else { ctx.point };
        *self = SkyStrike { ctx: Some(ctx), time: 0.0, playing: true, struck: false, mark };
    }

    fn zones(&self) -> Vec<Zone> {
        if self.ctx.is_none() {
            return Vec::new();
        }
        vec![Zone { shape: Shape::Circle { x: self.mark.x, z: self.mark.z, radius: STRIKE_MARK_R }, start: 0.0, impact: STRIKE_T, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= STRIKE_DURATION {
            self.playing = false;
            return;
        }
        if !self.struck && self.time >= STRIKE_T {
            self.struck = true;
            // the enemy's live feet (without a target: where the cast aimed), and hers
            let foe = if c.has_target { w.pos(c.side.other()) } else { self.mark };
            let from = w.pos(c.side);
            // The rod's spot: 1.5 m in front of the enemy, toward her.
            let (mut dx, mut dz) = (from.x - foe.x, from.z - foe.z);
            let d = dx.hypot(dz);
            let d = if d == 0.0 { 1.0 } else { d };
            dx /= d;
            dz /= d;
            let (rx, rz) = (foe.x + dx * ROD_GAP, foe.z + dz * ROD_GAP);
            if c.has_target {
                let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
                w.spell_hit(&c, Hit { damage, knock: Some(0.0), from: Some(c.from), projectile: true, ..Hit::default() });
            }
            // The rod goes in after the hit, so this hit's arcs do not use it up.
            add_rod(w, c.side, rx, rz, false);
        }
    }
}

// src/spells/targeted/thunderRod.ts
const PLANT_T: f64 = 0.25;
const ROD_TICKS: [f64; 2] = [1.2, 2.2];
const ROD_DURATION: f64 = 3.4;
const ROD_RADIUS: f64 = 3.5;
/// A second cast inside this is the Discharge (milliseconds of the page's clock).
const ROD_RECAST_CLOCK: f64 = 3300.0;

/// W Thunder Rod: a great rod at a spot that pulses at 1.2 s and 2.2 s on whoever stands within 3.5 m of it; cast
/// again, the Discharge spends the rod for one larger hit.
#[derive(Clone, Debug, Default)]
pub struct ThunderRod {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    discharge: bool,
    spot: V2,
    /// The great rod of this cast (the game's -1: none).
    rod: Option<u32>,
    planted: bool,
    ticked: [bool; 2],
    fired: bool,
    ended: bool,
}

impl ThunderRod {
    fn zone(&self) -> Shape {
        Shape::Circle { x: self.spot.x, z: self.spot.z, radius: ROD_RADIUS }
    }

    /// Everyone in the zone now (`ctx.enemies()`, not only who was near the aim at the cast). The hit is not a
    /// `projectile`, so the duel judges it against the cast's zone once more.
    fn hit_inside(&self, w: &mut World, c: &Ctx, hit: Hit) {
        if !enemy_listed(w, c) {
            return;
        }
        let p = w.pos(c.side.other());
        if !self.zone().contains(p.x, p.z) {
            return;
        }
        w.spell_hit(c, hit);
    }

    fn update_rod(&mut self, w: &mut World, c: &Ctx, t: f64) {
        if !self.planted && t >= PLANT_T {
            self.planted = true;
            let id = add_rod(w, c.side, self.spot.x, self.spot.z, true);
            self.rod = Some(id);
            st_mut(w, c.side).w = Some((id, self.spot.x, self.spot.z));
        }
        if !self.planted || self.ended {
            return;
        }
        // The rod was used up, grounded or pushed out by a newer one: the pulses stop.
        if !st(w, c.side).rods.iter().any(|r| Some(r.id) == self.rod) {
            self.ended = true;
            return;
        }
        for k in 0..ROD_TICKS.len() {
            if self.ticked[k] || t < ROD_TICKS[k] {
                continue;
            }
            self.ticked[k] = true;
            let spell = &w.kits[c.side.i()].spells[c.slot];
            let hit = Hit { damage: spell.num("damage"), knock: Some(0.0), from: Some(self.spot), status: Some((Status::Slow, spell.num("slowSeconds"))), ..Hit::default() };
            self.hit_inside(w, c, hit);
        }
    }

    fn update_discharge(&mut self, w: &mut World, c: &Ctx, t: f64) {
        if self.fired || t < PLANT_T {
            return;
        }
        self.fired = true;
        let alive = self.rod.map_or(false, |id| remove_rod(w, c.side, id));
        st_mut(w, c.side).w = None;
        if !alive {
            // The rod is gone: a puff at the spot, no hit.
            self.ended = true;
            return;
        }
        let damage = w.kits[c.side.i()].spells[c.slot].num("discharge");
        self.hit_inside(w, c, Hit { damage, knock: Some(0.0), from: Some(self.spot), ..Hit::default() });
    }
}

impl Spell for ThunderRod {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        // (the effect's `mode` setting is 'auto' in the game: the clock decides)
        let now = w.now_ms;
        let x = st_mut(w, ctx.side);
        // NOT PORTED: in the game this record is kept per caster FIGURE, and the player's figure is the same from
        // fight to fight on a page (the opponent's is new each fight). So a Thunder Rod cast by the player's Kaia in
        // the last 3.3 s of the page's clock before a fight ended makes her first Thunder Rod of the page's NEXT fight
        // a Discharge with no rod: it fizzles and roots her 0.25 s, and the cast after it plants the rod. Here the
        // record starts empty with every fight (as Isolde's icicle does in `frost.rs`).
        let discharge = matches!(x.last_w, Some((at, false)) if now - at < ROD_RECAST_CLOCK);
        x.last_w = Some((now, discharge));
        let (spot, rod) = match x.w {
            // The great rod's spot and id live in the per-figure record, not in the effect.
            Some((id, rx, rz)) if discharge => (V2::new(rx, rz), Some(id)),
            _ => {
                if !discharge {
                    x.w = None;
                }
                (ctx.point, None)
            }
        };
        *self = ThunderRod { ctx: Some(ctx), time: 0.0, playing: true, discharge, spot, rod, planted: false, ticked: [false; 2], fired: false, ended: false };
    }

    fn zones(&self) -> Vec<Zone> {
        if self.ctx.is_none() {
            return Vec::new();
        }
        // The great rod: the 3.5 m zone, full at the first pulse, dangerous until the last. The Discharge: at 0.25 s.
        if self.discharge {
            vec![Zone { shape: self.zone(), start: 0.0, impact: PLANT_T, until: None }]
        } else {
            vec![Zone { shape: self.zone(), start: 0.0, impact: ROD_TICKS[0], until: Some(ROD_TICKS[ROD_TICKS.len() - 1] + 0.1) }]
        }
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= ROD_DURATION {
            self.playing = false;
            return;
        }
        let t = self.time;
        if self.discharge {
            self.update_discharge(w, &c, t);
        } else {
            self.update_rod(w, &c, t);
        }
    }
}

// src/spells/targeted/polarity.ts
const POL_HIT_T: f64 = 0.25;
const POL_PULL_T: f64 = 1.0;
const POL_DURATION: f64 = 1.8;
const POL_MARK_R: f64 = 1.2;
/// The engine stops a pull this far short of where it pulls to; the stun is given from that far plus the pull, plus a margin.
const POL_STOP: f64 = 1.0;
const POL_REACH_MARGIN: f64 = 0.05;

/// E Polarity: a sure hit on the enemy she clicked at 0.25 s; at 1 s it is pulled 3 m toward her nearest rod (toward
/// her, with none), and stunned if that pull brings it to the rod.
#[derive(Clone, Debug, Default)]
pub struct Polarity {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    hit: bool,
    pulled: bool,
    mark: V2,
}

impl Spell for Polarity {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        let mark = if ctx.has_target { ctx.target_pos } else { ctx.point };
        *self = Polarity { ctx: Some(ctx), time: 0.0, playing: true, hit: false, pulled: false, mark };
    }

    fn zones(&self) -> Vec<Zone> {
        if self.ctx.is_none() {
            return Vec::new();
        }
        vec![Zone { shape: Shape::Circle { x: self.mark.x, z: self.mark.z, radius: POL_MARK_R }, start: 0.0, impact: POL_HIT_T, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= POL_DURATION {
            self.playing = false;
            return;
        }
        let t = self.time;
        let (damage, pull, stun) = {
            let spell = &w.kits[c.side.i()].spells[c.slot];
            (spell.num("damage"), spell.num("pull"), spell.num("stunSeconds"))
        };
        if !self.hit && t >= POL_HIT_T {
            self.hit = true;
            if c.has_target {
                w.spell_hit(&c, Hit { damage, knock: Some(0.0), from: Some(c.from), projectile: true, ..Hit::default() });
            }
        }
        if !self.pulled && t >= POL_PULL_T {
            self.pulled = true;
            if !c.has_target {
                return;
            }
            // Where the pull goes: her nearest rod to the enemy now, at any distance, else her own feet.
            let p = w.pos(c.side.other());
            let rod = nearest_rod(w, c.side, p, f64::INFINITY);
            let dest = rod.unwrap_or_else(|| w.pos(c.side));
            // The distance before the pull: the same hit carries the stun when the pull will reach the rod.
            let before = (p.x - dest.x).hypot(p.z - dest.z);
            let stunned = rod.is_some() && before <= pull + POL_STOP + POL_REACH_MARGIN;
            w.spell_hit(&c, Hit { damage: 0.0, knock: Some(0.0), pull, from: Some(dest), projectile: true, status: if stunned { Some((Status::Stun, stun)) } else { None }, ..Hit::default() });
        }
    }
}

// src/spells/targeted/supercellStorm.ts
const CELL_DURATION: f64 = 6.6;
const CELL_EVERY: f64 = 0.8;
const CELL_CHECKS: u32 = 6;
const CELL_MARK_T: f64 = 0.6;
const CELL_MARK_R: f64 = 1.2;
const CELL_NEAR_HER: f64 = 7.0;
const CELL_NEAR_ROD: f64 = 3.0;

/// A marked spot a bolt will fall on (`Pending`).
#[derive(Clone, Copy, Debug)]
struct Pending {
    at: V2,
    born: f64,
    fell: bool,
}

/// R Supercell: a storm over her for 6 s. Six times, every 0.8 s, the enemy's spot is marked if it is within 7 m of
/// her or 3 m of a rod; 0.6 s later a bolt falls there and hits if the enemy is still within 1.2 m of the mark.
#[derive(Clone, Debug, Default)]
pub struct SupercellStorm {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    checked: u32,
    pending: Vec<Pending>,
}

impl Spell for SupercellStorm {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = SupercellStorm { ctx: Some(ctx), time: 0.0, playing: true, checked: 0, pending: Vec::new() };
    }

    // No zones: the circles are moving marks, every hit is a `projectile`.

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= CELL_DURATION {
            self.playing = false;
            return;
        }
        let t = self.time;
        // The checks: the enemy is in the cast's list only if it stood within 14 m of her at the cast (`ctx.targets`).
        while self.checked < CELL_CHECKS && t >= CELL_EVERY * (self.checked + 1) as f64 {
            self.checked += 1;
            if !c.has_target {
                continue;
            }
            let (me, p) = (w.pos(c.side), w.pos(c.side.other()));
            let near = (p.x - me.x).hypot(p.z - me.z) <= CELL_NEAR_HER || nearest_rod(w, c.side, p, CELL_NEAR_ROD).is_some();
            if near {
                self.pending.push(Pending { at: p, born: t, fell: false });
            }
        }
        // The bolts: each mark falls 0.6 s after it was made.
        let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
        for i in 0..self.pending.len() {
            let p = self.pending[i];
            if p.fell || t < p.born + CELL_MARK_T {
                continue;
            }
            self.pending[i].fell = true;
            let q = w.pos(c.side.other());
            if (q.x - p.at.x).hypot(q.z - p.at.z) > CELL_MARK_R {
                continue;
            }
            w.spell_hit(&c, Hit { damage, knock: Some(0.0), from: Some(p.at), projectile: true, ..Hit::default() });
        }
        self.pending.retain(|p| !p.fell || t < p.born + CELL_MARK_T + 0.05);
    }
}
