"""
The "real" direction for the one hero style (user, 2026-11-10: "what if you try to make them look real with a continuous
body and smooth shapes", then "what if you build it in Blender"). Lyra on a realistic base body:

- The body is Quaternius' Universal Base Characters (CC0): one continuous smooth skin on the same 65-bone skeleton as the
  Universal Animation Library (pipeline/assets/ual), so that pack's clips play on it as they are: no fitting.
- Fitted clothes (tunic, leggings, boots, bracers) are cut from the body's own surface and pushed out a few millimetres,
  so they carry the body's skin weights exactly and cannot sink into it.
- Loose pieces (skirt, sash, cape, collar, bow, halo) are built with figkit.py and bound to the skeleton: by the nearest
  point of the body, to one bone, or by height (the cape).

    blender --background --factory-startup --python blender/heroes/style_real.py -- <pack folder> <out.glb>

<pack folder> is the unpacked "Universal Base Characters[Standard]". Writes one rigged GLB.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, kdtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figkit  # noqa: E402
from style_blockout import bow, halo  # noqa: E402

PI = math.pi
args = sys.argv[sys.argv.index("--") + 1:]
pack, out = os.path.abspath(args[0]), os.path.abspath(args[1])

bpy.ops.wm.read_factory_settings(use_empty=True)
base = os.path.join(pack, "Base Characters")
bpy.ops.import_scene.gltf(filepath=os.path.join(base, "Godot - UE", "Superhero_Female_FullBody.gltf"))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = bpy.data.objects["Superhero_Female"]
first = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(pack, "Hairstyles", "Rigged to Head Bone", "glTF (Godot -Unreal)", "Hair_Long.gltf"))
new = [o for o in bpy.data.objects if o not in first]
for o in new:  # the hair first, on to the body's skeleton; then its own skeleton goes
    if o.type == "MESH" and o.parent is not None:
        o.parent = rig
        for m in o.modifiers:
            if m.type == "ARMATURE":
                m.object = rig
for o in new:
    if o.type != "MESH" or o.parent is None:
        bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o, do_unlink=True)
hair = bpy.data.objects["Hair_Long"]

# ---- materials -----------------------------------------------------------------------------------------------------
fig = figkit.Fig("lyra_real")
fig.mat("tunic", "#241a5c", rough=0.62)
fig.mat("violet", "#4a34a8", rough=0.6, double=True)
fig.mat("deep", "#17122e", rough=0.5)
fig.mat("leather", "#221a3c", rough=0.42, metal=0.1)
fig.mat("cape", "#1d1648", rough=0.7, double=True)
fig.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
fig.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
fig.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
fig.mat("hairc", "#16102e", rough=0.42)
M = fig.mats

# pale skin (the pack's light texture) and night-dark hair
light = os.path.join(base, "Textures", "T_Superhero_Female_Light_BaseColor.png")
for node in body.data.materials[0].node_tree.nodes:
    if node.type == "TEX_IMAGE" and node.image and "BaseColor" in node.image.name and os.path.exists(light):
        node.image = bpy.data.images.load(light)
hair.data.materials.clear()
hair.data.materials.append(M["hairc"])
bpy.data.objects["Eyebrows"].data.materials.clear()
bpy.data.objects["Eyebrows"].data.materials.append(M["hairc"])

# ---- the body, read once ---------------------------------------------------------------------------------------------
names = [g.name for g in body.vertex_groups]
mw = body.matrix_world
world = [mw @ v.co for v in body.data.vertices]
dom = []
for v in body.data.vertices:
    best = max(v.groups, key=lambda g: g.weight) if v.groups else None
    dom.append(names[best.group] if best else "")
bone = lambda n: rig.matrix_world @ rig.data.bones[n].head_local  # noqa: E731
HIP, KNEE, ANKLE = bone("thigh_l").z, bone("calf_l").z, bone("foot_l").z
WAIST, CHEST, NECK, HEAD = bone("spine_01").z + 0.03, bone("spine_03").z, bone("neck_01").z, bone("Head").z
TORSO = {"pelvis", "spine_01", "spine_02", "spine_03", "thigh_l", "thigh_r"}
kd = kdtree.KDTree(len(world))
for i, p in enumerate(world):
    kd.insert(p, i)
kd.balance()


def ring(z, grow=1.0, dz=0.018):
    """The body's outline at height z: (centre, half width, half depth)."""
    pts = [p for p, d in zip(world, dom) if abs(p.z - z) < dz and d in TORSO]
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
    y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
    return (Vector(((x0 + x1) / 2, (y0 + y1) / 2, z)), (x1 - x0) / 2 * grow, (y1 - y0) / 2 * grow)


