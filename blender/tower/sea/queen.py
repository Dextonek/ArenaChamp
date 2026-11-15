"""The Drowned Queen (the Sea's second ruler, a boss drawn about 2.2 to 2.5 times a hero's size: Mother of Wrecks, the
Pearl Tyrant, the Gull Queen): the queen of what the sea keeps. Built as a giantess: tall and broad-shouldered, a smaller
head, big hands. Pale blue-grey drowned skin, long black hair loose to the waist; a tall crown of branching coral in gold,
strings of pearls hanging from it at the temples. A gown of deep sea-blue to the floor, its bodice of gold scales, its
skirt open in front over sea-glass green, hung with swags of pearls; a mantle of gull-white feathers on the shoulders. In
the RIGHT hand a tall gold trident, its middle tine a long blade, a sea-glass pearl at the fork: her one light. Signature
shape: the coral crown and the trident."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
from foes import slab


def build():
    R = Real("sea_queen", sex="f", height=1.04, width=1.2, depth=1.14, head=0.86, skin="#a4b4b8", eyes="#b8eef0")
    z = R.z
    R.mat("sea", "#15304a", rough=0.6, double=True)
    R.mat("glass", "#3f8a7a", rough=0.5, double=True)
    R.mat("feather", "#e8e4da", rough=0.7, double=True)
    R.mat("coral", "#e8835e", rough=0.55)
    R.mat("pearl", "#f0ece0", rough=0.25)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.2)
    PB.big_hands(R, 1.25)
    z = R.z
    R.hair("Hair_Long", "#101418", rough=0.5)

    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "sea", offset=0.009)
    R.fitted("Bodice", ["spine_02", "spine_03"], "gold", offset=0.014, above=z["waist"], below=z["chest"] + 0.06)
    R.fitted("Under", ["thigh", "calf", "foot", "ball"], "glass", offset=0.005)
    for n in "lr":
        P.sleeve(R, n, "sea", t0=0.5, t1=0.98, r0=0.01, r1=0.07, rim="gold", rim_r=0.006, seg=14, n=4)
    hem = z["ankle"] - 0.02
    gap = 0.45
    f, rings = P.skirt(R, "sea", hem, flare=1.85, depth=1.15, arc=(gap, 2 * PI - gap), folds=12, amp=0.03, seg=60, trim="gold", trim_h=0.025)
    P.cloth(f, "glass", rings, arc=(-gap - 0.1, gap + 0.1), seg=12, rows=10, off=-0.008)
    # swags of pearls round the skirt
    for k in range(7):
        a0 = gap + (2 * PI - 2 * gap) * k / 7
        a1 = gap + (2 * PI - 2 * gap) * (k + 1) / 7
        pts = []
        for j in range(9):
            a = a0 + (a1 - a0) * j / 8
            zz = z["hip"] - 0.08 - 0.07 * math.sin(PI * j / 8)
            c, rx, ry = P.ring_at(rings, zz)
            pts.append(Vector((c.x + (rx + 0.012) * math.sin(a), c.y - (ry + 0.012) * math.cos(a), zz)))
        for p in pts:
            f.ellipsoid("pearl", p, (0.012, 0.012, 0.012), seg=(8, 6))
    R.band("gold", z["waist"] - 0.01, height=0.04, grow=1.12, how=R.hang_w(z["waist"], hem))
    # gold scales on the bodice
    bf = R.piece("spine_02")
    for row in range(4):
        zz = z["waist"] + 0.04 + row * 0.055
        for k in range(9):
            a = -1.3 + 2.6 * (k + 0.5 * (row % 2)) / 9
            p, out = P.on_trunk(R, zz, a, off=0.018)
            slab(bf, "gold", p, out, 0.024, 0.03, 0.006, tilt=0.2, seg=(8, 5))

    # the feather mantle on the shoulders
    mf = R.piece("spine_03")
    for row in range(3):
        zz = z["chest"] + 0.1 - row * 0.05
        for k in range(20):
            a = -PI + 2 * PI * (k + 0.5 * (row % 2)) / 20
            if abs(a) < 0.5:
                continue
            p, out = P.on_trunk(R, zz, a, off=0.03 + 0.008 * row)
            PA.blade(mf, "feather", p + Vector((0, 0, 0.03)), p + out * 0.06 + Vector((0, 0, -0.1)), 0.03, Vector((0, 0, 1)).cross(out), thick=0.15, belly=0.45, root=0.5)

    # the coral crown and its pearl strings
    h = P.head(R)
    hp = R.piece("Head")
    zc = h.c.z + h.rz * 0.5
    ring = [Vector((h.rx * 1.06 * math.sin(a), h.c.y - h.ry * 1.06 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("gold", ring, 0.012, seg=6)

    def branch(p, dv, ln, r, depth):
        tip = p + dv * ln
        hp.tube("coral", [p, p + dv * ln * 0.55, tip], [r, r * 0.85, r * 0.7], seg=7)
        if depth == 0:
            hp.ellipsoid("coral", tip, (r * 0.8,) * 3, seg=(8, 6))
            return
        side = dv.cross(Vector((0.3, 0.6, 0.1))).normalized()
        for sgn in (1, -1):
            branch(tip, (dv + side * 0.7 * sgn).normalized(), ln * 0.62, r * 0.72, depth - 1)
    for k in range(5):
        a = -0.9 + 1.8 * k / 4
        base = Vector((h.rx * 1.06 * math.sin(a), h.c.y - h.ry * 1.06 * math.cos(a), zc + 0.005))
        dv = Vector((math.sin(a) * 0.35, -math.cos(a) * 0.15, 1.0)).normalized()
        branch(base, dv, 0.09 + 0.04 * math.cos(a), 0.012, 2)
    for s in (1, -1):
        t = Vector((h.rx * 1.06 * s, h.c.y, zc))
        for k in range(6):
            hp.ellipsoid("pearl", t + Vector((0.005 * s, 0, -0.025 * k)), (0.009, 0.009, 0.009), seg=(8, 6))

    # the trident in the right hand: a gold haft, the fork, the middle tine a long blade, a glowing pearl at the fork
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("gold", [o - d * 0.55 * s, o + d * 0.95 * s], 0.02, seg=10)
    f.ellipsoid("gold", o - d * 0.56 * s, P.rr(R, 0.028), seg=(10, 8))
    fork = o + d * 0.95 * s
    f.tube("gold", [fork - upv * 0.11 + d * 0.02, fork, fork + upv * 0.11 + d * 0.02], [0.016, 0.022, 0.016], seg=8)
    for sg in (1, -1):
        b = fork + upv * 0.11 * sg + d * 0.02
        f.tube("gold", [b, b + d * 0.12 * s, b + d * 0.2 * s - upv * 0.02 * sg], [0.014, 0.011, 0.002], seg=7)
    PB.blade(f, "gold", fork, d, side, 0.34 * s, 0.07, thick=0.02, tip=0.25)
    f.ellipsoid("glow", fork - d * 0.02, P.rr(R, 0.03), seg=(12, 8))
    for t in (0.2, 0.6):
        f.ellipsoid("coral", o + d * t * s, (0.026, 0.026, 0.026), seg=(10, 6))
    return R
