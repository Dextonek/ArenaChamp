"""
Refreshes the rough Rust model's data from the game and shows how close the model is:

    python pipeline/rustsim/refresh.py                  everything: about 20 minutes, most of it the real roster run
    python pipeline/rustsim/refresh.py --run pipeline/sim/out/roster-fit.json     use a kept run that exists

What it does, in order:
  1. the heroes' sheets from the game itself (pipeline/rustsim/export.js) -> data/heroes.json
  2. a real roster run with every fight kept (pipeline/sim/sim.py all --reps 2 --keep), unless --run names one
  3. that run's fights -> data/run.json, and data/stamp.json (the commit and the day they are from)
  4. cargo build --release, then `rustsim check` -> data/check.json
  5. the page: data/check.html

Do this after any change to a hero, a spell or the CPU: the model only knows what the last real run saw. Needs what the
simulator needs (docs/pipeline/simulator.md) and Rust (cargo).
"""
import argparse
import datetime
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DATA = HERE / "data"


def run(cmd, **kw):
    print("> " + " ".join(str(c) for c in cmd), flush=True)
    r = subprocess.run(cmd, cwd=str(ROOT), **kw)
    if r.returncode != 0:
        sys.exit(f"that step failed (exit {r.returncode})")
    return r


def page():
    data = (DATA / "check.json").read_text(encoding="utf-8")
    html = (HERE / "report.html").read_text(encoding="utf-8").replace("/*__DATA__*/null", data.replace("</", "<\\/"))
    (DATA / "check.html").write_text(html, encoding="utf-8")
    print(f"page: {DATA / 'check.html'}")


def main():
    ap = argparse.ArgumentParser(description="Refresh the rough Rust model's data from the game.")
    ap.add_argument("--run", default="", help="a kept simulator run (.json made with --keep) to use instead of a new one")
    ap.add_argument("--page-only", action="store_true", help="only write the page again from data/check.json")
    args = ap.parse_args()
    DATA.mkdir(exist_ok=True)
    if args.page_only:
        return page()
    run([sys.executable, "pipeline/tools/page-shots.py", "pipeline/rustsim/export.js", "pipeline/rustsim/data", "--json", "heroes.json"])
    src = Path(args.run) if args.run else ROOT / "pipeline" / "sim" / "out" / "roster-fit.json"
    if not args.run:
        run([sys.executable, "pipeline/sim/sim.py", "all", "--reps", "2", "--keep", "--out", "roster-fit", "--max-minutes", "60"])
    kept = json.loads(src.read_text(encoding="utf-8"))
    if not kept.get("fights"):
        sys.exit(f"{src} holds no fights: it must be a run made with --keep")
    (DATA / "run.json").write_text(json.dumps({"fights": kept["fights"]}, separators=(",", ":")), encoding="utf-8")
    # the last commit that changed the game's own code: the model is out of date when a newer one exists
    commit = subprocess.run(["git", "log", "-1", "--format=%h", "--", "src"], cwd=str(ROOT), capture_output=True, text=True).stdout.strip()
    stamp = {"commit": commit, "date": kept.get("meta", {}).get("date", datetime.datetime.now().strftime("%Y-%m-%d %H:%M")),
             "fights": len(kept["fights"]), "command": kept.get("meta", {}).get("command", "")}
    (DATA / "stamp.json").write_text(json.dumps(stamp, indent=1), encoding="utf-8")
    run(["cargo", "build", "--release", "--manifest-path", "pipeline/rustsim/Cargo.toml"])
    exe = HERE / "target" / "release" / ("rustsim.exe" if sys.platform == "win32" else "rustsim")
    run([str(exe), "check"])
    page()


if __name__ == "__main__":
    main()
