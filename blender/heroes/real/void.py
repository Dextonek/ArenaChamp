"""Oblivion, the Unmaker (juggernaut): a tower of black plate. A horned great-helm with one glowing eye slit, layered
spiked pauldrons, a rift core glowing in the chest with cracks running from it, long straight tassets, a tattered cape
in four tails, armoured legs and hands, and a greatsword with a glowing void edge in the right hand."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import FINGERS, blade, ellipse, flats, on_front, path, shard


def build():
    R = Real("void", sex="m", height=1.14, width=1.2, depth=1.28, head=0.9)
    z = R.z
    R.mat("plate", "#221f2b", rough=0.36, metal=0.8, double=True)
    R.mat("under", "#0b0a0e", rough=0.7)
    R.mat("iron", "#56505e", rough=0.38, metal=0.85)
    R.mat("rift", "#ff5a7a", rough=0.3, emit="#ff2a55", strength=1.0)
    R.mat("cape", "#170d1a", rough=0.85, double=True)
    R.mat("void", "#0d0b12", rough=0.22, metal=0.9)
    R.faceless()

    R.fitted("Under", lambda i: not R.dom[i].startswith("Head"), "under", offset=0.004)
    R.fitted("Cuirass", ["spine", "clavicle"], "plate", offset=0.03, keep_skin=True)
    R.fitted("Arms", ["upperarm", "lowerarm"], "plate", offset=0.02, keep_skin=True)
    R.fitted("Gauntlets", lambda i: R.dom[i].startswith(FINGERS), "plate", offset=0.011, keep_skin=True)
    R.fitted("Legs", lambda i: R.dom[i].startswith(("thigh", "calf")) and R.world[i].z < z["hip"] - 0.05, "plate", offset=0.02, keep_skin=True)
    R.boots("plate", top=z["knee"] - 0.05, toe="iron", offset=0.026)
    R.cuffs("iron", at=(0.06, 0.5, 0.95), offset=0.024, thick=0.011)
    for n in "lr":
        k = R.bone(f"calf_{n}")
        f = R.piece(f"calf_{n}")
        f.ellipsoid("iron", k + Vector((0, -0.065, 0.0)), (0.062, 0.04, 0.075), seg=(12, 8))
        shard(f, "iron", k + Vector((0, -0.08, -0.02)), k + Vector((0, -0.16, 0.05)), 0.022, n=4, mid=0.2)
        c, r = R.leg_r(n, z["knee"] - 0.05)
        f.torus("iron", c, r + 0.03, 0.011, seg=(22, 6))

    # the gorget, the belt and the long tassets
    R.collar("plate", height=0.1, grow=1.75)
    R.band("iron", z["waist"] - 0.02, height=0.085, grow=1.3)
    hem = z["knee"] + 0.04
    for a0, a1 in ((-0.62, -0.06), (0.06, 0.62), (0.72, 1.75), (-1.75, -0.72), (1.85, PI - 0.05), (PI + 0.05, 2 * PI - 1.85)):
        R.skirt("plate", hem=hem, flare=1.22, depth=1.12, top=z["waist"] - 0.03, arc=(a0, a1), trim="iron", trim_h=0.03, seg=6, grow=1.14)
    cw, rxw, ryw = R.ring(z["waist"] - 0.02)
    f = R.piece("pelvis")
    shard(f, "rift", Vector((0, cw.y - ryw * 1.42, z["waist"] + 0.035)), Vector((0, cw.y - ryw * 1.42, z["waist"] - 0.09)), 0.04, n=4, mid=0.4, flat=((0, 1, 0), 0.5))

    # the rift core in the chest and the cracks running from it
    f = R.piece("spine_03")
    g = on_front(R, 0, z["chest"] + 0.05, off=0.04)
    shard(f, "rift", g + Vector((0, 0, 0.13)), g + Vector((0, 0, -0.17)), 0.062, n=6, mid=0.42, flat=((0, 1, 0), 0.45))
    for k in range(8):
        a = 2 * PI * (k + 0.5) / 8
        shard(f, "iron", g + Vector((0.07 * math.cos(a), 0.012, 0.11 * math.sin(a) - 0.02)), g + Vector((0.15 * math.cos(a), 0.02, 0.2 * math.sin(a) - 0.02)), 0.022, n=4, mid=0.25)
    for pts in (((0.05, 0.02), (0.11, 0.07), (0.13, 0.13), (0.19, 0.16)), ((-0.05, 0.0), (-0.1, -0.06), (-0.16, -0.07), (-0.19, -0.14)),
                ((0.04, -0.1), (0.09, -0.17), (0.07, -0.25)), ((-0.04, 0.09), (-0.1, 0.13), (-0.12, 0.19))):
        f.tube("rift", [on_front(R, x, g.z + dz, off=0.034) for x, dz in pts], [0.008] * (len(pts) - 1) + [0.002], seg=5)

    # layered spiked pauldrons: the upper lame stays with the shoulder, the lower follows the arm
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        f = R.piece(f"upperarm_{n}")
        f.ellipsoid("plate", sh + Vector((0.1 * s, 0, 0.0)), (0.135, 0.125, 0.085), seg=(18, 10))
        f.torus("iron", sh + Vector((0.12 * s, 0, -0.02)), 0.118, 0.01, normal=(1 * s, 0, 0.5), seg=(24, 6))
        f = R.piece(f"clavicle_{n}")
        c = sh + Vector((0.0, 0, 0.07))
        f.ellipsoid("plate", c, (0.16, 0.14, 0.09), seg=(20, 10))
        f.torus("iron", c + Vector((0.03 * s, 0, -0.02)), 0.142, 0.011, normal=(0.6 * s, 0, 1), seg=(26, 6))
        for dx, dy, ln, rr in ((0.03, 0.0, 0.27, 0.042), (0.09, -0.07, 0.17, 0.032), (0.09, 0.07, 0.17, 0.032), (-0.05, 0.0, 0.16, 0.03)):
            b = c + Vector((dx * s, dy, 0.05))
            f.tube("iron", [b, b + Vector(((0.05 + dx * 0.9) * s, dy * 0.6, ln))], [rr, 0.002], seg=6)
        f.tube("rift", [c + Vector((-0.1 * s, -0.09, 0.05)), c + Vector((-0.02 * s, -0.125, 0.045)), c + Vector((0.06 * s, -0.115, 0.01)), c + Vector((0.1 * s, -0.1, -0.05))], [0.007, 0.008, 0.007, 0.002], seg=5)

    # the tattered cape: four tails of different lengths, each ending in rags
    cc, rxc, ryc = R.ring(z["chest"])
    cn, rxn, ryn = R.ring(z["neck"] - 0.05, dz=0.02)
    hip, chest = z["hip"], z["chest"]

    def cw_(co):
        if co.z > chest:
            return {"spine_03": 1.0}
        if co.z > hip:
            t = (co.z - hip) / (chest - hip)
            return {"spine_03": t, "pelvis": 1 - t}
        return {"pelvis": 1.0}
    f = R.piece(cw_)
    for k, (a, low) in enumerate(((PI - 0.84, z["knee"] - 0.12), (PI - 0.28, z["ankle"] + 0.2), (PI + 0.28, z["ankle"] + 0.3), (PI + 0.84, z["knee"] - 0.02))):
        rings = [(Vector((0, cc.y + 0.05, low)), 0.44, 0.38), (Vector((0, cc.y + 0.035, hip)), 0.34, 0.28),
                 (Vector((0, cc.y + 0.02, chest)), rxc * 1.2, ryc * 1.45), (Vector((0, cc.y + 0.01, z["neck"] - 0.04)), rxn * 0.95, ryn * 1.1)]
        f.loft("cape", rings, arc=(a - 0.27, a + 0.27), seg=5)
        for da, ln in ((-0.17, 0.2), (0.0, 0.13), (0.17, 0.24)):
            aa = a + da
            p = Vector((0.44 * math.sin(aa), cc.y + 0.05 - 0.38 * math.cos(aa), low + 0.03))
            f.tube("cape", [p, p + Vector((0, 0, -ln))], [0.05, 0.002], seg=6, squash=((math.sin(aa), -math.cos(aa), 0), 0.08))

    # the great-helm: a tall bucket, a ridge down the face, the glowing slit, two great horns
    f, c, r = R.head_piece()
    hc = Vector((0, c.y + 0.012, 0))
    rx, ry = r * 1.36, r * 1.62
    z0, z1 = z["head"] - 0.045, z["top"] + 0.012
    f.loft("plate", [(hc + Vector((0, 0, z0)), rx * 1.06, ry * 1.04), (hc + Vector((0, 0, z0 + 0.1)), rx, ry), (hc + Vector((0, 0, z1 - 0.05)), rx * 0.97, ry * 0.97),
                     (hc + Vector((0, 0, z1)), rx * 0.86, ry * 0.86), (hc + Vector((0, 0, z1 + 0.03)), rx * 0.5, ry * 0.5), (hc + Vector((0, 0, z1 + 0.04)), 0.004, 0.004)], seg=24)
    f.tube("iron", ellipse(hc, rx * 1.07, ry * 1.05, n=28, z=z0), 0.012, seg=6)
    ez = z["head"] + (z["top"] - z["head"]) * 0.52
    f.tube("rift", ellipse(hc, rx * 1.0, ry * 1.0, -0.95, 0.95, n=14, z=ez), [0.004] + [0.012] * 13 + [0.004], seg=6, squash=((0, 0, 1), 0.7))
    f.tube("iron", ellipse(hc, rx * 1.02, ry * 1.02, -1.15, 1.15, n=14, z=ez + 0.028), 0.01, seg=6)
    f.tube("iron", ellipse(hc, rx * 1.02, ry * 1.02, -1.15, 1.15, n=14, z=ez - 0.028), 0.01, seg=6)
    f.tube("iron", [Vector((0, hc.y - ry * 0.9, z1 + 0.02)), Vector((0, hc.y - ry * 1.04, z1 - 0.06)), Vector((0, hc.y - ry * 1.06, ez + 0.03))], [0.008, 0.014, 0.016], seg=6)
    f.tube("iron", [Vector((0, hc.y - ry * 1.06, ez - 0.03)), Vector((0, hc.y - ry * 1.1, z0))], [0.016, 0.02], seg=6)
    for s in (1, -1):
        b = Vector((rx * 0.9 * s, hc.y + 0.01, ez + 0.07))
        horn = path([b, b + Vector((0.12 * s, 0.0, 0.03)), b + Vector((0.2 * s, -0.02, 0.17)), b + Vector((0.17 * s, -0.05, 0.36)), b + Vector((0.1 * s, -0.07, 0.5))], 5)
        m = len(horn) - 1
        f.tube("iron", horn, [0.052 * (1 - i / m) ** 0.8 + 0.003 for i in range(m + 1)], seg=9)
        f.torus("plate", b + Vector((0.02 * s, 0, 0.005)), 0.056, 0.012, normal=(1, 0, 0.25 * s), seg=(18, 6))

    # the greatsword: a slab of void, its edge glowing
    f, o, d, up = R.held("r")
    f.tube("under", [o - d * 0.2, o + d * 0.1], 0.02, seg=8)
    shard(f, "iron", o - d * 0.3, o - d * 0.17, 0.04, n=6, mid=0.55)
    f.tube("iron", [o + d * 0.11 - up * 0.2, o + d * 0.1 - up * 0.1, o + d * 0.1 + up * 0.1, o + d * 0.11 + up * 0.2], [0.006, 0.03, 0.03, 0.006], seg=8)
    shard(f, "rift", o + d * 0.06, o + d * 0.2, 0.034, n=4, mid=0.4, flat=(tuple(d.cross(up)), 1.3))
    ln = 1.12
    blade(f, "void", o + d * 0.12, d, up, ln, 0.19, thick=0.04, tip=0.2, root=0.14)
    for s in (1, -1):
        f.tube("rift", [o + d * 0.14 + up * 0.072 * s, o + d * (0.12 + ln * 0.8) + up * 0.097 * s, o + d * (0.12 + ln)], [0.009, 0.009, 0.003], seg=5)
    f.tube("rift", [o + d * 0.3, o + d * (0.12 + ln * 0.62)], [0.01, 0.002], seg=5)
    return flats(R)
