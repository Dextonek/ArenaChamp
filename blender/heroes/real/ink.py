"""Shiori, the Last Brush (mage): a slim woman in a rice-paper robe with bell sleeves, its hem washed in black ink, a
crossed indigo collar, a wide indigo sash with a vermilion cord and a seal tassel, long black hair tied down her back
with a brush-shaped hairpin in the bun, paper talismans floating at her shoulders, and a calligraphy brush taller than
she is in the left hand, bristles down, wet and black. The vermilion seals are the one glow."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import back_y, bell_sleeves, box, ellipse, flats, hair_key, legs_under, on_back, on_front, on_ring, plate, skirt_band, skirt_rings, staff_back


def build():
    R = Real("ink", sex="f", height=0.98, width=0.94, depth=0.94, skin="#f4e3d3")
    z = R.z
    R.mat("paper", "#efe6d2", rough=0.8, double=True)
    R.mat("ink", "#0b0a0e", rough=0.4, double=True)
    R.mat("wash", "#55535f", rough=0.7, double=True)
    R.mat("indigo", "#27348c", rough=0.6, double=True)
    R.mat("seal", "#ff6a48", rough=0.4, emit="#ff4a2a", strength=0.9)
    R.mat("wood", "#6a4428", rough=0.6)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.hair("Hair_Long", "#100e14", rough=0.35)
    hk = hair_key(R)

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm"], "paper", offset=0.007)
    R.fitted("Under", ["lowerarm"], "indigo", offset=0.004)
    legs_under(R, "ink", offset=0.003)
    R.boots("ink", top=z["ankle"] + 0.08)
    R.cuffs("gold", at=(0.95,), offset=0.007, thick=0.006)
    bell_sleeves(R, "paper", k0=1.35, k1=3.0, t0=0.02, drop=0.62, trim="ink", trim_r=0.013)

    # the robe's skirt, its hem washed in ink: a black band and strokes rising out of it
    hem = z["ankle"] + 0.035
    flare = 1.62
    R.skirt("paper", hem=hem, flare=flare, depth=1.2)
    rings = skirt_rings(R, hem, flare, 1.2)
    f = R.piece(R.hang_w(z["waist"], hem))
    skirt_band(f, "wash", rings, hem + 0.1, hem + 0.2, off=0.004)
    skirt_band(f, "ink", rings, hem - 0.004, hem + 0.13, off=0.006)
    for k, (a, wd, hgt, key) in enumerate(((0.35, 0.11, 0.07, "ink"), (1.3, 0.14, 0.05, "ink"), (2.2, 0.1, 0.085, "ink"), (3.3, 0.15, 0.055, "ink"), (4.3, 0.11, 0.075, "ink"),
                                           (5.4, 0.13, 0.05, "ink"), (0.9, 0.12, 0.06, "wash"), (2.8, 0.14, 0.07, "wash"), (4.9, 0.12, 0.055, "wash"))):
        base = hem + (0.125 if key == "ink" else 0.195)
        lobe = [(-wd, 0), (wd, 0), (wd * 0.85, hgt * 0.4), (wd * 0.55, hgt * 0.78), (wd * 0.15, hgt), (-wd * 0.3, hgt * 0.9), (-wd * 0.7, hgt * 0.55)]
        on_ring(f, key, rings, a, base, lobe, thick=0.004, off=0.007 if key == "ink" else 0.005)

    # the crossed collar and the sash (an obi) with its vermilion cord, a flat knot at the back, the seal tassel
    R.collar("indigo", height=0.04, grow=1.12)
    f = R.piece("near")
    for s in (1, -1):
        pts = [on_front(R, x, zz, 0.013) for x, zz in ((0.075 * s, z["neck"] - 0.01), (0.055 * s, z["chest"] + 0.1), (0.01 * s, z["chest"] - 0.03), (-0.045 * s, z["waist"] + 0.07))]
        f.tube("indigo", pts, 0.02, seg=7, squash=((0, 1, 0), 0.4))
    zs = z["waist"] + 0.015
    R.band("indigo", zs, height=0.14, grow=1.1)
    cs, rxs, rys = R.ring(zs)
    f = R.piece("pelvis")
    f.tube("seal", ellipse(cs, rxs * 1.135, rys * 1.17, PI, 3 * PI, n=40), 0.007, seg=5)
    kb = on_back(R, 0, zs, 0.035)
    box(f, "indigo", kb, (0.12, 0.03, 0.085))
    box(f, "indigo", kb + Vector((0, 0.02, -0.01)), (0.045, 0.025, 0.1))
    t0 = Vector((0.085, cs.y - rys * 1.2, zs))
    f.tube("seal", [t0, t0 + Vector((0.008, -0.012, -0.1)), t0 + Vector((0.01, -0.015, -0.19))], 0.005, seg=5)
    box(f, "seal", t0 + Vector((0.01, -0.016, -0.215)), (0.021, 0.021, 0.028))
    f.tube("seal", [t0 + Vector((0.01, -0.016, -0.24)), t0 + Vector((0.012, -0.02, -0.34))], [0.016, 0.022], seg=7)
    f.torus("gold", t0 + Vector((0.01, -0.016, -0.245)), 0.017, 0.005, seg=(12, 5))

    # the hair: a bun with a brush-shaped pin, and a long tail tied down the back
    f, c, r = R.head_piece()
    bun = Vector((0, c.y + 0.07, z["top"] - 0.015))
    f.ellipsoid(hk, bun, (0.052, 0.052, 0.045), seg=(14, 10))
    a, b = bun + Vector((-0.15, 0.015, -0.02)), bun + Vector((0.13, -0.01, 0.045))
    f.tube("wood", [a, b], 0.006, seg=6)
    f.tube("ink", [b, b + (b - a).normalized() * 0.03, b + (b - a).normalized() * 0.075], [0.006, 0.014, 0.001], seg=6)
    f.ellipsoid("gold", a, (0.011, 0.011, 0.011), seg=(8, 6))
    f = R.piece("spine_03")
    tail = [Vector((0, back_y(R, 0, zz) + off, zz)) for zz, off in ((z["neck"] + 0.02, 0.035), (z["chest"] + 0.09, 0.04), (z["chest"] - 0.05, 0.045), (z["waist"] + 0.07, 0.05),
                                                                  (z["waist"] - 0.04, 0.06))]
    f.tube(hk, tail, [0.045, 0.05, 0.042, 0.03, 0.006], seg=10, squash=((0, 1, 0), 0.55))
    f.torus("seal", tail[2] + Vector((0, 0, -0.03)), 0.04, 0.008, seg=(14, 5))

    # paper talismans floating at her shoulders, a vermilion mark on both faces of each
    for x, y, zz, tilt in ((0.34, 0.14, z["neck"] + 0.2, 0.16), (-0.36, 0.12, z["neck"] + 0.12, -0.2), (-0.26, 0.2, z["neck"] + 0.42, 0.1), (0.25, 0.22, z["neck"] + 0.46, -0.12)):
        u = Vector((math.cos(tilt), 0.25 * (1 if x > 0 else -1), math.sin(tilt))).normalized()
        v = Vector((-math.sin(tilt), 0, math.cos(tilt))).normalized()
        p = Vector((x, y, zz))
        plate(f, "paper", p, [(-0.036, -0.1), (0.036, -0.1), (0.036, 0.1), (-0.036, 0.1)], u, v, 0.006)
        plate(f, "seal", p + v * 0.025, [(-0.016, -0.03), (0.016, -0.03), (0.016, 0.03), (-0.016, 0.03)], u, v, 0.012)
        plate(f, "ink", p - v * 0.045, [(-0.02, -0.006), (0.02, -0.006), (0.02, 0.006), (-0.02, 0.006)], u, v, 0.011)

    # the brush: bristles down to the floor, a gold ferrule, a wooden shaft, a vermilion cord at the top
    f, o, d, up = R.held("l")
    L = staff_back(R)
    f.tube("wood", [o - d * (L - 0.3), o + d * 0.52], 0.018, seg=8)
    f.tube("gold", [o - d * (L - 0.26), o - d * (L - 0.33)], [0.026, 0.034], seg=10)
    f.tube("ink", [o - d * (L - 0.32), o - d * (L - 0.25), o - d * (L - 0.14), o - d * (L - 0.05), o - d * L], [0.03, 0.062, 0.07, 0.04, 0.003], seg=12)
    f.tube("gold", [o + d * 0.5, o + d * 0.56], 0.023, seg=8)
    f.ellipsoid("gold", o + d * 0.57, (0.024, 0.024, 0.024), seg=(10, 8))
    f.torus("seal", o + d * 0.61, 0.03, 0.006, normal=d.cross(up), seg=(14, 5))
    f.tube("seal", [o + d * 0.5 - up * 0.02, o + d * 0.44 - up * 0.07, o + d * 0.34 - up * 0.09], [0.006, 0.012, 0.018], seg=6)
    return flats(R)
