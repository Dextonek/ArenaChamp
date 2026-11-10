"""Sirix, the Swarm Warden (melee bruiser): broad. Black chitin plate with amber stripes over a dark under-layer, a
crested insect helm with big amber eye lenses, mandibles and antennae, hexagonal pauldrons, bracers, serrated claw
gauntlets on both hands (attack = claw), and two pairs of pale insect wings rising up and out behind the shoulders (the
fore wing long, to about head height; the hind wing shorter, spreading outward), amber leading edges, dark veins (the
user's fix of 2026-11-10, shapes after blender/heroes/sirix_wings.py)."""
import math

from mathutils import Matrix, Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V

FINGERS = ["hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"]


def wings(R):
    z = R.z
    cc, rx, ry = R.ring(z["chest"])
    f = R.piece("spine_03")
    back_y = cc.y + ry + 0.04
    # (root height, direction out-back-up for the left side, length, widest width)
    specs = [(z["chest"] + 0.1, V(0.62, 0.42, 0.66), 0.8, 0.27), (z["chest"] + 0.02, V(0.86, 0.42, 0.06), 0.6, 0.22)]

    def wd(t):
        return math.sin(PI * min(1.0, t ** 0.75)) ** 0.8
    for sx in (1, -1):
        for rz, d, length, width in specs:
            root = V(0.06 * sx, back_y, rz)
            u = V(d.x * sx, d.y, d.z).normalized()
            w = V(0, 1, 0).cross(u).normalized()

            def at(a, c, root=root, u=u, w=w, sx=sx):
                return root + u * a + w * (c * sx)
            P.grid(f, "wing", lambda s, v, at=at, length=length, width=width: at(length * s, width * (0.28 * wd(s) * (1 - v) - 0.72 * wd(s) ** 0.9 * v)), 14, 3)
            f.tube("amber", [at(length * i / 14, 0.28 * width * wd(i / 14)) for i in range(15)], [0.009 * (1 - 0.6 * i / 14) + 0.003 for i in range(15)], seg=6)
            for k in (0.0, -0.3, -0.55):
                ts = [0.04 + 0.86 * i / 10 for i in range(11)]
                f.tube("vein", [at(length * t, k * width * wd(t)) for t in ts], [0.0045 * (1 - 0.5 * i / 10) for i in range(11)], seg=5)
        # where the wings leave the back
        f.ellipsoid("chitin", V(0.06 * sx, back_y - 0.01, z["chest"] + 0.06), (0.045, 0.035, 0.085), seg=(10, 8))


