"""The Great Zambini, the Illusionist (trickster): a very tall showman, dark and fine. A deep indigo-black tailcoat
with gold-edged lapels over a plum waistcoat with gold buttons and an ivory shirt front, a stiff collar closed with a
gold brooch, dark plum gloves with gold cuffs, slick black hair and a small pointed goatee. A tall black top hat with
a deep violet band and a gold buckle, a cape that falls in soft folds from a gold-rimmed standing collar (black
outside, deep violet inside), and in the LEFT hand a black wand with gold ends and a glowing gold star (hold: torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("magic", sex="m", height=1.08, width=0.88, depth=0.86, head=0.94, skin="#d2a88a")
    z = R.z
    R.mat("coat", "#241f33", rough=0.62, double=True)
    R.mat("violet", "#5a2a84", rough=0.55, double=True)
    R.mat("ivory", "#cfc8b6", rough=0.7, double=True)
    R.mat("glove", "#3a2a4c", rough=0.6)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("hat", "#17161e", rough=0.3, double=True)
    R.mat("star", "#ffc850", rough=0.3, emit="#ffb030", strength=1.0)
    hair = P.hair(R, "Hair_Buzzed", "#16141c", rough=0.3)

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.009)
    R.fitted("Trousers", ["thigh", "calf"], "coat", offset=0.004)
    R.boots("hat", top=z["ankle"] + 0.08)
    P.toes(R, "hat")
    P.gloves(R, "glove")
    R.cuffs("gold", at=(0.92,), offset=0.012, thick=0.009)

    # the waistcoat and its gold buttons, the shirt front, the gold-edged lapels, the stiff collar and its brooch
    f = R.piece(P.trunk_w(R))
    P.wrap(R, f, "violet", z["waist"] - 0.04, z["chest"] + 0.02, -0.7, 0.7, off=0.019, taper=(1.0, 0.8), seg=12)
    P.wrap(R, f, "ivory", z["chest"] - 0.02, z["neck"] - 0.045, -0.4, 0.4, off=0.022, taper=(0.3, 1.0), seg=8)
    for k in range(4):
        p, n = P.on_trunk(R, z["waist"] - 0.01 + 0.055 * k, 0.0, off=0.026)
        f.ellipsoid("gold", p, (0.013, 0.008, 0.013), seg=(10, 6))
    for s in (1, -1):
        st = [(z["neck"] - 0.03, 0.72 * s), (z["chest"] + 0.06, 0.5 * s), (z["chest"] - 0.04, 0.22 * s), (z["waist"] + 0.03, 0.05 * s)]
        P.band_on(R, f, "coat", st, [0.075 - 0.05 * (k / 20) ** 1.5 for k in range(21)], thick=0.014, off=0.028)
        P.band_on(R, f, "gold", [(zz, a - 0.085 * s * (1 - i / 3.4)) for i, (zz, a) in enumerate(st)], 0.011, thick=0.012, off=0.032)
    f, gem, _ = P.collar(R, "ivory", height=0.06, grow=1.1, rim="gold", rim_r=0.005)
    f.ellipsoid("gold", gem + Vector((0, -0.006, 0.004)), (0.02, 0.012, 0.02), seg=(12, 8))
    f.ellipsoid("violet", gem + Vector((0, -0.016, 0.004)), (0.01, 0.006, 0.01), seg=(8, 6))

    # the coat's tails, lined in violet, gold at the hems
    hem = z["knee"] + 0.02
    rings = P.skirt_rings(R, hem, flare=1.22, depth=1.25)
    f = R.piece(R.hang_w(z["waist"], hem))
    for arc in ((PI - 1.3, PI - 0.04), (PI + 0.04, PI + 1.3)):
        P.cloth(f, "coat", rings, arc=arc, seg=14, rows=10, folds=9, amp=0.012)
        P.cloth(f, "violet", rings, arc=arc, seg=14, rows=10, folds=9, amp=0.012, off=-0.007)
        P.cloth(f, "gold", rings, arc=arc, seg=14, rows=1, folds=9, amp=0.012, z0=hem - 0.003, z1=hem + 0.02, off=0.004)
    R.band("coat", z["waist"] - 0.01, height=0.05, grow=1.13, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    for s in (1, -1):
        R.piece("pelvis").ellipsoid("gold", Vector((0.05 * s, cw.y + ryw * 1.2, z["waist"] - 0.01)), (0.014, 0.008, 0.014), seg=(10, 6))

    # the cape: soft folds from the shoulders to the calves, black outside, violet inside
    cc, rxc, ryc = R.ring(z["chest"])
    A = 1.05

    def cring(zz, xe, ye, yb):   # half width, the edges' depth, the middle's depth
        ry = (yb - ye) / (1 - math.cos(A))
        return (Vector((0, yb - ry, zz)), xe / math.sin(A), ry)
    back = cc.y + ryc
    cape = [cring(z["knee"] - 0.16, 0.38, back - 0.03, back + 0.2), cring(z["hip"], 0.32, back - 0.01, back + 0.12),
            cring(z["chest"], 0.24, back + 0.012, back + 0.055), cring(z["neck"] - 0.012, 0.125, back - 0.045, back + 0.012)]
    f = R.piece(P.cape_w(R, soft=0.2))
    arc = (PI - A, PI + A)
    P.cloth(f, "coat", cape, arc=arc, seg=40, rows=16, folds=17, amp=0.04, power=0.85, fade=0.08)
    P.cloth(f, "violet", cape, arc=arc, seg=40, rows=16, folds=17, amp=0.04, power=0.85, fade=0.08, off=-0.009)
    lo = cape[0][0].z
    P.cloth(f, "gold", cape, arc=arc, seg=40, rows=1, folds=17, amp=0.04, power=0.85, fade=0.08, z0=lo - 0.003, z1=lo + 0.022, off=0.004)
    for s in (1, -1):
        P.seam(f, "gold", cape, PI + A * s, r=0.006, off=0.0, n=16)
    # its standing collar, gold at the rim, and the chain that closes it over the collarbones
    f, _, top = P.collar(R, "coat", height=0.17, grow=1.2, flare=0.75, rim="gold", rim_r=0.007, arc=(PI - 1.75, PI + 1.75), base=1.75)
    P.collar(R, "violet", height=0.165, grow=1.17, flare=0.75, arc=(PI - 1.75, PI + 1.75), base=1.75)
    g = R.piece("spine_03")
    for s in (1, -1):
        P.band_on(R, g, "gold", [(z["neck"] - 0.06, 0.1 * s), (z["neck"] - 0.04, 0.95 * s), (z["neck"] - 0.03, 1.75 * s)], 0.012, thick=0.01, off=0.034)

    # the tall top hat: a violet band, a gold buckle
    H = P.head(R)
    f = R.piece("Head")
    z0 = H.top - 0.05
    c = Vector((0, H.c.y, 0))
    rx, ry = H.rx * 1.1, H.ry * 1.06
    f.loft("hat", [(c + Vector((0, 0, z0)), rx, ry), (c + Vector((0, 0, z0 + 0.13)), rx * 0.97, ry * 0.97), (c + Vector((0, 0, z0 + 0.25)), rx * 1.1, ry * 1.1)], seg=32, cap_top=True)
    f.loft("hat", [(c + Vector((0, 0, z0 + 0.014)), rx * 1.7, ry * 1.62), (c + Vector((0, 0, z0 - 0.004)), rx * 1.35, ry * 1.3), (c + Vector((0, 0, z0 + 0.004)), rx * 0.98, ry * 0.98)], seg=32)
    f.tube("hat", [c + Vector((rx * 1.7 * math.sin(a), -ry * 1.62 * math.cos(a), z0 + 0.014)) for a in [2 * PI * k / 32 for k in range(34)]], 0.007, seg=6, caps=False)
    f.loft("violet", [(c + Vector((0, 0, z0 + 0.012)), rx * 1.03, ry * 1.03), (c + Vector((0, 0, z0 + 0.062)), rx * 1.015, ry * 1.015)], seg=32)
    P.box(f, "gold", c + Vector((0, -ry * 1.04, z0 + 0.037)), (0.024, 0.006, 0.03))
    P.box(f, "violet", c + Vector((0, -ry * 1.04 - 0.004, z0 + 0.037)), (0.013, 0.006, 0.018))
    # the small pointed goatee
    ch = H.chin
    f.tube(hair, [ch + Vector((0, 0.014, 0.014)), ch + Vector((0, 0.004, -0.004)), ch + Vector((0, -0.002, -0.03))], [0.019, 0.017, 0.002], seg=8, squash=((1, 0, 0), 0.8))

    # the wand in the left hand, a glowing gold star at its tip
    f, o, d, up = R.held("l")
    s = P.along(R)
    X = Vector((1, 0, 0))
    f.tube("hat", [o - d * 0.13 * s, o + d * 0.36 * s], 0.011, seg=8)
    f.tube("gold", [o - d * 0.15 * s, o - d * 0.1 * s], 0.0125, seg=8)
    f.tube("gold", [o + d * 0.33 * s, o + d * 0.385 * s], 0.0125, seg=8)
    t = o + d * (0.385 * s + 0.075)
    P.star(f, "star", t, d, up, 0.095, 0.04, thick=0.022, points=5)
    P.star(f, "star", t, d, X, 0.095, 0.04, thick=0.022, points=5)
    f.ellipsoid("star", t, P.rr(R, 0.03), seg=(10, 8))
    return R
