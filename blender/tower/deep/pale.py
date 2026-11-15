"""The Pale One (the Deep's named enemy, walks the middle of the Deep and strikes hard): something the Deep made of a king
who went too far down. Tall and gaunt, long-armed, a smaller head, very long pale hands. Chalk-white skin, no hair, eyes
that are two cold white lights: his one glow. A crown of long pale crystals that rise from a silver circlet like antlers;
a long robe of grey-white to the floor, close at the chest, falling in long folds, a violet sash; a silver collar of
plates on his shoulders. His fingers end in long dark nails; no weapon. Signature shape: the crystal crown and the long
white hands."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
from foes import slab

LIGHT = {"faces": 10000}


def build():
    R = Real("deep_pale", sex="m", height=1.1, width=0.98, depth=0.96, head=0.84, skin="#dcdad8")
    z = R.z
    R.mat("robe", "#8e8a98", rough=0.72, double=True)
    R.mat("skin2", "#dcdad8", rough=0.6)
    R.mat("shade", "#3a3644", rough=0.8, double=True)
    R.mat("violet", "#3a2a5a", rough=0.6, double=True)
    R.mat("silver", "#c8ccd8", rough=0.28, metal=0.85, double=True)
    R.mat("crystal", "#dceaf0", rough=0.1, metal=0.1)
    R.mat("nail", "#1a1820", rough=0.4)
    R.mat("glow", "#ffffff", rough=0.2, emit="#e6fff6", strength=1.3)
    R.bald()
    PB.arms(R, length=1.12)
    PB.big_hands(R, 1.55)
    z = R.z

    # a bare chalk head: a smooth skull, the two eye lights
    h = P.head(R)
    hp = R.piece("Head")
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002)), (0.014, 0.006, 0.008), seg=(10, 6))

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "robe", offset=0.008)
    R.fitted("Under", ["thigh", "calf", "foot", "ball"], "shade", offset=0.005)
    for n in "lr":
        P.sleeve(R, n, "robe", t0=0.55, t1=0.98, r0=0.01, r1=0.075, seg=14, n=4)
    hem = z["ankle"] - 0.03
    P.skirt(R, "robe", hem, flare=1.6, depth=1.12, folds=14, amp=0.035, seg=56)
    how = R.hang_w(z["waist"], hem)
    R.band("violet", z["waist"], height=0.05, grow=1.12, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for dx in (-0.03, 0.03):
        g.tube("violet", [Vector((dx, cw.y - ryw * 1.15, z["waist"] - 0.02)), Vector((dx * 1.4, cw.y - ryw * 1.25, z["waist"] - 0.45))], [0.025, 0.018], seg=6, squash=((0, 1, 0), 0.3))
    # the silver collar of plates on the shoulders
    cf = R.piece("spine_03")
    for row in range(2):
        for k in range(12):
            a = -PI + 2 * PI * (k + 0.5 * row) / 12
            p, out = P.on_trunk(R, z["chest"] + 0.1 - 0.05 * row, a, off=0.02 + 0.008 * row)
            slab(cf, "silver", p, out, 0.055, 0.04, 0.008, tilt=0.6, seg=(10, 5))

    # the crown: a silver circlet and long pale crystals rising from it like antlers
    zc = h.c.z + h.rz * 0.45
    ring = [Vector((h.rx * 1.05 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 26 for k in range(27)]]
    hp.tube("silver", ring, 0.01, seg=6)
    for k in range(7):
        a = -1.3 + 2.6 * k / 6
        base = Vector((h.rx * 1.05 * math.sin(a), h.c.y - h.ry * 1.0 * math.cos(a), zc))
        out = Vector((math.sin(a), -math.cos(a) * 0.3, 0))
        ln = 0.2 + 0.12 * math.cos(a) ** 2
        tip = base + out * ln * 0.45 + Vector((0, 0.04, ln))
        PB.shard(hp, "crystal", base, tip, 0.022 if k % 2 else 0.016, n=6)

    # long dark nails on the fingers
    for side in "lr":
        for fn in ("index", "middle", "ring", "pinky", "thumb"):
            b3 = f"{fn}_03_{side}"
            if b3 not in R.rig.data.bones:
                continue
            tipp = R.bone(b3)
            prev = R.bone(f"{fn}_02_{side}")
            dv = (tipp - prev).normalized()
            R.piece(b3).tube("nail", [tipp, tipp + dv * 0.05, tipp + dv * 0.075 - Vector((0, 0, 0.015))], [0.007, 0.005, 0.001], seg=5)
    return R
