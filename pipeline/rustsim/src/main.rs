//! A ROUGH model of Arena of Kits duels (docs/pipeline/rust-model.md). It does not know the game's rules. Each hero is a
//! short sheet that the real simulator fills in (pipeline/sim): how long the hero lives, and for each of its sources of
//! damage (Q, W, E, R, basic attack, units, passive) how often it lands and how hard. A fight here is two such sheets
//! racing each other with some luck. It answers "what if this number changed" in milliseconds, as an ESTIMATE; the real
//! simulator stays the judge, and no hero is balanced from these numbers.
//!
//!   rustsim check                       how close is the model? writes data/check.json for the page
//!   rustsim whatif "Anka" hp=480 q.damage=58 [--foes all]     before and after, the same luck in both
//!
//! Keys of a what-if: hp=N, ehp=+N (extra life the sheet's HP does not show: a heal, a shield, a second life),
//! q|w|e|r.damage=N, q|w|e|r.cooldown=N, attack.damage=N, attack.interval=N.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

const SOURCES: [&str; 7] = ["Q", "W", "E", "R", "attack", "unit", "trait"];
const BENCH: [&str; 6] = ["Brannoc", "Kaia", "Isolde", "Sirix", "Cantor", "Oblivion"];
const LIMIT: f64 = 120.0;

// ---- what the real simulator wrote ---------------------------------------------------------------------------------

#[derive(Deserialize)]
struct Run {
    fights: Vec<Fight>,
}

#[derive(Deserialize, Clone)]
struct Fight {
    h: String,
    f: String,
    w: Option<String>,
    s: f64,
    #[serde(default)]
    d: HashMap<String, f64>,
    #[serde(default)]
    t: HashMap<String, f64>,
    #[serde(default)]
    n: HashMap<String, f64>,
    #[serde(default)]
    m: HashMap<String, f64>,
}

#[derive(Deserialize)]
struct Sheets {
    heroes: Vec<SheetHero>,
}

#[derive(Deserialize, Clone)]
struct SheetHero {
    name: String,
    hp: f64,
    attack: SheetAttack,
    spells: Vec<SheetSpell>,
}

#[derive(Deserialize, Clone)]
struct SheetAttack {
    damage: f64,
    interval: f64,
}

#[derive(Deserialize, Clone)]
struct SheetSpell {
    key: String,
    cooldown: f64,
    damage: Option<f64>,
}

#[derive(Deserialize, Default)]
struct Stamp {
    #[serde(default)]
    commit: String,
    #[serde(default)]
    date: String,
}

// ---- a hero in the model -------------------------------------------------------------------------------------------

#[derive(Clone, Serialize)]
struct Source {
    /// hits a second, over all the hero's fights
    rate: f64,
    /// damage a hit
    damage: f64,
}

#[derive(Clone, Serialize)]
struct Hero {
    name: String,
    /// the sheet's HP
    hp: f64,
    /// the damage it really took before it fell (heals, shields and second lives are in here)
    ehp: f64,
    /// how much of an average opponent's damage reaches it (1: as much as anyone; less: hard to hit)
    taken: f64,
    sources: BTreeMap<String, Source>,
    fights: usize,
}

impl Hero {
    fn dps(&self) -> f64 {
        self.sources.values().map(|s| s.rate * s.damage).sum()
    }
}

