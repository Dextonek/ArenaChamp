"""The Red Jackal (the Sands' third ruler, a boss drawn about 2.4 to 2.6 times a hero's size: the Glass Serpent, the Sand
Tyrant, the Red Jackal): the wadi's hunter-judge with a jackal's head. Built as a giant: broad, deep, big hands, the body a
man's and the head a jackal's: a long black muzzle, tall pointed ears lined in gold, eyes of turquoise glass, his one light.
A broad collar of gold and red, gold bands on bare dark-red arms; a kilt of red-ochre pleats to the knee under a gold belt
with a long panel in front; a short black cape; gold greaves. In the RIGHT hand a long spear with a blade of green desert
glass, gold-bound. Signature shape: the tall ears and the glass spear."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("sands_jackal", sex="m", height=1.06, width=1.26, depth=1.22, head=0.86, skin="#6a2a20")
    z = R.z
    R.mat("black", "#141218", rough=0.45, double=True)
    R.mat("ochre", "#8a3a22", rough=0.66, double=True)
    R.mat("red", "#a02a20", rough=0.6, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("glass", "#6ac89a", rough=0.08, metal=0.1)
    R.mat("wood", "#1a120c", rough=0.6)
    R.mat("glow", "#a8fff0", rough=0.2, emit="#3fd4c8", strength=1.3)
    R.faceless()
    PB.big_hands(R, 1.3)
    z = R.z

    R.fitted("Legs", ["thigh", "calf"], "black", offset=0.004, below=z["knee"] + 0.04)
    R.boots("black", top=z["ankle"] + 0.06, toe="gold")
    for n in "lr":
        R.fitted(f"Greave_{n}", lambda i, n=n: R.dom[i] == f"calf_{n}" and R.world[i].y < R.bone(f"calf_{n}").y and z["ankle"] + 0.06 < R.world[i].z < z["knee"] - 0.02, "gold", offset=0.012)
    R.cuffs("gold", at=(0.1, 0.5, 0.9), offset=0.008, thick=0.012)
    hem = z["knee"] - 0.02
    f, rings = P.skirt(R, "ochre", hem, flare=1.4, depth=1.12, folds=18, amp=0.012, seg=60, trim="gold", trim_h=0.02)
    P.cloth(f, "gold", rings, arc=(-0.22, 0.22), seg=6, rows=8, off=0.012, z1=z["waist"])
    R.band("gold", z["waist"] - 0.02, height=0.07, grow=1.16, how=R.hang_w(z["waist"], hem))
    # the broad collar of gold and red, a short black cape
    cf = R.piece("spine_03")
    for row in range(5):
        zz = z["chest"] + 0.13 - row * 0.035
        n = 18 + row * 2
        for k in range(n):
            a = -PI * 0.65 + PI * 1.3 * k / (n - 1)
            p, out = P.on_trunk(R, zz, a, off=0.016 + 0.004 * row)
            cf.ellipsoid("gold" if row % 2 == 0 else "red", p, (0.017, 0.01, 0.015), seg=(8, 5))
    PA.cloak(R, "black", hem=z["hip"] - 0.05, width=0.36, depth=0.85, spread=1.3, top_spread=1.7, trim="gold", nu=14, nv=8)

    # the jackal head: a long muzzle, tall ears lined in gold, glass eyes
    h = P.head(R)
    hp = R.piece("Head")
    hp.ellipsoid("black", h.c + Vector((0, 0.01, -0.01)), (h.rx * 1.08, h.ry * 1.05, h.rz * 1.05), seg=(18, 12))
    snout = [Vector((0, h.y0 + 0.03, h.eye - 0.04)), Vector((0, h.y0 - 0.06, h.eye - 0.06)), Vector((0, h.y0 - 0.15, h.eye - 0.085))]
    hp.tube("black", snout, [0.075, 0.05, 0.025], seg=12, squash=((1, 0, 0), 0.8))
    hp.ellipsoid("black", snout[-1] + Vector((0, -0.005, 0.0)), (0.022, 0.02, 0.018), seg=(10, 6))
    hp.tube("black", [Vector((0, h.y0 + 0.0, h.eye - 0.1)), Vector((0, h.y0 - 0.11, h.eye - 0.11))], [0.045, 0.02], seg=10)
    for s in (1, -1):
        e = Vector((0.04 * s, h.y0 - 0.01, h.eye - 0.005))
        hp.ellipsoid("glow", e, (0.016, 0.01, 0.009), seg=(10, 6))
        hp.tube("gold", [e + Vector((0.008 * s, 0.0, 0.0)), e + Vector((0.05 * s, 0.03, 0.005))], 0.004, seg=5)
        base = Vector((h.rx * 0.6 * s, h.c.y + 0.01, h.c.z + h.rz * 0.7))
        tip = base + Vector((0.04 * s, 0.02, 0.22))
        PA.blade(hp, "black", base, tip, 0.06, (0, 1, 0), thick=0.25, belly=0.3, root=0.9)
        PA.blade(hp, "gold", base + Vector((0, -0.012, 0.01)), base.lerp(tip, 0.85) + Vector((0, -0.012, 0)), 0.035, (0, 1, 0), thick=0.25, belly=0.3, root=0.9)
    # a gold band and a red-and-gold headcloth falling behind
    ring = [Vector((h.rx * 1.1 * math.sin(a), h.c.y - h.ry * 1.08 * math.cos(a), h.c.z + h.rz * 0.25)) for a in [-PI + 2 * PI * k / 24 for k in range(25)]]
    hp.tube("gold", ring, 0.01, seg=6)

    # the glass spear in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.55 * s, o + d * 0.95 * s], 0.022, seg=10)
    f.ellipsoid("gold", o - d * 0.56 * s, P.rr(R, 0.028), seg=(10, 8))
    sock = o + d * 0.95 * s
    f.tube("gold", [sock - d * 0.08 * s, sock + d * 0.04 * s], [0.028, 0.024], seg=10)
    PB.blade(f, "glass", sock + d * 0.03 * s, d, side, 0.4 * s, 0.1, thick=0.03, tip=0.35, waist=(0.3, 1.1), root=0.04)
    for t in (-0.2, 0.3, 0.75):
        f.torus("gold", o + d * t * s, 0.028, 0.007, normal=d, seg=(14, 5))
    return R
