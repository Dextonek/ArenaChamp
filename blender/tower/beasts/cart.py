"""
The Sands' caravan cart as a model (2026-11-19; the user: "lets make more models even for the tower", then "Yes, do them all"). Until now
it was a box, a half-cylinder and two rings (`cart` in src/tower/world/looksWild.ts). A quest's helper: the hero leads it, it never
fights. A two-wheeled cart with big spoked wheels, a canvas hood in bands of rust and turquoise over wooden hoops, sacks and jars in
the back, and a pole in front that rests on a little prop (it has no animal, and must look right standing still) with a lantern hanging
from a crook. Mythic and worn, never cartoon (docs/ART_BIBLE.md §1); the lantern's glow is kept low.

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py): rigid parts in a named hierarchy, no
armature, every part's origin the point it turns about, flat facets. Faces -Y, z up, metres; the wheels' radius is WHEEL_R (0.40), they
turn about x at the axle.

Parts: cart > bed > (hood, lantern), wheelL, wheelR.

    blender --background --factory-startup --python blender/tower/beasts/run.py -- cart
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.5
WHEEL_R = 0.40
AXLE = Vector((0, 0.0, WHEEL_R))
WHEEL_X = 0.58


def build_cart():
    B = Boss("cart", 1.5)
    wood = B.m("wood", "#6a4528", 0.0, 0.9)
    wood_dk = B.m("wood_dark", "#3e2917", 0.0, 0.92)
    iron = B.m("iron", "#33302d", 0.4, 0.55)
    rust = B.m("rust", "#b0552e", 0.0, 0.85)
    turq = B.m("turq", "#2fa7a2", 0.0, 0.8)
    sand = B.m("sand", "#cdb98a", 0.0, 0.9)
    clay = B.m("clay", "#a8683c", 0.0, 0.85)
    gold = B.m("gold", "#d6a23a", 0.5, 0.45)
    glass = B.m("lamp", "#ffd9a0", 0.0, 0.4, emit="#ff9e3a", strength=1.3)

    # --- the bed: a plank floor on the axle, low side boards, a crossbar at the front for the pole -----------------------------
    BZ = 0.62
    bed = B.part("bed", Vector((0, 0, BZ)), "cart")
    bed.chunk((1.0, 1.5, 0.1), wood, xf=T(0, 0.05, BZ), bevel=0.02)
    for s in (-1, 1):
        bed.chunk((0.07, 1.5, 0.2), wood_dk, xf=T(s * 0.5, 0.05, BZ + 0.1), bevel=0.015)
        bed.chunk((0.09, 1.3, 0.07), wood_dk, xf=T(s * 0.5, 0.05, BZ - 0.08), bevel=0.015)   # the frame beam under it
    bed.chunk((1.0, 0.07, 0.2), wood_dk, xf=T(0, 0.8, BZ + 0.1), bevel=0.015)               # the tailboard
    bed.chunk((1.0, 0.07, 0.18), wood_dk, xf=T(0, -0.7, BZ + 0.09), bevel=0.015)            # the headboard
    # the axle, through both wheels' hubs
    seg(bed, Vector((-WHEEL_X, 0, WHEEL_R)), Vector((WHEEL_X, 0, WHEEL_R)), 0.04, 0.04, iron, sides=6)
    for s in (-1, 1):
        seg(bed, Vector((s * 0.5, 0, WHEEL_R)), Vector((s * 0.5, 0, BZ - 0.05)), 0.03, 0.03, wood_dk, sides=5)
    # the pole: two shafts running forward from the frame, rising a little, joined at the front by a crossbar; a prop under it
    tip = Vector((0, -1.6, 0.7))
    for s in (-1, 1):
        seg(bed, Vector((s * 0.34, -0.5, BZ - 0.08)), Vector((s * 0.06, tip.y, tip.z)), 0.035, 0.028, wood, sides=5)
    bed.chunk((0.3, 0.06, 0.06), wood_dk, xf=T(0, tip.y + 0.12, tip.z - 0.005), bevel=0.012)
    # the prop: two splayed legs from the shafts to the ground, a cross brace
    pb = Vector((0, -1.2, 0.0))
    for s in (-1, 1):
        a = Vector((s * 0.1, -1.2, 0.69))
        b = Vector((s * 0.2, -1.3, 0.0))
        seg(bed, a, b, 0.028, 0.024, wood_dk, sides=5)
        bed.chunk((0.07, 0.1, 0.03), wood_dk, xf=T(b.x, b.y, 0.015), bevel=0.01)
    seg(bed, Vector((-0.15, -1.25, 0.22)), Vector((0.15, -1.25, 0.22)), 0.02, 0.02, wood_dk, sides=4)
    # the crook: an upright from the crossbar, curving over to hang the lantern at x = 0
    top = Vector((0, tip.y + 0.05, 1.26))
    seg(bed, Vector((0, tip.y + 0.12, tip.z)), top, 0.026, 0.02, wood_dk, sides=5)
    seg(bed, top, Vector((0, tip.y - 0.22, 1.24)), 0.02, 0.016, wood_dk, sides=5)
    cone(bed, Vector((0, tip.y - 0.22, 1.24)), Vector((0, tip.y - 0.27, 1.17)), 0.014, iron, sides=4)

    # the load: sacks of sand-coloured cloth with ties, jars in clay, a rolled mat, a coil of rope; all tied down by a strap
    bed.rock(Vector((-0.2, 0.42, BZ + 0.22)), (0.28, 0.3, 0.2), sand, n=22, rough=0.12)
    bed.rock(Vector((0.22, 0.5, BZ + 0.2)), (0.24, 0.26, 0.18), rust, n=20, rough=0.1)
    bed.rock(Vector((0.05, 0.1, BZ + 0.2)), (0.3, 0.28, 0.17), sand, n=22, rough=0.12)
    for (x, y) in ((-0.3, -0.38), (0.0, -0.45), (0.3, -0.35)):
        bed.lathe([(0.0, 0.0), (0.0, 0.06), (0.1, 0.13), (0.22, 0.14), (0.34, 0.08), (0.4, 0.045), (0.42, 0.05), (0.42, 0.0)], clay, sides=7,
                  xf=T(x, y, BZ + 0.05), rot0=0.2)
        bed.lathe([(0.0, 0.06), (0.016, 0.075)], turq, sides=7, xf=T(x, y, BZ + 0.38))   # a turquoise lid band
    # a jar and a coil hung outside the tailboard
    bed.lathe([(0.0, 0.0), (0.0, 0.05), (0.08, 0.1), (0.17, 0.1), (0.25, 0.055), (0.28, 0.04), (0.28, 0.0)], clay, sides=7,
              xf=T(0.25, 0.88, BZ - 0.05), rot0=0.3)
    seg(bed, Vector((0.25, 0.84, BZ + 0.2)), Vector((0.12, 0.8, BZ + 0.25)), 0.012, 0.012, wood_dk, sides=4)
    seg(bed, Vector((-0.3, 0.84, BZ - 0.02)), Vector((-0.3, 0.86, BZ + 0.2)), 0.1, 0.1, sand, sides=7)   # a rolled mat on the tailboard
    seg(bed, Vector((-0.3, 0.86, BZ + 0.2)), Vector((-0.3, 0.86, BZ + 0.2)) + Vector((0, 0, 0.001)), 0.1, 0.1, rust, sides=7)
    bed.finish()

    # --- the hood: wooden hoops over the bed, canvas bands over them, rust and turquoise alternating, with a gold trim on the front rim --
    hood = B.part("hood", Vector((0, 0, BZ)), "bed")
    HC, HR = Vector((0, 0, BZ + 0.14)), 0.52
    ys = [-0.7 + i * 0.2 for i in range(8)]            # band edges: -0.7 .. 0.7
    na = 6
    for bi in range(len(ys) - 1):
        y0, y1 = ys[bi] + 0.004, ys[bi + 1] - 0.004
        m = turq if bi % 2 else rust
        for k in range(na):
            a0, a1 = math.pi * k / na, math.pi * (k + 1) / na
            ro, ri = HR * (1.0 + 0.04 * math.sin(math.pi * (y0 + 0.7) / 1.4) * 0.5), HR - 0.04
            pts = []
            for a in (a0, a1):
                for r in (ro, ri):
                    for y in (y0, y1):
                        pts.append(HC + Vector((r * math.cos(a), y, r * math.sin(a) * 1.0)))
            hood.hull(pts, m)
    # hoops at each band edge, a little proud of the canvas
    for y in ys:
        for k in range(na):
            a0, a1 = math.pi * k / na, math.pi * (k + 1) / na
            seg(hood, HC + Vector((HR * 1.02 * math.cos(a0), y, HR * 1.02 * math.sin(a0))),
                HC + Vector((HR * 1.02 * math.cos(a1), y, HR * 1.02 * math.sin(a1))), 0.024, 0.024, wood_dk, sides=4)
    # the ridge pole and a gold trim along the front rim
    seg(hood, HC + Vector((0, -0.74, HR + 0.03)), HC + Vector((0, 0.74, HR + 0.03)), 0.022, 0.022, wood_dk, sides=5)
    for k in range(na):
        a0, a1 = math.pi * k / na, math.pi * (k + 1) / na
        seg(hood, HC + Vector((HR * 1.06 * math.cos(a0), -0.72, HR * 1.06 * math.sin(a0))),
            HC + Vector((HR * 1.06 * math.cos(a1), -0.72, HR * 1.06 * math.sin(a1))), 0.013, 0.013, gold, sides=4)
    # the hood's back: a canvas flap, half closed (dark inside shows at the front)
    hood.hull([HC + Vector((x, 0.72, z)) for x in (-HR * 0.9, HR * 0.9) for z in (0.0, HR * 0.5)] + [HC + Vector((0, 0.72, HR * 0.95))], rust)
    hood.finish()

    # --- the lantern: a little cage of iron with a warm glass, swinging from the crook ------------------------------------------
    hang = Vector((0, tip.y - 0.27, 1.17))
    lamp = B.part("lantern", hang, "bed")
    seg(lamp, hang, hang - Vector((0, 0, 0.07)), 0.006, 0.006, iron, sides=4)
    lamp.lathe([(0.0, 0.0), (0.0, 0.08), (0.045, 0.05)], iron, sides=6, xf=T(hang.x, hang.y, hang.z - 0.16) @ R(), rot0=0.3)
    lamp.lathe([(0.0, 0.0), (0.0, 0.075)], iron, sides=6, xf=T(hang.x, hang.y, hang.z - 0.075), rot0=0.3)
    lamp.lathe([(-0.07, 0.05), (0.0, 0.065), (0.07, 0.05)], glass, sides=6, xf=T(hang.x, hang.y, hang.z - 0.15), rot0=0.3)
    lamp.lathe([(0.0, 0.055), (0.012, 0.065)], iron, sides=6, xf=T(hang.x, hang.y, hang.z - 0.235), rot0=0.3)
    for k in range(4):
        a = k * math.pi / 2 + 0.78
        seg(lamp, hang + Vector((0.055 * math.cos(a), 0.055 * math.sin(a), -0.085)),
            hang + Vector((0.055 * math.cos(a), 0.055 * math.sin(a), -0.225)), 0.006, 0.006, iron, sides=4)
    lamp.finish()

    # --- the wheels: big and spoked, iron-shod, a turquoise hub; pivot at the axle so they turn about x ------------------------------
    for s, n in ((1, "L"), (-1, "R")):
        P = Vector((s * WHEEL_X, 0, WHEEL_R))
        w = B.part("wheel" + n, P, "cart")
        nf = 10
        for i in range(nf):
            a0, a1 = math.tau * i / nf, math.tau * (i + 1) / nf
            p0 = P + Vector((0, WHEEL_R * math.sin(a0), WHEEL_R * math.cos(a0)))
            p1 = P + Vector((0, WHEEL_R * math.sin(a1), WHEEL_R * math.cos(a1)))
            seg(w, p0 * 1.0 + Vector((-0.0, 0, 0)), p1, 0.055, 0.055, iron if i % 2 else wood, sides=5, rot0=0.1)
        for i in range(7):
            a = math.tau * i / 7 + 0.2
            rim = P + Vector((0, (WHEEL_R - 0.02) * math.sin(a), (WHEEL_R - 0.02) * math.cos(a)))
            seg(w, P, rim, 0.026, 0.018, wood_dk, sides=4)
        w.lathe([(-0.09, 0.04), (-0.05, 0.085), (0.05, 0.085), (0.09, 0.04)], turq, sides=8, xf=T(*P) @ R(y=math.pi / 2))
        w.finish()
    return B


def register():
    bb.BUILD["cart"] = build_cart
