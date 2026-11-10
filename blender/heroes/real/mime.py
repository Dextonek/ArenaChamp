"""Mum, the Silent One (controller): a masked harlequin, thin and still. A smooth porcelain mask with big dark eyes, gold
tear lines, a gold diamond on the brow and a small closed mouth, a dark hood, an ivory ruff, a long dark violet coat to
the shins with ivory diamonds down the front, the back and the sleeves, gold trim. Her hands are the body's own, a third
bigger, in pale gloves with gold cuffs and a faint glow: the one thing she talks with. A long violet ribbon, tied at
the nape, trails behind her. She fights with her hands."""
import math

from mathutils import Matrix, Vector

from realkit import PI, Real
from real.parts_b import FINGERS, arm_top, back_y, big_hands, diamond, flats, front_y, hood, legs_under, on_ring, path, plate, skirt_rings


def build():
    R = Real("mime", sex="f", height=1.04, width=0.9, depth=0.9, head=1.08)
    big_hands(R, 1.34)
    z = R.z
    R.mat("coat", "#2b1c50", rough=0.6, double=True)
    R.mat("dark", "#15121e", rough=0.65, double=True)
    R.mat("ivory", "#ece5d2", rough=0.7, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glove", "#efe9dc", rough=0.5, emit="#cfd4ff", strength=0.3)
    R.mat("mask", "#f7f5ee", rough=0.22)
    R.mat("ribbon", "#4c3290", rough=0.55, double=True)
    R.faceless()

    R.fitted("Neck", ["neck"], "dark", offset=0.004)
    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.008)
    legs_under(R, "dark", name="Leggings")
    R.fitted("Gloves", lambda i: R.dom[i].startswith(FINGERS), "glove", offset=0.006)
    R.boots("dark", top=z["knee"] - 0.12, toe="gold")
    R.cuffs("gold", at=(0.84, 0.97), offset=0.013, thick=0.011)
    for n in "lr":   # a flared gold cuff over the wrist
        f = R.piece(f"lowerarm_{n}")
        c0, r0 = R.arm_r(n, 0.84)
        c1, r1 = R.arm_r(n, 0.99)
        f.tube("gold", [c0, c1], [r0 + 0.012, r1 + 0.03], seg=14, caps=False)

    # the coat's skirt to the shins, gold at the hem, a gold sash
    hem = z["knee"] - 0.2
    flare = 1.45
    R.skirt("coat", hem=hem, flare=flare, depth=1.2, trim="gold", trim_h=0.025)
    rings = skirt_rings(R, hem, flare, 1.2)
    R.band("gold", z["waist"], height=0.035, grow=1.1, how=R.hang_w(z["waist"], hem))

    # ivory diamonds: down the front and the back of the skirt and the chest, on the sleeves
    f = R.piece(R.hang_w(z["waist"], hem))
    for a in (0.0, PI):
        for k in range(4):
            zz = z["waist"] - 0.13 - 0.165 * k
            s = 1 + 0.12 * k
            on_ring(f, "ivory", rings, a, zz, diamond(0.05 * s, 0.075), thick=0.006, off=0.006)
    f = R.piece("near")
    for k in range(3):
        zz = z["neck"] - 0.14 - 0.13 * k
        yf = front_y(R, 0, zz, dx=0.02, dz=0.02) - 0.012
        plate(f, "ivory", Vector((0, yf, zz)), diamond(0.042, 0.06), (1, 0, 0), (0, 0, 1), 0.007)
        yb = back_y(R, 0, zz, dx=0.03, dz=0.02) + 0.012
        plate(f, "ivory", Vector((0, yb, zz)), diamond(0.042, 0.06), (1, 0, 0), (0, 0, 1), 0.007)
    for n in "lr":
        for bones, ts, bone in ((("upperarm", "lowerarm"), (0.55,), "upperarm"), (("lowerarm", "hand"), (0.3, 0.62), "lowerarm")):
            f = R.piece(f"{bone}_{n}")
            for t in ts:
                for way, v in (((0, 0, 1), (0, 1, 0)), ((0, 0, -1), (0, 1, 0)), ((0, -1, 0), (0, 0, 1)), ((0, 1, 0), (0, 0, 1))):
                    plate(f, "ivory", arm_top(R, n, t, way, bones=bones, off=0.005), diamond(0.06, 0.026), (1, 0, 0), v, 0.006)

    # the ivory ruff: two rings of pleats round the neck
    cn = Vector((0, R.ring(z["neck"], dz=0.02)[0].y - 0.012, z["neck"] + 0.005))
    f = R.piece("spine_03")
    for tier, (rad, ln, n, dz) in enumerate(((0.105, 0.075, 16, 0.0), (0.085, 0.055, 14, 0.03))):
        for k in range(n):
            a = 2 * PI * (k + 0.5 * tier) / n
            p = cn + Vector((rad * math.sin(a), -rad * math.cos(a), dz - 0.012 * tier))
            f.ellipsoid("ivory", p, (ln, 0.026, 0.02), seg=(8, 6), rot=Matrix.Rotation(a - PI / 2, 4, "Z"))
    f.torus("gold", cn + Vector((0, 0, 0.05)), 0.066, 0.006, seg=(22, 5))

    # the hood and the mask
    f, c, r = R.head_piece()
    hc = Vector((0, c.y + 0.03, c.z - 0.012))
    hr = 0.125
    hood(f, "dark", hc, hr, open_y=0.36, edge="gold", edge_r=0.007, tail=1.15)
    mc = Vector((0, hc.y - 0.02, hc.z - 0.008))
    mrx, mry, mrz = 0.094, 0.112, 0.128
    f.ellipsoid("mask", mc, (mrx, mry, mrz), seg=(28, 18))
    f.ellipsoid("mask", mc + Vector((0, -mry * 0.86, -0.02)), (0.011, 0.02, 0.028), seg=(10, 8))   # the hint of a nose

    def on_mask(x, dz, off=0.0):
        q = max(0.0, 1 - (x / mrx) ** 2 - (dz / mrz) ** 2)
        return Vector((x, mc.y - mry * math.sqrt(q) - off, mc.z + dz))
    for s in (1, -1):
        e = on_mask(0.04 * s, 0.022, 0.001)
        f.ellipsoid("dark", e, (0.027, 0.01, 0.019), seg=(14, 8), rot=Matrix.Rotation(-0.2 * s, 4, "Y"))
        f.tube("gold", [on_mask(0.04 * s, 0.0, 0.003), on_mask(0.043 * s, -0.04, 0.003), on_mask(0.04 * s, -0.075, 0.003)], [0.004, 0.0035, 0.001], seg=5)
    f.tube("dark", [on_mask(-0.014, -0.068, 0.002), on_mask(0, -0.071, 0.003), on_mask(0.014, -0.068, 0.002)], 0.0035, seg=5)
    b = on_mask(0, 0.08, 0.004)
    plate(f, "gold", b, diamond(0.014, 0.024), (1, 0, 0), on_mask(0, 0.1, 0.004) - on_mask(0, 0.06, 0.004), 0.008)

    # the ribbon: a bow at the nape and two long tails trailing behind
    y0 = back_y(R, 0, z["neck"] - 0.07) + 0.03
    k0 = Vector((0, y0 + 0.03, z["neck"] - 0.05))
    f = R.piece("spine_03")
    f.ellipsoid("ribbon", k0, (0.035, 0.03, 0.035), seg=(10, 8))
    for s in (1, -1):
        f.tube("ribbon", [k0, k0 + Vector((0.1 * s, 0.03, 0.05)), k0 + Vector((0.17 * s, 0.05, 0.0)), k0 + Vector((0.08 * s, 0.03, -0.03)), k0], [0.02, 0.05, 0.05, 0.035, 0.02], seg=8, squash=((0, 1, 0), 0.22))
    for s, ln, dx in ((1, 0.95, 0.1), (-1, 0.72, -0.14)):
        pts = path([k0, k0 + Vector((dx * 0.5, 0.1 * ln, -0.1 * ln)), k0 + Vector((dx * 1.6, 0.34 * ln, -0.3 * ln)), k0 + Vector((dx * 0.6, 0.55 * ln, -0.62 * ln)),
                    k0 + Vector((dx * 1.8, 0.72 * ln, -0.9 * ln))], 6)
        m = len(pts) - 1
        f.tube("ribbon", pts, [0.03 + 0.03 * math.sin(PI * min(1.0, i / m * 1.2)) for i in range(m + 1)], seg=8, squash=((0.2 * s, 1, 0.9), 0.14))
        f.tube("gold", [pts[-1] + Vector((-0.04, 0.0, 0.004)), pts[-1] + Vector((0.04, 0.0, -0.004))], 0.007, seg=5)
    return flats(R)
