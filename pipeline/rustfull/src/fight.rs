//! One duel, frame by frame, in the game's own order. A port of what `step` in `src/runtime.ts` runs for a simulated
//! fight: the spells that are playing, the arena (bolts, statuses, dashes, shields), the player's hero (`heroMode.update`)
//! and the duel (`Duel.update` in `src/duel.ts`: the passives, the round's end, then the two computer players).
//!
//! The game has TWO computer players and they are not the same (docs/pipeline/rust-sim.md): `ai` plays the opponent,
//! `pilot` plays the player's hero in a simulated fight. Both are here, each with what it does on its own.
//!
//! NOT ported yet, and each one stops the program instead of passing silently: summoned units, breakable walls (the
//! Night Temple), arena events and closing stages, spells that dash, flee or summon, charges, hold-to-charge slots.

use crate::ai::{self, BoltDodge, CpuLevel, GuardRoll, Mode, Moment, Nav, Walk, BALANCE};
use crate::attack::{Attacker, Fired, Sight};
use crate::bolt::{BoltSpec, Bolts, Side, Touch, Victim};
use crate::data::{Arena, Kit};
use crate::figure::{Hit, Opponent, Player, Ring};
use crate::geom::{blocks_sight, contains, first_surface, Obstacle, V2};
use crate::hero::{self, Effect, HeroId, HeroState};
use crate::nav::{self, Navigator, Route};
use crate::status::{Buff, Status, StatusSet, BLIND_RADIUS};
use crate::zone::{Shape, Zone, CAST_MEMORY, DODGE_RADIUS};

/// A frame of a simulated fight (the simulator page steps the game at 60 a second).
pub const DT: f64 = 1.0 / 60.0;
/// A beat before either side moves when a round starts (`think`, `playerThink`).
const OPENING_BEAT: f64 = 1.2;
/// The height a homing basic-attack bolt starts at and flies to (`src/attacks`).
const SHOT_FROM_Y: f64 = 1.3;
const SHOT_HIT_Y: f64 = 1.05;

/// The fight's own random numbers (xorshift): the same seed plays the same fight.
#[derive(Clone, Debug)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ 0xD1B5_4A32_D192_ED03 | 1)
    }

    /// A number in 0..1.
    pub fn f(&mut self) -> f64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 / (1u64 << 53) as f64
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Spell,
    Attack,
    Unit,
    Trait,
}

/// What a cast (or a basic attack) carries to every hit it makes (`CastMods`).
#[derive(Clone, Copy, Debug)]
pub struct Mods {
    pub power: f64,
    pub status: Option<(Status, f64)>,
    pub debuff: Option<(Buff, f64, f64)>,
    pub knock: f64,
}

pub const NO_MODS: Mods = Mods { power: 1.0, status: None, debuff: None, knock: 0.0 };

/// A hit being resolved (`TraitHit`): the passives may change `damage`, `opts` and the cast's own `mods`.
#[derive(Clone, Copy, Debug)]
pub struct THit {
    pub kind: Kind,
    pub slot: Option<usize>,
    pub cast: Option<u32>,
    pub mods: Mods,
    pub damage: f64,
    pub opts: Hit,
    pub victim_is_hero: bool,
    pub blocked: bool,
}

/// Where a hit's mods come from, so a passive that changes them changes them for the rest of the cast, as in the game.
#[derive(Clone, Copy, Debug)]
pub enum ModSrc {
    None,
    Cast(u32),
    Attack,
}

/// A cast as the duel remembers it (`EnemyCast`, `heroCasts`, `playerCastsRecent`).
#[derive(Clone, Debug)]
pub struct Cast {
    pub seq: u32,
    pub slot: usize,
    pub t: f64,
    pub zones: Vec<Zone>,
    pub aimed: V2,
    pub mods: Mods,
}

impl Cast {
    /// `inCastReach`: inside a drawn shape if the cast has any, else near where it aimed.
    fn reaches(&self, p: V2) -> bool {
        if !self.zones.is_empty() {
            return self.zones.iter().any(|z| z.shape.contains(p.x, p.z));
        }
        p.dist(self.aimed) <= DODGE_RADIUS
    }
}

/// What a spell knows about its cast (`CastContext`). The only enemy is the other hero (no units yet).
#[derive(Clone, Copy, Debug)]
pub struct Ctx {
    pub side: Side,
    pub cast: u32,
    pub slot: usize,
    /// The caster's feet at the cast.
    pub from: V2,
    /// Yaw from the caster toward `point` (atan2(dx, dz)).
    pub aim: f64,
    pub point: V2,
    /// The enemy hero is among the cast's targets.
    pub has_target: bool,
    /// Where that target stood at the cast.
    pub target_pos: V2,
}

impl Ctx {
    pub fn fwd(&self) -> V2 {
        V2::new(self.aim.sin(), self.aim.cos())
    }
}

