"""
Verdant Glade's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): a tree-giant of the
Walking Wood, one of the old walkers that went on walking when the Wood did, on the day of the Fall. It strides slowly past behind the
glade and back (posed and walked in code, src/arenas/landmarks/treegiant.ts): a trunk for a body, long legs of twisted root, arms of
branches that sway, a hooded face of bark with two small amber slits, a crown of leaves between two great antlers (the Moot meets under
antlered trees), a few knots in the trunk that hold a low amber glow.

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned forms, smooth shading, the heroes' wood and plank browns plus
the glade's own leaf green, a thin gold girdle and gold-tipped antlers, one small light (the knots and eyes, one material). With the
bosses' toolkit for its parts: treegiant > body > (head > crown; armL > foreL; armR > foreR; legL > shinL; legR > shinR).
Faces -Y (toward the ring), z up, metres; z = 0 is the ground its feet stand on.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- treegiant
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, interp
from boss_wyrm import S, cone, seg

HEIGHT = 19.5
HERO_X = -4.5
VIEW = 0.5


def build_treegiant():
    B = Boss("treegiant", 19.5)
    B.smooth = True
    bark = B.m("bark", "#3b2a1b", 0.0, 0.8)
    barkhi = B.m("barkhi", "#5a4129", 0.0, 0.75)
    root = B.m("root", "#2c2016", 0.0, 0.85)
    moss = B.m("moss", "#3f5a2a", 0.0, 0.85)
    leaf = B.m("leaf", "#557a34", 0.0, 0.8)
    leaf2 = B.m("leaf2", "#7a8f3c", 0.0, 0.8)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    glow = B.m("glow", "#ffcf80", 0.0, 0.4, emit="#ffb03a", strength=1.2)

    def tuft(part, c, k=1.0, m=leaf):
        """A clump of leaves: a lumpy ellipsoid with a lighter one on top."""
        part.rock(Vector(c), (0.55 * k, 0.5 * k, 0.38 * k), m, n=12, rough=0.18)
        part.rock(Vector(c) + Vector((0.1 * k, 0.05 * k, 0.28 * k)), (0.32 * k, 0.3 * k, 0.22 * k), leaf2, n=10, rough=0.15)

    def strands(part, p0, p1, r, m, n=2, twist=0.45):
        """Thin roots wound round a limb's line from p0 to p1: each starts on one side and ends on the other."""
        d = (Vector(p1) - Vector(p0)).normalized()
        side = d.cross(Vector((0, 1, 0))).normalized() if abs(d.y) < 0.9 else Vector((1, 0, 0))
        up = d.cross(side).normalized()
        for k in range(n):
            a = k * math.tau / n
            o0 = (side * math.cos(a) + up * math.sin(a)) * twist
            o1 = (side * math.cos(a + 2.4) + up * math.sin(a + 2.4)) * twist
            mid = (Vector(p0) + Vector(p1)) * 0.5 + (side * math.cos(a + 1.2) + up * math.sin(a + 1.2)) * twist * 1.25
            seg(part, Vector(p0) + o0, mid, r, r * 0.9, m, sides=6)
            seg(part, mid, Vector(p1) + o1, r * 0.9, r * 0.7, m, sides=6)

    # ---- body: the trunk, hips to shoulders, with its bark flanges, mossy mantle, gold girdle and glowing knots
    body = B.part("body", (0, 0, 6.6))
    prof = [(6.0, 1.7), (6.6, 2.2), (7.8, 2.45), (9.2, 2.6), (10.4, 2.75), (11.0, 2.2), (11.5, 1.2)]
    flat = S(1.0, 0.86, 1.0)
    body.lathe(prof, bark, sides=20, xf=flat, rot0=0.1)
    body.rock((0, 0, 6.5), (2.7, 2.2, 1.0), root, n=16, rough=0.1)
    # a skirt of roots hanging from the hips, over the tops of the legs
    for k in range(11):
        a = k * math.tau / 11 + 0.2
        p0 = Vector((2.0 * math.cos(a), 1.7 * math.sin(a), 6.4))
        p1 = Vector((2.9 * math.cos(a), 2.4 * math.sin(a), 4.2 - 0.5 * (k % 3)))
        seg(body, p0, p1, 0.5, 0.12, root if k % 2 else bark, sides=6)
    # girdle of gold at the waist
    r0 = interp(prof, 6.95)
    body.lathe([(6.85, r0 + 0.02), (6.85, r0 + 0.11), (7.05, r0 + 0.11), (7.05, r0 + 0.02)], gold, sides=20, xf=flat, rot0=0.1)
    # vertical flanges of bark round the sides and back
    for deg in (-25, 10, 45, 80, 115, 150, 185):
        a = math.radians(deg)
        for z0, z1, r in ((7.3, 9.8, 0.26), (9.6, 10.9, 0.22)):
            ra, rb = interp(prof, z0), interp(prof, z1)
            p0 = Vector((ra * math.cos(a) * 1.0, ra * math.sin(a) * 0.86, z0))
            p1 = Vector((rb * math.cos(a) * 1.0, rb * math.sin(a) * 0.86, z1))
            seg(body, p0, p1, r, r * 0.7, barkhi, sides=5)
    # mossy mantle on the shoulders
    for sg in (1, -1):
        body.rock((sg * 2.3, 0.1, 11.0), (1.9, 1.6, 0.85), moss, n=16, rough=0.15)
        tuft(body, (sg * 2.9, -0.1, 11.6), 1.25)
        tuft(body, (sg * 1.5, 0.5, 11.7), 1.0, leaf2)
    # knots in the trunk that hold a low amber glow: a ring of lighter bark, the glow set in it
    for (x, z, k) in ((0.95, 9.3, 1.0), (-1.05, 8.1, 0.85), (0.15, 10.2, 0.7)):
        y = -interp(prof, z) * 0.86 + 0.05
        body.rock((x, y, z), (0.46 * k, 0.2, 0.58 * k), barkhi, n=14, rough=0.08)
        body.rock((x, y - 0.14, z), (0.2 * k, 0.1, 0.3 * k), glow, n=12, rough=0.04)
    body.finish()

    # ---- head: a hooded face of bark under the crown, two small amber slits, a beard of moss
    head = B.part("head", (0, -0.2, 11.4), "body")
    head.rock((0, -0.25, 12.4), (1.25, 1.15, 1.35), barkhi, n=22, rough=0.06)
    head.hull([(-1.25, -0.9, 12.85), (1.25, -0.9, 12.85), (-1.2, -1.2, 12.45), (1.2, -1.2, 12.45), (-1.1, 0.2, 12.9), (1.1, 0.2, 12.9),
               (0, -1.3, 13.0), (0, -1.35, 12.5)], bark)
    seg(head, (0, -1.3, 12.4), (0, -1.42, 11.55), 0.15, 0.1, bark, sides=7)
    for sg in (-1, 1):
        head.hull([(sg * 0.26, -1.28, 12.4), (sg * 0.68, -1.1, 12.34), (sg * 0.68, -1.1, 12.26), (sg * 0.28, -1.28, 12.3),
                   (sg * 0.48, -1.15, 12.44)], glow)
    for k, x in enumerate((-0.45, -0.22, 0.0, 0.22, 0.45)):
        cone(head, (x * 1.2, -1.1, 11.7), (x * 1.5, -1.15, 10.6 - 0.3 * (k % 2)), 0.11, moss, sides=6)
    head.finish()

    # ---- crown: leaves between two great antlers of branch, their tips gold
    crown = B.part("crown", (0, -0.1, 13.3), "head")
    for i, (x, y, z, k) in enumerate(((0, 0, 14.4, 2.2), (2.5, 0.2, 13.7, 1.6), (-2.5, 0.2, 13.7, 1.6), (0.8, -1.6, 13.6, 1.4), (-0.9, 1.5, 13.9, 1.5),
                                      (1.7, 1.2, 14.9, 1.3), (-1.8, -0.8, 14.8, 1.3), (3.2, -0.6, 12.9, 1.0), (-3.2, -0.6, 12.9, 1.0))):
        crown.rock((x, y, z), (1.0 * k, 0.9 * k, 0.68 * k), leaf if i % 2 else moss, n=14, rough=0.2)
        if i % 3 == 0:
            crown.rock((x * 0.8, y - 0.3, z + 0.55 * k), (0.6 * k, 0.55 * k, 0.4 * k), leaf2, n=10, rough=0.18)
    for sg in (1, -1):
        pts = [(sg * 0.6, -0.1, 13.4), (sg * 1.3, -0.15, 14.6), (sg * 2.0, 0, 15.9), (sg * 2.5, 0.1, 17.0)]
        rad = [0.3, 0.24, 0.18, 0.1]
        for i in range(3):
            seg(crown, pts[i], Vector(pts[i + 1]) + (Vector(pts[i + 1]) - Vector(pts[i])) * 0.05, rad[i], rad[i + 1], bark, sides=8)
        # forks: one outward, one inward, one forward-up
        for (a, b, c) in ((1, (sg * 2.9, -0.25, 15.4), 0.14), (2, (sg * 1.2, 0.05, 16.8), 0.12), (1, (sg * 0.9, -0.6, 15.9), 0.11)):
            p = Vector(pts[a])
            seg(crown, p, b, c, 0.05, bark, sides=6)
            cone(crown, b, Vector(b) + (Vector(b) - p).normalized() * 0.55, 0.05, gold, sides=5)
        cone(crown, pts[3], Vector(pts[3]) + Vector((sg * 0.25, 0.05, 0.6)), 0.1, gold, sides=6)
        tuft(crown, (sg * 1.9, 0.1, 15.2), 0.7, leaf2)
    crown.finish()

    # ---- arms: great branches that hang and sway, fingers of twigs, tufts of leaves
    for sg, nm in ((1, "L"), (-1, "R")):
        S0 = Vector((sg * 2.6, 0, 10.3))
        E0 = Vector((sg * 4.2, -0.5, 6.6))
        W0 = Vector((sg * 4.3, -1.5, 3.0))
        arm = B.part("arm" + nm, S0, "body")
        arm.rock(S0, (1.0, 1.0, 0.95), bark, n=16, rough=0.1)
        seg(arm, S0, E0, 0.95, 0.7, bark, sides=10)
        strands(arm, S0, E0, 0.3, barkhi, n=2, twist=0.7)
        for t, (dx, dz) in ((0.35, (0.9, 0.5)), (0.65, (0.9, 0.2))):
            p = S0.lerp(E0, t)
            tip = p + Vector((sg * dx * 1.6, 0.3, 0.9 + dz))
            seg(arm, p, tip, 0.2, 0.07, bark, sides=6)
            tuft(arm, tip + Vector((0, 0, 0.15)), 0.75)
        arm.finish()
        fore = B.part("fore" + nm, E0, "arm" + nm)
        fore.rock(E0, (0.8, 0.8, 0.75), bark, n=14, rough=0.1)
        seg(fore, E0, W0, 0.7, 0.45, bark, sides=10)
        strands(fore, E0, W0, 0.22, barkhi, n=2, twist=0.5)
        for i, (dx, dy, dz, ln) in enumerate(((0.55, -0.35, -1.25, 1.9), (0.2, -0.55, -1.3, 2.1), (-0.2, -0.6, -1.2, 2.0), (-0.55, -0.35, -1.1, 1.7))):
            d = Vector((sg * dx, dy, dz)).normalized()
            tip = W0 + d * ln
            seg(fore, W0 + Vector((sg * (i - 1.5) * 0.12, 0, 0)), tip, 0.2, 0.05, bark, sides=6)
            cone(fore, tip, tip + d * 0.35, 0.05, root, sides=5)
        p = E0.lerp(W0, 0.5)
        tip = p + Vector((sg * 1.6, 0.5, 0.5))
        seg(fore, p, tip, 0.16, 0.06, bark, sides=6)
        tuft(fore, tip, 0.65, leaf2)
        fore.finish()

    # ---- legs: long and slow, twisted roots; the shin ends in a foot of splayed roots on the ground
    for sg, nm in ((1, "L"), (-1, "R")):
        H0 = Vector((sg * 1.35, 0, 9.0))
        K0 = Vector((sg * 1.9, -0.4, 4.8))
        A0 = Vector((sg * 2.0, 0.1, 0.5))
        leg = B.part("leg" + nm, H0, "body")
        leg.rock(H0, (0.95, 0.95, 0.85), bark, n=14, rough=0.08)
        seg(leg, H0, K0, 1.15, 0.8, bark, sides=10)
        strands(leg, H0, K0, 0.38, barkhi, n=3, twist=0.85)
        leg.finish()
        shin = B.part("shin" + nm, K0, "leg" + nm)
        shin.rock(K0, (0.78, 0.78, 0.7), bark, n=14, rough=0.1)
        seg(shin, K0, A0, 0.8, 0.6, bark, sides=10)
        strands(shin, K0, A0, 0.32, barkhi, n=3, twist=0.7)
        shin.rock(A0, (0.7, 0.7, 0.4), bark, n=12, rough=0.1)
        toes = ((0.0, -2.1), (-0.95, -1.5), (0.95, -1.5), (0.0, 1.2), (sg * 1.5, -0.3), (-sg * 1.2, 0.2))
        for dx, dy in toes:
            tip = Vector((A0.x + dx, A0.y + dy, 0.12))
            mid = A0.lerp(tip, 0.5) + Vector((0, 0, 0.18))
            seg(shin, A0, mid, 0.42, 0.3, root, sides=8)
            seg(shin, mid, tip, 0.3, 0.07, root, sides=8)
        tuft(shin, (A0.x + sg * 0.5, A0.y - 0.3, 0.75), 0.6, moss)
        shin.finish()
    # The upper body was drawn standing on short legs; lift it by OFF and let the longer legs, drawn to the lifted hip, stay where they are.
    OFF = 2.4
    B.objs["body"].location.z += OFF
    for nm in ("legL", "legR"):
        B.objs[nm].location.z -= OFF
    return B


def register():
    bb.BUILD["treegiant"] = build_treegiant
