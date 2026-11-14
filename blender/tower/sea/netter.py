"""The Net caster (the Sea's casting enemy: "throws a net: you are rooted a moment"): a fisherwoman the sea took and sent
back. Slight, the docker's drowned grey-green skin and cold sea-glass eyes: her one glow. Long black hair bound back with
kelp, a deep sea-green hooded shawl, a short dark coat to mid-thigh over black lacquer leggings and boots, a brass-buckled
belt; a coiled net with brass weights slung over the left shoulder and across the back; in the RIGHT hand a gathered
throwing net, its brass weights hanging. Signature shape: the hood and the net coil."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("sea_netter", sex="f", height=1.0, width=0.92, depth=0.92, head=1.0, skin="#8fa69c", eyes="#b8eef0")
    z = R.z
    R.mat("sea", "#1c3a34", rough=0.66, double=True)
    R.mat("coat", "#24303a", rough=0.62, double=True)
    R.mat("lacquer", "#16191c", rough=0.5, double=True)
    R.mat("kelp", "#2c5a3a", rough=0.55, double=True)
    R.mat("net", "#b8ac88", rough=0.8)
    R.mat("brass", "#c9983c", rough=0.32, metal=0.85)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.0)
    R.hair("Hair_Long", "#121a18", rough=0.55)

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.008)
    R.fitted("Legs", ["thigh", "calf"], "lacquer", offset=0.004)
    R.boots("lacquer", top=z["knee"] - 0.06)
    hem = z["knee"] + 0.1
    P.skirt(R, "coat", hem, flare=1.25, depth=1.1, folds=6, amp=0.012, seg=40)
    how = R.hang_w(z["waist"], hem)
    R.band("lacquer", z["waist"] - 0.01, height=0.05, grow=1.13, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.01)
    R.piece("pelvis").torus("brass", Vector((0, cw.y - ryw * 1.22, z["waist"] - 0.01)), 0.024, 0.007, normal=(0, 1, 0), seg=(14, 6))

    # the hooded shawl over the head and shoulders
    PA.cowl(R, "sea", grow=1.08, low=0.08, high=0.03)
    PA.hood(R, "sea", lining="kelp", grow=1.55, open=0.42, tilt=0.3, peak=0.08, edge="brass", edge_r=0.006)
    # the cold light in her eyes
    h = P.head(R)
    hp = R.piece("Head")
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002)), (0.013, 0.006, 0.007), seg=(10, 6))

    # the net coil over the left shoulder and across the back to the right hip, its brass weights
    cc, rxc, ryc = R.ring(z["chest"])
    sh = R.bone("upperarm_l")
    pts = [Vector((sh.x - 0.03, cc.y - ryc - 0.03, z["chest"] + 0.12)), Vector((0.0, cc.y - ryc - 0.06, z["chest"] - 0.05)),
           Vector((-sh.x * 0.9, cc.y - 0.02, z["waist"] - 0.02)), Vector((0.0, cc.y + ryc + 0.06, z["chest"] - 0.04)),
           Vector((sh.x - 0.02, cc.y + ryc + 0.03, z["chest"] + 0.12))]
    nf = R.piece("near")
    loop = PA.smooth(pts, 6)
    loop = [p + (p - Vector((0, cc.y, p.z))).normalized() * 0.03 for p in loop]
    nf.tube("net", loop, 0.04, seg=10)
    nf.tube("kelp", [p + Vector((0, 0, 0.006)) for p in loop[::2]], 0.012, seg=6)
    for k in range(0, len(loop), 4):
        nf.ellipsoid("brass", loop[k] + Vector((0, 0, -0.04)), (0.014, 0.014, 0.016), seg=(8, 6))

    # the gathered throwing net in the right hand: a bunched knot, the net hanging in folds, weights at its rim
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.ellipsoid("net", o + d * 0.03 * s, (0.04, 0.045, 0.04), seg=(10, 8))
    rim = []
    for k in range(9):
        a = 2 * PI * k / 9
        q = o + d * 0.1 * s + (side * math.cos(a) + upv * math.sin(a)) * 0.2 - upv * 0.1
        rim.append(q)
        f.tube("net", [o + d * 0.04 * s, o.lerp(q, 0.5) + d * 0.05 * s, q], [0.014, 0.012, 0.008], seg=6)
        f.ellipsoid("brass", q, (0.02, 0.02, 0.02), seg=(8, 6))
    f.tube("net", rim + rim[:1], 0.006, seg=5)
    mid = [o.lerp(q, 0.55) + d * 0.05 * s for q in rim]
    f.tube("net", mid + mid[:1], 0.005, seg=5)
    return R