/// One side's passive bookkeeping (`TraitRuntime`): stacks it keeps on the enemy, what it shows, open recasts.
#[derive(Clone, Debug, Default)]
pub struct Runtime {
    pub still: f64,
    last_pos: Option<V2>,
    recast_clock: [f64; 4],
    stacks: Vec<(&'static str, f64, f64)>,
    own: Vec<(&'static str, f64)>,
}

impl Runtime {
    pub fn stacks(&self, name: &str) -> f64 {
        self.stacks.iter().find(|s| s.0 == name && s.2 > 0.0).map_or(0.0, |s| s.1)
    }

    pub fn add_stacks(&mut self, name: &'static str, n: f64, seconds: f64, max: f64) -> f64 {
        let next = (self.stacks(name) + n).clamp(0.0, max);
        self.stacks.retain(|s| s.0 != name);
        self.stacks.push((name, next, seconds));
        next
    }

    pub fn clear_stacks(&mut self, name: &str) {
        self.stacks.retain(|s| s.0 != name);
    }

    pub fn show(&mut self, name: &'static str, n: f64) {
        self.own.retain(|o| o.0 != name);
        if n != 0.0 {
            self.own.push((name, n));
        }
    }

    pub fn own(&self, name: &str) -> f64 {
        self.own.iter().find(|o| o.0 == name).map_or(0.0, |o| o.1)
    }

    fn tick_clocks(&mut self, dt: f64) {
        for s in self.stacks.iter_mut() {
            s.2 -= dt;
        }
        self.stacks.retain(|s| s.2 > 0.0);
        for c in self.recast_clock.iter_mut() {
            *c = (*c - dt).max(0.0);
        }
    }
}

/// What a side's computer player and its hero keep between frames. The player's side: `heroMode` and `pilot`; the
/// opponent's: the duel's own fields and `ai`.
#[derive(Clone, Debug)]
pub struct Ctl {
    pub cooldowns: [f64; 4],
    /// The cast's root: no walking, no attack, no new cast while it runs.
    pub rooted: f64,
    /// A passive's hold set during a cast's rules: a floor under the spell's own root.
    pub hold_floor: f64,
    pub think: f64,
    pub cast_wait: f64,
    pub attacker: Attacker,
    pub attack_mods: Mods,
    walk: Walk,
    route: Route,
    dodge: Vec<(u64, BoltDodge)>,
    guard_roll: GuardRoll,
}

impl Ctl {
    fn new(walk: Walk, route: Route) -> Self {
        Ctl { cooldowns: [0.0; 4], rooted: 0.0, hold_floor: 0.0, think: OPENING_BEAT, cast_wait: 0.0, attacker: Attacker::default(), attack_mods: NO_MODS, walk, route, dodge: Vec::new(), guard_roll: GuardRoll::default() }
    }
}

/// What the game does NOT reset between two fights on the same page: each computer player's walking state (which way
/// it strafes and for how long yet, whether it is closing in, its kept route). A fight starts with what the fight
/// before left. The very first starts with the game's own values: the player's side strafes the other way.
#[derive(Clone, Debug)]
pub struct Carry {
    walks: [Walk; 2],
    routes: [Route; 2],
}

impl Carry {
    /// As the page starts (`playerAi`, `opponentAi` in `src/duel.ts`).
    pub fn first() -> Carry {
        Carry { walks: [Walk { strafe: -1.0, ..Walk::default() }, Walk::default()], routes: [Route::default(), Route::default()] }
    }
}

/// A homing basic-attack bolt in flight (`AttackFx.bolt`): it lands when it reaches its target.
#[derive(Clone, Copy, Debug)]
struct Shot {
    side: Side,
    pos: (f64, f64, f64),
    speed: f64,
    hit: Hit,
    miss: bool,
}

/// The sources a hit is counted under, as the real simulator's record names them.
pub const SOURCES: [&str; 7] = ["Q", "W", "E", "R", "attack", "unit", "trait"];

/// One side's count for the record.
#[derive(Clone, Debug, Default)]
pub struct Tally {
    pub dealt: [f64; 7],
    pub hits: [u32; 7],
    pub casts: [u32; 4],
    /// The fight's second of the first cast of each slot, of the first hit that did damage, and of the first basic attack.
    pub first_cast: [Option<f64>; 4],
    pub first_hit: Option<f64>,
}

/// What `arena.walk` and `moveFoe` need of the arena for a computer player's steering.
struct ArenaNav<'a> {
    cover: &'a [Obstacle],
    ring: &'a Ring,
    navigator: &'a mut Navigator,
    route: &'a mut Route,
}

/// `arena.lineOfSight`: cover the target stands inside does not hide it.
pub fn line_of_sight(a: V2, b: V2, cover: &[Obstacle]) -> bool {
    if cover.iter().any(|o| contains(o, b.x, b.z)) {
        let rest: Vec<Obstacle> = cover.iter().filter(|o| !contains(o, b.x, b.z)).copied().collect();
        return !blocks_sight(a, b, &rest);
    }
    !blocks_sight(a, b, cover)
}

impl Nav for ArenaNav<'_> {
    fn sees(&self, a: V2, b: V2) -> bool {
        line_of_sight(a, b, self.cover)
    }

    fn path_clear(&self, a: V2, b: V2) -> bool {
        nav::clear(a, b, self.cover)
    }

    fn route(&mut self, a: V2, b: V2) -> V2 {
        self.navigator.step(self.route, a, b, self.cover, Some(self.ring)).point
    }
}

fn yaw_to(from: V2, to: V2) -> f64 {
    (to.x - from.x).atan2(to.z - from.z)
}

pub struct World {
    /// Seconds since the round started.
    pub time: f64,
    /// The page's clock in milliseconds (`performance.now()`), which some rules time themselves with instead of the
    /// round's clock. In a simulated fight it advances 1000/60 a frame from wherever the page's clock stood, and the
    /// two clocks do not round alike: a rule that compares one against the other at the very frame both run out falls
    /// either way (Isolde's icicle: see `hero/frost.rs`). So the port keeps both, as the game has them.
    pub now_ms: f64,
    pub cover: Vec<Obstacle>,
    pub ring: Ring,
    pub lv: CpuLevel,
    /// The two heroes: [the player's side, the opponent's].
    pub kits: [Kit; 2],
    pub ids: [HeroId; 2],
    pub hs: [HeroState; 2],
    pub rt: [Runtime; 2],
    pub ctl: [Ctl; 2],
    pub player: Player,
    pub opp: Opponent,
    pub bolts: Bolts,
    shots: Vec<Shot>,
    pub casts: [Vec<Cast>; 2],
    cast_seq: [u32; 2],
    /// The spells' effects, one per spell label as in the game (so in a mirror fight both sides share them).
    effects: Vec<Option<Effect>>,
    pub rng: Rng,
    /// The winner, once the round is over.
    pub over: Option<Side>,
    pub tally: [Tally; 2],
    navigator: Navigator,
    /// Every cast, hit and (twice a second) where both stand, when asked for: the same rows `probe.js` logs in the game.
    pub trace: Option<Vec<serde_json::Value>>,
    trace_p: f64,
    /// Every frame's state, when asked for: the rows `probe-frames.js` logs in the game.
    pub frames: Option<Vec<Vec<f64>>>,
}

fn status_name(k: Status) -> &'static str {
    match k {
        Status::Stun => "stun",
        Status::Root => "root",
        Status::Slow => "slow",
        Status::Silence => "silence",
        Status::Blind => "blind",
        Status::Knockup => "knockup",
        Status::Charm => "charm",
        Status::Sealed => "sealed",
    }
}

impl World {
    /// What the next fight on the same page starts with.
    pub fn carry(&self) -> Carry {
        Carry { walks: [self.ctl[0].walk.clone(), self.ctl[1].walk.clone()], routes: [self.ctl[0].route.clone(), self.ctl[1].route.clone()] }
    }

    pub fn new(hero: Kit, foe: Kit, arena: &Arena, seed: u64, carry: Carry) -> World {
        assert!(!arena.breakable, "the arena '{}' has breakable walls: not ported yet (docs/pipeline/rust-sim.md)", arena.id);
        let ids = [
            hero::id(&hero.name).unwrap_or_else(|| panic!("{} is not ported yet (docs/pipeline/rust-sim.md)", hero.name)),
            hero::id(&foe.name).unwrap_or_else(|| panic!("{} is not ported yet (docs/pipeline/rust-sim.md)", foe.name)),
        ];
        for k in [&hero, &foe] {
            for s in &k.spells {
                assert!(!(s.info.dash || s.info.escape || s.info.summon || s.bank), "{}: '{}' dashes, flees, summons or banks: not ported yet", k.name, s.label);
            }
        }
        let mut rng = Rng::new(seed);
        // the simulator page's clock when a fight starts: seconds to hours of earlier fights
        let now_ms = 5_000.0 + rng.f() * 3_000_000.0;
        World {
            time: 0.0,
            now_ms,
            cover: arena.cover.clone(),
            ring: Ring { x: 0.0, z: 7.0, r: arena.ring },
            lv: BALANCE,
            hs: [hero::new_state(ids[0]), hero::new_state(ids[1])],
            ids,
            rt: [Runtime::default(), Runtime::default()],
            ctl: {
                let Carry { walks: [w0, w1], routes: [r0, r1] } = carry;
                [Ctl::new(w0, r0), Ctl::new(w1, r1)]
            },
            player: Player::new(hero.hp),
            opp: Opponent::new(foe.hp),
            kits: [hero, foe],
            bolts: Bolts::default(),
            shots: Vec::new(),
            casts: [Vec::new(), Vec::new()],
            cast_seq: [0, 0],
            effects: (0..8).map(|_| None).collect(),
            rng,
            over: None,
            tally: [Tally::default(), Tally::default()],
            navigator: Navigator::default(),
            trace: None,
            trace_p: -1.0,
            frames: None,
        }
    }

