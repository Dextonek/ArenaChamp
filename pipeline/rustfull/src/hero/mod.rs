//! The heroes that are ported: each one's passive (the hooks of its `Trait` in `src/traits/`) and the rules inside its
//! four spells (`src/spells/targeted/`). One file per hero; this file is the list of them and what a hero file may
//! fill in.
//!
//! TO ADD A HERO: write `src/hero/<theme>.rs` with a `pub const HERO: Hero = Hero { name: "...", state: ..., spell: ...,
//! <the hooks its Trait has>, ..PLAIN };`, then add ONE line to `mod` below and ONE line to `HEROES`. A hook the hero
//! does not have keeps what `PLAIN` gives: what the game does without it. A hero that is not in `HEROES` stops the
//! program: there is no silent stand-in. How a hero is graded: docs/pipeline/rust-sim.md.

use crate::bolt::Side;
use crate::fight::{Ctx, Kind, Mods, THit, World, NO_MODS};
use crate::geom::V2;
use crate::zone::Zone;
use std::any::Any;

pub mod dawn;
pub mod forge;
pub mod frost;
pub mod hive;
pub mod ledger;
pub mod storm;
pub mod weather;

/// Every hero that can fight here.
pub const HEROES: &[&Hero] = &[
    &forge::HERO,
    &frost::HERO,
    &storm::HERO,
    &dawn::HERO,
    &hive::HERO,
    &ledger::HERO,
    &weather::HERO,
];

/// A spell's effect as far as it makes hits (`Effect` in the game): a small timeline. The game keeps one per spell
/// label and starts it again at every cast, so a cast while the last one still plays drops what that one had left.
pub trait Spell: std::fmt::Debug {
    /// A cast: take the cast's context and start from the beginning (`cast` then `play`). Hits that land at once are
    /// made here.
    fn cast(&mut self, w: &mut World, ctx: Ctx);

    /// The danger zones the cast draws (`EffectModule.telegraphs`), read right after `cast`. They root the caster
    /// until the latest `impact`, and a hit that is not a bolt's touch lands only inside them.
    fn zones(&self) -> Vec<Zone> {
        Vec::new()
    }

    /// Every frame, first thing in the frame, while the fight runs (`Effect.update`).
    fn update(&mut self, _w: &mut World, _dt: f64) {}
}

/// A spell whose effect makes no hit of its own: the kit's buff and the passive do the work.
#[derive(Clone, Debug, Default)]
pub struct Quiet;

impl Spell for Quiet {
    fn cast(&mut self, _w: &mut World, _ctx: Ctx) {}
}

/// A hit of this hero's that landed, as its passive learns it (`LandedHit`).
#[derive(Clone, Copy, Debug)]
pub struct Landed {
    pub kind: Kind,
    pub slot: Option<usize>,
    pub damage: f64,
}

/// One hero: its name as in the game, its own state, its four spells, and the hooks of its passive. In every hook `s`
/// is the side whose hero's passive it is.
pub struct Hero {
    pub name: &'static str,
    /// What its passive and spells keep between them for one fight (the game keeps this in `mem` and in records per
    /// figure). Read it with `hero::state` / `hero::state_mut`.
    pub state: fn() -> Box<dyn Any>,
    /// The effect of slot 0..3.
    pub spell: fn(usize) -> Box<dyn Spell>,
    /// Shields this hero makes are this much stronger (`shieldMul`).
    pub shield_mul: f64,
    /// The computer player holds this slot back for now (`aiHold`; the last number: metres to the enemy hero).
    pub ai_hold: fn(&World, Side, usize, f64) -> bool,
    /// Where the computer player playing AGAINST this hero should walk now (`enemyGoal`).
    pub enemy_goal: fn(&World, Side) -> Option<V2>,
    /// Where the computer player playing this hero should walk now (`aiGoal`); it beats the enemy's `enemy_goal`.
    pub ai_goal: fn(&World, Side) -> Option<V2>,
    /// The hero's own rule forbids the slot now (`canCast` gives a reason).
    pub blocked: fn(&World, Side, usize) -> bool,
    /// What the OTHER side's computer player holds its spells for (`ward` in the duel): 2 while nothing can land on
    /// this hero, 1 while only Q should go in, else 0.
    pub ward: fn(&World, Side) -> u8,
    /// The cast's mods (`castMods`): power 1 and nothing else unless the hero says so.
    pub cast_mods: fn(&mut World, Side, usize) -> Mods,
    /// The cooldown the slot gets after a cast (`cooldown`; the last number: the kit's).
    pub cooldown: fn(&World, Side, usize, f64) -> f64,
    /// After the cast's rules ran, before the effect plays (`afterCast`).
    pub after_cast: fn(&mut World, Side, usize),
    /// The free second cast of a slot (`recastAct`).
    pub recast_act: fn(&mut World, Side, usize),
    /// The ENEMY hero cast `slot` (`enemyCast`).
    pub enemy_cast: fn(&mut World, Side, usize),
    /// A basic attack is released: its mods (`attackMods`).
    pub attack_mods: fn(&mut World, Side) -> Mods,
    /// Metres added to the basic attack's reach now (`attackReach`).
    pub attack_reach: fn(&World, Side) -> f64,
    /// The share of a second hit that follows the next basic attack (`attackEcho`).
    pub attack_echo: fn(&World, Side) -> f64,
    /// Dealer side: change a hit of this hero's (`dealt`).
    pub dealt: fn(&mut World, Side, &mut THit),
    /// Victim side: change a hit this hero takes (`taken`).
    pub taken: fn(&mut World, Side, &mut THit),
    /// A hit of this hero's landed (`landed`).
    pub landed: fn(&mut World, Side, Landed),
    /// Every frame (`tick`).
    pub tick: fn(&mut World, Side, f64),
    /// The hero's rule that acts on the enemy hero, every frame (`victimTick`).
    pub victim_tick: fn(&mut World, Side, f64),
}

