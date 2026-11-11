"""
Two event logs side by side: the real game's (pipeline/rustfull/probe.js) and the Rust simulator's
(rustfull duel ... --trace --out). For finding the rule behind a number that differs in grade.py.

    python pipeline/rustfull/trace-compare.py pipeline/rustfull/data/probe-frost.json pipeline/rustfull/data/rust-probe-frost.json

Per hero and side it prints, real beside Rust: when each slot is first cast, the gap between two casts of a slot, how
many of a slot's casts are the free recast and how long after the first cast they come, the damage of a hit by source,
how many hits carry each status, and how far apart the two heroes stand over the fight.
"""
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

SLOTS = "QWER"


def load(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    fights = {f["n"]: f for f in doc["fights"]}
    rows = defaultdict(list)
    for r in doc["log"]:
        rows[r[0]].append(r)
    return fights, rows


def who(f, side):
    return (f["h"], "player") if side == 0 else (f["f"], "opponent")


def collect(fights, rows):
    out = defaultdict(lambda: defaultdict(list))
    for n, f in fights.items():
        last = {}
        first = set()
        for r in rows.get(n, []):
            side, kind = r[1], r[2]
            if kind == "p":
                d = ((r[5] - r[7]) ** 2 + (r[6] - r[8]) ** 2) ** 0.5
                out[(f["h"] + " v " + f["f"], "both")][f"dist@{int(r[4] // 5) * 5:02d}s"].append(d)
                continue
            key = who(f, side)
            o = out[key]
            if kind == "c":
                slot, t, recast = r[3], r[4], r[5]
                s = SLOTS[slot]
                if (side, slot) not in first:
                    first.add((side, slot))
                    o[f"first {s}"].append(t)
                if recast:
                    o[f"recast {s} after"].append(t - last.get((side, slot), t))
                    o[f"recasts {s} per fight"].append(1)
                else:
                    if (side, slot) in last:
                        o[f"gap {s}"].append(t - last[(side, slot)])
                    last[(side, slot)] = t
                    o[f"casts {s} per fight"].append(1)
            elif kind == "h":
                src = SLOTS[r[3]] if isinstance(r[3], int) else r[3]
                if r[6]:
                    o[f"swallowed {src}"].append(1)
                    continue
                o[f"damage {src}"].append(r[5])
                if r[7]:
                    o[f"status {r[7]} from {src} per fight"].append(1)
        for side in (0, 1):
            out[who(f, side)]["fights"].append(1)
    return out


def summary(vals, per_fight, fights):
    if per_fight:
        return f"{len(vals) / max(1, fights):7.2f}        "
    if not vals:
        return "     -         "
    m = statistics.mean(vals)
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0
    return f"{m:7.2f} ±{sd:5.2f}"


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    a = collect(*load(sys.argv[1]))
    b = collect(*load(sys.argv[2]))
    for key in sorted(set(a) | set(b)):
        x, y = a.get(key, {}), b.get(key, {})
        nx, ny = len(x.get("fights", [])), len(y.get("fights", []))
        print(f"\n{key[0]} ({key[1]})   real {nx} fights, rust {ny} fights")
        print(f"  {'':34} {'real':>15}   {'rust':>15}    n real / rust")
        for name in sorted(set(x) | set(y)):
            if name == "fights":
                continue
            per = name.endswith("per fight") or name.startswith("swallowed")
            vx, vy = x.get(name, []), y.get(name, [])
            print(f"  {name:34} {summary(vx, per, nx)}   {summary(vy, per, ny)}    {len(vx)} / {len(vy)}")


if __name__ == "__main__":
    main()