    // --- what both sides have, by side ---------------------------------------------------------------------

    pub fn pos(&self, s: Side) -> V2 {
        if s == Side::Hero { self.player.pos } else { self.opp.pos() }
    }

    pub fn status(&self, s: Side) -> &StatusSet {
        if s == Side::Hero { &self.player.slot.status } else { &self.opp.slot.status }
    }

    fn status_mut(&mut self, s: Side) -> &mut StatusSet {
        if s == Side::Hero { &mut self.player.slot.status } else { &mut self.opp.slot.status }
    }

    pub fn hp(&self, s: Side) -> f64 {
        if s == Side::Hero { self.player.hp } else { self.opp.hp }
    }

    pub fn max_hp(&self, s: Side) -> f64 {
        if s == Side::Hero { self.player.max } else { self.opp.max }
    }

    pub fn los(&self, a: V2, b: V2) -> bool {
        line_of_sight(a, b, &self.cover)
    }

    pub fn enemy_distance(&self, s: Side) -> f64 {
        self.pos(s).dist(self.pos(s.other()))
    }

    pub fn apply_buff(&mut self, s: Side, kind: Buff, amount: f64, seconds: f64) {
        self.status_mut(s).apply_buff(kind, amount, seconds);
    }

    /// A passive holds its hero still (`TraitView.hold`). The two sides keep it differently, as in the game.
    pub fn hold(&mut self, s: Side, seconds: f64) {
        if seconds <= 0.0 {
            return;
        }
        let c = &mut self.ctl[s.i()];
        c.hold_floor = c.hold_floor.max(seconds);
        if s == Side::Hero {
            c.rooted = c.rooted.max(seconds);
            c.attacker.cancel();
        }
    }

    fn blind_offset(&mut self) -> V2 {
        let (a, r) = (self.rng.f() * std::f64::consts::TAU, BLIND_RADIUS * self.rng.f().sqrt());
        V2::new(a.cos() * r, a.sin() * r)
    }

    // --- recasts and readiness -----------------------------------------------------------------------------

    /// The slot can be cast once more now (its recast window is open): no cooldown check (`canRecast`).
    pub fn can_recast(&self, s: Side, slot: usize) -> bool {
        let left = self.rt[s.i()].recast_clock[slot];
        match self.kits[s.i()].recast_of(slot) {
            Some(rc) => left > 0.0 && rc.window - left >= rc.arm,
            None => false,
        }
    }

    /// `heroMode.ready`: off cooldown (or its recast is open) and not held back by the hero's own rule.
    fn ready(&self, s: Side, slot: usize) -> bool {
        self.can_recast(s, slot) || (self.ctl[s.i()].cooldowns[slot] <= 0.0 && !hero::blocked(self, s, slot))
    }

    /// A cast's rules (`TraitRuntime.cast`): its mods, then the recast bookkeeping. Returns the mods, the cooldown to
    /// set (-1: a recast, the first cast's cooldown keeps running) and whether an effect plays.
    fn rt_cast(&mut self, s: Side, slot: usize, base: f64, dealt_mul: f64, debuff: Option<(Buff, f64, f64)>) -> (Mods, f64, bool) {
        let t = &mut self.tally[s.i()];
        t.casts[slot] += 1;
        t.first_cast[slot].get_or_insert(self.time);
        let (time, recast) = (self.time, self.can_recast(s, slot));
        if let Some(log) = self.trace.as_mut() {
            log.push(serde_json::json!([s.i(), "c", slot, (time * 1000.0).round() / 1000.0, recast as u8]));
        }
        if self.can_recast(s, slot) {
            let rc = self.kits[s.i()].recast_of(slot).unwrap();
            self.rt[s.i()].recast_clock[slot] = 0.0;
            hero::recast_act(self, s, slot);
            return (Mods { power: rc.power * dealt_mul, debuff, ..NO_MODS }, -1.0, rc.replay);
        }
        let mut mods = hero::cast_mods(self, s, slot);
        mods.power *= dealt_mul;
        if mods.debuff.is_none() {
            mods.debuff = debuff;
        }
        let cooldown = hero::cooldown(self, s, slot, base);
        if let Some(rc) = self.kits[s.i()].recast_of(slot) {
            self.rt[s.i()].recast_clock[slot] = rc.window;
        }
        hero::after_cast(self, s, slot);
        (mods, cooldown, true)
    }

    // --- hits ----------------------------------------------------------------------------------------------

    fn mods_of(&self, dealer: Side, src: ModSrc) -> Mods {
        match src {
            ModSrc::None => NO_MODS,
            ModSrc::Attack => self.ctl[dealer.i()].attack_mods,
            ModSrc::Cast(seq) => self.casts[dealer.i()].iter().find(|c| c.seq == seq).map_or(NO_MODS, |c| c.mods),
        }
    }

    /// One hit through the passives (`resolve`): the cast's power, the victim's armour, both passives, then what the
    /// cast adds to every hit. Returns the hit as it lands.
    pub fn resolve(&mut self, dealer: Side, opts: Hit, src: ModSrc, kind: Kind, slot: Option<usize>, cast: Option<u32>) -> Hit {
        let victim = dealer.other();
        let mods = self.mods_of(dealer, src);
        let mut hit = THit { kind, slot, cast, mods, damage: opts.damage * mods.power, opts, victim_is_hero: true, blocked: false };
        hit.damage *= self.status(victim).taken_mul();
        if dealer == Side::Opponent {
            hit.damage *= self.lv.damage;
        }
        if self.status(victim).sealed() {
            hit.blocked = true;
        }
        hero::dealt(self, dealer, &mut hit);
        hero::taken(self, victim, &mut hit);
        // A passive may strip what the cast adds to every hit (Brannoc's core): the cast keeps that for its later hits.
        match src {
            ModSrc::None => {}
            ModSrc::Attack => self.ctl[dealer.i()].attack_mods = hit.mods,
            ModSrc::Cast(seq) => {
                if let Some(c) = self.casts[dealer.i()].iter_mut().find(|c| c.seq == seq) {
                    c.mods = hit.mods;
                }
            }
        }
        let mut o = hit.opts;
        let source = match kind {
            Kind::Spell => serde_json::json!(slot.unwrap_or(0)),
            Kind::Attack => serde_json::json!("attack"),
            Kind::Unit => serde_json::json!("unit"),
            Kind::Trait => serde_json::json!("trait"),
        };
        let time = (self.time * 1000.0).round() / 1000.0;
        if hit.blocked {
            if let Some(log) = self.trace.as_mut() {
                log.push(serde_json::json!([dealer.i(), "h", source, time, 0, 1, ""]));
            }
            o.status = None;
            o.debuff = None;
            o.knock = None;
            o.pull = 0.0;
            o.damage = 0.0;
            o.blocked = true;
            return o;
        }
        if o.status.is_none() {
            o.status = hit.mods.status;
        }
        if o.debuff.is_none() {
            o.debuff = hit.mods.debuff;
        }
        if hit.mods.knock != 0.0 {
            o.knock = Some(o.knock.unwrap_or(0.0) + hit.mods.knock);
        }
        o.damage = hit.damage.round();
        if let Some(log) = self.trace.as_mut() {
            log.push(serde_json::json!([dealer.i(), "h", source, time, o.damage, 0, o.status.map_or("", |(k, _)| status_name(k))]));
        }
        if o.damage != 0.0 {
            let k = match kind {
                Kind::Spell => slot.unwrap_or(0),
                Kind::Attack => 4,
                Kind::Unit => 5,
                Kind::Trait => 6,
            };
            let t = &mut self.tally[dealer.i()];
            t.dealt[k] += o.damage;
            t.hits[k] += 1;
            t.first_hit.get_or_insert(self.time);
        }
        o
    }

