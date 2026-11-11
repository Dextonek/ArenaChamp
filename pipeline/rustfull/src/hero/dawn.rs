//! Auriel, the Dawn Paladin. Ports of her passive (`src/traits/dawn.ts`) and of the rules inside her four spells
//! (`src/spells/targeted/firstLight.ts`, `dawnward.ts`, `oathbrand.ts`, `sunrise.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.
//!
//! How her shields work in the game, and so here: the passive makes the shield (the engine's own, `World::shield`) and
//! keeps ONE record of it (`aurielShields`: which spell it belongs to, whether it is gone). Every frame the passive
//! looks whether the engine's shield is still there; when it is not, it marks the record. The spell's effect watches
//! the record and makes the burst on the NEXT frame, where she stands then. A newer shield puts a new record in the
//! place of the old one: the spell the old one belonged to then makes no burst.
//!
//! Habits of the game that are kept:
//! - First Light's cone points along the cast's aim. The player's side aims a spell cast on oneself at the enemy; the
//!   opponent's side hands such a cast no aim point of its own (`castSpell`: `point = at`), so its aim is
//!   `yawTo(from, from)` = 0 and her cone ALWAYS points along +z, wherever the enemy stands. (`World::opp_cast` gives
//!   that 0.) This is most of why she does so much worse as the opponent.
//! - The computer never pops a shield early (`aiWait` on both recasts); the Pop is ported all the same.

use crate::bolt::Side;
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::{blocks_sight, V2};
use crate::hero::{self, Hero, Landed, Spell, PLAIN};
use crate::status::Status;
use crate::zone::{Shape, Zone};

// src/traits/dawn.ts
const Q_SHIELD: f64 = 14.0;
const Q_SHIELD_SECONDS: f64 = 3.0;
const Q_BURST_RADIUS: f64 = 3.0;
const W_SHIELD: f64 = 45.0;
const W_SHIELD_SECONDS: f64 = 3.0;
const W_BURST_RADIUS: f64 = 3.0;
const W_REACH: f64 = 3.0;
const BRAND_SECONDS: f64 = 2.5;
const BRAND_STUN: f64 = 0.8;
const R_SHIELD: f64 = 130.0;
const R_SHIELD_SECONDS: f64 = 5.0;
const R_RING_RADIUS: f64 = 5.0;
const R_RING_SECONDS: f64 = 1.6;
/// `SECONDS` by kind: 0 none, 1 Q's small shield, 2 Dawnward, 3 Sunrise.
const SECONDS: [f64; 4] = [0.0, Q_SHIELD_SECONDS, W_SHIELD_SECONDS, R_SHIELD_SECONDS];
/// `tick`: the shield is made in the same frame as its record; this long the record is not judged.
const GRACE: f64 = 0.15;
/// `aiHold`: the computer casts W and R only this close (metres).
const W_AI_REACH: f64 = 6.5;
const R_AI_REACH: f64 = 8.0;

/// Her shield as the passive tracks it (`AurielShield`). The game tells one record from another by the object itself;
/// here each record has a number of its own (`id`).
#[derive(Clone, Copy, Debug)]
struct Record {
    id: u32,
    /// 1 Q's small shield, 2 Dawnward, 3 Sunrise.
    kind: u8,
    /// The shield is gone: used up, run out or popped.
    broke: bool,
    broke_at: f64,
    /// Round time.
    born: f64,
    until: f64,
}

/// What her passive and her spells keep between them (`aurielShields`, `mem.qOpen`, `mem.breaks`, `bursting`).
#[derive(Clone, Debug, Default)]
pub struct State {
    rec: Option<Record>,
    /// Records made so far: the next one's number.
    made: u32,
    /// First Light was cast and its cone has not hit yet (`mem.qOpen`).
    q_open: bool,
    breaks: u32,
    /// True only while a burst's hit is being resolved (`bursting`, set by `burstHit`).
    bursting: bool,
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
        0 => Box::new(FirstLight::default()),
        1 => Box::new(Dawnward::default()),
        2 => Box::new(Oathbrand::default()),
        _ => Box::new(Sunrise::default()),
    }
}

pub const HERO: Hero = Hero { name: "Auriel", state: new_state, spell, ai_hold, blocked, attack_reach, after_cast, recast_act, landed, dealt, tick, ..PLAIN };

