//! Mr. Ledger, the Tithe-Keeper. Ports of his passive On Your Tab (`src/traits/ledger.ts`) and of the rules inside his
//! four spells (`src/spells/targeted/invoice.ts`, `lateFee.ts`, `callItIn.ts`, `foreclosure.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.
//!
//! What is left out, and why it may be: the words over the victim (`say`, `bookOf`, `marks`, `peerNote`), the number
//! over the head (`enemyLabel`, `badge`) and Call It In's book are drawing only. In a duel against the CPU there is one
//! screen, so `show` and `own` are the same runtime's map (`TraitRuntime.show` / `own`).

use crate::bolt::{bolt_width, BoltSpec, Side};
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::{blocks_sight, V2};
use crate::hero::{self, Hero, Quiet, Spell, PLAIN};
use crate::status::{Buff, Status};
use crate::zone::{Shape, Zone};

// src/traits/ledger.ts
const INVOICE_RANGE: f64 = 9.0;
const INVOICE_SPEED: f64 = 20.0;
const INVOICE_WIND: f64 = 0.25;
const INVOICE_RADIUS: f64 = 0.35;
const FEE_RADIUS: f64 = 2.5;
const FEE_DELAY: f64 = 1.0;
const CALL_DELAY: f64 = 0.5;
const STAMP_RANGE: f64 = 9.0;
const STAMP_DELAY: f64 = 0.8;
const STAMP_RADIUS: f64 = 2.2;
const STAMP_MUL: f64 = 1.6;
const STAMP_EXPOSE: f64 = 0.2;
const DUE_SECONDS: f64 = 3.0;
const DUE_MUL: f64 = 1.4;
const PAY_OFF: f64 = 2.0;
const TAB_BACKSTOP: f64 = 8.0;
const TAB_MAX: f64 = 999.0;

/// The trait's `mem` (one per runtime, cleared each round). 0 stands for the game's `undefined` where it reads `?? 0`
/// or tests the value for truth.
#[derive(Clone, Debug, Default)]
pub struct State {
    tab_at: f64,
    call_at: f64,
    call_seen: f64,
    paid_seen: f64,
    call_n: f64,
    paid: f64,
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
        0 => Box::new(Invoice::default()),
        1 => Box::new(LateFee::default()),
        // Call It In draws a book and makes no hit: the tab comes due in `victim_tick`, from `show('call')`.
        2 => Box::new(Quiet),
        _ => Box::new(Foreclosure::default()),
    }
}

pub const HERO: Hero = Hero { name: "Mr. Ledger", state: new_state, spell, ai_hold, blocked, after_cast, dealt, taken, victim_tick, ..PLAIN };

/// The next value of a counter shown to the other screen (1..900: 0 would hide it).
fn bump(n: f64) -> f64 {
    (n % 900.0) + 1.0
}

/// Hits counted since `seen`, for a counter that wraps (after a wrap it counts one, as the game does).
fn since(n: f64, seen: f64) -> f64 {
    if n > seen { n - seen } else { 1.0 }
}

fn tab(w: &World, s: Side) -> f64 {
    w.rt[s.i()].stacks("tab")
}

/// The CPU keeps E for a tab worth calling in, and R for a bigger one it can stamp.
pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    let tab = tab(w, s);
    if slot == 2 {
        return tab < 90.0 || (tab >= 120.0 && dist <= STAMP_RANGE && w.cooldown_left(s, 3) <= 0.05);
    }
    if slot == 3 {
        return tab < 120.0;
    }
    false
}

/// `canCast`: E needs a tab to call.
pub fn blocked(w: &World, s: Side, slot: usize) -> bool {
    slot == 2 && tab(w, s) <= 0.0
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    if slot == 2 {
        let n = bump(st(w, s).call_n);
        st_mut(w, s).call_n = n;
        w.rt[s.i()].show("call", n);
    }
}

