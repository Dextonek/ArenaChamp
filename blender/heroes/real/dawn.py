"""Auriel, the Dawn Paladin (support): young and upright. Ivory plate with gold trim (a mid ivory: near-white blooms under
the game's lights) over mail, a gold sun on the breastplate, tasset plates over a white skirt, golden hair swept back
into a long braid under a winged gold circlet, a pair of raised wings of light plates on gold arms behind her, a sword
of hard light in the RIGHT hand and a gold-rimmed kite shield on the LEFT forearm (hold = shield)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("dawn", sex="f", height=1.0, skin="#ead0bb")
    z = R.z
    R.mat("plate", "#cdc2a6", rough=0.33, metal=0.4)
    R.mat("cloth", "#dcd3c0", rough=0.65, double=True)
    R.mat("gold", "#e0a935", rough=0.28, metal=0.85)
    R.mat("mail", "#8e8068", rough=0.6, metal=0.3)
    R.mat("blue", "#5ec8ff", rough=0.2)
    R.mat("wing", "#efe4c8", rough=0.35, emit="#ffdc90", strength=0.35, double=True)
    R.mat("light", "#fff8e2", rough=0.3, emit="#ffe2a0", strength=1.0)
    hair = P.hair(R, "Hair_SimpleParted", "#d9b05c")
    cc, rxc, ryc = R.ring(z["chest"])

    R.fitted("Mail", ["pelvis", "upperarm", "thigh", "calf"], "mail", offset=0.004)
    R.fitted("Cuirass", ["spine", "clavicle"], "plate", offset=0.012)
    R.fitted("Vambraces", ["lowerarm"], "plate", offset=0.01)
    el = R.bone("lowerarm_l").x
    R.fitted("Rerebraces", ["upperarm"], "plate", offset=0.011, keep_skin=True, where=lambda p: R.bone("upperarm_l").x + 0.07 < abs(p.x) < el - 0.03)
    R.boots("plate", top=z["knee"] + 0.05, cuff="gold", toe="gold", offset=0.012)
    R.cuffs("gold", at=(0.07, 0.94), offset=0.016, thick=0.008)
    P.arm_band(R, "gold", 0.84, offset=0.016, thick=0.007)
    for n in "lr":
        k = R.bone(f"calf_{n}")
        f = R.piece(f"calf_{n}")
        f.ellipsoid("gold", k + V(0, -0.058, 0.005), (0.05, 0.032, 0.06), seg=(12, 8))
        f.ellipsoid("plate", k + V(0, -0.075, 0.005), (0.03, 0.02, 0.04), seg=(10, 6))

    # pauldrons: two ivory plates, gold rims
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        sh = R.bone(f"upperarm_{n}")
        f.ellipsoid("plate", sh + V(0.03 * s, 0, 0.04), (0.098, 0.088, 0.055), seg=(16, 8))
        f.torus("gold", sh + V(0.03 * s, 0, 0.03), 0.094, 0.008, normal=(0.25 * s, 0, 1), seg=(24, 6))
        f.ellipsoid("plate", sh + V(0.095 * s, 0, 0.012), (0.07, 0.075, 0.042), seg=(14, 8))
        f.torus("gold", sh + V(0.1 * s, 0, 0.0), 0.07, 0.006, normal=(0.7 * s, 0, 1), seg=(20, 6))

    # the sun on the breastplate, the gorget
    f = R.piece("spine_03")
    g = P.surf(R, z["chest"] + 0.095, 0, out=0.02)
    f.star("gold", g, 0.075, 0.034, thick=0.01, points=8, normal=(0, -1, 0.25), turn=PI / 8)
    f.ellipsoid("gold", g + V(0, -0.004, 0), (0.036, 0.014, 0.036), seg=(14, 8))
    f.ellipsoid("blue", g + V(0, -0.014, 0), (0.016, 0.008, 0.016), seg=(10, 6))
    fc, gem = R.collar("gold", height=0.05, grow=1.06)

    # the white skirt, tasset plates, a gold belt
    hem = z["knee"] - 0.07
    R.skirt("cloth", hem=hem, flare=1.62, depth=1.15, trim="gold", trim_h=0.022)
    for a0, a1 in ((0.42, 1.5), (-1.5, -0.42), (1.7, PI - 0.25), (PI + 0.25, 2 * PI - 1.7)):
        R.skirt("plate", hem=z["hip"] - 0.21, flare=1.36, depth=1.15, arc=(a0, a1), seg=8, trim="gold", trim_h=0.016, grow=1.07)
    sfn = P.skirt_fn(R, hem, 1.62, 1.15)
    hang = R.hang_w(z["waist"], hem)
    f = R.piece(hang)
    P.panel(R, f, "gold", sfn, -0.26, 0.26, z["waist"] - 0.02, z["knee"] + 0.1, out=0.014, nu=6, nv=6, taper=0.55)
    P.panel(R, f, "cloth", sfn, -0.19, 0.19, z["waist"] - 0.02, z["knee"] + 0.14, out=0.018, nu=6, nv=6, taper=0.6)
    sp = sfn(0, z["hip"] - 0.1, 0.022)
    f.star("gold", sp, 0.034, 0.015, thick=0.006, points=8, normal=(0, -1, 0.1), turn=PI / 8)
    R.band("gold", z["waist"], height=0.06, grow=1.13, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("blue", V(0, cw.y - ryw * 1.27, z["waist"]), (0.022, 0.01, 0.022), seg=(10, 6))

    # the winged circlet, the braid
    f, c, r = R.head_piece()
    zc = P.face_z(R, 0.7)
    P.hair_cap(R, hair, grow=1.07)
    band = P.outline(R, zc, -2.2, 2.2, n=24, out=0.014)
    f.tube("gold", band, 0.008, seg=6)
    front = band[len(band) // 2]
    f.ellipsoid("blue", front + V(0, -0.006, 0.004), (0.011, 0.007, 0.014), seg=(8, 6))
    f.tube("gold", [front + V(0, -0.004, 0.01), front + V(0, -0.012, 0.055)], [0.009, 0.001], seg=5)
    for s in (1, -1):
        t = band[len(band) // 2 + 7 * s]
        for k, (ln, rise) in enumerate(((0.15, 0.1), (0.125, 0.055), (0.095, 0.015))):
            P.blade(f, "gold", t + V(0.004 * s, 0.01 * k, 0), t + V(0.035 * s, ln * 0.82, rise), 0.024, (1, 0, 0), thick=0.14, belly=0.45, root=0.5)
    back = c + V(0, r * 1.02, -0.01)
    end = P.braid(R, hair, [back, back + V(0, 0.045, -0.1), V(0, cc.y + ryc + 0.05, z["chest"] + 0.05), V(0, cc.y + ryc + 0.04, z["chest"] - 0.12), V(0, cc.y + ryc + 0.045, z["waist"] + 0.02)],
                  r0=0.034, r1=0.02, n=11, head_n=2, clasp="gold")

    # the wings: a gold arm up to a wrist above her head, nine plates of light on each
    f = R.piece("spine_03")
    by = cc.y + ryc + 0.075
    for s in (1, -1):
        root, elbow, wrist = V(0.05 * s, by - 0.03, z["chest"] + 0.1), V(0.19 * s, by + 0.03, z["chest"] + 0.4), V(0.34 * s, by + 0.05, z["top"] + 0.2)
        arm = P.smooth([root, elbow, wrist], 6)
        f.tube("gold", arm, [0.02 - 0.008 * i / 12 for i in range(13)], seg=8)
        f.ellipsoid("gold", wrist, (0.024, 0.02, 0.024), seg=(10, 8))
        for i in range(9):
            t = i / 8
            b = arm[min(12, 3 + int(round(9 * t)))]
            th = -1.3 + 2.05 * t ** 0.85
            ln = 0.3 + 0.24 * math.sin(PI * t ** 0.8) + 0.1 * t
            tip = b + V(math.cos(th) * ln * s, 0.03 + 0.012 * i, math.sin(th) * ln)
            P.blade(f, "wing", b + V(0, 0.012 + 0.004 * i, 0), tip, 0.052, (0, 1, 0), thick=0.06, belly=0.55, root=0.45)

    # the sword of hard light
    f, o, d, up = R.held("r")
    out = V(-1, 0, 0)
    f.tube("mail", [o - d * 0.11, o + d * 0.05], 0.014, seg=8)
    f.ellipsoid("gold", o - d * 0.125, (0.022, 0.022, 0.022), seg=(10, 8))
    f.tube("gold", [o + d * 0.06 - out * 0.1, o + d * 0.045, o + d * 0.06 + out * 0.1], [0.008, 0.016, 0.008], seg=6)
    f.ellipsoid("blue", o + d * 0.05 + up * 0.012, (0.012, 0.012, 0.008), seg=(8, 6))
    P.blade(f, "light", o + d * 0.06, o + d * 0.98, 0.036, up, thick=0.16, belly=0.12, root=0.9, n=8)

    # the kite shield on the left forearm: its top toward the thumb, its point toward the elbow side
    f = R.piece("lowerarm_l")
    c0, r0 = R.arm_r("l", 0.55)
    sc = c0 + V(0, 0, r0 + 0.04)
    ys = (-0.27, -0.22, -0.08, 0.12, 0.4)
    f.tube("gold", [sc + V(0, y, -0.006) for y in ys], [0.07, 0.205, 0.225, 0.16, 0.003], seg=14, squash=((0, 0, 1), 0.1))
    f.tube("plate", [sc + V(0, y * 0.93 + 0.004, 0.004) for y in ys], [0.06, 0.18, 0.2, 0.14, 0.002], seg=14, squash=((0, 0, 1), 0.12))
    b = sc + V(0, -0.06, 0.026)
    f.star("gold", b, 0.09, 0.04, thick=0.008, points=8, normal=(0, 0, 1), turn=PI / 8)
    f.ellipsoid("gold", b, (0.04, 0.04, 0.02), seg=(12, 8))
    f.ellipsoid("blue", b + V(0, 0, 0.014), (0.018, 0.018, 0.01), seg=(10, 6))
    for t in (0.3, 0.8):  # the straps round the arm
        c1, r1 = R.arm_r("l", t)
        f.torus("mail", c1, r1 + 0.014, 0.008, normal=(1, 0, 0), seg=(16, 6))
    return R
