"""The Charm-Pedlar (one of the Wood's two traders): he walks the wood's moving paths with a frame of carved charms
that the wood lets pass. A broad bald man with a dark beard. A long moss green coat to the knee with a gold edge, open
over a cream shirt and a bark waistcoat, bark trousers, black boots with gold cuffs. On his back a tall frame of dark wood
rising over his head, hung with carved discs of bone and gold, and one charm of amber that glows: his one light. In the
LEFT hand a walking staff topped with a gold acorn (hold: torch). Signature shape: the frame over his head."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_charm", sex="m", height=1.0, width=1.12, depth=1.1, skin="#9c6a4a")
    z = R.z
    R.mat("moss", "#2f4520", rough=0.72, double=True)
    R.mat("cream", "#ddd2b2", rough=0.8, double=True)
    R.mat("bark", "#5a3a22", rough=0.66, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.5, double=True)
    R.mat("wood", "#3a2618", rough=0.7)
    R.mat("bone", "#e2d8bc", rough=0.5)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffd890", rough=0.3, emit="#ffb03a", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#2e2018", beard="Hair_Beard")

    # the long coat open over a waistcoat and shirt; trousers, boots
    R.fitted("Coat", ["clavicle", "upperarm", "lowerarm"], "moss", offset=0.012)
    R.fitted("Coat2", ["spine", "pelvis"], "moss", offset=0.016, where=PB.open_front(R, top=0.08, bottom=0.07))
    R.fitted("Vest", ["spine", "pelvis"], "bark", offset=0.009)
    R.cuffs("gold", at=(0.92,), offset=0.014, thick=0.008)
    for n in "lr":
        P.sleeve(R, n, "moss", t0=0.7, t1=0.95, r0=0.016, r1=0.05, rim="gold", rim_r=0.006, seg=14, n=2)
    P.collar(R, "cream", height=0.05, grow=1.0, flare=0.05)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "bark", offset=0.004)
    R.boots("lacquer", top=z["knee"] - 0.05, cuff="gold")
    P.toes(R, "lacquer")
    f, rings = P.skirt(R, "moss", z["knee"] - 0.03, flare=1.45, depth=1.12, arc=(0.42, 2 * PI - 0.42), folds=7, amp=0.016, trim="gold", trim_h=0.02, grow=1.05, seg=48)
    up = R.piece(P.trunk_w(R))
    for s in (1, -1):
        P.band_on(R, up, "gold", [(z["waist"] - 0.07, 0.4 * s), (z["chest"] + 0.02, 0.32 * s), (z["neck"] - 0.04, 0.6 * s)], 0.008, thick=0.005, off=0.022)
    R.band("lacquer", z["waist"], height=0.05, grow=1.16)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.22, z["waist"])), (0.032, 0.012, 0.028), seg=(12, 8))

    # the frame on his back: two uprights from the hips to over his head, three crossbars, carved charms hanging
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    y = cc.y + ryc + 0.08
    lo, hi = z["hip"] - 0.05, z["top"] + 0.36
    for sx in (1, -1):
        bf.tube("wood", [Vector((0.17 * sx, y, lo)), Vector((0.15 * sx, y + 0.01, hi))], 0.016, seg=8)
        bf.ellipsoid("gold", Vector((0.15 * sx, y + 0.01, hi + 0.02)), (0.024, 0.024, 0.024), seg=(10, 8))
    bars = (z["waist"] + 0.02, z["chest"] + 0.12, z["top"] + 0.1, hi - 0.03)
    for zz in bars:
        bf.tube("wood", [Vector((-0.2, y, zz)), Vector((0.2, y, zz))], 0.012, seg=8)
    K.shoulder_straps(R, bf, "lacquer", cc.y + ryc + 0.03)
    k = 0
    for zz in bars[1:]:
        for i in range(5):
            x = -0.16 + 0.08 * i
            ln = 0.05 + 0.03 * ((k * 2) % 3)
            p = Vector((x, y - 0.002, zz - 0.012))
            bf.tube("gold", [p, p + Vector((0, 0, -ln))], 0.003, seg=4)
            c = p + Vector((0, 0, -ln - 0.03))
            key = "glow" if k == 6 else ("bone" if k % 2 else "gold")
            if k % 3 == 2:
                bf.torus(key, c, 0.026, 0.008, normal=(0, 1, 0), seg=(14, 5))
            else:
                bf.ellipsoid(key, c, (0.03, 0.008, 0.03), seg=(14, 6))
            k += 1

    # the walking staff with a gold acorn
    h = K.hand(R)
    top = K.pole(h, "wood", back=1.22, front=0.42, r=0.016, rings=(0.3,))
    hf = h.f
    hf.ellipsoid("gold", top + h.d * 0.05 * h.s, P.rr(R, 0.042), seg=(14, 10))
    P.hull(hf, "bark", [top + h.d * 0.055 * h.s, top + h.d * 0.085 * h.s, top + h.d * 0.1 * h.s], [0.05, 0.046, 0.012], seg=16, side=h.fwd)
    hf.tube("bark", [top + h.d * 0.1 * h.s, top + h.d * 0.125 * h.s], 0.006, seg=5)
    return R