/// Where the hit is decided: his Invoice and Late Fee go on the tab; Foreclosure takes it.
pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if hit.kind != Kind::Spell || !hit.victim_is_hero || hit.blocked {
        return;
    }
    if hit.slot == Some(0) || hit.slot == Some(1) {
        if hit.damage <= 0.0 {
            return;
        }
        w.rt[s.i()].add_stacks("tab", hit.damage.round(), TAB_BACKSTOP, TAB_MAX);
        let now = w.time;
        st_mut(w, s).tab_at = now;
        hit.damage = 0.0;
    } else if hit.slot == Some(3) {
        let tab = tab(w, s);
        hit.damage = (tab * STAMP_MUL).round();
        if tab > 0.0 {
            w.rt[s.i()].clear_stacks("tab");
            st_mut(w, s).tab_at = 0.0;
        }
    }
}

/// His own side: a hit on him pays the enemy's tab down (an attack one step, a spell five).
pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    if hit.blocked || hit.damage <= 0.0 || tab(w, s) <= 0.0 {
        return;
    }
    let steps = if hit.kind == Kind::Spell { 5 } else { 1 };
    let mut paid = st(w, s).paid;
    for _ in 0..steps {
        paid = bump(paid);
    }
    st_mut(w, s).paid = paid;
    w.rt[s.i()].show("paid", paid);
}

