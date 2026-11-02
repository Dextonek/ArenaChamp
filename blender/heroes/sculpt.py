"""
Sculpted and painted finishing for the MOBA figures (moba_figures.py, a figure class with `SCULPT = True`).

- `fuse(parts, ...)`: joins parts of one material (all the skin: head, nose, ears, neck, arms, hands, muscle shapes)
  into one continuous surface: a voxel remesh melts them together, a volume-preserving smooth rounds the seams, a
  decimate brings the triangle count back down, and the bone weights are transferred from the parts it was made of.
- `folds(ob, ...)`: presses vertical cloth folds into a skirt or coat below a height.
- `paint(coll)`: a hand-painted read baked into vertex colours (exported as glTF COLOR_0, multiplied with the
  material colour in three.js): ambient occlusion in the creases, light on convex edges, darker toward the feet and
  lighter toward the head, and light from above. Emissive parts are left unpainted.

Blender coordinates: metres, z up, the figure faces -Y.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _apply(ob, md):
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=md.name)


def fuse(parts, name, voxel=0.007, smooth=16, target=None):
    """Melts `parts` (meshes of one material, already weighted) into one object named `name`. Returns it."""
    import kit
    ob = kit.join(name, list(parts)) if len(parts) > 1 else parts[0]
    ob.name = name
    src = ob.copy()
    src.data = ob.data.copy()
    for c in ob.users_collection:
        c.objects.link(src)
    md = ob.modifiers.new("Remesh", "REMESH")
    md.mode, md.voxel_size, md.use_smooth_shade = "VOXEL", voxel, True
    _apply(ob, md)
    md = ob.modifiers.new("Smooth", "LAPLACIANSMOOTH")
    md.iterations, md.lambda_factor, md.use_volume_preserve = smooth, 0.6, True
    _apply(ob, md)
    if target and len(ob.data.polygons) * 2 > target:
        # even quads at the budget (a decimate's long thin triangles show as facets on a small face)
        try:
            with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
                bpy.ops.object.quadriflow_remesh(target_faces=int(target / 2), use_mesh_symmetry=True, smooth_normals=True)
        except RuntimeError:
            pass
    if target and len(ob.data.polygons) * 2 > target * 1.4:
        # QuadriFlow refused (it needs a clean manifold): fall back to a decimate
        md = ob.modifiers.new("Decimate", "DECIMATE")
        md.ratio = target / (len(ob.data.polygons) * 2)
        _apply(ob, md)
        # the decimate leaves uneven triangles; a light relax evens them without losing volume
        md = ob.modifiers.new("Relax", "LAPLACIANSMOOTH")
        md.iterations, md.lambda_factor, md.use_volume_preserve = 3, 0.3, True
        _apply(ob, md)
    # bone weights from the parts it was made of
    ob.vertex_groups.clear()
    for g in src.vertex_groups:
        ob.vertex_groups.new(name=g.name)
    md = ob.modifiers.new("Weights", "DATA_TRANSFER")
    md.object = src
    md.use_vert_data = True
    md.data_types_verts = {"VGROUP_WEIGHTS"}
    md.vert_mapping = "POLYINTERP_NEAREST"
    md.layers_vgroup_select_src = "ALL"
    md.layers_vgroup_select_dst = "NAME"
    _apply(ob, md)
    _normalize(ob)
    data = src.data
    bpy.data.objects.remove(src, do_unlink=True)
    bpy.data.meshes.remove(data)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cap(ob, triangles):
    """Collapse-decimates `ob` down to about `triangles` (vertex groups are interpolated, so the skinning holds)."""
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= triangles:
        return
    md = ob.modifiers.new("Cap", "DECIMATE")
    md.ratio = triangles / tris
    _apply(ob, md)
    _normalize(ob)


def _normalize(ob, keep=4):
    """At most `keep` bone weights per vertex, summing to 1."""
    for v in ob.data.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups if g.weight > 1e-4), reverse=True)
        top, rest = gs[:keep], gs[keep:]
        total = sum(w for w, _ in top) or 1.0
        for w, gi in rest:
            ob.vertex_groups[gi].remove([v.index])
        for w, gi in top:
            ob.vertex_groups[gi].add([v.index], w / total, "REPLACE")


def folds(ob, below, n=9, amp=0.012, seed=0.0, top_fade=0.12):
    """Vertical folds round the z axis on the part of `ob` below height `below` (deeper toward the hem)."""
    rnd = random.Random(seed)
    phase = [rnd.uniform(0, 6.28) for _ in range(3)]
    for v in ob.data.vertices:
        z = v.co.z
        if z > below:
            continue
        k = min(1.0, (below - z) / top_fade)
        a = math.atan2(v.co.y, v.co.x)
        d = math.sin(n * a + phase[0]) + 0.45 * math.sin(2 * n * a + phase[1]) + 0.3 * math.sin(0.5 * n * a + phase[2])
        r = Vector((v.co.x, v.co.y, 0))
        if r.length < 1e-4:
            continue
        v.co += r.normalized() * (amp * d * k)


def _tree(meshes):
    """One BVH tree of every mesh (rest pose, world space) for occlusion rays."""
    bm = bmesh.new()
    for ob in meshes:
        tmp = bmesh.new()
        tmp.from_mesh(ob.data)
        tmp.transform(ob.matrix_world)
        me = bpy.data.meshes.new("_ao")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def _dirs(n=14):
    """Cosine-ish hemisphere directions round +Z (rotated to each normal)."""
    out = []
    g = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        out.append(Vector((math.cos(g * i) * r, math.sin(g * i) * r, z)))
    return out


# shadows lean toward a cool violet instead of plain grey, the way a painted texture shifts hue into the shade
SHADOW = (0.78, 0.7, 0.92)


def paint(coll, height=1.8, ao_dist=0.14, strength=1.0, tints=None):
    """
    Bakes the painted shading into a `Col` colour attribute on every non-emissive mesh of `coll`.
    `tints` per material part (the name after "moba_<hero>_"): `shadow` = the shade's hue, `warm` = skin (warm red
    shadows, a blush on the nose, cheeks, ears and knuckles), `tip` + `centre`, `r0`, `r1` = a colour toward the
    tips (from distance r0 to r1 from `centre`).
    """
    tints = tints or {}
    meshes = [o for o in coll.objects if o.type == "MESH"]
    tree = _tree(meshes)
    dirs = _dirs()
    for ob in meshes:
        mat = ob.data.materials[0] if ob.data.materials else None
        if mat and _emissive(mat):
            continue
        part = mat.name.split("_", 2)[-1] if mat else ""
        opt = tints.get(part, {})
        warm = opt.get("warm", 0.0)
        sh_col = Vector(opt.get("shadow", (1.0, 0.62, 0.55) if warm else SHADOW))
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        bm.normal_update()
        mw = ob.matrix_world
        nm = mw.to_3x3().inverted().transposed()
        shade, convs = [], []
        for v in bm.verts:
            p = mw @ v.co
            n = (nm @ v.normal).normalized()
            # occlusion: rays into the hemisphere round the normal
            t = n.orthogonal().normalized()
            b = n.cross(t)
            hit = 0
            for d in dirs:
                w = t * d.x + b * d.y + n * d.z
                loc, _, _, dist = tree.ray_cast(p + n * 0.003, w, ao_dist)
                if loc is not None:
                    hit += 1 - dist / ao_dist
            ao = 1 - hit / len(dirs)
            # convexity: neighbours below the tangent plane = an edge that catches light
            conv = 0.0
            for e in v.link_edges:
                o = e.other_vert(v)
                dv = o.co - v.co
                if dv.length > 1e-6:
                    conv += -v.normal.dot(dv.normalized())
            conv /= max(1, len(v.link_edges))
            grad = 0.72 + 0.28 * min(1.0, max(0.0, p.z / height))
            top = 1 + 0.1 * max(0.0, n.z) - 0.06 * max(0.0, -n.z)
            shade.append((0.45 + 0.55 * ao ** 1.3) * grad * top)
            convs.append(max(-0.25, min(0.25, conv)))
        # the edge light averaged over each vertex's neighbours: a soft highlight, not the blotches of a decimated mesh
        for _ in range(2):
            convs = [(c + sum(convs[e.other_vert(v).index] for e in v.link_edges)) / (1 + len(v.link_edges))
                     for v, c in zip(bm.verts, convs)]
        centre = Vector(opt.get("centre", (0, 0, 0)))
        cols = []
        for v, s, c in zip(bm.verts, shade, convs):
            val = s * (1 + 1.0 * c)
            val = min(1.0, max(0.25, 1 - (1 - min(1.05, val)) * strength))
            # dark values take the shadow hue, light ones stay neutral
            k = min(1.0, max(0.0, (0.92 - val) / 0.5))
            col = Vector((1, 1, 1)).lerp(sh_col, k) * val
            if warm:
                # blush on what sticks out: the nose tip, cheekbones, ears, knuckles
                b = warm * min(1.0, max(0.0, c * 6))
                col = Vector((col.x, col.y * (1 - 0.18 * b), col.z * (1 - 0.24 * b)))
            if "tip" in opt:
                d = ((mw @ v.co) - centre).length
                t = min(1.0, max(0.0, (d - opt["r0"]) / (opt["r1"] - opt["r0"])))
                col = Vector(a * (1 - t + t * b) for a, b in zip(col, opt["tip"]))
            cols.append(col)
        bm.free()
        attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        for i, c in enumerate(cols):
            attr.data[i].color = (min(1.0, c.x), min(1.0, c.y), min(1.0, c.z), 1.0)
        me.color_attributes.active_color = attr
        if mat:
            _wire(mat)


def _emissive(mat):
    b = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
    return bool(b and b.inputs["Emission Strength"].default_value > 0.05)


def _wire(mat):
    """Base colour = the material colour x the painted vertex colour (a little brighter to keep the mid tones)."""
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    if not b or nt.nodes.get("PaintMul"):
        return
    base = tuple(b.inputs["Base Color"].default_value)
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.name = "PaintMul"
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs[6].default_value = tuple(min(1.0, c * 1.12) for c in base[:3]) + (1.0,)
    nt.links.new(ca.outputs["Color"], mul.inputs[7])
    nt.links.new(mul.outputs[2], b.inputs["Base Color"])
