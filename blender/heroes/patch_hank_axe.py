"""
Swaps Hank's axe in the exported model (public/models/heroes/timber_v3.glb) for the one in hank_axe.py, without the
figure build (its helper modules live outside this repo). Opens the model, finds the fist from the old haft, removes the
old axe (the Axeedge, Axesteel, Haft and Haftpaint parts), builds the new one bound to the right hand with the same
materials, and writes the model back with the exporter's settings (moba_figures.export):

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup
        --python blender/heroes/patch_hank_axe.py -- public/models/heroes/timber_v3.glb [out.glb]

Run it on the model with the old double-bitted axe (it needs the old haft to find the fist).
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hank_axe  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
src = os.path.abspath(args[0])
out = os.path.abspath(args[1]) if len(args) > 1 else src

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
objs = {o.name: o for o in bpy.data.objects}
for name in ("Axeedge", "Axesteel", "Haft", "Haftpaint"):
    if name not in objs:
        sys.exit(f"no {name}: is this the model with the old axe?")

# The fist: the old haft ran from 0.78 m below it to 1.26 m above it along OLD_DIR, three rings of ten (its middle is
# 0.24 m above the fist).
OLD_DIR = Vector((-0.2, -0.015, 0.98)).normalized()
haft = objs["Haft"]
pts = [haft.matrix_world @ v.co for v in haft.data.vertices]
mid = sum(pts, Vector()) / len(pts)
grip = mid - OLD_DIR * 0.24
hand = rig.matrix_world @ rig.data.bones["hand.R"].head_local
print(f"GRIP {tuple(round(c, 3) for c in grip)} hand.R joint {tuple(round(c, 3) for c in hand)}")


def colour_of(ob):
    """The old part's average vertex colour (the baked shading), or None."""
    ca = ob.data.color_attributes.get("Color")
    if not ca or not len(ca.data):
        return None
    acc = [0.0, 0.0, 0.0, 0.0]
    for d in ca.data:
        for k in range(4):
            acc[k] += d.color[k]
    n = len(ca.data)
    return ca.data_type, ca.domain, [a / n for a in acc]


mats = {
    "steel": objs["Axesteel"].data.materials[0],
    "edge": objs["Axeedge"].data.materials[0],
    "haft": objs["Haft"].data.materials[0],
    "band": objs["Haftpaint"].data.materials[0],
}
colours = {"steel": colour_of(objs["Axesteel"]), "edge": colour_of(objs["Axeedge"]), "haft": colour_of(objs["Haft"]), "band": colour_of(objs["Haftpaint"])}
for name in ("Axeedge", "Axesteel", "Haft", "Haftpaint"):
    bpy.data.objects.remove(objs[name], do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:  # the importer's bone shape
        bpy.data.objects.remove(o, do_unlink=True)

for ob, key in hank_axe.build(grip, mats):
    c = colours[key]
    if c:
        ca = ob.data.color_attributes.new("Color", c[0], c[1])
        for d in ca.data:
            d.color = c[2]
        ob.data.color_attributes.active_color = ca
    vg = ob.vertex_groups.new(name="hand.R")
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
