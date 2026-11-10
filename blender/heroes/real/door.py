"""Wick, the Doorwarden (controller): keeper of thresholds, old and thin as a door. A long dark oxblood coat to below
the knee with wide gold braid down the front, at the hem and at the cuffs, a high stiff collar, small gold shoulder
plates, dark gloves, a hood lying back on his shoulders with a gold rim and its point down his back, short silver
hair. A great brass ring of oversized keys hanging from his belt at the right hip, and in the LEFT hand a small dark
lantern with a gold frame, held up: his one glowing piece (hold: torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("door", sex="m", height=1.04, width=0.84, depth=0.8, head=0.98, skin="#d2ac90")
    z = R.z
    R.mat("coat", "#5c1a22", rough=0.68, double=True)
    R.mat("lining", "#2e1018", rough=0.8, double=True)
    R.mat("dark", "#221e26", rough=0.55, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("brass", "#c9983c", rough=0.3, metal=0.85)
    R.mat("glow", "#ffc058", rough=0.3, emit="#ffa83a", strength=1.0)
    R.hair("Hair_SimpleParted", "#a4a4ac", rough=0.8)

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.01)
    R.fitted("Trousers", ["thigh", "calf"], "dark", offset=0.004)
    R.boots("dark", top=z["ankle"] + 0.12)
    P.toes(R, "dark")
    P.gloves(R, "dark")
    for n in "lr":
        P.sleeve(R, n, "gold", t0=0.72, t1=0.95, r0=0.014, r1=0.0, seg=14, n=2)
    R.cuffs("gold", at=(0.7, 0.96), offset=0.016, thick=0.007)

    # the coat's long skirt, open a hand's width down the front, wide gold braid at its edges and its hem
    hem = z["knee"] - 0.14
    gap, braid = 0.1, 0.1
    f, rings = P.skirt(R, "coat", hem, flare=1.5, depth=1.15, arc=(gap, 2 * PI - gap), folds=11, amp=0.024, trim="gold", trim_h=0.045, seg=56)
    P.cloth(f, "lining", rings, arc=(-gap - 0.06, gap + 0.06), seg=4, rows=8, off=-0.012)
    cw, rxw, ryw = rings[-1]
    pol = lambda a: math.atan2(rxw * math.sin(a), ryw * math.cos(a))
    up = R.piece(P.trunk_w(R, hem))
    top = z["neck"] - 0.05
    for s in (1, -1):
        a0, a1 = sorted((gap * s, (gap + braid) * s))
        P.cloth(f, "gold", rings, arc=(a0, a1), seg=2, rows=10, off=0.006)
        P.band_on(R, up, "gold", [(z["waist"] - 0.01, pol(gap + braid / 2) * s), (z["chest"], 0.2 * s), (top, 0.2 * s)], 0.05, thick=0.012, off=0.018)
        for k in range(5):   # the frogs across the braid
            zz = z["waist"] + 0.05 + (top - z["waist"] - 0.1) * k / 4
            P.band_on(R, up, "gold", [(zz, 0.0), (zz, 0.42 * s)], [0.02 - 0.012 * (i / 6) for i in range(7)], thick=0.012, off=0.02, n=6)
    f, gem, _ = P.collar(R, "coat", height=0.1, grow=1.1, flare=0.1, rim="gold", rim_r=0.007)
    f.ellipsoid("gold", gem + Vector((0, -0.008, 0.0)), (0.02, 0.012, 0.02), seg=(12, 8))
    R.pauldrons("gold", size=(0.08, 0.075, 0.028), lift=0.036, out=0.02)

    # the hood lying back on his shoulders: a gold rim, its point down his back
    cc, rxc, ryc = R.ring(z["chest"])
    back, nk = cc.y + ryc, z["neck"]
    f = R.piece("spine_03")
    f.ellipsoid("coat", Vector((0, back + 0.01, nk - 0.04)), (0.2, 0.115, 0.09), seg=(20, 10))
    f.tube("coat", [Vector((0, back + 0.05, nk - 0.05)), Vector((0, back + 0.075, nk - 0.17)), Vector((0, back + 0.055, nk - 0.3)), Vector((0, back + 0.04, nk - 0.36))],
           [0.105, 0.07, 0.03, 0.004], seg=10, squash=((0, 1, 0), 0.6))
    f.tube("gold", [Vector((0.195 * math.sin(a), back + 0.01 - 0.11 * math.cos(a), nk - 0.008 + 0.03 * math.cos(a))) for a in [(PI - 1.5 + 3.0 * k / 14) for k in range(15)]], 0.011, seg=6)
    f.ellipsoid("lining", Vector((0, back + 0.03, nk + 0.008)), (0.14, 0.07, 0.03), seg=(14, 6))
    f.ellipsoid("gold", Vector((0, back + 0.04, nk - 0.365)), (0.014, 0.014, 0.02), seg=(8, 6))

    # the belt, and the great brass ring of oversized keys at the right hip
    how = R.hang_w(z["waist"], hem)
    R.band("dark", z["waist"], height=0.06, grow=1.16, how=how)
    c0, rx0, ry0 = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("gold", Vector((0, c0.y - ry0 * 1.26, z["waist"])), (0.036, 0.012, 0.03), seg=(12, 8))
    a = -0.95
    c, rx, ry = P.ring_at(rings, z["waist"] - 0.15)
    nrm = Vector((math.sin(a), -math.cos(a), 0))
    tan = Vector((math.cos(a), math.sin(a), 0))
    Zv = Vector((0, 0, 1))
    p = Vector((c.x + (rx + 0.04) * math.sin(a), c.y - (ry + 0.04) * math.cos(a), c.z))
    big = 0.105
    f.torus("brass", p, big, 0.012, normal=nrm, seg=(32, 8))
    cb, rxb, ryb = P.ring_at(rings, z["waist"])
    f.tube("dark", [Vector((cb.x + (rxb + 0.03) * math.sin(a), cb.y - (ryb + 0.03) * math.cos(a), z["waist"] - 0.02)), p + Zv * (big + 0.005)], 0.012, seg=6, squash=(tuple(nrm), 0.4))
    f.torus("gold", p + Zv * big, 0.02, 0.007, normal=tan, seg=(12, 6))
    kb = R.piece("pelvis")
    kb.flat.add("brass")
    for k in range(-2, 3):
        ph = k * 0.36
        q = p + (tan * math.sin(ph) - Zv * math.cos(ph)) * big + nrm * (0.012 + 0.007 * (k % 2))
        dv = (tan * math.sin(ph * 0.75) - Zv * math.cos(ph * 0.75)).normalized()
        sd = dv.cross(nrm)
        ln = 0.26 - 0.025 * abs(k)
        f.torus("brass", q + dv * 0.022, 0.03, 0.008, normal=nrm, seg=(16, 6))
        f.tube("brass", [q + dv * 0.05, q + dv * ln], 0.009, seg=8)
        f.torus("brass", q + dv * 0.075, 0.012, 0.005, normal=dv, seg=(10, 5))
        P.box(kb, "brass", q + dv * (ln - 0.035) + sd * 0.026, (0.022, 0.007, 0.026), ax=sd, ay=nrm)
        P.box(kb, "brass", q + dv * (ln - 0.022) + sd * 0.055, (0.01, 0.007, 0.012), ax=sd, ay=nrm)

    # the small lantern, held up in the left hand
    f, o, d, upv = R.held("l")
    s = P.along(R)
    w, dd, h, _ = R.build
    X = Vector((1, 0, 0))
    f.tube("dark", [o - d * 0.11 * s, o + d * 0.1 * s], 0.015, seg=8)
    f.ellipsoid("gold", o - d * 0.115 * s, P.rr(R, 0.022), seg=(10, 6))
    b = o + d * 0.1 * s
    r = 0.062
    ring = lambda q, m=1.0: [b + d * q + (X * (math.cos(PI / 4 + PI / 2 * k) / w) + upv * (math.sin(PI / 4 + PI / 2 * k) / h)) * r * m for k in range(4)]
    P.hull(f, "gold", [b, b + d * 0.025], r * 1.25 / w, r * 1.25 / h, seg=8, side=X)
    P.hull(f, "glow", [b + d * 0.025, b + d * 0.2], r * 0.72 / w, r * 0.72 / h, seg=8, side=X)
    for p0, p1 in zip(ring(0.02), ring(0.2)):
        f.tube("dark", [p0, p1], 0.0085, seg=5)
    for q in (0.11,):
        pts = ring(q)
        f.tube("dark", pts + pts[:1], 0.006, seg=5)
    P.hull(f, "gold", [b + d * 0.2, b + d * 0.215, b + d * 0.27, b + d * 0.3], [r * 1.3 / w, r * 1.35 / w, r * 0.6 / w, 0.01], [r * 1.3 / h, r * 1.35 / h, r * 0.6 / h, 0.01], seg=8, side=X)
    f.torus("brass", b + d * 0.325, 0.026, 0.006, normal=upv, seg=(14, 6))
    return R