def cloth(name, pred, offset, mat):
    """A fitted garment: the body's own faces where `pred(vertex index)` holds, pushed out by `offset` (m)."""
    ob = body.copy()
    ob.data = body.data.copy()
    ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    keep = [pred(v.index) for v in bm.verts]
    for i, k in enumerate(keep):
        if k:
            covered.add(i)
    for v in bm.verts:
        v.co += v.normal * offset
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(keep[v.index] for v in f.verts)], context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.materials.clear()
    ob.data.materials.append(M[mat])
    return ob


def bind(ob, how):
    """Bind a built piece to the skeleton: a bone name (rigid), "near" (the nearest body point's weights), or f(co) -> {bone: w}."""
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    groups = {}

    def add(n, i, w):
        if n not in groups:
            groups[n] = ob.vertex_groups.new(name=n)
        groups[n].add([i], w, "REPLACE")

    for v in ob.data.vertices:
        if how == "near":
            _, idx, _ = kd.find(ob.matrix_world @ v.co)
            for g in body.data.vertices[idx].groups:
                if g.weight > 0.01:
                    add(names[g.group], v.index, g.weight)
        elif callable(how):
            for n, w in how(ob.matrix_world @ v.co).items():
                add(n, v.index, w)
        else:
            add(how, v.index, 1.0)


def piece(how):
    """A figkit Fig that shares the materials; `done()` builds and binds it."""
    f = figkit.Fig("lyra_real")
    f.mats = M
    f.how = how
    pieces.append(f)
    return f


pieces = []
covered = set()

# ---- fitted clothes, cut from the body ---------------------------------------------------------------------------------
cloth("Tunic", lambda i: dom[i] in ("pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r"), 0.006, "tunic")
cloth("Leggings", lambda i: dom[i] in ("thigh_l", "thigh_r", "calf_l", "calf_r", "pelvis"), 0.003, "deep")
cloth("Boots", lambda i: dom[i].startswith(("foot_", "ball_")) or (dom[i].startswith(("calf_", "thigh_")) and world[i].z < KNEE + 0.09), 0.009, "leather")
cloth("Bracers", lambda i: dom[i].startswith("lowerarm_"), 0.007, "leather")

# ---- loose pieces ------------------------------------------------------------------------------------------------------
hem_z = KNEE + (HIP - KNEE) * 0.42


def skirt_w(co):
    t = max(0.0, min(1.0, (WAIST - 0.02 - co.z) / (HIP - 0.06 - WAIST + 0.02) * -1)) ** 0.7
    left = max(0.0, min(1.0, 0.5 + co.x / 0.1))
    th = 0.92 * t
    w = {"pelvis": 1 - th}
    if th * left > 0.001:
        w["thigh_l"] = th * left
    if th * (1 - left) > 0.001:
        w["thigh_r"] = th * (1 - left)
    return w


f = piece(skirt_w)
c_w, rx_w, ry_w = ring(WAIST)
c_h, rx_h, ry_h = ring(HIP - 0.02)
f.loft("violet", [(Vector((c_h.x, c_h.y - 0.01, hem_z)), rx_h * 1.55, ry_h * 2.0), (Vector((c_h.x, c_h.y - 0.005, (hem_z + c_h.z) / 2)), rx_h * 1.36, ry_h * 1.62), (c_h, rx_h * 1.24, ry_h * 1.34), (c_w, rx_w * 1.07, ry_w * 1.1)], seg=36)
f.loft("gold", [(Vector((c_h.x, c_h.y - 0.01, hem_z)), rx_h * 1.565, ry_h * 2.02), (Vector((c_h.x, c_h.y - 0.01, hem_z + 0.022)), rx_h * 1.54, ry_h * 1.985)], seg=36)
f.loft("gold", [(c_w + Vector((0, 0, -0.03)), rx_w * 1.12, ry_w * 1.16), (c_w + Vector((0, 0, 0.03)), rx_w * 1.1, ry_w * 1.14)], seg=36)

f = piece("spine_03")
c_n, rx_n, ry_n = ring(NECK - 0.035, dz=0.012)
neck = [p for p, d in zip(world, dom) if d == "neck_01" and abs(p.z - (NECK + 0.02)) < 0.02]
ncx, ncy = sum(p.x for p in neck) / len(neck), sum(p.y for p in neck) / len(neck)
nrx, nry = max(abs(p.x - ncx) for p in neck), max(abs(p.y - ncy) for p in neck)
f.loft("gold", [(Vector((ncx, ncy, NECK - 0.02)), nrx * 1.5, nry * 1.45), (Vector((ncx, ncy, NECK + 0.012)), nrx * 1.22, nry * 1.2), (Vector((ncx, ncy, NECK + 0.035)), nrx * 1.12, nry * 1.1)], seg=28)
f.ellipsoid("glow", (ncx, ncy - nry * 1.5, NECK - 0.03), (0.016, 0.009, 0.022), seg=(12, 8))
c_c, rx_c, ry_c = ring(CHEST)
# the crescent bow across the back, its string the one glowing line
bow(f, {"chest_z": CHEST - 0.05}, "gold", "glow", length=1.3, depth=0.33, r=0.02, tilt=0.5, y=c_c.y + ry_c + 0.12)

