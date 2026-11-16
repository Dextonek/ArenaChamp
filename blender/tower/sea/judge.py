"""The Bell Judge (the Sea's third ruler, a boss drawn about 2.3 to 2.5 times a hero's size: the Tide Judge, the Bell Below,
the Lantern Leviathan): the sea's own law, who sank with the court that tried the drowned. Built as a giant: broad, deep, a
smaller head, big hands. His head is a great bronze diving bell, gold-ribbed, one round porthole of sea-glass lit from
within: his one light. A judge's black robe to the floor over a deep teal under-robe, a white bib at the throat, a heavy
gold chain of office with a medallion of a wave; bronze bands at the sleeves; barnacles along the bell's rim. In the RIGHT
hand a great harpoon-glaive: a long haft, a broad barbed bronze blade. Signature shape: the bell head and the glaive."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("sea_judge", sex="m", height=1.04, width=1.3, depth=1.28, head=0.86, skin="#8ea6a0")
    z = R.z
    R.mat("black", "#121418", rough=0.62, double=True)
    R.mat("teal", "#14444e", rough=0.62, double=True)
    R.mat("white", "#e2dcc8", rough=0.75, double=True)
    R.mat("bronze", "#9a6a34", rough=0.35, metal=0.8, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("barnacle", "#e2dcc6", rough=0.7)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.3)
    R.mat("wood", "#2a1e14", rough=0.65)
    R.faceless()
    PB.big_hands(R, 1.3)
    z = R.z

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "black", offset=0.01)
    R.fitted("Under", ["thigh", "calf", "foot", "ball"], "teal", offset=0.005)
    P.gloves(R, "black")
    R.boots("black", top=z["ankle"] + 0.1, toe="bronze")
    for n in "lr":
        P.sleeve(R, n, "black", t0=0.35, t1=0.96, r0=0.015, r1=0.095, rim="bronze", rim_r=0.009, seg=16, n=4)
    hem = z["ankle"] - 0.01
    gap = 0.35
    f, rings = P.skirt(R, "black", hem, flare=1.7, depth=1.15, arc=(gap, 2 * PI - gap), folds=10, amp=0.025, seg=56, trim="bronze", trim_h=0.03)
    P.cloth(f, "teal", rings, arc=(-gap - 0.1, gap + 0.1), seg=10, rows=10, off=-0.008)
    R.band("teal", z["waist"], height=0.08, grow=1.13, how=R.hang_w(z["waist"], hem))

    # the white bib and the gold chain of office with its wave medallion
    fc, foot, top = P.collar(R, "black", height=0.05, grow=1.2)
    cc, rxc, ryc = R.ring(z["chest"])
    bib = R.piece("spine_03")
    for s in (1, -1):
        p0 = foot + Vector((0.02 * s, -0.01, 0.0))
        PA.blade(bib, "white", p0, p0 + Vector((0.012 * s, -0.02, -0.14)), 0.03, (0, -1, 0), thick=0.15, belly=0.3, root=0.9)
    pts = []
    for k in range(17):
        a = -PI * 0.55 + PI * 1.1 * k / 16
        zz = z["chest"] + 0.02 + 0.09 * abs(math.sin(a)) ** 0.7
        p, out = P.on_trunk(R, zz, a, off=0.03)
        pts.append(p)
    bib.tube("gold", pts, 0.012, seg=6)
    for p in pts[::2]:
        bib.torus("gold", p, 0.016, 0.005, normal=(0, 0, 1), seg=(10, 5))
    med = pts[8] + Vector((0, -0.01, -0.03))
    PB.disc(bib, "gold", med, (0, -1, 0), 0.05, thick=0.012)
    bib.tube("teal", [med + Vector((-0.03, -0.008, 0.0)), med + Vector((-0.01, -0.008, 0.015)), med + Vector((0.01, -0.008, -0.01)), med + Vector((0.03, -0.008, 0.008))], 0.006, seg=5)

    # the diving bell: a bronze dome over the head and shoulders' top, gold ribs, a porthole, a rim with barnacles
    h = P.head(R)
    hp = R.piece("Head")
    c = h.c + Vector((0, 0.0, -0.02))
    rx, ry, rz = h.rx * 1.75, h.ry * 1.55, h.rz * 1.9
    P.shell(hp, "bronze", c, (rx, ry, rz), lambda a: -0.55, seg=32, rows=10, rim="gold", rim_r=0.014)
    for k in range(8):
        a = 2 * PI * k / 8
        pts = [c + Vector((rx * 1.01 * math.sin(th) * math.sin(a), -ry * 1.01 * math.sin(th) * math.cos(a), rz * 1.01 * math.cos(th))) for th in [math.acos(-0.5) * j / 8 for j in range(9)]]
        hp.tube("gold", pts, 0.008, seg=5)
    hp.ellipsoid("bronze", c + Vector((0, 0, rz * 1.02)), (0.04, 0.04, 0.03), seg=(12, 6))
    hp.torus("gold", c + Vector((0, 0, rz * 1.06)), 0.03, 0.009, normal=(0, 1, 0), seg=(14, 6))
    port = c + Vector((0, -ry * 0.98, rz * 0.08))
    hp.torus("gold", port, 0.06, 0.014, normal=(0, -1, 0.1), seg=(24, 8))
    hp.ellipsoid("glow", port + Vector((0, 0.008, 0)), (0.055, 0.012, 0.055), seg=(16, 8))
    for k in range(10):
        a = 2.0 + 2.2 * k / 9
        b = c + Vector((rx * math.sin(math.acos(-0.55)) * math.sin(a), -ry * math.sin(math.acos(-0.55)) * math.cos(a), rz * -0.55))
        sz = 0.02 * (1 - 0.3 * (k % 3) / 2)
        hp.tube("barnacle", [b, b + Vector((0, 0, sz * 1.2))], [sz, sz * 0.5], seg=8)

    # the harpoon-glaive in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.3 * s, o + d * 0.9 * s], 0.024, seg=10)
    f.ellipsoid("bronze", o - d * 0.31 * s, P.rr(R, 0.03), seg=(10, 8))
    sock = o + d * 0.9 * s
    f.tube("bronze", [sock - d * 0.06 * s, sock + d * 0.04 * s], [0.032, 0.026], seg=10)
    PB.blade(f, "bronze", sock + d * 0.03 * s, d, side, 0.42 * s, 0.13, thick=0.022, tip=0.3, waist=(0.35, 1.15), root=0.05)
    for sg in (1, -1):
        b = sock + d * 0.1 * s + side * 0.05 * sg
        f.tube("bronze", [b, b + side * 0.06 * sg - d * 0.07 * s], [0.012, 0.002], seg=6)
    f.torus("gold", sock - d * 0.08 * s, 0.03, 0.008, normal=d, seg=(14, 5))
    return R