def build():
    R = Real("hive", sex="m", height=1.0, width=1.1, depth=1.1, head=0.96)
    z = R.z
    R.mat("chitin", "#211c12", rough=0.28, metal=0.55)
    R.mat("under", "#0f0c07", rough=0.7)
    R.mat("amber", "#e0a020", rough=0.35, metal=0.6)
    R.mat("lens", "#ffd24a", rough=0.2, emit="#f0b020", strength=1.0)
    R.mat("wing", "#f6e6b0", rough=0.3, double=True, alpha=0.38)
    R.mat("vein", "#3a2c12", rough=0.6)
    R.faceless()

    R.fitted("Under", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm", "thigh", "calf", "neck"] + FINGERS, "under", offset=0.004)
    R.fitted("Cuirass", ["spine_02", "spine_03", "clavicle"], "chitin", offset=0.022, keep_skin=True)
    R.fitted("Belly", ["spine_01", "pelvis"], "chitin", offset=0.013, above=z["hip"] - 0.03, keep_skin=True)
    R.fitted("Arms", ["upperarm"], "chitin", offset=0.013, keep_skin=True, where=lambda p: abs(p.x) < R.bone("lowerarm_l").x - 0.05)
    R.fitted("Bracers", ["lowerarm"], "chitin", offset=0.017, keep_skin=True)
    R.fitted("Gauntlets", ["hand_"], "chitin", offset=0.01, keep_skin=True)
    R.fitted("Cuisses", ["thigh"], "chitin", offset=0.013, keep_skin=True, below=z["hip"] - 0.12)
    R.boots("chitin", top=z["knee"] - 0.03, cuff="amber", toe="amber", offset=0.013)
    R.cuffs("amber", at=(0.07, 0.93), offset=0.022, thick=0.008)

    # amber stripes: the belt, two bands across the belly, a chevron on the breastplate, knee cops
    R.band("amber", z["waist"] - 0.015, height=0.035, grow=1.16)
    for dz in (0.07, 0.125):
        pts = P.outline(R, z["waist"] + dz, -1.25, 1.25, n=16, groups=("spine", "pelvis"), out=0.02)
        if pts:
            R.piece("near").tube("amber", pts, 0.007, seg=6)
    cc, rxc, ryc = R.ring(z["chest"])
    f = R.piece("spine_03")
    for k, dz in enumerate((0.07, 0.0)):
        y = cc.y - ryc - 0.028
        f.tube("amber", [V(-0.11 + 0.02 * k, y + 0.035, z["chest"] + dz + 0.05), V(0, y, z["chest"] + dz - 0.01), V(0.11 - 0.02 * k, y + 0.035, z["chest"] + dz + 0.05)], 0.009, seg=6)
    for n in "lr":
        k = R.bone(f"calf_{n}")
        f = R.piece(f"calf_{n}")
        f.ellipsoid("chitin", k + V(0, -0.062, 0.0), (0.055, 0.035, 0.065), seg=(6, 5))
        f.ellipsoid("amber", k + V(0, -0.09, 0.0), (0.018, 0.012, 0.024), seg=(6, 4))

    # tassets at the hips and a pointed loin plate
    for a0, a1 in ((0.55, 2.2), (-2.2, -0.55)):
        R.skirt("chitin", hem=z["hip"] - 0.2, flare=1.22, depth=1.1, arc=(a0, a1), seg=8, trim="amber", trim_h=0.014, grow=1.08)
    cw, rxw, ryw = R.ring(z["waist"])
    ch, rxh, ryh = R.ring(z["hip"])
    f = R.piece("pelvis")
    top = V(0, cw.y - ryw * 1.2 - 0.01, z["waist"] - 0.03)
    P.blade(f, "chitin", top, V(0, ch.y - ryh * 1.25 - 0.03, z["hip"] - 0.27), 0.085, (0, 1, 0.1), thick=0.16, belly=0.3, root=0.75)
    f.tube("amber", [top + V(0, -0.016, -0.03), top + V(0, -0.03, -0.22)], [0.008, 0.002], seg=5)

    # hexagonal pauldrons, two plates deep
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        sh = R.bone(f"upperarm_{n}")
        rot = Matrix.Rotation(-0.3 * s, 4, "Y")
        f.ellipsoid("chitin", sh + V(0.035 * s, 0, 0.05), (0.13, 0.12, 0.07), seg=(6, 5), rot=rot)
        f.torus("amber", sh + V(0.04 * s, 0, 0.04), 0.125, 0.009, normal=(0.3 * s, 0, 1), seg=(6, 6))
        f.ellipsoid("chitin", sh + V(0.115 * s, 0, 0.012), (0.085, 0.095, 0.05), seg=(6, 5), rot=Matrix.Rotation(-0.75 * s, 4, "Y"))
        f.tube("chitin", [sh + V(0.03 * s, 0, 0.1), sh + V(0.075 * s, 0, 0.2)], [0.03, 0.002], seg=6)

    # claw gauntlets: a knuckle plate and three long serrated claws on each hand
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"hand_{n}")
        h, m = R.bone(f"hand_{n}"), R.bone(f"middle_01_{n}")
        f.ellipsoid("chitin", h.lerp(m, 0.6) + V(0, 0, 0.022), (0.062, 0.055, 0.022), seg=(6, 5))
        f.ellipsoid("amber", h.lerp(m, 0.6) + V(0, 0, 0.04), (0.022, 0.02, 0.01), seg=(6, 4))
        for k in (-1, 0, 1):
            b = m + V(-0.01 * s, 0.03 * k, 0.02)
            tip = b + V(0.235 * s - 0.02 * abs(k) * s, 0.012 * k, -0.075)
            f.tube("amber", [b, b.lerp(tip, 0.55) + V(0, 0, 0.022), tip], [0.014, 0.011, 0.001], seg=6, squash=((0, 1, 0), 0.5))
            for j in (0.3, 0.5, 0.7):  # the serrations under each claw
                p = b.lerp(tip, j) + V(0, 0, 0.004)
                f.tube("amber", [p, p + V(-0.012 * s, 0, -0.026)], [0.006, 0.001], seg=4)

    # the helm: a long chitin skull, a crest from brow to nape, amber lenses, mandibles, antennae
    P.cowl(R, "chitin", grow=1.02, low=0.07, high=0.07)
    f, c, r = R.head_piece()
    c = c + V(0, 0.022, 0.0)
    f.ellipsoid("chitin", c, (0.108, 0.135, 0.128), seg=(22, 14))
    f.ellipsoid("chitin", c + V(0, -0.075, -0.075), (0.07, 0.075, 0.075), seg=(14, 10))
    crest = [c + V(0, 0.135 * math.sin(a), 0.128 * math.cos(a)) * 1.0 for a in [-1.25 + 3.2 * i / 12 for i in range(13)]]
    f.tube("chitin", crest, [0.012 + 0.075 * math.sin(PI * (i / 12) ** 0.8) for i in range(13)], seg=8, squash=((1, 0, 0), 0.16))
    f.tube("amber", [p + (p - c).normalized() * (0.01 + 0.07 * math.sin(PI * (i / 12) ** 0.8)) for i, p in enumerate(crest)], 0.006, seg=5)
    for s in (1, -1):
        e = c + V(0.062 * s, -0.092, 0.012)
        f.ellipsoid("lens", e, (0.03, 0.026, 0.062), seg=(12, 8), rot=Matrix.Rotation(0.55 * s, 4, "Z") @ Matrix.Rotation(0.62 * s, 4, "Y"))
        j = c + V(0.05 * s, -0.115, -0.105)
        f.tube("chitin", [j, j + V(0.02 * s, -0.03, -0.045), j + V(-0.028 * s, -0.045, -0.095)], [0.018, 0.014, 0.002], seg=6)
        f.tube("amber", [j + V(-0.012 * s, -0.04, -0.075), j + V(-0.028 * s, -0.045, -0.097)], [0.008, 0.001], seg=5)
        a0 = c + V(0.035 * s, -0.11, 0.075)
        f.tube("chitin", [a0, a0 + V(0.03 * s, -0.05, 0.1), a0 + V(0.07 * s, -0.01, 0.2), a0 + V(0.1 * s, 0.07, 0.25)], [0.008, 0.006, 0.005, 0.002], seg=5)

    wings(R)
    return R
