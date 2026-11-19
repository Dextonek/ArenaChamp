"""
Hank's trees as models (2026-11-19; the user: "lets make more models for the heroes spells too"). Until now his Timber trees were
stacks of green cones drawn in code (`buildTree` in src/heroes/timber/parts.ts), like toys beside the heroes of the fourth style. Now a
pine of the Walking Wood in three stages, the same heights and crown widths as before (so the fight reads the same: the trunk is the
obstacle, the crown its reach), and a stump:

    pine_sapling  1.5 m, crown 0.58 m      pine_young  4.2 m, crown 1.3 m      pine_full  7.3 m, crown 1.75 m      stump

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean forms, smooth shading, flat colours (bark brown, a deep pine green
going lighter toward the top, a little moss at the foot), no glow. Each a still model (one part), feet at z = 0, faces -Y.

    blender --background --factory-startup --python blender/heroes/props/run.py -- pine_full
"""
import math
import random

from mathutils import Euler, Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, cone, seg

HEIGHT = 7.3
HERO_X = -2.6
VIEW = 0.5

# stage: (height, crown radius, trunk radius, whorls, first whorl height)
STAGES = {
    "pine_sapling": (1.5, 0.58, 0.09, 3, 0.35),
    "pine_young": (4.2, 1.3, 0.26, 5, 0.8),
    "pine_full": (7.3, 1.75, 0.42, 7, 1.1),
}


def _pine(name):
    h, crown, tr, whorls, first = STAGES[name]

    def build():
        B = Boss(name, h)
        B.smooth = True
        bark = B.m("bark", "#5a3b24", 0.0, 0.85)
        bark_dk = B.m("bark_dark", "#3a2616", 0.0, 0.9)
        needles = [B.m("pine1", "#1f3d24", 0.0, 0.8), B.m("pine2", "#2b5230", 0.0, 0.8), B.m("pine3", "#3d6b3a", 0.0, 0.75)]
        moss = B.m("moss", "#55702c", 0.0, 0.95)
        rng = random.Random(len(name) * 31 + int(h * 10))
        t = B.part("tree", (0, 0, 0))
        # the trunk: a slight taper, a flared foot of roots, bark ridges
        t.lathe([(0, tr * 1.5), (0.18 * h / 7.3 + 0.05, tr * 1.08), (h * 0.55, tr * 0.72), (h * 0.92, tr * 0.25), (h, 0.02)], bark, sides=12)
        if name != "pine_sapling":
            for k in range(5):
                a = k * 2 * math.pi / 5 + 0.3
                seg(t, (math.cos(a) * tr * 0.6, math.sin(a) * tr * 0.6, 0.35 * tr / 0.42), (math.cos(a) * tr * 1.9, math.sin(a) * tr * 1.9, -0.05), tr * 0.32, tr * 0.12, bark_dk, sides=6)
            for k in range(8):
                a = k * 2 * math.pi / 8
                seg(t, (math.cos(a) * tr * 0.93, math.sin(a) * tr * 0.93, 0.2), (math.cos(a) * tr * 0.8, math.sin(a) * tr * 0.8, h * 0.5), tr * 0.12, tr * 0.08, bark_dk, sides=5)
            # moss on the roots
            t.rock(Vector((tr * 1.1, -tr * 0.4, 0.06)), (tr * 0.6, tr * 0.45, 0.08), moss, n=10, rough=0.05)
            t.rock(Vector((-tr * 0.9, tr * 0.8, 0.05)), (tr * 0.5, tr * 0.5, 0.07), moss, n=10, rough=0.05)
        # the tiers: each a drooping skirt of needles round the trunk, its hem cut in points (a fir's boughs seen from outside),
        # overlapping the one below, narrower and lighter toward the top
        top = h - 0.15 * h / 7.3
        for i in range(whorls):
            u = i / max(1, whorls - 1)
            z = first + (top - first - h * 0.1) * u
            reach = crown * (1.0 - 0.8 * u) + 0.06
            drop = reach * 0.62
            m = needles[min(2, int(u * 3))]
            teeth = max(7, int(14 - 6 * u))
            turn = rng.random() * math.pi

            def hem(a, ri, teeth=teeth, turn=turn, drop=drop):
                # the hem's points hang lower than the notches between them
                if ri == 0:
                    return 0.0
                k = 0.5 + 0.5 * math.cos((a - turn) * teeth)
                return -drop * 0.32 * k + drop * 0.12
            t.lathe([(z + drop * 0.55, max(tr * 0.9, reach * 0.12)), (z - drop * 0.25, reach)], m, sides=teeth * 4, zshape=hem, cap=True)
            # its underside, darker, so the tier has thickness
            t.lathe([(z - drop * 0.18, reach * 0.94), (z - drop * 0.02, tr * 1.05)], needles[0], sides=teeth * 2, cap=False)
        # the leader at the very top
        cone(t, (0, 0, top - h * 0.06), (0, 0, h), crown * 0.18 + 0.05, needles[2], sides=8)
        t.finish()
        return B

    return build


def build_stump():
    B = Boss("stump", 0.6)
    B.smooth = True
    bark = B.m("bark", "#5a3b24", 0.0, 0.85)
    bark_dk = B.m("bark_dark", "#3a2616", 0.0, 0.9)
    cut = B.m("cut", "#d9b98a", 0.0, 0.8)
    ring = B.m("ring", "#a07a4e", 0.0, 0.8)
    moss = B.m("moss", "#55702c", 0.0, 0.95)
    s = B.part("stump", (0, 0, 0))
    s.lathe([(0, 0.62), (0.12, 0.5), (0.48, 0.44), (0.5, 0.0)], bark, sides=14, cap=False)
    s.lathe([(0.495, 0.43), (0.505, 0.0)], cut, sides=14)
    s.lathe([(0.506, 0.3), (0.508, 0.24)], ring, sides=14)
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.5
        seg(s, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.2), (math.cos(a) * 0.85, math.sin(a) * 0.85, -0.04), 0.14, 0.05, bark_dk, sides=6)
    # a few chips of pale wood round it
    for k in range(4):
        a = k * 1.7 + 0.4
        s.chunk((0.26, 0.12, 0.07), cut, xf=T(math.sin(a) * 0.82, math.cos(a) * 0.82, 0.035) @ R(z=a * 2), bevel=0.01)
    s.rock(Vector((0.35, -0.2, 0.5)), (0.12, 0.1, 0.03), moss, n=8, rough=0.05)
    s.finish()
    return B


def register():
    for k in STAGES:
        bb.BUILD[k] = _pine(k)
    bb.BUILD["stump"] = build_stump
