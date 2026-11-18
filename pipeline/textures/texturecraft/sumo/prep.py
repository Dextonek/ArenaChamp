"""Big Yoko for TextureCraft, step 1 (Blender, headless): lays the costume out in one texture atlas and writes the mesh
TextureCraft paints on.

    blender --background --factory-startup --python pipeline/textures/texturecraft/sumo/prep.py -- <work folder>

Reads public/models/heroes/sumo_v4.glb (never writes it). In <work folder> it writes:
- sumo_prep.blend: the hero with the atlas UVs, read again by finish.py so both use the very same UVs;
- carrier.glb: a still copy for TextureCraft (no skin, no compression): the skin (MI_Superhero_Male) as it is, and every
  costume piece on one material "costume", each material's faces a part named after it (for geometry masks), the hair
  and eyes on "other" so they still cast shadow in the bake;
- skin_base.png: the skin texture as the game has it (the pack's, tinted to Yoko's skin by the build);
- underwear_id.png: where the pack painted underwear on the male skin (its grey: no colour, light), red on black, read
  by TextureCraft as the skin's ID map so a colour-selection mask finds it. Made from the pack's own PNG, so it is the
  same for every hero on the male body (the female body needs its own, from its PNG).

The atlas: only the faces of the untextured costume materials get new UVs (UV map 0; the skin and eyes keep theirs).
The spare UV maps 1-3 that the build left (nothing reads them) are dropped. Triangles, positions, weights and bones are
not touched. Each material gets a share of the atlas by how much it shows (`DENSITY`).
"""
import math
import os
import sys

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
SRC = os.path.join(ROOT, "public", "models", "heroes", "sumo_v4.glb")
# texel density per material, relative. Only the two that gain from a texture are in the atlas: the crimson cloth (belt,
# stole, shoulder plates: shadow in its folds, gold edges) and the straw rope (shadow in its twists)
DENSITY = {"sumo_crimson": 1.0, "sumo_rope": 1.0}
# the projection angle per material: the rope (a thick tube) takes a wide one, so it is cut into a few long strips instead
# of one island per face (every UV seam doubles the vertices along it)
ANGLE = {"sumo_rope": 89, "sumo_crimson": 75}
# The rest take one flat swatch of the atlas each: every vertex one UV inside a small square at the atlas' right edge, so
# no vertex is added, and they keep their own flat colour, as before. The thin, many-sided pieces would split into an
# island per face (the twist strands: 2,702 vertices -> 7,019; the gold rings and borders: 1,817 -> 3,324: +115 KB in
# all); the near-black lacquer shows no shadow; the paper charms and the crest are small. Each JPEG kilobyte counts: a 1K
# atlas of everything was 130-230 KB, against about 100 KB of room under the 600 KB budget.
SWATCH = {"sumo_twist": 0, "sumo_gold": 1, "sumo_lacquer": 2, "sumo_paper": 3, "sumo_crest": 4}
ATLAS_U = 0.96  # the islands fill u 0..0.96; the swatches sit in the strip to the right of it
SW = 0.024  # a swatch's side: 24 px at 1K, 12 at 512
# the shoulder plates: the crimson pieces whose middle is above this share of the hero's height (they sit at 0.86, the
# stole at 0.73); a part of their own in the carrier, for the gold edges
PLATES, PLATE_HEIGHT = "sumo_crimson_plates", 0.82
MARGIN = 0.008  # of the atlas: about 8 px at 1K between islands, room for 4 px of padding on each side


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # BLENDER keeps every bone's frame as the file has it, so the export gives back the same nodes and bind matrices
    bpy.ops.import_scene.gltf(filepath=SRC, bone_heuristic="BLENDER")
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.startswith("Icosphere"):  # the importer's bone shape, not part of the hero
            bpy.data.objects.remove(o)
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    return body


def unwrap(body):
    me = body.data
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    uv_name = me.uv_layers[0].name
    names = [m.name for m in me.materials]
    groups = {n: names.index(n) for n in DENSITY if n in names}
    swatch = {n: names.index(n) for n in SWATCH if n in names}
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(me)
    uv = bm.loops.layers.uv[uv_name]
    scale = {}
    def select(ids):
        # select exactly these faces (vertices and edges too): Blender unwraps and packs whatever is selected, and the
        # import leaves everything selected, which would re-lay the skin's and the eyes' UVs as well
        bpy.ops.mesh.select_all(action="DESELECT")
        b = bmesh.from_edit_mesh(me)
        for f in b.faces:
            if f.material_index in ids:
                f.select_set(True)
        b.select_flush_mode()
        bmesh.update_edit_mesh(me)

    for name, idx in groups.items():
        select({idx})
        bpy.ops.uv.smart_project(angle_limit=math.radians(ANGLE.get(name, 60)), island_margin=0.0, area_weight=0.0,
                                 correct_aspect=True, scale_to_bounds=False)
        bm = bmesh.from_edit_mesh(me)
        uv = bm.loops.layers.uv[uv_name]
        faces = [f for f in bm.faces if f.material_index == idx]
        world = sum(f.calc_area() for f in faces)
        area = 0.0
        for f in faces:
            pts = [l[uv].uv for l in f.loops]
            area += abs(sum(pts[i].x * pts[i - 1].y - pts[i - 1].x * pts[i].y for i in range(len(pts)))) / 2
        # scale so that uv length per metre = DENSITY (before the final pack scales everything together)
        k = DENSITY[name] * math.sqrt(world / area) if area > 0 else 1.0
        scale[name] = k
        for f in faces:
            for l in f.loops:
                l[uv].uv = l[uv].uv * k
    select(set(groups.values()))
    # Blender 5 syncs the UV selection with the mesh's by default; off, "select all" means only the selected faces' UVs
    bpy.context.scene.tool_settings.use_uv_select_sync = False
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, scale=True, margin_method="FRACTION",
                            margin=MARGIN, shape_method="CONCAVE")
    bm = bmesh.from_edit_mesh(me)
    uv = bm.loops.layers.uv[uv_name]
    for f in bm.faces:
        if f.material_index in groups.values():
            for l in f.loops:
                l[uv].uv = l[uv].uv * ATLAS_U
    for name, idx in swatch.items():
        u0, v0 = ATLAS_U + 0.008, 0.01 + SWATCH[name] * (SW + 0.025)
        for f in bm.faces:
            if f.material_index != idx:
                continue
            for l in f.loops:
                p = l.vert.co  # one UV per vertex (from its position), so the swatch adds no seam
                l[uv].uv = (u0 + SW * (0.15 + 0.7 * ((p.x * 37.0 + p.z * 11.0) % 1.0)),
                            v0 + SW * (0.15 + 0.7 * ((p.y * 41.0 + p.z * 7.0) % 1.0)))
    bmesh.update_edit_mesh(me)
    bpy.ops.object.mode_set(mode="OBJECT")
    groups.update(swatch)
    print("UNWRAPPED", {k: round(v, 3) for k, v in scale.items()})
    return groups


