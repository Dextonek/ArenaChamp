"""The Thorn sprite (the Wood's casting enemy, "floats back and throws thorns"): a fae of the briars, slight and quick.
Pale green skin, long dark-green hair, a crown of black thorns with one pink bud; a close bodice of overlapping rose-pink
petals over a short skirt of dark leaves, bark greaves and bare feet; two long leaf wings rising from her shoulder blades,
dark green edged in pink. In the LEFT hand a briar wand twisted round itself, a glowing pink bloom at its top: her one
light (hold: torch). Signature shape: the leaf wings and the thorn crown."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K

LIGHT = {"faces": 10000}


def build():
    R = Real("wood_sprite", sex="f", height=0.95, width=0.86, depth=0.88, head=1.0, skin="#b9c9a2", eyes="#ffd0e0")
    z = R.z
    R.mat("petal", "#b8456e", rough=0.55, double=True)
    R.mat("leaf", "#24452a", rough=0.6, double=True)
    R.mat("bark", "#3e2a1c", rough=0.75)
    R.mat("thorn", "#1a1418", rough=0.45)
    R.mat("pink", "#e889a8", rough=0.5, double=True)
    R.mat("glow", "#ffd8e6", rough=0.3, emit="#ff7aa8", strength=1.0)
    R.hair("Hair_Long", "#1f3a26", rough=0.55)

    # the petal bodice, the leaf skirt, the bark greaves
    R.fitted("Bodice", ["spine", "pelvis", "clavicle"], "leaf", offset=0.007, above=z["hip"] - 0.05)
    cc, rxc, ryc = R.ring(z["chest"])
    bf = R.piece("spine_02")
    # a collar of petals round the top of the bodice, hanging over the chest and the shoulders
    bf = R.piece("spine_03")
    for row in range(2):
        zz = z["chest"] + 0.06 - row * 0.035
        for k in range(16):
            a = -PI + 2 * PI * (k + 0.5 * row) / 16
            p, out = P.on_trunk(R, zz, a, off=0.012 + 0.006 * row)
            PA.blade(bf, "petal" if row == 0 else "pink", p + Vector((0, 0, 0.015)), p - Vector((0, 0, 0.06)) + out * 0.03, 0.03, out, thick=0.25, belly=0.5, root=0.6)
    hem = z["knee"] + 0.08
    f, rings = P.skirt(R, "leaf", hem, flare=1.35, depth=1.1, folds=9, amp=0.012, seg=44)
    # the hem cut into leaf points
    for k in range(14):
        a = 2 * PI * k / 14
        p = P.ring_at(rings, hem + 0.02)
        c, rx, ry = p
        q = Vector((c.x + rx * math.sin(a) * 1.01, c.y - ry * math.cos(a) * 1.01, hem + 0.03))
        out = Vector((math.sin(a), -math.cos(a), 0))
        PA.blade(f, "leaf", q, q + Vector((0, 0, -0.09)) + out * 0.02, 0.028, out, thick=0.2, belly=0.4, root=0.8)
    R.band("bark", z["waist"] - 0.01, height=0.03, grow=1.1, how=R.hang_w(z["waist"], hem))
    R.fitted("Greaves", lambda i: R.dom[i].startswith("calf") and R.world[i].z > z["ankle"] + 0.03 and R.world[i].z < z["knee"] - 0.02, "bark", offset=0.006)
    for n in "lr":
        c, r = R.leg_r(n, z["ankle"] + 0.06)
        R.piece(f"calf_{n}").torus("pink", c, r + 0.012, 0.006, seg=(16, 5))

    # the thorn crown with one pink bud
    h = P.head(R)
    hp = R.piece("Head")
    zc = h.c.z + h.rz * 0.45
    for k in range(11):
        a = -2.3 + 4.6 * k / 10
        base = Vector((h.rx * 1.02 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), zc))
        out = Vector((math.sin(a), -math.cos(a), 0))
        ln = 0.07 + 0.05 * math.cos(a * 1.2) ** 2
        hp.tube("thorn", [base, base + out * 0.02 + Vector((0, 0, ln * 0.6)), base + out * 0.035 + Vector((0, 0, ln))], [0.008, 0.005, 0.0015], seg=6)
    ring = [Vector((h.rx * 1.02 * math.sin(a), h.c.y - h.ry * 1.05 * math.cos(a), zc)) for a in [-2.4 + 4.8 * k / 20 for k in range(21)]]
    hp.tube("thorn", ring, 0.007, seg=6)
    bud = Vector((0.03, h.c.y - h.ry * 1.06, zc + 0.02))
    hp.ellipsoid("pink", bud, (0.018, 0.016, 0.022), seg=(10, 8))

    # the leaf wings from her shoulder blades: two long leaves and a short one each side, rising and sweeping out
    wf = R.piece("spine_03")
    by = cc.y + ryc + 0.02
    for s in (1, -1):
        root = Vector((0.06 * s, by, z["chest"] + 0.02))
        for ln, rise, wide in ((0.7, 0.55, 0.1), (0.52, 0.18, 0.08), (0.34, -0.2, 0.055)):
            tip = root + Vector((ln * 0.82 * s, 0.1, ln * rise + 0.05))
            PA.blade(wf, "leaf", root, tip, wide, (0, 1, 0.2), thick=0.08, belly=0.42, root=0.2)
            PA.blade(wf, "pink", root + Vector((0, 0.004, 0)), root.lerp(tip, 0.96) + Vector((0, 0.004, 0)), wide * 0.3, (0, 1, 0.2), thick=0.3, belly=0.42, root=0.2)
        wf.ellipsoid("bark", root, (0.025, 0.02, 0.025), seg=(10, 6))

    # the briar wand in the left hand: two stems twisted round each other, thorns, the glowing bloom at the top
    hd = K.hand(R)
    f = hd.f
    for ph in (0.0, PI):
        pts = [K.at(hd, t, fwd=0.012 * math.cos(ph + t * 18), side=0.012 * math.sin(ph + t * 18)) for t in [-0.5 + 1.05 * k / 30 for k in range(31)]]
        f.tube("bark", pts, 0.009, seg=6)
    for k in range(8):
        t = -0.35 + 0.1 * k
        q = K.at(hd, t)
        out = (hd.fwd * math.cos(k * 2.3) + hd.side * math.sin(k * 2.3))
        f.tube("thorn", [q + out * 0.01, q + out * 0.035 + hd.d * 0.012], [0.005, 0.001], seg=5)
    top = K.at(hd, 0.56)
    for k in range(6):
        a = 2 * PI * k / 6
        out = hd.fwd * math.cos(a) + hd.side * math.sin(a)
        PA.blade(f, "pink", top - hd.d * 0.01, top + out * 0.05 + hd.d * 0.035, 0.024, hd.d.cross(out), thick=0.25, belly=0.5, root=0.5)
    f.ellipsoid("glow", top + hd.d * 0.012, P.rr(R, 0.024), seg=(12, 8))
    return R
