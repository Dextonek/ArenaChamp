"""
Puts a Meshy model (or any unrigged character GLB) on the hero rig, so the game can pose it like the
procedural heroes in hero_figures.py.

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\heroes")
    import meshy_rig; importlib.reload(meshy_rig)
    meshy_rig.rig("void", r"C:\\VFXTool\\blender\\meshy\\void.glb", props=["void_greatsword"])
    meshy_rig.preview("void")                 # docs/heroes/void_meshy_*.png
    meshy_rig.export("void")                  # public/models/heroes/void.glb

What `rig` does:
1. Imports the GLB into the collection "Meshy <name>", joins it into one mesh, decimates it to `tris` triangles,
   stands it on the ground at the origin, 1.78 m tall, facing -Y (Meshy exports face -Y in Blender already).
2. Builds the hero's standard rig (`hero_figures`, same bone names and rest orientations as every hero) plus the
   hand-held props named in `props` (Meshy often drops a weapon; the procedural one goes back in the hand).
3. A-pose input: turns a copy of the rig's arm chains to lie along the model's arms (scaled to their length),
   skins the mesh to it by distance to the bones (Blender's heat weighting fails on decimated scans), then turns
   the arms down to the standard rest pose and makes that the rest pose. So the rest orientations stay the
   standard ones and the game's poses (relative rotations) work unchanged; only the arm bone lengths differ.
4. Moves the props to the new hand positions and skins them to the new rig. Textures are cut to `tex` px.
"""
import importlib
import os
import sys

import bpy
from mathutils import Vector
from mathutils.geometry import intersect_point_line

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import hero_figures as hf  # noqa: E402

HEIGHT = 1.78
BODY = ["pelvis", "chest", "neck", "head", "upper_arm.R", "forearm.R", "hand.R", "upper_arm.L", "forearm.L", "hand.L",
        "thigh.R", "shin.R", "foot.R", "thigh.L", "shin.L", "foot.L"]


def _coll(name):
    return bpy.data.collections.get(f"Meshy {name}")


def _object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def _select(objs, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def _build_figure(name, props):
    """The hero's standard figure with only `props`; returns (collection, rig, set of mesh names that are props)."""
    hf._reload()
    look = dict(hf.LOOKS[name])
    look["props"] = {}
    base = hf.HeroFigure(name, look).build()
    base_names = {o.name for o in base.objects}
    hf.kit.clear(base)
    look["props"] = {p: {} for p in props}
    coll = hf.HeroFigure(name, look).build()
    rig = next(o for o in coll.objects if o.type == "ARMATURE")
    prop_objs = [o for o in coll.objects if o.type == "MESH" and o.name not in base_names]
    return coll, rig, prop_objs


def _import(name, path, tris):
    old = _coll(name)
    if old:
        hf.kit.clear(old)
    coll = bpy.data.collections.new(f"Meshy {name}")
    bpy.context.scene.collection.children.link(coll)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    _object_mode()
    _select(meshes, meshes[0])
    for o in meshes:
        o.parent = None
    if len(meshes) > 1:
        bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = f"Meshy_{name}"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh.data.calc_loop_triangles()
    n = len(mesh.data.loop_triangles)
    if n > tris:
        m = mesh.modifiers.new("Decimate", "DECIMATE")
        m.ratio = tris / n
        bpy.ops.object.modifier_apply(modifier=m.name)
    vs = [v.co for v in mesh.data.vertices]
    lo = Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs)))
    hi = Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs)))
    s = HEIGHT / (hi.z - lo.z)
    mesh.scale = (s, s, s)
    mesh.location = (-(lo.x + hi.x) / 2 * s, -(lo.y + hi.y) / 2 * s, -lo.z * s)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return coll, mesh


def _arm_tips(mesh):
    """Fingertip of each arm (the farthest vertex sideways), or None when the arms already hang down."""
    vs = [v.co for v in mesh.data.vertices]
    tips = {}
    for side, sx in (("R", -1), ("L", 1)):
        far = max(vs, key=lambda v: v.x * sx)
        tips[side] = far.copy() if far.x * sx > 0.45 else None
    return tips


def _fit_arms(rig, tips):
    """Turns (and scales) each arm chain about its shoulder to end at the fingertip. Edit mode; returns scale per side."""
    _object_mode()
    _select([rig], rig)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = rig.data.edit_bones
    out = {}
    for side, tip in tips.items():
        if tip is None:
            continue
        chain = [eb[f"upper_arm.{side}"], eb[f"forearm.{side}"], eb[f"hand.{side}"]]
        # Read every bone first: a connected child's head follows its parent's tail as soon as that is set.
        old = [(b.head.copy(), b.tail.copy(), b.z_axis.copy(), b.use_connect) for b in chain]
        S = old[0][0]
        d0 = old[-1][1] - S
        d1 = tip - S
        q = d0.normalized().rotation_difference(d1.normalized())
        k = d1.length / d0.length
        for b in chain:
            b.use_connect = False
        for b, (h, t, z, _) in zip(chain, old):
            b.head = S + (q @ (h - S)) * k
            b.tail = S + (q @ (t - S)) * k
            b.align_roll(q @ z)
        for b, (_, _, _, c) in zip(chain, old):
            b.use_connect = c
        out[side] = round(k, 3)
    bpy.ops.object.mode_set(mode="OBJECT")
    return out


