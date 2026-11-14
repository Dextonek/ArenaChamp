"""
The Climb's enemies and rulers (docs/tower/models/README.md, *Rulers* and *Enemies*): shared parts on top of the people's
(folk.py) and the heroes' kit, and the lighter finish an enemy needs because it comes in packs.

`finish_light(R, out, faces=10000)` does what `Real.finish` does (bind the pieces, drop the skin under the clothes, merge,
shape, write the GLB) and three more things, so six of them cost a phone little:
- the merged mesh is decimated to about `faces` faces (a hero is 19,000 to 25,000);
- every plain colour material (figkit's: no texture, opaque, not glowing) becomes one of two (`cloth`, `metal`), its colour
  written into the faces' vertex colours: a unit is about five draw calls, not ten or twelve. The skin and the eyes keep
  their textures, a glowing material and a see-through one stay their own, and so do the keys in `keep` (the War's
  `livery`, which the game recolours per army);
- the skin's texture is written at `tex` pixels (512: an enemy is small on the screen).
A ruler (one at a time, drawn 2.2 to 2.9 times a hero) is finished as a hero is (`R.finish`), at full detail.
"""
import os

import bmesh
import bpy


def _flat_info(m):
    """(colour linear rgba, roughness, metallic, glowing, see-through, textured) of a material."""
    if not m or not m.use_nodes:
        return None
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        return None
    tex = any(n.type == "TEX_IMAGE" for n in nt.nodes) or bool(b.inputs["Base Color"].links)
    emit = b.inputs["Emission Strength"].default_value > 0 and any(c > 0.001 for c in b.inputs["Emission Color"].default_value[:3])
    alpha = b.inputs["Alpha"].default_value < 0.999
    return tuple(b.inputs["Base Color"].default_value), b.inputs["Roughness"].default_value, b.inputs["Metallic"].default_value, emit, alpha, tex


def _merged(name, rough, metal):
    """A material whose colour is the faces' vertex colour (exported as COLOR_0; three multiplies it in)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    a = nt.nodes.new("ShaderNodeVertexColor")
    a.layer_name = "Col"
    nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.use_backface_culling = False
    return m


def merge_materials(ob, keep=()):
    """Folds the plain colour materials of `ob` into `cloth` and `metal`, the colours into a corner colour attribute."""
    me = ob.data
    keep_names = {f"{ob.name}_{k}" for k in keep} | set(keep)
    plan = []
    for i, m in enumerate(me.materials):
        info = _flat_info(m)
        if m is None or info is None or info[3] or info[4] or info[5] or m.name in keep_names or any(m.name.endswith(f"_{k}") for k in keep):
            plan.append(None)
            continue
        col, rough, metal, *_ = info
        plan.append(("metal" if metal >= 0.5 else "cloth", col, rough, metal))
    if not any(plan):
        return 0
    groups = {}
    for p in plan:
        if p:
            g = groups.setdefault(p[0], [0.0, 0.0, 0])
            g[0] += p[2]
            g[1] += p[3]
            g[2] += 1
    new = {k: _merged(f"{ob.name}_{k}", g[0] / g[2], g[1] / g[2]) for k, g in groups.items()}
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    # the slots that stay, then the two new ones
    old = list(me.materials)
    slots = [m for m, p in zip(old, plan) if p is None] + list(new.values())
    index_of = {}
    for i, (m, p) in enumerate(zip(old, plan)):
        index_of[i] = slots.index(new[p[0]]) if p else slots.index(m)
    colour = [p[1] if p else (1.0, 1.0, 1.0, 1.0) for p in plan]
    for poly in me.polygons:
        c = colour[poly.material_index]
        for li in poly.loop_indices:
            attr.data[li].color = c
    remap = [index_of[poly.material_index] for poly in me.polygons]
    me.materials.clear()
    for m in slots:
        me.materials.append(m)
    for poly, k in zip(me.polygons, remap):
        poly.material_index = k
    return len(old) - len(slots)


def strip(ob):
    """Only what the game reads: one UV map (the one the textures use) and the one colour attribute `Col`."""
    me = ob.data
    uv = me.uv_layers.active_render or (me.uv_layers[0] if me.uv_layers else None)
    keep_uv = uv.name if uv else None
    for u in [u.name for u in me.uv_layers]:
        if u != keep_uv:
            me.uv_layers.remove(me.uv_layers[u])
    for c in [c.name for c in me.color_attributes]:
        if c != "Col":
            me.color_attributes.remove(me.color_attributes[c])
    if "Col" in me.color_attributes:
        me.color_attributes.active_color = me.color_attributes["Col"]
        me.color_attributes.render_color_index = me.color_attributes.active_color_index


def decimate(ob, faces):
    n = len(ob.data.polygons)
    if n <= faces:
        return n
    mod = ob.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = faces / n
    mod.use_collapse_triangulate = False
    # keep the armature after it: the decimate must come first in the stack to be applied on the rest shape
    ob.modifiers.move(len(ob.modifiers) - 1, 0)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return len(ob.data.polygons)


def finish_light(R, out, faces=10000, keep=(), tex=512):
    """`Real.finish` for an enemy: decimated, its plain colours merged, a small skin texture (module head)."""
    for f in R.pieces:
        for ob in f.finish():
            R._bind(ob, f.how)
    body = R.body
    bm = bmesh.new()
    bm.from_mesh(body.data)
    covered = R.covered
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.index in covered for v in f.verts)], context="FACES")
    bm.to_mesh(body.data)
    bm.free()
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == R.rig]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = R.name
    before = len(body.data.polygons)
    # the textures: the skin (and the eyes) smaller
    for m in body.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > tex:
                    n.image.scale(tex, tex)
    merged = merge_materials(body, keep)
    strip(body)
    after = decimate(body, faces)
    R._shape_all()
    R.rig.select_set(True)
    bpy.context.view_layer.objects.active = R.rig
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    R.rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                              export_skins=True, export_cameras=False, export_lights=False, export_image_format="JPEG", export_image_quality=80,
                              export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True, export_vertex_color="ACTIVE")
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB, {before} -> {after} faces ({tris} triangles), "
          f"{len(body.data.materials)} materials ({merged} merged)")
    return out


def rot(x=0.0, y=0.0, z=0.0):
    """An ellipsoid's turn (figkit takes a 4x4 matrix): about X, Y and Z in radians."""
    from mathutils import Euler
    return Euler((x, y, z)).to_matrix().to_4x4()
