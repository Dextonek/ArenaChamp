"""Sefu, the Dune Sovereign (controller): a tall priest-king in bronze skin. A gold and lapis striped nemes flaring to
his shoulders, a gold cobra on the brow, a braided false beard, a broad jewelled collar in rows of gold, turquoise and
lapis over a bare chest, gold armbands, bracers and greaves, a long linen kilt under a shorter over-kilt with a striped
royal apron, and a sandstone crook taller than he is in the LEFT hand, its big gold hook over a glowing turquoise
(hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("sand", sex="m", height=1.04, width=0.9, depth=0.9, skin="#a8744c")
    z = R.z
    R.mat("linen", "#ddd0ae", rough=0.75, double=True)
    R.mat("gold", "#cf9d3e", rough=0.3, metal=0.85, double=True)
    R.mat("teal", "#2aa59a", rough=0.4, double=True)
    R.mat("lapis", "#27459a", rough=0.45, double=True)
    R.mat("stone", "#d8c69c", rough=0.85)
    R.mat("leather", "#4a2f18", rough=0.7)
    R.mat("gem", "#7ff5e6", rough=0.15, emit="#3fd4c8", strength=1.0)
    P.hair(R, "Hair_Beard", "#17100a")
    sh = R.bone("upperarm_l").x
    ny = R.bone("neck_01").y

    # the broad collar: rows of gold, turquoise and lapis lying on the shoulders and chest
    q = V(0, ny - 0.025, z["neck"])
    P.drape(R, q, [("gold", 0.16), ("teal", 0.2), ("gold", 0.12), ("lapis", 0.2), ("gold", 0.12), ("teal", 0.14), ("gold", 0.1)], r0=(0.08, 0.09), length=0.17, side=0.72)
    f = R.piece("spine_03")
    g = P.surf(R, z["chest"] + 0.015, 0, out=0.012)
    f.ellipsoid("gold", g, (0.036, 0.012, 0.03), seg=(12, 8))
    f.ellipsoid("teal", g + V(0, -0.008, 0), (0.02, 0.008, 0.016), seg=(10, 6))

    # arms: gold armbands and bracers
    P.arm_band(R, "gold", 0.45, width=0.05, offset=0.006)
    P.arm_band(R, "teal", 0.45, offset=0.011, thick=0.006)
    el, wr = R.bone("lowerarm_l").x, R.bone("hand_l").x
    R.fitted("Bracers", ["lowerarm"], "gold", offset=0.009, where=lambda p: el + (wr - el) * 0.3 < abs(p.x) < el + (wr - el) * 0.9)
    for t, key, th in ((0.3, "gold", 0.009), (0.9, "gold", 0.009), (0.6, "lapis", 0.006)):
        P.arm_band(R, key, t, bones=("lowerarm", "hand"), offset=0.012, thick=th)

    # legs: sandals, gold greaves
    R.boots("leather", top=z["ankle"] + 0.045, toe="gold")
    lo, hi = z["ankle"] + 0.09, z["knee"] - 0.08
    R.fitted("Greaves", ["calf"], "gold", offset=0.009, below=hi, above=lo)
    for n in "lr":
        f = R.piece(f"calf_{n}")
        for zz in (lo, hi):
            c, r = R.leg_r(n, zz)
            f.torus("gold", c, r + 0.012, 0.009, seg=(20, 6))

    # the kilt: long linen, a shorter over-kilt, the striped royal apron, a gold belt
    R.fitted("Wrap", ["pelvis", "thigh"], "linen", offset=0.004, above=z["knee"] + 0.05)
    hem = z["knee"] - 0.2
    R.skirt("linen", hem=hem, flare=1.3, depth=1.15, trim="gold", trim_h=0.02)
    R.skirt("linen", hem=z["knee"] + 0.1, flare=1.45, depth=1.15, arc=(0.5, 2 * PI - 0.5), trim="gold", trim_h=0.016, grow=1.07, seg=40)
    sfn = P.skirt_fn(R, hem, 1.3, 1.15)
    f = R.piece(R.hang_w(z["waist"], hem))
    top, bot, rows = z["waist"] - 0.03, z["knee"] - 0.1, 9
    for j in range(rows):
        key = ("gold", "lapis", "gold", "teal")[j % 4]
        P.grid(f, key, lambda u, v, j=j: sfn(0.36 * (1 - 0.32 * (j + v) / rows) * (2 * u - 1), top + (bot - top) * (j + v) / rows, 0.016), 6, 1)
    R.band("gold", z["waist"], height=0.075, grow=1.15, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("lapis", V(0, cw.y - ryw * 1.26, z["waist"]), (0.04, 0.014, 0.03), seg=(12, 8))
    f.ellipsoid("teal", V(0, cw.y - ryw * 1.26 - 0.01, z["waist"]), (0.02, 0.008, 0.015), seg=(10, 6))

    # the nemes: a gold cap, striped cloth flaring from the brow to the shoulders, lappets on the chest, a queue behind
    f, c, r = R.head_piece()
    zb = P.face_z(R, 0.74)
    cap = c + V(0, 0.015, 0.012)
    f.ellipsoid("gold", cap, (r * 1.17, r * 1.32, r * 1.14), seg=(22, 14), keep=lambda co: co.z > zb or co.y > cap.y + 0.03)
    zt, zl = zb + 0.035, z["neck"] - 0.035
    bands = 8
    for j in range(bands):
        def fn(u, v, j=j):
            t = (j + v) / bands
            a0 = 1.0 - 0.42 * t
            a = a0 + (2 * PI - 2 * a0) * u
            rx = r * 1.2 + (sh * 1.2 - r * 1.2) * t ** 1.5
            ry = r * 1.3 + (0.15 - r * 1.3) * t
            cy = cap.y + (ny - 0.01 - cap.y) * t
            return V(rx * math.sin(a), cy - ry * math.cos(a), zt + (zl - zt) * t)
        P.grid(f, "gold" if j % 2 == 0 else "teal", fn, 22, 1)
    brow = P.outline(R, zb, -1.9, 1.9, n=20, out=0.012)
    f.tube("gold", brow, 0.011, seg=6)
    fy = brow[len(brow) // 2]
    f.tube("gold", [fy + V(0, -0.004, 0), fy + V(0, -0.03, 0.045), fy + V(0, -0.03, 0.085), fy + V(0, -0.055, 0.1)], [0.012, 0.024, 0.02, 0.007], seg=8, squash=((0, 1, 0), 0.5))
    f.ellipsoid("teal", fy + V(0, -0.045, 0.062), (0.008, 0.006, 0.012), seg=(6, 4))
    chin = P.outline(R, P.face_z(R, 0.04), 0, 0, n=1)[0]
    f.tube("lapis", [chin + V(0, 0.012, 0.005), chin + V(0, -0.004, -0.09)], [0.012, 0.018], seg=8)
    for t in (0.3, 0.62, 0.97):
        f.torus("gold", chin + V(0, 0.012 - 0.016 * t, 0.005 - 0.095 * t), 0.0135 + 0.005 * t, 0.0035, seg=(12, 5))
    f = R.piece("spine_03")
    for s in (1, -1):
        pts = [V(0.1 * s, ny - 0.105, z["neck"] - 0.02)] + [P.surf(R, zz, 0.62 * s, out=0.02) for zz in (z["chest"] + 0.13, z["chest"] + 0.07, z["chest"] + 0.01)]
        path = P.ribbon(f, "gold", pts, 0.036, (1, 0, 0), k=3)
        for i in (2, 5, 8):
            f.tube("teal", [path[i] + V(-0.037, -0.003, 0), path[i] + V(0.037, -0.003, 0)], 0.007, seg=5)
    cc, rxc, ryc = R.ring(z["chest"])
    f.tube("lapis", [V(0, ny + 0.115, z["neck"] - 0.01), V(0, cc.y + ryc + 0.045, z["chest"] + 0.06), V(0, cc.y + ryc + 0.04, z["chest"] - 0.07)], [0.04, 0.03, 0.02], seg=8)
    for zz in (z["chest"] + 0.07, z["chest"] - 0.03):
        f.torus("gold", V(0, cc.y + ryc + 0.043, zz), 0.03, 0.006, seg=(12, 5))

    # the crook
    f, o, d, up, out = P.staff(R, "stone", back=1.28, front=0.6, r=0.016)
    f.ellipsoid("gold", o - d * 1.29, (0.026, 0.026, 0.026), seg=(8, 6))
    for t in (-0.95, -0.5, 0.18, 0.46):
        f.tube("gold", [o + d * (t - 0.025), o + d * (t + 0.025)], 0.02, seg=8)
    for t in (-0.92, -0.47, 0.21):
        f.torus("lapis", o + d * (t + 0.015), 0.021, 0.005, normal=d, seg=(12, 5))
    base = o + d * 0.6
    f.torus("gold", base - d * 0.03, 0.03, 0.01, normal=d, seg=(14, 6))
    P.hook(f, "gold", base, d, out, 0.13, r=0.02, turn=1.42 * PI, taper=0.55)
    f.ellipsoid("gem", base + out * 0.13 + d * 0.02, (0.04, 0.04, 0.05), seg=(12, 10))
    return R