def _skin(mesh, rig):
    """Distance weights: each vertex goes to its nearest one or two bones (1/d^4), arms only on their own side."""
    segs = {n: (rig.matrix_world @ rig.data.bones[n].head_local, rig.matrix_world @ rig.data.bones[n].tail_local) for n in BODY}
    for g in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(g)
    vg = {n: mesh.vertex_groups.new(name=n) for n in BODY}
    arm = ("upper_arm", "forearm", "hand")
    for v in mesh.data.vertices:
        p = mesh.matrix_world @ v.co
        ds = []
        for n in BODY:
            if n.endswith(".R") and p.x > -0.05 or n.endswith(".L") and p.x < 0.05:
                continue
            if n.startswith(arm) and abs(p.x) < 0.17:
                continue
            a, b = segs[n]
            q, t = intersect_point_line(p, a, b)
            t = min(1.0, max(0.0, t))
            ds.append(((p - (a + (b - a) * t)).length, n))
        ds.sort()
        d0 = ds[0][0] + 1e-4
        ws = [(1.0 / (d + 1e-4) ** 4, n) for d, n in ds[:2] if d < d0 * 1.6]
        tot = sum(w for w, _ in ws)
        for w, n in ws:
            vg[n].add([v.index], w / tot, "REPLACE")
    mesh.parent = rig
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def _arms_down(mesh, rig, std):
    """Poses the fitted arms back to the standard rest direction, bakes that into the mesh and makes it the rest."""
    _select([rig], rig)
    bpy.ops.object.mode_set(mode="POSE")
    for side in ("R", "L"):
        rig.pose.bones[f"upper_arm.{side}"].matrix = std.data.bones[f"upper_arm.{side}"].matrix_local.copy()
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")
    _select([mesh], mesh)
    mod = next(m for m in mesh.modifiers if m.type == "ARMATURE")
    bpy.ops.object.modifier_apply(modifier=mod.name)
    _select([rig], rig)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def rig(name, path, props=(), tris=30000, tex=1024):
    """Rigs the GLB at `path` as hero `name` (a key of hero_figures.LOOKS). See the module docstring."""
    _object_mode()
    hf.dao.setup_scene()
    coll, mesh = _import(name, path, tris)
    fig, std, prop_objs = _build_figure(name, props)
    rig_obj = std.copy()
    rig_obj.data = std.data.copy()
    rig_obj.name = rig_obj.data.name = f"Rig_meshy_{name}"
    rig_obj.animation_data_clear()
    coll.objects.link(rig_obj)
    tips = _arm_tips(mesh)
    scale = _fit_arms(rig_obj, tips)
    _skin(mesh, rig_obj)
    if scale:
        _arms_down(mesh, rig_obj, std)
    moved = []
    for o in prop_objs:
        # Props are rigid on one bone (a hand): move them by how far that bone's head moved.
        bone = o.vertex_groups[0].name if o.vertex_groups else None
        world = o.matrix_world.copy()
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        o.parent = None
        o.matrix_world = world
        _select([o], o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if bone:
            delta = rig_obj.data.bones[bone].head_local - std.data.bones[bone].head_local
            for v in o.data.vertices:
                v.co += delta
        for m in o.modifiers:
            if m.type == "ARMATURE":
                m.object = rig_obj
        o.parent = rig_obj
        moved.append([o.name, bone])
    hf.kit.clear(fig)
    for m in mesh.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > tex:
                    n.image.scale(tex, tex)
    mesh.data.calc_loop_triangles()
    return {"hero": name, "triangles": len(mesh.data.loop_triangles), "arm_scale": scale, "props": moved}


def export(name):
    """Exports the rigged collection to public/models/heroes/<name>.glb (same settings as hero_figures.export)."""
    coll = _coll(name)
    _object_mode()
    objs = [o for o in coll.objects if o.type in ("MESH", "ARMATURE")]
    _select(objs, objs[0])
    path = os.path.join(hf.OUT, f"{name}.glb")
    hf.dao._export(
        path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=True, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
    )
    return {"hero": name, "kb": round(os.path.getsize(path) / 1024), "path": path}


def preview(name, views=(15,), size=640):
    """Turnaround renders of the rigged collection into docs/heroes/<name>_meshy_<angle>.png."""
    coll = _coll(name)
    return hf.kit.preview(coll, name=f"{name}_meshy", views=views, size=size, out_dir=hf.PREVIEWS)
