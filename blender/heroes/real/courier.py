"""Pip, the Wingfoot (skirmisher): a young mythic messenger, lean and quick. A short deep blue capelet with the hood
down on his back, a fitted blue tunic with a gold hem over dark leggings, tall leather boots, leather bracers, ginger
hair. Small gold wings on a circlet at his temples and on his heels, a courier's pack on his back, wider than he is,
with sealed scrolls standing out of its top and a glowing gold courier seal on its flap, and a sealed scroll in his
right hand (attack: throw)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("courier", sex="m", height=0.9, width=0.84, depth=0.84, head=1.06, skin="#dcae8e")
    z = R.z
    R.mat("tunic", "#2f5aa8", rough=0.72, double=True)
    R.mat("cloak", "#1c2c58", rough=0.75, double=True)
    R.mat("legs", "#26222c", rough=0.8)
    R.mat("leather", "#5c3c22", rough=0.7, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("paper", "#d6cba8", rough=0.8)
    R.mat("wax", "#a8282a", rough=0.45)
    R.mat("seal", "#ffd24a", rough=0.3, emit="#ffc030", strength=1.0)
    R.hair("Hair_SimpleParted", "#b0501a", rough=0.6)

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "tunic", offset=0.008)
    R.fitted("Legs", ["thigh", "calf"], "legs", offset=0.004)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.01)
    R.cuffs("gold", at=(0.08, 0.94), offset=0.012)
    R.boots("leather", top=z["knee"] - 0.04, cuff="gold")
    P.toes(R, "leather")
    hem = z["knee"] + 0.2
    P.skirt(R, "tunic", hem, flare=1.42, folds=12, amp=0.016, trim="gold", trim_h=0.022)
    R.band("leather", z["waist"], height=0.06, grow=1.15, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.25, z["waist"])), (0.04, 0.014, 0.032), seg=(12, 8))

    # the short capelet over the shoulders, its collar and brooch, the hood down on his back
    sh = R.bone("upperarm_l").x
    R.fitted("Capelet", ["spine_03", "clavicle", "upperarm"], "cloak", offset=0.022, keep_skin=True,
             where=lambda p: (p.z > z["chest"] + 0.035 and abs(p.x) < sh + 0.02) or (abs(p.x) >= sh + 0.02 and abs(p.x) < sh + 0.13))
    f, gem, _ = P.collar(R, "cloak", height=0.06, grow=1.3, flare=0.1, rim="gold")
    f.ellipsoid("gold", gem + Vector((0, -0.012, 0.0)), (0.022, 0.012, 0.022), seg=(12, 8))
    cc, rxc, ryc = R.ring(z["chest"])
    back = cc.y + ryc
    f.ellipsoid("cloak", Vector((0, back + 0.0, z["neck"] - 0.03)), (0.15, 0.085, 0.085), seg=(18, 10))
    f.tube("cloak", [Vector((0, back + 0.05, z["neck"] - 0.03)), Vector((0, back + 0.07, z["neck"] - 0.1)), Vector((0, back + 0.05, z["neck"] - 0.17))], [0.075, 0.05, 0.006], seg=10)

    # the courier's pack: wider than he is, a gold-bound flap with the glowing seal, three sealed scrolls out of its top
    c = Vector((0, back + 0.14, z["chest"] - 0.1))
    prof = [(-0.21, 0.13, 0.05), (-0.18, 0.215, 0.1), (-0.08, 0.245, 0.118), (0.05, 0.245, 0.118), (0.13, 0.235, 0.11), (0.165, 0.2, 0.085), (0.18, 0.12, 0.05)]
    P.hull(f, "leather", [c + Vector((0, 0, q[0])) for q in prof], [q[1] for q in prof], [q[2] for q in prof], seg=24)
    # the flap over its top and down its back, pointed, bound in gold
    flap = [c + Vector((x, 0.122 - 0.02 * abs(x) / 0.23, zz)) for x, zz in ((-0.225, 0.13), (-0.225, 0.02), (-0.12, -0.02), (0.0, -0.085), (0.12, -0.02), (0.225, 0.02), (0.225, 0.13))]
    P.plate(f, "leather", flap, 0.016, normal=(0, 1, 0))
    f.tube("gold", [p + Vector((0, 0.008, 0)) for p in flap], 0.009, seg=6)
    f.ellipsoid("leather", c + Vector((0, 0.02, 0.15)), (0.235, 0.112, 0.06), seg=(20, 10))
    sp = c + Vector((0, 0.132, 0.0))
    f.torus("gold", sp, 0.058, 0.009, normal=(0, 1, 0), seg=(24, 6))
    f.ellipsoid("seal", sp, (0.052, 0.014, 0.052), seg=(16, 8))
    f.star("gold", sp + Vector((0, 0.014, 0)), 0.03, 0.012, thick=0.006, points=4, normal=(0, 1, 0))
    for x, lean, top in ((-0.12, -0.05, 0.42), (0.0, 0.01, 0.5), (0.115, 0.06, 0.4)):
        p0, p1 = c + Vector((x, -0.01, 0.12)), c + Vector((x + lean, 0.02, top))
        f.tube("paper", [p0, p1], 0.034, seg=10)
        ax = (p1 - p0).normalized()
        f.torus("gold", p1 - ax * 0.012, 0.035, 0.007, normal=ax, seg=(14, 6))
        f.torus("wax", p0.lerp(p1, 0.72), 0.036, 0.011, normal=ax, seg=(14, 6))
    f = R.piece("near")
    for s in (1, -1):   # the pack's straps
        P.band_on(R, f, "leather", [(z["chest"] - 0.13, 0.75 * s), (z["chest"] + 0.03, 0.55 * s), (z["neck"] - 0.045, 0.62 * s)], 0.04, thick=0.012, off=0.03)

    # the circlet with a gold wing at each temple
    H = P.head(R)
    f = R.piece("Head")
    cz = H.brow + 0.028
    f.tube("gold", [Vector((H.rx * 1.16 * math.sin(a), H.c.y - (H.ry * 1.14) * math.cos(a), cz + 0.012 * math.cos(a))) for a in [2 * PI * k / 28 for k in range(30)]], 0.008, seg=6, caps=False)
    f.ellipsoid("gold", Vector((0, H.c.y - H.ry * 1.15, cz + 0.012)), (0.014, 0.008, 0.018), seg=(8, 6))
    for s in (1, -1):
        P.wing(f, "gold", Vector((H.rx * 1.16 * s, H.c.y - 0.005, cz + 0.005)), (0.3 * s, 0.78, 0.55), (0, -0.4, 1), length=0.25, n=4, spread=0.95, thin=Vector((1, -0.25 * s, 0.1)))
    # the wings on his heels
    for s, n in ((1, "l"), (-1, "r")):
        heel = R.bone(f"foot_{n}")
        P.wing(R.piece(f"foot_{n}"), "gold", heel + Vector((0.058 * s, 0.03, 0.035)), (0.35 * s, 0.8, 0.5), (0, -0.4, 1), length=0.2, n=3, spread=0.9, thin=Vector((1, -0.3 * s, 0.15)))

    # a sealed scroll in his right hand
    f, o, d, up = R.held("r")
    f.tube("paper", [o - d * 0.13, o + d * 0.14], 0.026, seg=10)
    for t in (-0.13, 0.14):
        f.torus("gold", o + d * t, 0.027, 0.007, normal=d, seg=(14, 6))
    f.torus("wax", o + d * 0.02, 0.028, 0.012, normal=d, seg=(14, 6))
    return R
