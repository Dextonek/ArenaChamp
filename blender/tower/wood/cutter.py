"""The Woodcutter (a walker of the Wood's floors, docs/tower/life/index.html): Wood folk, unsworn, so no horns; he cuts
the deadfall the walking Wood leaves behind it and carries it to the charcoal stacks. Plainer than the named people: no
light, no gold. Ruddy, his fox-red hair and beard. A moss-green
tunic to the wrists, an open brown leather jerkin, dark trousers with undyed wool wound from ankle to knee, low boots. On
his back a tall bundle of sticks tied with rope on two straps, his axe slid in under the ropes. The hands are free
(walkers play the pack's walking clip with both arms). Signature shape: the bundle of sticks above the shoulders."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_cutter", sex="m", height=1.02, width=1.1, depth=1.08, skin="#c4886a")
    z = R.z
    R.mat("moss", "#3f5a2a", rough=0.75, double=True)
    R.mat("brown", "#5a3a22", rough=0.6, double=True)
    R.mat("dark", "#2e2620", rough=0.75, double=True)
    R.mat("wool", "#8a7a5c", rough=0.92, double=True)
    R.mat("stick", "#5c4632", rough=0.9)
    R.mat("rope", "#a68c58", rough=0.9)
    R.mat("iron", "#55585e", rough=0.42, metal=0.75)
    P.hair(R, "Hair_SimpleParted", "#8a3c1a", beard="Hair_Beard")

    # the tunic to the wrists, the open jerkin
    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "moss", offset=0.008)
    R.cuffs("wool", at=(0.9,), offset=0.012, thick=0.01)
    up = R.piece(P.trunk_w(R))
    P.wrap(R, up, "brown", z["waist"] - 0.08, z["chest"] + 0.08, 0.3, 3.1, off=0.018, taper=(1.0, 0.92))
    P.wrap(R, up, "brown", z["waist"] - 0.08, z["chest"] + 0.08, -3.1, -0.3, off=0.018, taper=(1.0, 0.92))
    P.collar(R, "moss", height=0.05, grow=0.98, flare=0.05)
    P.skirt(R, "moss", z["hip"] - 0.13, flare=1.18, depth=1.1, folds=7, amp=0.012, seg=44)
    R.band("dark", z["waist"] - 0.03, height=0.05, grow=1.16)
    cw, rxw, ryw = R.ring(z["waist"] - 0.03)
    R.piece("pelvis").ellipsoid("iron", Vector((0, cw.y - ryw * 1.2, z["waist"] - 0.03)), (0.026, 0.01, 0.022), seg=(10, 6))

    # trousers, wool wound from ankle to knee, low boots
    R.fitted("Trousers", ["thigh", "pelvis"], "dark", offset=0.005)
    R.fitted("Wraps", ["calf"], "wool", offset=0.009)
    for n in "lr":
        for k in range(4):
            zz = z["ankle"] + 0.1 + (z["knee"] - z["ankle"] - 0.16) * k / 3
            c, r = R.leg_r(n, zz)
            R.piece(f"calf_{n}").torus("brown", c, r + 0.012, 0.004, seg=(16, 5))
    R.boots("brown", top=z["ankle"] + 0.06)
    P.toes(R, "brown")

    # the bundle of sticks on his back, tied twice, on two straps; the axe slid in under the ropes
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    by = cc.y + ryc + 0.1
    z0, z1 = z["waist"] - 0.2, z["neck"] + 0.24
    for k in range(17):
        a = 2.4 * k
        rr = math.sqrt((k + 0.5) / 17)
        x, y = 0.13 * rr * math.cos(a), 0.07 * rr * math.sin(a)
        lo, hi = z0 + 0.03 * ((k * 5) % 3), z1 - 0.05 * ((k * 7) % 4)
        bend = 0.012 * math.sin(a * 3)
        bf.tube("stick", [Vector((x, by + y, lo)), Vector((x + bend, by + y, (lo + hi) / 2)), Vector((x - bend * 0.5, by + y, hi))], 0.017 - 0.004 * ((k * 3) % 3) / 2, seg=6)
    for zz in (z["waist"] + 0.02, z["chest"] + 0.1):
        pts = [Vector((0.15 * math.cos(2 * PI * i / 16), by + 0.085 * math.sin(2 * PI * i / 16), zz)) for i in range(17)]
        bf.tube("rope", pts, 0.009, seg=6, caps=False)
    K.shoulder_straps(R, bf, "rope", cc.y + ryc + 0.03)
    ax0 = Vector((-0.12, by + 0.1, z["waist"] - 0.12))
    ax1 = Vector((0.06, by + 0.1, z["chest"] + 0.22))
    bf.tube("stick", [ax0, ax1], 0.015, seg=8)
    d = (ax1 - ax0).normalized()
    side = d.cross(Vector((0, 1, 0))).normalized()
    hd = ax1 - d * 0.03
    P.hull(bf, "iron", [hd - side * 0.02, hd + side * 0.04, hd + side * 0.1], [0.03, 0.04, 0.07], [0.012, 0.009, 0.004], seg=8, side=d)
    return R
