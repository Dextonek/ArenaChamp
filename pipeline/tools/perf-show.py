"""Prints one of the performance tool's result files as a table: python pipeline/tools/perf-show.py baseline [other-label]
With two labels: the second beside the first, and whether each scene was the same fight (its print)."""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "docs" / "perf" / "data"


def load(label):
    return {(r["profile"], r["id"]): r for r in json.loads((DATA / f"{label}.json").read_text(encoding="utf-8"))["runs"] if not r.get("crashed")}


def main():
    a = load(sys.argv[1])
    b = load(sys.argv[2]) if len(sys.argv) > 2 else None
    print(f"{'profile':11} {'scene':13} {'median':>7} {'p99':>6} {'warm99':>6} {'longest':>7} {'step':>5} {'draw':>5} {'card':>5} {'calls':>5} {'tris':>5} {'parts':>5} {'MB/s':>5} {'shaders':>7} {'>33ms':>5}")
    for key, r in a.items():
        def line(r):
            return (f"{r['frame']['median']:7.2f} {r['frame']['p99']:6.1f} {r['warm']['p99']:6.1f} {r['frame']['max']:7.1f} {r['step']['median']:5.2f} {r['draw']['median']:5.2f} "
                    f"{r['gpu']['median']:5.2f} {r['drawCalls']['median']:5d} {r['triangles']['median'] // 1000:4d}k {r['particles']['max']:5d} {r['allocMBs']:5.1f} "
                    f"{r.get('compiledShaders', r['programs'] - r['programsBefore']):7d} {r['over33']:5d}")
        print(f"{key[0]:11} {key[1]:13} {line(r)}")
        if b and key in b:
            o = b[key]
            same = "same fight" if o["printHash"] == r["printHash"] else "ANOTHER FIGHT"
            print(f"{'':11} {'-> ' + sys.argv[2]:13} {line(o)}  {same}, median x{o['frame']['median'] / r['frame']['median']:.2f}")


if __name__ == "__main__":
    main()
