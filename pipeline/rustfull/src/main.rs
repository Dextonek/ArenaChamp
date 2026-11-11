//! Arena of Kits duels with the game's own rules, written again in Rust (docs/pipeline/rust-sim.md).
//!
//! IN THE MAKING. It plays whole fights between the heroes that are ported so far, and writes them in the same record
//! the real simulator keeps (`python pipeline/sim/sim.py ... --keep`), so the two can be laid side by side
//! (`python pipeline/rustfull/grade.py`). Until a hero passes that comparison, numbers for it come from the real
//! simulator.
//!
//!   rustfull duel Brannoc Isolde [--fights 200] [--arena frost] [--seed 1] [--threads N] [--trace] [--out file.json]
//!   rustfull frames Brannoc Isolde [--fights 6] [--seconds 9] [--out file.json]
//!   rustfull heroes

// pieces ported ahead of the heroes that need them (shields, dashes, the game's default attacks) are not used yet
#![allow(dead_code)]

mod ai;
mod attack;
mod bolt;
mod data;
mod fight;
mod figure;
mod geom;
mod hero;
mod nav;
mod status;
mod zone;

use fight::{Outcome, SOURCES};
use serde_json::{json, Map, Value};
use std::time::Instant;

fn by_source(values: &[f64; 7]) -> Value {
    let mut m = Map::new();
    for (k, v) in SOURCES.iter().zip(values) {
        if *v != 0.0 {
            m.insert((*k).to_string(), json!(v));
        }
    }
    Value::Object(m)
}

/// One fight in the real simulator's `--keep` shape, plus when each slot was first cast and when the first hit landed.
fn record(o: &Outcome) -> Value {
    let hits = |i: usize| -> [f64; 7] { o.tally[i].hits.map(|n| n as f64) };
    json!({
        "h": o.hero, "f": o.foe, "a": o.arena, "w": o.winner, "s": o.seconds, "hp": o.hp,
        "d": by_source(&o.tally[0].dealt), "t": by_source(&o.tally[1].dealt),
        "n": by_source(&hits(0)), "m": by_source(&hits(1)),
        "c": o.tally[0].casts, "k": o.tally[1].casts,
        "fc": o.tally[0].first_cast, "fk": o.tally[1].first_cast, "fh": [o.tally[0].first_hit, o.tally[1].first_hit],
    })
}

