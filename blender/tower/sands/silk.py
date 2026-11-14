"""The Silk-Merchant (one of the Sands' two traders): the master of the last caravan, who sells from its bales the road
has not taken. A broad man with a dark beard, a tall terracotta felt hat with a gold band. A long coat of cream and
turquoise stripes to the ankle with a gold-edged collar, a wide saffron sash, black boots with turned-up toes. Two rolled
carpets, terracotta and turquoise, strapped across his back. In the LEFT hand, held up, a tall brass coffee pot with a
long beak, a glowing coal under it in a little brazier hung from its handle: his one light (hold: torch). Signature
shape: the tall hat and the carpets across his back."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("sands_silk", sex="m", height=1.0, width=1.14, depth=1.12, skin="#9a6440")
    z = R.z
    R.mat("cream", "#e2d6b8", rough=0.78, double=True)
    R.mat("turq", "#1f7a76", rough=0.62, double=True)
    R.mat("terra", "#9a4a28", rough=0.7, double=True)
    R.mat("saffron", "#d0901e", rough=0.62, double=True)
    R.mat("black", "#1d1b21", rough=0.5, double=True)
    R.mat("brass", "#c9a24a", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#ffcf80", rough=0.4, emit="#ff9a30", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#1a1210", beard="Hair_Beard")

    # the striped coat to the ankle, a saffron sash
    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.01)
    R.fitted("Legs", ["thigh", "calf"], "black", offset=0.004)
    R.boots("black", top=z["ankle"] + 0.08)
    P.toes(R, "black", size=1.05)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.5, t1=0.96, r0=0.012, r1=0.055, rim="brass", rim_r=0.006, seg=14, n=3)
    hem = z["ankle"] + 0.05
    f, rings = P.skirt(R, "cream", hem, flare=1.5, depth=1.12, folds=8, amp=0.016, trim="turq", trim_h=0.05, seg=56)
    for a in [2 * PI * k / 14 for k in range(14)]:
        P.seam(f, "turq", rings, a, r=0.012, off=0.01, squash=((0, 0, 1), 1.0))
    up = R.piece(P.trunk_w(R))
    for a in (-1.2, -0.6, 0.6, 1.2, PI - 0.5, PI + 0.5):
        P.band_on(R, up, "turq", [(z["waist"] - 0.05, a), (z["chest"] + 0.06, a)], 0.014, thick=0.004, off=0.016)
    R.band("saffron", z["waist"], height=0.1, grow=1.17)
    P.collar(R, "turq", height=0.06, grow=1.05, flare=0.1, rim="brass", rim_r=0.006)

    # the tall felt hat
    hd = P.head(R)
    hp = R.piece("Head")
    b = Vector((0, hd.c.y + 0.01, hd.brow + 0.02))
    P.hull(hp, "terra", [b, b + Vector((0, 0.005, 0.07)), b + Vector((0, 0.01, 0.14))], [hd.rx * 1.12, hd.rx * 1.2, hd.rx * 1.32], [hd.ry * 1.15, hd.ry * 1.24, hd.ry * 1.36], seg=24, side=Vector((1, 0, 0)))
    hp.ellipsoid("turq", b + Vector((0, 0.01, 0.142)), (hd.rx * 1.3, hd.ry * 1.34, 0.012), seg=(24, 4))
    for zz in (0.025, 0.13):
        k = 1.12 + 0.2 * zz / 0.14
        P.hull(hp, "brass", [b + Vector((0, 0.005 * zz / 0.07, zz - 0.012)), b + Vector((0, 0.005 * zz / 0.07, zz + 0.012))], [hd.rx * k + 0.006] * 2,
               [hd.ry * (k + 0.03) + 0.006] * 2, seg=24, side=Vector((1, 0, 0)), caps=False)

    # two rolled carpets across his back
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    for k, (key, zz, ln) in enumerate((("terra", z["chest"] - 0.02, 0.36), ("turq", z["chest"] - 0.2, 0.32))):
        c = Vector((0, cc.y + ryc + 0.09 + 0.01 * k, zz))
        bf.tube(key, [c - Vector((ln, 0, -0.03 * (1 - 2 * k))), c + Vector((ln, 0, 0.03 * (1 - 2 * k)))], 0.075, seg=16)
        for s in (-1, 1):
            e = c + Vector((ln * s, 0, 0.03 * (1 - 2 * k) * s))
            bf.torus("cream", e - Vector((0.012 * s, 0, 0)), 0.06, 0.008, normal=(1, 0, 0), seg=(18, 5))
            bf.torus("brass", c + Vector((ln * 0.6 * s, 0, 0.018 * (1 - 2 * k) * s)), 0.078, 0.008, normal=(1, 0, 0), seg=(20, 5))
    K.shoulder_straps(R, bf, "black", cc.y + ryc + 0.03)

    # the brass pot, held by its handle
    h = K.hand(R)
    hf = h.f
    hf.tube("brass", [K.at(h, 0.05, fwd=-0.03), K.at(h, 0.08, fwd=0.02), K.at(h, 0.02, fwd=0.07), K.at(h, -0.12, fwd=0.07)], 0.008, seg=6)
    body = [K.at(h, -0.3, fwd=0.11), K.at(h, -0.24, fwd=0.11), K.at(h, -0.14, fwd=0.11), K.at(h, -0.06, fwd=0.11), K.at(h, 0.0, fwd=0.11), K.at(h, 0.06, fwd=0.11)]
    P.hull(hf, "brass", body, [0.055, 0.075, 0.06, 0.035, 0.04, 0.012], seg=18, side=h.side)
    hf.tube("brass", [K.at(h, -0.2, fwd=0.17), K.at(h, -0.08, fwd=0.24), K.at(h, 0.03, fwd=0.3)], [0.018, 0.01, 0.006], seg=8)
    hf.ellipsoid("brass", K.at(h, 0.075, fwd=0.11), P.rr(R, 0.014), seg=(8, 6))
    hf.ellipsoid("glow", K.at(h, -0.35, fwd=0.11), P.rr(R, 0.03), seg=(10, 8))
    for a in range(3):
        u = h.fwd * math.cos(2 * PI * a / 3) + h.side * math.sin(2 * PI * a / 3)
        hf.tube("brass", [K.at(h, -0.3, fwd=0.11) + u * 0.05, K.at(h, -0.38, fwd=0.11) + u * 0.035], 0.004, seg=4)
    return R
