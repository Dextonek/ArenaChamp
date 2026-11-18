"""The Star-Reader (the Sands' keeper, who gives the main quest): she reads in the night sky which way the storms will
walk, and sends climbers by the roads they leave open. A tall older woman. A deep indigo veil over her head from a gold
circlet and down her back to the knees, a night-indigo robe to the floor with a saffron sash and a gold hem, wide
sleeves with saffron cuffs, a cream underskirt showing at the front. In the LEFT hand a tall gold staff whose head is a
crescent moon cradling a star that glows: her one light (hold: torch). Signature shape: the veil and the crescent."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("sands_seer", sex="f", height=1.05, width=0.94, depth=0.95, skin="#a87452")
    z = R.z
    R.mat("indigo", "#1e2350", rough=0.66, double=True)
    R.mat("night", "#12142e", rough=0.75, double=True)
    R.mat("saffron", "#d0901e", rough=0.6, double=True)
    R.mat("cream", "#cdbf9c", rough=0.75, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#fff4d0", rough=0.3, emit="#ffd070", strength=1.0)
    R.hair(None, "#cfcac2")
    R.mat("hair", "#cfcac2", rough=0.6)
    PA.hair_cap(R, "hair", grow=1.05)

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "indigo", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "night", offset=0.004)
    R.boots("night", top=z["ankle"] + 0.05)
    P.toes(R, "night")
    for n in "lr":
        P.sleeve(R, n, "indigo", t0=0.4, t1=0.98, r0=0.012, r1=0.08, rim="saffron", rim_r=0.009, seg=16, n=4)
    hem = z["ankle"] + 0.012
    P.skirt(R, "cream", hem + 0.005, flare=1.6, depth=1.1, folds=8, amp=0.02, seg=48)
    P.skirt(R, "indigo", hem, flare=1.72, depth=1.12, arc=(0.38, 2 * PI - 0.38), folds=10, amp=0.03, trim="gold", trim_h=0.028, grow=1.04, seg=56)
    how = R.hang_w(z["waist"], hem)
    R.band("saffron", z["waist"], height=0.075, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for dx, ln in ((0.05, 0.42), (0.09, 0.34)):
        p0 = Vector((dx, cw.y - ryw * 1.12, z["waist"] - 0.02))
        g.tube("saffron", [p0, p0 + Vector((0.01, -0.03, -ln * 0.5)), p0 + Vector((0.015, -0.045, -ln))], 0.026, seg=8, squash=((0, 1, 0), 0.3))
        g.tube("gold", [p0 + Vector((0.015, -0.045, -ln - 0.004)), p0 + Vector((0.015, -0.045, -ln + 0.012))], 0.022, seg=8, squash=((0, 1, 0), 0.35))
    P.collar(R, "cream", height=0.05, grow=1.05, flare=0.05)

    # the veil from the circlet down her back, the circlet with a small gold star on the brow
    K.veil(R, "indigo", lining="night", edge="gold", hem=z["knee"] - 0.12, width=0.34, spread=1.2, grow=1.42, open=0.46)
    hd = P.head(R)
    hp = R.piece("Head")
    cz = hd.brow + 0.04
    pts = [Vector((hd.rx * 1.12 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.16 * math.cos(2 * PI * i / 36), cz + 0.012 * math.cos(2 * PI * i / 36))) for i in range(37)]
    hp.tube("gold", pts, 0.006, seg=6, caps=False)
    P.star(hp, "gold", pts[0] + Vector((0, -0.006, 0.018)), (0, 0, 1), (0, -1, 0), 0.022, 0.009, thick=0.006)

    # the crescent staff
    h = K.hand(R)
    top = K.pole(h, "gold", back=1.27, front=0.66, r=0.013, butt="gold", rings=(-0.9, -0.3, 0.25), ring_key="saffron")
    c = top + h.d * 0.11 * h.s
    arc = []
    for i in range(21):
        a = -PI * 0.85 + 1.7 * PI * i / 20
        arc.append(c + h.side * 0.1 * math.sin(a) - h.d * 0.1 * math.cos(a) * h.s)
    h.f.tube("gold", arc, [0.004 + 0.016 * math.sin(PI * i / 20) for i in range(21)], seg=8)
    h.f.tube("gold", [top, arc[10]], 0.013, seg=8)
    P.star(h.f, "glow", c + h.d * 0.015 * h.s, h.d, h.fwd, 0.05, 0.021, thick=0.016)
    return R
