"""
Swaps Sirix's wings in the exported model (public/models/heroes/hive.glb) for the ones in sirix_wings.py, without the
figure build (its helper modules live outside this repo). Opens the model, removes the old wing cloak (the Wing and
Wingvein parts), builds the new wings bound to the chest with the model's own wing, vein and amber materials, and writes
the model back with the figure exporter's settings:

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup
        --python blender/heroes/patch_sirix_wings.py -- public/models/heroes/hive.glb [out.glb]
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sirix_wings  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
src = os.path.abspath(args[0])
out = os.path.abspath(args[1]) if len(args) > 1 else src

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
objs = {o.name: o for o in bpy.data.objects}
mats = {m.name: m for m in bpy.data.materials}
for name in ("Wing", "Wingvein"):
    if name not in objs:
        sys.exit(f"no {name} in the model")
use = {"wing": mats["fig_hive_wing"], "vein": mats["fig_hive_wingvein"], "rim": mats["fig_hive_amber"]}
for name in ("Wing", "Wingvein", "WingRim"):
    if name in objs:
        bpy.data.objects.remove(objs[name], do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:  # the importer's bone shape
        bpy.data.objects.remove(o, do_unlink=True)

for ob, key in sirix_wings.build(use):
    vg = ob.vertex_groups.new(name="chest")
    vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    print(f"PART {ob.name} {len(ob.data.vertices)} verts, {key}")

bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o == rig or o.parent == rig:
        o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
    export_skins=True, export_morph=False, export_cameras=False, export_lights=False,
    export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
    export_vertex_color="ACTIVE", export_all_vertex_colors=False,
)
print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB")
