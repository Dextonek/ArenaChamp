"""Zephyr, the Wind Blade (melee assassin): lean and quick. White hair swept back like wind, a dark cloth mask over the
lower face, a short teal coat with gold edges over dark under-clothes, a leather belt, sword strap and bracers, shins
wrapped in pale cloth, low boots, a very long jade scarf wound round his neck with two tails streaming behind him (they
follow the chest), and a long curved blade in the RIGHT hand with a glowing mint edge."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("sky", sex="m", height=0.99, width=0.84, depth=0.84, skin="#e8c8ac")
    z = R.z
    R.mat("dark", "#1a2a2a", rough=0.7)
    R.mat("coat", "#1c8a78", rough=0.6, double=True)
    R.mat("leather", "#5a4030", rough=0.7)
    R.mat("wrap", "#d0d8d0", rough=0.8)
    R.mat("scarf", "#36c8a4", rough=0.55, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("steel", "#d8e4ea", rough=0.2, metal=0.9)
    R.mat("edge", "#c8fff6", rough=0.2, emit="#5affe8", strength=1.0)
    hair = P.hair(R, "Hair_SimpleParted", "#eef4f2")
    ny = R.bone("neck_01").y
    el = R.bone("lowerarm_l").x

    R.fitted("Under", ["pelvis", "thigh", "calf", "upperarm", "neck"], "dark", offset=0.003)
    R.fitted("Coat", ["spine", "clavicle"], "coat", offset=0.009)
    R.fitted("Sleeves", ["upperarm"], "coat", offset=0.011, keep_skin=True, where=lambda p: abs(p.x) < el - 0.09)
    P.arm_band(R, "gold", 0.6, offset=0.013, thick=0.006)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.008)
    R.cuffs("gold", at=(0.08, 0.94), offset=0.012, thick=0.006)
    R.boots("leather", top=z["ankle"] + 0.1, cuff="gold")
    lo, hi = z["ankle"] + 0.11, z["knee"] - 0.05
    R.fitted("Wraps", ["calf"], "wrap", offset=0.008, below=hi, above=lo)
    for n in "lr":
        f = R.piece(f"calf_{n}")
        for i in range(6):
            zz = lo + (hi - lo) * (i + 0.5) / 6
            c, r = R.leg_r(n, zz)
            f.torus("dark", c + V(0, 0, 0.0), r + 0.01, 0.0035, normal=(0.12 if i % 2 else -0.12, 0, 1), seg=(16, 4))

    # the coat's short skirt, open in front; a leather belt and the sword strap
    hem = z["hip"] - 0.2
    R.skirt("coat", hem=hem, flare=1.34, depth=1.15, arc=(0.4, 2 * PI - 0.4), trim="gold", trim_h=0.014, seg=40)
    R.band("leather", z["waist"], height=0.06, grow=1.14, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", V(0, cw.y - ryw * 1.27, z["waist"]), (0.03, 0.012, 0.026), seg=(10, 8))
    fs, pt = P.strap(R, "leather", width=0.036, lift=0.2, grow=1.08, out=0.012, high_side=-1)
    fs.ellipsoid("gold", pt(0.0) + V(0, -0.012, 0), (0.022, 0.01, 0.022), seg=(10, 6))
    f = R.piece("near")
    for s in (1, -1):  # gold edges down the coat's front
        f.tube("gold", [P.surf(R, zz, a * s, out=0.014) for zz, a in ((z["neck"] - 0.07, 0.5), (z["chest"] + 0.02, 0.2), (z["chest"] - 0.1, 0.12), (z["waist"] + 0.03, 0.1))], 0.005, seg=6)

    # the cloth mask over the lower face
    zm = P.face_z(R, 0.37)
    hc = R.head_piece()[1]
    R.fitted("Mask", ["Head"], "dark", offset=0.004, keep_skin=True, where=lambda p: p.z < zm and p.y < hc.y + 0.05)
    f, c, r = R.head_piece()
    f.tube("dark", P.outline(R, zm - 0.004, -1.15, 1.15, n=14, out=0.004, win=0.12), 0.0045, seg=5)

    # white hair swept back like wind: thin tufts off the crown and the back of the head
    for k, (x, up0, y0, ln, rise) in enumerate(((0.0, 0.98, 0.0, 0.17, 0.05), (0.035, 0.93, 0.01, 0.16, 0.03), (-0.035, 0.93, 0.01, 0.16, 0.03), (0.062, 0.72, 0.03, 0.14, 0.0),
                                               (-0.062, 0.72, 0.03, 0.14, 0.0), (0.02, 0.62, 0.06, 0.14, -0.035), (-0.03, 0.5, 0.07, 0.12, -0.06))):
        b = c + V(x, 0.03 + y0, r * up0)
        P.blade(f, hair, b, b + V(x * 0.4, ln, rise), 0.022, (0.2 * (1 if x > 0 else -1 if x < 0 else 0), -0.35, 1), thick=0.32, belly=0.3, root=0.8, bend=(0, 0, 0.012))

    # the jade scarf: wound twice round the neck, two long tails streaming back
    f = R.piece("spine_03")
    nc = V(0, ny - 0.018, z["neck"] + 0.012)
    f.torus("scarf", nc, 0.083, 0.04, normal=(0.1, 0.12, 1), seg=(24, 8))
    f.torus("scarf", nc + V(0, 0.004, 0.04), 0.074, 0.034, normal=(-0.12, -0.05, 1), seg=(24, 8))
    for k, (sx, pts, w) in enumerate(((1, [(0.05, 0.1, 0.0), (0.1, 0.27, -0.05), (0.13, 0.43, -0.2), (0.1, 0.56, -0.42), (0.16, 0.72, -0.6), (0.27, 0.9, -0.69), (0.36, 1.1, -0.66)], 0.065),
                                      (-1, [(0.04, 0.1, -0.01), (0.1, 0.25, -0.1), (0.15, 0.36, -0.3), (0.12, 0.46, -0.5), (0.2, 0.58, -0.62)], 0.05))):
        path = [nc + V(x * sx, y, dz) for x, y, dz in pts]
        P.ribbon(f, "scarf", path, lambda t, w=w: w * (0.75 + 0.35 * math.sin(PI * t) + 0.25 * t), lambda t, sx=sx: (0.55 * sx * math.cos(3.2 * t), -0.2, 1.0), k=5)

    # the curved blade
    f, o, d, up = R.held("r")
    out = V(-1, 0, 0)
    f.tube("leather", [o - d * 0.12, o + d * 0.05], 0.014, seg=8)
    f.ellipsoid("gold", o - d * 0.13, (0.02, 0.02, 0.02), seg=(10, 8))
    f.ellipsoid("gold", o + d * 0.06, (0.045, 0.014, 0.03), seg=(12, 8))
    P.blade(f, "edge", o + d * 0.06, o + d * 0.98 - out * 0.1, 0.033, up, thick=0.05, belly=0.55, root=0.8, bend=out * 0.085, n=12)
    P.blade(f, "steel", o + d * 0.06 - out * 0.004, o + d * 0.955 - out * 0.1, 0.026, up, thick=0.2, belly=0.55, root=0.8, bend=out * 0.08, n=12)
    return R
