"""The Moss-Abbess (the Wood's keeper, who gives the main quest): she sounds the horn that keeps the walking wood asleep.
A tall older woman under a deep pointed hood of moss green lined in forest dark, a gold edge round her face. A forest
green gown to the floor in folds with a gold hem, wide sleeves edged in gold, a moss mantle on the shoulders with a
fringe of moss cords, a long moss cloak down her back, a bark girdle. An amber stone at her throat: her one light. In the
LEFT hand a great curled horn of pale bone ringed in gold, its bell up (hold: torch). Signature shape: the hood and the
horn."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_abbess", sex="f", height=1.04, width=0.95, depth=0.96, skin="#c8a088")
    z = R.z
    R.mat("forest", "#1e3a26", rough=0.66, double=True)
    R.mat("deep", "#10211a", rough=0.75, double=True)
    R.mat("moss", "#3f5222", rough=0.85, double=True)
    R.mat("linen", "#e2dcc8", rough=0.8, double=True)
    R.mat("bark", "#4a3220", rough=0.7)
    R.mat("bone", "#e2d8bc", rough=0.5)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffd890", rough=0.3, emit="#ffb03a", strength=1.0)
    R.hair(None, "#8c8780")

    # the gown to the wrists, wide sleeves, the long skirt in folds to the floor
    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "forest", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "deep", offset=0.004)
    R.boots("deep", top=z["ankle"] + 0.06)
    P.toes(R, "deep")
    for n in "lr":
        P.sleeve(R, n, "forest", t0=0.45, t1=0.98, r0=0.012, r1=0.075, rim="gold", rim_r=0.006, seg=16, n=4)
    hem = z["ankle"] + 0.012
    P.skirt(R, "forest", hem, flare=1.78, depth=1.12, folds=10, amp=0.032, trim="gold", trim_h=0.028, seg=56)
    how = R.hang_w(z["waist"], hem)
    R.band("bark", z["waist"], height=0.05, grow=1.13, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    g.ellipsoid("gold", Vector((0, cw.y - ryw * 1.18, z["waist"])), (0.03, 0.012, 0.034), seg=(12, 8))
    for dx, ln in ((-0.03, 0.3), (0.025, 0.24)):
        p0 = Vector((dx, cw.y - ryw * 1.2, z["waist"] - 0.02))
        g.tube("bark", [p0, p0 + Vector((dx * 0.3, -0.02, -ln * 0.5)), p0 + Vector((dx * 0.5, -0.03, -ln))], 0.012, seg=6)
        g.ellipsoid("gold", p0 + Vector((dx * 0.5, -0.03, -ln - 0.012)), (0.014, 0.014, 0.02), seg=(8, 6))

    # the moss mantle on the shoulders and its fringe of moss cords
    R.fitted("Mantle", ["spine_03", "clavicle", "upperarm"], "moss", offset=0.02, above=z["chest"] - 0.05, keep_skin=True,
             where=lambda p: abs(p.x) < R.bone("upperarm_l").x + 0.09)
    fr = R.piece("near")
    for k in range(26):
        a = -2.4 + 4.8 * k / 25
        if abs(a) < 0.35:
            continue
        p, out = P.on_trunk(R, z["chest"] - 0.045, a, off=0.022)
        ln = 0.07 + 0.03 * ((k * 5) % 3)
        fr.tube("moss", [p, p + out * 0.01 + Vector((0, 0, -ln))], [0.011, 0.004], seg=5)
    # the amber stone at her throat, in gold
    fc, foot, top = P.collar(R, "moss", height=0.045, grow=1.15, flare=0.05)
    fc.torus("gold", foot + Vector((0, -0.01, -0.02)), 0.026, 0.006, normal=(0, 1, 0), seg=(14, 5))
    fc.ellipsoid("glow", foot + Vector((0, -0.016, -0.02)), (0.022, 0.012, 0.026), seg=(12, 8))

    # the long cloak down her back, the deep pointed hood
    PA.cloak(R, "moss", hem=z["ankle"] + 0.07, width=0.42, depth=0.82, spread=1.28, top_spread=1.7, lining="deep", trim="gold", nu=18, nv=12)
    PA.cowl(R, "moss", grow=1.06, low=0.08, high=0.0)
    PA.hood(R, "moss", lining="deep", edge="gold", grow=1.42, open=0.46, tilt=0.3, peak=0.16, edge_r=0.008)
    # a linen wimple round her face under the hood
    PA.hood(R, "linen", grow=1.16, open=0.3, tilt=0.42, shape=(1.0, 1.02, 1.06), shift=(0, 0.015, -0.01), nu=24, nv=10)

    # the great horn in the left hand: the mouthpiece below the palm, the body curving out in front and up in a C, the bell
    # opening upward over her shoulder
    h = K.hand(R)
    f = h.f
    pts, rad = [], []
    n = 28
    for i in range(n + 1):
        t = i / n
        ang = PI * t
        pts.append(K.at(h, -0.3 + 0.58 * t, fwd=0.16 * math.sin(ang)) + h.side * 0.03 * math.sin(ang))
        rad.append(0.012 + 0.05 * t ** 1.8)
    tip = (pts[-1] - pts[-2]).normalized()
    for k in range(1, 4):
        pts.append(pts[n] + tip * 0.025 * k)
        rad.append(0.062 + 0.018 * k ** 1.3)
    P.hull(f, "bone", pts, rad, seg=18, side=h.side, caps=False)
    P.hull(f, "deep", [pts[-1] - tip * 0.05, pts[-1] - tip * 0.003], [0.05, rad[-1] - 0.006], seg=18, side=h.side, caps=True)
    f.torus("gold", pts[-1], rad[-1], 0.01, normal=tip, seg=(30, 6))
    for i in (6, 13, 20, 26):
        nn = (pts[i + 1] - pts[i - 1]).normalized()
        f.torus("gold", pts[i], rad[i] + 0.005, 0.007, normal=nn, seg=(18, 5))
    f.ellipsoid("gold", pts[0] - (pts[1] - pts[0]).normalized() * 0.01, P.rr(R, 0.017), seg=(10, 8))
    return R
