"""Fenna, the Grove Warden (controller): calm, a forest queen. Chestnut hair, branch antlers with young leaves and a
blossom, a pale bark collar, a mantle of layered leaves over the shoulders, a deep green gown open in front over bark
cream with a girdle of leaves, a cloak of overlapping leaves down her back, a vine wound round her body, and a living
staff of bark in the LEFT hand, floor to above her head, topped by a pink bloom with a glowing pollen heart
(hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("grove", sex="f", height=1.0, skin="#d8b490")
    z = R.z
    R.mat("deep", "#234a22", rough=0.75, double=True)
    R.mat("leaf", "#4a9a40", rough=0.6, double=True)
    R.mat("cream", "#e8dcc0", rough=0.7, double=True)
    R.mat("bark", "#6a4a2a", rough=0.85)
    R.mat("petal", "#e87aa6", rough=0.5, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("pollen", "#fff6b0", rough=0.3, emit="#ffd84a", strength=1.0)
    R.hair("Hair_Long", "#6e3519", rough=0.5)

    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm"], "deep")
    R.fitted("Sleeves", ["lowerarm"], "cream", offset=0.005)
    R.fitted("Hose", ["thigh", "calf"], "cream", offset=0.003)
    R.boots("bark", top=z["knee"] - 0.14, cuff="gold")
    R.cuffs("bark", at=(0.07, 0.95), offset=0.01, thick=0.008)
    P.arm_band(R, "gold", 0.93, offset=0.012, thick=0.006)

    # the gown: cream underneath, deep green over it, open in front
    hem = z["ankle"] + 0.08
    R.skirt("cream", hem=hem, flare=1.6, depth=1.2, trim="gold", trim_h=0.018)
    R.skirt("deep", hem=hem + 0.07, flare=1.78, depth=1.2, arc=(0.55, 2 * PI - 0.55), trim="gold", trim_h=0.02, grow=1.04, seg=40)
    sfn = P.skirt_fn(R, hem + 0.07, 1.78, 1.2, 1.04)
    hang = R.hang_w(z["waist"], hem)
    f = R.piece(hang)
    # a girdle of leaves over the hips, two rows
    for row, (n, ln, w, zz, key) in enumerate(((11, 0.3, 0.06, z["waist"] - 0.01, "leaf"), (10, 0.2, 0.055, z["waist"] + 0.0, "deep"))):
        for i in range(n):
            a = 0.62 + (2 * PI - 1.24) * (i + 0.5 * row) / (n - 1 + 0.5 * row)
            p, q = sfn(a, zz, 0.012 + 0.008 * row), sfn(a, zz - ln, 0.03 + 0.01 * row)
            P.blade(f, key, p, q, w, (math.sin(a), -math.cos(a), 0.2), thick=0.1, belly=0.45, root=0.45)
    R.band("bark", z["waist"], height=0.035, grow=1.14, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    b = V(0, cw.y - ryw * 1.3, z["waist"])
    for k in range(5):
        a = 2 * PI * k / 5
        P.blade(f, "petal", b, b + V(0.05 * math.sin(a), -0.015, 0.05 * math.cos(a)), 0.02, (0, 1, 0), thick=0.25, belly=0.55, root=0.4, n=4)
    f.ellipsoid("gold", b + V(0, -0.012, 0), (0.014, 0.01, 0.014), seg=(8, 6))

    # the vine wound round her body, with leaves
    fs, pt = P.strap(R, "bark", width=0.016, lift=0.2, grow=1.05, out=0.012)
    for u in (0.9, 0.0, 0.1, 0.2, 0.4, 0.6):
        p = pt(u)
        a = 2 * PI * u
        n = V(math.sin(a), -math.cos(a), 0)
        P.blade(fs, "leaf", p + n * 0.006, p + n * 0.02 + V(0.035 * math.cos(a), 0.035 * math.sin(a), 0.05), 0.022, n, thick=0.15, n=4)

    # the pale bark collar and the mantle of leaves: a long row and a short row round the neck
    R.collar("cream", height=0.06, grow=1.12)
    ny = R.bone("neck_01").y
    cc, rxc, ryc = R.ring(z["chest"])
    for row, (n, key, k) in enumerate(((12, "deep", 1.0), (11, "leaf", 0.66))):
        for i in range(n):
            a = 2 * PI * (i + 0.5 * row) / n
            sx, cs = math.sin(a), -math.cos(a)
            side = abs(sx) ** 1.5
            bone = "spine_03" if side < 0.45 else ("clavicle_l" if sx > 0 else "clavicle_r")
            f = R.piece(bone)
            base = V(0.075 * sx, ny - 0.01 + 0.085 * cs, z["neck"] - 0.012 + 0.012 * row)
            reach = (0.15 + 0.12 * side) * k + (0.02 if cs > 0 else 0.0)
            drop = (0.19 - 0.165 * side) * k
            tip = V(base.x + reach * sx, base.y + reach * cs * (1.0 if cs < 0 else 1.15), base.z - drop)
            P.blade(f, key, base, tip, 0.062 * (0.8 + 0.2 * k), (sx * 0.7, cs * 0.7, 0.7), thick=0.1, belly=0.5, root=0.5, bend=(0.03 * sx * (1 - side), 0.03 * cs * (1 - side), 0.03 * side))

    # the cloak of leaves down her back
    fcl, cfn = P.cloak(R, "deep", hem=z["knee"] - 0.02, width=0.34, depth=0.84, spread=1.15, nu=14, nv=8)
    for row, v in enumerate((0.1, 0.27, 0.44, 0.61, 0.78, 0.93)):
        n = 4 + row % 2
        for i in range(n):
            u = (i + 0.5) / n
            p, q = cfn(u, v), cfn(u, min(1.12, v + 0.25))
            nrm = V(p.x, p.y - cc.y, 0).normalized()
            P.blade(fcl, "leaf" if (i + row) % 2 == 0 else "deep", p + nrm * 0.012, q + nrm * 0.03, 0.085, nrm, thick=0.07, belly=0.5, root=0.45)

    # branch antlers, young leaves, one blossom
    f, c, r = R.head_piece()
    for s in (1, -1):
        b0 = c + V(0.062 * s, 0.03, r * 0.82)
        m1, m2, tip = b0 + V(0.05 * s, 0.02, 0.1), b0 + V(0.12 * s, 0.03, 0.17), b0 + V(0.15 * s, 0.02, 0.3)
        f.tube("bark", [b0, m1, m2, tip], [0.022, 0.018, 0.013, 0.004], seg=7)
        t1, t2 = m1 + V(-0.015 * s, -0.03, 0.11), m2 + V(0.09 * s, 0.01, 0.06)
        f.tube("bark", [m1, t1], [0.014, 0.004], seg=6)
        f.tube("bark", [m2, t2], [0.012, 0.004], seg=6)
        for p, dirv in ((tip, V(0.03 * s, 0, 0.06)), (t1, V(-0.02 * s, -0.02, 0.055)), (t2, V(0.055 * s, 0, 0.03)), (m2, V(0.01 * s, -0.05, 0.03))):
            P.blade(f, "leaf", p, p + dirv, 0.02, (0, 1, 0.2), thick=0.2, n=4)
    bl = c + V(0.095, -0.03, r * 0.55)
    for k in range(5):
        a = 2 * PI * k / 5
        P.blade(f, "petal", bl, bl + V(0.02, 0.04 * math.sin(a), 0.04 * math.cos(a)), 0.018, (1, 0, 0), thick=0.3, belly=0.55, root=0.4, n=4)
    f.ellipsoid("gold", bl + V(0.012, 0, 0), (0.01, 0.012, 0.012), seg=(8, 6))

    # the living staff: knotted bark, a vine up its top, a bloom
    f, o, d, up = R.held("l")
    out = V(1, 0, 0)
    pts = [o - d * 1.28, o - d * 0.85 + out * 0.012, o - d * 0.4 - out * 0.01, o + up * 0.0, o + d * 0.3 + out * 0.012, o + d * 0.55 - out * 0.008, o + d * 0.68 + out * 0.02]
    f.tube("bark", P.smooth(pts, 4), [0.012 + 0.008 * (i / 24) for i in range(25)], seg=8)
    for t in (-0.6, 0.2):
        f.ellipsoid("bark", o + d * t, (0.022, 0.03, 0.022), seg=(8, 6))
    top = pts[-1]
    f.tube("leaf", [o + d * (0.2 + 0.45 * i / 20) + (out * math.cos(i * 0.95) + up * math.sin(i * 0.95)) * 0.028 for i in range(21)], 0.005, seg=5)
    for k in range(3):
        a = 2.1 * k
        side = out * math.cos(a) + up * math.sin(a)
        p = o + d * (0.4 + 0.08 * k)
        P.blade(f, "leaf", p + side * 0.02, p + side * 0.1 + d * 0.05, 0.03, d, thick=0.12, n=4)
    for ring, (n, ln, lift, w, key) in enumerate(((7, 0.12, 0.035, 0.045, "petal"), (5, 0.075, 0.07, 0.034, "cream"))):
        for k in range(n):
            a = 2 * PI * (k + 0.5 * ring) / n
            side = out * math.cos(a) + up * math.sin(a)
            P.blade(f, key, top + d * 0.01, top + side * ln + d * lift, w, d, thick=0.14, belly=0.6, root=0.35, bend=d * -0.012, n=5)
    f.ellipsoid("pollen", top + d * 0.045, (0.038, 0.036, 0.038), seg=(12, 8))
    return R