/// Fits every hero's sheet to a set of real fights.
fn fit(fights: &[&Fight], sheets: &Sheets) -> Vec<Hero> {
    struct Acc {
        secs: f64,
        dmg: HashMap<String, f64>,
        hits: HashMap<String, f64>,
        lost_taken: f64,
        lost: f64,
        fights: usize,
    }
    let mut acc: HashMap<String, Acc> = HashMap::new();
    let add = |acc: &mut HashMap<String, Acc>, me: &str, other: &str, f: &Fight, dealt: &HashMap<String, f64>, hits: &HashMap<String, f64>, taken: &HashMap<String, f64>| {
        let a = acc.entry(me.to_string()).or_insert(Acc { secs: 0.0, dmg: HashMap::new(), hits: HashMap::new(), lost_taken: 0.0, lost: 0.0, fights: 0 });
        a.secs += f.s;
        a.fights += 1;
        for (k, v) in dealt {
            *a.dmg.entry(k.clone()).or_insert(0.0) += v;
        }
        for (k, v) in hits {
            *a.hits.entry(k.clone()).or_insert(0.0) += v;
        }
        if f.w.as_deref() == Some(other) {
            a.lost_taken += taken.values().sum::<f64>();
            a.lost += 1.0;
        }
    };
    for f in fights {
        add(&mut acc, &f.h, &f.f, f, &f.d, &f.n, &f.t);
        add(&mut acc, &f.f, &f.h, f, &f.t, &f.m, &f.d);
    }
    let mut heroes: Vec<Hero> = sheets
        .heroes
        .iter()
        .filter_map(|s| {
            let a = acc.get(&s.name)?;
            let mut sources = BTreeMap::new();
            for k in SOURCES {
                let hits = a.hits.get(k).copied().unwrap_or(0.0);
                let dmg = a.dmg.get(k).copied().unwrap_or(0.0);
                if hits > 0.0 && dmg > 0.0 && a.secs > 0.0 {
                    sources.insert(k.to_string(), Source { rate: hits / a.secs, damage: dmg / hits });
                }
            }
            // too few falls to know how long it lives: the sheet's HP
            let ehp = if a.lost >= 3.0 { a.lost_taken / a.lost } else { s.hp };
            Some(Hero { name: s.name.clone(), hp: s.hp, ehp, taken: 1.0, sources, fights: a.fights })
        })
        .collect();
    // how much of the others' damage reaches each hero: what it took, against what its opponents deal on average
    let dps: HashMap<String, f64> = heroes.iter().map(|h| (h.name.clone(), h.dps())).collect();
    let mut took: HashMap<String, (f64, f64)> = HashMap::new();
    for f in fights {
        let (dh, df) = (dps.get(&f.h).copied().unwrap_or(0.0), dps.get(&f.f).copied().unwrap_or(0.0));
        let e = took.entry(f.h.clone()).or_insert((0.0, 0.0));
        e.0 += f.t.values().sum::<f64>();
        e.1 += df * f.s;
        let e = took.entry(f.f.clone()).or_insert((0.0, 0.0));
        e.0 += f.d.values().sum::<f64>();
        e.1 += dh * f.s;
    }
    for h in heroes.iter_mut() {
        if let Some((got, expected)) = took.get(&h.name) {
            if *expected > 0.0 {
                h.taken = (got / expected).clamp(0.5, 1.6);
            }
        }
    }
    heroes
}

// ---- a fight in the model ------------------------------------------------------------------------------------------

/// A small generator of its own, so a what-if can replay exactly the luck of the run before it.
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1)
    }
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
    fn normal(&mut self) -> f64 {
        let (a, b) = (self.next().max(1e-12), self.next());
        (-2.0 * a.ln()).sqrt() * (std::f64::consts::TAU * b).cos()
    }
}

/// One fight: each source of damage lands at its own rhythm; the first to have dealt the other's life wins. `luck` is how
/// much a fight's lives vary (a dodge, cover, a bad start). Returns 1 when `a` wins, 0 when `b` does, 0.5 for nobody.
fn duel(a: &Hero, b: &Hero, luck: f64, rng: &mut Rng) -> f64 {
    let life = [a.ehp * (luck * rng.normal()).exp(), b.ehp * (luck * rng.normal()).exp()];
    let sides = [a, b];
    // (side, next moment, seconds between hits, damage a hit)
    let mut events: Vec<(usize, f64, f64, f64)> = Vec::with_capacity(14);
    for (i, h) in sides.iter().enumerate() {
        let reach = sides[1 - i].taken;
        for s in h.sources.values() {
            let gap = 1.0 / (s.rate * reach).max(1e-6);
            events.push((i, gap * rng.next(), gap, s.damage));
        }
    }
    if events.is_empty() {
        return 0.5;
    }
    let mut dealt = [0.0f64; 2];
    loop {
        let (mut k, mut at) = (0usize, f64::MAX);
        for (i, e) in events.iter().enumerate() {
            if e.1 < at {
                at = e.1;
                k = i;
            }
        }
        if at > LIMIT {
            return 0.5;
        }
        let (side, _, gap, dmg) = events[k];
        dealt[side] += dmg * (0.8 + 0.4 * rng.next());
        if dealt[side] >= life[1 - side] {
            return if side == 0 { 1.0 } else { 0.0 };
        }
        events[k].1 = at + gap * (0.5 + rng.next());
    }
}

