"""
The showpieces' creatures (src/showpiece/): a long eastern dragon with one continuous skin, built like the heroes of the
fourth style (blender/heroes/realkit.py): clean forms, one flat colour per part, smooth shading, no detail maps, gold
trim, one glow (the eyes). The user asked for the showpieces' creatures "more real, with continuous bodies, like the
champs" (2026-11-18), then to match how dragon heads really look.

The head follows the classic Chinese and Japanese dragon (references looked at 2026-11-18: the bronze dragons of the
Summer Palace, the stone dragon of Kowloon Walled City Park, Hokusai's ceiling dragon, Chen Rong's Nine Dragons scroll,
temple roof dragons): a short boxy snout ending in a big rounded nose pad with flared nostrils, an open mouth with fangs
and a curled tongue, bulging round eyes under heavy brows, cow-like ears, antler horns sweeping back, a flame mane, a
beard under the jaw, and long whiskers from the upper lip. Skull, snout, nose, brows, cheeks, jaw and body are made as
overlapping forms and fused into one skin (a voxel remesh), then smoothed, so it is one continuous body like a hero's.

    D:/blender/blender.exe --background --factory-startup --python blender/creatures/dragon.py -- water [jade] [--shots <folder>]

writes public/models/showpiece/<kind>.glb (and with --shots a check picture <folder>/<kind>.png).

The model lies straight along +X: the nose's tip at x = 0, the tail's tip near x = LENGTH; +Z up, +Y its left. Exported
y-up, so in three.js it runs along +X with +Y up. The page bends it along a path in code (src/showpiece/stage3d.ts): a
vertex's x says how far behind the head it sits along the path. So nothing here is rigged.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "blender", "heroes"))
import figkit  # noqa: E402

LENGTH = 10.0
OUT = os.path.join(ROOT, "public", "models", "showpiece")

# Each kind: its colours, its length and girth, how far the jaw hangs open, and which parts it has. The jade serpent is
# kept apart from the water dragon on purpose (the user's brief for it: no horns, no fangs, no mane): a closed mouth,
# swept-back jade crests instead of antlers and mane, twice as long and slimmer, a leaf at the tail's end.
KINDS = {
    "water": dict(body="#1d4f63", belly="#e2cf98", gold="#d9a845", fin="#e9f2f3", iris="#ffcf5a", mouth="#5c1418",
                  tongue="#b8323a", horns=True, whiskers=True, mane=True, teeth=True, beard=True, crests=False, leaf=False,
                  length=10.0, girth=1.0, jaw=-0.32),
    "jade": dict(body="#1d5a3a", belly="#e4e8c8", gold="#d8b04a", fin="#6fd69c", iris="#ffd25a", mouth="#2a0e0c",
                 tongue="#a8303a", horns=False, whiskers=True, mane=False, teeth=False, beard=False, crests=True, leaf=True,
                 length=20.0, girth=0.74, jaw=0.0),
}

# The jaw hinges here and hangs open by this much.
HINGE = Vector((0.9, 0.0, -0.1))
JAW_OPEN = -0.32


def smooth_curve(points):
    """A smooth function through (x, value) points (cosine easing between them)."""
    def f(x):
        if x <= points[0][0]:
            return points[0][1]
        for (x0, v0), (x1, v1) in zip(points, points[1:]):
            if x <= x1:
                k = (x - x0) / (x1 - x0)
                k = (1 - math.cos(math.pi * k)) / 2
                return v0 + (v1 - v0) * k
        return points[-1][1]
    return f


# The body's radius from the neck back: the neck, the full body, a long tail.
_RADIUS10 = smooth_curve([(0.8, 0.2), (1.2, 0.2), (1.7, 0.24), (2.4, 0.32), (4.0, 0.355), (5.8, 0.33), (7.4, 0.25), (8.8, 0.13),
                          (9.7, 0.04), (10.0, 0.008)])
GIRTH = 1.0


def RADIUS(x):
    """The body's radius: the 10 m dragon's profile stretched to this kind's length behind the neck, and its girth."""
    if x <= 1.7:
        return _RADIUS10(x) * (1.0 if x < 1.2 else GIRTH + (1 - GIRTH) * max(0.0, (1.7 - x) / 0.5))
    return _RADIUS10(1.7 + (x - 1.7) * (10.0 - 1.7) / (LENGTH - 1.7)) * GIRTH


