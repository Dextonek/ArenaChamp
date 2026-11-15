"""The Lantern Thief (the Deep's big enemy, "carries the only lamp in the Deep that is not a crystal"): the robber of the
halls, broad and sure-footed, who stole the miners' last lamp. Built heavy: broad, a smaller head. A deep violet hooded
cloak to the knee with a silver clasp, a dark mask over the lower face, slate leathers with many small pouches on crossed
belts, tall soft boots; a long curved knife in the RIGHT hand. On a short iron pole across his back a great brass lantern
hangs over his left shoulder, its amber flame his one light. Signature shape: the hood and the lantern over the shoulder."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("deep_thief", sex="m", height=1.04, width=1.2, depth=1.16, head=0.88, skin="#b89a84", eyes="#ffd890")
    z = R.z
    R.mat("violet", "#2e1e44", rough=0.7, double=True)
    R.mat("slate", "#2c2e38", rough=0.7, double=True)
    R.mat("leather", "#24180f", rough=0.6, double=True)
    R.mat("mask", "#14121a", rough=0.6, double=True)
    R.mat("silver", "#c8ccd8", rough=0.3, metal=0.85)
    R.mat("brass", "#c9983c", rough=0.32, metal=0.85)
    R.mat("iron", "#4a4c54", rough=0.5, metal=0.6)
    R.mat("glass", "#ffd890", rough=0.15, alpha=0.6)
    R.mat("glow", "#fff0c8", rough=0.2, emit="#ffa830", strength=1.3)
    PB.big_hands(R, 1.2)
    z = R.z
    R.hair("Hair_Buzzed", "#1a1410", brows=True)

    R.fitted("Leathers", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "slate", offset=0.008)
    R.fitted("Legs", ["thigh", "calf"], "slate", offset=0.005)
    R.boots("leather", top=z["knee"] + 0.02)
    for side in (1, -1):
        PA.strap(R, "leather", width=0.045, lift=0.2, grow=1.1, high_side=side, out=0.02)
    hem = z["hip"] - 0.12
    P.skirt(R, "slate", hem, flare=1.2, depth=1.1, folds=4, amp=0.01, seg=36)
    how = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"] - 0.01, height=0.06, grow=1.15, how=how)
    pf = R.piece(how)
    for a in (-1.1, -0.5, 0.5, 1.1, 2.4):
        p, out = P.on_trunk(R, z["waist"] - 0.04, a, off=0.05)
        pf.ellipsoid("leather", p, (0.035, 0.025, 0.04), seg=(10, 6))
        pf.ellipsoid("brass", p + out * 0.026 + Vector((0, 0, 0.02)), (0.008, 0.005, 0.008), seg=(6, 4))

    # the hooded cloak, its clasp, the mask over the lower face
    PA.cloak(R, "violet", hem=z["knee"] - 0.02, width=0.42, depth=0.85, spread=1.35, top_spread=1.7, lining="slate", nu=16, nv=10)
    PA.cowl(R, "violet", grow=1.1, low=0.09, high=0.03)
    PA.hood(R, "violet", lining="slate", grow=1.45, open=0.38, tilt=0.3, peak=0.08, edge="silver", edge_r=0.005)
    fc, foot, top = P.collar(R, "violet", height=0.03, grow=1.15)
    fc.ellipsoid("silver", foot + Vector((0, -0.012, 0.02)), (0.022, 0.01, 0.022), seg=(10, 6))
    h = P.head(R)
    hp = R.piece("Head")
    PA.grid(hp, "mask", lambda u, v: Vector((h.rx * (1.04 - 0.08 * v) * math.sin(-1.7 + 3.4 * u), h.c.y - h.ry * (1.08 - 0.1 * v) * math.cos(-1.7 + 3.4 * u), h.eye - 0.03 - 0.11 * v)), 16, 4)

    # the lantern on its pole across the back, hanging over the left shoulder
    cc, rxc, ryc = R.ring(z["chest"])
    bf = R.piece("spine_03")
    p0 = Vector((-0.2, cc.y + ryc + 0.06, z["waist"] + 0.05))
    p1 = Vector((0.24, cc.y + ryc + 0.02, z["neck"] + 0.24))
    bf.tube("iron", [p0, p1], 0.014, seg=8)
    tip = p1 + Vector((0.06, -0.05, 0.02))
    bf.tube("iron", [p1, tip], 0.01, seg=6)
    lt = tip + Vector((0, 0, -0.06))
    K = 1.6
    bf.tube("iron", [tip, lt], 0.004, seg=5)
    bf.ellipsoid("brass", lt + Vector((0, 0, -0.01)), (0.05 * K, 0.05 * K, 0.025 * K), seg=(12, 6))
    g0, g1 = lt + Vector((0, 0, -0.03 * K)), lt + Vector((0, 0, -0.17 * K))
    bf.tube("glass", [g0, g0.lerp(g1, 0.5), g1], [0.05 * K, 0.058 * K, 0.05 * K], seg=14)
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        u = Vector((math.cos(a), math.sin(a), 0))
        bf.tube("brass", [g0 + u * 0.054 * K, g0.lerp(g1, 0.5) + u * 0.062 * K, g1 + u * 0.054 * K], 0.006, seg=5)
    bf.ellipsoid("brass", g1 + Vector((0, 0, -0.012)), (0.055 * K, 0.055 * K, 0.02 * K), seg=(12, 6))
    bf.ellipsoid("glow", g0.lerp(g1, 0.55), (0.03 * K, 0.03 * K, 0.045 * K), seg=(10, 8))

    # the long curved knife in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("leather", [o - d * 0.07 * s, o + d * 0.07 * s], 0.016, seg=8)
    f.ellipsoid("silver", o - d * 0.09 * s, P.rr(R, 0.02), seg=(10, 8))
    f.tube("silver", [o + d * 0.07 * s - upv * 0.035, o + d * 0.08 * s + upv * 0.035], 0.009, seg=6)
    pts = [o + d * (0.08 + 0.42 * t) * s + upv * 0.06 * t ** 2 for t in [k / 7 for k in range(8)]]
    f.tube("silver", pts, [0.024, 0.026, 0.026, 0.024, 0.02, 0.015, 0.009, 0.002], seg=6, squash=(tuple(side), 0.14))
    return R
