"""The Tide-Broker (the Sea's trader): she weighs what the tide gives back and sells it to climbers. Dark-skinned,
long black hair under a gold circlet, a rope of pearls. A cream blouse with full sleeves gathered in gold cuffs, a black
lacquer bodice laced in gold, a long skirt of the harbour's wine falling in folds with a gold hem, an overskirt of
lacquer open at the front, a strongbox of lacquer with gold corners strapped on her back. In the LEFT hand a brass
balance held up by its top ring, its two pans on fine chains, a glowing pearl in one: her one light (hold: torch).
Signature shape: the balance."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P


def build():
    R = Real("sea_trader", sex="f", height=0.99, width=0.98, depth=0.98, skin="#8a5a3e")
    z = R.z
    R.mat("cream", "#e6dcc4", rough=0.75, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.45, double=True)
    R.mat("wine", "#6a1c2c", rough=0.62, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("pearl", "#eef0ea", rough=0.25)
    R.mat("glow", "#f2fcff", rough=0.2, emit="#9fe6ff", strength=1.0)
    R.hair("Hair_Long", "#17110e", rough=0.5)

    # the blouse with full sleeves, the laced bodice
    R.fitted("Blouse", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.15, t1=0.9, r0=0.02, r1=0.07, bones=("upperarm", "lowerarm"), seg=16, n=4)
        P.sleeve(R, n, "cream", t0=0.45, t1=0.9, r0=0.01, r1=0.05, seg=16, n=3)
    R.cuffs("gold", at=(0.9,), offset=0.012, thick=0.01)
    R.fitted("Bodice", lambda i: R.dom[i].startswith(("spine", "pelvis")) and z["waist"] - 0.07 < R.world[i].z < z["chest"] + 0.02, "lacquer", offset=0.016)
    up = R.piece(P.trunk_w(R))
    for s in (1, -1):
        P.band_on(R, up, "gold", [(z["waist"] - 0.06, 0.12 * s), (z["chest"] + 0.01, 0.2 * s)], 0.01, thick=0.006, off=0.02)
    for k in range(5):
        zz = z["waist"] - 0.04 + (z["chest"] - z["waist"] + 0.03) * k / 4
        P.band_on(R, up, "gold", [(zz, 0.13), (zz + 0.02, 0.0), (zz, -0.13)], 0.006, thick=0.005, off=0.022, n=6)
    P.band_on(R, up, "gold", [(z["chest"] + 0.02, -1.6), (z["chest"] + 0.03, 0.0), (z["chest"] + 0.02, 1.6)], 0.012, thick=0.006, off=0.02)

    # the long wine skirt, the open lacquer overskirt, a gold belt
    R.fitted("Under", ["thigh", "calf"], "wine", offset=0.004)
    R.boots("lacquer", top=z["ankle"] + 0.06)
    P.toes(R, "lacquer")
    hem = z["ankle"] + 0.02
    f, rings = P.skirt(R, "wine", hem, flare=1.65, depth=1.15, folds=10, amp=0.03, trim="gold", trim_h=0.028, seg=56)
    P.skirt(R, "lacquer", z["knee"] - 0.12, flare=1.68, depth=1.15, arc=(0.75, 2 * PI - 0.75), folds=7, amp=0.026, trim="gold", trim_h=0.02, grow=1.06, seg=44)
    how = R.hang_w(z["waist"], hem)
    R.band("gold", z["waist"] - 0.055, height=0.03, grow=1.16, how=how)

    # pearls, the circlet
    fc = R.piece("spine_03")
    ny = R.bone("neck_01").y
    cn, rxn, ryn = R.ring(z["neck"] - 0.04, dz=0.02)
    for k in range(22):
        a = -1.9 + 3.8 * k / 21
        sag = 0.05 * math.cos(a / 1.9 * PI / 2)
        p = Vector((rxn * 1.35 * math.sin(a), ny - ryn * 1.55 * math.cos(a) - 0.01, z["neck"] - 0.035 - sag))
        fc.ellipsoid("pearl", p, (0.011, 0.011, 0.011), seg=(8, 6))
    h = P.head(R)
    hp = R.piece("Head")
    cz = h.brow + 0.045
    pts = [Vector((h.rx * 1.09 * math.sin(2 * PI * i / 36), h.c.y - h.ry * 1.12 * math.cos(2 * PI * i / 36), cz + 0.012 * math.cos(2 * PI * i / 36))) for i in range(37)]
    hp.tube("gold", pts, 0.0065, seg=6, caps=False)
    hp.ellipsoid("pearl", pts[0] + Vector((0, -0.008, 0.004)), (0.011, 0.007, 0.013), seg=(8, 6))

    # the strongbox on her back, on two lacquer straps with gold buckles
    cc, rxc, ryc = R.ring(z["chest"])
    bk = R.piece(PA.spine_w(R))
    bc = Vector((0, cc.y + ryc + 0.1, z["chest"] - 0.06))
    P.box(bk, "lacquer", bc, (0.16, 0.085, 0.13))
    P.box(bk, "wine", bc + Vector((0, 0.002, 0.135)), (0.163, 0.088, 0.012))
    for sx in (1, -1):
        for sz in (1, -1):
            P.box(bk, "gold", bc + Vector((0.152 * sx, -0.0, 0.122 * sz)), (0.016, 0.092, 0.016))
    bk.ellipsoid("gold", bc + Vector((0, 0.088, 0.03)), (0.022, 0.008, 0.026), seg=(10, 6))
    for sx in (1, -1):
        bk.tube("lacquer", [Vector((0.09 * sx, cc.y + ryc + 0.02, z["chest"] + 0.07)), Vector((0.085 * sx, ny - 0.02, z["neck"] - 0.05)),
                            Vector((0.09 * sx, cc.y - ryc - 0.02, z["chest"] + 0.04))], 0.012, seg=6, squash=((0, 1, 0), 0.35))

    # the balance in the left hand: a top ring she holds, a post, a beam, two pans on chains, a glowing pearl
    s = P.along(R)
    f, o, d, upv = R.held("l")
    fwd = R.bone("hand_l") - R.bone("middle_01_l")
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    side = upv.cross(d).normalized()
    f.torus("gold", o - d * 0.02 * s, 0.03, 0.006, normal=side, seg=(14, 5))
    top = o + d * 0.24 * s
    f.tube("gold", [o + d * 0.01 * s, top], 0.009, seg=8)
    f.ellipsoid("gold", top + d * 0.012 * s, P.rr(R, 0.016), seg=(10, 8))
    beam = [top - side * 0.17, top - side * 0.08 + d * 0.012 * s, top + side * 0.08 + d * 0.012 * s, top + side * 0.17]
    f.tube("gold", beam, [0.006, 0.009, 0.009, 0.006], seg=8)
    for k, end in enumerate((beam[0], beam[-1])):
        pan = end - d * 0.17 * s
        for a in (0.0, 2 * PI / 3, 4 * PI / 3):
            rim = pan + (side * math.cos(a) + fwd * math.sin(a)) * 0.05
            f.tube("gold", [end, rim], 0.0025, seg=4)
        PA.grid(f, "gold", lambda u, v, pan=pan: pan + (side * math.cos(2 * PI * u) + fwd * math.sin(2 * PI * u)) * 0.055 * v - d * 0.022 * s * (1 - v * v), 18, 3, close=True)
        f.torus("gold", pan, 0.055, 0.004, normal=d, seg=(20, 5))
        if k == 0:
            f.ellipsoid("glow", pan - d * 0.002 * s, P.rr(R, 0.022), seg=(12, 8))
    return R
