"""
Prints records of the in-game recorder (the game opened with ?perf=1: src/game/perfRecorder.ts) as a table, one row a fight,
so a real phone's numbers can be laid beside the performance tool's (pipeline/tools/perf-show.py).

    python pipeline/tools/perf-phone.py record.json [more.json ...]
    python pipeline/tools/perf-phone.py -            # paste the copied text, then end the input (Ctrl+Z and Enter on Windows)

A file holds one record (the card's Copy or Save) or a list of them. With --seconds it also prints a record's rows, one a
second: where in the fight it was slow, and what Auto did with the pixels.
"""
import argparse
import json
import sys
from pathlib import Path


def records(text):
    data = json.loads(text)
    return data if isinstance(data, list) else [data]


def device(r):
    d = r.get("device", {})
    gpu = d.get("gpu", "")
    # "ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)" -> "Adreno (TM) 650"
    if gpu.startswith("ANGLE (") and gpu.count(",") >= 1:
        gpu = gpu[7:].rstrip(")").split(",")[1].strip()
    scr = d.get("screen", [0, 0])
    return f"{gpu[:34]}, {scr[0]}x{scr[1]} @{d.get('pixelRatio', '?')}"


def main():
    ap = argparse.ArgumentParser(description="Print the in-game recorder's records as a table.")
    ap.add_argument("files", nargs="+", help="JSON files, or - for pasted text")
    ap.add_argument("--seconds", action="store_true", help="also every record's rows, one a second")
    args = ap.parse_args()
    rows = []
    for f in args.files:
        text = sys.stdin.read() if f == "-" else Path(f).read_text(encoding="utf-8")
        rows += records(text)
    print(f"{'played':17} {'hero':10} {'secs':>5} {'median':>7} {'a sec':>5} {'p99':>6} {'longest':>7} {'miss60':>6} {'miss30':>6} {'>50ms':>5} {'drawn':>10} {'level':>9} {'calls':>5} {'tris':>5}  device")
    for r in rows:
        level = r["level"] + (f" {round(r['share'] * 100)}%" if r["level"] == "auto" else "") + ("*" if r.get("lean") else "")
        print(f"{r['mode'][:17]:17} {r['hero'][:10]:10} {r['seconds']:5.0f} {r['median']:7.2f} {1000 / r['median'] if r['median'] else 0:5.0f} {r['p99']:6.1f} {r['longest']:7.1f} "
              f"{r['missed60'] * 100:5.1f}% {r['missed30'] * 100:5.1f}% {r['over50']:5d} {r['canvas'][0]:>5}x{r['canvas'][1]:<4} {level:>9} {r['calls']:5d} {r['triangles'] // 1000:4d}k  {device(r)}")
        if args.seconds:
            for s in r.get("perSecond", []):
                print(f"    {s['t']:4d} s  {s['frames']:3d} frames  longest {s['longest']:4d} ms  {s['canvas'][0]}x{s['canvas'][1]}  {s['level']} {round(s['share'] * 100)}%{' no shadows' if s['lean'] else ''}  {s['calls']} calls")
    if any(r.get("lean") for r in rows):
        print("* Auto left the shadows out (the processor was the limit)")


if __name__ == "__main__":
    main()
