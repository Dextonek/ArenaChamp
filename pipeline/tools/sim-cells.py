"""
Reads a simulator run kept with --keep (pipeline/sim/out/<name>.json) and prints, for each hero asked for, every pairing
split by side: wins as the player's hero, wins as the opponent, both together; and the totals against the six benchmark
heroes alone. With --detail it adds, per pairing, how the fights went: seconds, HP left, casts a fight and damage a
fight by source, for both heroes. With --json it prints the cells as JSON (for a page).

    python pipeline/tools/sim-cells.py t0-base Cantor Brannoc Vesper
    python pipeline/tools/sim-cells.py t0-base Cantor --detail --foe Kaia
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BENCH = ["Brannoc", "Kaia", "Isolde", "Sirix", "Cantor", "Oblivion"]


def max_hp():
    """Every hero's max HP, read from the kits (a fight's record keeps the HP left, not the max)."""
    out = {}
    for f in (ROOT / "src" / "kits").glob("*.ts"):
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r"HeroKit = \{\s*name: '([^']+)'", text):
            hp = re.search(r"maxHp: (\d+)", text[m.end():m.end() + 400])
            if hp:
                out[m.group(1)] = int(hp.group(1))
    return out


def margin(fs, mine, hero, foe, hp):
    """How far ahead the hero ended, as a share of max HP: its HP left less the foe's, averaged over the fights."""
    if not fs or hero not in hp or foe not in hp:
        return None
    return mean(((f["hp"][0] if mine else f["hp"][1]) / hp[hero] - (f["hp"][1] if mine else f["hp"][0]) / hp[foe]) for f in fs)


def cells(fights, hero):
    """{foe: {"hero": [wins, n], "opp": [wins, n], fights as hero, fights as opponent}}"""
    out = {}
    for f in fights:
        if hero not in (f["h"], f["f"]):
            continue
        mine = f["h"] == hero
        other = f["f"] if mine else f["h"]
        c = out.setdefault(other, {"hero": [0, 0], "opp": [0, 0], "asHero": [], "asOpp": []})
        side = c["hero"] if mine else c["opp"]
        side[1] += 1
        if f["w"] == hero:
            side[0] += 1
        (c["asHero"] if mine else c["asOpp"]).append(f)
    return out


def pct(w, n):
    return f"{100 * w / n:5.1f}%" if n else "    - "


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0


def detail(hero, foe, c):
    for label, fs, mine in (("as the player's hero", c["asHero"], True), ("as the opponent", c["asOpp"], False)):
        if not fs:
            continue
        won = [f for f in fs if f["w"] == hero]
        my_hp = mean((f["hp"][0] if mine else f["hp"][1]) for f in fs)
        their_hp = mean((f["hp"][1] if mine else f["hp"][0]) for f in fs)
        print(f"  {hero} {label} against {foe}: {len(won)}/{len(fs)}, {mean(f['s'] for f in fs):.1f} s, HP left {my_hp:.0f} / theirs {their_hp:.0f}")
        for who, dk, ck, nk in ((hero, "d" if mine else "t", "c" if mine else "k", "n" if mine else "m"),
                                (foe, "t" if mine else "d", "k" if mine else "c", "m" if mine else "n")):
            casts = [mean((f.get(ck) or [0, 0, 0, 0])[i] for f in fs) for i in range(4)]
            dmg, hits = {}, {}
            for f in fs:
                for k, v in (f.get(dk) or {}).items():
                    dmg[k] = dmg.get(k, 0) + v / len(fs)
                for k, v in (f.get(nk) or {}).items():
                    hits[k] = hits.get(k, 0) + v / len(fs)
            total = sum(dmg.values())
            parts = "  ".join(f"{k} {v:.0f} ({hits.get(k, 0):.1f} hits)" for k, v in sorted(dmg.items(), key=lambda kv: -kv[1]))
            secs = mean(f["s"] for f in fs)
            print(f"    {who:<9} casts Q {casts[0]:.1f} W {casts[1]:.1f} E {casts[2]:.1f} R {casts[3]:.1f} | {hits.get('attack', 0) / secs:.2f} attacks a second | "
                  f"damage a fight {total:.0f} ({total / secs:.1f} a second): {parts}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    ap.add_argument("heroes", nargs="+")
    ap.add_argument("--detail", action="store_true")
    ap.add_argument("--foe", nargs="*")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    path = Path(args.run)
    if not path.exists():
        path = ROOT / "pipeline" / "sim" / "out" / (args.run + ".json")
    data = json.loads(path.read_text(encoding="utf-8"))
    fights = data.get("fights") or []
    if not fights:
        sys.exit("the run kept no fights: run the simulator with --keep")
    out = {}
    hp = max_hp()
    for hero in args.heroes:
        cs = cells(fights, hero)
        order = [f for f in BENCH if f in cs] + sorted(f for f in cs if f not in BENCH)
        bh = [sum(cs[f]["hero"][i] for f in order if f in BENCH) for i in (0, 1)]
        bo = [sum(cs[f]["opp"][i] for f in order if f in BENCH) for i in (0, 1)]
        out[hero] = {"cells": {f: {"hero": cs[f]["hero"], "opp": cs[f]["opp"],
                                   "margin": [margin(cs[f]["asHero"], True, hero, f, hp), margin(cs[f]["asOpp"], False, hero, f, hp)]} for f in order},
                     "benchHero": bh, "benchOpp": bo}
        if args.json:
            continue
        print(f"\n{hero}: against the six, both sides {pct(bh[0] + bo[0], bh[1] + bo[1])} ({bh[0] + bo[0]}/{bh[1] + bo[1]}), "
              f"as the player's hero {pct(*bh)} ({bh[0]}/{bh[1]}), as the opponent {pct(*bo)} ({bo[0]}/{bo[1]})")
        print(f"  {'foe':<10}{'both':>12}{'as hero':>12}{'as opp':>12}{'ahead by (hero, opp)':>24}")
        for f in order:
            h, o = cs[f]["hero"], cs[f]["opp"]
            both = (h[0] + o[0], h[1] + o[1])
            flag = ""
            if both[1] and not 0.2 <= both[0] / both[1] <= 0.8:
                flag = "  <- one-sided"
            mh, mo = margin(cs[f]["asHero"], True, hero, f, hp), margin(cs[f]["asOpp"], False, hero, f, hp)
            ms = "  ".join("   - " if m is None else f"{100 * m:+5.0f}%" for m in (mh, mo))
            print(f"  {f:<10}{both[0]:>4}/{both[1]:<3}{pct(*both):>6}{h[0]:>5}/{h[1]:<3}{o[0]:>8}/{o[1]:<3}{ms:>20}{'' if f in BENCH else '  (not benchmark)'}{flag}")
        if args.detail:
            for f in order:
                if args.foe and f not in args.foe:
                    continue
                detail(hero, f, cs[f])
    if args.json:
        print(json.dumps(out))


if __name__ == "__main__":
    main()
