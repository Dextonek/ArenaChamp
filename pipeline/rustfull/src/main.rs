//! Arena of Kits duels with the game's own rules, written again in Rust (docs/pipeline/rust-sim.md).
//!
//! IN THE MAKING. What is here so far are three ported pieces with their tests: cover and walking (`geom`), status
//! effects (`status`) and the basic attack (`attack`). There is no fight loop yet, so this program plays no fights.
//! Until it does and is graded against real fights, use the real simulator (pipeline/sim) for numbers and the rough
//! model (pipeline/rustsim) for quick estimates.

mod ai;
mod attack;
mod figure;
mod geom;
mod nav;
mod status;
mod zone;

fn main() {
    println!("rustfull: the game's fight rules in Rust, in the making (docs/pipeline/rust-sim.md).");
    println!("Ported so far, with tests (cargo test): cover and walking, status effects, the basic attack.");
    println!("No fight loop yet: it plays no fights. For numbers: python pipeline/sim/sim.py; for estimates: pipeline/rustsim.");
    // the pieces are used by the tests until the fight loop needs them
    let _ = (geom::pillar(0.0, 7.0, 0.85), status::StatusSet::default(), attack::Attacker::default());
}
