"""Pim, of the Changeling Twins (fighter, the melee half): a fae child with long pointed ears, on the one body the
twins share (real/parts_c.py `twin`). An amber leaf tunic, a bark acorn-cap helm with an amber leaf crest, and a wooden
sword in the right hand whose edges glow amber."""
import math

from mathutils import Vector

from realkit import PI
from real import parts_c as P


def build():
    R, T = P.twin("pim", "#b0601e", "#cf8a34", "#ffc060", "#ffa83a")
    H = T.H
    # the acorn-cap helm: a bark dome with a rolled rim and rings of scales, a stalk, an amber leaf crest
    f = R.piece("Head")
    hc, hr = H.c + Vector((0, 0.006, 0.014)), (H.rx * 1.17, H.ry * 1.17, H.rz * 1.17)
    P.shell(f, "bark", hc, hr, P.rim_line(0.4, 0.1, -0.12, w0=0.5, w1=1.2), seg=32, rows=8, rim="bark", rim_r=0.017)
    big = (hr[0] + 0.003, hr[1] + 0.003, hr[2] + 0.003)
    for e in (0.58, 0.78, 0.93):
        f.tube("weave", [P.on_shell(hc, big, 2 * PI * k / 24, e)[0] for k in range(26)], 0.007, seg=5, caps=False)
    top = hc + Vector((0, 0, hr[2]))
    f.tube("bark", [top - Vector((0, 0, 0.01)), top + Vector((0.006, 0.006, 0.035)), top + Vector((0.03, 0.02, 0.065))], [0.02, 0.014, 0.012], seg=8)
    P.leaf(f, "leaf", top + Vector((0, 0.0, 0.01)), top + Vector((-0.13, 0.05, 0.07)), 0.085, (0.25, 0.1, 1))
    P.leaf(f, "leaf", top + Vector((0, 0.0, 0.01)), top + Vector((-0.04, 0.13, 0.05)), 0.07, (0.0, 0.25, 1))

    # the wooden sword, its edges glowing amber
    f, o, d, up = R.held("r")
    X = Vector((1, 0, 0))
    f.tube("bark", [o - d * 0.1, o + d * 0.085], 0.017, seg=8)
    f.ellipsoid("gold", o - d * 0.105, P.rr(R, 0.024), seg=(10, 8))
    P.box(f, "bark", o + d * 0.09, (0.014, 0.085, 0.02), ax=d, ay=X)
    w = 0.042
    tip = o + d * 0.66
    blade = [o + d * 0.1 + X * w, o + d * 0.55 + X * w, tip, o + d * 0.55 - X * w, o + d * 0.1 - X * w]
    P.plate(f, "weave", blade, 0.022, normal=up)
    for sgn in (1, -1):
        f.tube("glow", [o + d * 0.11 + X * w * sgn, o + d * 0.55 + X * w * sgn, tip], [0.008, 0.008, 0.003], seg=6)
    f.flat.add("weave")
    return R