def bell(v):
    return math.exp(-v * v)


def body_point(x, th):
    """A point on the body's skin (the neck to the tail), th round it (0 on top)."""
    side = abs(th if th <= math.pi else th - 2 * math.pi)
    r = RADIUS(x)
    out = 0.022 * bell(side / 0.16) * (1 if 1.3 < x < LENGTH - 0.7 else 0)       # a ridge along the back
    if math.cos(th) < -0.45 and 1.3 < x < LENGTH - 0.6:
        out += r * 0.04 * ((x / 0.17) % 1.0)                              # the belly's plates
    rr = r + out
    return Vector((x, rr * math.sin(th), rr * math.cos(th)))


def jaw_matrix(c, r, extra=None):
    """An ellipsoid's matrix for a form that hangs with the lower jaw."""
    hinge = Matrix.Translation(HINGE) @ Matrix.Rotation(JAW_OPEN, 4, "Y") @ Matrix.Translation(Vector(c) - HINGE)
    return hinge @ (extra or Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1.0))


def jaw_point(p):
    """Where a point given on the closed jaw is once the jaw hangs open."""
    return (Matrix.Translation(HINGE) @ Matrix.Rotation(JAW_OPEN, 4, "Y") @ Matrix.Translation(-HINGE)) @ Vector(p)


def blob(bm, c, r, rot=None, seg=(28, 18)):
    m = Matrix.Translation(Vector(c)) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1.0))
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0, matrix=m)


