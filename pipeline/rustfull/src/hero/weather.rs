//! Barry Cloudsley, the Sky Augur. Ports of his passive And Now the Weather (`src/traits/weather.ts`) and of the rules
//! inside his four spells (`src/spells/targeted/coldFront.ts`, `lightningRisk.ts`, `forecastUpdate.ts`,
//! `severeWarning.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.
//!
//! What is left out, and why it may be: the cards, the ring, the badge, the label over the enemy and the weather drawn
//! across the arena (`marks`, `ring`, `badge`, `enemyLabel`, `meter`) are drawing only; each of them calls `sync`, which
//! only latches a step with the round clock and the Update count of that frame, as `tick` does in the same frame. In a
//! duel against the CPU there is one screen, so `show` and `own` are the same runtime's map.
//!
//! Habits of the game that are kept here, none of them written down in the game:
//! - The weather of a step is latched when the book first sees the step (`sync`), with the Update count of that
//!   moment: it is not a function of the clock and the count now.
//! - His might (+20%) is renewed only while the forecast was right; its countdown stands still while it was wrong.
//! - The tornado's beat counter (`twN`, which makes every fourth beat 7) is never reset within a round; its clock
//!   (`twAcc`) is zeroed on every frame the enemy is not inside a live tornado.
//! - The Wind carries the opponent by `moveFoe` (sliding round cover) whichever side Barry is on, so on every frame of
//!   Wind the opponent stands without what pushes added until the arena's next frame (`World::carry_by`).
//! - An Update's cost on Cold Front is raw seconds on both sides: the CPU level's cooldown factor does not touch it.

use crate::bolt::{bolt_width, BoltSpec, Side};
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::V2;
use crate::hero::{self, Hero, Quiet, Spell, PLAIN};
use crate::status::{Buff, Status};
use crate::zone::{Shape, Zone};

// src/traits/weather.ts
const RAIN: u8 = 0;
const SUN: u8 = 1;
const ARENA_X: f64 = 0.0;
const ARENA_Z: f64 = 7.0;
const STEP: f64 = 8.0;
const WRONG_IN: u32 = 5;
const RAIN_SECONDS: f64 = 0.6;
const RAIN_RENEW: f64 = 0.3;
const SUN_HEAL: f64 = 4.0;
const SUN_EVERY: f64 = 1.0;
const WIND_PUSH: f64 = 1.0;
const MIGHT: f64 = 0.2;
const MIGHT_SECONDS: f64 = 0.7;
const MIGHT_RENEW: f64 = 0.35;
const COLD_RANGE: f64 = 9.0;
const COLD_SPEED: f64 = 20.0;
const COLD_WIND: f64 = 0.25;
const COLD_RADIUS: f64 = 0.4;
const COLD_RAIN_SLOW: f64 = 1.5;
const COLD_WIND_KNOCK: f64 = 6.0;
const BOLT_DELAY: f64 = 0.8;
const BOLT_RADIUS: f64 = 1.5;
const UPDATE_LOCK: f64 = 0.6;
const UPDATE_COST: f64 = 6.0;
const TORNADO_RANGE: f64 = 9.0;
const TORNADO_WARN: f64 = 1.0;
const TORNADO_WALK: f64 = 4.0;
const TORNADO_SPEED: f64 = 2.5;
const TORNADO_DPS: f64 = 25.0;
const TORNADO_RADIUS: f64 = 2.0;
const TORNADO_BEAT: f64 = 0.25;

/// Integer mix (a seeded hash, `mix`): the game's `Math.imul` and `>>>` are 32-bit wrapping arithmetic.
fn mix(n: i64) -> u32 {
    let mut x = ((n as i32) as u32 ^ 0x9e37_79b9).wrapping_mul(0x85eb_ca6b);
    x ^= x >> 13;
    x = x.wrapping_mul(0xc2b2_ae35);
    x ^= x >> 16;
    x
}

/// What his weather keeps (`WeatherBook`), the parts the rules read.
#[derive(Clone, Copy, Debug)]
struct Book {
    clock: f64,
    step: i64,
    u_seen: f64,
    cur: u8,
    wrong: bool,
    dir: V2,
    f_act: u8,
    f_wrong: bool,
    to_change: f64,
}

