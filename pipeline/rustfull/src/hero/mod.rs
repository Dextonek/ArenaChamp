//! The heroes that are ported: each one's passive (the hooks of its `Trait` in `src/traits/`) and the rules inside its
//! four spells (`src/spells/targeted/`). This file only hands each call to the hero it belongs to.
//!
//! A hook a hero does not have does what the game does without it. A hero that is not here stops the program: there is
//! no silent stand-in.

use crate::bolt::Side;
use crate::fight::{Ctx, Mods, THit, World, NO_MODS};
use crate::geom::V2;
use crate::zone::Zone;

pub mod forge;
pub mod frost;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HeroId {
    Brannoc,
    Isolde,
}

/// The ported hero of this name, if it is ported.
pub fn id(name: &str) -> Option<HeroId> {
    match name {
        "Brannoc" => Some(HeroId::Brannoc),
        "Isolde" => Some(HeroId::Isolde),
        _ => None,
    }
}

/// The heroes that can fight here.
pub const PORTED: [&str; 2] = ["Brannoc", "Isolde"];

/// What a hero's passive and spells share between them (the game keeps this in `mem` and in records per figure).
#[derive(Clone, Debug)]
pub enum HeroState {
    Forge(forge::State),
    Frost(frost::State),
}

pub fn new_state(id: HeroId) -> HeroState {
    match id {
        HeroId::Brannoc => HeroState::Forge(forge::State::default()),
        HeroId::Isolde => HeroState::Frost(frost::State::default()),
    }
}

/// A spell's effect as far as it makes hits: a small timeline stepped every frame, one per spell label.
#[derive(Clone, Debug)]
pub enum Effect {
    ChainHammer(forge::ChainHammer),
    ForgeRoar(forge::Quiet),
    RedHotRivet(forge::RedHotRivet),
    MoltenCore(forge::MoltenCore),
    Icicle(frost::Icicle),
    Hoarfrost(frost::Hoarfrost),
    RimeArmour(forge::Quiet),
    WintersShatter(frost::WintersShatter),
}

impl Effect {
    pub fn new(id: HeroId, slot: usize) -> Effect {
        match (id, slot) {
            (HeroId::Brannoc, 0) => Effect::ChainHammer(Default::default()),
            (HeroId::Brannoc, 1) => Effect::ForgeRoar(Default::default()),
            (HeroId::Brannoc, 2) => Effect::RedHotRivet(Default::default()),
            (HeroId::Brannoc, _) => Effect::MoltenCore(Default::default()),
            (HeroId::Isolde, 0) => Effect::Icicle(Default::default()),
            (HeroId::Isolde, 1) => Effect::Hoarfrost(Default::default()),
            (HeroId::Isolde, 2) => Effect::RimeArmour(Default::default()),
            (HeroId::Isolde, _) => Effect::WintersShatter(Default::default()),
        }
    }

    /// A cast: the effect takes the cast's context and starts from the beginning (`cast` then `play`).
    pub fn cast(&mut self, w: &mut World, ctx: Ctx) {
        match self {
            Effect::ChainHammer(e) => e.cast(w, ctx),
            Effect::ForgeRoar(e) | Effect::RimeArmour(e) => e.cast(w, ctx),
            Effect::RedHotRivet(e) => e.cast(w, ctx),
            Effect::MoltenCore(e) => e.cast(w, ctx),
            Effect::Icicle(e) => e.cast(w, ctx),
            Effect::Hoarfrost(e) => e.cast(w, ctx),
            Effect::WintersShatter(e) => e.cast(w, ctx),
        }
    }

    /// The danger zones the cast draws (`EffectModule.telegraphs`).
    pub fn zones(&self) -> Vec<Zone> {
        match self {
            Effect::ChainHammer(e) => e.zones(),
            Effect::ForgeRoar(_) | Effect::RimeArmour(_) => Vec::new(),
            Effect::RedHotRivet(_) => Vec::new(),
            Effect::MoltenCore(e) => e.zones(),
            Effect::Icicle(e) => e.zones(),
            Effect::Hoarfrost(e) => e.zones(),
            Effect::WintersShatter(e) => e.zones(),
        }
    }