    /// The opponent's spell hits the player's hero (`hitPlayer`): only inside what the cast drew, unless a bolt's touch
    /// was the check.
    fn hit_player(&mut self, seq: u32, opts: Hit) {
        if self.over.is_some() {
            return;
        }
        let Some(c) = self.casts[1].iter().find(|c| c.seq == seq) else { return };
        if !opts.projectile && !c.reaches(self.player.pos) {
            return;
        }
        let slot = c.slot;
        let o = self.resolve(Side::Opponent, opts, ModSrc::Cast(seq), Kind::Spell, Some(slot), Some(seq));
        self.damage_player(o);
    }

    fn damage_player(&mut self, o: Hit) {
        if self.over.is_some() {
            return;
        }
        let foe = self.opp.pos();
        self.player.take(&o, foe, &self.cover, &self.ring);
    }

    /// A hit on the opponent (`arena.hit`): the duel's filter (`opponentHit`), then the passives (`hitMod`), then the hit.
    fn hit_foe(&mut self, opts: Hit, cast: Option<u32>) {
        if self.opp.hp <= 0.0 {
            return;
        }
        let rec = cast.and_then(|seq| self.casts[0].iter().find(|c| c.seq == seq));
        let slot = rec.map(|c| c.slot);
        // The zones judge a hit of a cast the duel still remembers; a bolt's touch and a basic attack were their own check.
        let outside = !opts.projectile && !opts.attack && rec.filter(|c| self.time - c.t < CAST_MEMORY).map_or(false, |c| !c.reaches(self.opp.pos()));
        if outside {
            return;
        }
        let o = if opts.attack {
            self.resolve(Side::Hero, opts, ModSrc::Attack, Kind::Attack, None, None)
        } else if let Some(slot) = slot {
            self.resolve(Side::Hero, opts, ModSrc::Cast(cast.unwrap()), Kind::Spell, Some(slot), cast)
        } else {
            self.resolve(Side::Hero, opts, ModSrc::None, Kind::Unit, None, cast)
        };
        let from = self.player.pos;
        self.opp.take(&o, from);
    }

    /// A spell's hit on the enemy hero (`CastContext.hit`).
    pub fn spell_hit(&mut self, ctx: &Ctx, opts: Hit) {
        match ctx.side {
            Side::Hero => self.hit_foe(opts, Some(ctx.cast)),
            Side::Opponent => self.hit_player(ctx.cast, opts),
        }
    }

    /// A hit from a passive, at any time (`TraitView.hitEnemy`).
    pub fn trait_hit(&mut self, s: Side, opts: Hit) {
        if self.over.is_some() {
            return;
        }
        let o = self.resolve(s, opts, ModSrc::None, Kind::Trait, None, None);
        match s {
            Side::Hero => {
                if self.opp.hp > 0.0 {
                    let from = self.player.pos;
                    self.opp.take(&o, from);
                }
            }
            Side::Opponent => self.damage_player(o),
        }
    }

    /// A spell fires a skillshot (`CastContext.projectile`).
    pub fn fire(&mut self, ctx: &Ctx, spec: BoltSpec) {
        self.bolts.spawn(ctx.side, ctx.cast, ctx.slot, spec);
    }

    fn deliver(&mut self, t: Touch) {
        match t.side {
            Side::Hero => self.hit_foe(t.hit, Some(t.cast)),
            Side::Opponent => self.hit_player(t.cast, t.hit),
        }
    }

    // --- casting -------------------------------------------------------------------------------------------

    fn fx_key(&self, s: Side, slot: usize) -> usize {
        // The game keeps one effect per spell label: two of the same hero share it.
        (if self.ids[0] == self.ids[1] { 0 } else { s.i() }) * 4 + slot
    }

    /// Plays the spell's effect with this cast (`effect.play()` with its context) and returns its danger zones.
    fn play(&mut self, s: Side, slot: usize, ctx: Ctx) -> Vec<Zone> {
        let key = self.fx_key(s, slot);
        let mut e = self.effects[key].take().unwrap_or_else(|| Effect::new(self.ids[s.i()], slot));
        e.cast(self, ctx);
        let mut zones = e.zones();
        self.effects[key] = Some(e);
        // A line skillshot's strip ends where cover stops the bolt (`cutZones`).
        if self.kits[s.i()].spells[slot].stops_at_cover {
            for z in zones.iter_mut() {
                if let Shape::Line { x1, z1, x2, z2, width } = z.shape {
                    let (a, b) = (V2::new(x1, z1), V2::new(x2, z2));
                    if blocks_sight(a, b, &self.cover) {
                        if let Some((t, _)) = first_surface(a, b, &self.cover) {
                            if t < 1.0 {
                                z.shape = Shape::Line { x1, z1, x2: x1 + (x2 - x1) * t, z2: z1 + (z2 - z1) * t, width };
                            }
                        }
                    }
                }
            }
        }
        zones
    }

