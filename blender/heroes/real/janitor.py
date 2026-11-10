"""Gus, the Temple Keeper (controller): stocky, old and calm. Long grey-blue robes to the floor crossed over the chest
with a pale collar and a bronze hem, a dark sash with a bronze cord, a ritual stole of two narrow dark bands, sleeves
tied up with bronze cords above the elbow, wrapped forearms, heavy boots, a short grey beard and a broad lacquered hat
with a bronze rim. In the LEFT hand his ritual sweeping staff, taller than he is: a head of straw and white paper
streamers at the top, and a bronze urn of glowing aqua water hanging from it (hold: torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("janitor", sex="m", height=0.92, width=1.04, depth=1.16, head=1.0, skin="#d0a080")
    z = R.z
    R.mat("robe", "#44546c", rough=0.8, double=True)
    R.mat("pale", "#8e9cb4", rough=0.78, double=True)
    R.mat("dark", "#252838", rough=0.5, double=True)
    R.mat("bronze", "#a07040", rough=0.35, metal=0.78, double=True)
    R.mat("straw", "#b8a070", rough=0.95)
    R.mat("paper", "#d8d1be", rough=0.85, double=True)
    R.mat("wood", "#5a4030", rough=0.7)
    R.mat("water", "#4ab8ff", rough=0.15, emit="#2aa8ff", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#a8a4a0", beard="Hair_Beard", rough=0.8)

    hem = z["ankle"] + 0.03
    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm"], "robe", offset=0.012)
    R.fitted("Legs", ["thigh", "calf"], "dark", offset=0.004)
    R.fitted("Wraps", ["lowerarm"], "paper", offset=0.006)
    R.cuffs("paper", at=(0.22, 0.4, 0.58, 0.76), offset=0.007, thick=0.006)
    R.cuffs("bronze", at=(0.93,), offset=0.008, thick=0.007)
    R.boots("dark", top=z["ankle"] + 0.16)
    P.toes(R, "dark", size=1.05)

    # the robe's skirt, the stole's two narrow bands down the front, bronze at the hems
    folds, amp = 11, 0.03
    f, rings = P.skirt(R, "robe", hem, flare=1.68, depth=1.18, folds=folds, amp=amp, trim="bronze", trim_h=0.03, seg=52)
    cw, rxw, ryw = rings[-1]
    pol = lambda a: math.atan2(rxw * math.sin(a), ryw * math.cos(a))
    low = z["knee"] - 0.04
    up = R.piece(P.trunk_w(R, hem))
    for s in (1, -1):
        a0, a1 = sorted((0.3 * s, 0.52 * s))
        P.cloth(f, "dark", rings, arc=(a0, a1), seg=3, rows=10, folds=folds, amp=amp, z0=low, z1=z["waist"] - 0.03, off=0.012, fade=0)
        P.cloth(f, "bronze", rings, arc=(a0, a1), seg=3, rows=1, folds=folds, amp=amp, z0=low - 0.004, z1=low + 0.03, off=0.017, fade=0)
        P.band_on(R, up, "dark", [(z["waist"] - 0.03, pol(0.41) * s), (z["chest"], 0.62 * s), (z["neck"] - 0.035, 0.95 * s)], 0.062, thick=0.012, off=0.03)
    # the robe crossed over the chest, left over right, with its pale collar
    P.band_on(R, up, "pale", [(z["neck"] - 0.025, -0.8), (z["chest"] + 0.04, -0.4), (z["waist"] + 0.05, 0.12)], 0.05, thick=0.012, off=0.02)
    P.band_on(R, up, "pale", [(z["neck"] - 0.025, 0.8), (z["chest"] + 0.04, 0.4), (z["waist"] + 0.03, -0.2)], 0.05, thick=0.012, off=0.024)
    P.collar(R, "pale", height=0.04, grow=1.22)

    # the dark sash, its bronze cord, the knot and two tasselled ends
    how = R.hang_w(z["waist"], hem)
    R.band("dark", z["waist"], height=0.12, grow=1.18, how=how)
    R.band("bronze", z["waist"], height=0.02, grow=1.22, how=how)
    c0, rx0, ry0 = R.ring(z["waist"])
    f = R.piece(how)
    knot = Vector((-0.07, c0.y - ry0 * 1.3, z["waist"]))
    f.ellipsoid("bronze", knot, (0.026, 0.02, 0.026), seg=(10, 8))
    for k, dx in enumerate((-0.02, 0.03)):
        end = knot + Vector((dx * 1.5, -0.035, -0.26 + 0.05 * k))
        f.tube("bronze", [knot, knot + Vector((dx, -0.03, -0.12)), end], 0.007, seg=6)
        f.tube("bronze", [end, end + Vector((0, 0, -0.06))], [0.012, 0.018], seg=8)

    # the sleeves, tied up above the elbow with bronze cords
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        e, w = R.bone(f"upperarm_{n}"), R.bone(f"lowerarm_{n}")
        pts, rad = [], []
        for t, dr in ((0.1, 0.016), (0.35, 0.026), (0.62, 0.036), (0.82, 0.032), (0.95, 0.012)):
            c, r = R.arm_r(n, t, bones=("upperarm", "lowerarm"))
            pts.append(c)
            rad.append(r + dr)
        f.tube("robe", pts, rad, seg=14, caps=False)
        f.torus("bronze", pts[-1], rad[-1] + 0.002, 0.008, normal=(w - e), seg=(18, 6))

    # the broad lacquered hat, a bronze rim, tied under the chin
    H = P.head(R)
    f = R.piece("Head")
    zt = H.top - 0.03
    c = Vector((0, H.c.y, 0))
    f.loft("dark", [(c + Vector((0, 0, zt - 0.012)), 0.275, 0.285), (c + Vector((0, 0, zt + 0.028)), 0.19, 0.2), (c + Vector((0, 0, zt + 0.075)), 0.095, 0.1),
                    (c + Vector((0, 0, zt + 0.105)), 0.03, 0.03)], seg=36, cap_top=True)
    f.tube("bronze", [c + Vector((0.275 * math.sin(a), -0.285 * math.cos(a), zt - 0.012)) for a in [2 * PI * k / 36 for k in range(38)]], 0.009, seg=6, caps=False)
    f.ellipsoid("bronze", c + Vector((0, 0, zt + 0.112)), (0.026, 0.026, 0.02), seg=(10, 8))
    f.torus("bronze", c + Vector((0, 0, zt + 0.062)), 0.12, 0.006, seg=(28, 6))
    for s in (1, -1):
        f.tube("bronze", [Vector((H.rx * 1.05 * s, H.c.y, zt + 0.0)), Vector((H.rx * 1.02 * s, H.c.y - 0.02, H.eye - 0.04)), Vector((0.03 * s, H.chin.y + 0.012, H.chin.z - 0.012)),
                          Vector((0, H.chin.y + 0.005, H.chin.z - 0.018))], 0.0045, seg=5)

    # the ritual sweeping staff, upright in the left hand
    f, o, d, up, s = P.held_rod(R, "l", "wood", 1.28, 0.62, r=0.016)
    X = Vector((1, 0, 0))
    f.ellipsoid("bronze", o - d * 1.285 * s, P.rr(R, 0.024), seg=(10, 6))
    b = o + d * 0.6 * s
    f.tube("straw", [b - d * 0.02, b + d * 0.07, b + d * 0.2, b + d * 0.31], [0.03, 0.05, 0.085, 0.075], seg=14)
    for k in range(10):   # the straw's ragged ends
        a = 2 * PI * k / 10
        q = X * math.cos(a) + up * math.sin(a)
        f.tube("straw", [b + d * 0.28 + q * 0.05, b + d * (0.4 + 0.03 * (k % 3)) + q * 0.075], [0.026, 0.004], seg=5)
    f.tube("straw", [b + d * 0.28, b + d * 0.43], [0.045, 0.004], seg=6)
    for t in (0.0, 0.075):
        f.torus("bronze", b + d * t, 0.036 + t * 0.26, 0.009, normal=d, seg=(18, 6))
    for k in range(6):    # the white paper streamers, hanging down from the binding
        a = 2 * PI * k / 6 + 0.5
        q = X * math.cos(a) + up * math.sin(a)
        side = q.cross(d)
        ln = 0.26 + 0.04 * (k % 2)
        f.tube("paper", [b + q * 0.03, b - d * ln * 0.25 + q * 0.07 + side * 0.014, b - d * ln * 0.5 + q * 0.045 - side * 0.014, b - d * ln * 0.75 + q * 0.075 + side * 0.014,
                         b - d * ln + q * 0.05], 0.021, seg=6, squash=(tuple(q), 0.12))
    # the bronze urn on its chain, the water in it glowing
    h0 = o + d * 0.47 * s
    f.torus("bronze", h0, 0.02, 0.007, normal=d, seg=(14, 6))
    f.tube("bronze", [h0, h0 + X * 0.07 + d * 0.03, h0 + X * 0.13 + d * 0.01], 0.007, seg=6)
    u0 = h0 + X * 0.13 - d * 0.24
    f.tube("bronze", [h0 + X * 0.13 + d * 0.01, u0 + d * 0.14], 0.004, seg=5)
    prof = [(-0.115, 0.03), (-0.1, 0.06), (-0.055, 0.094), (0.0, 0.102), (0.047, 0.08), (0.07, 0.06), (0.086, 0.07)]
    f.tube("bronze", [u0 + d * t for t, r in prof], [r for t, r in prof], seg=14)
    f.ellipsoid("water", u0 + d * 0.084, (0.064, 0.064, 0.014), seg=(14, 6), rot=P.rot_to(d))
    f.torus("bronze", u0 + d * 0.086, 0.07, 0.007, normal=d, seg=(18, 6))
    f.tube("bronze", P.curl(u0 + d * 0.086, X, d, 0.068, 0.068, 0.0, PI, n=10), 0.005, seg=5)
    f.torus("water", u0 - d * 0.002, 0.104, 0.006, normal=d, seg=(20, 6))
    return R