/// A hero with no passive at all: what every hook does when a hero does not have it.
pub const PLAIN: Hero = Hero {
    name: "",
    state: || Box::new(()),
    spell: |_| Box::new(Quiet),
    shield_mul: 1.0,
    ai_hold: |_, _, _, _| false,
    enemy_goal: |_, _| None,
    ai_goal: |_, _| None,
    blocked: |_, _, _| false,
    ward: |_, _| 0,
    cast_mods: |_, _, _| NO_MODS,
    cooldown: |_, _, _, base| base,
    after_cast: |_, _, _| {},
    recast_act: |_, _, _| {},
    enemy_cast: |_, _, _| {},
    attack_mods: |_, _| NO_MODS,
    attack_reach: |_, _| 0.0,
    attack_echo: |_, _| 0.0,
    dealt: |_, _, _| {},
    taken: |_, _, _| {},
    landed: |_, _, _| {},
    tick: |_, _, _| {},
    victim_tick: |_, _, _| {},
};

/// The ported hero of this name, if it is ported.
pub fn find(name: &str) -> Option<&'static Hero> {
    HEROES.iter().copied().find(|h| h.name == name)
}

/// The names of the heroes that can fight here.
pub fn ported() -> Vec<&'static str> {
    HEROES.iter().map(|h| h.name).collect()
}

/// A hero's own state for this fight (`T` is the `State` of its file).
pub fn state<T: 'static>(w: &World, s: Side) -> &T {
    w.hs[s.i()].downcast_ref::<T>().expect("a hero read another hero's state")
}

pub fn state_mut<T: 'static>(w: &mut World, s: Side) -> &mut T {
    w.hs[s.i()].downcast_mut::<T>().expect("a hero read another hero's state")
}

// --- the hooks, as the fight loop calls them ---------------------------------------------------------------

pub fn ai_hold(w: &World, s: Side, slot: usize, dist: f64) -> bool {
    (w.heroes[s.i()].ai_hold)(w, s, slot, dist)
}

pub fn enemy_goal(w: &World, s: Side) -> Option<V2> {
    (w.heroes[s.i()].enemy_goal)(w, s)
}

pub fn ai_goal(w: &World, s: Side) -> Option<V2> {
    (w.heroes[s.i()].ai_goal)(w, s)
}

pub fn blocked(w: &World, s: Side, slot: usize) -> bool {
    (w.heroes[s.i()].blocked)(w, s, slot)
}

pub fn ward(w: &World, s: Side) -> u8 {
    (w.heroes[s.i()].ward)(w, s)
}

pub fn cast_mods(w: &mut World, s: Side, slot: usize) -> Mods {
    (w.heroes[s.i()].cast_mods)(w, s, slot)
}

pub fn cooldown(w: &World, s: Side, slot: usize, base: f64) -> f64 {
    (w.heroes[s.i()].cooldown)(w, s, slot, base)
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    (w.heroes[s.i()].after_cast)(w, s, slot)
}

pub fn recast_act(w: &mut World, s: Side, slot: usize) {
    (w.heroes[s.i()].recast_act)(w, s, slot)
}

pub fn enemy_cast(w: &mut World, s: Side, slot: usize) {
    (w.heroes[s.i()].enemy_cast)(w, s, slot)
}

pub fn attack_mods(w: &mut World, s: Side) -> Mods {
    (w.heroes[s.i()].attack_mods)(w, s)
}

pub fn attack_reach(w: &World, s: Side) -> f64 {
    (w.heroes[s.i()].attack_reach)(w, s)
}

pub fn attack_echo(w: &World, s: Side) -> f64 {
    (w.heroes[s.i()].attack_echo)(w, s)
}

pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    (w.heroes[s.i()].dealt)(w, s, hit)
}

pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    (w.heroes[s.i()].taken)(w, s, hit)
}

pub fn landed(w: &mut World, s: Side, hit: Landed) {
    (w.heroes[s.i()].landed)(w, s, hit)
}

pub fn tick(w: &mut World, s: Side, dt: f64) {
    (w.heroes[s.i()].tick)(w, s, dt)
}

pub fn victim_tick(w: &mut World, s: Side, dt: f64) {
    (w.heroes[s.i()].victim_tick)(w, s, dt)
}
