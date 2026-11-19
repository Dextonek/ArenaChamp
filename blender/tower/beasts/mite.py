"""
The Climb's shard mite as a model (2026-11-19; "lets make more models even for the tower", "Yes, do them all"). Until now it was drawn in
code (`miteLook` in src/tower/world/f45/looks.ts): an icosahedron, three octahedra and six sticks. The Lightless Deep's pack biter: a
cave tick the size of a dog, dark violet-black chitin in overlapping plates, its back grown over with crystal shards that glow a cold
cyan (kept low: under the game's bloom a bright glow becomes a white blob), six quick spidery legs with high knees, a small head with
sunk eyes under a hard brow, and two hooked mandibles. Lean and angular, never cartoon (docs/ART_BIBLE.md §1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, the wyrm's helpers in boss_wyrm.py): rigid parts in a named
hierarchy, no armature, every part's origin the point it turns about, flat facets, a few materials. The game poses it in code.
Faces -Y, z up, metres; about 1.15 m from the mandibles to the rear, 0.34 m to the top of the shell, 0.62 m to the crystal tips (the unit
draws it at its scale, 1.1). Its left is +x.

Parts: mite > body > (head > mandL, mandR; legL1..legL3 > shinL1..shinL3; legR1..legR3 > shinR1..shinR3).

    blender --background --factory-startup --python blender/tower/beasts/run.py -- mite
"""
import math
import random

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, interp
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.0


