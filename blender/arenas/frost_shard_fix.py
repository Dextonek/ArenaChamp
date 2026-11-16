"""
Frost's ice spires: the toppled shard lying at each spire's foot reached 1.2 m past its cover (the spire's capsule, r 0.8)
at 0.6 m high, so a hero could stand in its tip (the model review, round 2; measured 2026-11-16, docs/models/blender-round/).
frost_props.py now builds it shorter (`Toppled` in `spire`), but that build needs the old sculpt helpers (dao_blender), which
are not on every computer: this script makes the same change in the exported file. It opens
public/models/arenas/frost_props.glb, finds in SpireA__ice and SpireB__ice the one loose piece of ice that lies low and reaches
furthest from the spire's middle (the toppled shard), shrinks it toward its root by `SCALE` (the root stays where it touches the
outcrop), and writes the file again with the export settings of frost_props.export(). Nothing else is touched: the script
prints every object's vertex count before and after.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/arenas/frost_shard_fix.py -- [--dry] [--out <glb>]
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "frost_props.glb")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DRY = "--dry" in args
OUT = args[args.index("--out") + 1] if "--out" in args else SRC
#: The shard's new length against its old one (1.3 m -> about 0.6 m).
SCALE = 0.45

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = sorted([o for o in bpy.data.objects if o.type == "MESH"], key=lambda o: o.name)
before = {o.name: len(o.data.vertices) for o in objs}


def islands(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, isl = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            isl.append(a.index)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        out.append(isl)
    bm.free()
    # the crystals' facets are exported apart (sharp edges split their vertices): pieces that share a point are one crystal
    parent = list(range(len(out)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    owner = {}
    for k, isl in enumerate(out):
        for i in isl:
            key = tuple(round(c, 4) for c in me.vertices[i].co)
            if key in owner:
                parent[find(k)] = find(owner[key])
            else:
                owner[key] = k
    groups = {}
    for k, isl in enumerate(out):
        groups.setdefault(find(k), []).extend(isl)
    return list(groups.values())


for name in ("SpireA__ice", "SpireB__ice"):
    ob = bpy.data.objects.get(name)
    if ob is None:
        print("MISSING", name)
        continue
    me = ob.data
    # the object's own frame (the import may parent or rotate it: work in the mesh's local space, the prop's own)
    rows = []
    for isl in islands(me):
        P = [me.vertices[i].co for i in isl]
        # a glTF import is turned back to z up: the prop's base centre at the origin
        reach = max(math.hypot(p.x, p.y) for p in P)
        top = max(p.z for p in P)
        rows.append((reach, top, len(isl), isl))
    rows.sort(key=lambda r: -r[0])
    for r in rows[:6]:
        print(f"{name}: island of {r[2]} vertices, reach {r[0]:.2f} m from the middle, top {r[1]:.2f} m")
    low = [r for r in rows if r[1] < 0.9]
    shard = max(low, key=lambda r: r[0])
    P = [me.vertices[i].co for i in shard[3]]
    root = min(P, key=lambda p: math.hypot(p.x, p.y)).copy()
    print(f"{name}: the toppled shard: {shard[2]} vertices, reach {shard[0]:.2f} m, top {shard[1]:.2f} m, root at ({root.x:.2f}, {root.y:.2f}, {root.z:.2f})")
    if not DRY:
        for i in shard[3]:
            v = me.vertices[i]
            v.co = root + (v.co - root) * SCALE
        me.update()
        P = [me.vertices[i].co for i in shard[3]]
        print(f"{name}: now reach {max(math.hypot(p.x, p.y) for p in P):.2f} m, top {max(p.z for p in P):.2f} m")

after = {o.name: len(o.data.vertices) for o in objs}
for n in before:
    print(f"  {n}: {before[n]} -> {after[n]} vertices")
if not DRY:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    print(f"WROTE {OUT} {round(os.path.getsize(OUT) / 1024)} KB")
