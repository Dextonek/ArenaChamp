"""The Brass Sphinx (the Sands' second ruler, a boss drawn about 2.4 to 2.7 times a hero's size: the Brass Sphinx, the
Mirage Lord, the Sun-Eater): the riddle-keeper of the wadi, a lion that stands as a man. Built as a giant: broad, deep, a
smaller head, big hands. His face is a calm brass mask of a lion, framed by a great mane of dark gold that falls over his
shoulders; a sun disc of brass rays stands behind his head. A long robe of white and saffron to the floor, open in front
over terracotta, a broad collar of gold and turquoise rows on his chest, gold bands on bare bronze forearms; tall
sandals. In the RIGHT hand a sun-glaive: a long gold haft and a crescent blade round a sun stone that glows: his one
light. Signature shape: the mane and the ray disc."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("sands_sphinx", sex="m", height=1.04, width=1.32, depth=1.28, head=0.84, skin="#8a5a38")
    z = R.z
    R.mat("white", "#ece4d0", rough=0.72, double=True)
    R.mat("saffron", "#d89a2a", rough=0.66, double=True)
    R.mat("terra", "#a0482c", rough=0.7, double=True)
    R.mat("mane", "#5a3a14", rough=0.85, double=True)
    R.mat("brass", "#c8a050", rough=0.28, metal=0.9, double=True)
    R.mat("turq", "#2a9a90", rough=0.45)
    R.mat("dark", "#1a120c", rough=0.6)
    R.mat("glow", "#fff6dc", rough=0.2, emit="#ffd27a", strength=1.3)
    R.faceless()
    PB.big_hands(R, 1.3)
    z = R.z

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm"], "white", offset=0.01)
    R.fitted("Under", ["thigh", "calf"], "terra", offset=0.005)
    R.boots("dark", top=z["ankle"] + 0.05, toe="brass")
    R.cuffs("brass", at=(0.15, 0.45, 0.85), offset=0.008, thick=0.01)
    hem = z["ankle"] + 0.02
    gap = 0.4
    f, rings = P.skirt(R, "white", hem, flare=1.65, depth=1.15, arc=(gap, 2 * PI - gap), folds=10, amp=0.025, seg=56, trim="saffron", trim_h=0.06)
    P.cloth(f, "terra", rings, arc=(-gap - 0.1, gap + 0.1), seg=10, rows=10, off=-0.008)
    for sg in (1, -1):
        P.seam(f, "saffron", rings, gap * sg, r=0.014, off=0.008)
    R.band("saffron", z["waist"], height=0.08, grow=1.14, how=R.hang_w(z["waist"], hem))
    # the broad collar: rows of gold and turquoise beads
    cf = R.piece("spine_03")
    for row in range(4):
        zz = z["chest"] + 0.12 - row * 0.035
        n = 18 + row * 2
        for k in range(n):
            a = -PI * 0.62 + PI * 1.24 * k / (n - 1)
            p, out = P.on_trunk(R, zz, a, off=0.016 + 0.004 * row)
            cf.ellipsoid("turq" if row % 2 else "brass", p, (0.016, 0.01, 0.014), seg=(8, 5))

    # the mane over the head and shoulders, the lion mask, the ray disc behind
    h = P.head(R)
    hp = R.piece("Head")
    mw = R.piece(P.head_spine_w(R, h.base, z["chest"]))
    for k in range(26):
        a = -PI * 0.78 + PI * 1.56 * k / 25 + PI
        r0 = Vector((h.rx * 1.05 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), h.c.z + h.rz * 0.6))
        out = Vector((math.sin(a), -math.cos(a), 0))
        ln = 0.26 + 0.06 * math.cos(a * 3) ** 2
        pts = [r0, r0 + out * 0.07 + Vector((0, 0, -ln * 0.4)), r0 + out * 0.11 + Vector((0, 0.02, -ln))]
        PA.blade(mw, "mane", pts[0], pts[-1], 0.065, Vector((0, 0, 1)).cross(out), thick=0.35, belly=0.3, root=0.8, bend=out * 0.07)
    hp.ellipsoid("mane", h.c + Vector((0, 0.02, 0.02)), (h.rx * 1.3, h.ry * 1.25, h.rz * 1.2), seg=(18, 10))
    mc = Vector((0, h.y0 - 0.04, h.eye - 0.02))
    # a calm brass face: a smooth oval, a long straight nose ridge, narrow eyes, a small closed mouth
    hp.ellipsoid("brass", mc, (h.rx * 0.86, 0.045, 0.125), seg=(18, 12))
    hp.tube("brass", [mc + Vector((0, -0.04, 0.035)), mc + Vector((0, -0.05, -0.03))], [0.012, 0.018], seg=8)
    hp.tube("dark", [mc + Vector((-0.018, -0.04, -0.065)), mc + Vector((0.018, -0.04, -0.065))], 0.004, seg=5)
    for s in (1, -1):
        hp.tube("dark", [mc + Vector((0.018 * s, -0.04, 0.04)), mc + Vector((0.05 * s, -0.034, 0.045))], 0.006, seg=5)
    disc = h.c + Vector((0, h.ry * 1.5, h.rz * 0.4))
    for k in range(16):
        a = 2 * PI * k / 16
        dv = Vector((math.sin(a), 0, math.cos(a)))
        ln = 0.22 if k % 2 == 0 else 0.15
        PA.blade(hp, "brass", disc + dv * 0.12, disc + dv * (0.12 + ln), 0.025, (0, 1, 0), thick=0.25, belly=0.3, root=0.8)
    hp.torus("brass", disc, 0.12, 0.012, normal=(0, 1, 0), seg=(28, 6))

    # the sun-glaive in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("brass", [o - d * 0.55 * s, o + d * 0.85 * s], 0.02, seg=10)
    f.ellipsoid("brass", o - d * 0.56 * s, P.rr(R, 0.028), seg=(10, 8))
    hub = o + d * 0.92 * s
    f.ellipsoid("glow", hub, P.rr(R, 0.04), seg=(14, 10))
    arc = [hub + (d * math.cos(a) + upv * math.sin(a)) * 0.13 for a in [-PI * 0.75 + PI * 1.5 * k / 14 for k in range(15)]]
    f.tube("brass", arc, [0.006, 0.02, 0.03, 0.036, 0.04, 0.042, 0.042, 0.042, 0.042, 0.042, 0.04, 0.036, 0.03, 0.02, 0.006], seg=6, squash=(tuple(side), 0.15))
    f.torus("turq", o + d * 0.78 * s, 0.026, 0.008, normal=d, seg=(14, 5))
    return R
