"""The Moss giant (the Wood's heavy melee enemy, "slow, heavy, hits hard"): a giant of the old wood that the moss has half
taken back. Built as a giant: very broad and deep, a small bald head low between the shoulders, long heavy arms, big hands.
Grey-green stone skin, moss in clean cushions on the scalp, the shoulders and the forearms; slabs of grey stone grown on
the shoulders and the shins like armour; a bark-brown wrap round the hips under a bark belt with a gold boss, bare feet.
Two small amber mushrooms on the back of the left shoulder: his one light. In the RIGHT hand a club of dark wood with a
stone bound into its head by gold bands. Signature shape: the hunched stone shoulders and the club."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
from foes import rot, slab

# An enemy: it comes in packs, so it is finished lighter (foes.finish_light).
LIGHT = {"faces": 10000}


def moss_cushion(f, key, c, r, n=7, seed=0.0):
    """A clean cushion of moss: one low dome and a few smaller round lumps round it."""
    f.ellipsoid(key, c, (r, r, r * 0.45), seg=(12, 6))
    for k in range(n):
        a = seed + 2 * PI * k / n
        f.ellipsoid(key, c + Vector((math.cos(a) * r * 0.8, math.sin(a) * r * 0.8, -r * 0.05)), (r * 0.42, r * 0.42, r * 0.3), seg=(8, 5))


def build():
    R = Real("wood_giant", sex="m", height=1.02, width=1.38, depth=1.34, head=0.8, skin="#7f8c72", eyes="#ffcf7a")
    z = R.z
    R.mat("bark", "#3e2c1c", rough=0.75, double=True)
    R.mat("moss", "#45602a", rough=0.95)
    R.mat("stone", "#8a8c84", rough=0.92)
    R.mat("dark", "#2a2018", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("glow", "#ffd890", rough=0.3, emit="#ffa830", strength=1.0)
    R.bald()
    PB.big_hands(R, 1.4)
    z = R.z

    # the hip wrap and its belt
    hem = z["knee"] + 0.04
    R.fitted("Wrap", ["pelvis", "thigh"], "bark", offset=0.006, above=z["hip"] - 0.16)
    f, rings = P.skirt(R, "bark", hem, flare=1.25, depth=1.12, folds=7, amp=0.016, seg=40)
    zb = z["waist"] - 0.03
    R.band("dark", zb, height=0.08, grow=1.12, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(zb)
    g = R.piece("pelvis")
    g.ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, zb)), (0.045, 0.02, 0.045), seg=(14, 8))
    g.ellipsoid("dark", Vector((0, cw.y - ryw * 1.2 - 0.012, zb)), (0.02, 0.012, 0.02), seg=(10, 6))

    # moss on the scalp, the stone and moss on the shoulders
    h = P.head(R)
    hp = R.piece("Head")
    moss_cushion(hp, "moss", Vector((0, h.c.y + 0.01, h.c.z + h.rz * 0.82)), h.rx * 0.62, n=6)
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        # two flat slabs on the shoulder, one over the other like plates of a cliff
        sp.ellipsoid("stone", sh + Vector((0.02 * s, 0.0, 0.075)), (0.13, 0.11, 0.035), seg=(10, 6), rot=rot(0.05, -0.3 * s, 0))
        sp.ellipsoid("stone", sh + Vector((0.11 * s, -0.01, 0.035)), (0.08, 0.085, 0.028), seg=(10, 6), rot=rot(0.0, -0.75 * s, 0))
        moss_cushion(sp, "moss", sh + Vector((0.0, 0.03, 0.135)), 0.075, n=6, seed=1.0 if n == "l" else 2.0)
        # moss and a stone slab on the forearm
        c, r = R.arm_r(n, 0.45)
        lf = R.piece(f"lowerarm_{n}")
        lf.ellipsoid("stone", c + Vector((0, 0, r + 0.004)), (0.1, 0.05, 0.016), seg=(10, 6))
        moss_cushion(lf, "moss", c + Vector((0.03 * s, 0.01, r + 0.03)), 0.04, n=5)
        # a stone slab on each shin
        k = R.bone(f"calf_{n}")
        cf = R.piece(f"calf_{n}")
        slab(cf, "stone", k + Vector((0, -0.055, -0.15)), (0, -1, 0), 0.055, 0.13, 0.016, seg=(10, 6))
    # a ridge of stone down the back, between the shoulders
    cc, rxc, ryc = R.ring(z["chest"])
    bk = R.piece("spine_03")
    for k in range(4):
        zz = z["chest"] + 0.12 - 0.11 * k
        slab(bk, "stone", Vector((0, cc.y + ryc * 1.0, zz)), (0, 1, 0), 0.08 - 0.012 * k, 0.05, 0.018, tilt=0.25, seg=(10, 6))
    # two amber mushrooms on the back of the left shoulder
    sh = R.bone("upperarm_l")
    mf = R.piece("upperarm_l")
    for dx, dy, hh, rr in ((0.02, 0.07, 0.07, 0.04), (0.07, 0.05, 0.05, 0.03)):
        b = sh + Vector((dx, dy, 0.12))
        mf.tube("dark", [b, b + Vector((0, 0.01, hh))], [0.012, 0.009], seg=6)
        mf.ellipsoid("glow", b + Vector((0, 0.01, hh)), (rr, rr, rr * 0.5), seg=(12, 6))

    # the club in the right hand: a haft of dark wood, a stone bound in its head with two gold bands
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("dark", [o - d * 0.14 * s, o + d * 0.5 * s], [0.03, 0.04], seg=10)
    f.ellipsoid("gold", o - d * 0.15 * s, P.rr(R, 0.035), seg=(10, 8))
    head = o + d * 0.62 * s
    f.ellipsoid("stone", head, (0.1, 0.13, 0.1), seg=(14, 10), rot=rot(0.0, 0.0, 0.3))
    f.tube("dark", [o + d * 0.48 * s, head + d * 0.06 * s], [0.042, 0.03], seg=10)
    for t in (0.5, 0.72):
        q = o + d * t * s
        f.torus("gold", q, 0.07 if t > 0.6 else 0.048, 0.012, normal=d, seg=(18, 6))
    moss_cushion(f, "moss", head + upv * 0.09, 0.045, n=5)
    return R
