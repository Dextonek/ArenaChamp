"""
Builds heroes of the fourth style (blender/heroes/realkit.py) and writes public/models/heroes/<theme>_v4.glb:

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup
        --python blender/heroes/real_build.py -- astral forge cat [--shots <folder>]

Each hero is blender/heroes/real/<theme>.py with a function build() that returns the dressed `Real`.
One line per hero is printed: "BUILT <theme> ..." or "FAILED <theme>" with the error.
"""
import importlib
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# --shots <folder>: also render a check picture of each hero there (<theme>.png: front, three-quarter, side, back, face)
shots = None
if "--shots" in names:
    i = names.index("--shots")
    shots = os.path.abspath(names[i + 1])
    os.makedirs(shots, exist_ok=True)
    names = names[:i] + names[i + 2:]
for n in names:
    try:
        mod = importlib.import_module(f"real.{n}")
        R = mod.build()
        R.finish()
        if shots:
            R.render(os.path.join(shots, f"{n}.png"))
        print(f"BUILT {n}", flush=True)
    except Exception:
        print(f"FAILED {n}\n{traceback.format_exc()[-2500:]}", flush=True)
