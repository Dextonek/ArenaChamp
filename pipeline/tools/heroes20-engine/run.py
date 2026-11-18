"""Runs tests of this folder (the engine pieces of pipeline/designs/heroes20-engine.md) and prints their checks.

    python pipeline/tools/heroes20-engine/run.py sleep wards leash
    python pipeline/tools/heroes20-engine/run.py all
    python pipeline/tools/heroes20-engine/run.py sleep --port 5261

Each test is a tool-page script run by pipeline/tools/page-shots.py (which uses a dev server on --port, or starts one and
stops it). Pictures and the full result go to pipeline/sim/out/heroes20-engine/<test>/ (git-ignored).
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
OUT = ROOT / "pipeline" / "sim" / "out" / "heroes20-engine"
SKIP = {"lib", "harness"}


def main():
    args = sys.argv[1:]
    port = "5261"
    if "--port" in args:
        i = args.index("--port")
        port = args[i + 1]
        del args[i:i + 2]
    names = sorted(p.stem for p in HERE.glob("*.js") if p.stem not in SKIP and not p.stem.startswith("online")) if args in ([], ["all"]) else args
    failed = 0
    for t in names:
        out = OUT / t
        subprocess.run([sys.executable, str(ROOT / "pipeline" / "tools" / "page-shots.py"), str(HERE / f"{t}.js"), str(out),
                        "--port", port, "--timeout", "280", "--json", "result.json"], cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=330)
        try:
            d = json.loads((out / "result.json").read_text(encoding="utf-8"))
        except Exception as e:
            print(f"FAILED {t}: no result ({e})")
            failed += 1
            continue
        ok = d.get("ok")
        failed += 0 if ok else 1
        print(("OK     " if ok else "FAILED ") + t)
        for c in d.get("checks", []):
            print("   ", "ok " if c["ok"] else "NO ", c["name"], "" if c["ok"] else json.dumps(c.get("detail"))[:300])
        for e in d.get("errors", []):
            print("    error:", e[:300])
    sys.exit(1 if failed else 0)


main()
