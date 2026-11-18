"""The Path-Lighter (the Wood's quest giver at the camp): he lights the spore lamps that show where the wood's paths have
moved to. A lean man, brown hair, a wide round hat of bark brown with a moss band. A cream shirt, a bark leather jerkin
to the hips with a gold edge, a short forest cape lined in moss, dark green trousers, tall bark boots with gold cuffs. In
the LEFT hand a tall lamplighter's pole with a crook at its top, and from it hangs a glass spore lamp in a gold cage that
glows a pale yellow-green: his one light (hold: torch). Signature shape: the hat and the high hanging lamp."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_lighter", sex="m", height=1.02, width=0.95, depth=0.97, skin="#c08a66")
    z = R.z
    R.mat("cream", "#ddd2b2", rough=0.8, double=True)
    R.mat("bark", "#5a3a22", rough=0.66, double=True)
    R.mat("forest", "#1e3a26", rough=0.7, double=True)
    R.mat("moss", "#566f2c", rough=0.85, double=True)
    R.mat("trouser", "#22301f", rough=0.75, double=True)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glass", "#cfe8b0", rough=0.15, metal=0.0)
    R.mat("glow", "#f2ffc0", rough=0.3, emit="#c8f060", strength=1.0)
    R.hair("Hair_SimpleParted", "#4a3626")

    # the shirt, the jerkin over it to the hips, trousers, tall boots
    R.fitted("Shirt", ["clavicle", "upperarm", "lowerarm"], "cream", offset=0.009)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.55, t1=0.96, r0=0.01, r1=0.05, seg=14, n=3)
    R.cuffs("gold", at=(0.95,), offset=0.008, thick=0.006)
    R.fitted("Jerkin", ["spine", "pelvis"], "bark", offset=0.012)
    P.collar(R, "cream", height=0.05, grow=1.0, flare=0.1)
    R.fitted("Trousers", ["thigh", "calf"], "trouser", offset=0.005)
    R.boots("bark", top=z["knee"] + 0.02, cuff="gold")
    P.toes(R, "bark")
    f, rings = P.skirt(R, "bark", z["hip"] - 0.15, flare=1.22, depth=1.12, folds=6, amp=0.01, trim="gold", trim_h=0.018, seg=44)
    R.band("wood", z["waist"], height=0.05, grow=1.14)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0.03, 0.01, 0.026), seg=(12, 8))
    up = R.piece(P.trunk_w(R))
    P.band_on(R, up, "gold", [(z["waist"] - 0.02, 0.05), (z["chest"] + 0.02, 0.05)], 0.008, thick=0.005, off=0.016)
    # a satchel for the spore phials on his right hip, its strap across the chest
    sf, point = PA.strap(R, "wood", width=0.04, lift=0.2, grow=1.12, high_side=1, out=0.02)
    p = point(0.75, -0.14)
    sb = R.piece("pelvis")
    P.box(sb, "bark", p + Vector((-0.05, 0.0, -0.04)), (0.03, 0.08, 0.07))
    P.box(sb, "gold", p + Vector((-0.08, 0.0, -0.01)), (0.003, 0.03, 0.012))

    # the short forest cape lined in moss
    PA.cloak(R, "forest", hem=z["hip"] - 0.04, width=0.36, depth=0.82, spread=1.3, top_spread=1.7, lining="moss", trim="gold", nu=16, nv=8)

    # the wide round hat
    K.wide_hat(R, "bark", "moss", brim=0.27, crown=(0.12, 0.13, 0.095), tilt=(0.0, 0.07), lift=0.045, rim="gold")

    # the lamplighter's pole, a crook at the top, the spore lamp hanging from it
    h = K.hand(R)
    top = K.pole(h, "wood", back=1.24, front=0.82, r=0.014, rings=(-0.7, 0.3))
    crook = [top]
    rad = 0.07
    for i in range(1, 11):
        a = 0.95 * PI * i / 10
        crook.append(top + h.fwd * rad * (1 - math.cos(a)) + h.d * rad * math.sin(a) * h.s)
    h.f.tube("gold", crook, [0.012 - 0.004 * i / 10 for i in range(11)], seg=8)
    K.lantern(h, crook[-1], "gold", "glass", "glow", size=1.15, chain=0.04)
    return R
