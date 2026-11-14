"""The Herald (the War's keeper, who gives the main quest): she speaks for both armies, the only voice either side
still lets cross the field. A tall woman, dark hair in buns under a small gold circlet. A tabard halved crimson and
azure, each half bearing a gold sun, over a long cream gown to the floor with a gold hem, a gold chain of office on her
shoulders. In the LEFT hand a long gold herald's trumpet held upright, a square banner hanging from it halved crimson and
azure; a pale gem in the trumpet's bell is her one light (hold: torch). Signature shape: the halved tabard and the
trumpet with its banner."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("war_herald", sex="f", height=1.04, width=0.95, depth=0.96, skin="#c49478")
    z = R.z
    R.mat("cream", "#e2d8c0", rough=0.75, double=True)
    R.mat("crimson", "#7a1a24", rough=0.62, double=True)
    R.mat("azure", "#24427e", rough=0.62, double=True)
    R.mat("dark", "#1d1b21", rough=0.6, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#fff6e0", rough=0.25, emit="#ffe0a0", strength=1.0)
    R.hair("Hair_Buns", "#2a1a14", rough=0.55)

    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "cream", offset=0.004)
    R.boots("dark", top=z["ankle"] + 0.05)
    P.toes(R, "dark")
    R.cuffs("gold", at=(0.92,), offset=0.01, thick=0.007)
    hem = z["ankle"] + 0.012
    f, rings = P.skirt(R, "cream", hem, flare=1.6, depth=1.12, folds=9, amp=0.024, trim="gold", trim_h=0.026, seg=52)

    # the tabard: left half crimson, right half azure, front and back, to below the knee, a gold sun on each half in front
    up = R.piece(P.trunk_w(R, hem))
    for key, a0, a1 in (("crimson", 0.0, 1.25), ("azure", -1.25, 0.0)):
        P.wrap(R, up, key, z["waist"] - 0.03, z["neck"] - 0.03, a0, a1, off=0.016)
        P.wrap(R, up, key, z["waist"] - 0.03, z["neck"] - 0.03, PI - a1, PI - a0, off=0.016)
    sfn = PA.skirt_fn(R, hem, flare=1.6, depth=1.12)
    for key, a0, a1 in (("crimson", 0.0, 0.62), ("azure", -0.62, 0.0)):
        PA.panel(R, f, key, sfn, a0, a1, z["waist"] - 0.02, z["knee"] - 0.14, out=0.014, nu=4, nv=8)
        PA.panel(R, f, key, sfn, PI - a1, PI - a0, z["waist"] - 0.02, z["knee"] - 0.14, out=0.014, nu=4, nv=8)
    for a in (0.62, -0.62, PI - 0.62, PI + 0.62):
        f.tube("gold", [sfn(a, z["waist"] - 0.02 - (z["waist"] - z["knee"] + 0.12) * k / 8, 0.018) for k in range(9)], 0.005, seg=5)
    f.tube("gold", [sfn(-0.62 + 1.24 * k / 12, z["knee"] - 0.14, 0.018) for k in range(13)], 0.006, seg=5)
    for s in (1, -1):
        p, out = P.on_trunk(R, z["chest"] - 0.06, 0.32 * s, off=0.022)
        P.star(up, "gold", p, (0, 0, 1), out, 0.04, 0.02, thick=0.008, points=8)
    R.band("gold", z["waist"], height=0.025, grow=1.16)

    # the chain of office on the shoulders, a gold circlet
    nk = R.piece("spine_03")
    cn, rxn, ryn = R.ring(z["neck"] - 0.04, dz=0.02)
    ny = R.bone("neck_01").y
    for k in range(20):
        a = -2.0 + 4.0 * k / 19
        sag = 0.09 * math.cos(a / 2.0 * PI / 2)
        p = Vector((rxn * 1.55 * math.sin(a), ny - ryn * 1.75 * math.cos(a) - 0.01, z["neck"] - 0.04 - sag))
        nk.torus("gold", p, 0.012, 0.004, normal=(math.cos(a), math.sin(a), 0.3), seg=(10, 4))
    hd = P.head(R)
    hp = R.piece("Head")
    cz = hd.brow + 0.02
    hp.tube("gold", [Vector((hd.rx * 1.08 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.12 * math.cos(2 * PI * i / 36), cz + 0.01 * math.cos(2 * PI * i / 36))) for i in range(37)], 0.006, seg=6, caps=False)

    # the herald's trumpet, upright, its banner hanging from it
    h = K.hand(R)
    hf = h.f
    hf.tube("gold", [K.at(h, -0.5), K.at(h, 0.55)], 0.011, seg=8)
    hf.ellipsoid("gold", K.at(h, -0.51), P.rr(R, 0.018), seg=(10, 8))
    for t in (-0.3, 0.1, 0.35):
        hf.ellipsoid("gold", K.at(h, t), P.rr(R, 0.02), seg=(10, 8))
    P.hull(hf, "gold", [K.at(h, 0.5), K.at(h, 0.6), K.at(h, 0.66), K.at(h, 0.69)], [0.014, 0.03, 0.06, 0.09], seg=20, side=h.fwd, caps=False)
    hf.torus("gold", K.at(h, 0.69), 0.09, 0.008, normal=h.d, seg=(24, 5))
    hf.ellipsoid("glow", K.at(h, 0.66), P.rr(R, 0.03), seg=(10, 8))
    # the banner: two halves side by side hanging from a bar below the bell, a gold fringe
    bar_t, drop, w = 0.45, 0.36, 0.13
    hf.tube("gold", [K.at(h, bar_t, fwd=0.02, side=-w), K.at(h, bar_t, fwd=0.02, side=w)], 0.008, seg=6)
    for key, s0, s1 in (("crimson", -w, 0.0), ("azure", 0.0, w)):
        pts = [K.at(h, bar_t - 0.005, fwd=0.024, side=s0), K.at(h, bar_t - 0.005, fwd=0.024, side=s1), K.at(h, bar_t - drop, fwd=0.024, side=s1), K.at(h, bar_t - drop, fwd=0.024, side=s0)]
        P.plate(hf, key, pts, 0.008, normal=h.fwd)
    hf.tube("gold", [K.at(h, bar_t - drop, fwd=0.024, side=-w), K.at(h, bar_t - drop, fwd=0.024, side=w)], 0.006, seg=5)
    P.star(hf, "gold", K.at(h, bar_t - drop * 0.45, fwd=0.03), h.d, h.fwd, 0.045, 0.02, thick=0.008, points=8)
    return R