/// The share of fights `a` wins against `b` (ties count half), over `n` fights with the luck of `seed`.
fn win_rate(a: &Hero, b: &Hero, luck: f64, n: usize, seed: u64) -> f64 {
    let mut rng = Rng::new(seed);
    (0..n).map(|_| duel(a, b, luck, &mut rng)).sum::<f64>() / n as f64
}

/// A hero's win rate against a list of opponents, in percent.
fn against(h: &Hero, foes: &[&Hero], luck: f64, n: usize) -> f64 {
    let mut sum = 0.0;
    let mut count = 0.0;
    for (i, f) in foes.iter().enumerate() {
        if f.name == h.name {
            continue;
        }
        sum += win_rate(h, f, luck, n, 1000 + i as u64);
        count += 1.0;
    }
    if count > 0.0 { 100.0 * sum / count } else { 50.0 }
}

/// Real win rates from fights: per hero, wins over fights with a winner or not (a fight nobody won counts as lost for both).
fn real_rates(fights: &[&Fight], foes: Option<&[&str]>) -> HashMap<String, (f64, f64)> {
    let mut out: HashMap<String, (f64, f64)> = HashMap::new();
    for f in fights {
        for (me, other) in [(&f.h, &f.f), (&f.f, &f.h)] {
            if let Some(list) = foes {
                if !list.contains(&other.as_str()) {
                    continue;
                }
            }
            let e = out.entry(me.clone()).or_insert((0.0, 0.0));
            e.1 += 1.0;
            if f.w.as_deref() == Some(me.as_str()) {
                e.0 += 1.0;
            }
        }
    }
    out
}

fn mean_abs(pairs: &[(f64, f64)]) -> f64 {
    if pairs.is_empty() { 0.0 } else { pairs.iter().map(|(a, b)| (a - b).abs()).sum::<f64>() / pairs.len() as f64 }
}

// ---- what-ifs ------------------------------------------------------------------------------------------------------

/// Applies `key=value` changes to a copy of a hero. Returns the changed hero and one line per change (or why it was skipped).
fn change(h: &Hero, sheet: &SheetHero, edits: &[String]) -> (Hero, Vec<String>) {
    let mut out = h.clone();
    let mut notes = Vec::new();
    for e in edits {
        let Some((key, value)) = e.split_once('=') else {
            notes.push(format!("{e}: not key=value, skipped"));
            continue;
        };
        let key = key.to_lowercase();
        let Ok(v) = value.trim_start_matches('+').parse::<f64>() else {
            notes.push(format!("{e}: {value} is not a number, skipped"));
            continue;
        };
        let scale = |out: &mut Hero, src: &str, of_damage: f64, of_rate: f64| -> bool {
            match out.sources.get_mut(src) {
                Some(s) => {
                    s.damage *= of_damage;
                    s.rate *= of_rate;
                    true
                }
                None => false,
            }
        };
        match key.as_str() {
            "hp" => {
                out.ehp += v - sheet.hp;
                out.hp = v;
                notes.push(format!("HP {} -> {v}", sheet.hp));
            }
            "ehp" => {
                out.ehp += v;
                notes.push(format!("{v:+} life beyond the HP bar"));
            }
            "attack.damage" => {
                let ok = scale(&mut out, "attack", v / sheet.attack.damage, 1.0);
                notes.push(if ok { format!("attack damage {} -> {v}", sheet.attack.damage) } else { "the hero's attack never landed in the real fights, skipped".into() });
            }
            "attack.interval" => {
                let ok = scale(&mut out, "attack", 1.0, sheet.attack.interval / v);
                notes.push(if ok { format!("attack interval {} -> {v}", sheet.attack.interval) } else { "the hero's attack never landed in the real fights, skipped".into() });
            }
            _ => {
                let Some((slot, what)) = key.split_once('.') else {
                    notes.push(format!("{e}: unknown key, skipped"));
                    continue;
                };
                let slot = slot.to_uppercase();
                let Some(spell) = sheet.spells.iter().find(|s| s.key == slot) else {
                    notes.push(format!("{e}: no spell {slot}, skipped"));
                    continue;
                };
                match what {
                    "damage" => match spell.damage {
                        Some(old) if old > 0.0 => {
                            let ok = scale(&mut out, &slot, v / old, 1.0);
                            notes.push(if ok { format!("{slot} damage {old} -> {v}") } else { format!("{slot} never landed in the real fights, skipped") });
                        }
                        _ => notes.push(format!("{slot} has no single damage number in its sheet: give the factor as ehp or change the spell in the game, skipped")),
                    },
                    "cooldown" => {
                        let ok = scale(&mut out, &slot, 1.0, spell.cooldown / v);
                        notes.push(if ok { format!("{slot} cooldown {} -> {v}", spell.cooldown) } else { format!("{slot} never landed in the real fights, skipped") });
                    }
                    _ => notes.push(format!("{e}: unknown key, skipped")),
                }
            }
        }
    }
    (out, notes)
}