/// Payments, a called-in tab, and a tab coming due, in the game's order and with its early returns.
pub fn victim_tick(w: &mut World, s: Side, _dt: f64) {
    let mut tab = tab(w, s);
    let (paid, call) = (w.rt[s.i()].own("paid"), w.rt[s.i()].own("call"));
    let now = w.time;
    if tab <= 0.0 {
        let m = st_mut(w, s);
        m.tab_at = 0.0;
        m.call_at = 0.0;
        m.call_seen = call;
        m.paid_seen = paid;
        return;
    }
    if st(w, s).tab_at == 0.0 {
        st_mut(w, s).tab_at = now;
    }

    if paid != st(w, s).paid_seen {
        let n = since(paid, st(w, s).paid_seen);
        st_mut(w, s).paid_seen = paid;
        tab = w.rt[s.i()].add_stacks("tab", -PAY_OFF * n, TAB_BACKSTOP, TAB_MAX);
        if tab <= 0.0 {
            w.rt[s.i()].clear_stacks("tab");
            st_mut(w, s).tab_at = 0.0;
            return;
        }
    }

    if call != st(w, s).call_seen {
        let m = st_mut(w, s);
        m.call_seen = call;
        m.call_at = now + CALL_DELAY;
    }
    let call_at = st(w, s).call_at;
    if call_at != 0.0 && now >= call_at {
        st_mut(w, s).call_at = 0.0;
        w.rt[s.i()].clear_stacks("tab");
        st_mut(w, s).tab_at = 0.0;
        w.trait_hit(s, Hit { damage: tab.round(), knock: Some(0.0), ..Hit::default() });
        return;
    }

    if now >= st(w, s).tab_at + DUE_SECONDS {
        w.rt[s.i()].clear_stacks("tab");
        st_mut(w, s).tab_at = 0.0;
        w.trait_hit(s, Hit { damage: (tab * DUE_MUL).round(), knock: Some(0.0), ..Hit::default() });
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

// src/spells/targeted/invoice.ts
const MUZZLE: f64 = 0.8;
const INVOICE_MAX_T: f64 = 2.2;
const FLIGHT: f64 = INVOICE_RANGE - MUZZLE;

/// Q Invoice: after the wind-up a plain bolt flies from 0.8 m in front of him (8.2 m, 20 m/s, radius 0.35).
#[derive(Clone, Debug, Default)]
pub struct Invoice {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    fired: bool,
    dir: V2,
    start: V2,
}

impl Spell for Invoice {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        // `ctx.sentFrom ?? ctx.from`: offline there is no sentFrom.
        let s = ctx.from;
        let (mut dx, mut dz) = (ctx.point.x - s.x, ctx.point.z - s.z);
        let len = dx.hypot(dz);
        if len < 0.05 {
            dx = ctx.aim.sin();
            dz = ctx.aim.cos();
        } else {
            dx /= len;
            dz /= len;
        }
        let dir = V2::new(dx, dz);
        let start = V2::new(s.x + dx * MUZZLE, s.z + dz * MUZZLE);
        *self = Invoice { ctx: Some(ctx), time: 0.0, playing: true, fired: false, dir, start };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        let s = c.from;
        let line = Shape::Line { x1: s.x, z1: s.z, x2: s.x + self.dir.x * INVOICE_RANGE, z2: s.z + self.dir.z * INVOICE_RANGE, width: bolt_width(INVOICE_RADIUS) };
        vec![Zone { shape: line, start: 0.0, impact: INVOICE_WIND, until: Some(INVOICE_WIND + FLIGHT / INVOICE_SPEED) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if !self.fired && self.time >= INVOICE_WIND {
            self.fired = true;
            let spell = &w.kits[c.side.i()].spells[c.slot];
            let hit = Hit { damage: spell.num("damage"), knock: Some(spell.num("knock")), ..Hit::default() };
            w.fire(&c, BoltSpec::plain(self.start, self.dir, INVOICE_SPEED, FLIGHT, INVOICE_RADIUS, hit));
        }
        // The effect's end (a landed sheet fades, or 2.2 s) only stops the drawing; the bolt flies on by itself.
        if self.time >= INVOICE_MAX_T {
            self.playing = false;
        }
    }
}

// src/spells/targeted/lateFee.ts
const FEE_DURATION: f64 = 2.4;

/// W Late Fee: at 1 s whoever of the cast's targets stands in the 2.5 m ring now takes the hit (on the tab) and a slow.
#[derive(Clone, Debug, Default)]
pub struct LateFee {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    landed: bool,
}

impl Spell for LateFee {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = LateFee { ctx: Some(ctx), time: 0.0, playing: true, landed: false };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        vec![Zone { shape: Shape::Circle { x: c.point.x, z: c.point.z, radius: FEE_RADIUS }, start: 0.0, impact: FEE_DELAY, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= FEE_DURATION {
            self.playing = false;
            return;
        }
        if !self.landed && self.time >= FEE_DELAY {
            self.landed = true;
            // `ctx.targets`: the enemy was near the aimed spot at the cast; then its live position against the spot.
            if c.has_target && w.pos(c.side.other()).dist(c.point) <= FEE_RADIUS {
                let spell = &w.kits[c.side.i()].spells[c.slot];
                let hit = Hit { damage: spell.num("damage"), knock: Some(2.0), from: Some(c.point), status: Some((Status::Slow, spell.num("slow"))), ..Hit::default() };
                w.spell_hit(&c, hit);
            }
        }
    }
}

// src/spells/targeted/foreclosure.ts
const STAMP_DURATION: f64 = 2.7;

/// R Foreclosure: at 0.8 s whoever of the cast's targets stands in the 2.2 m ring now AND is still seen by him takes a
/// hit that `dealt` turns into the whole tab x 1.6, with +20% damage taken for 3 s. It lands even on an empty tab.
#[derive(Clone, Debug, Default)]
pub struct Foreclosure {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    landed: bool,
}

impl Spell for Foreclosure {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = Foreclosure { ctx: Some(ctx), time: 0.0, playing: true, landed: false };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        vec![Zone { shape: Shape::Circle { x: c.point.x, z: c.point.z, radius: STAMP_RADIUS }, start: 0.0, impact: STAMP_DELAY, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= STAMP_DURATION {
            self.playing = false;
            return;
        }
        if !self.landed && self.time >= STAMP_DELAY {
            self.landed = true;
            if !c.has_target {
                return;
            }
            let q = w.pos(c.side.other());
            if q.dist(c.point) > STAMP_RADIUS {
                return;
            }
            // `stillSees`: the plain sight test from where he stands now, every obstacle counts.
            if blocks_sight(w.pos(c.side), q, &w.cover) {
                return;
            }
            let spell = &w.kits[c.side.i()].spells[c.slot];
            let hit = Hit { damage: spell.num("damage"), knock: Some(5.0), from: Some(c.point), debuff: Some((Buff::Vulnerable, STAMP_EXPOSE, spell.num("expose"))), ..Hit::default() };
            w.spell_hit(&c, hit);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counters_wrap_as_in_the_game() {
        // `bump`: 1..900, never 0; `since`: after a wrap it counts one step, whatever was missed.
        assert_eq!(bump(0.0), 1.0);
        assert_eq!(bump(899.0), 900.0);
        assert_eq!(bump(900.0), 1.0);
        assert_eq!(since(15.0, 10.0), 5.0);
        assert_eq!(since(3.0, 898.0), 1.0);
    }
}
