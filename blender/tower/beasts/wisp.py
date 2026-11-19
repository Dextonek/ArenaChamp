"""
The Climb's wisp as a model (2026-11-19; the user: "lets make more models even for the tower", then "Yes, do them all"). Until now it was
a pale ball with a ring and two small balls (`wisp` in src/tower/world/looksWild.ts). A light of the Walking Wood that guides the lost,
and a quest's helper (the hero leads it; it never fights): a pale blue-white core inside a slender cage of curled living twigs, two
thin leaf fins, a veil of leaves trailing behind, and two smaller lights that follow it. Mythic, never cartoon (docs/ART_BIBLE.md §1);
the glow is kept low, the game's bloom turns a bright one into a white blob.

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py): rigid parts in a named hierarchy, no
armature, every part's origin the point it turns about, flat facets. Faces -Y, z up, metres; it floats about knee to waist high: the core
at 0.95 m, the lowest tip of the cage 0.3 m over the floor.

Parts: wisp > core > (cage, finL, finR, veil), mote1, mote2.

    blender --background --factory-startup --python blender/tower/beasts/run.py -- wisp
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, cone, panel, seg

HEIGHT = 1.6


def build_wisp():
    B = Boss("wisp", 1.6)
    twig = B.m("twig", "#6a5632", 0.0, 0.9)
    twig_dk = B.m("twig_dark", "#3e301c", 0.0, 0.92)
    leaf = B.m("leaf", "#8fae3e", 0.0, 0.8)
    leaf_pale = B.m("leaf_pale", "#c7dc8a", 0.0, 0.75)
    core_m = B.m("core", "#bfe6ff", 0.0, 0.4, emit="#6fb8f0", strength=1.0)
    mote_m = B.m("mote", "#bfe6ff", 0.0, 0.4, emit="#6fb8f0", strength=1.0)

    C = Vector((0, 0, 1.15))   # the core's centre
    wisp_root = B.name

    # --- the core: a faceted drop of light ------------------------------------------------------------------------------
    core = B.part("core", C, wisp_root)
    core.lathe([(-0.23, 0.0), (-0.14, 0.12), (0.0, 0.17), (0.14, 0.12), (0.24, 0.0)], core_m, sides=8,
               xf=T(*C) @ R(x=math.pi / 2) @ S(1.0, 1.0, 1.0))

    # --- the cage: six ribs of curled twigs from a low point to a high one, each with a twist, knots of dark wood ---------
    nrib, steps = 6, 6
    for i in range(nrib):
        a0 = i * math.tau / nrib
        pts = []
        for j in range(steps + 1):
            t = j / steps
            ph = -math.pi / 2 + t * math.pi * 0.96 + 0.06   # latitude
            r = 0.31 * math.cos(ph) + 0.02
            a = a0 + t * 1.15                                 # the twist
            pts.append(C + Vector((r * math.cos(a), r * math.sin(a) * 1.0, 0.4 * math.sin(ph) - 0.015)))
        for j in range(steps):
            w0 = 0.034 * (1.15 - 0.4 * abs(j - steps / 2) / (steps / 2))
            seg(core, pts[j], pts[j + 1], w0, 0.022, twig if (i + j) % 2 else twig_dk, sides=5, rot0=0.4)
        # a small leaf unfurling from the middle of each rib
        m = pts[2]
        out = Vector((m.x - C.x, m.y - C.y, 0)).normalized()
        side = out.cross(Vector((0, 0, 1))) * 0.025
        panel(core, [m - side, m + side, m + out * 0.13 + Vector((0, 0, 0.06))], leaf_pale if i % 2 else leaf, th=0.006)
    # curled tendrils at the crown and the foot
    cone(core, C + Vector((0, 0, 0.38)), C + Vector((0.06, 0.07, 0.58)), 0.016, twig_dk, sides=5)
    cone(core, C + Vector((0, 0, 0.38)), C + Vector((-0.07, -0.03, 0.55)), 0.014, twig_dk, sides=5)
    cone(core, C + Vector((0, 0, -0.4)), C + Vector((0.05, 0.12, -0.62)), 0.016, twig, sides=5)
    cone(core, C + Vector((0, 0, -0.4)), C + Vector((-0.06, 0.06, -0.58)), 0.014, twig_dk, sides=5)
    core.finish()

    # --- two thin leaf fins, one a side, swept back; each turns about where it joins the cage ---------------------------------
    for s, n in ((1, "L"), (-1, "R")):
        P = C + Vector((s * 0.27, 0.02, 0.03))
        fin = B.part("fin" + n, P, "core")
        tip = P + Vector((s * 0.26, 0.26, 0.12))
        mid_up = P + Vector((s * 0.15, 0.15, 0.13))
        mid_dn = P + Vector((s * 0.14, 0.1, -0.08))
        fin.hull([P + Vector((0, 0, 0.012)), P + Vector((0, 0, -0.012)), mid_up, mid_up - Vector((0, 0, 0.012)), mid_dn,
                  mid_dn + Vector((0, 0, 0.012)), tip, tip + Vector((0, 0, 0.012)), P + Vector((s * 0.1, 0.02, 0.0))], leaf)
        seg(fin, P, tip, 0.012, 0.006, twig, sides=4)
        # the lighter centre vein
        panel(fin, [P + Vector((s * 0.04, 0.01, 0)), tip - Vector((s * 0.05, 0.04, 0)), mid_up - Vector((s * 0.02, 0, 0.02))], leaf_pale, th=0.014)
        fin.finish()

    # --- the veil: a trail of leaves streaming back from the foot of the cage -------------------------------------------------
    veil = B.part("veil", C + Vector((0, 0.1, -0.28)), "core")
    for i in range(5):
        a = (i - 2) * 0.42
        base = C + Vector((0, 0.1, -0.3))
        tip = base + Vector((math.sin(a) * 0.2, 0.46 + 0.04 * (2 - abs(i - 2)), -0.2 - 0.03 * (2 - abs(i - 2))))
        side = Vector((math.cos(a) * 0.04, 0, 0.0))
        panel(veil, [base - side, base + side, tip], leaf_pale if i % 2 == 0 else leaf, th=0.008)
        veil.hull([base + Vector((0, 0, 0.008)), tip + Vector((0, 0, 0.008)), base * 0.5 + tip * 0.5 + side * 0.3], leaf)
    veil.finish()

    # --- the two smaller lights that follow it: a faceted drop in a little twig cage -------------------------------------------
    for k, (pos, rad) in enumerate(((Vector((0.2, 0.7, 0.97)), 0.085), (Vector((-0.16, 1.12, 0.8)), 0.062))):
        m = B.part(f"mote{k + 1}", pos, wisp_root)
        m.lathe([(-rad * 1.3, 0.0), (-rad * 0.6, rad * 0.9), (rad * 0.6, rad * 0.9), (rad * 1.3, 0.0)], mote_m, sides=6,
                xf=T(*pos) @ R(x=math.pi / 2))
        # three little twig hoops round it
        for i in range(3):
            a = i * math.tau / 3
            pts = [pos + Vector((math.cos(a + v * 0.9) * rad * 1.5 * math.cos(v * 1.1 - 0.55), math.sin(a + v * 0.9) * rad * 1.5 * math.cos(v * 1.1 - 0.55),
                                 rad * 1.7 * math.sin(v * 1.1 - 0.55))) for v in (0, 1, 2, 3)]
            for j in range(3):
                seg(m, pts[j], pts[j + 1], 0.007, 0.006, twig_dk, sides=4)
        m.finish()
    return B


def register():
    bb.BUILD["wisp"] = build_wisp
