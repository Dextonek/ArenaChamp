"""The Storm-Counter (the Sands' quest giver at the camp): he keeps the count of the storms, every one, by the sand that
runs through his glass, and the caravans move by his word. A lean bearded man in a turquoise turban whose long tail falls
over his shoulder. A long cream robe to the ankles, a sleeveless terracotta over-robe to the knee with a gold edge, a
rope belt with a brass tally of knots, sandals over dark wrappings. In the LEFT hand, held up, a great hourglass in a
brass frame, its sand glowing: his one light (hold: torch). Signature shape: the turban and the hourglass."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("sands_counter", sex="m", height=1.02, width=0.97, depth=0.98, skin="#9a6440")
    z = R.z
    R.mat("cream", "#cdbf9c", rough=0.8, double=True)
    R.mat("terra", "#8e3e22", rough=0.7, double=True)
    R.mat("turq", "#1f7a76", rough=0.62, double=True)
    R.mat("wrap", "#3a2a22", rough=0.8, double=True)
    R.mat("rope", "#b89a5a", rough=0.9)
    R.mat("glass", "#d6ecec", rough=0.12)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffe0a0", rough=0.3, emit="#ffb84a", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#1a1210", beard="Hair_Beard")

    # the long robe, the open over-robe, belt, sandals
    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.5, t1=0.97, r0=0.012, r1=0.06, seg=14, n=3)
    R.fitted("Legs", ["thigh", "calf"], "wrap", offset=0.004)
    R.boots("wrap", top=z["ankle"] + 0.03)
    P.toes(R, "wrap")
    hem = z["ankle"] + 0.03
    P.skirt(R, "cream", hem, flare=1.55, depth=1.12, folds=8, amp=0.02, seg=48)
    R.fitted("Over", ["spine", "pelvis"], "terra", offset=0.016, where=PB.open_front(R, top=0.06, bottom=0.09))
    PA.shoulder_ring(R, "gold", thick=0.006, t=0.06, offset=0.018)
    P.skirt(R, "terra", z["knee"] - 0.08, flare=1.62, depth=1.15, arc=(0.45, 2 * PI - 0.45), folds=7, amp=0.02, trim="gold", trim_h=0.02, grow=1.07, seg=48)
    up = R.piece(P.trunk_w(R))
    for s in (1, -1):
        P.band_on(R, up, "gold", [(z["waist"] - 0.07, 0.44 * s), (z["chest"] + 0.02, 0.36 * s), (z["neck"] - 0.04, 0.62 * s)], 0.008, thick=0.005, off=0.024)
    R.band("rope", z["waist"], height=0.035, grow=1.18)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece("pelvis")
    for k in range(3):
        p0 = Vector((0.06 + 0.035 * k, cw.y - ryw * 1.15, z["waist"] - 0.02))
        pts = [p0 + Vector((0, -0.005, -0.05 * j)) for j in range(5 + k)]
        g.tube("rope", pts, 0.006, seg=5)
        for j in range(1, len(pts), 2):
            g.ellipsoid("rope", pts[j], (0.011, 0.011, 0.011), seg=(8, 6))
        g.ellipsoid("gold", pts[-1] + Vector((0, 0, -0.01)), (0.011, 0.011, 0.014), seg=(8, 6))

    # the turban: wound bands round the head, a knot at the front, its long tail over the right shoulder
    f, c, r = R.head_piece()
    hd = P.head(R)
    base = hd.brow + 0.01
    for k in range(4):
        zz = base + 0.028 * k
        sw = (1.22, 1.3, 1.26, 1.1)[k]
        rx, ry = hd.rx * sw, hd.ry * (sw + 0.06)
        tilt = 0.012 * (1 if k % 2 else -1)
        pts = [Vector((rx * math.sin(2 * PI * i / 36), hd.c.y + 0.012 - ry * math.cos(2 * PI * i / 36), zz + tilt * math.sin(2 * PI * i / 36) + 0.02 * max(0, math.cos(2 * PI * i / 36)) * (k == 0))) for i in range(37)]
        f.tube("turq", pts, 0.026, seg=8, caps=False)
    f.ellipsoid("turq", Vector((0, hd.c.y + 0.012, base + 0.085)), (hd.rx * 1.12, hd.ry * 1.18, 0.05), seg=(22, 10))
    f.ellipsoid("gold", Vector((0, hd.c.y - hd.ry * 1.3, base + 0.035)), (0.02, 0.012, 0.024), seg=(10, 8))
    tail = [Vector((-hd.rx * 1.05, hd.c.y + hd.ry * 0.5, base + 0.02)), Vector((-hd.rx * 1.3, hd.c.y + hd.ry * 0.9, base - 0.1))]
    f.tube("turq", tail, [0.03, 0.035], seg=8, squash=((1, 0, 0), 0.4))
    tw = R.piece(P.head_spine_w(R, base - 0.08, z["chest"]))
    t2 = [tail[-1], Vector((-0.13, R.bone("neck_01").y + 0.06, z["neck"] - 0.02)), Vector((-0.15, R.bone("neck_01").y + 0.09, z["chest"] - 0.06))]
    tw.tube("turq", t2, [0.035, 0.04, 0.03], seg=8, squash=((1, 0, 0), 0.4))

    # the hourglass, held up by its top ring
    h = K.hand(R)
    hf = h.f
    hf.torus("gold", K.at(h, 0.02), 0.028, 0.006, normal=h.side, seg=(14, 5))
    t0, t1 = K.at(h, -0.02), K.at(h, -0.3)
    for p in (t0, t1):
        hf.ellipsoid("gold", p, (0.075, 0.075, 0.016), seg=(18, 6), rot=P.rot_to(h.d))
    for a in range(3):
        u = h.fwd * math.cos(2 * PI * a / 3) + h.side * math.sin(2 * PI * a / 3)
        hf.tube("gold", [t0 + u * 0.062, t1 + u * 0.062], 0.007, seg=6)
    mid = t0.lerp(t1, 0.5)
    P.hull(hf, "glass", [t0 - h.d * 0.012 * h.s, t0.lerp(mid, 0.5), mid, mid.lerp(t1, 0.5), t1 + h.d * 0.012 * h.s], [0.045, 0.042, 0.009, 0.042, 0.045], seg=16, side=h.fwd)
    P.hull(hf, "glow", [t1 + h.d * 0.016 * h.s, mid.lerp(t1, 0.7), mid.lerp(t1, 0.45)], [0.04, 0.036, 0.008], seg=14, side=h.fwd)
    return R
