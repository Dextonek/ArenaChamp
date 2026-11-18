"""
The dragon's eye of Scarlet Sheath (src/showpiece/pieces/scarlet.ts): the eye that looks out of the rift, as a real 3D
model, like the showpieces' other creatures (blender/creatures/dragon.py) and the heroes: clean forms, one flat colour per
part, smooth shading, no detail maps.

A close-up of a dragon's face round one eye: a heavy brow overhanging it, rings of scales round the socket, a thick upper
lid and a lower lid that can close (each its own object, turning about the eye's centre), and the eyeball. The eyeball is
plain here: the page paints it in code (iris, the slit pupil that opens, the hole it becomes: src/showpiece/art/eye3d.ts).

    D:/blender/blender.exe --background --factory-startup --python blender/creatures/eye.py [-- --shots <folder>]

writes public/models/showpiece/eye.glb. The eyeball's radius is 1, its centre the origin; it looks along -Y (Blender's
front), so in three.js (y-up) it looks along +Z, at a camera on +Z. Objects: "Face", "LidUpper", "LidLower", "Eyeball".
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "blender", "heroes"))
import figkit  # noqa: E402

OUT = os.path.join(ROOT, "public", "models", "showpiece", "eye.glb")

# The socket's almond: half its width and height, on the face's front.
SOCKET_W, SOCKET_H = 1.18, 0.74


def almond(u):
    """A point of the socket's rim, u from 0 round to 1 (0 the outer corner); x across, z up."""
    a = 2 * math.pi * u
    x = SOCKET_W * math.cos(a)
    # Pointed corners: the height falls off faster towards them; the top a little fuller than the bottom.
    z = SOCKET_H * math.sin(a) * (1 - abs(math.cos(a)) ** 3 * 0.25) * (1.08 if math.sin(a) > 0 else 0.85)
    return x, z


def mat(key, color, rough=0.5, metal=0.0, emit=None, strength=1.0):
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = figkit.rgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = figkit.rgb(emit)
        b.inputs["Emission Strength"].default_value = strength
    return m


def obj(name, bm, material, smooth=True):
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def sphere(bm, c, r, rot=None, seg=(40, 24)):
    m = Matrix.Translation(Vector(c)) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1.0))
    return bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0, matrix=m)["verts"]


