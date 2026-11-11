//! Isolde, the Winter Warden. Ports of her passive (`src/traits/frost.ts`) and of the rules inside her four spells
//! (`src/spells/targeted/icicle.ts`, `hoarfrost.ts`, `rimeArmour.ts`, `wintersShatter.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.

use crate::bolt::{bolt_width, BoltSpec, Side};
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::{blocks_sight, V2};
use crate::hero::HeroState;
use crate::status::Status;
use crate::zone::{Shape, Zone};

// src/traits/frost.ts
const CHILL_MAX: f64 = 5.0;
const CHILL_SECONDS: f64 = 4.0;
const SLOW_AT: f64 = 3.0;
const SLOW_SECONDS: f64 = 2.0;
const FREEZE_SECONDS: f64 = 0.9;
const FREEZE_MUL: f64 = 1.3;
const CHILL_ATTACK: f64 = 1.0;
const CHILL_ICICLE: f64 = 2.0;
const CHILL_SHATTER: f64 = 1.0;
const CHILL_HOARFROST: f64 = 2.0;
const CHILL_RIME: f64 = 2.0;
const ICICLE_RANGE: f64 = 11.0;
const ICICLE_SPEED: f64 = 22.0;
const ICICLE_WIND: f64 = 0.3;
const ICICLE_STAY: f64 = 2.0;
const SHATTER_RADIUS: f64 = 2.0;
const RIME_SECONDS: f64 = 3.0;
const WINTER_WIND: f64 = 0.8;
const WINTER_PER_CHILL: f64 = 30.0;

/// The icicle her Q leaves standing (`IcicleRecord`). Its times are the page's clock in milliseconds
/// (`performance.now()`), as in the game: see `World::now_ms` for why that is kept apart from the round's clock.
#[derive(Clone, Copy, Debug)]
struct IcicleRecord {
    x: f64,
    z: f64,
    cast_at: f64,
    /// When the bolt reaches the end of its flight and sticks; `until`: 2 s later.
    born_at: f64,
    until: f64,
    /// The recast was pressed.
    shattered: bool,
    /// The icicle is spent.
    gone: bool,
}

#[derive(Clone, Debug, Default)]
pub struct State {
    rime_until: f64,
    frozen_until: f64,
    icicle: Option<IcicleRecord>,
}

fn st(w: &World, s: Side) -> &State {
    match &w.hs[s.i()] {
        HeroState::Frost(x) => x,
        _ => unreachable!("Isolde's state"),
    }
}

fn st_mut(w: &mut World, s: Side) -> &mut State {
    match &mut w.hs[s.i()] {
        HeroState::Frost(x) => x,
        _ => unreachable!("Isolde's state"),
    }
}

fn rime_on(w: &World, s: Side) -> bool {
    w.time < st(w, s).rime_until
}

/// While the enemy is frozen it gains no Chill at all.
fn frozen(w: &World, s: Side) -> bool {
    w.time < st(w, s).frozen_until
}

/// The computer player shatters the icicle only when the enemy stands inside its ring, not the moment the recast opens.
pub fn ai_hold(w: &World, s: Side, slot: usize) -> bool {
    if slot != 0 {
        return false;
    }
    match st(w, s).icicle {
        Some(r) if !r.gone && !r.shattered && w.now_ms < r.until => w.pos(s.other()).dist(V2::new(r.x, r.z)) > SHATTER_RADIUS - 0.2,
        _ => false,
    }
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    if slot != 2 {
        return;
    }
    let until = w.time + RIME_SECONDS;
    st_mut(w, s).rime_until = until;
    w.rt[s.i()].show("rime", 1.0);
}

pub fn tick(w: &mut World, s: Side, _dt: f64) {
    if st(w, s).rime_until != 0.0 && !rime_on(w, s) {
        st_mut(w, s).rime_until = 0.0;
        w.rt[s.i()].show("rime", 0.0);
    }
}

/// Rime Armour: a basic attack that hits her gives the attacker 2 Chill.
pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    if !rime_on(w, s) || hit.kind != Kind::Attack || hit.blocked || frozen(w, s) {
        return;
    }
    w.rt[s.i()].add_stacks("chill", CHILL_RIME, CHILL_SECONDS, CHILL_MAX);
}

pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if !hit.victim_is_hero || (hit.kind != Kind::Spell && hit.kind != Kind::Attack) {
        return;
    }
    let chill = w.rt[s.i()].stacks("chill");
    // R spends the Chill: no freeze, no new Chill, no slow.
    if hit.kind == Kind::Spell && hit.slot == Some(3) {
        if chill > 0.0 {
            hit.damage += WINTER_PER_CHILL * chill;
            w.rt[s.i()].clear_stacks("chill");
        }
        return;
    }
    if chill >= CHILL_MAX {
        // The freeze: this hit deals 30% more and stuns, the Chill clears, and nothing more is added until it ends.
        hit.damage *= FREEZE_MUL;
        hit.opts.status = Some((Status::Stun, FREEZE_SECONDS));
        w.rt[s.i()].clear_stacks("chill");
        let until = w.time + FREEZE_SECONDS;
        st_mut(w, s).frozen_until = until;
        return;
    }
    if frozen(w, s) {
        return;
    }
    // Chill this hit adds: a basic attack 1; Q 2 (its Shatter 1); W 2; nothing else.
    let add = if hit.kind == Kind::Attack {
        CHILL_ATTACK
    } else if hit.slot == Some(0) {
        if st(w, s).icicle.map_or(false, |r| r.shattered) { CHILL_SHATTER } else { CHILL_ICICLE }
    } else if hit.slot == Some(1) {
        CHILL_HOARFROST
    } else {
        0.0
    };
    let n = w.rt[s.i()].add_stacks("chill", add, CHILL_SECONDS, CHILL_MAX);
    if n >= SLOW_AT && hit.opts.status.is_none() && hit.mods.status.is_none() {
        hit.opts.status = Some((Status::Slow, SLOW_SECONDS));
    }
}

// --- the spells ----------------------------------------------------------------------------------------------

// src/spells/targeted/icicle.ts
const SHATTER_T: f64 = 0.15;
const ICICLE_TAIL: f64 = 0.9;
const SHATTER_DURATION: f64 = 1.0;
const FIZZLE_DURATION: f64 = 0.6;
const ICICLE_BOLT_RADIUS: f64 = 0.35;
/// A cast inside this after an unshattered first cast is the Shatter (milliseconds).
const ICICLE_RECAST_CLOCK: f64 = 3000.0;
const ICICLE_STEP: f64 = 0.1;
const ICICLE_KNOCK: f64 = 1.0;

/// How far down the line from `o` the icicle gets (the engine's own sight test, stepped), at most the range.
fn reach(o: V2, fwd: V2, w: &World) -> f64 {
    if w.cover.is_empty() {
        return ICICLE_RANGE;
    }
    let mut s = ICICLE_STEP;
    while s <= ICICLE_RANGE + 1e-6 {
        if blocks_sight(o, V2::new(o.x + fwd.x * s, o.z + fwd.z * s), &w.cover) {
            return (s - ICICLE_STEP).max(0.0);
        }
        s += ICICLE_STEP;
    }
    ICICLE_RANGE
}

/// Q Icicle: a piercing bolt that sticks in the floor at the end of its flight; cast again, it shatters there.
#[derive(Clone, Debug, Default)]
pub struct Icicle {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    shatter: bool,
    /// The Shatter has an icicle to break.
    live: bool,
    len: f64,
    spot: V2,
    fired: bool,
    burst: bool,
}

impl Icicle {
    pub fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let now = w.now_ms;
        let prev = st(w, ctx.side).icicle;
        let shatter = matches!(prev, Some(r) if !r.shattered && now - r.cast_at < ICICLE_RECAST_CLOCK);
        let (o, fwd) = (ctx.from, ctx.fwd());
        let len = reach(o, fwd, w);
        let (mut live, spot);
        if shatter {
            let mut rec = prev.unwrap();
            live = !rec.gone && now >= rec.born_at && now < rec.until;
            rec.shattered = true;
            if live {
                rec.gone = true;
            }
            spot = V2::new(rec.x, rec.z);
            st_mut(w, ctx.side).icicle = Some(rec);
        } else {
            live = false;
            spot = V2::new(o.x + fwd.x * len, o.z + fwd.z * len);
            let born_at = now + (ICICLE_WIND + len / ICICLE_SPEED) * 1000.0;
            st_mut(w, ctx.side).icicle = Some(IcicleRecord { x: spot.x, z: spot.z, cast_at: now, born_at, until: born_at + ICICLE_STAY * 1000.0, shattered: false, gone: false });
        }
        if !shatter {
            live = false;
        }
        *self = Icicle { ctx: Some(ctx), time: 0.0, playing: true, shatter, live, len, spot, fired: false, burst: false };
    }

    pub fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        if self.shatter {
            return if self.live { vec![Zone { shape: Shape::Circle { x: self.spot.x, z: self.spot.z, radius: SHATTER_RADIUS }, start: 0.0, impact: SHATTER_T, until: None }] } else { Vec::new() };
        }
        let line = Shape::Line { x1: c.from.x, z1: c.from.z, x2: self.spot.x, z2: self.spot.z, width: bolt_width(ICICLE_BOLT_RADIUS) };
        vec![Zone { shape: line, start: 0.0, impact: ICICLE_WIND, until: Some(ICICLE_WIND + self.len / ICICLE_SPEED) }]
    }

    fn duration(&self) -> f64 {
        if self.shatter {
            return if self.live { SHATTER_DURATION } else { FIZZLE_DURATION };
        }
        ICICLE_WIND + self.len / ICICLE_SPEED + ICICLE_TAIL
    }

    pub fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= self.duration() {
            self.playing = false;
            return;
        }
        let spell = &w.kits[c.side.i()].spells[c.slot];
        let (damage, shatter_damage) = (spell.num("damage"), spell.num("shatterDamage"));
        if self.shatter {
            // The standing icicle cracks, then bursts and hits whoever stands within 2 m of the spot now.
            if !self.live || self.burst || self.time < SHATTER_T {
                return;
            }
            self.burst = true;
            if w.hp(c.side.other()) > 0.0 && w.pos(c.side.other()).dist(self.spot) <= SHATTER_RADIUS {
                w.spell_hit(&c, Hit { damage: shatter_damage, knock: Some(0.6), from: Some(self.spot), projectile: true, ..Hit::default() });
            }
            return;
        }
        if !self.fired && self.time >= ICICLE_WIND {
            self.fired = true;
            let hit = Hit { damage, knock: Some(ICICLE_KNOCK), ..Hit::default() };
            w.fire(&c, BoltSpec { pierce: true, ..BoltSpec::plain(c.from, c.fwd(), ICICLE_SPEED, ICICLE_RANGE, ICICLE_BOLT_RADIUS, hit) });
        }
    }
}

