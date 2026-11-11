//! Sirix, the Swarm Warden. Ports of his passive (`src/traits/hive.ts`) and of the rules inside his four spells
//! (`src/spells/targeted/barbedStinger.ts`, `hiveShell.ts`, `swarmCloud.ts`, `swarmSurge.ts`).
//!
//! Damage numbers that are a spell's own settings come from the game's export (`Spell::num`). The numbers below are
//! constants inside those files, mirrored here BY HAND: when one of the files changes, this file must follow.
//!
//! Habits of the game that are kept here, none of them written down in the game:
//! - Barbed Stinger tells its leap from a stinger by the PAGE's clock (`performance.now()`, 3.3 s after a stinger),
//!   while the recast window runs on the round's clock (3 s), and it leaps only when the barb came after the last
//!   Barbed Stinger (`barbedAt`, the page's clock). The passive's own test for the leap's poison is another one again
//!   (the round's clock, 8.3 m); the effect's is 8.6 m. All kept.
//! - The leap's landing circle is the same object the duel judges the hit by: when the dash lands elsewhere than aimed
//!   (cover, the ring), the zone moves with it (`World::reshape_zone`).
//! - Swarm Surge decides its shove when the bolt touches (getters on the hit options): a pull of 4 m toward a point
//!   5 m behind the victim, on the line from where Sirix stood at the cast. The port sets it in `dealt`, the first
//!   thing `resolve` runs, with the same live positions.
//! - A cloud or a surge with no wasps still hits for 0 and blinds (the computer player never casts them so).

use crate::bolt::{bolt_width, BoltSpec, Side};
use crate::fight::{Ctx, Kind, THit, World};
use crate::figure::Hit;
use crate::geom::V2;
use crate::hero::{self, Hero, Landed, Quiet, Spell, PLAIN};
use crate::status::Status;
use crate::zone::{Shape, Zone};

// src/traits/hive.ts
const MAX_WASPS: f64 = 6.0;
const WASP_EVERY: f64 = 2.0;
const BARB_SECONDS: f64 = 3.0;
const LEAP_WINDOW: f64 = 3.0;
const LEAP_RANGE: f64 = 8.0;
const STINGER_KNOCK: f64 = 1.25;
const SHELL_SECONDS: f64 = 3.0;
const SHELL_STING: f64 = 15.0;
const CLOUD_SECONDS: f64 = 3.0;

#[derive(Clone, Debug, Default)]
pub struct State {
    // the passive's `mem`, on the round's clock
    wasps: f64,
    next_wasp: Option<f64>,
    cloud_until: f64,
    cloud_took: f64,
    shell_until: f64,
    q_at: Option<f64>,
    barb_until: f64,
    sting: f64,
    // the records kept per caster figure (`WeakMap`s), on the page's clock where the game uses it
    /// `barbedAt`: when the last stinger barbed the enemy (ms).
    barbed_at: Option<f64>,
    /// `leapPoison`: the leap just cast also poisons.
    leap_poison: bool,
    /// `cloudWasps`, `surgeWasps`.
    cloud_wasps: Option<f64>,
    surge_wasps: Option<f64>,
    /// `lastCast` in barbedStinger.ts: when Barbed Stinger was last cast (ms) and whether that cast was the stinger.
    last_q: Option<(f64, bool)>,
    /// Where Sirix stood at the last Swarm Surge (the effect's `from`): its shove's source.
    surge_from: V2,
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
        0 => Box::new(BarbedStinger::default()),
        // Hive Shell only draws: the kit's armour and the passive's stings do the work.
        1 => Box::new(Quiet),
        2 => Box::new(SwarmCloud::default()),
        _ => Box::new(SwarmSurge::default()),
    }
}

pub const HERO: Hero = Hero { name: "Sirix", state: new_state, spell, ai_hold, after_cast, recast_act, landed, dealt, taken, tick, ..PLAIN };

/// The one place the count changes (`setWasps`).
fn set_wasps(w: &mut World, s: Side, n: f64) {
    let v = n.round().clamp(0.0, MAX_WASPS);
    st_mut(w, s).wasps = v;
    w.rt[s.i()].show("wasps", v);
}

fn gain(w: &mut World, s: Side) {
    let n = st(w, s).wasps + 1.0;
    set_wasps(w, s, n);
}

