"""
Frostfall Lake's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): the Hourkeepers'
great orrery, standing on the frozen shore below their observatory. A stone plinth carries an iron pole; on the pole a small pale
sun-globe, three planets on brass arms at three heights, and three nested rings (dark iron with a gold band, brass with iron studs,
iron with a frost-blue band) turning slowly at different speeds, posed in code (src/arenas/landmarks/orrery.ts).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned forms, smooth shading, the heroes' palette plus
Frostfall's own colour (a cold ice blue), a thin gold line on the edges, one small light (the sun). With the bosses' toolkit:
orrery > plinth, sun, arm1, arm2, arm3, ringA > ringB > ringC. Every ring turns about the pole (the z axis) and is held on it by two
short struts and a sleeve, so it never floats. Faces -Y, z up, metres; z = 0 is the snow.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- orrery
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import seg

HEIGHT = 9.6
HERO_X = -5.0
VIEW = 0.6

C = Vector((0, 0, 5.3))


def build_orrery():
    B = Boss("orrery", 9.6)
    B.smooth = True
    stone = B.m("stone", "#2c3140", 0.0, 0.85)
    iron = B.m("iron", "#3c3f47", 0.75, 0.42)
    brass = B.m("brass", "#a8803a", 0.8, 0.55)
    gold = B.m("gold", "#c9a24a", 0.8, 0.5)
    cream = B.m("cream", "#d8cfb4", 0.0, 0.8)
    frost = B.m("frost", "#5f8fb8", 0.0, 0.6)
    sunm = B.m("sunglobe", "#efe6c6", 0.0, 0.5, emit="#ffe7a8", strength=1.3)

    def box(part, xf, size, m):
        """A plain box (12 triangles): for the many small marks."""
        hx, hy, hz = (v / 2 for v in size)
        part.hull([(sx * hx, sy * hy, sz * hz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)], m, xf)

    def band(part, z, r, m, w=0.04, out=0.025, sides=8, rot0=math.pi / 8):
        """A thin gold line round a step's edge."""
        part.lathe([(z, r - 0.06), (z, r + out), (z + w, r + out), (z + w, r - 0.06)], m, sides=sides, rot0=rot0, loop=True)

    # --- the plinth: three octagonal steps, a gold line on each edge, a ring of hour marks, steps to the front, the pole ---------------
    pl = B.part("plinth", (0, 0, 0))
    o8 = math.pi / 8
    steps = [(0.0, 0.5, 3.9), (0.5, 0.9, 3.3), (0.9, 1.2, 2.7)]
    for z0, z1, r in steps:
        pl.lathe([(z0, 0.02), (z0, r), (z1, r), (z1, 0.02)], stone, sides=8, rot0=o8)
        band(pl, z1 - 0.04, r, gold)
    # hour marks on the top step: twenty-four, the four cardinal ones longer
    for k in range(24):
        a = k * math.tau / 24
        ln = 0.5 if k % 6 == 0 else 0.26
        box(pl, T(2.2 * math.cos(a), 2.2 * math.sin(a), 1.22) @ R(0, 0, a), (0.07, ln, 0.07), cream)
    # a short flight of steps in front (toward -Y)
    pl.chunk((2.6, 0.9, 0.3), stone, at=(0, -4.15, 0.15), bevel=0.04)
    pl.chunk((2.0, 0.7, 0.3), stone, at=(0, -3.8, 0.45), bevel=0.04)
    # four low posts at the corners of the lowest step, each with a gold cap
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        px, py = 3.35 * math.cos(a), 3.35 * math.sin(a)
        pl.lathe([(0.5, 0.26), (1.7, 0.2), (1.8, 0.28), (1.9, 0.0)], stone, sides=8, xf=T(px, py, 0.0), rot0=o8)
        pl.lathe([(1.76, 0.23), (1.76, 0.3), (1.84, 0.3), (1.84, 0.23)], gold, sides=8, xf=T(px, py, 0.0), rot0=o8, loop=True)
    # the pole: a tapered iron column with brass collars, up past the rings to a gold finial
    top = C.z + 3.95
    pl.lathe([(1.2, 0.5), (1.45, 0.34), (2.3, 0.14), (top - 0.2, 0.075), (top, 0.075)], iron, sides=14)
    for z in (1.5, 2.2):
        pl.lathe([(z, 0.2), (z, 0.3), (z + 0.1, 0.3), (z + 0.1, 0.2)], brass, sides=14, loop=True)
    pl.lathe([(top, 0.12), (top + 0.12, 0.12), (top + 0.38, 0.0)], gold, sides=10)
    pl.finish()

    # --- the sun: a small pale globe on the pole, with a thin gold belt round its middle ---------------------------------------------
    sun = B.part("sun", C)
    sun.rock(C, (0.46, 0.46, 0.46), sunm, n=30, rough=0.0)
    sun.lathe([(-0.025, 0.48), (-0.025, 0.54), (0.025, 0.54), (0.025, 0.48)], gold, sides=28, xf=T(*C), loop=True)
    sun.finish()

    # --- the rings -----------------------------------------------------------------------------------------------------------------
    def ring(name, parent, radius, tilt, h, t, body, trim, studs, stud_m, edges=True):
        """A ring about C whose plane is `tilt`'d (normal = tilt's z), held on the pole by a sleeve and a strut at its top and bottom."""
        part = B.part(name, C, parent)
        xf = T(*C) @ tilt
        part.lathe([(-h, radius - t), (-h, radius + t), (h, radius + t), (h, radius - t)], body, sides=44, xf=xf, loop=True)
        # the trim: a band proud of the outer face, and thin lines on both edges
        part.lathe([(-h * 0.35, radius + t), (-h * 0.35, radius + t + 0.03), (h * 0.35, radius + t + 0.03), (h * 0.35, radius + t)],
                   trim, sides=44, xf=xf, loop=True)
        for sgn in ((-1, 1) if edges else ()):
            part.lathe([(sgn * h, radius - t * 0.6), (sgn * h, radius + t * 0.6), (sgn * h + 0.025, radius + t * 0.6), (sgn * h + 0.025, radius - t * 0.6)],
                       gold, sides=44, xf=xf, loop=True)
        for k in range(studs):
            a = (k + 0.5) * math.tau / studs
            box(part, xf @ R(0, 0, a) @ T(radius + t, 0, 0), (0.07, 0.16, h * 2 + 0.1), stud_m)
        # its top and bottom points, and a strut from the pole to each
        n = (tilt.to_3x3() @ Vector((0, 0, 1))).normalized()
        u = Vector((0, 0, 1)) - n * n.z
        u.normalize()
        for sg in (1, -1):
            p = C + u * radius * sg
            axis = Vector((0, 0, p.z))
            if (p - axis).length > 0.05:
                seg(part, axis, p, 0.07, 0.06, brass, sides=8)
            part.lathe([(-0.14, 0.17), (-0.14, 0.22), (0.14, 0.22), (0.14, 0.17)], brass, sides=12, xf=T(*axis), loop=True)
        part.finish()

    ring("ringA", None, 3.5, R(math.pi / 2, 0, 0), 0.2, 0.09, iron, gold, 24, brass)
    ring("ringB", "ringA", 2.9, R(math.radians(58), 0, 0), 0.17, 0.08, brass, iron, 20, iron)
    ring("ringC", "ringB", 2.3, R(math.radians(-30), math.radians(24), 0), 0.14, 0.07, iron, frost, 16, brass, edges=False)

    # --- the planets: three brass arms off the pole, at three heights, each with a planet at its end --------------------------------------
    specs = [("arm1", 0.85, -0.9, 0.28, 0.0, frost), ("arm2", 1.25, 1.0, 0.34, 2.2, cream), ("arm3", 1.5, -1.7, 0.28, 4.1, gold)]
    for name, r, dz, pr, ang, pm in specs:
        pv = Vector((0, 0, C.z + dz))
        arm = B.part(name, pv)
        end = pv + Vector((r * math.cos(ang), r * math.sin(ang), 0))
        arm.lathe([(-0.12, 0.13), (-0.12, 0.18), (0.12, 0.18), (0.12, 0.13)], brass, sides=12, xf=T(*pv), loop=True)
        seg(arm, pv, end, 0.05, 0.04, brass, sides=8)
        arm.rock(end, (pr, pr, pr), pm, n=28, rough=0.0)
        if name == "arm2":
            # a ring about the planet
            arm.lathe([(-0.012, pr * 1.45), (-0.012, pr * 1.95), (0.012, pr * 1.95), (0.012, pr * 1.45)], gold, sides=24, xf=T(*end) @ R(0.45, 0.3, 0), loop=True)
        if name == "arm3":
            arm.rock(end + Vector((0.34, 0.1, 0.18)), (0.07, 0.07, 0.07), cream, n=16, rough=0.0)   # its moon
        arm.finish()
    return B


def register():
    bb.BUILD["orrery"] = build_orrery