    pub fn update(&mut self, w: &mut World, dt: f64) {
        match self {
            Effect::ChainHammer(e) => e.update(w, dt),
            Effect::ForgeRoar(_) | Effect::RimeArmour(_) => {}
            Effect::RedHotRivet(e) => e.update(w, dt),
            Effect::MoltenCore(e) => e.update(w, dt),
            Effect::Icicle(e) => e.update(w, dt),
            Effect::Hoarfrost(e) => e.update(w, dt),
            Effect::WintersShatter(e) => e.update(w, dt),
        }
    }
}

fn hero(w: &World, s: Side) -> HeroId {
    w.ids[s.i()]
}

// --- the hooks of `Trait`, by hero. `s` is the side whose hero's passive it is. ---------------------------------

/// The computer player holds this slot back for now (`aiHold`).
pub fn ai_hold(w: &World, s: Side, slot: usize, _dist: f64) -> bool {
    match hero(w, s) {
        HeroId::Brannoc => false,
        HeroId::Isolde => frost::ai_hold(w, s, slot),
    }
}

/// Where the computer player playing AGAINST this hero should walk now (`enemyGoal`).
pub fn enemy_goal(w: &World, s: Side) -> Option<V2> {
    match hero(w, s) {
        HeroId::Brannoc => forge::enemy_goal(w, s),
        HeroId::Isolde => None,
    }
}

/// Where the computer player playing this hero should walk now (`aiGoal`); it beats the enemy's `enemy_goal`.
pub fn ai_goal(_w: &World, _s: Side) -> Option<V2> {
    None
}

/// The hero's own rule forbids the slot now (`canCast`, and ammo).
pub fn blocked(_w: &World, _s: Side, _slot: usize) -> bool {
    false
}

/// What the other side's computer player holds its spells for (`ward` in the duel): nothing with these heroes.
pub fn ward(_w: &World, _s: Side) -> u8 {
    0
}

pub fn cast_mods(_w: &mut World, _s: Side, _slot: usize) -> Mods {
    NO_MODS
}

pub fn cooldown(_w: &World, _s: Side, _slot: usize, base: f64) -> f64 {
    base
}

pub fn after_cast(w: &mut World, s: Side, slot: usize) {
    match hero(w, s) {
        HeroId::Brannoc => forge::after_cast(w, s, slot),
        HeroId::Isolde => frost::after_cast(w, s, slot),
    }
}

pub fn recast_act(w: &mut World, s: Side, slot: usize) {
    match hero(w, s) {
        HeroId::Brannoc => forge::recast_act(w, s, slot),
        HeroId::Isolde => {}
    }
}

/// The enemy hero cast `slot` (`enemyCast`): neither of these heroes answers it.
pub fn enemy_cast(_w: &mut World, _s: Side, _slot: usize) {}

/// A basic attack is released: its mods (`attackMods`).
pub fn attack_mods(w: &mut World, s: Side) -> Mods {
    match hero(w, s) {
        HeroId::Brannoc => forge::attack_mods(w, s),
        HeroId::Isolde => NO_MODS,
    }
}

pub fn attack_reach(w: &World, s: Side) -> f64 {
    match hero(w, s) {
        HeroId::Brannoc => forge::attack_reach(w, s),
        HeroId::Isolde => 0.0,
    }
}

pub fn attack_echo(_w: &World, _s: Side) -> f64 {
    0.0
}

/// Dealer side: change a hit of this hero's.
pub fn dealt(w: &mut World, s: Side, hit: &mut THit) {
    match hero(w, s) {
        HeroId::Brannoc => forge::dealt(w, s, hit),
        HeroId::Isolde => frost::dealt(w, s, hit),
    }
}

/// Victim side: change a hit this hero takes.
pub fn taken(w: &mut World, s: Side, hit: &mut THit) {
    match hero(w, s) {
        HeroId::Brannoc => forge::taken(w, s, hit),
        HeroId::Isolde => frost::taken(w, s, hit),
    }
}

pub fn tick(w: &mut World, s: Side, dt: f64) {
    match hero(w, s) {
        HeroId::Brannoc => forge::tick(w, s, dt),
        HeroId::Isolde => frost::tick(w, s, dt),
    }
}

/// The hero's rule that acts on the enemy hero every frame (`victimTick`): neither of these heroes has one.
pub fn victim_tick(_w: &mut World, _s: Side, _dt: f64) {}