/// True while the shield of one of the given kinds is up (`aurielHolds`).
fn holds(w: &World, s: Side, kinds: &[u8]) -> bool {
    matches!(st(w, s).rec, Some(r) if !r.broke && kinds.contains(&r.kind))
}

/// Opens the record of a new shield of `kind` (`open`).
fn open(w: &mut World, s: Side, kind: u8) {
    let now = w.time;
    let x = st_mut(w, s);
    x.made += 1;
    x.rec = Some(Record { id: x.made, kind, broke: false, broke_at: 0.0, born: now, until: now + SECONDS[kind as usize] });
    w.rt[s.i()].show("shield", 0.0);
    w.rt[s.i()].show("shield", kind as f64);
}

/// The record's number when it is a live shield of `kind` (`current` in Dawnward and Sunrise).
fn current(w: &World, s: Side, kind: u8) -> Option<u32> {
    st(w, s).rec.filter(|r| r.kind == kind && !r.broke).map(|r| r.id)
}

/// A shield burst's hit (`burstHit`): always `projectile: true`, and marked so that `dealt` stuns a branded enemy.
fn burst_hit(w: &mut World, c: &Ctx, hit: Hit) {
    st_mut(w, c.side).bursting = true;
    w.spell_hit(c, Hit { projectile: true, ..hit });
    st_mut(w, c.side).bursting = false;
}

/// W and R reach far on paper so that their bursts find the enemy later: the computer casts them close in.
pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    match slot {
        1 => dist > W_AI_REACH || holds(w, s, &[3]),
        3 => dist > R_AI_REACH,
        _ => false,
    }
}

/// `canCast`: no Dawnward while Sunrise holds.
pub fn blocked(w: &World, s: Side, slot: usize) -> bool {
    slot == 1 && holds(w, s, &[3])
}

pub fn attack_reach(w: &World, s: Side) -> f64 {
    if holds(w, s, &[2]) { W_REACH } else { 0.0 }
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    match slot {
        // Q's shield comes with its hit (`landed`).
        0 => st_mut(w, s).q_open = true,
        1 => {
            open(w, s, 2);
            w.shield(s, W_SHIELD, W_SHIELD_SECONDS);
            w.rt[s.i()].show("ward", 1.0);
        }
        3 => {
            open(w, s, 3);
            w.shield(s, R_SHIELD, R_SHIELD_SECONDS);
        }
        _ => {}
    }
}

/// Pop: only the shield this recast belongs to.
pub fn recast_act(w: &mut World, s: Side, slot: usize) {
    if !holds(w, s, &[if slot == 1 { 2 } else { 3 }]) {
        return;
    }
    w.clear_shield(s);
}

/// First Light's cone hit gives her the small shield, but not while Dawnward or Sunrise holds.
pub fn landed(w: &mut World, s: Side, hit: Landed) {
    // (every victim here is the enemy hero: `victimIsHero`)
    if hit.kind != Kind::Spell || hit.slot != Some(0) {
        return;
    }
    // Only the cone's own hit gives a shield; the burst of that shield is a slot 0 hit too.
    if !st(w, s).q_open {
        return;
    }
    st_mut(w, s).q_open = false;
    if holds(w, s, &[2, 3]) {
        return;
    }
    open(w, s, 1);
    w.shield(s, Q_SHIELD, Q_SHIELD_SECONDS);
}

pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if hit.kind != Kind::Spell || !hit.victim_is_hero {
        return;
    }
    if hit.slot == Some(2) {
        w.rt[s.i()].add_stacks("brand", 1.0, BRAND_SECONDS, 1.0);
        return;
    }
    if st(w, s).bursting && w.rt[s.i()].stacks("brand") > 0.0 {
        hit.opts.status = Some((Status::Stun, BRAND_STUN));
    }
}

