"""The Harbourmaster's Mate (the Sea's big enemy, guards the wreck; Old Barnacle shares his figure under a pale tint): the
harbourmaster's right hand, drowned with him and twice the man he was. Built heavy: broad, deep, a small head on a thick
neck, big hands. The drowned grey-green skin, a short dark beard, a navy knit cap; a short navy pea coat with two rows of
brass buttons, its collar up, over a cream jersey; dark trousers tucked into tall lacquer boots. A heavy brass chain wound
round his left forearm, its end hanging; barnacles on his right shoulder; sea-glass eyes: his one glow. In the RIGHT hand a
boarding axe with a long haft, a brass-bound head and a spike. Signature shape: the axe and the chained arm."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("sea_mate", sex="m", height=1.04, width=1.3, depth=1.28, head=0.84, skin="#8ea6a0", eyes="#b8eef0")
    z = R.z
    R.mat("navy", "#18233a", rough=0.62, double=True)
    R.mat("cream", "#d8cfb4", rough=0.8, double=True)
    R.mat("lacquer", "#141619", rough=0.45, double=True)
    R.mat("iron", "#5c626c", rough=0.48, metal=0.6)
    R.mat("brass", "#c9983c", rough=0.32, metal=0.85)
    R.mat("barnacle", "#e2dcc6", rough=0.7)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.0)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_Buzzed", "#16211f", beard="Hair_Beard")

    R.fitted("Jersey", ["spine", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.006)
    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm"], "navy", offset=0.014, above=z["hip"] - 0.1)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "lacquer", offset=0.005)
    R.boots("lacquer", top=z["knee"] + 0.02)
    hem = z["hip"] - 0.14
    f, rings = P.skirt(R, "navy", hem, flare=1.2, depth=1.1, folds=5, amp=0.01, seg=40, arc=(0.22, 2 * PI - 0.22))
    for s in (1, -1):
        for k in range(4):
            zz = z["waist"] + 0.02 + 0.08 * k
            p, _ = P.on_trunk(R, zz, 0.16 * s, off=0.024)
            R.piece("spine_02" if zz > z["waist"] + 0.1 else "pelvis").ellipsoid("brass", p, (0.014, 0.014, 0.014), seg=(8, 6))
    P.collar(R, "navy", height=0.08, grow=1.08, flare=0.08)
    R.band("lacquer", z["waist"] - 0.03, height=0.06, grow=1.16, how=R.hang_w(z["waist"], hem))

    # the knit cap, the sea-glass eyes
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "navy", h.c + Vector((0, 0.012, 0.035)), (h.rx * 1.08, h.ry * 1.08, h.rz * 1.02), lambda a: 0.42 + 0.12 * math.cos(a), seg=24, rows=6)
    ring = [Vector((h.rx * 1.06 * math.sin(a), h.c.y + 0.012 - h.ry * 1.06 * math.cos(a), h.c.z + h.rz * (0.5 + 0.12 * math.cos(a)))) for a in [-PI + 2 * PI * k / 24 for k in range(25)]]
    hp.tube("navy", ring, 0.016, seg=6)
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002)), (0.013, 0.006, 0.007), seg=(10, 6))

    # the chain wound round the left forearm, its end hanging
    lf = R.piece("lowerarm_l")
    for k in range(9):
        t = 0.15 + 0.08 * k
        c, r = R.arm_r("l", t)
        lf.torus("brass", c + Vector((0, 0, 0.0)), r + 0.02, 0.009, normal=(1, 0.3 * (1 if k % 2 else -1), 0.2), seg=(16, 5))
    cw2, rw2 = R.arm_r("l", 0.85)
    for k in range(5):
        q = cw2 + Vector((0, 0, -rw2 - 0.03 - 0.035 * k))
        lf.torus("brass", q, 0.017, 0.006, normal=(1, 0, 0) if k % 2 else (0, 1, 0), seg=(12, 5))
    # barnacles on the right shoulder
    sh = R.bone("upperarm_r")
    bf = R.piece("upperarm_r")
    for k in range(8):
        a = 2.4 * k
        p = sh + Vector((-0.05 + 0.05 * math.cos(a) * (k / 8), 0.04 * math.sin(a), 0.07))
        sz = 0.018 * (1.2 - 0.5 * k / 8)
        bf.tube("barnacle", [p, p + Vector((0, 0, sz * 1.1))], [sz, sz * 0.5], seg=8)

    # the boarding axe in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.14 * s, o + d * 0.62 * s], 0.026, seg=10)
    f.ellipsoid("brass", o - d * 0.15 * s, P.rr(R, 0.032), seg=(10, 8))
    head = o + d * 0.56 * s
    f.tube("brass", [head - d * 0.05 * s, head + d * 0.07 * s], 0.034, seg=10)
    PB.blade(f, "iron", head + upv * 0.03, upv, d, 0.17, 0.12, thick=0.02, tip=0.0)
    f.tube("iron", [head - upv * 0.03, head - upv * 0.14], [0.022, 0.002], seg=8)
    return R
