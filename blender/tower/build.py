"""
Builds the Tower's own figures (people, enemies, rulers; docs/tower/models/README.md) the way the heroes of the fourth
style are built (blender/heroes/realkit.py): the pack's body on the Universal Animation Library's skeleton, dressed in
Blender, so the same clips play on them. One module per figure, blender/tower/<chapter>/<name>.py, each with a
`build()` that returns the dressed `Real`.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup
        --python blender/tower/build.py -- sea.keeper sea.fisher [--out <folder>] [--shots <folder>]

Writes <out>/<chapter>_<name>_v4.glb (default out: docs/tower/models/glb, not committed: it is rebuilt in a minute) and,
with --shots, a Blender check picture of each (<chapter>_<name>.png: front, three-quarter, side, back, face, T-pose).
The `_v4.glb` ending is what makes the game's figure code treat a model as one of this style (src/motion/real.ts).
One line per figure: "BUILT <name> ..." or "FAILED <name>" with the error.
"""
import importlib
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "blender", "heroes"))
sys.path.insert(0, HERE)

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opt(name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return os.path.abspath(v)
    return default


out = opt("--out", os.path.join(ROOT, "docs", "tower", "models", "glb"))
shots = opt("--shots", None)
os.makedirs(out, exist_ok=True)
if shots:
    os.makedirs(shots, exist_ok=True)
for n in args:
    try:
        mod = importlib.import_module(n)
        R = mod.build()
        stem = n.replace(".", "_")
        R.finish(os.path.join(out, f"{stem}_v4.glb"))
        if shots:
            R.render(os.path.join(shots, f"{stem}.png"))
        print(f"BUILT {n}", flush=True)
    except Exception:
        print(f"FAILED {n}\n{traceback.format_exc()[-2500:]}", flush=True)