// ---- the commands --------------------------------------------------------------------------------------------------

#[derive(Serialize)]
struct CheckHero {
    name: String,
    real: f64,
    real_fights: f64,
    model: f64,
    fitted_on: f64,
    hp: f64,
    ehp: f64,
    taken: f64,
    dps: f64,
}

#[derive(Serialize)]
struct Step {
    label: String,
    edits: Vec<String>,
    real: f64,
    model: f64,
}

#[derive(Serialize)]
struct Check {
    commit: String,
    date: String,
    head: String,
    fights: usize,
    luck: f64,
    /// mean distance in points: the model against the half it never saw, and the two halves of the real fights against each other
    model_error: f64,
    chance_error: f64,
    heroes: Vec<CheckHero>,
    steps: Vec<Step>,
    steps_base: f64,
}

/// The last commit that changed the game's own code (`src/`): what the model's data must be as new as.
fn head() -> String {
    std::process::Command::new("git").args(["log", "-1", "--format=%h", "--", "src"]).output().ok().and_then(|o| String::from_utf8(o.stdout).ok()).map(|s| s.trim().to_string()).unwrap_or_default()
}

fn load(dir: &Path) -> (Run, Sheets, Stamp) {
    let read = |name: &str| std::fs::read_to_string(dir.join(name)).unwrap_or_else(|_| {
        eprintln!("{} is missing: run  python pipeline/rustsim/refresh.py", dir.join(name).display());
        std::process::exit(2)
    });
    let run: Run = serde_json::from_str(&read("run.json")).expect("run.json is not a simulator run kept with --keep");
    let sheets: Sheets = serde_json::from_str(&read("heroes.json")).expect("heroes.json is not the game's export");
    let stamp: Stamp = serde_json::from_str(&std::fs::read_to_string(dir.join("stamp.json")).unwrap_or_else(|_| "{}".into())).unwrap_or_default();
    if run.fights.is_empty() {
        eprintln!("run.json holds no fights: it must be a run made with --keep");
        std::process::exit(2);
    }
    (run, sheets, stamp)
}

/// The luck that makes the model's spread of win rates match the real one best, on the fights it is fitted to.
fn fit_luck(heroes: &[Hero], real: &HashMap<String, (f64, f64)>) -> f64 {
    let refs: Vec<&Hero> = heroes.iter().collect();
    let mut best = (0.0, f64::MAX);
    for step in 0..=12 {
        let luck = step as f64 * 0.05;
        let pairs: Vec<(f64, f64)> = heroes.iter().filter_map(|h| real.get(&h.name).map(|r| (against(h, &refs, luck, 120), 100.0 * r.0 / r.1))).collect();
        let err = mean_abs(&pairs);
        if err < best.1 {
            best = (luck, err);
        }
    }
    best.0
}

