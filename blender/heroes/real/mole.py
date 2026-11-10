"""Mabel, the Deepdelver (assassin): a mole-folk miner, stout and short, in dark velvety fur. A mole's head: one smooth
form from the skull into a long muzzle, a small dusky-rose nose, small calm black eyes, no neck. A close bronze helm
with a gold ridge and brass goggles pushed up on its brow, a glowing amber crystal lantern in a gold cage on top. A
studded leather cuirass and strap skirt with a gold-buckled belt, gold-banded bracers, dark boots, a pick slung across
her back. Enormous spade paws with five long pale claws each, tipped in gold (attack: claw)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("mole", sex="f", height=0.74, width=1.1, depth=1.3, head=1.3)
    z = R.z
    R.mat("fur", "#40363e", rough=0.95)
    R.mat("leather", "#7a5030", rough=0.75, double=True)
    R.mat("dark", "#2e1e16", rough=0.7, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("bronze", "#8a5a30", rough=0.38, metal=0.75)
    R.mat("claw", "#d8cfae", rough=0.4)
    R.mat("nose", "#a85a6a", rough=0.4)
    R.mat("black", "#0c0a0a", rough=0.18)
    R.mat("crystal", "#ffb040", rough=0.15, emit="#ff9a20", strength=1.0)
    R.faceless()
    R.hide(list(P.FINGERS))

    R.fitted("Fur", lambda i: R.dom[i].startswith(("neck_", "upperarm_", "hand_", "thigh_", "calf_", "pelvis")), "fur", offset=0.014)
    R.fitted("Yoke", ["spine", "clavicle"], "leather", offset=0.014)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.02)
    top = z["knee"] - 0.03
    R.boots("dark", top=top, offset=0.02)
    R.fitted("BootTops", lambda i: R.dom[i].startswith(("calf_", "thigh_")) and top - 0.04 < R.world[i].z < top + 0.004, "gold", offset=0.026, keep_skin=True)
    P.toes(R, "dark", size=1.14)
    for n in "lr":   # the bracers' gold bands
        for t0, t1 in ((0.04, 0.16), (0.44, 0.56), (0.86, 0.98)):
            P.sleeve(R, n, "gold", t0=t0, t1=t1, r0=0.024, r1=0.0, seg=14, n=2)

    # the cuirass: a stout barrel of studded leather over the trunk, gold at its edges, the belt and its buckle
    hem = z["knee"] + 0.2
    cw, rxw, ryw = R.ring(z["waist"])
    cc, rxc, ryc = R.ring(z["chest"])
    ch, rxh, ryh = R.ring(z["hip"])
    barrel = [(Vector((0, ch.y * 0.6, z["hip"] + 0.03)), rxh * 1.13, ryh * 1.58), (Vector((0, 0.012, z["waist"] + 0.03)), rxh * 1.0, ryh * 1.66),
              (Vector((0, 0.0, z["chest"] - 0.02)), rxh * 0.96, ryc * 1.5), (Vector((0, 0.012, z["chest"] + 0.145)), rxc * 1.02, ryc * 0.98)]
    f = R.piece(P.trunk_w(R, hem))
    P.cloth(f, "leather", barrel, seg=40, rows=10)
    lo, hi = barrel[0][0].z, barrel[-1][0].z
    P.cloth(f, "gold", barrel, seg=40, rows=1, z0=lo - 0.004, z1=lo + 0.022, off=0.005)
    P.cloth(f, "gold", barrel, seg=40, rows=1, z0=hi - 0.02, z1=hi + 0.004, off=0.005)
    P.cloth(f, "dark", barrel, seg=40, rows=1, z0=z["waist"] - 0.04, z1=z["waist"] + 0.04, off=0.007)
    c, rx, ry = P.ring_at(barrel, z["waist"])
    f.ellipsoid("gold", Vector((0, c.y - ry - 0.012, z["waist"])), (0.05, 0.016, 0.044), seg=(14, 8))
    f.ellipsoid("dark", Vector((0, c.y - ry - 0.024, z["waist"])), (0.026, 0.008, 0.022), seg=(10, 6))
    for zz, n in ((z["chest"] + 0.06, 9), (z["chest"] - 0.05, 10), (z["waist"] + 0.085, 10), (z["waist"] - 0.085, 10)):
        c, rx, ry = P.ring_at(barrel, zz)
        for k in range(n):
            a = 2 * PI * (k + 0.5 * (n % 2)) / n
            f.ellipsoid("gold", Vector((c.x + (rx + 0.004) * math.sin(a), c.y - (ry + 0.004) * math.cos(a), zz)), (0.015, 0.015, 0.015), seg=(8, 6))
    # the strap skirt under it
    P.skirt(R, "dark", hem, flare=1.26, depth=1.3, folds=18, amp=0.008, trim="gold", trim_h=0.02, seg=72, rows=5, grow=0.96)
    P.collar(R, "leather", height=0.05, grow=1.5, flare=0.1, rim="gold", rim_r=0.008)
    R.pauldrons("leather", size=(0.09, 0.085, 0.045), lift=0.04, out=0.02)
    for s, n in ((1, "l"), (-1, "r")):
        R.piece(f"upperarm_{n}").ellipsoid("gold", R.bone(f"upperarm_{n}") + Vector((0.02 * s, 0, 0.083)), (0.018, 0.018, 0.012), seg=(8, 6))

    # the head: one smooth form, skull into muzzle
    f, c, r = R.head_piece()
    c = Vector((0, 0.0, z["head"] + 0.075))
    prof = [(0.155, 0.010, 0.02, 0.02), (0.130, 0.012, 0.09, 0.08), (0.070, 0.016, 0.138, 0.118), (0.0, 0.016, 0.15, 0.128), (-0.06, 0.008, 0.142, 0.118),
            (-0.12, -0.006, 0.114, 0.096), (-0.18, -0.022, 0.084, 0.072), (-0.24, -0.036, 0.062, 0.054), (-0.29, -0.046, 0.047, 0.042),
            (-0.325, -0.052, 0.032, 0.03), (-0.342, -0.055, 0.012, 0.012)]
    P.hull(f, "fur", [c + Vector((0, y, dz)) for y, dz, rx, rz in prof], [q[2] for q in prof], [q[3] for q in prof], seg=24)
    # the lower jaw under the muzzle, the nose, the eyes
    jaw = [(-0.03, -0.085, 0.085, 0.04), (-0.1, -0.082, 0.08, 0.036), (-0.17, -0.078, 0.06, 0.028), (-0.235, -0.076, 0.042, 0.02), (-0.275, -0.074, 0.02, 0.01)]
    P.hull(f, "fur", [c + Vector((0, y, dz)) for y, dz, rx, rz in jaw], [q[2] for q in jaw], [q[3] for q in jaw], seg=16)
    f.ellipsoid("nose", c + Vector((0, -0.338, -0.052)), (0.025, 0.02, 0.02), seg=(14, 10))
    for s in (1, -1):
        f.ellipsoid("black", c + Vector((0.079 * s, -0.125, 0.056)), (0.015, 0.015, 0.015), seg=(10, 8))
        f.ellipsoid("fur", c + Vector((0.135 * s, 0.03, -0.05)), (0.05, 0.09, 0.07), seg=(12, 8))   # the cheeks into the neck
    # the helm: bronze, a gold brow band, a gold ridge, goggles up on the brow
    hc, hr = c + Vector((0, 0.025, 0.03)), (0.162, 0.172, 0.152)
    P.shell(f, "bronze", hc, hr, P.rim_line(0.72, -0.12, -0.5, w0=0.5, w1=1.25), seg=36, rows=9, rim="gold", rim_r=0.011)
    ridge = [P.on_shell(hc, (hr[0], hr[1] * 1.01, hr[2] * 1.01), a, e)[0] for a, e in ((0, 0.74), (0, 0.86), (0, 0.96), (0, 1.0), (PI, 0.94), (PI, 0.8), (PI, 0.55), (PI, 0.2), (PI, -0.2), (PI, -0.48))]
    P.hull(f, "gold", ridge, 0.014, 0.016, seg=8)
    for s in (1, -1):
        p, n = P.on_shell(hc, hr, 0.42 * s, 0.8)
        f.torus("gold", p + n * 0.012, 0.04, 0.011, normal=n, seg=(18, 6))
        f.ellipsoid("black", p + n * 0.008, (0.034, 0.034, 0.012), seg=(12, 6), rot=P.rot_to(n))
    big = (hr[0] + 0.004, hr[1] + 0.004, hr[2] + 0.004)
    for s in (1, -1):   # the goggles' strap round the helm
        f.tube("dark", [P.on_shell(hc, big, a * s, 0.8 - 0.42 * P.smooth((a - 0.6) / 1.2))[0] for a in (0.6, 0.9, 1.3, 1.8, 2.4, PI)], 0.012, seg=6)
    # the crystal lantern on top, in a gold cage
    t = hc + Vector((0, -0.045, hr[2] * 0.98))
    f.torus("gold", t + Vector((0, 0, 0.004)), 0.04, 0.009, seg=(18, 6))
    f.tube("crystal", [t, t + Vector((0, 0, 0.045)), t + Vector((0, 0, 0.095)), t + Vector((0, 0, 0.13))], [0.024, 0.034, 0.028, 0.002], seg=6)
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        q = Vector((math.cos(a), math.sin(a), 0))
        f.tube("gold", [t + q * 0.04, t + q * 0.046 + Vector((0, 0, 0.06)), t + q * 0.03 + Vector((0, 0, 0.115)), t + Vector((0, 0, 0.15))], 0.005, seg=5)
    f.ellipsoid("gold", t + Vector((0, 0, 0.152)), (0.012, 0.012, 0.012), seg=(8, 6))

    # the spade paws: a broad flat mitt, five long pale claws tipped in gold
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"hand_{n}")
        h = R.bone(f"hand_{n}")
        d = (R.bone(f"middle_01_{n}") - h).normalized()
        y = Vector((0, 1, 0))
        m = h + d * 0.085 + Vector((0, 0, -0.012))
        f.ellipsoid("fur", m, (0.125, 0.115, 0.068), seg=(18, 10))
        for k in range(5):
            a = (k - 2) * 0.42
            q = d * math.cos(a) - y * math.sin(a)
            q2 = d * math.cos(a * 0.55) - y * math.sin(a * 0.55)
            b0 = m + q * 0.098 + Vector((0, 0, -0.004))
            ln = 0.19 - 0.02 * abs(k - 2)
            p1, p2, p3 = b0 + q2 * ln * 0.45 + Vector((0, 0, -0.008)), b0 + q2 * ln * 0.78 + Vector((0, 0, -0.03)), b0 + q2 * ln + Vector((0, 0, -0.058))
            f.tube("claw", [b0 - q * 0.02, b0, p1, p2], [0.014, 0.026, 0.021, 0.013], seg=8, squash=((0, 0, 1), 0.9))
            f.tube("gold", [p1.lerp(p2, 0.75), p2, p3], [0.0155, 0.014, 0.002], seg=8, squash=((0, 0, 1), 0.9))

    # a stub of a tail, and the pick slung across her back
    cc, rxc, ryc = R.ring(z["chest"])
    R.piece("pelvis").ellipsoid("fur", Vector((0, ch.y + ryh * 1.75, z["hip"] - 0.07)), (0.04, 0.07, 0.04), seg=(10, 8))
    f = R.piece("spine_03")
    yb = cc.y + ryc * 1.45 + 0.03
    a0, a1 = Vector((-0.17, yb, z["waist"] - 0.02)), Vector((0.2, yb, z["neck"] + 0.07))
    u = (a1 - a0).normalized()
    v = Vector((u.z, 0, -u.x))
    f.tube("dark", [a0, a1], 0.017, seg=8)
    f.torus("gold", a0.lerp(a1, 0.9), 0.022, 0.008, normal=u, seg=(12, 6))
    f.tube("bronze", [a1 - v * 0.21 - u * 0.04, a1 - v * 0.11 - u * 0.006, a1 + u * 0.008, a1 + v * 0.11 - u * 0.006, a1 + v * 0.21 - u * 0.04], [0.004, 0.022, 0.03, 0.022, 0.004], seg=8,
           squash=((0, 1, 0), 0.6))
    return R
