"""The Elder Root (the Wood's first ruler, a boss drawn about 2.7 times a hero's size; also the Moss Warden and the Hollow
Elder): the oldest thing in the wood, the heart the roots feed. Built as a giant: broad and deep, a smaller head, big hands.
Grey-brown skin like old bark, a long white beard and long white hair; a crown of living roots that rise from his brow and
curl back over his head, gold bands on them. A long robe of moss green to the floor, its hem breaking into roots that run
out over the ground; a mantle of layered bark plates on the shoulders, rimmed in gold; a wide bark belt with a gold boss.
In the LEFT hand a staff that is one great root, twisted, an amber heart-stone held in its curled top: his one light (hold:
torch). Signature shape: the root crown and the root staff."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K
from foes import slab


def build():
    R = Real("wood_elder", sex="m", height=1.02, width=1.3, depth=1.26, head=0.84, skin="#9a8a74", eyes="#ffd890")
    z = R.z
    R.mat("moss", "#2f4a26", rough=0.8, double=True)
    R.mat("deep", "#162414", rough=0.85, double=True)
    R.mat("bark", "#3e2c1e", rough=0.75, double=True)
    R.mat("root", "#5a4632", rough=0.8)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#ffe0a0", rough=0.25, emit="#ffa830", strength=1.2)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_Long", "#e6e0d2", beard="Hair_Beard")

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "moss", offset=0.01)
    R.fitted("Under", ["thigh", "calf"], "deep", offset=0.005)
    R.boots("deep", top=z["ankle"] + 0.06)
    for n in "lr":
        P.sleeve(R, n, "moss", t0=0.4, t1=0.98, r0=0.015, r1=0.085, rim="gold", rim_r=0.007, seg=16, n=4)
    hem = z["ankle"] + 0.01
    f, rings = P.skirt(R, "moss", hem, flare=1.75, depth=1.15, folds=11, amp=0.03, seg=60, trim="bark", trim_h=0.05)
    # the hem breaking into roots that run out over the ground
    for k in range(16):
        a = 2 * PI * k / 16 + 0.1
        c, rx, ry = P.ring_at(rings, hem + 0.03)
        p0 = Vector((c.x + rx * math.sin(a), c.y - ry * math.cos(a), hem + 0.04))
        out = Vector((math.sin(a), -math.cos(a), 0))
        ln = 0.12 + 0.06 * ((k * 7) % 3)
        f.tube("root", [p0, p0 + out * ln * 0.5 + Vector((0, 0, -0.035)), p0 + out * ln + Vector((0.02 * math.cos(a), 0, -0.045))], [0.02, 0.014, 0.004], seg=7)
    how = R.hang_w(z["waist"], hem)
    R.band("bark", z["waist"], height=0.09, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    bk = Vector((0, cw.y - ryw * 1.2, z["waist"]))
    g.ellipsoid("gold", bk, (0.05, 0.02, 0.05), seg=(16, 8))
    g.ellipsoid("glow", bk + Vector((0, -0.014, 0)), (0.018, 0.01, 0.018), seg=(10, 6))

    # the bark mantle: three rows of rounded plates over the shoulders, gold rims on the lowest
    fp = R.piece("spine_03")
    for row in range(2):
        zz = z["chest"] + 0.08 - row * 0.07
        for k in range(12):
            a = -PI + 2 * PI * (k + 0.5 * (row % 2)) / 12
            p, out = P.on_trunk(R, zz, a, off=0.02 + 0.012 * row)
            slab(fp, "bark", p, out, 0.075, 0.065, 0.014, tilt=0.35 + 0.15 * row, seg=(10, 6))
            if row == 1:
                fp.ellipsoid("gold", p + out * 0.012 + Vector((0, 0, -0.058)), (0.018, 0.018, 0.006), seg=(8, 4))
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("bark", sh + Vector((0.05 * s, 0, 0.05)), (0.12, 0.1, 0.06), seg=(14, 8))
        sp.torus("gold", sh + Vector((0.05 * s, 0, 0.03)), 0.115, 0.009, normal=(0.3 * s, 0, 1), seg=(24, 6))

    # the root crown: roots from the brow that rise and curl back over the head, gold bands
    h = P.head(R)
    hp = R.piece("Head")
    zc = h.c.z + h.rz * 0.35
    for k in range(6):
        a = -1.15 + 2.3 * k / 5
        base = Vector((h.rx * 1.05 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), zc))
        out = Vector((math.sin(a), -math.cos(a), 0))
        side = Vector((math.cos(a), math.sin(a), 0))
        hgt = 0.13 + 0.07 * math.cos(a) ** 2
        # up, out and back, each curling its own way, like the roots of a fallen tree
        pts = [base, base + out * 0.04 + Vector((0, 0, hgt * 0.45)), base + out * 0.09 + side * 0.03 * (1 if a > 0 else -1) + Vector((0, 0.02, hgt * 0.85)),
               base + out * 0.13 + side * 0.05 * (1 if a > 0 else -1) + Vector((0, 0.07, hgt)), base + out * 0.14 + Vector((0, 0.11, hgt * 0.8))]
        sm = PA.smooth(pts, 4)
        hp.tube("root", sm, [0.02 * (1 - 0.85 * i / (len(sm) - 1)) + 0.002 for i in range(len(sm))], seg=7)
        hp.torus("gold", sm[3], 0.019, 0.005, normal=(sm[4] - sm[2]), seg=(12, 5))
    ring = [Vector((h.rx * 1.05 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 24 for k in range(25)]]
    hp.tube("root", ring, 0.014, seg=7)

    # the root staff in the left hand: one great root, twisted, its top curling round the amber heart-stone
    hd = K.hand(R)
    f = hd.f
    pts = [K.at(hd, t, fwd=0.018 * math.sin(t * 9), side=0.018 * math.cos(t * 9)) for t in [-1.25 + 1.75 * k / 24 for k in range(25)]]
    f.tube("root", pts, [0.03 - 0.012 * k / 24 for k in range(25)], seg=10)
    top = K.at(hd, 0.6)
    curl = [top + (hd.fwd * math.cos(a) + hd.d * math.sin(a)) * 0.075 for a in [-PI / 2 + 1.8 * PI * k / 14 for k in range(15)]]
    curl = [K.at(hd, 0.5)] + [c + hd.d * 0.075 for c in curl]
    f.tube("root", curl, [0.02 - 0.012 * k / 15 for k in range(16)], seg=8)
    f.ellipsoid("glow", top + hd.d * 0.075, P.rr(R, 0.045), seg=(14, 10))
    for t in (-0.2, 0.25):
        f.torus("gold", K.at(hd, t), 0.034, 0.008, normal=hd.d, seg=(16, 6))
    # small roots at the foot of the staff
    for k in range(4):
        a = PI / 2 * k
        out = hd.fwd * math.cos(a) + hd.side * math.sin(a)
        b = K.at(hd, -1.15)
        f.tube("root", [b, b + out * 0.06 - hd.d * 0.08], [0.014, 0.003], seg=6)
    return R