fn option(args: &[String], name: &str) -> Option<String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let game = data::Game::load();
    match args.first().map(String::as_str) {
        Some("heroes") => {
            println!("ported: {}", hero::ported().join(", "));
            println!("in the game: {} heroes, arenas: {}", game.hero_names().len(), game.arena_ids().join(", "));
        }
        Some("frames") if args.len() >= 3 => {
            // the first seconds of a few fights, frame by frame, in the rows pipeline/rustfull/probe-frames.js logs
            let fights: u64 = option(&args, "--fights").and_then(|v| v.parse().ok()).unwrap_or(6);
            let seconds: f64 = option(&args, "--seconds").and_then(|v| v.parse().ok()).unwrap_or(9.0);
            let seed: u64 = option(&args, "--seed").and_then(|v| v.parse().ok()).unwrap_or(1);
            let arena_id = option(&args, "--arena").unwrap_or_else(|| "frost".into());
            let arena = game.arena(&arena_id).expect("no such arena");
            let (a, b) = (game.kit(&args[1]).expect("no such hero"), game.kit(&args[2]).expect("no such hero"));
            let (mut list, mut rows) = (Vec::new(), Vec::new());
            let mut carry = fight::Carry::first();
            for (h, f) in [(&a, &b), (&b, &a)] {
                for i in 0..fights {
                    let n = list.len();
                    let mut w = fight::World::new(h.clone(), f.clone(), &arena, seed * 7919 + n as u64 + i, carry.clone());
                    w.frames = Some(Vec::new());
                    // the real probe plays each fight a second longer than it logs, then starts the next
                    while w.time <= seconds + 1.0 && w.over.is_none() {
                        w.step(fight::DT);
                        if w.time > seconds {
                            w.frames.as_mut().unwrap().pop();
                        }
                    }
                    carry = w.carry();
                    list.push(json!({ "n": n, "h": h.name, "f": f.name }));
                    for r in w.frames.take().unwrap() {
                        let mut row = vec![json!(n)];
                        row.extend(r.iter().map(|v| json!((v * 10000.0).round() / 10000.0)));
                        rows.push(Value::Array(row));
                    }
                }
            }
            let path = option(&args, "--out").unwrap_or_else(|| "frames.json".into());
            std::fs::write(&path, serde_json::to_string(&json!({ "fights": list, "rows": rows })).unwrap()).expect("cannot write");
            println!("written: {path}");
        }
        Some("duel") if args.len() >= 3 => {
            let fights: u64 = option(&args, "--fights").and_then(|v| v.parse().ok()).unwrap_or(200);
            let arena_id = option(&args, "--arena").unwrap_or_else(|| "frost".into());
            let seed: u64 = option(&args, "--seed").and_then(|v| v.parse().ok()).unwrap_or(1);
            let arena = game.arena(&arena_id).unwrap_or_else(|| panic!("no arena '{arena_id}': {}", game.arena_ids().join(", ")));
            let kit = |name: &str| game.kit(name).unwrap_or_else(|| panic!("no hero '{name}' in data/game.json"));
            let (a, b) = (kit(&args[1]), kit(&args[2]));
            if a.name == b.name {
                println!("{} against itself: the game's duel against the CPU never plays a hero against its own kit, so there is nothing to compare with.", a.name);
                return;
            }
            let t0 = Instant::now();
            // --trace: every cast and hit of every fight, in the rows pipeline/rustfull/probe.js logs in the real game
            let trace = args.iter().any(|a| a == "--trace");
            // each way round: the two sides are played by two different computer players
            let pairs = vec![(&a, &b), (&b, &a)];
            // Each processor thread is one "page": it plays its share of the fights one after another, and a fight
            // starts with what the fight before on that page left, as in the real simulator's browsers. Half the
            // threads by default, so the computer stays usable.
            // --page-fights: a real run's browser page plays this many fights in its life (the run's fights over its
            // browsers); what the page's clock decides (see World::now_ms) depends on it, so match it when grading.
            let page_fights: usize = option(&args, "--page-fights").and_then(|v| v.parse().ok()).unwrap_or(250).max(1);
            let all = std::thread::available_parallelism().map_or(1, |n| n.get());
            let threads = option(&args, "--threads").and_then(|v| v.parse().ok()).unwrap_or((all / 2).max(1)).max(1);
            let jobs: Vec<(usize, usize, u64)> = (0..pairs.len()).flat_map(|p| (0..fights).map(move |i| (p, i))).enumerate().map(|(n, (p, i))| (n, p, i)).collect();
            let mut done: Vec<(usize, fight::Outcome, Vec<Value>)> = std::thread::scope(|scope| {
                let handles: Vec<_> = (0..threads)
                    .map(|t| {
                        let (jobs, pairs, arena) = (&jobs, &pairs, &arena);
                        scope.spawn(move || {
                            let mut carry = fight::Carry::first();
                            let mut out = Vec::new();
                            for (k, &(n, p, i)) in jobs.iter().filter(|j| j.0 % threads == t).enumerate() {
                                if k > 0 && k % page_fights == 0 {
                                    carry = fight::Carry::first();
                                }
                                let (h, f) = pairs[p];
                                let (o, rows) = fight::fight_traced(h.clone(), f.clone(), arena, seed.wrapping_mul(1_000_003).wrapping_add(p as u64 * 500_009 + i), 120.0, trace, &mut carry);
                                out.push((n, o, rows));
                            }
                            out
                        })
                    })
                    .collect();
                handles.into_iter().flat_map(|h| h.join().expect("a fight stopped the program")).collect()
            });
            done.sort_by_key(|d| d.0);
            let (mut out, mut log, mut brief) = (Vec::new(), Vec::new(), Vec::new());
            let mut seconds = 0.0;
            let mut wins = vec![0u64; pairs.len()];
            for (n, o, rows) in done {
                if trace {
                    brief.push(json!({ "n": n, "h": o.hero, "f": o.foe, "w": o.winner, "s": o.seconds, "hp": o.hp }));
                    for row in rows {
                        let mut r = vec![json!(n)];
                        r.extend(row.as_array().unwrap().iter().cloned());
                        log.push(Value::Array(r));
                    }
                }
                // by the HP left, not by the winner's name: in a fight of a hero against itself both have the same name
                if o.winner.is_some() && o.hp[1] <= 0.0 {
                    wins[n / fights as usize] += 1;
                }
                seconds += o.seconds;
                out.push(record(&o));
            }
            for (p, (h, f)) in pairs.iter().enumerate() {
                println!("{} (the player's side) against {}: {} of {} won ({:.1}%)", h.name, f.name, wins[p], fights, 100.0 * wins[p] as f64 / fights as f64);
            }
            let real = t0.elapsed().as_secs_f64();
            println!("{} fights ({:.0} s of fighting) in {:.2} s on {} threads: {:.0} fights a second", out.len(), seconds, real, threads, out.len() as f64 / real.max(1e-9));
            if let Some(path) = option(&args, "--out") {
                let doc = if trace { json!({ "fights": brief, "log": log }) } else { json!({ "meta": { "tool": "rustfull", "arena": arena_id, "seed": seed, "fights": out.len(), "realSeconds": real, "threads": threads }, "fights": out }) };
                std::fs::write(&path, serde_json::to_string(&doc).unwrap()).unwrap_or_else(|e| panic!("cannot write {path}: {e}"));
                println!("written: {path}");
            }
        }
        _ => {
            println!("rustfull: the game's fight rules in Rust, in the making (docs/pipeline/rust-sim.md).");
            println!("  rustfull duel <hero> <hero> [--fights 200] [--arena frost] [--seed 1] [--threads N] [--page-fights 250] [--trace] [--out file.json]");
            println!("  rustfull frames <hero> <hero> [--fights 6] [--seconds 9] [--out file.json]");
            println!("  rustfull heroes");
            println!("ported so far: {}. For every other hero: python pipeline/sim/sim.py.", hero::ported().join(", "));
        }
    }
}