    /// The player's hero casts slot `i` (`heroMode.autoCast` and `castNow`, with the duel's `castRules`). `enemy`: at the
    /// opponent itself, else at the ground point. True when a spell went out.
    fn hero_cast(&mut self, i: usize, enemy: bool, point: V2) -> bool {
        let s = Side::Hero;
        if self.status(s).cannot_cast() || !self.ready(s, i) {
            return false;
        }
        let spell = self.kits[0].spells[i].clone();
        let (me, foe) = (self.player.pos, self.opp.pos());
        let mode = spell.info.mode;
        // A targeted spell needs sight of its target, whoever casts it.
        if enemy && matches!(mode, Mode::Enemy | Mode::Enemies) && !self.los(me, foe) {
            return false;
        }
        let dealt_mul = self.status(s).dealt_mul();
        if self.can_recast(s, i) && !self.kits[0].recast_of(i).unwrap().replay {
            // A recast that only acts: the rules run, no effect plays, and the autopilot goes on with its frame.
            self.ctl[0].attacker.cancel();
            self.rt_cast(s, i, spell.cooldown, dealt_mul, spell.debuff);
            hero::enemy_cast(self, Side::Opponent, i);
            let c = &mut self.ctl[0];
            c.rooted = c.rooted.max(c.hold_floor);
            c.hold_floor = 0.0;
            return false;
        }
        self.ctl[0].attacker.cancel();
        let miss = if self.status(s).blind() && mode != Mode::Myself { Some(self.blind_offset()) } else { None };
        // The rules run before the effect plays: the cast's mods must be ready for hits that land at once.
        let (mods, cooldown, _) = self.rt_cast(s, i, spell.cooldown, dealt_mul, spell.debuff);
        hero::enemy_cast(self, Side::Opponent, i);
        if let Some((kind, amount, seconds)) = spell.buff {
            self.apply_buff(s, kind, amount, seconds);
        }
        // `arena.context`: the opponent's push is folded into where it stands, then who and where to hit.
        self.opp.fold();
        let home = self.opp.home;
        let alive = self.opp.hp > 0.0;
        let r = spell.info.radius.unwrap_or(5.0);
        let add = |p: V2| miss.map_or(p, |m| V2::new(p.x + m.x, p.z + m.z));
        let (pt, has_target) = match mode {
            Mode::Enemy | Mode::Enemies => (add(home), alive),
            Mode::Ground => {
                let p = add(point);
                (p, alive && home.dist(p) <= r)
            }
            Mode::Myself => (me, alive && home.dist(me) <= r),
        };
        let aim_at = if mode == Mode::Myself { home } else { pt };
        let aim = yaw_to(me, aim_at);
        self.player.yaw = aim;
        self.cast_seq[0] += 1;
        let seq = self.cast_seq[0];
        // `recordPlayerCast` keeps where the opponent stood, for a cast that draws nothing.
        self.casts[0].push(Cast { seq, slot: i, t: self.time, zones: Vec::new(), aimed: foe, mods });
        let ctx = Ctx { side: s, cast: seq, slot: i, from: me, aim, point: pt, has_target, target_pos: if mode == Mode::Ground { home } else { add(home) } };
        let zones = self.play(s, i, ctx);
        let impact = zones.iter().map(|z| z.impact).fold(f64::MIN, f64::max);
        let impact = if zones.is_empty() { 0.4 } else { impact };
        self.casts[0].last_mut().unwrap().zones = zones;
        let c = &mut self.ctl[0];
        c.rooted = impact.min(2.5).max(c.hold_floor);
        c.hold_floor = 0.0;
        if cooldown >= 0.0 {
            c.cooldowns[i] = cooldown;
        }
        true
    }

    /// The opponent casts slot `i` at the player's hero (`castSpell`).
    fn opp_cast(&mut self, i: usize) {
        let s = Side::Opponent;
        let spell = self.kits[1].spells[i].clone();
        let (at, me) = (self.opp.pos(), self.player.pos);
        let dealt_mul = self.status(s).dealt_mul();
        if self.can_recast(s, i) && !self.kits[1].recast_of(i).unwrap().replay {
            self.rt_cast(s, i, spell.cooldown, dealt_mul, spell.debuff);
            let c = &mut self.ctl[1];
            c.rooted = c.rooted.max(c.hold_floor);
            c.hold_floor = 0.0;
            return;
        }
        let mode = spell.info.mode;
        let miss = if mode != Mode::Myself && self.status(s).blind() { Some(self.blind_offset()) } else { None };
        let add = |p: V2| miss.map_or(p, |m| V2::new(p.x + m.x, p.z + m.z));
        let (point, has_target) = if mode == Mode::Myself { (at, at.dist(me) <= spell.info.radius.unwrap_or(5.0)) } else { (add(me), true) };
        // (the level's lead and aim error are both 0 at the balance level; the temple's walls are not ported)
        self.opp.yaw = yaw_to(at, me);
        let (mods, cooldown, _) = self.rt_cast(s, i, spell.cooldown, dealt_mul, spell.debuff);
        hero::enemy_cast(self, Side::Hero, i);
        if let Some((kind, amount, seconds)) = spell.buff {
            self.apply_buff(s, kind, amount, seconds);
        }
        self.cast_seq[1] += 1;
        let seq = self.cast_seq[1];
        self.casts[1].push(Cast { seq, slot: i, t: self.time, zones: Vec::new(), aimed: point, mods });
        let ctx = Ctx { side: s, cast: seq, slot: i, from: at, aim: yaw_to(at, point), point, has_target, target_pos: if mode == Mode::Ground { me } else { add(me) } };
        let zones = self.play(s, i, ctx);
        let impact = zones.iter().map(|z| z.impact).fold(f64::MIN, f64::max);
        let impact = if zones.is_empty() { 0.5 } else { impact };
        self.casts[1].last_mut().unwrap().zones = zones;
        let lv_cooldown = self.lv.cooldown;
        let c = &mut self.ctl[1];
        // A passive's hold is a floor under the spell's own root.
        c.rooted = impact.min(2.5).max(c.hold_floor);
        c.hold_floor = 0.0;
        if cooldown >= 0.0 {
            c.cooldowns[i] = cooldown * lv_cooldown;
        }
    }

    // --- the basic attack ----------------------------------------------------------------------------------

    fn sight(&self, s: Side) -> Sight {
        let (me, at) = (self.pos(s), self.pos(s.other()));
        let st = self.status(s);
        Sight { dist: if self.hp(s.other()) > 0.0 { Some(me.dist(at)) } else { None }, clear: self.los(me, at), stunned: st.stunned(), blind: st.blind(), reach: hero::attack_reach(self, s).max(0.0) }
    }

    /// One frame of a side's basic attack (`Attacker.update`), and of its bolts in flight (`AttackFx.update`).
    fn attack_update(&mut self, s: Side, dt: f64) {
        let sight = self.sight(s);
        let spec = self.kits[s.i()].attack;
        let mut atk = std::mem::take(&mut self.ctl[s.i()].attacker);
        let fired = atk.update(dt, &spec, &sight, || hero::attack_echo(self, s));
        self.ctl[s.i()].attacker = atk;
        for f in fired.into_iter().flatten() {
            self.release(s, f);
        }
        // the homing bolts
        let mut i = self.shots.len();
        while i > 0 {
            i -= 1;
            if self.shots[i].side != s {
                continue;
            }
            if self.hp(s.other()) <= 0.0 {
                self.shots.remove(i);
                continue;
            }
            let at = self.pos(s.other());
            let b = self.shots[i];
            let (dx, dy, dz) = (at.x - b.pos.0, SHOT_HIT_Y - b.pos.1, at.z - b.pos.2);
            let len = (dx * dx + dy * dy + dz * dz).sqrt();
            let step = b.speed * dt;
            if len <= step + 0.15 {
                self.shots.remove(i);
                if !b.miss {
                    self.land_attack(s, b.hit);
                }
            } else {
                self.shots[i].pos = (b.pos.0 + dx / len * step, b.pos.1 + dy / len * step, b.pos.2 + dz / len * step);
            }
        }
    }