def apply(ob, mod):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {
        "face": mat("face", "#2c090b", rough=0.55),
        "scale": mat("scale", "#4a1013", rough=0.4),
        "brow": mat("brow", "#3a0c0e", rough=0.45),
        "lid": mat("lid", "#33090b", rough=0.5),
        "gold": mat("gold", "#d6a142", rough=0.3, metal=0.85),
        "eye": mat("eyeball", "#7a1a0e", rough=0.2, emit="#ff6a28", strength=1.0),
    }
    # --- The face: a broad dome behind the eye, the socket cut through it, the brow fused on. ---
    bm = bmesh.new()
    sphere(bm, (0.0, 1.35, 0.15), (5.2, 2.0, 3.4), seg=(64, 40))
    sphere(bm, (0.2, -0.25, 1.3), (2.7, 0.75, 0.5), rot=Matrix.Rotation(-0.08, 4, "Y"))       # the brow's overhang
    sphere(bm, (1.9, 0.0, 1.05), (1.4, 0.7, 0.45), rot=Matrix.Rotation(-0.35, 4, "Y"))         # swept up at the back
    sphere(bm, (0.3, -0.05, -1.45), (2.4, 0.55, 0.42), rot=Matrix.Rotation(0.05, 4, "Y"))     # the cheek under the eye
    face = obj("Face", bm, M["face"])
    rem = face.modifiers.new("fuse", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = 0.05
    apply(face, rem)
    sm = face.modifiers.new("round", "CORRECTIVE_SMOOTH")
    sm.factor, sm.iterations, sm.use_only_smooth = 0.7, 6, True
    apply(face, sm)
    dec = face.modifiers.new("fewer", "DECIMATE")
    dec.ratio = 0.3
    apply(face, dec)
    # The socket: an almond cutter through the face, a little larger than the opening the lids leave.
    cbm = bmesh.new()
    n = 64
    front, back = [], []
    for i in range(n):
        x, z = almond(i / n)
        front.append(cbm.verts.new((x * 1.04, -3.0, z * 1.12)))
        back.append(cbm.verts.new((x * 0.7, 0.6, z * 0.75)))
    cbm.faces.new(front)
    cbm.faces.new(list(reversed(back)))
    for i in range(n):
        j = (i + 1) % n
        cbm.faces.new((front[j], front[i], back[i], back[j]))
    cutter = obj("Cutter", cbm, M["face"], smooth=False)
    b = face.modifiers.new("socket", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.object = cutter
    b.solver = "EXACT"
    apply(face, b)
    bpy.data.objects.remove(cutter, do_unlink=True)
    # --- Scales: rings of plates round the socket, laid on the face's surface, overlapping like a lizard's. ---
    bvh = BVHTree.FromObject(face, bpy.context.evaluated_depsgraph_get())
    fig = figkit.Fig("eye")
    fig.mats["scale"] = M["scale"]
    rnd = random.Random(7)
    for ring in range(6):
        k = 1.12 + ring * 0.24
        count = int(26 + ring * 6)
        size = 0.15 + ring * 0.035
        for i in range(count):
            u = (i + 0.5 * (ring % 2)) / count
            x, z = almond(u)
            x, z = x * k, z * (k * 0.86 + 0.14)
            hit = bvh.ray_cast(Vector((x, -6.0, z)), Vector((0, 1, 0)))
            if hit[0] is None:
                continue
            p, nrm = hit[0], hit[1]
            # Each plate points away from the eye (towards the back of the head), lying on the skin.
            out = Vector((x, 0, z)).normalized()
            tang = (out - nrm * out.dot(nrm)).normalized()
            side = nrm.cross(tang).normalized()
            rot = Matrix((tang, side, nrm)).transposed().to_4x4()
            s = size * rnd.uniform(0.85, 1.15)
            fig.ellipsoid("scale", tuple(p + nrm * 0.02), (s * 1.25, s, s * 0.3), seg=(14, 8), rot=rot)
    # A ridge of gold along the brow's edge.
    fig.mats["gold"] = M["gold"]
    pts = []
    for i in range(14):
        u = 0.06 + 0.38 * i / 13
        x, z = almond(u)
        hit = bvh.ray_cast(Vector((x * 1.02, -6.0, z * 1.25 + 0.18)), Vector((0, 1, 0)))
        if hit[0] is not None:
            pts.append(tuple(hit[0] + hit[1] * 0.03))
    if len(pts) > 3:
        fig.tube("gold", pts, 0.035, seg=8)
    parts = fig.finish()
    # --- The lids: shells round the eyeball, turning about its centre (the origin). ---
    def lid(name, origin, normal, thick):
        """A shell round the eyeball, cut by one plane (a clean arc of an edge), only its front half kept."""
        lb = bmesh.new()
        sphere(lb, (0, 0, 0), (1.08, 1.08, 1.08), seg=(96, 64))
        geom = lb.verts[:] + lb.edges[:] + lb.faces[:]
        bmesh.ops.bisect_plane(lb, geom=geom, plane_co=Vector(origin), plane_no=Vector(normal), clear_inner=True)
        geom = lb.verts[:] + lb.edges[:] + lb.faces[:]
        bmesh.ops.bisect_plane(lb, geom=geom, plane_co=Vector((0, 0.45, 0)), plane_no=Vector((0, 1, 0)), clear_outer=True)
        ob = obj(name, lb, M["lid"])
        so = ob.modifiers.new("thick", "SOLIDIFY")
        so.thickness = thick
        so.offset = 1.0
        apply(ob, so)
        return ob
    # The upper lid hangs over the top of the eye, its edge tilted down towards the front corner; the lower lid holds the
    # bottom. Between them the almond the eye looks out of.
    upper = lid("LidUpper", (0, 0, 0.5), (0.08, -0.25, 1.0), 0.13)
    lower = lid("LidLower", (0, 0, -0.55), (0.05, -0.2, -1.0), 0.09)
    # --- The eyeball. ---
    eb = bmesh.new()
    sphere(eb, (0, 0, 0), (1, 1, 1), seg=(96, 64))
    eyeball = obj("Eyeball", eb, M["eye"])
    # The face and its scales as one object.
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts + [face]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = face
    bpy.ops.object.join()
    face.name = "Face"
    return [face, upper, lower, eyeball]


def export(obs):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_vertex_color="NONE")
    print(f"WROTE {OUT} {round(os.path.getsize(OUT) / 1024)} KB, " + ", ".join(f"{o.name} {len(o.data.vertices)}" for o in obs))


def shots(folder, obs):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    w, h = 800, 450
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.02, 0.02, 1)
    scene.world = world
    for name, rot, energy in (("key", (0.9, 0.0, 0.6), 3.0), ("rim", (2.2, 0.0, 2.8), 2.0)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        light.data.energy = energy
        light.rotation_euler = rot
        scene.collection.objects.link(light)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 60
    scene.collection.objects.link(cam)
    scene.camera = cam
    for i, loc in enumerate(((0.0, -14.0, 0.0), (6.0, -11.0, 2.5))):
        cam.location = loc
        cam.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).normalized().to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(folder, f"eye.{i}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDERED")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    obs = build()
    export(obs)
    if "--shots" in args:
        folder = os.path.abspath(args[args.index("--shots") + 1])
        os.makedirs(folder, exist_ok=True)
        shots(folder, obs)