fn check(dir: &Path) {
    let (run, sheets, stamp) = load(dir);
    // every other fight to fit, the rest to test: the model is never graded on what it was fitted to
    let fit_half: Vec<&Fight> = run.fights.iter().step_by(2).collect();
    let test_half: Vec<&Fight> = run.fights.iter().skip(1).step_by(2).collect();
    let heroes = fit(&fit_half, &sheets);
    let (real_fit, real_test) = (real_rates(&fit_half, None), real_rates(&test_half, None));
    let luck = fit_luck(&heroes, &real_fit);
    let refs: Vec<&Hero> = heroes.iter().collect();
    let mut rows = Vec::new();
    let (mut model_pairs, mut chance_pairs) = (Vec::new(), Vec::new());
    for h in &heroes {
        let (Some(t), Some(f)) = (real_test.get(&h.name), real_fit.get(&h.name)) else { continue };
        let (real, fitted_on) = (100.0 * t.0 / t.1, 100.0 * f.0 / f.1);
        let model = against(h, &refs, luck, 600);
        model_pairs.push((model, real));
        chance_pairs.push((fitted_on, real));
        rows.push(CheckHero { name: h.name.clone(), real, real_fights: t.1, model, fitted_on, hp: h.hp, ehp: h.ehp, taken: h.taken, dps: h.dps() });
    }
    rows.sort_by(|a, b| b.real.partial_cmp(&a.real).unwrap());

    // Does it predict a change? Anka's own balance steps of 2026-11-11 are the ground truth: the same kit with three
    // numbers different won 59, 63 and 69% against the six benchmark foes, where it now wins about 48.
    let all: Vec<&Fight> = run.fights.iter().collect();
    let full = fit(&all, &sheets);
    let bench: Vec<&Hero> = full.iter().filter(|h| BENCH.contains(&h.name.as_str())).collect();
    let mut steps = Vec::new();
    let mut steps_base = 0.0;
    if let (Some(anka), Some(sheet)) = (full.iter().find(|h| h.name == "Anka"), sheets.heroes.iter().find(|h| h.name == "Anka")) {
        steps_base = against(anka, &bench, luck, 4000);
        let ground: [(&str, &[&str], f64); 3] = [
            ("HP 460 -> 480", &["hp=480"], 59.0),
            ("and Q 54 -> 58", &["hp=480", "q.damage=58"], 63.0),
            ("and W 54 -> 60, rising with 30% not 25%", &["hp=480", "q.damage=58", "w.damage=60", "ehp=+20"], 69.0),
        ];
        for (label, edits, real) in ground {
            let edits: Vec<String> = edits.iter().map(|s| s.to_string()).collect();
            let (changed, _) = change(anka, sheet, &edits);
            steps.push(Step { label: label.to_string(), edits, real, model: against(&changed, &bench, luck, 4000) });
        }
    }

    let out = Check {
        commit: stamp.commit.clone(), date: stamp.date.clone(), head: head(), fights: run.fights.len(), luck,
        model_error: mean_abs(&model_pairs), chance_error: mean_abs(&chance_pairs), heroes: rows, steps, steps_base,
    };
    std::fs::write(dir.join("check.json"), serde_json::to_string_pretty(&out).unwrap()).expect("could not write check.json");
    println!("ESTIMATES from a rough model, fitted to {} real fights (commit {}, {}).", out.fights, if out.commit.is_empty() { "unknown" } else { &out.commit }, out.date);
    if !out.commit.is_empty() && out.commit != out.head {
        println!("NOTE: the game is now at {} and the model's data is from {}: refresh with  python pipeline/rustsim/refresh.py", out.head, out.commit);
    }
    println!("Win rate against the whole roster, on the half of the fights the model never saw:");
    println!("  the model is off by {:.1} points on average; the two halves of the real fights differ by {:.1} from chance alone.", out.model_error, out.chance_error);
    let mut worst: Vec<&CheckHero> = out.heroes.iter().collect();
    worst.sort_by(|a, b| (b.model - b.real).abs().partial_cmp(&(a.model - a.real).abs()).unwrap());
    println!("  furthest off: {}", worst.iter().take(5).map(|h| format!("{} (real {:.0}, model {:.0})", h.name, h.real, h.model)).collect::<Vec<_>>().join(", "));
    if !out.steps.is_empty() {
        println!("Does it predict a change? Anka against the six benchmark foes (model now: {:.0}%):", out.steps_base);
        for s in &out.steps {
            println!("  {:<44} real {:.0}%   model {:.0}%", s.label, s.real, s.model);
        }
    }
    println!("wrote {}", dir.join("check.json").display());
}

