"""The Hollow Oak (the Wood's big enemy, named: walks the old road and strikes hard): a warden the wood grew round a man
long ago, now more oak than man. Built as a giant: tall, very broad, a small head. Dark bark-brown skin under a coat of
bark plates from neck to knee, split at the front like old bark and rimmed in gold; a mask of pale heartwood over the face,
its two eye holes lit amber from within: his one light. Two short broken branches rise from his shoulders, moss and pale
lichen on them; roots hang from his forearms. In the RIGHT hand a great club cut from an oak bough, a gold band at the
grip. Signature shape: the heartwood mask and the shoulder branches."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
from foes import rot, slab

LIGHT = {"faces": 10000}


def build():
    R = Real("wood_oak", sex="m", height=1.06, width=1.4, depth=1.36, head=0.78, skin="#5a4634")
    z = R.z
    R.mat("bark", "#2e2219", rough=0.85, double=True)
    R.mat("barkp", "#4a3828", rough=0.8, double=True)
    R.mat("heart", "#d8c49a", rough=0.6)
    R.mat("moss", "#4a6428", rough=0.95)
    R.mat("lichen", "#a8b48a", rough=0.9)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("glow", "#ffd890", rough=0.3, emit="#ffa020", strength=1.2)
    R.faceless()
    PB.big_hands(R, 1.35)
    z = R.z

    # the bark coat: fitted to the knee, a long split skirt of plates, gold rims down the split
    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm"], "bark", offset=0.01)
    R.fitted("Legs", ["thigh", "calf", "foot", "ball"], "bark", offset=0.006)
    hem = z["knee"] - 0.12
    gap = 0.22
    f, rings = P.skirt(R, "barkp", hem, flare=1.45, depth=1.15, arc=(gap, 2 * PI - gap), folds=12, amp=0.03, seg=56, trim="gold", trim_h=0.02)
    for s in (1, -1):
        P.seam(f, "gold", rings, gap * s, r=0.01, off=0.01)
    # a long tabard of dark bark down the front, in the coat's split
    P.cloth(f, "bark", rings, arc=(-gap - 0.06, gap + 0.06), seg=6, rows=10, off=-0.004)
    cc, rxc, ryc = R.ring(z["chest"])
    up = R.piece(P.trunk_w(R, hem))
    # bark plates on the chest and back: long flat lozenges in rows, slightly proud
    for row in range(4):
        zz = z["waist"] + 0.04 + row * 0.08
        for k in range(12):
            a = -PI + 2 * PI * (k + 0.5 * (row % 2)) / 12
            p, out = P.on_trunk(R, zz, a, off=0.012)
            slab(up, "barkp", p, out, 0.05, 0.05, 0.012, tilt=0.15)
    R.band("gold", z["waist"] - 0.02, height=0.04, grow=1.16, how=R.hang_w(z["waist"], hem))

    # the heartwood mask over the face, lit eye holes; bark round the skull
    h = P.head(R)
    hp = R.piece("Head")
    hp.ellipsoid("bark", h.c + Vector((0, 0.01, 0.0)), (h.rx * 1.12, h.ry * 1.1, h.rz * 1.16), seg=(18, 12))
    mc = Vector((0, h.y0 - 0.006, h.eye - 0.005))
    hp.ellipsoid("heart", mc, (h.rx * 0.74, 0.026, 0.085), seg=(16, 10))
    # bark ridges down the brow and the cheeks, framing the mask
    for s2 in (1, -1):
        hp.tube("barkp", [mc + Vector((0.05 * s2, -0.01, 0.1)), mc + Vector((0.065 * s2, -0.012, 0.0)), mc + Vector((0.045 * s2, -0.006, -0.09))], [0.012, 0.014, 0.008], seg=7)
    for s in (1, -1):
        e = mc + Vector((0.03 * s, -0.02, 0.014))
        hp.ellipsoid("bark", e, (0.02, 0.01, 0.008), seg=(10, 6))
        hp.ellipsoid("glow", e + Vector((0, -0.004, 0)), (0.013, 0.007, 0.004), seg=(8, 6))
    hp.tube("bark", [mc + Vector((0, -0.028, -0.045)), mc + Vector((0, -0.03, -0.08))], [0.01, 0.004], seg=6)

    # the shoulder branches: short broken boughs, forking once, moss and lichen on them
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        bf = R.piece(f"clavicle_{n}")
        b0 = sh + Vector((-0.03 * s, 0.05, 0.08))
        b1 = b0 + Vector((0.06 * s, 0.05, 0.22))
        b2 = b1 + Vector((0.08 * s, 0.02, 0.16))
        bf.tube("bark", [b0, b1, b2], [0.045, 0.032, 0.02], seg=10)
        b3 = b1 + Vector((-0.07 * s, 0.04, 0.12))
        bf.tube("bark", [b1, b3], [0.026, 0.012], seg=8)
        bf.ellipsoid("heart", b2 + Vector((0.01 * s, 0, 0.012)), (0.02, 0.02, 0.012), seg=(10, 6))
        bf.ellipsoid("moss", b0 + Vector((0, 0, 0.05)), (0.07, 0.07, 0.035), seg=(12, 6))
        bf.ellipsoid("lichen", b1 + Vector((0.01 * s, -0.01, -0.03)), (0.03, 0.03, 0.015), seg=(10, 6))
        # bark bracers and hanging roots on the forearms
        R.fitted(f"Bracer_{n}", lambda i, n=n: R.dom[i] == f"lowerarm_{n}", "barkp", offset=0.012)
        c, r = R.arm_r(n, 0.5)
        lf = R.piece(f"lowerarm_{n}")
        for k in range(3):
            q = c + Vector((0.06 * (k - 1) * s, 0, -r - 0.005))
            lf.tube("bark", [q, q + Vector((0.01, 0, -0.07)), q + Vector((0.015 * s, 0.01, -0.14 - 0.03 * k))], [0.012, 0.008, 0.002], seg=6)

    # the club from an oak bough in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    pts = [o - d * 0.12 * s, o + d * 0.2 * s, o + d * 0.45 * s + upv * 0.02, o + d * 0.66 * s + upv * 0.03]
    f.tube("barkp", pts, [0.035, 0.04, 0.06, 0.075], seg=12)
    f.ellipsoid("barkp", pts[-1] + d * 0.02 * s, (0.085, 0.085, 0.085), seg=(14, 10))
    f.tube("bark", [pts[2] + side * 0.05, pts[2] + side * 0.12 + upv * 0.05], [0.02, 0.006], seg=6)
    f.tube("gold", [o - d * 0.04 * s, o + d * 0.04 * s], 0.042, seg=12)
    f.ellipsoid("moss", pts[-1] + upv * 0.06, (0.05, 0.04, 0.03), seg=(10, 6))
    return R
