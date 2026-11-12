"""
Twin Flames, unhelped, several tries: how often a party of bots wins, and where each try's time went.

    python pipeline/tools/twin-tries.py <out folder> [--tries 6] [--players 6] [--seconds 300] [--port 5213]

Each try is one run of pipeline/tools/party-raid.py (`--boss ash`, no boost): N headless pages through the real hub, every
screen's autopilot playing. This reads each try's party.json (what every screen saw each second) and prints, per try: won or
not and when, when each of the two reached its phases and fell, how long each Eruption took, who fell to what, and whether
the screens agreed on both HP bars, the cracked halves, the bridges and the flood. Then the win rate. It writes tries.json.

The bots' accounts are local (server/data/, git-ignored): delete them after (names start with v5bot).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASES = ["floor cracks", "Eruption", "Together"]


def read(folder):
    """One try, from its party.json: None if the fight never started."""
    path = folder / "party.json"
    if not path.exists():
        return None
    screens = [[s for s in l["raid"]["samples"] if s.get("twin")] for l in json.loads(path.read_text(encoding="utf-8"))]
    screens = [s for s in screens if s]
    if not screens:
        return None
    first = screens[0]
    out = {"screens": len(screens), "seconds": first[-1]["t"], "over": [s[-1].get("over") for s in screens]}
    out["won"] = all(o == "win" for o in out["over"])
    # When each of the two reached each phase and fell, on screen 0's clock.
    for w, name in ((0, "ash"), (1, "ember")):
        out[name] = {
            "phases": [next((s["t"] for s in first if s["twin"]["phase"][w] > k), None) for k in range(3)],
            "fell": next((s["t"] for s in first if s["twin"]["dead"][w]), None),
            "left": round(100 * first[-1]["twin"]["hp"][w] / first[-1]["twin"]["max"][w]),
        }
        # Its Eruption: from the phase to the first second its own half's screens can hurt it again.
        mine = next((s for s in screens if s[0]["twin"]["half"] == w), None)
        at = out[name]["phases"][1]
        if mine and at is not None:
            end = next((s["t"] for s in mine if s["t"] > at + 3 and not s.get("guard")), None)
            out[name]["eruption"] = round(end - at, 1) if end else None
    out["flood"] = next((s["t"] for s in first if s.get("forge", {}).get("flood")), None)
    out["furious"] = sum(1 for s in first if s["twin"]["furious"] >= 0)
    # Who was down at the end, what each screen's hero was hit by, and what hit it last.
    out["down"] = sum(1 for s in screens if s[-1].get("down"))
    hits = {}
    for s in screens:
        for k, v in (s[-1].get("hits") or {}).items():
            hits[k] = hits.get(k, 0) + v
    out["hits"] = dict(sorted(hits.items(), key=lambda kv: -kv[1]))
    out["fellTo"] = [s[-1].get("killedBy") for s in screens if s[-1].get("down")]
    out["firstDown"] = min((next((x["t"] for x in s if x.get("down")), 1e9) for s in screens), default=None)
    # Do the screens agree? Sample by sample against screen 0, by the fight's own clock (within a second).
    by_t = {round(s["t"]): s for s in first}
    bars = cracked = bridges = inset = across = 0
    # How far apart the screens' rooms are in time: each half's age on a screen's room clock, against the computer's clock.
    offs = [[], []]
    for sc in screens:
        for half in (0, 1):
            seen = [s["forge"]["age"][half] - s["forge"]["wall"] / 1000 for s in sc if s.get("forge", {}).get("age") and s["forge"]["age"][half] is not None and s["forge"]["age"][half] > 6]
            if seen:
                offs[half].append((min(seen), max(seen)))
    drift = max((max(hi for _, hi in o) - min(lo for lo, _ in o) for o in offs if o), default=0)
    for sc in screens[1:]:
        for s in sc:
            ref = by_t.get(round(s["t"]))
            if not ref or not ref.get("forge") or not s.get("forge"):
                continue
            for i in (0, 1):
                bars = max(bars, abs(s["twin"]["hp"][i] - ref["twin"]["hp"][i]) / s["twin"]["max"][i])
            cracked += s["forge"]["cracked"] != ref["forge"]["cracked"]
            bridges += s["forge"]["bridges"] != ref["forge"]["bridges"]
            inset = max(inset, abs(s["forge"]["inset"] - ref["forge"]["inset"]))
    for sc in screens:
        for s in sc:
            if s["twin"]["wall"] and s.get("me") and (s["me"][0] < 0) != (s["twin"]["half"] == 0):
                across += 1
    out["apart"] = {"bars": round(bars * 100, 2), "roomClock": round(drift, 2), "inset": round(inset, 1), "across": across}
    out["lavaHits"] = sum((s[-1].get("hits") or {}).get("forge", 0) for s in screens)
    out["lava"] = sum(1 for sc in screens for s in sc if s.get("forge", {}).get("lava"))
    out["errors"] = sum(s[-1].get("errors", 0) for s in screens)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--tries", type=int, default=6)
    ap.add_argument("--players", type=int, default=6)
    ap.add_argument("--seconds", type=int, default=300)
    ap.add_argument("--port", type=int, default=5213)
    ap.add_argument("--only-read", action="store_true", help="read the tries already in the folder")
    a = ap.parse_args()
    out = Path(a.out)
    rows = []
    for i in range(a.tries):
        folder = out / f"try{i + 1}"
        if not a.only_read:
            subprocess.run([sys.executable, str(ROOT / "pipeline" / "tools" / "party-raid.py"), str(folder), "--players", str(a.players), "--seconds", str(a.seconds),
                            "--port", str(a.port), "--boss", "ash"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=a.seconds + 240)
        r = read(folder)
        rows.append(r)
        if not r:
            print(f"try {i + 1}: no fight")
            continue
        t = lambda v: "-" if v is None else f"{v:.0f}"
        print(f"try {i + 1}: {'WON' if r['won'] else 'not won'} at {r['seconds']:.0f} s; Ash {'/'.join(t(v) for v in r['ash']['phases'])} fell {t(r['ash']['fell'])} (left {r['ash']['left']} %), "
              f"Ember {'/'.join(t(v) for v in r['ember']['phases'])} fell {t(r['ember']['fell'])} (left {r['ember']['left']} %); Eruptions {r['ash'].get('eruption')} and {r['ember'].get('eruption')} s; "
              f"flood at {t(r['flood'])}; furious {r['furious']} s; down {r['down']} of {r['screens']} (first at {t(r['firstDown'] if r['firstDown'] and r['firstDown'] < 1e8 else None)}), fell to {r['fellTo']}; "
              f"hits {r['hits']}; seconds in lava {r['lava']}; apart {r['apart']}; errors {r['errors']}", flush=True)
    done = [r for r in rows if r]
    print(f"won {sum(1 for r in done if r['won'])} of {len(done)}")
    (out / "tries.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
