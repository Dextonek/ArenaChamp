"""
The drift guard of the full Rust simulator: has the game changed under a hero that is ported?

    python pipeline/rustfull/guard.py            check: lists what changed since the port was last matched to the game
    python pipeline/rustfull/guard.py --stamp    record the game's files as they are now (after the port was brought
                                                 up to date and graded again)

The Rust simulator is a second copy of the game's rules. Two copies of a rule drift apart silently, so every ported
hero keeps a fingerprint of the game files it was written from (its kit, its passive, its four spells), and the core
keeps one of the engine files (the duel, the hero's control, the arena, bolts, statuses, the attack, cover, the way
round cover, the passives' engine, the CPU levels). When a fingerprint no longer matches: read the change, bring the
Rust file up to date, grade again (grade.py), then --stamp.

Exit code 1 when something changed, so a script can stop on it.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAMP = Path(__file__).parent / "data" / "ported.json"
GAME = Path(__file__).parent / "data" / "game.json"

# The heroes that are ported (src/hero/mod.rs `PORTED`) and the Rust file each one lives in.
PORTED = {"Brannoc": "src/hero/forge.rs", "Isolde": "src/hero/frost.rs", "Kaia": "src/hero/storm.rs", "Auriel": "src/hero/dawn.rs", "Sirix": "src/hero/hive.rs", "Mr. Ledger": "src/hero/ledger.rs"}

# The engine files the core was written from, and where each went.
CORE = {
    "src/duel.ts": "fight.rs, ai.rs, zone.rs, figure.rs",
    "src/heroMode.ts": "fight.rs (the player's hero)",
    "src/arena.ts": "figure.rs, fight.rs",
    "src/runtime.ts": "fight.rs (the frame's order, a cast's zones)",
    "src/effects/projectile.ts": "bolt.rs",
    "src/effects/status.ts": "status.rs",
    "src/effects/telegraph.ts": "zone.rs",
    "src/attacks/attacker.ts": "attack.rs",
    "src/attacks/fx.ts": "fight.rs (the homing bolt of a ranged attack)",
    "src/obstacles.ts": "geom.rs",
    "src/nav.ts": "nav.rs",
    "src/traits/runtime.ts": "fight.rs (Runtime, rt_cast)",
    "src/traits/types.ts": "hero/mod.rs",
    "src/cpuLevels.ts": "ai.rs (BALANCE)",
    "pipeline/sim/page.js": "fight.rs (how a simulated fight is stepped and counted)",
}


def digest(path):
    data = (ROOT / path).read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()[:16]


def hero_files(name):
    """The game files a hero's rules live in: its kit, its passive, its four spells."""
    game = json.loads(GAME.read_text(encoding="utf-8"))
    hero = next(h for h in game["heroes"] if h["name"] == name)
    files = []
    for f in sorted((ROOT / "src" / "kits").glob("*.ts")):
        if re.search(r"name:\s*['\"]" + re.escape(name) + r"['\"]", f.read_text(encoding="utf-8")):
            files.append(f)
            theme = f.stem
            trait = ROOT / "src" / "traits" / f"{theme}.ts"
            if trait.exists():
                files.append(trait)
    labels = {s["label"] for s in hero["spells"]}
    for f in sorted((ROOT / "src" / "spells" / "targeted").glob("*.ts")):
        m = re.search(r"label:\s*(['\"])(.+?)\1", f.read_text(encoding="utf-8"))
        if m and m.group(2).replace("\\'", "'") in labels:
            files.append(f)
    return [str(f.relative_to(ROOT)).replace("\\", "/") for f in files]


def now():
    out = {"core": {p: digest(p) for p in CORE}, "heroes": {}}
    for name in PORTED:
        files = hero_files(name)
        if len(files) != 6:
            sys.exit(f"{name}: found {len(files)} game files, expected its kit, its passive and four spells: {files}")
        out["heroes"][name] = {p: digest(p) for p in files}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamp", action="store_true")
    args = ap.parse_args()
    cur = now()
    if args.stamp:
        STAMP.write_text(json.dumps(cur, indent=1), encoding="utf-8")
        print(f"stamped: {len(cur['core'])} engine files and {len(cur['heroes'])} heroes ({STAMP.relative_to(ROOT)})")
        return
    if not STAMP.exists():
        sys.exit("no stamp yet: python pipeline/rustfull/guard.py --stamp")
    old = json.loads(STAMP.read_text(encoding="utf-8"))
    changed = []
    for p, h in cur["core"].items():
        if old.get("core", {}).get(p) != h:
            changed.append(f"  engine  {p}  ->  pipeline/rustfull/src/{CORE[p]}")
    for name, files in cur["heroes"].items():
        for p, h in files.items():
            if old.get("heroes", {}).get(name, {}).get(p) != h:
                changed.append(f"  {name:8}{p}  ->  pipeline/rustfull/{PORTED[name]}")
    if not changed:
        print(f"the game has not changed under the port ({len(cur['core'])} engine files, {len(cur['heroes'])} heroes)")
        return
    print("the game changed under the Rust port. Read each change, bring the Rust file up to date, grade again, then --stamp:")
    print("\n".join(changed))
    sys.exit(1)


if __name__ == "__main__":
    main()