# a night cape from the shoulders to the knees: it follows the spine, stiffer toward the hem
f = piece(lambda co: {"spine_03": 1.0} if co.z > CHEST else ({"spine_03": (co.z - HIP) / (CHEST - HIP), "pelvis": 1 - (co.z - HIP) / (CHEST - HIP)} if co.z > HIP else {"pelvis": 1.0}))
cape = [(Vector((0, c_c.y + 0.03, KNEE - 0.02)), 0.36, 0.3), (Vector((0, c_c.y + 0.02, HIP)), 0.27, 0.21), (Vector((0, c_c.y + 0.01, CHEST)), rx_c * 1.12, ry_c * 1.3),
        (Vector((0, c_c.y, NECK - 0.05)), rx_n * 0.75, ry_n * 0.9)]
f.loft("cape", cape, arc=(PI - 1.3, PI + 1.3), seg=20)
c0, rx0, ry0 = cape[0]
f.tube("gold", [(c0.x + rx0 * math.sin(a), c0.y - ry0 * math.cos(a), c0.z) for a in [PI - 1.3 + 2.6 * k / 16 for k in range(17)]], 0.007, seg=6)
for a, zf in ((PI - 0.8, 0.2), (PI + 0.6, 0.35), (PI - 0.2, 0.55), (PI + 0.95, 0.7), (PI - 1.0, 0.75), (PI + 0.1, 0.12)):
    z = c0.z + (CHEST - c0.z) * zf
    k = 1 - zf * 0.55
    f.star("star", (rx0 * 1.02 * k * math.sin(a), c0.y - ry0 * 1.02 * k * math.cos(a), z), 0.028, 0.01, thick=0.008, normal=(math.sin(a), -math.cos(a), 0.2), turn=PI / 2)

for s, n in ((1, "l"), (-1, "r")):
    f = piece(f"calf_{n}")
    k = bone(f"calf_{n}") + Vector((0, 0, 0.085))
    f.torus("gold", k, 0.066, 0.008, seg=(24, 6))
    f = piece(f"foot_{n}")
    heel, toe = bone(f"foot_{n}"), bone(f"ball_{n}")
    f.ellipsoid("leather", Vector((heel.x, (heel.y + toe.y) / 2 - 0.05, 0.05)), (0.058, 0.155, 0.055), seg=(18, 10))
    f.ellipsoid("gold", Vector((heel.x, toe.y - 0.105, 0.04)), (0.045, 0.04, 0.035), seg=(12, 8))
    f = piece(f"lowerarm_{n}")
    e, w = bone(f"lowerarm_{n}"), bone(f"hand_{n}")
    f.torus("gold", e.lerp(w, 0.1), 0.05, 0.007, normal=(w - e), seg=(20, 6))
    f.torus("gold", e.lerp(w, 0.93), 0.036, 0.007, normal=(w - e), seg=(20, 6))
    f = piece(f"upperarm_{n}")
    sh = bone(f"upperarm_{n}")
    f.ellipsoid("gold", sh + Vector((0.03 * s, 0, 0.035)), (0.07, 0.06, 0.03), seg=(16, 8))

f = piece("Head")
hh = 0.235
J = {"head_c": Vector((0, 0.0, HEAD + 0.1)), "head_r": (hh * 0.4, hh * 0.44, hh * 0.5), "hh": hh}
halo(f, J, "gold", "star", hh * 0.85, y=0.17)
f.star("star", (0.075, -0.09, HEAD + 0.165), 0.03, 0.01, thick=0.008, normal=(0.5, -1, 0.3), turn=PI / 2)

for f in pieces:
    for ob in f.finish():
        bind(ob, f.how)

# ---- for the game: no skin under the clothes, one texture, one mesh --------------------------------------------------------
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.index in covered for v in f.verts)], context="FACES")
bm.to_mesh(body.data)
bm.free()
for ob in (body, bpy.data.objects["Eyes"]):
    mat = ob.data.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and ("BaseColor" in n.image.name or "Eye_Brown" in n.image.name))
    for name in ("Normal", "Roughness", "Metallic", "Base Color"):
        for l in list(bsdf.inputs[name].links):
            nt.links.remove(l)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.62 if ob is body else 0.25
    bsdf.inputs["Metallic"].default_value = 0.0
    if ob is body and tex.image.size[0] > 1024:
        tex.image.scale(1024, 1024)
    mat.blend_method = "OPAQUE"
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == rig]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = "Lyra"
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                          export_skins=True, export_cameras=False, export_lights=False, export_image_format="JPEG", export_image_quality=80,
                          export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True, export_vertex_color="NONE")
print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB, {len(body.data.polygons)} faces, {len(body.data.materials)} materials")