impl Default for Book {
    fn default() -> Self {
        Book { clock: 0.0, step: -1, u_seen: 0.0, cur: RAIN, wrong: false, dir: V2::new(1.0, 0.0), f_act: RAIN, f_wrong: false, to_change: STEP }
    }
}

impl Book {
    /// `forecastInto`: the real weather of step `next` (never the one now; an Update turns it to the other of the two)
    /// and whether the forecast of it is wrong (one in five). What a wrong forecast shows is drawing only.
    fn forecast(&mut self, next: i64, ups: i64, cur: u8) {
        self.f_act = ((cur as u32 + 1 + ((mix(next) & 1) ^ (ups as u32 & 1))) % 3) as u8;
        self.f_wrong = mix(next * 31 + ups * 17 + 7) % WRONG_IN == 0;
    }

    /// `enter`: latches step `step`.
    fn enter(&mut self, step: i64, ups: i64) {
        if step == 0 {
            self.cur = (mix(0) % 3) as u8;
            self.wrong = false;
        } else {
            let cur = self.cur;
            self.forecast(step, ups, cur);
            self.cur = self.f_act;
            self.wrong = self.f_wrong;
        }
        self.step = step;
        // The wind's direction: eight ways, by the step only.
        let a = (mix(step * 7 + 3) % 8) as f64 * (std::f64::consts::PI / 4.0) + std::f64::consts::PI / 8.0;
        self.dir = V2::new(a.cos(), a.sin());
    }

    /// `sync`: brings the book up to the round clock and the shown count of Updates. A new round (the clock or the
    /// count goes back) starts over.
    fn sync(&mut self, time: f64, ups: f64) {
        let time = time.max(0.0);
        if time < self.clock - 0.5 || ups < self.u_seen {
            self.step = -1;
            self.clock = 0.0;
            self.u_seen = 0.0;
        }
        self.clock = time;
        self.u_seen = ups;
        let s = (time / STEP).floor() as i64;
        let u = ups as i64;
        while self.step < s {
            let next = self.step + 1;
            self.enter(next, u);
        }
        let (next, cur) = (self.step + 1, self.cur);
        self.forecast(next, u, cur);
        self.to_change = (self.step + 1) as f64 * STEP - time;
    }
}

/// The tornado as the effect leaves it for the passive (`TornadoRec`).
#[derive(Clone, Copy, Debug, Default)]
struct Rec {
    x: f64,
    z: f64,
    live: bool,
}

/// The book, the trait's `mem` (one per runtime, cleared each round; 0 stands for the game's `undefined` where it reads
/// `?? 0`), and the tornado the book points at (`book.tornado`).
#[derive(Clone, Debug, Default)]
pub struct State {
    book: Book,
    upd: f64,
    self_rain: f64,
    self_sun: f64,
    self_might: f64,
    foe_rain: f64,
    foe_sun: f64,
    tw_acc: f64,
    tw_n: f64,
    tornado: Option<Rec>,
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
        0 => Box::new(ColdFront::default()),
        1 => Box::new(LightningRisk::default()),
        // Forecast Update draws a card and makes no hit: the change is `after_cast`'s.
        2 => Box::new(Quiet),
        _ => Box::new(SevereWarning::default()),
    }
}

pub const HERO: Hero = Hero { name: "Barry Cloudsley", state: new_state, spell, ai_hold, blocked, after_cast, dealt, tick, victim_tick, ..PLAIN };

/// `sync(t)` from a hook that may change the world.
fn sync(w: &mut World, s: Side) -> Book {
    let (time, ups) = (w.time, w.rt[s.i()].own("upd"));
    let b = &mut st_mut(w, s).book;
    b.sync(time, ups);
    *b
}

/// `sync(t)` from a hook that only reads (`aiHold`, `canCast`). These run after the passives' ticks of the same frame,
/// which have already latched the step; a sync here could only latch one if that were not so, so it must not happen.
fn synced(w: &World, s: Side) -> Book {
    let mut b = st(w, s).book;
    let before = b.step;
    b.sync(w.time, w.rt[s.i()].own("upd"));
    assert!(b.step == before, "Barry Cloudsley: his weather was read before his tick latched the step (time {})", w.time);
    b
}