/// Spends up to `n` wasps; returns how many went.
fn spend(w: &mut World, s: Side, n: f64) -> f64 {
    let have = st(w, s).wasps;
    let k = n.min(have);
    set_wasps(w, s, have - k);
    k
}

pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    let x = st(w, s);
    if slot == 3 {
        return x.wasps < 4.0;
    }
    if slot == 2 {
        return x.wasps < 3.0;
    }
    // While the leap is open the CPU takes it only on a barbed enemy it can reach.
    if slot == 0 {
        if let Some(q) = x.q_at {
            if w.time - q < LEAP_WINDOW {
                return !(w.time < x.barb_until && dist <= LEAP_RANGE - 0.5);
            }
        }
    }
    false
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    let now = w.time;
    match slot {
        0 => st_mut(w, s).q_at = Some(now),
        1 => {
            st_mut(w, s).shell_until = now + SHELL_SECONDS;
            w.rt[s.i()].show("shell", 1.0);
        }
        2 => {
            // Every wasp goes to the cloud; they come back when it ends.
            let n = spend(w, s, MAX_WASPS);
            let x = st_mut(w, s);
            x.cloud_took = n;
            x.cloud_until = now + CLOUD_SECONDS;
            x.cloud_wasps = Some(n);
        }
        3 => {
            // Every wasp is loosed down the column and none comes back.
            let n = spend(w, s, MAX_WASPS);
            st_mut(w, s).surge_wasps = Some(n);
        }
        _ => {}
    }
}

pub fn recast_act(w: &mut World, s: Side, slot: usize) {
    if slot != 0 {
        return;
    }
    // The leap needs a barbed enemy in reach: otherwise the effect does nothing and no wasp is spent.
    let ok = w.time < st(w, s).barb_until && w.enemy_distance(s) <= LEAP_RANGE + 0.3;
    let poison = ok && st(w, s).wasps >= 2.0;
    if poison {
        spend(w, s, 2.0);
    }
    st_mut(w, s).leap_poison = poison;
}

pub fn landed(w: &mut World, s: Side, hit: Landed) {
    if hit.kind == Kind::Attack {
        gain(w, s);
    }
}

pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    if hit.kind == Kind::Spell && hit.slot == Some(3) && hit.opts.projectile {
        shove(w, s, hit);
        return;
    }
    if hit.kind != Kind::Spell || hit.slot != Some(0) || !hit.victim_is_hero || !hit.opts.projectile || hit.opts.knock != Some(STINGER_KNOCK) {
        return;
    }
    w.rt[s.i()].add_stacks("barb", 1.0, BARB_SECONDS, 1.0);
    // `noteOwner('barbed')`: offline it is his own `peerNote` at once.
    let (time, now) = (w.time, w.now_ms);
    let x = st_mut(w, s);
    x.barb_until = time + BARB_SECONDS;
    x.barbed_at = Some(now);
}

/// Swarm Surge's shove (`SwarmSurge.push` with `shapeMove(.., high = true, ..)`), read when the bolt touches: from the
/// caster's start, on the enemy nearest the bolt within 3 m (the bolt touches within its 1.58 m radius and a body, so
/// that is always the victim).
fn shove(w: &mut World, s: Side, hit: &mut THit) {
    let src = st(w, s).surge_from;
    let v = w.pos(s.other());
    let (mut ax, mut az) = (v.x - src.x, v.z - src.z);
    let mut l = ax.hypot(az);
    if l < 1e-3 {
        // (the caster's start again: the game's fallback is the same point)
        ax = v.x - src.x;
        az = v.z - src.z;
        l = ax.hypot(az);
        if l == 0.0 {
            l = 1.0;
        }
    }
    let m = SURGE_SHOVE.min(4.0);
    hit.opts.knock = Some(0.0);
    hit.opts.pull = m;
    hit.opts.from = Some(V2::new(v.x + ax / l * (m + 1.0), v.z + az / l * (m + 1.0)));
}

/// His own client: the shell trades a wasp for a sting at the attacker.
pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    if hit.blocked || hit.kind == Kind::Trait {
        return;
    }
    if w.time >= st(w, s).shell_until || st(w, s).wasps < 1.0 {
        return;
    }
    spend(w, s, 1.0);
    st_mut(w, s).sting += 1.0;
    w.trait_hit(s, Hit { damage: SHELL_STING, knock: Some(0.0), ..Hit::default() });
}

