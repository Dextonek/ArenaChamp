"""
Lays the Rust simulator's fights beside the real simulator's, number by number.

    python pipeline/rustfull/grade.py pipeline/rustfull/data/pair-frost.json pipeline/rustfull/data/rust-pair-frost.json
    python pipeline/rustfull/grade.py <real.json> <rust.json> [--page out.html] [--json out.json]

Both files hold fights in the record the real simulator keeps with --keep (pipeline/sim/sim.py), which the Rust
simulator writes too (rustfull duel ... --out). For each hero on each side (the two sides are played by two different
computer players) it prints, real beside Rust: the win rate, the fight's length, and per source (Q W E R, the basic
attack) the casts a second, the hits for each cast, the damage of a hit and the damage a second.

The first numbers to look at are the tight ones (casts a second, hits a cast, damage a hit): a wrong rule shows there
long before it shows in a win rate.
"""
import argparse
import json
import math
import sys
from pathlib import Path

SLOTS = ["Q", "W", "E", "R"]
SOURCES = SLOTS + ["attack", "trait"]


def load(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    fights = doc["fights"] if isinstance(doc, dict) else doc
    return [f for f in fights if f.get("s", 0) > 0]


def meta(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    return doc.get("meta", {}) if isinstance(doc, dict) else {}


def speed(m):
    """Fights a second of real time, from either tool's meta."""
    secs = m.get("wallSeconds") or m.get("realSeconds")
    return m["fights"] / secs if secs and m.get("fights") else None


def side_rows(fights):
    """Per (hero, side): what that hero did in the fights where it was on that side."""
    out = {}
    for f in fights:
        for side, name, dealt, hits, casts in (("player", f["h"], f.get("d", {}), f.get("n", {}), f.get("c", [0] * 4)),
                                               ("opponent", f["f"], f.get("t", {}), f.get("m", {}), f.get("k", [0] * 4))):
            r = out.setdefault((name, side), {"fights": 0, "wins": 0, "seconds": 0.0, "lengths": [], "dealt": {}, "hits": {}, "casts": [0] * 4})
            r["fights"] += 1
            r["wins"] += 1 if f.get("w") == name else 0
            r["seconds"] += f["s"]
            r["lengths"].append(f["s"])
            for k, v in dealt.items():
                r["dealt"][k] = r["dealt"].get(k, 0) + v
            for k, v in hits.items():
                r["hits"][k] = r["hits"].get(k, 0) + v
            for i, v in enumerate(casts):
                r["casts"][i] += v
    return out


def numbers(r):
    """The graded numbers of one (hero, side) row."""
    n, secs = r["fights"], max(r["seconds"], 1e-9)
    p = r["wins"] / n
    out = {"fights": n, "win": 100 * p, "win_pm": 100 * 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / n), "length": r["seconds"] / n, "sources": {}}
    lengths = sorted(r["lengths"])
    out["length_sd"] = (sum((x - out["length"]) ** 2 for x in lengths) / max(1, n - 1)) ** 0.5
    for k in SOURCES:
        dealt, hits = r["dealt"].get(k, 0), r["hits"].get(k, 0)
        casts = r["casts"][SLOTS.index(k)] if k in SLOTS else None
        if not dealt and not hits and not casts:
            continue
        out["sources"][k] = {
            "casts_10s": None if casts is None else 10 * casts / secs,
            "hits_cast": None if not casts else hits / casts,
            "hits_10s": 10 * hits / secs,
            "damage_hit": dealt / hits if hits else None,
            "dps": dealt / secs,
        }
    out["dps"] = sum(r["dealt"].values()) / secs
    return out


def grade(real, rust):
    a, b = side_rows(real), side_rows(rust)
    rows = []
    for key in sorted(a):
        if key in b:
            rows.append({"hero": key[0], "side": key[1], "real": numbers(a[key]), "rust": numbers(b[key])})
    return rows


def fmt(v, digits=2):
    return "   -  " if v is None else f"{v:6.{digits}f}"


def show(rows):
    for r in rows:
        a, b = r["real"], r["rust"]
        print(f"\n{r['hero']} on the {r['side']}'s side   ({a['fights']} real fights, {b['fights']} Rust fights)")
        print(f"  win rate        real {a['win']:5.1f}% (+-{a['win_pm']:.1f})   rust {b['win']:5.1f}% (+-{b['win_pm']:.1f})")
        print(f"  fight length    real {a['length']:5.1f} s            rust {b['length']:5.1f} s")
        print(f"  damage a second real {a['dps']:5.1f}              rust {b['dps']:5.1f}")
        print("  source   casts/10s real rust | hits/cast real rust | damage/hit real rust | damage/s real rust")
        for k in SOURCES:
            x, y = a["sources"].get(k), b["sources"].get(k)
            if not x and not y:
                continue
            x, y = x or {}, y or {}
            cell = lambda name, d=2: f"{fmt(x.get(name), d)} {fmt(y.get(name), d)}"
            print(f"  {k:7}  {cell('casts_10s')}        | {cell('hits_cast')}      | {cell('damage_hit', 1)}       | {cell('dps', 1)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("real")
    ap.add_argument("rust")
    ap.add_argument("--json")
    ap.add_argument("--page")
    ap.add_argument("--notes", help="a .json file: {\"title\": ..., \"notes\": [html, ...]} shown under the tables")
    args = ap.parse_args()
    rows = grade(load(args.real), load(args.rust))
    if not rows:
        sys.exit("the two files share no hero on the same side")
    show(rows)
    if args.json:
        Path(args.json).write_text(json.dumps({"rows": rows}, indent=1), encoding="utf-8")
    if args.page:
        template = (Path(__file__).parent / "grade.html").read_text(encoding="utf-8")
        ma, mb = meta(args.real), meta(args.rust)
        data = {"rows": rows, "real": Path(args.real).name, "rust": Path(args.rust).name, "arena": ma.get("arena") and f"in the arena '{ma['arena']}'"}
        if speed(ma) and speed(mb):
            data["speed"] = {"real": speed(ma), "rust": speed(mb)}
        if args.notes:
            n = json.loads(Path(args.notes).read_text(encoding="utf-8"))
            data["notesTitle"], data["notes"] = n.get("title"), n.get("notes", [])
        Path(args.page).write_text(template.replace("/*DATA*/null", json.dumps(data)), encoding="utf-8")
        print(f"\npage: {args.page}")


if __name__ == "__main__":
    main()
