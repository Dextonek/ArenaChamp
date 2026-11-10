"""Pom, of the Changeling Twins (fighter, the ranged half): a fae child with long pointed ears, on the one body the
twins share (real/parts_c.py `twin`). A deep blue leaf tunic, a blue leaf hood with a bead on its point and the ears
out at the sides, and a slingshot in the right hand with a glowing blue band and stone."""
import math

from mathutils import Vector

from realkit import PI
from real import parts_c as P


def build():
    R, T = P.twin("pom", "#2a6a98", "#3f8fc2", "#8ad0ff", "#4ab8ff")
    H = T.H
    # the leaf hood: up round the face, a rolled leaf edge, its point falling back with a gold bead
    f = R.piece("Head")
    hc, hr = H.c + Vector((0, 0.012, 0.012)), (H.rx * 1.2, H.ry * 1.2, H.rz * 1.2)
    P.shell(f, "tunic", hc, hr, P.rim_line(0.4, -0.72, -0.93, w0=0.45, w1=1.0), seg=32, rows=10, rim="leaf", rim_r=0.014)
    p, n = P.on_shell(hc, hr, PI, 0.72)
    tail = [p - n * 0.02, p + Vector((0, 0.045, 0.03)), p + Vector((0, 0.1, 0.0)), p + Vector((0, 0.125, -0.07))]
    f.tube("tunic", tail, [0.06, 0.045, 0.028, 0.008], seg=10)
    f.ellipsoid("gold", tail[-1] + Vector((0, 0, -0.012)), (0.02, 0.02, 0.02), seg=(10, 8))
    for k in range(5):   # leaves laid over the hood's crown
        a = -1.2 + 0.6 * k
        p0, _ = P.on_shell(hc, (hr[0] + 0.004, hr[1] + 0.004, hr[2] + 0.004), a, 0.93)
        p1, n1 = P.on_shell(hc, (hr[0] + 0.006, hr[1] + 0.006, hr[2] + 0.006), a, 0.45)
        P.leaf(f, "leaf", p0, p1, 0.07, n1)

    # the slingshot: a bark fork, a glowing blue band drawn back to a glowing stone
    f, o, d, up = R.held("r")
    X = Vector((1, 0, 0))
    f.tube("bark", [o - d * 0.11, o + d * 0.1], [0.016, 0.019], seg=8)
    f.ellipsoid("gold", o - d * 0.115, P.rr(R, 0.022), seg=(10, 8))
    f.torus("gold", o + d * 0.1, 0.021, 0.006, normal=d, seg=(14, 6))
    tips = []
    for sgn in (1, -1):
        pr = [o + d * 0.1, o + d * 0.17 + X * 0.065 * sgn, o + d * 0.27 + X * 0.11 * sgn, o + d * 0.4 + X * 0.115 * sgn]
        f.tube("bark", pr, [0.02, 0.018, 0.016, 0.013], seg=8)
        f.ellipsoid("gold", pr[-1], P.rr(R, 0.017), seg=(8, 6))
        tips.append(pr[-1])
    stone = o + d * 0.22 + up * 0.09
    for t in tips:
        f.tube("glow", [t, t.lerp(stone, 0.5) + up * 0.008, stone], 0.009, seg=6)
    f.ellipsoid("bark", stone - d * 0.016, (0.038, 0.018, 0.038), seg=(10, 6))
    f.ellipsoid("glow", stone + d * 0.006, P.rr(R, 0.034), seg=(12, 8))
    return R
