"""
Sirix's wings (user, 2026-11-10: "sirix wings are not correct"), after his portrait: two pairs of pale translucent insect
wings rising up and out behind the shoulders, the fore wing long and high, the hind wing shorter and lower, each with
an amber leading edge and a few dark veins. The old wing cloak (one flat oval a side hanging down the back, its lower
half inside the robe) read as a pair of shields. Plain bpy and bmesh: `HeroFigure.wing_cloak` (hero_figures.py) builds
it in the figure, and `patch_sirix_wings.py` swaps it into the exported model.

Blender's frame: X the figure's left, -Y its front (+Y its back), Z up. `build(mats)` returns (object, material key)
pairs: "wing" (the membranes), "rim" (the leading edges), "vein".
"""
import math

import bmesh
import bpy
from mathutils import Vector

BACK_Y = 0.205  # just behind the back plate
# (root height, direction out-back-up for the left side, length, widest width)
WINGS = [
    (1.37, Vector((0.62, 0.42, 0.66)), 0.8, 0.27),   # fore wing: up and out, its tip about head high
    (1.29, Vector((0.86, 0.42, 0.06)), 0.6, 0.22),   # hind wing: out, a little back
]
ROOT_X = 0.06
STEPS = 14


def _frame(u):
    u = u.normalized()
    w = Vector((0, 1, 0)).cross(u).normalized()  # across the wing, its broad face toward the back
    n = u.cross(w).normalized()
    return u, w, n


def _width(t):
    """How wide the wing is at `t` (0 root .. 1 tip), as a share of its widest."""
    return math.sin(math.pi * min(1.0, t ** 0.75)) ** 0.8


def _outline(length, width):
    """(along, across) points: the leading edge out to the tip, then the trailing edge back to the root."""
    lead = [(length * t, 0.28 * width * _width(t)) for t in (i / STEPS for i in range(STEPS + 1))]
    trail = [(length * t, -0.72 * width * _width(t) ** 0.9) for t in (i / STEPS for i in range(STEPS - 1, 0, -1))]
    return lead + trail


def _obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _tube(bm, pts, radius, seg=6):
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a).normalized()
        r = radius(i / (len(pts) - 1)) if callable(radius) else radius
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def build(mats):
    """`mats`: {"wing", "rim", "vein"} → materials. Returns [(object, key)]."""
    wing_bm, rim_bm, vein_bm = bmesh.new(), bmesh.new(), bmesh.new()
    for sx in (1, -1):
        for z, d, length, width in WINGS:
            root = Vector((ROOT_X * sx, BACK_Y, z))
            u, w, n = _frame(Vector((d.x * sx, d.y, d.z)))
            at = lambda a, c: root + u * a + w * (c * sx)  # noqa: E731  (the leading edge on top on both sides)
            # the membrane: a thin plate, a little thicker at the root
            pts = _outline(length, width)
            top, bot = [], []
            for a, c in pts:
                th = 0.002 + 0.004 * (1 - a / length)
                top.append(wing_bm.verts.new(at(a, c) + n * th))
                bot.append(wing_bm.verts.new(at(a, c) - n * th))
            wing_bm.faces.new(top)
            wing_bm.faces.new(list(reversed(bot)))
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                wing_bm.faces.new((top[j], top[i], bot[i], bot[j]))
            # the amber leading edge, from the root out round the tip
            edge = [at(length * t, 0.28 * width * _width(t)) for t in (i / STEPS for i in range(STEPS + 1))]
            _tube(rim_bm, edge, lambda t: 0.009 * (1 - 0.6 * t) + 0.003)
            # three veins fanning from the root
            for k in (0.0, -0.3, -0.55):
                vein = [at(length * t, k * width * _width(t)) for t in (0.04 + 0.86 * i / 10 for i in range(11))]
                _tube(vein_bm, vein, lambda t: 0.0045 * (1 - 0.5 * t), seg=5)
    return [(_obj("Wing", wing_bm, mats["wing"]), "wing"), (_obj("WingRim", rim_bm, mats["rim"]), "rim"), (_obj("Wingvein", vein_bm, mats["vein"]), "vein")]
