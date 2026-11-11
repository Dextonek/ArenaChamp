//! The game's own numbers, read from `data/game.json`, which `export.js` writes from the running game (kits, what a
//! passive fixes without code, each arena's cover). Nothing here is typed by hand. The file is compiled in: after a
//! change in the game, export again and build again.

use crate::ai::{Mode, SpellInfo};
use crate::attack::AttackSpec;
use crate::geom::Obstacle;
use crate::status::Buff;
use serde::Deserialize;
use std::collections::HashMap;

const GAME: &str = include_str!("../data/game.json");

#[derive(Deserialize)]
struct RawGame {
    heroes: Vec<RawHero>,
    arenas: Vec<RawArena>,
}

#[derive(Deserialize)]
struct RawAttack {
    kind: String,
    range: f64,
    damage: f64,
    interval: f64,
    windup: f64,
    speed: f64,
}

#[derive(Deserialize)]
struct RawBuff {
    kind: String,
    amount: f64,
    seconds: f64,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct RawRecast {
    slot: usize,
    window: f64,
    arm: f64,
    power: f64,
    replay: bool,
    aiWait: bool,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct RawSpell {
    label: String,
    cooldown: f64,
    range: f64,
    cc: bool,
    dash: bool,
    escape: bool,
    summon: bool,
    save: bool,
    parry: bool,
    barrier: bool,
    anytime: bool,
    bank: bool,
    aim: Option<String>,
    stopsAtCover: bool,
    buff: Option<RawBuff>,
    debuff: Option<RawBuff>,
    mode: Option<String>,
    radius: Option<f64>,
    settings: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct RawHero {
    name: String,
    hp: f64,
    melee: bool,
    speed: f64,
    body: f64,
    attack: RawAttack,
    recast: Vec<RawRecast>,
    spells: Vec<RawSpell>,
}

#[derive(Deserialize)]
struct RawOb {
    ax: f64,
    az: f64,
    bx: f64,
    bz: f64,
    r: f64,
    kind: Option<String>,
}

#[derive(Deserialize)]
struct RawArena {
    id: String,
    ring: f64,
    breakable: bool,
    obstacles: Vec<RawOb>,
}

/// A slot that can be cast once more after the first cast (`RecastSpec`).
#[derive(Clone, Copy, Debug)]
pub struct Recast {
    pub slot: usize,
    pub window: f64,
    pub arm: f64,
    pub power: f64,
    pub replay: bool,
    pub ai_wait: bool,
}

#[derive(Clone, Debug)]
pub struct Spell {
    pub label: String,
    pub cooldown: f64,
    pub range: f64,
    pub info: SpellInfo,
    pub line: bool,
    pub stops_at_cover: bool,
    pub bank: bool,
    pub buff: Option<(Buff, f64, f64)>,
    pub debuff: Option<(Buff, f64, f64)>,
    settings: HashMap<String, f64>,
}

impl Spell {
    /// A number of the spell's own settings (`default<Name>()` in its file), as the game ships it.
    pub fn num(&self, key: &str) -> f64 {
        *self.settings.get(key).unwrap_or_else(|| panic!("the spell '{}' has no setting '{}' in data/game.json", self.label, key))
    }
}

#[derive(Clone, Debug)]
pub struct Kit {
    pub name: String,
    pub hp: f64,
    pub melee: bool,
    pub speed: f64,
    /// Half-width of the body against bolts (`HERO_BODIES`).
    pub body: f64,
    pub attack: AttackSpec,
    pub recast: Vec<Recast>,
    pub spells: [Spell; 4],
}

impl Kit {
    pub fn recast_of(&self, slot: usize) -> Option<Recast> {
        self.recast.iter().copied().find(|r| r.slot == slot)
    }

    pub fn infos(&self) -> [SpellInfo; 4] {
        [self.spells[0].info, self.spells[1].info, self.spells[2].info, self.spells[3].info]
    }
}

#[derive(Clone, Debug)]
pub struct Arena {
    pub id: String,
    pub ring: f64,
    pub breakable: bool,
    pub cover: Vec<Obstacle>,
    /// Which of the cover are walls (the ones a breakable arena lets spells break).
    pub walls: Vec<bool>,
}

fn buff_kind(s: &str) -> Buff {
    match s {
        "haste" => Buff::Haste,
        "might" => Buff::Might,
        "armor" => Buff::Armor,
        "vulnerable" => Buff::Vulnerable,
        "weaken" => Buff::Weaken,
        "grounded" => Buff::Grounded,
        other => panic!("a buff the port does not know: {other}"),
    }
}

fn buff(b: &Option<RawBuff>) -> Option<(Buff, f64, f64)> {
    b.as_ref().map(|b| (buff_kind(&b.kind), b.amount, b.seconds))
}

fn spell(s: &RawSpell) -> Spell {
    let mode = match s.mode.as_deref() {
        Some("self") => Mode::Myself,
        Some("enemy") => Mode::Enemy,
        Some("enemies") => Mode::Enemies,
        Some("ground") => Mode::Ground,
        other => panic!("the spell '{}' has a targeting mode the port does not know: {:?}", s.label, other),
    };
    Spell {
        label: s.label.clone(),
        cooldown: s.cooldown,
        range: s.range,
        info: SpellInfo { range: s.range, mode, radius: s.radius, cc: s.cc, dash: s.dash, escape: s.escape, summon: s.summon, save: s.save, parry: s.parry, barrier: s.barrier, anytime: s.anytime },
        line: s.aim.as_deref() == Some("line"),
        stops_at_cover: s.stopsAtCover,
        bank: s.bank,
        buff: buff(&s.buff),
        debuff: buff(&s.debuff),
        settings: s.settings.iter().filter_map(|(k, v)| v.as_f64().map(|n| (k.clone(), n))).collect(),
    }
}

pub struct Game {
    raw: RawGame,
}

impl Game {
    pub fn load() -> Game {
        Game { raw: serde_json::from_str(GAME).expect("data/game.json does not read: export it again (see export.js)") }
    }

    pub fn hero_names(&self) -> Vec<String> {
        self.raw.heroes.iter().map(|h| h.name.clone()).collect()
    }

    pub fn arena_ids(&self) -> Vec<String> {
        self.raw.arenas.iter().map(|a| a.id.clone()).collect()
    }

    pub fn kit(&self, name: &str) -> Option<Kit> {
        let h = self.raw.heroes.iter().find(|h| h.name.eq_ignore_ascii_case(name))?;
        let s: Vec<Spell> = h.spells.iter().map(spell).collect();
        let spells: [Spell; 4] = s.try_into().ok()?;
        Some(Kit {
            name: h.name.clone(),
            hp: h.hp,
            melee: h.melee,
            speed: h.speed,
            body: h.body,
            attack: AttackSpec { melee: h.attack.kind == "melee", range: h.attack.range, damage: h.attack.damage, interval: h.attack.interval, windup: h.attack.windup, speed: h.attack.speed },
            recast: h.recast.iter().map(|r| Recast { slot: r.slot, window: r.window, arm: r.arm, power: r.power, replay: r.replay, ai_wait: r.aiWait }).collect(),
            spells,
        })
    }

    pub fn arena(&self, id: &str) -> Option<Arena> {
        let a = self.raw.arenas.iter().find(|a| a.id == id)?;
        Some(Arena {
            id: a.id.clone(),
            ring: a.ring,
            breakable: a.breakable,
            cover: a.obstacles.iter().map(|o| Obstacle { ax: o.ax, az: o.az, bx: o.bx, bz: o.bz, r: o.r }).collect(),
            walls: a.obstacles.iter().map(|o| o.kind.as_deref() == Some("wall")).collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_export_reads_and_carries_the_two_first_heroes() {
        let g = Game::load();
        let b = g.kit("Brannoc").unwrap();
        assert!(b.melee && b.hp > 0.0 && b.attack.melee && b.attack.windup > 0.0);
        assert_eq!(b.spells[0].label, "chain hammer");
        assert!(b.spells[0].info.cc && b.spells[0].line && b.spells[0].num("damage") > 0.0);
        assert!(b.recast_of(3).unwrap().ai_wait && b.recast_of(0).is_none());
        let i = g.kit("Isolde").unwrap();
        assert!(!i.melee && i.attack.speed > 0.0 && i.spells[2].buff.is_some());
        let a = g.arena("frost").unwrap();
        assert!(!a.cover.is_empty() && a.cover.len() == a.walls.len() && (a.ring - 12.0).abs() < 1e-9);
    }
}