// src/spells/targeted/hoarfrost.ts
const HOAR_HIT: f64 = 0.45;
const HOAR_DURATION: f64 = 1.4;
const HOAR_MARK_R: f64 = 1.1;

/// W Hoarfrost: a sure hit on the enemy she clicked, 0.45 s after the cast.
#[derive(Clone, Debug, Default)]
pub struct Hoarfrost {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    hit: bool,
    /// The enemy's feet at the cast: where the warning ring is drawn.
    mark: V2,
}

impl Hoarfrost {
    pub fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let mark = if ctx.has_target { w.pos(ctx.side.other()) } else { ctx.point };
        *self = Hoarfrost { ctx: Some(ctx), time: 0.0, playing: true, hit: false, mark };
    }

    pub fn zones(&self) -> Vec<Zone> {
        vec![Zone { shape: Shape::Circle { x: self.mark.x, z: self.mark.z, radius: HOAR_MARK_R }, start: 0.0, impact: HOAR_HIT, until: None }]
    }

    pub fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= HOAR_DURATION {
            self.playing = false;
            return;
        }
        if !self.hit && self.time >= HOAR_HIT {
            self.hit = true;
            if c.has_target {
                let (damage, from) = (w.kits[c.side.i()].spells[c.slot].num("damage"), w.pos(c.side));
                w.spell_hit(&c, Hit { damage, knock: Some(0.0), from: Some(from), projectile: true, ..Hit::default() });
            }
        }
    }
}

// src/spells/targeted/wintersShatter.ts
const WINTER_DURATION: f64 = WINTER_WIND + 0.9;
const WINTER_FIZZLE_END: f64 = WINTER_WIND + 0.4;
const WINTER_MARK_R: f64 = 1.2;

/// R Winter's Shatter: after the wind-up the strike lands on the enemy, if she still has sight of them.
#[derive(Clone, Debug, Default)]
pub struct WintersShatter {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    checked: bool,
    fizzled: bool,
    mark: V2,
}

impl WintersShatter {
    pub fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let mark = if ctx.has_target { w.pos(ctx.side.other()) } else { ctx.point };
        *self = WintersShatter { ctx: Some(ctx), time: 0.0, playing: true, checked: false, fizzled: false, mark };
    }

    pub fn zones(&self) -> Vec<Zone> {
        vec![Zone { shape: Shape::Circle { x: self.mark.x, z: self.mark.z, radius: WINTER_MARK_R }, start: 0.0, impact: WINTER_WIND, until: None }]
    }

    pub fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= (if self.fizzled { WINTER_FIZZLE_END } else { WINTER_DURATION }) {
            self.playing = false;
            return;
        }
        if !self.checked && self.time >= WINTER_WIND {
            self.checked = true;
            let (me, foe) = (w.pos(c.side), w.pos(c.side.other()));
            // The wind-up ends without sight of the enemy: it fizzles (the plain sight test, every obstacle counts).
            if c.has_target && blocks_sight(me, foe, &w.cover) {
                self.fizzled = true;
            } else if c.has_target {
                let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
                w.spell_hit(&c, Hit { damage, knock: Some(2.5), from: Some(me), projectile: true, ..Hit::default() });
            }
        }
    }
}