pub fn tick(w: &mut World, s: Side, _dt: f64) {
    let now = w.time;
    if st(w, s).shell_until != 0.0 && now >= st(w, s).shell_until {
        st_mut(w, s).shell_until = 0.0;
        w.rt[s.i()].show("shell", 0.0);
    }
    let x = st(w, s).clone();
    if now < x.cloud_until {
        // His wasps are in the cloud: no gain from the clock.
        st_mut(w, s).next_wasp = Some(x.cloud_until + WASP_EVERY);
    } else if x.cloud_until != 0.0 {
        st_mut(w, s).cloud_until = 0.0;
        set_wasps(w, s, x.wasps + x.cloud_took);
        st_mut(w, s).cloud_took = 0.0;
    } else if x.wasps >= MAX_WASPS {
        st_mut(w, s).next_wasp = Some(now + WASP_EVERY);
    } else if now >= x.next_wasp.unwrap_or(WASP_EVERY) {
        gain(w, s);
        st_mut(w, s).next_wasp = Some(now + WASP_EVERY);
    }
    let n = st(w, s).wasps;
    w.rt[s.i()].show("wasps", n);
}

// --- the spells ----------------------------------------------------------------------------------------------

// src/spells/targeted/barbedStinger.ts
const RELEASE_T: f64 = 0.25;
const STING_SPEED: f64 = 20.0;
const STING_RANGE: f64 = 8.0;
const STING_RADIUS: f64 = 0.4;
const STING_MUZZLE: f64 = 0.7;
const STING_END: f64 = 1.4;
const LEAP_S: f64 = 0.3;
const LAND_R: f64 = 2.4;
const STOP_SHORT: f64 = 1.3;
const TICKS: f64 = 3.0;
const NONE_END: f64 = 0.3;
/// A second cast inside this after a stinger is the recast (ms).
const RECAST_CLOCK: f64 = (LEAP_WINDOW + 0.3) * 1000.0;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
enum Mode {
    #[default]
    Sting,
    Leap,
    None,
}

/// Q Barbed Stinger: a skillshot that barbs; cast again on a barbed enemy, a leap onto them.
#[derive(Clone, Debug, Default)]
pub struct BarbedStinger {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    mode: Mode,
    len: f64,
    fwd: V2,
    land: V2,
    /// The enemy hero is the leap's victim.
    victim: bool,
    poison: bool,
    fired: bool,
    leapt: bool,
    hit: bool,
    ticks: f64,
}

impl BarbedStinger {
    fn circle(&self) -> Shape {
        Shape::Circle { x: self.land.x, z: self.land.z, radius: LAND_R }
    }
}

impl Spell for BarbedStinger {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let now = w.now_ms;
        let from = ctx.from;
        let x = st(w, ctx.side);
        let prev = x.last_q;
        // NOT PORTED: in the game these records are kept per caster FIGURE, and the player's figure is the same from
        // fight to fight on a page (the opponent's is new each fight). So a stinger the player's Sirix cast in the
        // last 3.3 s of the page's clock before a fight ended makes his first Barbed Stinger of the NEXT fight a leap
        // (or nothing). Here the records start empty with every fight, as Kaia's Thunder Rod does in `storm.rs`.
        let open = matches!(prev, Some((at, sting)) if sting && now - at < RECAST_CLOCK);
        let barbed = x.barbed_at.unwrap_or(0.0) > prev.map_or(0.0, |p| p.0);
        let leap_poison = x.leap_poison;
        let (mut mode, mut victim, mut poison) = (Mode::Sting, false, false);
        if open {
            // The recast: only on a barbed enemy within 8 m (the one nearest the cast, live).
            let foe = w.pos(ctx.side.other());
            victim = barbed && w.hp(ctx.side.other()) > 0.0 && foe.dist(from) <= LEAP_RANGE + 0.6;
            mode = if victim { Mode::Leap } else { Mode::None };
            poison = mode == Mode::Leap && leap_poison;
        }
        st_mut(w, ctx.side).last_q = Some((now, mode == Mode::Sting));
        let mut fwd = ctx.fwd();
        let mut land = V2::default();
        if mode == Mode::Leap {
            let p = w.pos(ctx.side.other());
            let (dx, dz) = (p.x - from.x, p.z - from.z);
            let d = dx.hypot(dz);
            let k = if d != 0.0 { d } else { 1.0 };
            fwd = V2::new(dx / k, dz / k);
            let go = (d - STOP_SHORT).max(0.0);
            land = V2::new(from.x + fwd.x * go, from.z + fwd.z * go);
        }
        let len = match mode {
            Mode::Sting => STING_END,
            Mode::None => NONE_END,
            Mode::Leap => if poison { LEAP_S + TICKS + 0.4 } else { 1.0 },
        };
        *self = BarbedStinger { ctx: Some(ctx), time: 0.0, playing: true, mode, len, fwd, land, victim, poison, fired: false, leapt: false, hit: false, ticks: 0.0 };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        match self.mode {
            Mode::Leap => vec![Zone { shape: self.circle(), start: 0.0, impact: LEAP_S, until: None }],
            Mode::None => Vec::new(),
            Mode::Sting => {
                let line = Shape::Line { x1: c.from.x, z1: c.from.z, x2: c.from.x + self.fwd.x * STING_RANGE, z2: c.from.z + self.fwd.z * STING_RANGE, width: bolt_width(STING_RADIUS) };
                vec![Zone { shape: line, start: 0.0, impact: RELEASE_T, until: Some(RELEASE_T + STING_RANGE / STING_SPEED) }]
            }
        }
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= self.len {
            self.playing = false;
            return;
        }
        let t = self.time;
        match self.mode {
            Mode::Sting => {
                if t >= RELEASE_T && !self.fired {
                    self.fired = true;
                    let tip = V2::new(c.from.x + self.fwd.x * STING_MUZZLE, c.from.z + self.fwd.z * STING_MUZZLE);
                    let damage = w.kits[c.side.i()].spells[c.slot].num("damage");
                    let hit = Hit { damage, knock: Some(STINGER_KNOCK), ..Hit::default() };
                    w.fire(&c, BoltSpec::plain(tip, self.fwd, STING_SPEED, STING_RANGE - STING_MUZZLE, STING_RADIUS, hit));
                }
            }
            Mode::Leap => self.update_leap(w, &c, t),
            Mode::None => {}
        }
    }
}

