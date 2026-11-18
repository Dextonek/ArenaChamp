"""The Raider (the Sands' common melee enemy, "strikes up close"): a rider of the dunes without his camel, quick and lean.
Sun-dark skin; a long indigo cloth wound round his head and over his face to the eyes, its tail down his back; a
terracotta tunic to mid-thigh over loose sand trousers bound at the shins, a dark leather vest and a wide turquoise sash;
soft boots. A curved sword in the RIGHT hand, its blade bright steel, its grip wrapped in red, a turquoise stone in the
pommel: his one light. Signature shape: the veiled head and the curved sword."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("sands_raider", sex="m", height=1.02, width=0.94, depth=0.94, head=0.98, skin="#a87656", eyes="#2a1e14")
    z = R.z
    R.mat("indigo", "#1e2350", rough=0.66, double=True)
    R.mat("terra", "#a0482c", rough=0.7, double=True)
    R.mat("sand", "#c8b088", rough=0.8, double=True)
    R.mat("leather", "#3a2618", rough=0.6, double=True)
    R.mat("turq", "#2a9a90", rough=0.55, double=True)
    R.mat("steel", "#c8ccd2", rough=0.25, metal=0.85)
    R.mat("red", "#7a1c1c", rough=0.6)
    R.mat("glow", "#a8fff0", rough=0.2, emit="#3fd4c8", strength=1.0)
    R.hair(None, "#1a120c")

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "terra", offset=0.008)
    R.fitted("Vest", ["spine_02", "spine_03", "clavicle"], "leather", offset=0.014, where=lambda p: abs(p.x) > 0.04 or p.y > 0)
    R.fitted("Trousers", ["thigh", "calf"], "sand", offset=0.006)
    R.boots("leather", top=z["ankle"] + 0.14)
    for n in "lr":
        for t in (0.25, 0.5):
            c, r = R.leg_r(n, z["ankle"] + 0.16 + t * 0.2)
            R.piece(f"calf_{n}").torus("indigo", c, r + 0.012, 0.008, seg=(16, 5))
    hem = z["knee"] + 0.1
    P.skirt(R, "terra", hem, flare=1.28, depth=1.1, folds=7, amp=0.014, seg=40)
    how = R.hang_w(z["waist"], hem)
    R.band("turq", z["waist"] - 0.01, height=0.07, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.01)
    g = R.piece(how)
    for s in (1, -1):
        g.tube("turq", [Vector((0.06 * s, cw.y - ryw * 1.15, z["waist"] - 0.03)), Vector((0.08 * s, cw.y - ryw * 1.25, z["waist"] - 0.2))], [0.022, 0.012], seg=6, squash=((0, 1, 0), 0.3))

    # the head cloth: wound round the head, over the face to the eyes, a tail down the back
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "indigo", h.c + Vector((0, 0.01, 0.0)), (h.rx * 1.14, h.ry * 1.12, h.rz * 1.12), lambda a: -0.1, seg=28, rows=8)
    for k in range(3):
        zz = h.c.z + h.rz * (0.15 + 0.22 * k)
        ring = [Vector((h.rx * 1.16 * math.sin(a), h.c.y - h.ry * 1.14 * math.cos(a), zz + 0.01 * math.cos(a))) for a in [-PI + 2 * PI * j / 24 for j in range(25)]]
        hp.tube("indigo", ring, 0.014, seg=6)
    veil = [Vector((h.rx * 1.02 * math.sin(a), h.c.y - h.ry * 1.08 * math.cos(a), h.eye - 0.035)) for a in [-1.9 + 3.8 * j / 18 for j in range(19)]]
    hp.tube("indigo", veil, 0.018, seg=6)
    PA.grid(hp, "indigo", lambda u, v: Vector((h.rx * (1.02 - 0.05 * v) * math.sin(-1.9 + 3.8 * u), h.c.y - h.ry * (1.08 - 0.06 * v) * math.cos(-1.9 + 3.8 * u), h.eye - 0.035 - 0.1 * v)), 18, 3)
    tail = R.piece(P.head_spine_w(R, h.base, z["chest"]))
    t0 = Vector((0, h.c.y + h.ry * 1.1, h.c.z))
    PA.ribbon(tail, "indigo", [t0, t0 + Vector((0, 0.05, -0.12)), t0 + Vector((0, 0.08, -0.3)), t0 + Vector((0.02, 0.1, -0.45))], lambda t: 0.05 * (1 - 0.4 * t), (1, 0, 0), k=4)

    # the curved sword in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("red", [o - d * 0.08 * s, o + d * 0.08 * s], 0.017, seg=8)
    f.ellipsoid("steel", o - d * 0.1 * s, P.rr(R, 0.022), seg=(10, 8))
    f.ellipsoid("glow", o - d * 0.112 * s, P.rr(R, 0.012), seg=(8, 6))
    f.tube("steel", [o + d * 0.08 * s - upv * 0.05, o + d * 0.09 * s + upv * 0.05], 0.01, seg=6)
    pts = [o + d * (0.09 + 0.6 * t) * s + upv * 0.12 * t ** 2 for t in [k / 8 for k in range(9)]]
    f.tube("steel", pts, [0.028 - 0.006 * k / 8 for k in range(8)] + [0.002], seg=6, squash=(tuple(side), 0.12))
    return R