    fn release(&mut self, s: Side, f: Fired) {
        if f.echo == 0.0 {
            // A released attack takes its mods from the passive; an echo's second hit reuses them.
            let dealt_mul = self.status(s).dealt_mul();
            let mut m = hero::attack_mods(self, s);
            m.power *= dealt_mul;
            self.ctl[s.i()].attack_mods = m;
        }
        let (me, at) = (self.pos(s), self.pos(s.other()));
        let hit = Hit { damage: f.damage, knock: Some(f.knock), from: Some(me), attack: true, ..Hit::default() };
        if f.bolt_speed <= 0.0 {
            if !f.miss {
                self.land_attack(s, hit);
            }
            return;
        }
        let d = me.dist(at).max(1e-6);
        let from = (me.x + (at.x - me.x) / d * 0.45, SHOT_FROM_Y, me.z + (at.z - me.z) / d * 0.45);
        self.shots.push(Shot { side: s, pos: from, speed: f.bolt_speed, hit, miss: f.miss });
    }

    fn land_attack(&mut self, s: Side, hit: Hit) {
        match s {
            Side::Hero => self.hit_foe(hit, None),
            Side::Opponent => {
                let o = self.resolve(Side::Opponent, hit, ModSrc::Attack, Kind::Attack, None, None);
                self.damage_player(o);
            }
        }
    }

    // --- the frame -----------------------------------------------------------------------------------------

    /// One frame of the fight, in the game's order (`step` in `src/runtime.ts`).
    pub fn step(&mut self, dt: f64) {
        self.frame(dt);
        if self.frames.is_some() {
            let code = |st: &StatusSet| (if st.stunned() { 2.0 } else { 0.0 }) + (if st.has(Status::Slow) { 1.0 } else { 0.0 }) + (if st.has(Status::Root) { 4.0 } else { 0.0 });
            let (h, o) = (self.player.pos, self.opp.pos());
            let row = vec![self.time, h.x, h.z, o.x, o.z, self.ctl[0].rooted, self.ctl[1].rooted, self.ctl[0].attacker.winding() as u8 as f64, self.ctl[1].attacker.winding() as u8 as f64,
                code(&self.player.slot.status), code(&self.opp.slot.status), self.player.hp, self.opp.hp];
            self.frames.as_mut().unwrap().push(row);
        }
    }

    fn frame(&mut self, dt: f64) {
        // the simulator page moves its clock on, then steps the game
        self.now_ms += 1000.0 / 60.0;
        // 1. the spells that are playing: their hits and bolts are made in here
        for key in 0..self.effects.len() {
            if let Some(mut e) = self.effects[key].take() {
                e.update(self, dt);
                // a cast made from inside an update would have put a new effect here: none of the ported spells does
                debug_assert!(self.effects[key].is_none());
                self.effects[key] = Some(e);
            }
        }
        // 3. the arena: bolts, then the player's hero, then the opponent
        let n = self.bolts.live.len();
        for i in 0..n {
            let side = self.bolts.live[i].side;
            let victims = match side {
                Side::Hero if self.opp.hp > 0.0 => vec![Victim { key: 0, pos: self.opp.pos(), body: self.kits[1].body }],
                Side::Opponent => vec![Victim { key: 0, pos: self.player.pos, body: self.kits[0].body }],
                _ => Vec::new(),
            };
            for t in self.bolts.step_one(i, dt, &self.cover, &victims) {
                self.deliver(t);
            }
        }
        self.bolts.sweep();
        self.player.update(dt, &self.cover, &self.ring);
        self.opp.update(dt, &self.cover, &self.ring);
        // 4. the player's hero: its cooldowns, its root, its basic attack (`heroMode.update`)
        if self.over.is_none() {
            let c = &mut self.ctl[0];
            for cd in c.cooldowns.iter_mut() {
                *cd = (*cd - dt).max(0.0);
            }
            c.rooted = (c.rooted - dt).max(0.0);
            self.attack_update(Side::Hero, dt);
        }
        // 5. the duel
        self.time += dt;
        self.attack_update(Side::Opponent, dt);
        if self.over.is_some() {
            return;
        }
        if self.trace.is_some() && self.time - self.trace_p >= 0.5 {
            self.trace_p = self.time;
            let (h, o) = (self.player.pos, self.opp.pos());
            let r = |v: f64| (v * 100.0).round() / 100.0;
            let row = serde_json::json!([0, "p", 0, r(self.time * 10.0) / 10.0, r(h.x), r(h.z), r(o.x), r(o.z)]);
            self.trace.as_mut().unwrap().push(row);
        }
        self.rt_tick(Side::Hero, dt);
        self.rt_tick(Side::Opponent, dt);
        hero::victim_tick(self, Side::Opponent, dt);
        hero::victim_tick(self, Side::Hero, dt);
        // the opponent at 0 HP is a win, checked before the player's 0 HP
        if self.opp.hp <= 0.0 {
            self.over = Some(Side::Hero);
            return;
        }
        if self.player.hp <= 0.0 {
            self.over = Some(Side::Opponent);
            return;
        }
        self.ai(dt);
        self.pilot(dt);
    }

    /// A side's passive every frame (`TraitRuntime.tick`).
    fn rt_tick(&mut self, s: Side, dt: f64) {
        let p = self.pos(s);
        let rt = &mut self.rt[s.i()];
        rt.tick_clocks(dt);
        match rt.last_pos {
            Some(l) if p.dist(l) > dt * 0.5 => rt.still = 0.0,
            _ => rt.still += dt,
        }
        rt.last_pos = Some(p);
        hero::tick(self, s, dt);
    }

    fn threats(&self, to: Side) -> Vec<ai::Threat> {
        self.bolts.threats(to)
    }

