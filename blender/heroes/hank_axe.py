"""
Hank's axe (user, 2026-11-10, with a drawing): one bit, not two, on a one-handed haft held at its butt end, pointing
forward and out at his right side, the head at the far end with its poll on top and the blade flaring down to a curved
edge. Plain bpy and bmesh, no other helpers: `TimberMythic.body` (restyle_batch1.py) builds it in the figure, and
`patch_hank_axe.py` swaps it into the exported model.

Blender's frame: X the figure's left, -Y its front, Z up. `build(grip, mats)` makes the parts around `grip` (the centre
of the right fist) and returns them as (object, material key) pairs: steel, edge (the glowing bead and the rune),
haft, band.
"""
import math

import bmesh
import bpy
from mathutils import Vector

# Along the haft from the fist: forward, out to his right, a little up (the head slightly higher than the hand).
DIR = Vector((-0.42, -0.9, 0.06)).normalized()
BUTT, END = 0.1, 1.0  # the haft from this far behind the fist to this far in front of it (m)
HEAD_AT = 0.9  # the eye's centre along the haft
# The head's outline in (along the haft from the eye, up): the poll on top, the toe at the far end, the edge along the
# bottom, the beard reaching back toward the hand, the back curving in to the eye.
OUTLINE = [
    (-0.065, 0.085), (0.065, 0.085), (0.072, 0.0), (0.092, -0.12), (0.14, -0.235), (0.172, -0.305),
    (0.125, -0.342), (0.045, -0.362), (-0.045, -0.358), (-0.125, -0.334), (-0.19, -0.292),
    (-0.15, -0.212), (-0.105, -0.13), (-0.078, -0.05), (-0.066, 0.0),
]
EDGE = [(0.165, -0.296), (0.12, -0.33), (0.045, -0.349), (-0.045, -0.346), (-0.122, -0.322), (-0.18, -0.283)]


def _frame():
    up = Vector((0, 0, 1))
    w = (up - DIR * up.dot(DIR)).normalized()
    s = w.cross(DIR).normalized()
    return DIR, w, s


def _obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _tube(bm, pts, radii, seg=10, caps=True):
    """A round tube through `pts` (Vectors), its radius per point."""
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a).normalized()
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * radii[i]) for k in range(seg)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])


def _plate(bm, centre, outline, thick):
    """A flat plate from `outline` (u along the haft, w up), `thick(w)` thick: thinner toward the edge."""
    d, w, s = _frame()
    top, bot = [], []
    for u, v in outline:
        p = centre + d * u + w * v
        t = thick(v) / 2
        top.append(bm.verts.new(p + s * t))
        bot.append(bm.verts.new(p - s * t))
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((top[j], top[i], bot[i], bot[j]))


def build(grip, mats):
    """The axe round `grip` (Vector). `mats`: {"steel", "edge", "haft", "band"} → materials. Returns [(object, key)]."""
    d, w, s = _frame()
    grip = Vector(grip)
    head = grip + d * HEAD_AT
    out = []

    # the haft, a little thicker under the head, and a steel knob at its butt
    bm = bmesh.new()
    _tube(bm, [grip + d * t for t in (-BUTT, 0.3, 0.75, END)], [0.03, 0.033, 0.036, 0.032], seg=12)
    out.append((_obj("AxeHaft", bm, mats["haft"]), "haft"))
    bm = bmesh.new()
    knob = grip - d * (BUTT + 0.012)
    _tube(bm, [knob - d * 0.03, knob, knob + d * 0.03], [0.026, 0.044, 0.03], seg=12)
    # the head: one bit, thick at the eye and thin at the edge, and a cap over the haft's end
    _plate(bm, head, OUTLINE, lambda v: 0.012 + 0.05 * max(0.0, min(1.0, (v + 0.36) / 0.44)))
    _tube(bm, [head + d * (END - HEAD_AT - 0.03), head + d * (END - HEAD_AT + 0.012)], [0.04, 0.03], seg=12)
    out.append((_obj("AxeHead", bm, mats["steel"]), "steel"))

    # gold bands: one above the fist, one below it, one under the head
    bm = bmesh.new()
    for t in (-0.075, 0.1, HEAD_AT - 0.1):
        _tube(bm, [grip + d * (t - 0.012), grip + d * (t + 0.012)], [0.041, 0.041], seg=12)
    out.append((_obj("AxeBands", bm, mats["band"]), "band"))

    # the glowing edge, a bead along the blade's curve on both faces, and a rune on each face of the blade
    bm = bmesh.new()
    _tube(bm, [head + d * u + w * v for u, v in EDGE], [0.006, 0.013, 0.015, 0.015, 0.013, 0.006], seg=8)
    rune = [((-0.02, -0.08), (-0.02, -0.24)), ((-0.02, -0.16), (0.05, -0.1)), ((-0.02, -0.16), (0.05, -0.22))]
    for side in (1, -1):
        for a, b in rune:
            pa = head + d * a[0] + w * a[1]
            pb = head + d * b[0] + w * b[1]
            off = s * side * (0.012 + 0.05 * max(0.0, min(1.0, (0.5 * (a[1] + b[1]) + 0.36) / 0.44)) / 2)
            _tube(bm, [pa + off, pb + off], [0.009, 0.009], seg=6)
    out.append((_obj("AxeGlow", bm, mats["edge"]), "edge"))
    return out