/// Watches how her shield ends: the record is marked once the engine's shield is gone.
pub fn tick(w: &mut World, s: Side, _dt: f64) {
    let Some(r) = st(w, s).rec else { return };
    let now = w.time;
    // A record from an earlier round.
    if now < r.born {
        st_mut(w, s).rec = None;
        return;
    }
    if r.broke {
        return;
    }
    // The shield is made in the same frame; a short grace covers the engine applying it.
    if now < r.born + GRACE {
        return;
    }
    if w.shield_amount(s) > 0.0 && now < r.until + 1.0 {
        return;
    }
    let x = st_mut(w, s);
    x.rec = Some(Record { broke: true, broke_at: now, ..r });
    x.breaks += 1;
    let n = x.breaks as f64;
    w.rt[s.i()].show("sunbreak", n);
    if r.kind == 2 {
        w.rt[s.i()].show("ward", 0.0);
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

// src/spells/targeted/firstLight.ts
const LIGHT_HIT_T: f64 = 0.45;
const LIGHT_MISS_END: f64 = LIGHT_HIT_T + 1.85;
const LIGHT_BURST_LIFE: f64 = 0.9;
const LIGHT_CAP: f64 = 6.4;
const LIGHT_RANGE: f64 = 6.0;
/// Degrees, the cone's full width.
const LIGHT_ANGLE: f64 = 70.0;
const LIGHT_BURST_KNOCK: f64 = 2.0;

/// Q First Light: at 0.45 s whoever of the cast's targets stands in the 6 m cone takes the hit (inside what was drawn).
/// That hit gives her the small shield (the passive); when the shield is gone, a burst where she stands then.
#[derive(Clone, Debug, Default)]
pub struct FirstLight {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    fired: bool,
    /// The passive's record before this cast (a record that is not this one is the new shield), and the one this
    /// cast got.
    rec0: Option<u32>,
    rec: Option<u32>,
    burst_t: f64,
    crumble_t: f64,
    center: V2,
}

impl FirstLight {
    fn end_at(&self) -> f64 {
        if self.burst_t >= 0.0 {
            return LIGHT_CAP.min(self.burst_t + LIGHT_BURST_LIFE);
        }
        if self.crumble_t >= 0.0 {
            return LIGHT_CAP.min(self.crumble_t + 0.7);
        }
        if self.rec.is_some() { LIGHT_CAP } else { LIGHT_MISS_END }
    }

    /// The cone: everyone of the cast's targets inside it right now (live positions) takes the hit.
    fn strike(&mut self, w: &mut World, c: &Ctx) {
        if !c.has_target {
            return;
        }
        let half = LIGHT_ANGLE.to_radians() / 2.0;
        let p = w.pos(c.side.other());
        let (dx, dz) = (p.x - c.from.x, p.z - c.from.z);
        if dx.hypot(dz) > LIGHT_RANGE {
            return;
        }
        let diff = dx.atan2(dz) - c.aim;
        let diff = diff.sin().atan2(diff.cos());
        if diff.abs() > half {
            return;
        }
        let spell = &w.kits[c.side.i()].spells[c.slot];
        let hit = Hit { damage: spell.num("damage"), knock: Some(spell.num("knock")), from: Some(c.from), ..Hit::default() };
        w.spell_hit(c, hit);
    }

    /// After the cone: the passive's NEW kind 1 record is the shield; when it says broke the burst comes, and when a
    /// bigger shield took its place there is none.
    fn watch(&mut self, w: &mut World, c: &Ctx) {
        let cur = st(w, c.side).rec;
        if self.rec.is_none() {
            if let Some(r) = cur {
                if Some(r.id) != self.rec0 && r.kind == 1 {
                    self.rec = Some(r.id);
                }
            }
        }
        let Some(id) = self.rec else { return };
        match cur {
            Some(r) if r.id == id => {
                if r.broke {
                    self.burst(w, c);
                }
            }
            _ => self.crumble_t = self.time,
        }
    }

    /// The small shield is gone: everyone of the cast's targets within 3 m of her takes the hit.
    fn burst(&mut self, w: &mut World, c: &Ctx) {
        self.burst_t = self.time;
        let at = self.center;
        if !c.has_target || w.pos(c.side.other()).dist(at) > Q_BURST_RADIUS {
            return;
        }
        let damage = w.kits[c.side.i()].spells[c.slot].num("burst");
        burst_hit(w, c, Hit { damage, knock: Some(LIGHT_BURST_KNOCK), from: Some(at), ..Hit::default() });
    }
}

impl Spell for FirstLight {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let rec0 = st(w, ctx.side).rec.map(|r| r.id);
        *self = FirstLight { ctx: Some(ctx), time: 0.0, playing: true, fired: false, rec0, rec: None, burst_t: -1.0, crumble_t: -1.0, center: ctx.from };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        let cone = Shape::Cone { x: c.from.x, z: c.from.z, radius: LIGHT_RANGE, angle: LIGHT_ANGLE, dir: c.aim };
        vec![Zone { shape: cone, start: 0.0, impact: LIGHT_HIT_T, until: Some(LIGHT_HIT_T + 0.15) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= self.end_at() {
            self.playing = false;
            return;
        }
        if self.burst_t < 0.0 {
            self.center = w.pos(c.side);
        }
        if !self.fired && self.time >= LIGHT_HIT_T {
            self.fired = true;
            self.strike(w, &c);
        }
        if self.fired && self.burst_t < 0.0 && self.crumble_t < 0.0 {
            self.watch(w, &c);
        }
    }
}

// src/spells/targeted/dawnward.ts
const WARD_STANDALONE: f64 = W_SHIELD_SECONDS + 0.05;
const WARD_BURST_LIFE: f64 = 0.9;
const WARD_CAP: f64 = 5.2;
const WARD_KNOCK: f64 = 3.0;
/// The record may be found this long after the cast (`watch`: the other screen may hear of it a moment later).
const LATE_RECORD: f64 = 0.8;

/// W Dawnward: the shield is the passive's; when its record says it is gone, a burst where she stands then.
#[derive(Clone, Debug, Default)]
pub struct Dawnward {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    rec: Option<u32>,
    burst_t: f64,
    crumble_t: f64,
    center: V2,
}

impl Dawnward {
    fn end_at(&self) -> f64 {
        if self.burst_t >= 0.0 {
            return WARD_CAP.min(self.burst_t + WARD_BURST_LIFE);
        }
        if self.crumble_t >= 0.0 {
            return WARD_CAP.min(self.crumble_t + 0.7);
        }
        WARD_CAP
    }

    fn watch(&mut self, w: &mut World, c: &Ctx) {
        if self.rec.is_none() && self.time < LATE_RECORD {
            self.rec = current(w, c.side, 2);
        }
        match self.rec {
            Some(id) => match st(w, c.side).rec {
                Some(r) if r.id == id => {
                    if r.broke {
                        self.burst(w, c);
                    }
                }
                // A newer shield replaced this one: no burst.
                _ => self.crumble_t = self.time,
            },
            None => {
                if self.time >= WARD_STANDALONE {
                    self.burst(w, c);
                }
            }
        }
    }

    fn burst(&mut self, w: &mut World, c: &Ctx) {
        self.burst_t = self.time;
        let at = self.center;
        if !c.has_target || w.pos(c.side.other()).dist(at) > W_BURST_RADIUS {
            return;
        }
        let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
        burst_hit(w, c, Hit { damage, knock: Some(WARD_KNOCK), from: Some(at), ..Hit::default() });
    }
}

impl Spell for Dawnward {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let rec = current(w, ctx.side, 2);
        *self = Dawnward { ctx: Some(ctx), time: 0.0, playing: true, rec, burst_t: -1.0, crumble_t: -1.0, center: ctx.from };
    }

    // No zone: the burst is made where she stands when the shield ends.

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= self.end_at() {
            self.playing = false;
            return;
        }
        if self.burst_t < 0.0 {
            self.center = w.pos(c.side);
        }
        if self.burst_t < 0.0 && self.crumble_t < 0.0 {
            self.watch(w, &c);
        }
    }
}

// src/spells/targeted/oathbrand.ts
const BRAND_FALL: f64 = 0.5;
const BRAND_MARK_R: f64 = 1.2;
const BRAND_FIZZLE_END: f64 = BRAND_FALL + 0.5;
const BRAND_DURATION: f64 = BRAND_FALL + BRAND_SECONDS + 0.1;
const BRAND_KNOCK: f64 = 1.5;

/// E Oathbrand: after 0.5 s the beam falls on the enemy she clicked, if she still has sight of them. The brand itself
/// is the passive's (`dealt`).
#[derive(Clone, Debug, Default)]
pub struct Oathbrand {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    checked: bool,
    fizzled: bool,
    /// The enemy's feet at the cast: where the warning ring is drawn.
    mark: V2,
}

impl Spell for Oathbrand {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let mark = if ctx.has_target { w.pos(ctx.side.other()) } else { ctx.point };
        *self = Oathbrand { ctx: Some(ctx), time: 0.0, playing: true, checked: false, fizzled: false, mark };
    }

    fn zones(&self) -> Vec<Zone> {
        vec![Zone { shape: Shape::Circle { x: self.mark.x, z: self.mark.z, radius: BRAND_MARK_R }, start: 0.0, impact: BRAND_FALL, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= (if self.fizzled { BRAND_FIZZLE_END } else { BRAND_DURATION }) {
            self.playing = false;
            return;
        }
        if !self.checked && self.time >= BRAND_FALL {
            self.checked = true;
            let (me, foe) = (w.pos(c.side), w.pos(c.side.other()));
            // The wind-up ends without sight of the enemy: it fizzles (`stillSees`: the plain sight test, every
            // obstacle counts).
            if c.has_target && blocks_sight(me, foe, &w.cover) {
                self.fizzled = true;
            } else if c.has_target {
                // Judged on the live position: walking away does not dodge it.
                let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
                w.spell_hit(&c, Hit { damage, knock: Some(BRAND_KNOCK), from: Some(c.from), projectile: true, ..Hit::default() });
            }
        }
    }
}

// src/spells/targeted/sunrise.ts
const SUN_STANDALONE: f64 = R_SHIELD_SECONDS + 0.05;
const SUN_BURST_LIFE: f64 = 0.9;
const SUN_CAP: f64 = 9.4;
const SUN_KNOCK: f64 = 7.0;

/// R Sunrise: the shield is the passive's; when its record says it is gone a ring appears FIXED where she stands then,
/// closes for 1.6 s and bursts on whoever of the cast's targets stands in it.
#[derive(Clone, Debug, Default)]
pub struct Sunrise {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    rec: Option<u32>,
    /// When the shield ended and the ring appeared (-1: not yet), and the ring's fixed centre.
    ring_t: f64,
    crumble_t: f64,
    burst: bool,
    center: V2,
    ring_at: V2,
}

impl Sunrise {
    fn end_at(&self) -> f64 {
        if self.ring_t >= 0.0 {
            return SUN_CAP.min(self.ring_t + R_RING_SECONDS + SUN_BURST_LIFE);
        }
        if self.crumble_t >= 0.0 {
            return SUN_CAP.min(self.crumble_t + 0.7);
        }
        SUN_CAP
    }

    fn watch(&mut self, w: &mut World, c: &Ctx) {
        if self.rec.is_none() && self.time < LATE_RECORD {
            self.rec = current(w, c.side, 3);
        }
        match self.rec {
            Some(id) => match st(w, c.side).rec {
                Some(r) if r.id == id => {
                    if r.broke {
                        self.open_ring();
                    }
                }
                // Another record took its place: no ring.
                _ => self.crumble_t = self.time,
            },
            None => {
                if self.time >= SUN_STANDALONE {
                    self.open_ring();
                }
            }
        }
    }

    /// The shield is gone: the ring appears where she stands now, fixed.
    fn open_ring(&mut self) {
        self.ring_t = self.time;
        self.ring_at = self.center;
    }

    /// The ring has closed: whoever of the cast's targets is inside 5 m, on its live position, takes the hit.
    fn explode(&mut self, w: &mut World, c: &Ctx) {
        self.burst = true;
        let at = self.ring_at;
        if !c.has_target || w.pos(c.side.other()).dist(at) > R_RING_RADIUS {
            return;
        }
        let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
        burst_hit(w, c, Hit { damage, knock: Some(SUN_KNOCK), from: Some(at), ..Hit::default() });
    }
}

impl Spell for Sunrise {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let rec = current(w, ctx.side, 3);
        *self = Sunrise { ctx: Some(ctx), time: 0.0, playing: true, rec, ring_t: -1.0, crumble_t: -1.0, burst: false, center: ctx.from, ring_at: ctx.from };
    }

    // No zone: the ring appears where she stands when the shield ends.

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= self.end_at() {
            self.playing = false;
            return;
        }
        if self.ring_t < 0.0 {
            self.center = w.pos(c.side);
        }
        if self.ring_t < 0.0 && self.crumble_t < 0.0 {
            self.watch(w, &c);
        }
        // The ring's burst comes when it has closed.
        if self.ring_t >= 0.0 && !self.burst && self.time >= self.ring_t + R_RING_SECONDS {
            self.explode(w, &c);
        }
    }
}