/// Each seed of 'AI' (`aiLikes`): allow Update when this step was a surprise, or on every third step by the seed.
fn ai_likes(b: &Book) -> bool {
    b.wrong || mix(b.step * 5 + 1) % 3 == 0
}

/// The CPU: Update when the weather was a surprise or by the step; Severe Warning only inside its reach.
pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    if slot == 3 {
        return dist > TORNADO_RANGE;
    }
    if slot == 2 {
        let b = synced(w, s);
        return b.to_change < UPDATE_LOCK + 0.4 || !ai_likes(&b);
    }
    false
}

/// `canCast`: no Update in the last 0.6 s before a change.
pub fn blocked(w: &World, s: Side, slot: usize) -> bool {
    slot == 2 && synced(w, s).to_change < UPDATE_LOCK
}

/// An Update turns the forecast (the shown count) and spends his Cold Front.
pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    if slot != 2 {
        return;
    }
    let n = (st(w, s).upd + 1.0).min(900.0);
    st_mut(w, s).upd = n;
    w.rt[s.i()].show("upd", n);
    let left = w.cooldown_left(s, 0);
    w.set_cooldown(s, 0, left.max(UPDATE_COST));
}

/// Where Cold Front's hit is decided: rain slows it, wind carries it further.
pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if hit.kind != Kind::Spell || hit.slot != Some(0) || !hit.victim_is_hero || hit.blocked {
        return;
    }
    let cur = sync(w, s).cur;
    if cur == RAIN {
        hit.opts.status = Some((Status::Slow, COLD_RAIN_SLOW));
    } else if cur != SUN {
        hit.opts.knock = Some(hit.opts.knock.unwrap_or(0.0) + COLD_WIND_KNOCK);
    }
}

/// His own side: the weather on him, and his bonus.
pub fn tick(w: &mut World, s: Side, dt: f64) {
    let b = sync(w, s);
    if b.cur == RAIN {
        let m = st_mut(w, s);
        m.self_rain -= dt;
        if m.self_rain <= 0.0 {
            m.self_rain = RAIN_RENEW;
            w.apply_status(s, Status::Slow, RAIN_SECONDS);
        }
    } else if b.cur == SUN {
        let m = st_mut(w, s);
        m.self_sun += dt;
        if m.self_sun >= SUN_EVERY {
            m.self_sun = 0.0;
            if w.hp(s) < w.max_hp(s) {
                w.heal(s, SUN_HEAL * SUN_EVERY);
            }
        }
    } else {
        w.carry_by(s, b.dir.x * WIND_PUSH * dt, b.dir.z * WIND_PUSH * dt, true);
    }
    // +20% for as long as the weather is the one he called.
    if !b.wrong {
        let m = st_mut(w, s);
        m.self_might -= dt;
        if m.self_might <= 0.0 {
            m.self_might = MIGHT_RENEW;
            w.apply_buff(s, Buff::Might, MIGHT, MIGHT_SECONDS);
        }
    }
}