def plates(ob):
    """In the carrier only: the crimson pieces high on the body (the two shoulder plates) get a material slot of their own,
    so they are a part of their own in TextureCraft and only they get gold edges. On every other crimson piece the
    curvature mask goes wrong: a thin tube (the hip cord, the apron's fringe) is all edge and turned gold, and the stole's
    creases drew gold cracks."""
    me = ob.data
    idx = [m.name for m in me.materials].index("sumo_crimson")
    me.materials.append(bpy.data.materials.new(PLATES))
    new = len(me.materials) - 1
    top = max(v.co.z for v in me.vertices)
    bm = bmesh.new()
    bm.from_mesh(me)
    seen = set()
    for f in bm.faces:
        if f.material_index != idx or f.index in seen:
            continue
        comp, stack = [], [f]
        seen.add(f.index)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.material_index == idx and h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        zs = [v.co.z for g in comp for v in g.verts]
        if (min(zs) + max(zs)) / 2 > PLATE_HEIGHT * top:
            for g in comp:
                g.material_index = new
    bm.to_mesh(me)
    bm.free()


def carrier(body, groups, path):
    """A still copy in the rest pose, split into parts, for TextureCraft."""
    ob = body.copy()
    ob.data = body.data.copy()
    bpy.context.scene.collection.objects.link(ob)
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    ob.parent = None
    ob.matrix_world = body.matrix_world.copy()
    ob.vertex_groups.clear()
    costume = bpy.data.materials.new("costume")
    other = bpy.data.materials.new("other")
    plates(ob)
    names = [m.name for m in ob.data.materials]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = list(bpy.context.selected_objects)
    for p in parts:
        name = p.data.materials[p.data.polygons[0].material_index].name
        p.name = p.data.name = name
        keep = name == "MI_Superhero_Male"
        costume_part = name in groups or name == PLATES
        mat = p.data.materials[p.data.polygons[0].material_index] if keep else (costume if costume_part else other)
        p.data.materials.clear()
        p.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_animations=False, export_skins=False, export_cameras=False, export_lights=False,
                              export_image_format="AUTO", export_vertex_color="NONE")
    for p in parts:
        bpy.data.objects.remove(p)
    print("CARRIER", path, sorted(p for p in names))


def skin_png(body, path):
    mat = next(m for m in body.data.materials if m.name == "MI_Superhero_Male")
    img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    print("SKIN", path, tuple(img.size))


def underwear_id(path, size=1024):
    """Red where the pack's male skin texture has its grey underwear, black elsewhere, grown by 2 px."""
    import numpy as np
    src = os.path.join(ROOT, "pipeline", "assets", "ubc", "Base Characters", "Textures", "T_Superhero_Male_Ligh.png")
    img = bpy.data.images.load(src)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]
    grey = (px.max(axis=2) - px.min(axis=2) < 0.07) & (px.max(axis=2) > 0.3)
    f = w // size
    m = grey.reshape(size, f, size, f).max(axis=(1, 3))
    for _ in range(2):
        g = m.copy()
        g[1:, :] |= m[:-1, :]
        g[:-1, :] |= m[1:, :]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g
    out = np.zeros((size, size, 4), dtype=np.float32)
    out[:, :, 0] = m
    out[:, :, 3] = 1
    o = bpy.data.images.new("underwear_id", size, size)
    o.pixels.foreach_set(out.reshape(-1))
    o.filepath_raw = path
    o.file_format = "PNG"
    o.save()
    print("UNDERWEAR", path, f"{m.mean() * 100:.1f}% of the skin texture")


def main():
    work = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    os.makedirs(work, exist_ok=True)
    body = load()
    groups = unwrap(body)
    skin_png(body, os.path.join(work, "skin_base.png"))
    underwear_id(os.path.join(work, "underwear_id.png"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, "sumo_prep.blend"))
    carrier(body, groups, os.path.join(work, "carrier.glb"))


main()
