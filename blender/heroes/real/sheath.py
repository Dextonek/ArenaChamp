"""Kagen, the Scarlet Sheath (melee assassin): a tall, lean, calm swordsman of about 38 (docs/heroes/new/sheath-card.html).
A Northerner (docs/lore/codex/peoples/north.md): umber skin, star lines along the jaw, dark hair drawn back into one long
braid tied with a cinnabar cord, a pale scar across the left brow and cheek.
Dress: a grey under-kimono with a pale paper-white collar, a black haori-like coat to mid-thigh with wide sleeves lined in
cinnabar and gold at its front edges, a wide cinnabar sash (obi) with a knot and cord ends, charcoal hakama to below the
knee, paper-white leg wraps crossed in black, dark split-toe boots. One black lacquer shoulder guard of three plates on
the LEFT shoulder only, laced in cinnabar, edged in gold.
Held: the katana in the RIGHT hand (black wrapped grip with cinnabar diamonds, an oval gold guard, a long slim curved
blade with a pale edge line). Worn: the scarlet sheath, empty, thrust through the sash at the LEFT hip and slanting back,
gold at its mouth and tip, two paper seals bound round it with black ink lines, its cord tied at the sash.
"""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real import parts_b as PB
from real import parts_c as PC
from real.parts_a import V
from real.parts_d import star_lines, back_of_head, paint_px, line_w, on_face


