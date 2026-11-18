"""The Drowned docker (the Sea's common enemy, melee): a dock hand the sea took back and sent up the quay again. Lean,
his skin the pale grey-green of the drowned, no brows, cropped dark hair, a cold sea-glass light where his eyes were:
his one glow. A deep sea-green jersey to the wrists, black lacquer trousers and boots, a wide lacquer belt with a brass
buckle, a short brass chain hanging from a shackle on his left wrist. Kelp hangs from his shoulders and belt in clean
dark-green ribbons, and smooth cream barnacles crust his right shoulder and left forearm. In the RIGHT hand a brass
cargo hook on a short wooden grip: the weapon. Clean forms throughout (no rags): what is drowned is told by colour, the
weed and the barnacles."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P


# An enemy: it comes in packs, so it is finished lighter (foes.finish_light).
LIGHT = {"faces": 10000}


def build():
    R = Real("sea_docker", sex="m", height=1.02, width=0.94, depth=0.94, head=0.98, skin="#8fa69c", eyes="#b8eef0")
    z = R.z
    R.mat("sea", "#1c3a34", rough=0.66, double=True)
    R.mat("lacquer", "#16191c", rough=0.5, double=True)
    R.mat("kelp", "#2c5a3a", rough=0.55, double=True)
    R.mat("barnacle", "#e2dcc6", rough=0.7)
    R.mat("brass", "#c9983c", rough=0.32, metal=0.85)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.0)
    R.hair("Hair_Buzzed", "#1c2622", rough=0.7, brows=False)
    R.bald()

    R.fitted("Jersey", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "sea", offset=0.008)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "lacquer", offset=0.004)
    R.boots("lacquer", top=z["knee"] - 0.08, cuff="brass")
    P.toes(R, "lacquer")
    R.cuffs("lacquer", at=(0.94,), offset=0.012, thick=0.01)
    P.collar(R, "sea", height=0.045, grow=1.1)
    f, rings = P.skirt(R, "sea", z["hip"] - 0.1, flare=1.15, depth=1.08, folds=6, amp=0.01, seg=40)
    how = R.hang_w(z["waist"], z["knee"])
    R.band("lacquer", z["waist"] - 0.02, height=0.07, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.02)
    bf = R.piece("pelvis")
    bf.torus("brass", Vector((0, cw.y - ryw * 1.24, z["waist"] - 0.02)), 0.032, 0.008, normal=(0, 1, 0), seg=(16, 6))
    bf.tube("brass", [Vector((0, cw.y - ryw * 1.26, z["waist"] - 0.05)), Vector((0, cw.y - ryw * 1.26, z["waist"] + 0.01))], 0.005, seg=5)

    # the cold light where his eyes were: two small sea-glass sparks just in front of the eyes
    h = P.head(R)
    hp = R.piece("Head")
    for s in (1, -1):
        e = Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002))
        hp.ellipsoid("glow", e, (0.014, 0.006, 0.0075), seg=(10, 6))

    # kelp from the shoulders and the belt: long flat ribbons, gently curved
    sh = R.bone("upperarm_l").x
    cc, rxc, ryc = R.ring(z["chest"])
    kf = R.piece(PA.spine_w(R))
    for x, y, ln, w, ph in ((0.14, -0.07, 0.36, 0.03, 0.0), (0.1, 0.08, 0.5, 0.034, 1.0), (-0.16, 0.06, 0.42, 0.028, 2.0), (-0.12, -0.05, 0.28, 0.026, 0.5)):
        top = Vector((x, cc.y + y, z["neck"] - 0.06))
        pts = [top + Vector((0.015 * math.sin(ph + 3 * t), (-0.03 if y < 0 else 0.03) * t, -ln * t)) for t in [k / 8 for k in range(9)]]
        pts = [p + Vector((0, (-ryc - 0.02 if y < 0 else ryc + 0.02) * min(1, (top.z - p.z) / 0.08), 0)) for p in pts]
        PA.ribbon(kf, "kelp", pts, lambda t, w=w: w * (0.5 + 0.5 * math.sin(PI * min(1, t * 1.2))) + 0.004, (1, 0, 0), k=3)
    for a, ln in ((-0.6, 0.38), (0.3, 0.3), (2.3, 0.44), (-2.6, 0.34), (1.3, 0.26)):
        p0 = Vector((cw.x + rxw * 1.2 * math.sin(a), cw.y - ryw * 1.2 * math.cos(a), z["waist"] - 0.04))
        out = Vector((math.sin(a), -math.cos(a), 0))
        kf2 = R.piece(how)
        pts = [p0 + out * (0.02 * t) + Vector((0.012 * math.sin(a * 3 + 4 * t), 0, -ln * t)) for t in [k / 8 for k in range(9)]]
        PA.ribbon(kf2, "kelp", pts, lambda t: 0.024 * (1 - 0.6 * t) + 0.004, (math.cos(a), math.sin(a), 0), k=3)

    # barnacles: smooth cream cones in clusters on the right shoulder and the left forearm
    def cluster(f, c, nrm, n, r):
        nrm = Vector(nrm).normalized()
        u = nrm.orthogonal().normalized()
        v = nrm.cross(u)
        for k in range(n):
            a = 2.4 * k
            rr = r * math.sqrt((k + 0.5) / n)
            p = c + (u * math.cos(a) + v * math.sin(a)) * rr
            sz = 0.016 * (1.2 - 0.5 * k / n)
            f.tube("barnacle", [p - nrm * 0.004, p + nrm * sz * 0.9, p + nrm * sz * 1.2], [sz, sz * 0.75, sz * 0.45], seg=8)
            f.ellipsoid("lacquer", p + nrm * sz * 1.2, (sz * 0.38, sz * 0.38, sz * 0.38), seg=(6, 4))
    shr = R.bone("upperarm_r")
    cluster(R.piece("upperarm_r"), shr + Vector((-0.05, 0.0, 0.055)), (-0.3, 0, 1), 7, 0.06)
    cl, rl = R.arm_r("l", 0.45)
    cluster(R.piece("lowerarm_l"), cl + Vector((0, 0, rl + 0.008)), (0, -0.2, 1), 5, 0.04)

    # a shackle on the left wrist and a short brass chain
    cwr, rw = R.arm_r("l", 0.86)
    lf = R.piece("lowerarm_l")
    lf.torus("brass", cwr, rw + 0.016, 0.01, normal=(1, 0, 0), seg=(20, 6))
    p = cwr + Vector((0, 0, -rw - 0.026))
    for k in range(4):
        q = p + Vector((0.004 * k, 0, -0.03 * k))
        lf.torus("brass", q, 0.016, 0.0045, normal=(1, 0, 0) if k % 2 else (0, 1, 0), seg=(12, 5))

    # the cargo hook in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    f.tube("wood", [o - d * 0.07 * s, o + d * 0.1 * s], 0.022, seg=10)
    f.ellipsoid("brass", o - d * 0.08 * s, P.rr(R, 0.025), seg=(10, 8))
    f.tube("brass", [o + d * 0.1 * s, o + d * 0.13 * s], 0.026, seg=10)
    base = o + d * 0.13 * s
    pts = [base + d * 0.12 * s]
    rad = 0.075
    c = base + d * 0.16 * s + upv * rad
    for i in range(14):
        a = PI * 1.35 * i / 13
        pts.append(c - upv * rad * math.cos(a) + d * rad * math.sin(a))
    f.tube("brass", [base] + pts, [0.014, 0.013] + [0.012 - 0.008 * i / 13 for i in range(14)], seg=8)
    return R
