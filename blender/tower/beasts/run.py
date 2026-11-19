"""
Builds one of the Climb's beasts (blender/tower/beasts/<name>.py), exports it to public/models/tower/beasts/<name>.glb and renders it
from four sides with a 1.8 m hero beside it for scale (three-quarter, side, front, the game's camera), into docs/tower/beasts/.

    blender --background --factory-startup --python blender/tower/beasts/run.py -- hound
"""
import importlib
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "blender", "bosses"))
sys.path.insert(0, HERE)
import boss_bodies as bb  # noqa: E402

name = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "hound"
# --factory-startup's cube, light and camera would show in the renders.
for n in ("Cube", "Light", "Camera"):
    o = bpy.data.objects.get(n)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

mod = importlib.import_module(name)
mod.register()
bb.OUT = os.path.join(ROOT, "public", "models", "tower", "beasts")
# Sefu for scale, in the heroes' own style (CLAUDE.md: a new figure is judged in a line-up beside Sefu).
bb.HERO = os.path.join(ROOT, "public", "models", "heroes", "sand_v4.glb")
print("EXPORT", bb.export(name))
print("NODES", bb.glb_nodes(os.path.join(bb.OUT, f"{name}.glb"))["tree"])
bb.clear()

# The views: the beast at the origin facing -Y, a hero 1.6 m to its left.
out = os.path.join(ROOT, "docs", "tower", "beasts")
os.makedirs(out, exist_ok=True)
B = bb.build(name)
H = getattr(mod, "HEIGHT", 1.0)
bb._studio(name, H * 0.6)
bb._hero(-1.6)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 900, 700
k = max(1.0, H)
views = {
    "q34": ((-3.2 * k, -3.8 * k, 1.9 * k), (-0.3, -0.1, 0.55 * k), 45),
    "side": ((5.2 * k, -0.2, 0.9 * k), (-0.4, 0.0, 0.6 * k), 50),
    "front": ((0.2, -5.8 * k, 1.0 * k), (-0.4, 0, 0.62 * k), 50),
    "game": ((-0.4, -4.6 * k, 6.6 * k), (-0.4, 0.2, 0.5 * k), 42),
}
for v, (loc, tgt, lens) in views.items():
    sc.camera = bb._cam("cam " + v, loc, tgt, lens)
    sc.render.filepath = os.path.join(out, f"{name}-{v}.png")
    bpy.ops.render.render(write_still=True)
print("VIEWS", out)