def build_mite():
    B = Boss("mite", 1.0)
    rng = random.Random(23)
    chit = B.m("chitin", "#382e4e", 0.1, 0.55)
    chit_dk = B.m("chitin_dark", "#1d1829", 0.1, 0.6)
    chit_hi = B.m("chitin_hi", "#645688", 0.1, 0.5)
    bone = B.m("bone", "#b9ae98", 0.0, 0.7)
    crys = B.m("crystal", "#3fc0dc", 0.0, 0.35, emit="#2fb0d0", strength=0.75)
    crys_hi = B.m("crystal_hi", "#9be8f4", 0.0, 0.35, emit="#6cd0e8", strength=0.75)
    eye = B.m("eye", "#d4f6ff", 0.0, 0.4, emit="#8cd8ec", strength=0.8)

    BZ = 0.3
    # --- the body: a small thorax and a big domed abdomen, a lathe along its length (local z -> world +y) ----------------------
    body = B.part("body", (0, 0, BZ))
    th = [(-0.3, 0.07), (-0.2, 0.16), (-0.08, 0.2), (0.05, 0.17), (0.12, 0.1)]
    body.lathe(th, [chit, chit_hi, chit, chit], sides=8, xf=T(0, -0.12, BZ + 0.02) @ R(x=-math.pi / 2) @ S(1.0, 0.7, 1.0), rot0=math.pi / 8)
    ab = [(-0.28, 0.09), (-0.2, 0.24), (-0.05, 0.31), (0.15, 0.3), (0.3, 0.2), (0.42, 0.07)]
    ABX = T(0, 0.3, BZ + 0.02) @ R(x=-math.pi / 2) @ S(1.0, 0.95, 1.0)
    body.lathe(ab, [chit_dk, chit, chit, chit, chit_dk], sides=9, xf=ABX, rot0=math.pi / 9)

    def ab_top(y):
        return BZ + 0.02 + interp(ab, y - 0.3) * 0.95

    # tergite plates: overlapping bands across the abdomen's back, each a little different
    for i in range(6):
        y = 0.1 + i * 0.1
        r = interp(ab, y - 0.3)
        plate(body, (0, y, ab_top(y) - 0.012), (1, 0, 0), (0, -0.15, 1), (2 * r * 0.95, 0.085, 0.03), chit_hi, taper=(0.75, 0.9), bevel=0.012)
    # a hard shield over the thorax, the shoulder ridges
    plate(body, (0, -0.12, BZ + 0.02 + 0.2 * 0.7), (0, 1, 0), (0, 0, 1), (0.26, 0.26, 0.045), chit_hi, taper=(0.7, 0.8), bevel=0.015)
    # the crystals: a crowded crest down the back, tall ones leaning back, small bright ones round them
    for i, (y, x, h, r, lean) in enumerate(((0.12, 0.0, 0.3, 0.06, 0.1), (0.24, -0.1, 0.24, 0.05, 0.12), (0.26, 0.1, 0.28, 0.055, 0.12),
                                          (0.38, 0.0, 0.3, 0.07, 0.15), (0.5, -0.07, 0.18, 0.045, 0.14), (0.5, 0.08, 0.2, 0.05, 0.14),
                                          (0.0, 0.0, 0.14, 0.04, 0.08), (0.34, 0.2, 0.15, 0.04, 0.0), (0.34, -0.2, 0.16, 0.04, 0.0),
                                          (0.6, 0.0, 0.12, 0.04, 0.12))):
        base = Vector((x, y, ab_top(y) - 0.045 - abs(x) * 0.35))
        tip = base + Vector((x * 0.7, lean, h))
        cone(body, base, tip, r, crys_hi if i % 3 == 2 else crys, sides=4)
    body.finish()

    # --- head: a small wedge with a hard brow and four sunk eyes; the mandibles hang from its front ---------------------------
    hp = Vector((0, -0.3, BZ + 0.0))
    head = B.part("head", hp, "body")
    pts = []
    for sx in (-1, 1):
        pts += [(sx * 0.12, -0.26, 0.2), (sx * 0.1, -0.26, 0.4), (sx * 0.1, -0.4, 0.2), (sx * 0.08, -0.42, 0.37), (sx * 0.05, -0.52, 0.24),
                (sx * 0.05, -0.5, 0.31)]
    head.hull(pts, chit)
    for sx in (-1, 1):
        head.hull([(sx * 0.03, -0.4, 0.39), (sx * 0.11, -0.38, 0.4), (sx * 0.11, -0.44, 0.35), (sx * 0.03, -0.46, 0.355),
                   (sx * 0.05, -0.4, 0.425)], chit_dk)
        head.rock(Vector((sx * 0.08, -0.43, 0.335)), (0.028, 0.028, 0.028), eye, n=8, rough=0.04)
        head.rock(Vector((sx * 0.1, -0.35, 0.36)), (0.018, 0.018, 0.018), eye, n=8, rough=0.04)
        # palps beside the mandibles
        cone(head, (sx * 0.075, -0.5, 0.25), (sx * 0.1, -0.62, 0.2), 0.022, chit_hi, sides=4)
    head.finish()

    for s, n in ((1, "L"), (-1, "R")):
        p0 = Vector((s * 0.045, -0.52, 0.255))
        m = B.part("mand" + n, p0, "head")
        p1 = p0 + Vector((s * 0.03, -0.07, -0.04))
        p2 = p1 + Vector((-s * 0.02, -0.07, -0.07))
        p3 = p2 + Vector((-s * 0.06, -0.03, -0.08))
        seg(m, p0, p1, 0.035, 0.03, chit_hi, sides=5)
        seg(m, p1, p2, 0.03, 0.022, bone, sides=5)
        cone(m, p2, p3, 0.022, bone, sides=4)
        m.finish()

    # --- six legs: a coxa out and up to a high knee, a long thin shin down to a point --------------------------------------
    hip_y = [-0.14, 0.0, 0.14]
    knee = [(0.46, -0.3, 0.46), (0.48, 0.0, 0.48), (0.46, 0.3, 0.44)]
    foot = [(0.66, -0.54, 0.0), (0.7, -0.04, 0.0), (0.64, 0.5, 0.0)]
    for s, n in ((1, "L"), (-1, "R")):
        for i in range(3):
            hip = Vector((s * 0.16, hip_y[i], BZ + 0.0))
            kn = Vector((s * knee[i][0], knee[i][1], knee[i][2]))
            ft = Vector((s * foot[i][0], foot[i][1], foot[i][2]))
            up = B.part(f"leg{n}{i + 1}", hip, "body")
            seg(up, hip, kn + (kn - hip) * 0.05, 0.058, 0.045, chit, sides=5, belly=1.1)
            up.rock(kn, (0.062, 0.062, 0.062), chit_hi, n=10, rough=0.05)
            cone(up, kn + Vector((0, 0, 0.02)), kn + Vector((0, 0, 0.1)), 0.02, chit_dk, sides=4)
            up.finish()
            lo = B.part(f"shin{n}{i + 1}", kn, f"leg{n}{i + 1}")
            seg(lo, kn, ft, 0.048, 0.015, chit_dk, sides=5)
            cone(lo, ft + Vector((0, 0, 0.05)), ft - Vector((0, 0, 0.005)), 0.016, chit_hi, sides=4)
            lo.finish()
    return B


def register():
    bb.BUILD["mite"] = build_mite