def build():
    R = Real("sheath", sex="m", height=1.03, width=0.86, depth=0.84, skin="#6a4430")
    z = R.z
    R.mat("coat", "#16131a", rough=0.62, double=True)
    R.mat("under", "#9a989e", rough=0.72, double=True)
    R.mat("hakama", "#2a2a30", rough=0.75, double=True)
    R.mat("cinnabar", "#cf4a1c", rough=0.55, double=True)
    R.mat("lacquer", "#c2401a", rough=0.18, metal=0.05)
    R.mat("black", "#0e0c0e", rough=0.2, metal=0.05)
    R.mat("foil", "#ebe8e2", rough=0.62, double=True)
    R.mat("ink", "#141012", rough=0.6)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("steel", "#cdd4da", rough=0.16, metal=0.92)
    R.mat("edge", "#fff4ea", rough=0.15, emit="#ffd8c0", strength=0.55)
    R.mat("leather", "#1e1a1a", rough=0.55)

    # ---- the head: dark hair drawn back into one long braid, star lines, a scar ----------------------------------
    R.hair("Hair_SimpleParted", "#1e1714", rough=0.5)
    hk = [k for k in R.M if k.startswith("hair_")][-1]
    star_lines(R, color="#2c4590", width=0.0034, dots=0.0038, seed=11)
    eye, _ = R.eye_box()
    top = back_of_head(R, 0.0, eye.z + 0.01, out=0.02)
    PA_braid = P.braid
    PA_braid(R, hk, [top, top + Vector((0.0, 0.03, -0.07)), top + Vector((0.0, 0.05, -0.16)), top + Vector((0.0, 0.06, -0.26))],
             r0=0.022, r1=0.012, n=14, head_n=3)
    f, hc, hr = R.head_piece()
    f.torus("cinnabar", top + Vector((0, 0.022, -0.05)), 0.02, 0.006, normal=(0, 0.45, -1), seg=(14, 5))
    f.tube("cinnabar", [top + Vector((0.01, 0.03, -0.055)), top + Vector((0.03, 0.05, -0.1)), top + Vector((0.025, 0.06, -0.14))], 0.0035, seg=5)
    # the scar: a pale line over the left brow and down the cheek
    a = on_face(R, 0.022, eye.z + 0.042)
    b = on_face(R, 0.062, eye.z - 0.05)
    paint_px(R, lambda Pp: line_w(Pp, [a, a.lerp(b, 0.5), b], 0.0026), "#8e5a48", 0.8, groups=("Head",))

    # ---- under-kimono, coat, wide sleeves -------------------------------------------------------------------------
    R.fitted("Under", ["pelvis", "spine", "clavicle", "upperarm", "neck"], "under", offset=0.004, where=lambda p: p.z < z["neck"] - 0.03 or abs(p.x) > 0.08)
    cy = R.ring(z["chest"])[0].y

    def open_v(p):  # the coat lies open in a V from the collar to the sash, showing the grey under-robe
        k = max(0.0, min(1.0, (p.z - z["waist"]) / (z["neck"] - z["waist"])))
        return p.y < cy - 0.02 and abs(p.x) < 0.012 + 0.1 * k ** 1.3
    R.fitted("Coat", ["spine", "clavicle", "upperarm", "neck"], "coat", offset=0.011,
             where=lambda p: (p.z < z["neck"] - 0.035 or abs(p.x) > 0.09) and not open_v(p))
    R.fitted("Forearm", ["lowerarm"], "under", offset=0.005)
    el = R.bone("lowerarm_l").x
    for n in "lr":
        # the wide kimono sleeve: hangs from the elbow, open, lined in cinnabar
        c0, r0 = R.arm_r(n, 0.0)
        c1, r1 = R.arm_r(n, 0.62)
        g = R.piece(f"lowerarm_{n}")
        pts = [c0, c0.lerp(c1, 0.5) + V(0, 0, -0.03), c1 + V(0, 0, -0.07)]
        rad = [r0 + 0.02, r0 + 0.05, r1 + 0.085]
        g.tube("coat", pts, rad, seg=16, caps=False)
        g.tube("cinnabar", [pts[-1] - (pts[-1] - pts[-2]).normalized() * 0.012, pts[-1]], [rad[-1] - 0.004, rad[-1] - 0.004], seg=16, caps=False)
        g.torus("gold", pts[-1], rad[-1] + 0.002, 0.004, normal=(pts[-1] - pts[-2]), seg=(22, 5))

    # the collar: the under-kimono's pale band crossing left over right, the coat's black band over it
    neck_top = z["neck"] - 0.02
    fa = R.piece("spine_03")
    for key, out, w, dz in (("foil", 0.016, 0.03, 0.0), ("coat", 0.024, 0.036, -0.022)):
        for s in (1, -1):
            pts = [P.surf(R, zz, aa * s, out=out) for zz, aa in ((neck_top + dz, 1.15), (neck_top - 0.05 + dz, 0.6), (z["chest"] - 0.02 + dz, 0.18),
                                                                (z["waist"] + 0.08, 0.02 * -s))]
            P.ribbon(fa, key, pts, lambda t, w=w: w, lambda t: (0, -1, 0), k=6)
    f2 = R.piece("near")
    for s in (1, -1):  # gold down the coat's open front edges
        f2.tube("gold", [P.surf(R, zz, a * s, out=0.03) for zz, a in ((neck_top - 0.03, 0.75), (z["chest"] - 0.01, 0.3), (z["waist"] + 0.05, 0.22))], 0.0045, seg=6)

    # ---- the crest: a red noon sun in a pale ring, large on the back, small on each breast ----------------------
    fb = R.piece("spine_03")
    for zz, a, r in (((z["chest"] + z["neck"]) / 2 - 0.02, PI, 0.075), (z["chest"] + 0.02, 0.62, 0.028), (z["chest"] + 0.02, -0.62, 0.028)):
        c = P.surf(R, zz, a, out=0.016)
        n = Vector((c.x, c.y - R.ring(zz)[0].y, 0)).normalized()
        PB.disc(fb, "foil", c, n, r, thick=0.005)
        PB.disc(fb, "cinnabar", c + n * 0.003, n, r * 0.72, thick=0.005)

    # ---- the coat's skirt to mid-thigh, open at the front; the hakama under it to below the knee -------------------
    hk_hem = z["knee"] - 0.12
    PC.skirt(R, "hakama", hk_hem, flare=1.4, depth=1.15, folds=14, amp=0.02, grow=1.02, seg=56, trim="ink", trim_h=0.012)
    coat_hem = (z["hip"] + z["knee"]) / 2 - 0.02
    gap = 0.34
    fc, rings = PC.skirt(R, "coat", coat_hem, flare=1.32, depth=1.12, arc=(gap, 2 * PI - gap), folds=8, amp=0.016, grow=1.1, seg=48,
                         trim="gold", trim_h=0.012)
    PC.cloth(fc, "cinnabar", rings, arc=(gap, gap + 0.05), seg=2, rows=10, off=-0.004)
    PC.cloth(fc, "cinnabar", rings, arc=(2 * PI - gap - 0.05, 2 * PI - gap), seg=2, rows=10, off=-0.004)
    for s in (1, -1):
        PC.seam(fc, "gold", rings, gap if s > 0 else 2 * PI - gap, r=0.0045, off=0.006)

    # ---- the cinnabar sash, its knot and cord ends ----------------------------------------------------------------
    R.band("cinnabar", z["waist"] + 0.01, height=0.11, grow=1.16)
    R.band("gold", z["waist"] + 0.065, height=0.008, grow=1.18)
    R.band("gold", z["waist"] - 0.045, height=0.008, grow=1.18)
    cw, rxw, ryw = R.ring(z["waist"])
    fk = R.piece("pelvis")
    knot = V(-rxw * 0.42, cw.y - ryw * 1.3, z["waist"] + 0.005)
    fk.ellipsoid("cinnabar", knot, (0.04, 0.022, 0.034), seg=(12, 8))
    for dx, ln in ((-0.012, 0.16), (0.016, 0.12)):
        fk.tube("cinnabar", [knot + V(dx, -0.004, -0.02), knot + V(dx * 1.6, -0.01, -0.02 - ln * 0.5), knot + V(dx * 2.2, -0.006, -0.02 - ln)],
                [0.018, 0.017, 0.015], seg=8, squash=((0, 1, 0), 0.3))
        fk.ellipsoid("gold", knot + V(dx * 2.2, -0.006, -0.025 - ln), (0.009, 0.009, 0.014), seg=(8, 6))

    # ---- leg wraps, boots -----------------------------------------------------------------------------------------
    R.boots("leather", top=z["ankle"] + 0.05)
    lo, hi = z["ankle"] + 0.04, z["knee"] - 0.04
    R.fitted("Wraps", ["calf"], "foil", offset=0.008, below=hi, above=lo)
    for n in "lr":
        g = R.piece(f"calf_{n}")
        for i in range(5):
            zz = lo + (hi - lo) * (i + 0.5) / 5
            c, r = R.leg_r(n, zz)
            g.torus("ink", c, r + 0.011, 0.0035, normal=(0.16 if i % 2 else -0.16, 0, 1), seg=(16, 4))

    # ---- one lacquer shoulder guard, left shoulder only: three plates laced in cinnabar ---------------------------
    sh = R.bone("upperarm_l")
    el_l = R.bone("lowerarm_l")
    g = R.piece("upperarm_l")
    for i in range(3):
        t = 0.08 + i * 0.16
        c = sh.lerp(el_l, t) + V(0.0, 0.0, 0.075 - i * 0.012)
        PB.plate(g, "black", c, [(0.14 * math.cos(a), 0.115 * math.sin(a)) for a in [2 * PI * k / 20 for k in range(20)]], Vector((1, 0, 0)), Vector((0, 1, 0)), thick=0.012)
        g.tube("gold", [c + V(-0.13, -0.045, 0.007), c + V(-0.07, -0.098, 0.008), c + V(0.0, -0.116, 0.008), c + V(0.07, -0.098, 0.008), c + V(0.13, -0.045, 0.007)], 0.005, seg=5, caps=True)
        for dy in (-0.035, 0.035):
            g.tube("cinnabar", [c + V(0.05, dy, 0.009), c + V(0.05, dy, -0.02)], 0.006, seg=5)
            g.tube("cinnabar", [c + V(-0.05, dy, 0.009), c + V(-0.05, dy, -0.02)], 0.006, seg=5)

    # ---- the katana in the right hand ------------------------------------------------------------------------------
    f, o, d, up = R.held("r")
    out = V(-1, 0, 0)
    f.tube("black", [o - d * 0.2, o + d * 0.055], [0.0155, 0.0165], seg=8, squash=(tuple(up), 0.8))
    for i in range(6):  # the cinnabar wrap's diamonds
        f.ellipsoid("cinnabar", o - d * (0.17 - i * 0.04) + up * 0.0, (0.017, 0.006, 0.011), seg=(8, 4))
    f.ellipsoid("gold", o - d * 0.205, (0.017, 0.02, 0.016), seg=(10, 8))
    PB.disc(f, "gold", o + d * 0.065, d, 0.042, thick=0.008, ry=0.034)
    f.tube("gold", [o + d * 0.07, o + d * 0.1], 0.016, seg=8, squash=(tuple(up), 0.6))
    P.blade(f, "steel", o + d * 0.1, o + d * 1.0 - out * 0.06, 0.023, up, thick=0.26, belly=0.9, root=0.97, bend=out * 0.05, n=14, tip=0.002)
    P.blade(f, "edge", o + d * 0.1 + out * 0.017, o + d * 0.985 - out * 0.05, 0.007, up, thick=0.6, belly=0.92, root=0.98, bend=out * 0.05, n=14, tip=0.0015)
    f.tube("cinnabar", [o - d * 0.205, o - d * 0.23 + V(0, 0, -0.03), o - d * 0.215 + V(0, 0, -0.07)], 0.004, seg=5)

    # ---- the scarlet sheath, empty, through the sash at the left hip, slanting back -------------------------------
    fs = R.piece("pelvis")
    mouth = V(rxw * 1.12, cw.y - ryw * 0.55, z["waist"] - 0.005)
    way = Vector((0.18, 0.86, -0.48)).normalized()
    side = way.cross(Vector((0, 0, 1))).normalized()
    curve = way.cross(side).normalized()  # the sheath bows a little upward, edge up
    L = 0.9
    pts = [mouth + way * (L * k / 8) - curve * (0.035 * math.sin(PI * k / 8)) for k in range(9)]
    fs.tube("lacquer", pts, [0.021] * 8 + [0.018], seg=12, squash=(tuple(side), 0.62))
    fs.tube("gold", [pts[0] - way * 0.005, pts[0] + way * 0.035], 0.024, seg=12, squash=(tuple(side), 0.66))
    fs.tube("gold", [pts[-1] - way * 0.05, pts[-1] + way * 0.012], [0.021, 0.016], seg=12, squash=(tuple(side), 0.66))
    for t in (0.22, 0.42):  # the two paper seals bound round it, inked
        k = t * 8
        i = int(k)
        p = pts[i].lerp(pts[i + 1], k - i)
        fs.tube("foil", [p - way * 0.04, p + way * 0.04], 0.0245, seg=12, squash=(tuple(side), 0.66))
        for dd in (-0.022, 0.0, 0.022):
            fs.tube("ink", [p + way * dd - way * 0.004, p + way * dd + way * 0.004], 0.026, seg=12, squash=(tuple(side), 0.66))
        tail = p + curve * 0.0 - Vector((0, 0, 0.03))
        P.ribbon(fs, "foil", [p - Vector((0, 0, 0.02)), tail - Vector((0, 0, 0.04)), tail - Vector((-0.005, 0, 0.09))], lambda tt: 0.016 * (1 - 0.3 * tt), lambda tt: tuple(side), k=4)
    # the cord: from the mouth, round the sash, two short tails
    fs.tube("cinnabar", [pts[1] + V(0, 0, 0.015), mouth + V(-0.03, -0.03, 0.02), mouth + V(-0.06, -0.035, -0.04), mouth + V(-0.05, -0.03, -0.11)], 0.005, seg=5)
    return R
