"""The Candle-Crowned (the Deep's quest giver at the camp): she keeps the last candles of the Deep burning, and wears
them, so that wherever she walks there is a little light. A tall woman in a black habit to the floor with a gold cord, a
pale linen wimple round her face and a short pale veil, and on her head a gold crown of five tall cream candles whose
small flames are her one light. A scapular of deep violet with a gold hem down her front. In the LEFT hand a long gold
candle-snuffer, its cone at the top (hold: torch). Signature shape: the crown of candles."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_candle", sex="f", height=1.02, width=0.93, depth=0.95, skin="#d0aa94")
    z = R.z
    R.mat("black", "#1a1820", rough=0.6, double=True)
    R.mat("violet", "#3a2856", rough=0.65, double=True)
    R.mat("linen", "#e2dccc", rough=0.8, double=True)
    R.mat("wax", "#efe6cc", rough=0.5)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#fff0c8", rough=0.3, emit="#ffc860", strength=1.0)
    R.hair(None, "#6a5a50")

    R.fitted("Habit", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "black", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "black", offset=0.004)
    R.boots("black", top=z["ankle"] + 0.05)
    P.toes(R, "black")
    for n in "lr":
        P.sleeve(R, n, "black", t0=0.35, t1=0.98, r0=0.012, r1=0.08, rim="gold", rim_r=0.005, seg=16, n=4)
    hem = z["ankle"] + 0.012
    f, rings = P.skirt(R, "black", hem, flare=1.62, depth=1.12, folds=10, amp=0.026, trim="gold", trim_h=0.02, seg=56)
    # the scapular down the front, over the shoulders
    up = R.piece(P.trunk_w(R, hem))
    P.wrap(R, up, "violet", z["waist"] - 0.02, z["neck"] - 0.03, -0.42, 0.42, off=0.016)
    sfn = PA.skirt_fn(R, hem, flare=1.62, depth=1.12)
    PA.panel(R, f, "violet", sfn, -0.32, 0.32, z["waist"] - 0.02, hem + 0.06, out=0.012, nu=6, nv=8)
    for s in (1, -1):
        PB_pts = [sfn(0.32 * s, z["waist"] - 0.02 - (z["waist"] - hem - 0.08) * k / 8, 0.016) for k in range(9)]
        f.tube("gold", PB_pts, 0.005, seg=5)
    R.band("gold", z["waist"], height=0.02, grow=1.16)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(R.hang_w(z["waist"], hem))
    p0 = Vector((-rxw * 0.8, cw.y - ryw * 0.9, z["waist"] - 0.01))
    g.tube("gold", [p0, p0 + Vector((-0.01, -0.02, -0.45))], 0.007, seg=6)
    g.ellipsoid("gold", p0 + Vector((-0.01, -0.02, -0.46)), (0.014, 0.014, 0.022), seg=(8, 6))

    # the wimple and the short veil
    PA.cowl(R, "linen", grow=1.02, low=0.08, high=0.0)
    PA.hood(R, "linen", grow=1.22, open=0.36, tilt=0.4, shape=(1.0, 1.04, 1.06), shift=(0, 0.015, -0.01), nu=26, nv=10)
    PA.cloak(R, "linen", hem=z["chest"] - 0.06, width=0.3, depth=0.8, spread=1.3, top_spread=1.6, nu=14, nv=6)

    # the crown of candles
    hd = P.head(R)
    hp = R.piece("Head")
    cz = hd.top - 0.01
    ring = [Vector((hd.rx * 1.05 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.1 * math.cos(2 * PI * i / 36), cz - 0.04 + 0.02 * math.cos(2 * PI * i / 36))) for i in range(37)]
    hp.tube("gold", ring, 0.009, seg=6, caps=False)
    for k in range(5):
        a = -1.6 + 3.2 * k / 4
        p = Vector((hd.rx * 1.0 * math.sin(a), hd.c.y - hd.ry * 1.05 * math.cos(a), cz - 0.035 + 0.02 * math.cos(a)))
        ht = 0.1 + 0.03 * (1 - abs(k - 2) / 2)
        hp.torus("gold", p, 0.02, 0.006, seg=(12, 5))
        hp.tube("wax", [p, p + Vector((0, 0, ht))], 0.014, seg=10)
        hp.ellipsoid("glow", p + Vector((0, 0, ht + 0.022)), (0.009, 0.009, 0.022), seg=(8, 6))

    # the snuffer
    h = K.hand(R)
    top = K.pole(h, "gold", back=1.0, front=0.6, r=0.009, butt="gold", rings=(0.1,))
    hf = h.f
    tip = top + h.fwd * 0.07 + h.d * 0.02 * h.s
    hf.tube("gold", [top, top + h.d * 0.04 * h.s, tip], 0.008, seg=6)
    P.hull(hf, "gold", [tip - h.d * 0.01 * h.s, tip - h.d * 0.07 * h.s], [0.008, 0.035], seg=14, side=h.fwd, caps=False)
    return R
