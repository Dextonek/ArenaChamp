"""Referee Whistler, the Arbiter (controller): an arena judge, short and stern. Dark lacquered armour with gold edges,
small pauldrons, dark greaves with gold knee guards, a black and ivory striped tabard hanging front and back, a black
helm with a gold brow band and a red crest. A silver horn on a gold chain across the chest, and red and gold sigil
tablets at the belt, two in front and a larger one behind, their sigils glowing."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("referee", sex="m", height=0.86, width=0.96, depth=1.0, head=1.1, skin="#d6a884")
    z = R.z
    R.mat("armor", "#2a2630", rough=0.32, metal=0.6)
    R.mat("cloth", "#1d1a22", rough=0.8, double=True)
    R.mat("ivory", "#cbc4b0", rough=0.78, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("red", "#9a2a30", rough=0.55, double=True)
    R.mat("silver", "#c9cfd8", rough=0.25, metal=0.9)
    R.mat("sigil", "#ff7a42", rough=0.3, emit="#ff5a2a", strength=1.0)
    R.hair(None, "#1c181e")

    R.fitted("Under", ["spine", "pelvis", "clavicle", "upperarm", "thigh", "calf"], "cloth", offset=0.005)
    R.fitted("Cuirass", ["spine_02", "spine_03", "clavicle"], "armor", offset=0.02, keep_skin=True)
    R.fitted("Vambraces", ["lowerarm"], "armor", offset=0.013)
    P.gloves(R, "cloth")
    R.boots("armor", top=z["knee"] + 0.05, cuff="gold", toe="gold")
    R.cuffs("gold", at=(0.07, 0.95), offset=0.013)
    R.pauldrons("armor", size=(0.105, 0.095, 0.055), lift=0.045, out=0.035)
    for s, n in ((1, "l"), (-1, "r")):
        R.piece(f"upperarm_{n}").torus("gold", R.bone(f"upperarm_{n}") + Vector((0.035 * s, 0, 0.032)), 0.092, 0.008, normal=(0, 0.3, 1), seg=(24, 6))
        k = R.bone(f"calf_{n}")
        R.piece(f"calf_{n}").ellipsoid("gold", k + Vector((0, -0.06, 0.0)), (0.05, 0.03, 0.055), seg=(12, 8))
    P.collar(R, "armor", height=0.065, grow=1.25, flare=0.05, rim="gold")

    # the striped tabard, front and back: black and ivory, gold at its edges
    hem = z["knee"] - 0.03
    half, n = 0.66, 5
    rings = P.skirt_rings(R, hem, flare=1.28, depth=1.2)
    cw, rxw, ryw = rings[-1]
    pol = lambda a: math.atan2(rxw * math.sin(a), ryw * math.cos(a))   # the same place on the trunk as on the skirt's rings
    low = R.piece(R.hang_w(z["waist"], hem))
    up = R.piece(P.trunk_w(R, hem))
    top = z["neck"] - 0.075
    for back in (0.0, PI):
        for k in range(n):
            a0, a1 = -half + 2 * half * k / n, -half + 2 * half * (k + 1) / n
            key = "cloth" if k % 2 else "ivory"
            P.cloth(low, key, rings, arc=(back + a0, back + a1), seg=3, rows=8, off=0.012)
            P.wrap(R, up, key, z["waist"] - 0.005, top, back + pol(a0), back + pol(a1), off=0.03, seg=3, rows=8)
        P.cloth(low, "gold", rings, arc=(back - half, back + half), seg=12, rows=1, z0=hem - 0.004, z1=hem + 0.028, off=0.017)
        for s in (1, -1):
            P.seam(low, "gold", rings, back + half * s, r=0.008, off=0.013)
            P.band_on(R, up, "gold", [(z["waist"], back + pol(half) * s), (top, back + pol(half) * s)], 0.016, thick=0.012, off=0.031)
        P.band_on(R, up, "gold", [(top, back - pol(half)), (top, back + pol(half))], 0.016, thick=0.012, off=0.031)
    R.band("gold", z["waist"], height=0.055, grow=1.3, how=R.hang_w(z["waist"], hem))

    # the sigil tablets at the belt: two in front, a larger one behind
    f = R.piece("pelvis")
    for a, sc in ((0.95, 1.0), (-0.95, 1.0), (PI, 1.45)):
        c, rx, ry = P.ring_at(rings, z["waist"] - 0.1 * sc)
        nrm = Vector((math.sin(a), -math.cos(a), 0))
        tan = Vector((math.cos(a), math.sin(a), 0))
        p = Vector((c.x + (rx + 0.03) * math.sin(a), c.y - (ry + 0.03) * math.cos(a), c.z))
        P.box(f, "gold", p, (0.046 * sc, 0.008, 0.07 * sc), ax=tan, ay=nrm)
        P.box(f, "red", p + nrm * 0.006, (0.038 * sc, 0.008, 0.062 * sc), ax=tan, ay=nrm)
        f.star("sigil", p + nrm * 0.016, 0.034 * sc, 0.012 * sc, thick=0.006, points=4, normal=nrm, turn=PI / 4)
        f.ellipsoid("sigil", p + nrm * 0.016, (0.012 * sc,) * 3, seg=(8, 6))
        f.tube("gold", [p + Vector((0, 0, 0.07 * sc)), p + Vector((0, 0, 0.1 * sc)) - nrm * 0.012], 0.005, seg=5)
    f.flat.update(("gold", "red", "sigil"))

    # the silver horn on its gold chain across the chest
    f = R.piece("spine_02")
    P.band_on(R, f, "gold", [(z["neck"] - 0.06, 0.95), (z["chest"] + 0.02, 0.35), (z["chest"] - 0.1, -0.35), (z["waist"] + 0.1, -0.85), (z["chest"] - 0.02, -1.6)], 0.014, thick=0.012,
              off=0.036, n=28)
    pts, nrm = P.trunk_path(R, [(z["chest"] - 0.03, -0.95), (z["chest"] - 0.11, -0.5), (z["chest"] - 0.15, -0.05), (z["chest"] - 0.13, 0.42)], off=0.075, n=12)
    rad = [0.012 + 0.058 * (k / 12) ** 2.2 for k in range(13)]
    pts[-1] = pts[-1] + nrm[-1] * 0.03
    f.tube("silver", pts, rad, seg=12)
    f.torus("gold", pts[-1], rad[-1] + 0.003, 0.008, normal=pts[-1] - pts[-2], seg=(18, 6))
    f.ellipsoid("cloth", pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.002, (rad[-1] * 0.82, rad[-1] * 0.82, 0.006), seg=(14, 6), rot=P.rot_to(pts[-1] - pts[-2]))
    f.torus("gold", pts[4], rad[4] + 0.003, 0.006, normal=pts[5] - pts[3], seg=(14, 6))
    f.ellipsoid("gold", pts[0], (0.016, 0.016, 0.016), seg=(8, 6))

    # the helm: black, a gold brow band, a nasal, a red crest front to back
    R.bald()
    H = P.head(R)
    f = R.piece("Head")
    hc, hr = H.c + Vector((0, 0.004, 0.012)), (H.rx * 1.15, H.ry * 1.13, H.rz * 1.15)
    P.shell(f, "armor", hc, hr, P.rim_line(0.3, -0.5, -0.8, w0=0.6, w1=1.05), seg=36, rows=9, rim="gold", rim_r=0.009)
    f.tube("gold", [P.on_shell(hc, (hr[0] + 0.004, hr[1] + 0.004, hr[2]), a, 0.4)[0] for a in [(-1.25 + 2.5 * k / 12) for k in range(13)]], 0.012, seg=6, squash=((0, 1, 0), 0.6))
    big = (hr[0], hr[1] + 0.004, hr[2] + 0.004)
    stations = [(0, 0.62), (0, 0.82), (0, 0.95), (0, 1.0), (PI, 0.95), (PI, 0.8), (PI, 0.55), (PI, 0.2), (PI, -0.2)]
    P.hull(f, "gold", [P.on_shell(hc, big, a, e)[0] for a, e in stations], 0.02, 0.012, seg=8)
    hgt = [0.012, 0.045, 0.06, 0.065, 0.065, 0.06, 0.05, 0.035, 0.012]
    crest = []
    for (a, e), h in zip(stations, hgt):
        p, n = P.on_shell(hc, big, a, e)
        crest.append(p + n * (h + 0.006))
    P.hull(f, "red", crest, 0.017, hgt, seg=10)
    return R
