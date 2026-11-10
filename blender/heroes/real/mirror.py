"""Silvane, the Mirror Duchess (marksman): tall and calm. A floor-length gown in dark violet with a silver-violet front
panel, gold edges and a gold hem, a silver-violet bodice with puffed shoulders, dark opera gloves, sleek violet hair in
one smooth fall down her back, a standing collar of eight silver mirror shards with violet glass inlays fanned behind
her head, and the hand mirror held up in the left hand, its pale blue glass on both faces the one glowing piece."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import FINGERS, back_y, disc, edge_line, flats, hair_key, legs_under, plate, shard, skirt_band, skirt_rings


def build():
    R = Real("mirror", sex="f", height=1.07, width=0.97, depth=0.97, skin="#f1e2e4")
    z = R.z
    R.mat("gown", "#2a1a48", rough=0.55, double=True)
    R.mat("silver", "#c6cedb", rough=0.2, metal=0.9)
    R.mat("bodice", "#8a80b4", rough=0.55, metal=0.12, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("dark", "#151226", rough=0.5)
    R.mat("inlay", "#b48cf0", rough=0.15, metal=0.3, emit="#7a4ad0", strength=0.25)
    R.mat("glass", "#eef6ff", rough=0.1, emit="#cfe6ff", strength=1.0)
    R.hair("Hair_SimpleParted", "#5b3a8e", rough=0.3)
    hk = hair_key(R)

    R.fitted("Bodice", ["spine", "pelvis", "clavicle"], "bodice", offset=0.007)
    R.fitted("Gloves", lambda i: R.dom[i].startswith(("lowerarm",) + FINGERS), "dark", offset=0.005)
    legs_under(R, "dark", offset=0.003)
    R.boots("dark", top=z["ankle"] + 0.08, toe="gold")
    R.cuffs("gold", at=(0.04,), offset=0.008, thick=0.007)
    for s, n in ((1, "l"), (-1, "r")):   # puffed shoulders, a gold band under each
        f = R.piece(f"upperarm_{n}")
        sh = R.bone(f"upperarm_{n}")
        f.ellipsoid("bodice", sh + Vector((0.045 * s, 0, 0.005)), (0.08, 0.07, 0.062), seg=(18, 12))
        c, r = R.arm_r(n, 0.52, bones=("upperarm", "lowerarm"))
        f.torus("gold", Vector((sh.x + 0.105 * s, c.y, c.z)), r + 0.01, 0.008, normal=(1, 0, 0), seg=(20, 6))

    # the gown: dark violet to the floor, a silver-violet panel down the front between gold edges, a gold hem
    hem = z["ankle"] + 0.03
    flare = 1.95
    R.skirt("gown", hem=hem, flare=flare, depth=1.2, trim="gold", trim_h=0.03)
    rings = skirt_rings(R, hem, flare, 1.2)
    f = R.piece(R.hang_w(z["waist"], hem))
    skirt_band(f, "bodice", rings, hem + 0.03, z["waist"], off=0.006, arc=(-0.34, 0.34), seg=8, steps=6)
    for a in (-0.34, 0.34):
        edge_line(f, "gold", rings, a, hem + 0.03, z["waist"], r=0.008, off=0.008, n=10)
    R.band("gold", z["waist"], height=0.045, grow=1.1, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    shard(R.piece("pelvis"), "inlay", Vector((0, cw.y - ryw * 1.22, z["waist"] + 0.04)), Vector((0, cw.y - ryw * 1.25, z["waist"] - 0.07)), 0.03, n=4, mid=0.38, flat=((0, 1, 0), 0.5))
    f, gem = R.collar("gold", height=0.035, grow=1.05)
    shard(f, "glass", gem + Vector((0, -0.01, 0.02)), gem + Vector((0, -0.012, -0.05)), 0.02, n=4, mid=0.4, flat=((0, 1, 0), 0.5))
    f.tube("gold", [gem + Vector((-0.09, 0.05, 0.03)), gem + Vector((-0.045, 0.0, -0.015)), gem + Vector((0, -0.012, -0.03)), gem + Vector((0.045, 0.0, -0.015)), gem + Vector((0.09, 0.05, 0.03))], 0.005, seg=5)

    # the hair's one smooth fall, and a small silver tiara
    f, c, r = R.head_piece()
    f.torus("silver", c + Vector((0, 0.01, r * 0.62)), r * 0.97, 0.006, normal=(0, 0.3, 1), seg=(26, 5))
    shard(f, "inlay", c + Vector((0, -r * 0.97, r * 0.45)), c + Vector((0, -r * 0.99, r * 0.3 + 0.04)), 0.01, n=4, mid=0.35, flat=((0, 1, 0), 0.5))
    f.ellipsoid(hk, c + Vector((0, 0.045, 0.01)), (r * 1.02, r * 1.02, r * 1.06), seg=(18, 12), keep=lambda co: co.y > c.y + 0.02)
    f.tube(hk, [c + Vector((0, 0.09, 0.02)), c + Vector((0, 0.115, -0.1)), Vector((0, back_y(R, 0, z["neck"]) + 0.05, z["neck"] + 0.01))], [0.07, 0.075, 0.062], seg=12, squash=((0, 1, 0), 0.6))
    f = R.piece("spine_03")
    fall = [Vector((0, back_y(R, 0, zz) + off, zz)) for zz, off in ((z["neck"] + 0.03, 0.045), (z["chest"] + 0.08, 0.04), (z["chest"] - 0.06, 0.04), (z["waist"] + 0.06, 0.04))]
    f.tube(hk, fall, [0.062, 0.058, 0.045, 0.006], seg=12, squash=((0, 1, 0), 0.5))

    # the standing collar: eight mirror shards fanned behind her head, violet glass set in each
    base = Vector((0, back_y(R, 0, z["neck"] - 0.02) + 0.075, z["neck"] - 0.03))
    for k in range(8):
        a = (-66 + 132 * k / 7) * PI / 180
        mid = abs(k - 3.5)
        ln = 0.56 - 0.06 * mid
        way = Vector((math.sin(a), 0.2, math.cos(a))).normalized()
        across = way.cross(Vector((0, 1, 0))).normalized()
        p = base + way * 0.13
        wd = 0.058
        plate(f, "silver", p, [(0, 0), (wd, ln * 0.36), (0, ln), (-wd, ln * 0.36)], across, way, 0.014)
        plate(f, "inlay", p + way * ln * 0.2, [(0, 0), (wd * 0.42, ln * 0.19), (0, ln * 0.5), (-wd * 0.42, ln * 0.19)], across, way, 0.022)
    f.torus("silver", base + Vector((0, 0.02, 0.0)), 0.15, 0.014, normal=(0, 1, -0.2), seg=(20, 6), arc=(-0.25, PI + 0.25))

    # the hand mirror, held up in the left hand: a gold frame, glass on both faces
    f, o, d, up = R.held("l")
    side = d.cross(up)
    f.tube("gold", [o - d * 0.11, o + d * 0.15], [0.012, 0.017], seg=8)
    f.ellipsoid("gold", o - d * 0.12, (0.022, 0.022, 0.022), seg=(10, 8))
    m = o + d * 0.325
    f.torus("gold", m, 0.158, 0.016, normal=side, seg=(36, 8))
    disc(f, "glass", m, side, 0.152, thick=0.014, seg=28)
    shard(f, "silver", m + d * 0.165, m + d * 0.28, 0.03, n=4, mid=0.35, flat=(tuple(side), 0.5))
    for s in (1, -1):
        shard(f, "silver", m + d * 0.115 + up * 0.115 * s, m + d * 0.185 + up * 0.195 * s, 0.02, n=4, mid=0.35, flat=(tuple(side), 0.5))
    f.torus("gold", o + d * 0.155, 0.024, 0.008, normal=d, seg=(12, 5))
    return flats(R)