/// The enemy's side: the same weather on them, and the tornado's hits.
pub fn victim_tick(w: &mut World, s: Side, dt: f64) {
    let e = s.other();
    let b = sync(w, s);
    if b.cur == RAIN {
        let m = st_mut(w, s);
        m.foe_rain -= dt;
        if m.foe_rain <= 0.0 {
            m.foe_rain = RAIN_RENEW;
            w.apply_status(e, Status::Slow, RAIN_SECONDS);
        }
    } else if b.cur == SUN {
        let m = st_mut(w, s);
        m.foe_sun += dt;
        if m.foe_sun >= SUN_EVERY {
            m.foe_sun = 0.0;
            // `healEnemy` (both hosts heal offline; the opponent only while it lives)
            w.heal(e, SUN_HEAL * SUN_EVERY);
        }
    } else {
        w.carry_by(e, b.dir.x * WIND_PUSH * dt, b.dir.z * WIND_PUSH * dt, true);
    }
    // The enemy where it stands now: after the carry above (on the opponent, without what pushes added).
    let p = w.pos(e);
    let inside = st(w, s).tornado.map_or(false, |tw| tw.live && (p.x - tw.x).hypot(p.z - tw.z) <= TORNADO_RADIUS);
    if !inside {
        st_mut(w, s).tw_acc = 0.0;
        return;
    }
    st_mut(w, s).tw_acc += dt;
    while st(w, s).tw_acc >= TORNADO_BEAT {
        let m = st_mut(w, s);
        m.tw_acc -= TORNADO_BEAT;
        m.tw_n += 1.0;
        // 25 a second in four beats: 6, 6, 6, 7.
        let damage = (TORNADO_DPS * TORNADO_BEAT).floor() + if m.tw_n % 4.0 == 0.0 { 1.0 } else { 0.0 };
        w.trait_hit(s, Hit { damage, knock: Some(0.0), ..Hit::default() });
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

/// The enemy hero as a spell's `ctx.enemies()` lists it: the player's hero always (`contextFor`), the opponent while
/// it lives (`liveFoes`).
fn enemy_listed(w: &World, c: &Ctx) -> bool {
    c.side == Side::Opponent || w.hp(Side::Opponent) > 0.0
}

// src/spells/targeted/coldFront.ts
const MUZZLE: f64 = 0.8;
const COLD_MAX_T: f64 = 2.2;
const FLIGHT: f64 = COLD_RANGE - MUZZLE;

/// Q Cold Front: after the wind-up a plain bolt flies from 0.8 m in front of him (8.2 m, 20 m/s, radius 0.4). The
/// weather's slow or extra knock is put on its hit in `dealt`.
#[derive(Clone, Debug, Default)]
pub struct ColdFront {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    fired: bool,
    dir: V2,
    start: V2,
}

impl Spell for ColdFront {
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
        *self = ColdFront { ctx: Some(ctx), time: 0.0, playing: true, fired: false, dir, start };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        let s = c.from;
        let line = Shape::Line { x1: s.x, z1: s.z, x2: s.x + self.dir.x * COLD_RANGE, z2: s.z + self.dir.z * COLD_RANGE, width: bolt_width(COLD_RADIUS) };
        vec![Zone { shape: line, start: 0.0, impact: COLD_WIND, until: Some(COLD_WIND + FLIGHT / COLD_SPEED) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if !self.fired && self.time >= COLD_WIND {
            self.fired = true;
            let spell = &w.kits[c.side.i()].spells[c.slot];
            let hit = Hit { damage: spell.num("damage"), knock: Some(spell.num("knock")), ..Hit::default() };
            w.fire(&c, BoltSpec::plain(self.start, self.dir, COLD_SPEED, FLIGHT, COLD_RADIUS, hit));
        }
        // The effect's end (a landed gust fades, or 2.2 s) only stops the drawing; the bolt flies on by itself.
        if self.time >= COLD_MAX_T {
            self.playing = false;
        }
    }
}

// src/spells/targeted/lightningRisk.ts
const BOLT_DURATION: f64 = 2.0;
const BOLT_KNOCK: f64 = 3.0;

/// W Lightning Risk: at 0.8 s whoever of the cast's targets stands in the 1.5 m circle now takes the hit.
#[derive(Clone, Debug, Default)]
pub struct LightningRisk {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    struck: bool,
}

impl Spell for LightningRisk {
    fn cast(&mut self, _w: &mut World, ctx: Ctx) {
        *self = LightningRisk { ctx: Some(ctx), time: 0.0, playing: true, struck: false };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        vec![Zone { shape: Shape::Circle { x: c.point.x, z: c.point.z, radius: BOLT_RADIUS }, start: 0.0, impact: BOLT_DELAY, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= BOLT_DURATION {
            self.playing = false;
            return;
        }
        if !self.struck && self.time >= BOLT_DELAY {
            self.struck = true;
            // `ctx.targets`: the enemy was near the aimed spot at the cast; then its live position against the spot.
            if c.has_target && w.pos(c.side.other()).dist(c.point) <= BOLT_RADIUS {
                let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
                w.spell_hit(&c, Hit { damage, knock: Some(BOLT_KNOCK), from: Some(c.point), ..Hit::default() });
            }
        }
    }
}

// src/spells/targeted/severeWarning.ts
const WALK_END: f64 = TORNADO_WARN + TORNADO_WALK;
const FADE: f64 = 0.7;
const TORNADO_DURATION: f64 = WALK_END + FADE + 0.1;
const KEEP: f64 = 11.2;

/// R Severe Warning: a tornado at the spot; from 1 s to 5 s it walks at the enemy's live position at 2.5 m/s, kept
/// inside the ring. Its hits are the passive's (`victim_tick`), from the record this effect leaves in the book.
#[derive(Clone, Debug, Default)]
pub struct SevereWarning {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    born: bool,
    px: f64,
    pz: f64,
    rec: Rec,
}

impl SevereWarning {
    /// The book points at this effect's record: what it writes, the passive reads.
    fn publish(&self, w: &mut World, c: &Ctx) {
        st_mut(w, c.side).tornado = Some(self.rec);
    }
}

impl Spell for SevereWarning {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let p = ctx.point;
        *self = SevereWarning { ctx: Some(ctx), time: 0.0, playing: true, born: false, px: p.x, pz: p.z, rec: Rec { x: p.x, z: p.z, live: false } };
        self.publish(w, &ctx);
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        // The warning circle is the real hit shape where it stands; once it walks the hits follow it (`victim_tick`).
        vec![Zone { shape: Shape::Circle { x: c.point.x, z: c.point.z, radius: TORNADO_RADIUS }, start: 0.0, impact: TORNADO_WARN, until: None }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        let t = self.time;
        if t >= TORNADO_DURATION {
            self.playing = false;
            // `reset`: the record is no longer live
            self.rec.live = false;
            self.publish(w, &c);
            return;
        }
        if !self.born && t >= TORNADO_WARN {
            self.born = true;
            self.rec.live = true;
        }
        if t >= TORNADO_WARN {
            if t < WALK_END {
                // `ctx.targets[0] ?? ctx.enemies()[0]`: the other hero
                if c.has_target || enemy_listed(w, &c) {
                    let e = w.pos(c.side.other());
                    let (dx, dz) = (e.x - self.px, e.z - self.pz);
                    let d = dx.hypot(dz);
                    if d > 0.01 {
                        let step = d.min(TORNADO_SPEED * dt);
                        self.px += dx / d * step;
                        self.pz += dz / d * step;
                    }
                    // Kept inside the ring.
                    let (ox, oz) = (self.px - ARENA_X, self.pz - ARENA_Z);
                    let od = ox.hypot(oz);
                    if od > KEEP {
                        self.px = ARENA_X + ox / od * KEEP;
                        self.pz = ARENA_Z + oz / od * KEEP;
                    }
                }
                self.rec.live = true;
            } else {
                // The walk is over: it stops hurting at once.
                self.rec.live = false;
            }
            self.rec.x = self.px;
            self.rec.z = self.pz;
            self.publish(w, &c);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mix_and_the_weather_agree_with_the_game() {
        // Worked out by running the game's `mix` in node.
        let want = [493009611u32, 1059954845, 100097173, 1007616808, 2303572566, 2007225770];
        for (n, v) in want.iter().enumerate() {
            assert_eq!(mix(n as i64), *v);
        }
        // Steps 0..5: no Update for the first two steps, one from step 3 on: (weather, wrong).
        let mut b = Book::default();
        let mut got = Vec::new();
        for s in 0..6 {
            let ups = if s >= 3 { 1.0 } else { 0.0 };
            b.sync(s as f64 * STEP + 0.01, ups);
            got.push((b.step, b.cur, b.wrong));
        }
        assert_eq!(got, vec![(0, 0, false), (1, 2, false), (2, 1, false), (3, 0, false), (4, 2, true), (5, 1, true)]);
        // Step 1's wind: mix(10) % 8 = 0, so an eighth of a half turn.
        b = Book::default();
        b.sync(STEP, 0.0);
        assert!((b.dir.x - 0.9238795325112867).abs() < 1e-12 && (b.dir.z - 0.3826834323650898).abs() < 1e-12);
        assert!((b.to_change - STEP).abs() < 1e-12);
    }

    #[test]
    fn a_new_round_starts_the_book_over() {
        let mut b = Book::default();
        b.sync(30.0, 2.0);
        assert_eq!(b.step, 3);
        b.sync(0.0, 0.0);
        assert_eq!(b.step, 0);
        assert_eq!(b.cur, (mix(0) % 3) as u8);
    }
}
