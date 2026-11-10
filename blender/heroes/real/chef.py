"""Madame Cleaver, the Feastmistress (support): a war cook, big and proud. A crimson leather jerkin over a mail shirt
with a mail collar, sleeves and hauberk skirt, a long dark leather apron front and back with a gold border, a wide
belt, a bandolier of small knives, dark leather bracers and boots, a crimson headwrap over auburn hair with a braid.
The great cleaver in the right hand, its edge a glowing ember, and a small iron cauldron on gold chains at her back."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("chef", sex="f", height=1.02, width=1.14, depth=1.2, head=0.94, skin="#d6a284")
    z = R.z
    R.mat("crimson", "#7c2230", rough=0.72, double=True)
    R.mat("mail", "#646872", rough=0.5, metal=0.6, double=True)
    R.mat("leather", "#34241f", rough=0.72, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("iron", "#35343c", rough=0.42, metal=0.65)
    R.mat("steel", "#9aa0ac", rough=0.3, metal=0.85)
    R.mat("ember", "#ff7a30", rough=0.3, emit="#ff5a18", strength=1.0)
    hair = P.hair(R, None, "#6a2c18")

    R.fitted("Mail", ["spine", "pelvis", "clavicle", "upperarm"], "mail", offset=0.006)
    R.fitted("Jerkin", ["spine", "clavicle"], "crimson", offset=0.016, keep_skin=True)
    R.fitted("Trousers", ["thigh", "calf"], "leather", offset=0.004)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.011)
    R.cuffs("gold", at=(0.08, 0.94), offset=0.013)
    R.boots("leather", top=z["knee"] - 0.03, cuff="gold")
    P.toes(R, "leather")
    R.pauldrons("leather", size=(0.08, 0.075, 0.04), lift=0.03, out=0.012)
    for s, n in ((1, "l"), (-1, "r")):
        R.piece(f"upperarm_{n}").torus("gold", R.bone(f"upperarm_{n}") + Vector((0.012 * s, 0, 0.03)), 0.078, 0.007, normal=(0, 0.25, 1), seg=(22, 6))
    f, gem, _ = P.collar(R, "mail", height=0.05, grow=1.3, rim="gold")

    # the hauberk's skirt, and the long leather apron over it, front and back, with a gold border
    P.skirt(R, "mail", z["knee"] + 0.2, flare=1.24, depth=1.2, folds=14, amp=0.006, seg=56, rows=6)
    hem = z["knee"] - 0.15
    rings = P.skirt_rings(R, hem, flare=1.5, depth=1.28, grow=1.09)
    f = R.piece(R.hang_w(z["waist"], hem))
    half = 0.82
    for back in (0.0, PI):
        arc = (back - half, back + half)
        P.cloth(f, "leather", rings, arc=arc, seg=20, rows=10, folds=9, amp=0.014, phase=back)
        P.cloth(f, "gold", rings, arc=arc, seg=20, rows=1, folds=9, amp=0.014, phase=back, z0=hem - 0.004, z1=hem + 0.03, off=0.005)
        for s in (1, -1):
            P.seam(f, "gold", rings, back + half * s, r=0.008, off=0.002)
    R.band("crimson", z["waist"], height=0.1, grow=1.24, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    b = R.piece("pelvis")
    b.torus("gold", Vector((0, cw.y - ryw * 1.34 - 0.006, z["waist"])), 0.042, 0.011, normal=(0, 1, 0), seg=(20, 6))
    b.ellipsoid("iron", Vector((0, cw.y - ryw * 1.34, z["waist"])), (0.036, 0.01, 0.036), seg=(12, 6))

    # the bandolier of small knives, from her right shoulder to her left hip
    f = R.piece("near")
    pts, nrm = P.band_on(R, f, "leather", [(z["neck"] - 0.05, -0.85), (z["chest"] + 0.02, -0.3), (z["chest"] - 0.11, 0.3), (z["waist"] + 0.06, 0.85)], 0.05, thick=0.012, off=0.024, n=24)
    for i in (5, 9, 13, 17):
        t = (pts[i + 1] - pts[i - 1]).normalized()
        side = nrm[i].cross(t).normalized()
        if side.z < 0:
            side = -side
        p = pts[i] + nrm[i] * 0.012
        f.tube("gold", [p + side * 0.012, p + side * 0.06], [0.01, 0.008], seg=6)
        f.ellipsoid("gold", p + side * 0.064, (0.012, 0.012, 0.012), seg=(8, 6))
        f.tube("steel", [p + side * 0.012, p - side * 0.03, p - side * 0.065], [0.013, 0.012, 0.002], seg=6, squash=(tuple(nrm[i]), 0.35))

    # the small iron cauldron on gold chains at her back
    cc, rxc, ryc = R.ring(z["chest"])
    f = R.piece("spine_03")
    c = Vector((0, cc.y + ryc + 0.15, z["chest"] - 0.07))
    f.ellipsoid("iron", c, (0.135, 0.125, 0.115), seg=(20, 12))
    f.torus("iron", c + Vector((0, 0, 0.075)), 0.112, 0.016, seg=(24, 8))
    f.ellipsoid("iron", c + Vector((0, 0, 0.085)), (0.105, 0.098, 0.03), seg=(18, 8))
    f.ellipsoid("gold", c + Vector((0, 0, 0.118)), (0.02, 0.02, 0.016), seg=(10, 6))
    f.torus("gold", c + Vector((0, 0, -0.01)), 0.134, 0.006, seg=(28, 6))
    for k in range(3):
        a = PI / 2 + 2 * PI * k / 3
        f.tube("iron", [c + Vector((0.08 * math.cos(a), 0.075 * math.sin(a), -0.08)), c + Vector((0.1 * math.cos(a), 0.095 * math.sin(a), -0.15))], [0.02, 0.012], seg=6)
    for s in (1, -1):
        hx = c + Vector((0.125 * s, -0.02, 0.07))
        f.torus("gold", hx, 0.024, 0.006, normal=(0, 1, 0), seg=(14, 6))
        f.tube("gold", [hx + Vector((0, 0, 0.02)), Vector((0.1 * s, cc.y + ryc + 0.03, z["neck"] - 0.03)), Vector((0.085 * s, cc.y + 0.01, z["neck"] + 0.005)),
                        Vector((0.085 * s, cc.y - ryc * 0.75, z["neck"] - 0.06))], 0.006, seg=5)

    # the headwrap, knotted at the back, and the braid down her back
    H = P.head(R)
    f = R.piece("Head")
    hc, hr = H.c + Vector((0, 0.008, 0.008)), (H.rx * 1.1, H.ry * 1.15, H.rz * 1.13)
    P.shell(f, "crimson", hc, hr, P.rim_line(0.5, 0.05, -0.45, w0=0.45, w1=1.2), seg=36, rows=9, rim="crimson", rim_r=0.013)
    for k, e in enumerate((0.72, 0.9)):   # the wrap's folds
        f.tube("crimson", [P.on_shell(hc, (hr[0] + 0.003, hr[1] + 0.003, hr[2] + 0.003), a, e - 0.55 * P.smooth(abs(a) / 2.6))[0] for a in [(-2.6 + 5.2 * i / 16) for i in range(17)]], 0.009, seg=6)
    kn, n = P.on_shell(hc, hr, PI, -0.3)
    f.ellipsoid("crimson", kn + n * 0.02, (0.04, 0.03, 0.035), seg=(12, 8))
    for s in (1, -1):
        f.tube("crimson", [kn + n * 0.03, kn + n * 0.05 + Vector((0.05 * s, 0, -0.03)), kn + n * 0.04 + Vector((0.075 * s, 0, -0.1))], [0.02, 0.024, 0.006], seg=6, squash=((0, 1, 0), 0.4))
    f = R.piece(P.head_spine_w(R, H.base + 0.0, z["neck"] - 0.08))
    b0 = kn + n * 0.02 + Vector((0, 0, -0.05))
    for k in range(8):
        p = b0 + Vector((0.012 * (-1) ** k, 0.012 + 0.008 * math.sin(k * 0.5), -0.047 * k))
        r = 0.04 - 0.002 * k
        f.ellipsoid(hair, p, (r, r * 0.85, r * 0.85), seg=(10, 8))
    f.torus("gold", b0 + Vector((0, 0.016, -0.047 * 7.6)), 0.026, 0.008, seg=(14, 6))

    # the great cleaver: a dark blade, a bright bevel, a glowing ember edge
    f, o, d, up = R.held("r")
    b = R.bone("hand_r") - R.bone("middle_01_r")   # the spine's side: the edge is toward the fingertips
    b = (b - d * b.dot(d) - up * b.dot(up)).normalized()
    f.tube("leather", [o - d * 0.12, o + d * 0.1], 0.021, seg=10)
    f.ellipsoid("gold", o - d * 0.125, P.rr(R, 0.03), seg=(10, 8))
    f.torus("gold", o + d * 0.1, 0.026, 0.009, normal=d, seg=(16, 6))
    A, B, C, D, E = o + d * 0.1 + b * 0.045, o + d * 0.56 + b * 0.065, o + d * 0.58 - b * 0.16, o + d * 0.16 - b * 0.19, o + d * 0.1 - b * 0.03
    P.plate(f, "iron", [A, B, C + b * 0.035, D + b * 0.035, E], 0.02, normal=up)
    P.plate(f, "steel", [D + b * 0.04, C + b * 0.04, C + b * 0.006, D + b * 0.006], 0.012, normal=up)
    f.tube("ember", [D + b * 0.012, D.lerp(C, 0.5) - b * 0.008, C + b * 0.01, C + b * 0.09], [0.011, 0.012, 0.012, 0.004], seg=6, squash=(tuple(up), 0.6))
    f.torus("gold", B - d * 0.07 - b * 0.06, 0.022, 0.006, normal=up, seg=(14, 6))
    f.tube("gold", [A + d * 0.01, B - d * 0.01], 0.008, seg=6, squash=(tuple(up), 1.5))
    f.flat.update(("iron", "steel"))
    return R