    /// The opponent's computer player (`ai` in `src/duel.ts`).
    fn ai(&mut self, dt: f64) {
        let s = Side::Opponent;
        {
            let c = &mut self.ctl[1];
            for cd in c.cooldowns.iter_mut() {
                *cd = (*cd - dt).max(0.0);
            }
            c.rooted = (c.rooted - dt).max(0.0);
            c.think = (c.think - dt).max(0.0);
            c.cast_wait = (c.cast_wait - dt).max(0.0);
        }
        let lv = self.lv;
        let (at, me) = (self.opp.pos(), self.player.pos);
        let st = self.opp.slot.status.clone();
        let speed = ai::ai_speed(&lv, self.kits[1].speed, 1.0) * st.speed_mul() * dt;
        let dashing = self.opp.slot.dashing();
        if st.charmed() && !dashing {
            let d = at.dist(me);
            if d > 1.2 {
                self.opp.walk(V2::new((me.x - at.x) / d * speed, (me.z - at.z) / d * speed), true, &self.cover, &self.ring);
            }
            self.opp.yaw = yaw_to(self.opp.pos(), me);
            return;
        }
        if st.stunned() || dashing {
            return;
        }
        if self.ctl[1].rooted > 0.0 || self.ctl[1].think > 0.0 {
            self.opp.yaw = yaw_to(at, me);
            return;
        }
        // A hit on its way: a ready parry or wall answers it; otherwise step off a skillshot's line (if the roll says so).
        let infos = self.kits[1].infos();
        let threats = self.threats(s);
        let hero_swing = self.ctl[0].attacker.winding() && at.dist(me) <= self.kits[0].attack.range + hero::attack_reach(self, Side::Hero).max(0.0) + 0.5;
        let guard = {
            let rng = &mut self.rng;
            ai::guards(&mut self.ctl[1].guard_roll, &threats, at, hero_swing, &lv, &mut || rng.f())
        };
        let cds = self.ctl[1].cooldowns;
        let guarding = !st.cannot_cast() && self.ctl[1].cast_wait <= 0.0 && ai::guarded(&infos, guard, &|i| cds[i] <= 0.0, None);
        let side_step = if st.cannot_move() || guarding {
            None
        } else {
            let (time, rng) = (self.time, &mut self.rng);
            ai::dodge_bolt(&mut self.ctl[1].dodge, &threats, at, time, &lv, &mut || rng.f())
        };
        if let Some(d) = side_step {
            self.opp.walk(V2::new(d.x * speed, d.z * speed), true, &self.cover, &self.ring);
            self.opp.yaw = yaw_to(self.opp.pos(), me);
            return;
        }
        // (walking out of the player's zones is for harder levels; arena events are not ported)
        let sees = self.los(at, me);
        if !st.cannot_cast() && self.ctl[1].cast_wait <= 0.0 {
            let ward = hero::ward(self, Side::Hero);
            let mut cooling = [false; 4];
            for (i, c) in cooling.iter_mut().enumerate() {
                let opens = self.can_recast(s, i) && !self.kits[1].recast_of(i).map_or(false, |r| r.ai_wait);
                *c = (ward > 0 && (ward > 1 || i != 0)) || hero::ai_hold(self, s, i, at.dist(me)) || (!opens && (cds[i] > 0.0 || hero::blocked(self, s, i)));
            }
            let mine = &self.player.slot.status;
            let m = Moment {
                cooling: &|i| cooling[i],
                answers: &|i| ai::guarded(&infos, guard, &|_| true, Some(i)),
                d: at.dist(me),
                d_hero: at.dist(me),
                other_hp: self.player.hp / self.player.max,
                own_hp: self.opp.hp / self.opp.max,
                sees,
                other_held: mine.stunned() || mine.has(Status::Root),
                full: false,
                guard,
                time: self.time,
            };
            if let Some(i) = ai::pick_spell(&infos, self.kits[1].spells[0].range, &m, &lv) {
                self.opp_cast(i);
                if lv.cast_gap.1 > 0.0 {
                    self.ctl[1].cast_wait = lv.cast_gap.0 + self.rng.f() * (lv.cast_gap.1 - lv.cast_gap.0);
                }
                return;
            }
        }
        // Basic attack: nothing to cast, the hero in reach. Stands still through the wind-up.
        let spec = self.kits[1].attack;
        let sight = self.sight(s);
        if self.ctl[1].attacker.winding() || (self.ctl[1].rooted <= 0.0 && self.ctl[1].attacker.in_range(&spec, &sight) && self.ctl[1].attacker.start(&spec, sight.stunned)) {
            return;
        }
        if st.cannot_move() {
            self.opp.yaw = yaw_to(at, me);
            return;
        }
        // Something of the hero's that this CPU should walk to or away from beats its usual steering.
        let goal = hero::ai_goal(self, s).or_else(|| hero::enemy_goal(self, Side::Hero));
        let reach = spec.range + sight.reach;
        let (mv, routed) = self.walk_step(s, at, me, goal, dt, !sees, reach);
        if mv.len() > 0.0 {
            self.opp.walk(V2::new(mv.x * speed, mv.z * speed), !routed, &self.cover, &self.ring);
            // A CPU looks where it walks, so its back can be reached. It faces the hero to cast.
            let (want, now) = (mv.x.atan2(mv.z), self.opp.yaw);
            self.opp.yaw = now + (want - now).sin().atan2((want - now).cos()) * (dt * 12.0).min(1.0);
        } else {
            self.opp.yaw = yaw_to(at, me);
        }
    }

    /// Where a computer player walks this frame: to its passive's goal when it has one it can reach, else its usual
    /// steering (`reachableGoal`, `goalStep`, `steer`). Returns the unit step and whether it is on a planned route.
    #[allow(clippy::too_many_arguments)]
    fn walk_step(&mut self, s: Side, at: V2, other: V2, goal: Option<V2>, dt: f64, blocked: bool, reach: f64) -> (V2, bool) {
        let mut walk = std::mem::take(&mut self.ctl[s.i()].walk);
        let mut route = std::mem::take(&mut self.ctl[s.i()].route);
        let mut navigator = std::mem::take(&mut self.navigator);
        let (melee, q_range) = (self.kits[s.i()].melee, self.kits[s.i()].spells[0].range);
        let goal = ai::reachable_goal(&mut walk, at, goal, dt);
        let mv = {
            let rng = &mut self.rng;
            let mut nav = ArenaNav { cover: &self.cover, ring: &self.ring, navigator: &mut navigator, route: &mut route };
            match goal {
                Some(g) => {
                    walk.routed = !nav.path_clear(at, g);
                    let p = if walk.routed { nav.route(at, g) } else { g };
                    let d = at.dist(p);
                    if d > 0.0 { V2::new((p.x - at.x) / d, (p.z - at.z) / d) } else { V2::new(0.0, 0.0) }
                }
                None => ai::steer(&mut walk, melee, q_range, at, other, dt, blocked, reach, &mut nav, &[], &mut || rng.f()),
            }
        };
        let routed = walk.routed;
        self.ctl[s.i()].walk = walk;
        self.ctl[s.i()].route = route;
        self.navigator = navigator;
        (mv, routed)
    }

