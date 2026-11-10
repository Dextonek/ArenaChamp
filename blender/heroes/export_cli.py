"""
Export hero figures from moba_figures.py without the Blender window, so several can build at once:

    D:/blender/blender.exe --background <any .blend> --python blender/heroes/export_cli.py -- mirror_v3 mason_v3

Each figure is built, written to public/models/heroes/ and cleared; one line per figure is printed:
"EXPORT {json}" with the triangle count, size and seconds, or the error.
"""
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moba_figures  # noqa: E402

names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for n in names:
    t = time.time()
    try:
        r = moba_figures.export(n)
        r.pop("path", None)
        r["sec"] = round(time.time() - t, 1)
    except Exception:
        r = {"hero": n, "error": traceback.format_exc()[-2500:]}
    print("EXPORT " + json.dumps(r), flush=True)