impl BarbedStinger {
    fn update_leap(&mut self, w: &mut World, c: &Ctx, t: f64) {
        if !self.leapt {
            self.leapt = true;
            self.land = w.move_to(c.side, self.land, LEAP_S);
            w.reshape_zone(c.side, c.cast, 0, self.circle());
        }
        if !self.hit && t >= LEAP_S {
            self.hit = true;
            // Live positions at the landing: everyone inside the circle takes it.
            let foe = w.pos(c.side.other());
            if w.hp(c.side.other()) > 0.0 && self.circle().contains(foe.x, foe.z) {
                let damage = w.kits[c.side.i()].spells[c.slot].num("leapDamage");
                w.spell_hit(c, Hit { damage, knock: Some(2.0), from: Some(self.land), ..Hit::default() });
            }
        }
        if self.hit {
            // The poison: three small ticks 1, 2 and 3 s after the landing, on the leap's victim wherever it is.
            let a = t - LEAP_S;
            if self.poison && self.victim && self.ticks < TICKS && a >= self.ticks + 1.0 {
                self.ticks += 1.0;
                let damage = w.kits[c.side.i()].spells[c.slot].num("poison") / TICKS;
                w.spell_hit(c, Hit { damage, knock: Some(0.0), projectile: true, ..Hit::default() });
            }
        }
    }
}

// src/spells/targeted/swarmCloud.ts
const CLOUD_RANGE: f64 = 9.0;
const FIRST_TICK: f64 = 1.0;
const CLOUD_END: f64 = CLOUD_SECONDS;
const CLOUD_DURATION: f64 = CLOUD_END + 0.45 + 0.2;
const CLOUD_RADIUS: f64 = 2.5;
const CLOUD_BLIND: f64 = 1.0;

/// E Swarm Cloud: every wasp hangs over a spot for 3 s and stings whoever stands in it each second, and blinds them.
#[derive(Clone, Debug, Default)]
pub struct SwarmCloud {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    spot: V2,
    count: f64,
    ticks: f64,
}

impl SwarmCloud {
    fn circle(&self) -> Shape {
        Shape::Circle { x: self.spot.x, z: self.spot.z, radius: CLOUD_RADIUS }
    }
}

