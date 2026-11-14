"""The Briar Queen (the Wood's second ruler, a boss drawn about 2.6 to 2.9 times a hero's size: the Thorn Mother, the Briar
Witch, the Mire Heart): the wood's thorns made a queen. Built as a giantess: tall and broad-shouldered, a smaller head,
big hands. Pale green-grey skin, long black hair; a tall crown of black thorns in a fan behind her head; a high collar of
thorns standing round her neck. A gown of deep wine-black to the floor, its skirt wound round with black briar stems that
carry pink roses; a bodice of dark leaves rimmed in gold; long sleeves to the knuckles. In the LEFT hand a tall briar staff
that splits at its top into three thorned stems holding a glowing pink rose: her one light (hold: torch). Signature shape:
the thorn fan and the high thorn collar."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def thorns_along(f, key, pts, n, length, seed=0.0):
    """Short thorns on a stem: `n` of them, turning round it."""
    for k in range(n):
        i = min(len(pts) - 2, int((k + 0.5) / n * (len(pts) - 1)))
        a, b = pts[i], pts[i + 1]
        d = (b - a).normalized()
        u = d.orthogonal().normalized()
        v = d.cross(u)
        ang = seed + k * 2.4
        out = u * math.cos(ang) + v * math.sin(ang)
        f.tube(key, [a, a + out * length + d * length * 0.4], [length * 0.3, 0.0008], seg=5)


def rose(f, key, c, normal, r):
    """A rose: a ball of curled petals."""
    normal = Vector(normal).normalized()
    u = normal.orthogonal().normalized()
    v = normal.cross(u)
    f.ellipsoid(key, c, (r * 0.6,) * 3, seg=(10, 8))
    for k in range(6):
        a = 2 * PI * k / 6
        out = u * math.cos(a) + v * math.sin(a)
        PA.blade(f, key, c - normal * r * 0.3, c + out * r + normal * r * 0.35, r * 0.6, out, thick=0.3, belly=0.5, root=0.6)


def build():
    R = Real("wood_briar", sex="f", height=1.04, width=1.2, depth=1.14, head=0.86, skin="#a8b4a0", eyes="#ff9ac0")
    z = R.z
    R.mat("gown", "#2a1018", rough=0.6, double=True)
    R.mat("leaf", "#1c3420", rough=0.6, double=True)
    R.mat("thorn", "#151012", rough=0.45, double=True)
    R.mat("stem", "#2a2016", rough=0.7)
    R.mat("rose", "#c04a78", rough=0.5, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#ffd8e6", rough=0.25, emit="#ff6aa0", strength=1.2)
    PB.big_hands(R, 1.25)
    z = R.z
    R.hair("Hair_Long", "#121014", rough=0.5)

    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "gown", offset=0.009)
    R.fitted("Under", ["thigh", "calf", "foot", "ball"], "gown", offset=0.005)
    for n in "lr":
        P.sleeve(R, n, "gown", t0=0.6, t1=1.06, r0=0.01, r1=0.05, rim="gold", rim_r=0.006, seg=14, n=4)
    hem = z["ankle"] - 0.02
    f, rings = P.skirt(R, "gown", hem, flare=1.85, depth=1.15, folds=12, amp=0.032, seg=60, trim="gold", trim_h=0.025)
    # black briar stems winding down round the skirt, with roses
    for s0 in (0.0, 2.1, 4.2):
        pts = []
        for k in range(26):
            t = k / 25
            zz = z["waist"] - 0.05 - (z["waist"] - 0.05 - hem - 0.06) * t
            a = s0 + 2.4 * t
            c, rx, ry = P.ring_at(rings, zz)
            pts.append(Vector((c.x + (rx + 0.02) * math.sin(a), c.y - (ry + 0.02) * math.cos(a), zz)))
        f.tube("stem", pts, 0.012, seg=7)
        thorns_along(f, "thorn", pts, 12, 0.03, seed=s0)
        for t in (0.3, 0.7):
            p = pts[int(t * 25)]
            out = Vector((p.x, p.y - rings[0][0].y, 0)).normalized()
            rose(f, "rose", p + out * 0.02, out, 0.035)
    # the leaf bodice rimmed in gold
    cc, rxc, ryc = R.ring(z["chest"])
    bf = R.piece("spine_02")
    for row in range(3):
        zz = z["waist"] + 0.03 + row * 0.08
        for k in range(8):
            a = -1.2 + 2.4 * k / 7 + (0.15 if row % 2 else 0)
            p, out = P.on_trunk(R, zz, a, off=0.016)
            PA.blade(bf, "leaf", p + Vector((0, 0, 0.04)), p - Vector((0, 0, 0.05)) + out * 0.015, 0.032, out, thick=0.2, belly=0.5, root=0.6)
    R.band("gold", z["waist"] - 0.01, height=0.03, grow=1.12, how=R.hang_w(z["waist"], hem))

    # the high collar of thorns round the neck, the thorn fan behind the head
    fc, foot, top = P.collar(R, "gown", height=0.1, grow=1.25, flare=0.25, rim="gold", rim_r=0.006)
    c0, a0, b0 = top
    for k in range(16):
        a = 2 * PI * k / 16
        p = Vector((c0.x + a0 * math.sin(a), c0.y - b0 * math.cos(a), c0.z))
        out = Vector((math.sin(a), -math.cos(a), 0))
        if abs(math.sin(a / 2)) < 0.22:
            continue
        fc.tube("thorn", [p, p + out * 0.04 + Vector((0, 0, 0.08)), p + out * 0.06 + Vector((0, 0, 0.13))], [0.01, 0.006, 0.0012], seg=6)
    h = P.head(R)
    hp = R.piece("Head")
    back = h.c + Vector((0, h.ry * 0.8, h.rz * 0.3))
    for k in range(9):
        a = -1.25 + 2.5 * k / 8
        ln = 0.22 + 0.12 * math.cos(a) ** 2
        tip = back + Vector((math.sin(a) * ln, 0.04, math.cos(a) * ln))
        hp.tube("thorn", [back, back.lerp(tip, 0.5) + Vector((0, 0.015, 0)), tip], [0.016, 0.01, 0.0015], seg=7)
        thorns_along(hp, "thorn", [back.lerp(tip, 0.3), back.lerp(tip, 0.8)], 2, 0.03, seed=k)
    hp.torus("gold", back, 0.05, 0.009, normal=(0, 1, 0), seg=(18, 6))
    rose(hp, "rose", back + Vector((0, -0.01, 0.0)), (0, -1, 0.3), 0.03)

    # the briar staff in the left hand, splitting into three stems round the glowing rose
    hd = K.hand(R)
    f = hd.f
    pts = [K.at(hd, t, fwd=0.01 * math.sin(t * 7)) for t in [-1.3 + 1.75 * k / 20 for k in range(21)]]
    f.tube("stem", pts, [0.024 - 0.006 * k / 20 for k in range(21)], seg=9)
    thorns_along(f, "thorn", pts[2:-2], 10, 0.035)
    top = K.at(hd, 0.66)
    for a in (0.0, 2.1, 4.2):
        out = hd.fwd * math.cos(a) + hd.side * math.sin(a)
        st = [K.at(hd, 0.45), K.at(hd, 0.55) + out * 0.05, top + out * 0.06, top + out * 0.03 + hd.d * 0.07]
        f.tube("stem", PA.smooth(st, 4), 0.01, seg=6)
    rose(f, "rose", top, hd.d, 0.05)
    f.ellipsoid("glow", top + hd.d * 0.01, P.rr(R, 0.026), seg=(12, 8))
    f.torus("gold", K.at(hd, 0.42), 0.03, 0.008, normal=hd.d, seg=(16, 6))
    return R