    /// The autopilot for the player's hero (`pilot` in `src/duel.ts`): the same rules, not the same code.
    fn pilot(&mut self, dt: f64) {
        let s = Side::Hero;
        self.ctl[0].think = (self.ctl[0].think - dt).max(0.0);
        let st = self.player.slot.status.clone();
        if self.ctl[0].rooted > 0.0 || self.ctl[0].think > 0.0 || st.stunned() || self.player.slot.dashing() {
            return;
        }
        let lv = BALANCE;
        let (me, at) = (self.player.pos, self.opp.pos());
        let speed = ai::ai_speed(&lv, self.kits[0].speed, 1.0) * st.speed_mul() * dt;
        let infos = self.kits[0].infos();
        let threats = self.threats(s);
        let opp_spec = self.kits[1].attack;
        let opp_swing = self.ctl[1].attacker.winding() && self.ctl[1].attacker.in_range(&opp_spec, &self.sight(Side::Opponent));
        let guard = {
            let rng = &mut self.rng;
            ai::guards(&mut self.ctl[0].guard_roll, &threats, me, opp_swing, &lv, &mut || rng.f())
        };
        let ready = [self.ready(s, 0), self.ready(s, 1), self.ready(s, 2), self.ready(s, 3)];
        let guarding = !st.cannot_cast() && ai::guarded(&infos, guard, &|i| ready[i], None);
        let side_step = if st.cannot_move() || guarding {
            None
        } else {
            let (time, rng) = (self.time, &mut self.rng);
            ai::dodge_bolt(&mut self.ctl[0].dodge, &threats, me, time, &lv, &mut || rng.f())
        };
        if let Some(d) = side_step {
            self.player.walk(V2::new(d.x * speed, d.z * speed), f64::INFINITY, true, &self.cover, &self.ring);
            return;
        }
        let sees = self.los(me, at);
        if !st.cannot_cast() {
            let ward = hero::ward(self, Side::Opponent);
            let mut cooling = [false; 4];
            for (i, c) in cooling.iter_mut().enumerate() {
                let waits = (self.can_recast(s, i) && self.kits[0].recast_of(i).map_or(false, |r| r.ai_wait)) || hero::ai_hold(self, s, i, me.dist(at));
                *c = (ward > 0 && (ward > 1 || i != 0)) || !ready[i] || waits;
            }
            let theirs = &self.opp.slot.status;
            let m = Moment {
                cooling: &|i| cooling[i],
                answers: &|i| ai::guarded(&infos, guard, &|_| true, Some(i)),
                d: me.dist(at),
                d_hero: me.dist(at),
                other_hp: self.opp.hp / self.opp.max,
                own_hp: self.player.hp / self.player.max,
                sees,
                other_held: theirs.stunned() || theirs.has(Status::Root),
                full: false,
                guard,
                time: self.time,
            };
            if let Some(i) = ai::pick_spell(&infos, self.kits[0].spells[0].range, &m, &lv) {
                let mode = infos[i].mode;
                let enemy = matches!(mode, Mode::Enemy | Mode::Enemies);
                // a ground spell goes to the spot that also catches the most units: with none, the opponent's feet
                let point = if mode == Mode::Myself { me } else { at };
                if self.hero_cast(i, enemy, point) {
                    return;
                }
            }
        }
        // Basic attack: nothing to cast, the opponent in reach. Stands still through the wind-up.
        let spec = self.kits[0].attack;
        let sight = self.sight(s);
        if self.ctl[0].attacker.winding() || (self.ctl[0].rooted <= 0.0 && self.ctl[0].attacker.in_range(&spec, &sight) && self.ctl[0].attacker.start(&spec, sight.stunned)) {
            return;
        }
        if st.cannot_move() {
            return;
        }
        let goal = hero::ai_goal(self, s).or_else(|| hero::enemy_goal(self, Side::Opponent));
        let reach = spec.range + sight.reach;
        let (mv, routed) = self.walk_step(s, me, at, goal, dt, !sees, reach);
        if mv.len() > 0.0 {
            self.player.walk(V2::new(mv.x * speed, mv.z * speed), f64::INFINITY, !routed, &self.cover, &self.ring);
        }
    }
}

/// A finished fight, as the real simulator records one with `--keep`.
#[derive(Clone, Debug)]
pub struct Outcome {
    pub hero: String,
    pub foe: String,
    pub arena: String,
    pub winner: Option<String>,
    pub seconds: f64,
    pub hp: [f64; 2],
    pub tally: [Tally; 2],
}

/// Plays one fight to its end, or to `max_seconds` with nobody down.
/// `carry`: what the fight before left (see `Carry`); it is handed on to the next.
pub fn fight(hero: Kit, foe: Kit, arena: &Arena, seed: u64, max_seconds: f64, carry: &mut Carry) -> Outcome {
    fight_traced(hero, foe, arena, seed, max_seconds, false, carry).0
}

/// The same, with every cast and hit logged when `trace` is set.
pub fn fight_traced(hero: Kit, foe: Kit, arena: &Arena, seed: u64, max_seconds: f64, trace: bool, carry: &mut Carry) -> (Outcome, Vec<serde_json::Value>) {
    let (h, f) = (hero.name.clone(), foe.name.clone());
    let mut w = World::new(hero, foe, arena, seed, carry.clone());
    if trace {
        w.trace = Some(Vec::new());
    }
    let frames = (max_seconds * 60.0) as u64;
    let mut n = 0;
    while w.over.is_none() && n < frames {
        w.step(DT);
        n += 1;
    }
    let winner = w.over.map(|s| if s == Side::Hero { h.clone() } else { f.clone() });
    let seconds = if w.over.is_some() { (w.time * 10.0).round() / 10.0 } else { n as f64 / 60.0 };
    let out = Outcome { hero: h, foe: f, arena: arena.id.clone(), winner, seconds, hp: [w.player.hp.round(), w.opp.hp.round()], tally: w.tally.clone() };
    *carry = w.carry();
    (out, w.trace.take().unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::Game;

    fn play(seed: u64) -> Outcome {
        let g = Game::load();
        fight(g.kit("Brannoc").unwrap(), g.kit("Isolde").unwrap(), &g.arena("frost").unwrap(), seed, 120.0, &mut Carry::first())
    }

    #[test]
    fn a_fight_ends_with_a_winner_and_counts_what_happened() {
        let o = play(3);
        assert!(o.winner.is_some() && o.seconds > 5.0 && o.seconds < 120.0);
        // the loser is at 0, the winner is not
        assert!((o.hp[0] == 0.0) != (o.hp[1] == 0.0));
        for t in &o.tally {
            assert!(t.casts.iter().sum::<u32>() > 3 && t.hits.iter().sum::<u32>() > 3 && t.dealt.iter().sum::<f64>() > 100.0);
        }
        // both open the same way every time: Brannoc throws his hammer 2.3 s in, as in the real game
        assert!((o.tally[0].first_cast[0].unwrap() - 2.3).abs() < 0.02);
    }

    #[test]
    fn the_same_seed_plays_the_same_fight_and_another_seed_another() {
        let (a, b, c) = (play(11), play(11), play(12));
        assert_eq!((a.seconds, a.hp, a.tally[0].dealt, a.tally[1].dealt), (b.seconds, b.hp, b.tally[0].dealt, b.tally[1].dealt));
        assert!((a.seconds, a.hp) != (c.seconds, c.hp));
    }

    #[test]
    fn a_hit_of_a_cast_that_drew_a_shape_lands_only_inside_it() {
        let c = Cast { seq: 1, slot: 0, t: 0.0, zones: vec![Zone { shape: Shape::Circle { x: 0.0, z: 0.0, radius: 2.0 }, start: 0.0, impact: 0.5, until: None }], aimed: V2::new(9.0, 9.0), mods: NO_MODS };
        assert!(c.reaches(V2::new(1.9, 0.0)) && !c.reaches(V2::new(2.1, 0.0)) && !c.reaches(V2::new(9.0, 9.0)));
        let plain = Cast { zones: Vec::new(), ..c };
        assert!(plain.reaches(V2::new(9.0, 10.5)) && !plain.reaches(V2::new(9.0, 10.7)));
    }
}