impl Spell for SwarmCloud {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        // The spot, limited to the spell's range.
        let (mut vx, mut vz) = (ctx.point.x - ctx.from.x, ctx.point.z - ctx.from.z);
        let l = vx.hypot(vz);
        if l > CLOUD_RANGE {
            vx *= CLOUD_RANGE / l;
            vz *= CLOUD_RANGE / l;
        }
        let spot = V2::new(ctx.from.x + vx, ctx.from.z + vz);
        // The passive spent the wasps just before this and wrote how many.
        let count = st(w, ctx.side).cloud_wasps.unwrap_or(MAX_WASPS).clamp(0.0, MAX_WASPS);
        *self = SwarmCloud { ctx: Some(ctx), time: 0.0, playing: true, spot, count, ticks: 0.0 };
    }

    fn zones(&self) -> Vec<Zone> {
        if self.ctx.is_none() {
            return Vec::new();
        }
        vec![Zone { shape: self.circle(), start: 0.0, impact: FIRST_TICK, until: Some(CLOUD_END) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= CLOUD_DURATION {
            self.playing = false;
            return;
        }
        // Ticks: 7 per wasp to everyone inside, live positions, and blind.
        if self.ticks < 3.0 && self.time >= FIRST_TICK + self.ticks {
            self.ticks += 1.0;
            let damage = w.kits[c.side.i()].spells[c.slot].num("perWasp") * self.count;
            let foe = w.pos(c.side.other());
            if w.hp(c.side.other()) > 0.0 && self.circle().contains(foe.x, foe.z) {
                w.spell_hit(&c, Hit { damage, knock: Some(0.0), status: Some((Status::Blind, CLOUD_BLIND)), ..Hit::default() });
            }
        }
    }
}

// src/spells/targeted/swarmSurge.ts
const SURGE_RELEASE: f64 = 0.5;
const SURGE_SPEED: f64 = 12.0;
const SURGE_LENGTH: f64 = 10.0;
const SURGE_WIDTH: f64 = 4.0;
const SURGE_MUZZLE: f64 = 0.6;
const SURGE_SHOVE: f64 = 4.0;
const SURGE_BLIND: f64 = 1.0;
const SURGE_END: f64 = SURGE_RELEASE + SURGE_LENGTH / SURGE_SPEED + 0.7;

/// R Swarm Surge: a wide piercing column of every wasp he holds; it shoves and blinds.
#[derive(Clone, Debug, Default)]
pub struct SwarmSurge {
    ctx: Option<Ctx>,
    time: f64,
    playing: bool,
    count: f64,
    fired: bool,
}

impl Spell for SwarmSurge {
    fn cast(&mut self, w: &mut World, ctx: Ctx) {
        let count = st(w, ctx.side).surge_wasps.unwrap_or(MAX_WASPS).clamp(0.0, MAX_WASPS);
        st_mut(w, ctx.side).surge_from = ctx.from;
        *self = SwarmSurge { ctx: Some(ctx), time: 0.0, playing: true, count, fired: false };
    }

    fn zones(&self) -> Vec<Zone> {
        let Some(c) = self.ctx else { return Vec::new() };
        let f = c.fwd();
        let line = Shape::Line { x1: c.from.x, z1: c.from.z, x2: c.from.x + f.x * SURGE_LENGTH, z2: c.from.z + f.z * SURGE_LENGTH, width: SURGE_WIDTH };
        vec![Zone { shape: line, start: 0.0, impact: SURGE_RELEASE, until: Some(SURGE_RELEASE + SURGE_LENGTH / SURGE_SPEED) }]
    }

    fn update(&mut self, w: &mut World, dt: f64) {
        let Some(c) = self.ctx.filter(|_| self.playing) else { return };
        self.time += dt;
        if self.time >= SURGE_END {
            self.playing = false;
            return;
        }
        if !self.fired && self.time >= SURGE_RELEASE {
            self.fired = true;
            let f = c.fwd();
            let tip = V2::new(c.from.x + f.x * SURGE_MUZZLE, c.from.z + f.z * SURGE_MUZZLE);
            let damage = w.kits[c.side.i()].spells[c.slot].num("perWasp") * self.count;
            // `pull` and `from` are getters in the game, read at the touch: see `shove` (in `dealt`).
            let hit = Hit { damage, knock: Some(0.0), pull: SURGE_SHOVE.min(4.0), status: Some((Status::Blind, SURGE_BLIND)), ..Hit::default() };
            w.fire(&c, BoltSpec { pierce: true, ..BoltSpec::plain(tip, f, SURGE_SPEED, SURGE_LENGTH - SURGE_MUZZLE, SURGE_WIDTH / 2.0 - 0.42, hit) });
        }
    }
}