fn whatif(dir: &Path, name: &str, edits: &[String], all_foes: bool) {
    let (run, sheets, stamp) = load(dir);
    let all: Vec<&Fight> = run.fights.iter().collect();
    let heroes = fit(&all, &sheets);
    let luck = fit_luck(&heroes, &real_rates(&all, None));
    let low = name.to_lowercase();
    let Some(hero) = heroes.iter().find(|h| h.name.to_lowercase() == low).or_else(|| heroes.iter().find(|h| h.name.to_lowercase().starts_with(&low))) else {
        eprintln!("no hero called {name}. Heroes: {}", heroes.iter().map(|h| h.name.as_str()).collect::<Vec<_>>().join(", "));
        std::process::exit(2);
    };
    let sheet = sheets.heroes.iter().find(|s| s.name == hero.name).unwrap();
    let foes: Vec<&Hero> = if all_foes { heroes.iter().collect() } else { heroes.iter().filter(|h| BENCH.contains(&h.name.as_str())).collect() };
    let (changed, notes) = change(hero, sheet, edits);
    // the same luck before and after, so the difference is the change and not chance
    let (before, after) = (against(hero, &foes, luck, 6000), against(&changed, &foes, luck, 6000));
    let bench_list: Vec<&str> = BENCH.to_vec();
    let real = real_rates(&all, if all_foes { None } else { Some(&bench_list) });
    println!("ESTIMATE from a rough model (fitted to {} real fights, commit {}, {}). The real simulator is the judge.", run.fights.len(), if stamp.commit.is_empty() { "unknown" } else { &stamp.commit }, stamp.date);
    let now = head();
    if !stamp.commit.is_empty() && stamp.commit != now {
        println!("NOTE: the game is now at {now} and the model's data is from {}: refresh with  python pipeline/rustsim/refresh.py", stamp.commit);
    }
    println!("{} against {}:", hero.name, if all_foes { "the whole roster".to_string() } else { "the six benchmark foes".to_string() });
    for n in &notes {
        println!("  change: {n}");
    }
    if let Some(r) = real.get(&hero.name) {
        println!("  real, now:      {:>5.1}%  ({} fights)", 100.0 * r.0 / r.1, r.1);
    }
    println!("  model, now:     {before:>5.1}%");
    println!("  model, changed: {after:>5.1}%   ({:+.1} points)", after - before);
    println!("  to be sure:  python pipeline/sim/sim.py hero \"{}\"", hero.name);
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut dir = PathBuf::from("pipeline/rustsim/data");
    let mut rest = Vec::new();
    let mut all_foes = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--data" if i + 1 < args.len() => {
                dir = PathBuf::from(&args[i + 1]);
                i += 1;
            }
            "--foes" if i + 1 < args.len() => {
                all_foes = args[i + 1] == "all";
                i += 1;
            }
            other => rest.push(other.to_string()),
        }
        i += 1;
    }
    match rest.first().map(|s| s.as_str()) {
        Some("check") => check(&dir),
        Some("whatif") if rest.len() >= 3 => whatif(&dir, &rest[1], &rest[2..], all_foes),
        _ => {
            println!("A rough model of Arena of Kits duels: quick ESTIMATES, fitted to the real simulator's fights.");
            println!("  rustsim check                                    how close is the model? (writes data/check.json)");
            println!("  rustsim whatif \"Anka\" hp=480 q.damage=58         before and after, against the six benchmark foes");
            println!("  rustsim whatif \"Sir Whiskers\" q.cooldown=3 --foes all");
            println!("keys: hp=N  ehp=+N  q|w|e|r.damage=N  q|w|e|r.cooldown=N  attack.damage=N  attack.interval=N");
            println!("data: pipeline/rustsim/data (refresh: python pipeline/rustsim/refresh.py)");
        }
    }
}