def skin(fig):
    """The head's forms and the body's tube, fused by a voxel remesh into one skin, smoothed, its faces sorted into
    scales, belly and mouth."""
    bm = bmesh.new()
    # The body, from inside the skull to the tail's tip.
    seg = 36
    xs = [0.85 + i * 0.04 for i in range(int((LENGTH - 0.85) / 0.04))] + [LENGTH - 0.01]
    rows = [[bm.verts.new(body_point(x, 2 * math.pi * k / seg)) for k in range(seg)] for x in xs]
    for r0, r1 in zip(rows, rows[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r1[k], r1[(k + 1) % seg], r0[(k + 1) % seg]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    # Lean and angular, after fantasy dragons (a wedge of a skull, the eye sunk under a hard brow, cheekbones as ridges,
    # jaw muscle behind the eye), with the eastern dragon's nose pad, open mouth and beard.
    # The skull: narrow, a wedge.
    blob(bm, (0.86, 0, 0.1), (0.3, 0.17, 0.19))
    blob(bm, (0.98, 0, 0.02), (0.22, 0.16, 0.2))
    # Jaw muscle behind the eye, and the cheekbone's ridge running forward under it.
    for s in (-1, 1):
        blob(bm, (0.95, 0.15 * s, -0.03), (0.16, 0.075, 0.12))
        blob(bm, (0.74, 0.165 * s, 0.035), (0.24, 0.04, 0.035), rot=Matrix.Rotation(-0.12 * s, 4, "Z") @ Matrix.Rotation(0.1, 4, "Y"))
    # The upper snout, tapering to the nose; the lip's edge flaring a little at the sides.
    blob(bm, (0.48, 0, 0.05), (0.38, 0.125, 0.105))
    blob(bm, (0.2, 0, 0.03), (0.22, 0.1, 0.08))
    blob(bm, (0.36, 0, -0.055), (0.36, 0.14, 0.04))
    # The nose: a rounded pad at the tip, nostrils flared on top.
    blob(bm, (0.05, 0, 0.06), (0.08, 0.115, 0.08))
    for s in (-1, 1):
        blob(bm, (0.04, 0.06 * s, 0.11), (0.045, 0.04, 0.035))
    # A ridge up the nose to the brow, and a crest between the brows.
    blob(bm, (0.45, 0, 0.14), (0.32, 0.045, 0.04), rot=Matrix.Rotation(-0.16, 4, "Y"))
    blob(bm, (0.8, 0, 0.28), (0.2, 0.04, 0.05), rot=Matrix.Rotation(-0.35, 4, "Y"))
    # Brows: hard shelves overhanging the eyes, swept up and out at the back.
    for s in (-1, 1):
        rot = Matrix.Rotation(0.28 * s, 4, "Z") @ Matrix.Rotation(-0.4, 4, "Y") @ Matrix.Rotation(0.5 * s, 4, "X")
        blob(bm, (0.7, 0.13 * s, 0.205), (0.22, 0.085, 0.032), rot=rot)
    # The lower jaw, lean, hanging open, with a chin at its front and the muscle at its back.
    # A closed mouth (the serpent) has the jaw pressed up against the lip.
    lift = 0.065 if JAW_OPEN == 0 else 0.0
    for c, r in (((0.5, 0, -0.19 + lift), (0.38, 0.11, 0.05)), ((0.16, 0, -0.18 + lift), (0.07, 0.095, 0.055)), ((0.8, 0, -0.16 + lift * 0.6), (0.16, 0.14, 0.08))):
        bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=1.0, matrix=jaw_matrix(c, r))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("skin")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Skin", me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    # Fuse every form into one surface, round off the seams, and keep the count sensible.
    rem = ob.modifiers.new("fuse", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = 0.011
    bpy.ops.object.modifier_apply(modifier="fuse")
    sm = ob.modifiers.new("round", "CORRECTIVE_SMOOTH")
    sm.factor = 0.7
    sm.iterations = 4
    sm.use_only_smooth = True
    bpy.ops.object.modifier_apply(modifier="round")
    sm2 = ob.modifiers.new("soft", "SMOOTH")
    sm2.factor = 0.5
    sm2.iterations = 1
    bpy.ops.object.modifier_apply(modifier="soft")
    dec = ob.modifiers.new("fewer", "DECIMATE")
    dec.ratio = 0.3
    bpy.ops.object.modifier_apply(modifier="fewer")
    for key in ("scales", "belly", "mouth"):
        ob.data.materials.append(fig.mats[key])
    jaw_top = lambda x: jaw_point((x, 0, -0.14)).z    # noqa: E731  the jaw's upper surface, opened
    for p in ob.data.polygons:
        c, n = p.center, p.normal
        p.use_smooth = True
        if c.x < 0.95 and abs(c.y) < 0.16:
            # The palate (under the upper jaw, facing down) and the mouth's floor (on the jaw, facing up).
            if -0.2 < c.z < -0.065 and n.z < -0.25 and c.z > jaw_top(c.x) + 0.02:
                p.material_index = 2
                continue
            if c.z < -0.1 and n.z > 0.3 and c.z < jaw_top(c.x) + 0.05 and c.x > 0.12:
                p.material_index = 2
                continue
        if c.x > 1.05 and n.z < -0.55 and c.x < LENGTH - 0.3:
            p.material_index = 1
    return ob


def top(x):
    """The height of the back at x."""
    return body_point(x, 0.0).z


def parts(fig, k):
    # The eyes: almond-shaped and narrow, sunk under the brows, all glowing iris with a slit pupil (no white: a predator's).
    for s in (-1, 1):
        look = Vector((-0.3, 0.94 * s, 0.05)).normalized()
        rot = look.to_track_quat("X", "Z").to_matrix().to_4x4() @ Matrix.Rotation(0.25 * s, 4, "X")
        c = Vector((0.67, 0.15 * s, 0.135))
        fig.ellipsoid("iris", tuple(c), (0.035, 0.07, 0.03), seg=(24, 14), rot=rot)
        fig.ellipsoid("pupil", tuple(c + look * 0.03), (0.006, 0.008, 0.028), seg=(12, 10), rot=rot)
    # Ears, behind the eyes, swept back.
    for s in (-1, 1):
        rot = Matrix.Rotation(-0.5 * s, 4, "Z") @ Matrix.Rotation(0.6 * s, 4, "X") @ Matrix.Rotation(-0.4, 4, "Y")
        fig.ellipsoid("scales", (1.04, 0.17 * s, 0.24), (0.14, 0.02, 0.05), seg=(18, 10), rot=rot)
    # Teeth: a row along each side of the upper lip, fangs at the front; fangs and teeth on the jaw.
    for s in ((-1, 1) if k["teeth"] else ()):
        for i in range(7):
            x = 0.16 + i * 0.075
            L = 0.1 if i == 0 else 0.045
            fig.tube("fang", [(x, (0.115 - 0.006 * i) * s, -0.07), (x + 0.012, (0.11 - 0.006 * i) * s, -0.07 - L)], [0.018 if i == 0 else 0.011, 0.002], seg=8)
        for i in range(6):
            x = 0.18 + i * 0.08
            L = 0.09 if i == 0 else 0.04
            a = jaw_point((x, 0.09 * s, -0.15))
            b = jaw_point((x - 0.01, 0.085 * s, -0.15 + L))
            fig.tube("fang", [a, b], [0.018 if i == 0 else 0.012, 0.002], seg=8)
    # The tongue, curling up out of the mouth.
    pts = [jaw_point((0.78, 0, -0.16)), jaw_point((0.5, 0, -0.15)), jaw_point((0.25, 0, -0.13)), jaw_point((0.1, 0, -0.06)),
           jaw_point((0.06, 0, 0.02))]
    if k["teeth"]:
        fig.tube("tongue", pts, [0.05, 0.046, 0.038, 0.026, 0.01], seg=12, squash=((0, 0, 1), 0.45))
    # The beard: locks hanging from under the jaw, swept back.
    for i in range(9 if k["beard"] else 0):
        u = i / 8
        base = jaw_point((0.22 + 0.4 * u, (u - 0.5) * 0.16, -0.25))
        L = 0.42 - 0.15 * abs(u - 0.4)
        pts = [base, base + Vector((0.12, 0, -L * 0.45)), base + Vector((0.3, (u - 0.5) * 0.1, -L * 0.8)), base + Vector((0.52, (u - 0.5) * 0.15, -L))]
        fig.tube("fin", pts, [0.03, 0.026, 0.016, 0.002], seg=8)
    # Flames off the brows.
    for s in (-1, 1):
        for j in range(4):
            base = Vector((0.74 + 0.06 * j, 0.15 * s, 0.24))
            pts = [base, base + Vector((0.12, 0.06 * s, 0.1 + 0.02 * j)), base + Vector((0.26, 0.1 * s, 0.14 + 0.03 * j))]
            fig.tube("fin", pts, [0.03, 0.02, 0.002], seg=8)
    if k["crests"]:
        # Crests: long jade blades swept back off the brow and the back of the skull, flat like fins, lying close.
        for s in (-1, 1):
            for j, (x0, y0, z0, L, up, out) in enumerate(((0.72, 0.13, 0.22, 0.75, 0.1, 0.12), (0.86, 0.13, 0.25, 0.95, 0.14, 0.16),
                                                          (1.0, 0.12, 0.22, 1.1, 0.12, 0.2), (1.02, 0.17, 0.05, 0.8, -0.02, 0.24))):
                base = Vector((x0, y0 * s, z0))
                pts = [base, base + Vector((L * 0.35, out * 0.5 * s, up * 0.6)), base + Vector((L * 0.7, out * 0.85 * s, up)),
                       base + Vector((L, out * s, up * 1.1))]
                fig.tube("fin", pts, [0.045, 0.036, 0.02, 0.002], seg=10, squash=((0, 0, 1), 0.3))
    if k["horns"]:
        # Antlers: from the crown, back and up, a tine forward and one up.
        for s in (-1, 1):
            pts = [(0.92, 0.1 * s, 0.26), (1.12, 0.16 * s, 0.42), (1.42, 0.22 * s, 0.55), (1.8, 0.24 * s, 0.6), (2.1, 0.22 * s, 0.56)]
            fig.tube("gold", pts, [0.05, 0.042, 0.03, 0.016, 0.003], seg=12)
            fig.tube("gold", [(1.18, 0.17 * s, 0.45), (1.16, 0.25 * s, 0.62), (1.24, 0.28 * s, 0.74)], [0.025, 0.014, 0.002], seg=10)
            fig.tube("gold", [(1.52, 0.23 * s, 0.57), (1.56, 0.32 * s, 0.73), (1.66, 0.34 * s, 0.82)], [0.022, 0.012, 0.002], seg=10)
    if k["whiskers"]:
        # Long whiskers from the upper lip, by the nose, sweeping back in an S.
        for s in (-1, 1):
            pts = [(0.14, 0.15 * s, -0.02), (0.1, 0.32 * s, 0.02), (0.35, 0.55 * s, -0.08), (0.85, 0.72 * s, -0.2),
                   (1.4, 0.82 * s, -0.08), (1.95, 0.78 * s, 0.12), (2.3, 0.7 * s, 0.2)]
            fig.tube("gold", pts, [0.02, 0.018, 0.015, 0.012, 0.009, 0.005, 0.001], seg=8)
    if k["mane"]:
        # The mane: flame-like locks off the back of the skull, the cheeks and the neck, sweeping back and up.
        for i in range(26):
            u = i / 25
            x0 = 0.92 + 1.4 * u
            a = (-1 if i % 2 else 1) * (0.2 + 0.9 * (((i * 7) % 5) / 4)) * (1.0 - 0.45 * u)
            r = (RADIUS(max(x0, 0.95)) if x0 > 1.05 else 0.22) * 0.95
            base = Vector((x0, r * math.sin(a), r * math.cos(a) + (0.06 if x0 < 1.1 else 0.0)))
            outv = Vector((0, math.sin(a) * 0.85, 0.5 + 0.5 * math.cos(a)))
            L = (0.85 - 0.4 * u) * (0.8 + 0.4 * (((i * 3) % 4) / 3))
            pts = [base, base + Vector((L * 0.3, 0, 0)) + outv * 0.12, base + Vector((L * 0.65, 0, 0)) + outv * 0.22,
                   base + Vector((L, 0, 0)) + outv * 0.36]
            fig.tube("fin", pts, [0.05, 0.04, 0.024, 0.002], seg=10)
    # The back's crest: flame-shaped fins, smaller towards the tail.
    x = 1.7
    while x < LENGTH - 0.65:
        h = (0.2 * (RADIUS(x) / 0.355) ** 0.8 + 0.04) * (0.6 if k["crests"] else 1.0)
        w = 0.14 * (RADIUS(x) / 0.355) + 0.04
        z0 = top(x) - 0.03
        bm = fig.bm("fin")
        th = 0.01 + 0.02 * RADIUS(x)
        # A flame: up from the front, curling back at the tip.
        prof = [(x - w, z0), (x + w * 0.9, z0), (x + w * 0.65, z0 + h * 0.45), (x + w * 1.1, z0 + h), (x + w * 0.05, z0 + h * 0.55)]
        front = [bm.verts.new((px, th, pz)) for px, pz in prof]
        back = [bm.verts.new((px, -th, pz)) for px, pz in prof]
        bm.faces.new(front)
        bm.faces.new(list(reversed(back)))
        n = len(prof)
        for a in range(n):
            b = (a + 1) % n
            bm.faces.new((front[b], front[a], back[a], back[b]))
        x += 0.3
    E = LENGTH - 10.0
    if k["leaf"]:
        # A jade leaf at the tail's end, flat and upright, with a gold midrib.
        bm = fig.bm("fin")
        n = 18
        top_, bot = [], []
        for i in range(n + 1):
            u = i / n
            x = LENGTH - 0.75 + 1.25 * u
            hh = 0.26 * math.sin(math.pi * u) ** 0.8 * (1 - 0.3 * u)
            top_.append(bm.verts.new((x, 0.012, 0.05 + hh)))
            bot.append(bm.verts.new((x, 0.012, 0.05 - hh * 0.55)))
        for i in range(n):
            bm.faces.new((top_[i], bot[i], bot[i + 1], top_[i + 1]))
        bk = [[bm.verts.new((v.co.x, -0.012, v.co.z)) for v in row] for row in (top_, bot)]
        for i in range(n):
            bm.faces.new((bk[0][i + 1], bk[1][i + 1], bk[1][i], bk[0][i]))
        fig.tube("gold", [(LENGTH - 0.8, 0, 0.05), (LENGTH + 0.45, 0, 0.06)], [0.016, 0.002], seg=8)
    else:
        # The tail's fan: three long flames.
        for dy, dz in ((0.0, 0.0), (0.22, 0.12), (-0.22, 0.12)):
            fig.tube("fin", [(9.45 + E, dy * 0.2, dz * 0.2), (9.8 + E, dy * 0.7, dz * 0.7 + 0.04), (10.3 + E, dy, dz + 0.1)], [0.05, 0.035, 0.002], seg=10,
                     squash=((0, 1, 0) if dy == 0 else (0, 0, 1), 0.35))


def build(kind):
    global LENGTH, GIRTH, JAW_OPEN
    k = KINDS[kind]
    LENGTH, GIRTH, JAW_OPEN = k["length"], k["girth"], k["jaw"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fig = figkit.Fig(kind)
    fig.mat("scales", k["body"], rough=0.42)
    fig.mat("belly", k["belly"], rough=0.6)
    fig.mat("mouth", k["mouth"], rough=0.6)
    fig.mat("tongue", k["tongue"], rough=0.45)
    fig.mat("gold", k["gold"], rough=0.3, metal=0.85)
    fig.mat("fin", k["fin"], rough=0.55)
    fig.mat("fang", "#f3eee2", rough=0.35)
    fig.mat("eyewhite", "#f2ead2", rough=0.18)
    fig.mat("iris", "#3a2400", rough=0.15, emit=k["iris"], strength=4.0)
    fig.mat("pupil", "#050302", rough=0.1)
    body = skin(fig)
    parts(fig, k)
    obs = fig.finish()
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs + [body]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = f"dragon_{kind}"
    return body


def export(kind, ob):
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"{kind}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=False,
                              export_meshopt_compression_enable=False, export_vertex_color="NONE")
    print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB, {len(ob.data.vertices)} vertices, {len(ob.data.polygons)} faces")


def coil(ob):
    """For the check picture only: bend the straight model into a gentle S in the ground plane (the page bends it in code)."""
    A, F = 1.4, 0.5
    for v in ob.data.vertices:
        x, y, z = v.co
        bx = max(0.0, x - 1.4)
        cy = A * math.sin(bx * F)
        ty = A * F * math.cos(bx * F)
        L = math.hypot(1.0, ty)
        nx, ny = -ty / L, 1.0 / L
        v.co = Vector((x + nx * y, cy + ny * y, z))


def sheet(kind, ob, folder):
    """The whole dragon, the head in three-quarter, in profile and from the front, and a v4 hero beside it for the style."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    w, hh = 640, 480
    scene.render.resolution_x, scene.render.resolution_y = w, hh
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.06, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world
    for name, rot, energy in (("key", (0.9, 0.0, 0.6), 3.0), ("fill", (1.1, 0.0, -2.2), 1.2), ("rim", (2.2, 0.0, 2.8), 2.0)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        light.data.energy = energy
        light.rotation_euler = rot
        scene.collection.objects.link(light)
    coil(ob)
    hero = os.path.join(ROOT, "public", "models", "heroes", "astral_v4.glb")
    if os.path.exists(hero):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=hero)
        for o in set(bpy.data.objects) - before:
            if o.parent is None:
                o.location = (1.2, -2.2, -0.9)
                o.rotation_euler = (0, 0, 0.6)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    views = [((-3.0, -9.5, 5.5), (3.6, 0.4, -0.2)),       # the whole dragon and the hero
             ((-1.5, -1.9, 0.75), (0.55, 0.0, 0.02)),     # the head, three-quarter
             ((0.55, -2.4, 0.1), (0.55, 0.0, 0.0)),       # the head in profile
             ((-2.1, 0.0, 0.25), (0.5, 0.0, 0.0))]        # the face
    import numpy as np
    tiles = []
    for i, (loc, at) in enumerate(views):
        cam.location = loc
        d = (Vector(at) - Vector(loc)).normalized()
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(folder, f"{kind}.{i}.png")
        bpy.ops.render.render(write_still=True)
        tiles.append(bpy.data.images.load(scene.render.filepath))
    sheet_px = np.zeros((hh, w * len(tiles), 4), dtype=np.float32)
    for i, img in enumerate(tiles):
        px = np.empty(w * hh * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        sheet_px[:, i * w:(i + 1) * w, :] = px.reshape(hh, w, 4)
    out = bpy.data.images.new("sheet", w * len(tiles), hh)
    out.pixels.foreach_set(sheet_px.reshape(-1))
    out.filepath_raw = os.path.join(folder, f"{kind}.png")
    out.file_format = "PNG"
    out.save()
    for i in range(len(tiles)):
        os.remove(os.path.join(folder, f"{kind}.{i}.png"))
    print(f"RENDERED {out.filepath_raw}")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["water"]
    shots = None
    if "--shots" in args:
        i = args.index("--shots")
        shots = os.path.abspath(args[i + 1])
        os.makedirs(shots, exist_ok=True)
        args = args[:i] + args[i + 2:]
    for kind in args:
        ob = build(kind)
        export(kind, ob)
        if shots:
            sheet(kind, ob, shots)
