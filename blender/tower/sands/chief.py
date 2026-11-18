"""The Raider Chief (the Sands' big enemy, leads the raiders of the fort; the Dune Mother and the rider share her figure
under their own tints): the warlord of the dunes. Built heavy: tall, broad-shouldered, a smaller head, big hands. Sun-dark
skin, black hair in a thick braid; a bronze helm with cheek guards and a tall crest of black horsehair; a bronze breastplate
studded with turquoise over a red-ochre tunic, bronze shoulder plates, a skirt of leather strips edged in bronze; an indigo
cloak; tall boots. In the RIGHT hand a great glaive: a long dark haft, a broad curved bronze blade. A turquoise stone on the
helm's brow: her one light. Signature shape: the crested helm and the glaive."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("sands_chief", sex="f", height=1.06, width=1.2, depth=1.14, head=0.88, skin="#a87656", eyes="#2a1e14")
    z = R.z
    R.mat("ochre", "#8a3a22", rough=0.66, double=True)
    R.mat("indigo", "#1e2350", rough=0.66, double=True)
    R.mat("leather", "#3a2618", rough=0.6, double=True)
    R.mat("bronze", "#a8743a", rough=0.32, metal=0.85, double=True)
    R.mat("hair", "#9a1c1c", rough=0.8, double=True)
    R.mat("turq", "#2a9a90", rough=0.45)
    R.mat("wood", "#2a1e14", rough=0.65)
    R.mat("glow", "#a8fff0", rough=0.2, emit="#3fd4c8", strength=1.1)
    PB.big_hands(R, 1.2)
    z = R.z
    R.hair("Hair_Long", "#140e0a", rough=0.55)

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "ochre", offset=0.008)
    R.fitted("Cuirass", ["spine_02", "spine_03", "clavicle"], "bronze", offset=0.016, above=z["waist"] + 0.02)
    R.fitted("Legs", ["thigh", "calf"], "leather", offset=0.005)
    R.boots("leather", top=z["knee"] - 0.02)
    R.fitted("Bracers", ["lowerarm"], "bronze", offset=0.012)
    hem = z["knee"] + 0.04
    P.skirt(R, "ochre", hem + 0.05, flare=1.3, depth=1.1, folds=6, amp=0.01, seg=40)
    f, rings = P.skirt(R, "leather", hem, flare=1.36, depth=1.12, folds=0, amp=0.0, seg=48, grow=1.04)
    for k in range(16):
        a = 2 * PI * k / 16
        P.seam(f, "bronze", rings, a, r=0.006, off=0.006)
    R.band("bronze", z["waist"] - 0.01, height=0.06, grow=1.16, how=R.hang_w(z["waist"], hem))
    # turquoise studs on the breastplate
    bf = R.piece("spine_02")
    for row in range(3):
        for k in range(5):
            a = -0.8 + 1.6 * k / 4
            p, out = P.on_trunk(R, z["waist"] + 0.08 + 0.08 * row, a, off=0.022)
            bf.ellipsoid("turq", p, (0.012, 0.008, 0.012), seg=(8, 5))
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("bronze", sh + Vector((0.04 * s, 0, 0.05)), (0.11, 0.095, 0.05), seg=(14, 8))
        sp.ellipsoid("bronze", sh + Vector((0.1 * s, 0, 0.0)), (0.08, 0.08, 0.04), seg=(12, 6))
    PA.cloak(R, "indigo", hem=z["knee"] - 0.1, width=0.4, depth=0.85, spread=1.25, top_spread=1.6, trim="bronze", nu=16, nv=10)

    # the crested helm with cheek guards and a turquoise stone
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "bronze", h.c + Vector((0, 0.005, 0.01)), (h.rx * 1.14, h.ry * 1.14, h.rz * 1.12), lambda a: 0.1 if abs(math.sin(a / 2)) < 0.35 else -0.35, seg=28, rows=8, rim="bronze", rim_r=0.008)
    for s in (1, -1):
        hp.ellipsoid("bronze", Vector((h.rx * 0.95 * s, h.y0 + 0.04, h.eye - 0.05)), (0.012, 0.035, 0.05), seg=(8, 6))
    crest = [Vector((0, h.c.y - h.ry * 0.9, h.c.z + h.rz * 1.1)), Vector((0, h.c.y, h.c.z + h.rz * 1.45)), Vector((0, h.c.y + h.ry * 1.0, h.c.z + h.rz * 1.25)), Vector((0, h.c.y + h.ry * 1.6, h.c.z + h.rz * 0.4)), Vector((0, h.c.y + h.ry * 1.75, h.c.z - h.rz * 0.6))]
    cr = PA.smooth(crest, 5)
    hp.tube("hair", cr, [0.035 if i < len(cr) * 0.6 else 0.03 * (1 - (i - len(cr) * 0.6) / (len(cr) * 0.45)) + 0.004 for i in range(len(cr))], seg=8, squash=((1, 0, 0), 0.45))
    hp.tube("bronze", cr[:int(len(cr) * 0.55)], 0.012, seg=6)
    hp.ellipsoid("glow", Vector((0, h.y0 - 0.012, h.brow + 0.045)), (0.016, 0.008, 0.016), seg=(10, 6))

    # the glaive in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.55 * s, o + d * 0.85 * s], 0.022, seg=10)
    f.ellipsoid("bronze", o - d * 0.56 * s, P.rr(R, 0.03), seg=(10, 8))
    sock = o + d * 0.85 * s
    f.tube("bronze", [sock - d * 0.06 * s, sock + d * 0.03 * s], 0.03, seg=10)
    pts = [sock + d * (0.02 + 0.4 * t) * s + upv * (0.05 + 0.08 * math.sin(PI * t * 0.8)) for t in [k / 8 for k in range(9)]]
    f.tube("bronze", pts, [0.06, 0.07, 0.072, 0.07, 0.065, 0.055, 0.04, 0.025, 0.003], seg=6, squash=(tuple(side), 0.12))
    f.torus("turq", sock - d * 0.08 * s, 0.028, 0.008, normal=d, seg=(14, 5))
    return R
