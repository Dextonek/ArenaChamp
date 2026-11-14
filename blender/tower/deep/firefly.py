"""The Firefly-Seller (one of the Deep's two traders): he sells living light, the fireflies of the deep caves, by the
jar. A broad man with a dark beard under a wide shallow cone of a hat of black lacquer with a silver rim. A quilted slate
coat to the knee with violet edges, dark trousers, black boots. Across his shoulders a carrying yoke of dark wood, a
covered jar of glass hanging from each end. In the LEFT hand, held up on a cord, one more jar whose fireflies glow a soft
green: his one light (hold: torch). Signature shape: the hat and the yoke."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_firefly", sex="m", height=1.0, width=1.12, depth=1.1, skin="#b08a70")
    z = R.z
    R.mat("slate", "#353a50", rough=0.75, double=True)
    R.mat("violet", "#4a3270", rough=0.65, double=True)
    R.mat("black", "#1a1820", rough=0.45, double=True)
    R.mat("wood", "#3a2e26", rough=0.6)
    R.mat("silver", "#c8ccd4", rough=0.28, metal=0.9, double=True)
    R.mat("glass", "#b8d8c8", rough=0.12)
    R.mat("glow", "#f0ffd0", rough=0.3, emit="#a8f070", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#201814", beard="Hair_Beard")

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "slate", offset=0.012)
    R.cuffs("violet", at=(0.9,), offset=0.014, thick=0.012)
    R.fitted("Legs", ["thigh", "calf"], "black", offset=0.005)
    R.boots("black", top=z["knee"] - 0.06, cuff="silver")
    P.toes(R, "black")
    f, rings = P.skirt(R, "slate", z["knee"] - 0.04, flare=1.42, depth=1.12, folds=7, amp=0.016, trim="violet", trim_h=0.03, seg=48)
    up = R.piece(P.trunk_w(R))
    for k in range(5):
        zz = z["waist"] - 0.04 + (z["chest"] - z["waist"] + 0.1) * k / 4
        P.band_on(R, up, "violet", [(zz, -1.5), (zz, 0.0), (zz, 1.5)], 0.004, thick=0.004, off=0.018)
    P.band_on(R, up, "violet", [(z["waist"] - 0.1, 0.0), (z["neck"] - 0.04, 0.0)], 0.02, thick=0.006, off=0.02)
    R.band("black", z["waist"], height=0.05, grow=1.17)
    P.collar(R, "violet", height=0.05, grow=1.05, flare=0.05)

    # the wide flat conical hat
    f, c, r = R.head_piece()
    hb = Vector((0, c.y + 0.015, z["top"] - 0.05))
    P.hull(f, "black", [hb, hb + Vector((0, 0, 0.06)), hb + Vector((0, 0, 0.115))], [0.32, 0.16, 0.006], [0.33, 0.165, 0.006], seg=32, side=Vector((1, 0, 0)))
    f.torus("silver", hb, 0.32, 0.007, seg=(44, 5))
    f.torus("violet", hb + Vector((0, 0, -0.012)), 0.12, 0.012, seg=(28, 6))

    # the yoke across his shoulders, a jar at each end
    yk = R.piece("spine_03")
    ny = R.bone("neck_01").y
    yz = z["neck"] - 0.03
    sh = R.bone("upperarm_l").x
    yk.tube("wood", [Vector((-sh - 0.32, ny + 0.06, yz - 0.04)), Vector((0, ny + 0.06, yz + 0.01)), Vector((sh + 0.32, ny + 0.06, yz - 0.04))], 0.02, seg=8)
    for s in (1, -1):
        e = Vector(((sh + 0.3) * s, ny + 0.06, yz - 0.04))
        yk.ellipsoid("silver", e + Vector((0.02 * s, 0, 0)), (0.024, 0.024, 0.024), seg=(10, 8))
        yk.tube("silver", [e, e + Vector((0, 0, -0.2))], 0.004, seg=5)
        j = e + Vector((0, 0, -0.2))
        P.hull(yk, "silver", [j, j + Vector((0, 0, -0.02))], [0.02, 0.06], seg=14)
        P.hull(yk, "glass", [j + Vector((0, 0, -0.02)), j + Vector((0, 0, -0.1)), j + Vector((0, 0, -0.18))], [0.06, 0.068, 0.06], seg=14)
        P.hull(yk, "black", [j + Vector((0, 0, -0.18)), j + Vector((0, 0, -0.2))], [0.062, 0.04], seg=14)

    # the jar held up on its cord
    h = K.hand(R)
    hf = h.f
    hf.torus("silver", K.at(h, 0.015), 0.026, 0.005, normal=h.side, seg=(14, 5))
    a = K.at(h, -0.07)
    hf.tube("silver", [K.at(h, 0.0), a], 0.004, seg=5)
    P.hull(hf, "silver", [a, a - h.d * 0.02 * h.s], [0.02, 0.055], seg=14, side=h.fwd)
    g0, g1 = a - h.d * 0.02 * h.s, a - h.d * 0.17 * h.s
    P.hull(hf, "glass", [g0, g0.lerp(g1, 0.5), g1], [0.055, 0.062, 0.055], seg=14, side=h.fwd)
    for k in range(5):
        u = h.fwd * math.cos(2 * PI * k / 5) + h.side * math.sin(2 * PI * k / 5)
        hf.ellipsoid("glow", g0.lerp(g1, 0.3 + 0.1 * k) + u * 0.025, P.rr(R, 0.012), seg=(8, 6))
    P.hull(hf, "black", [g1, g1 - h.d * 0.02 * h.s], [0.057, 0.035], seg=14, side=h.fwd)
    return R
