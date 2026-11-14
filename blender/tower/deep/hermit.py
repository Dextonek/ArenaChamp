"""The Echo-Hermit (the Deep's keeper, who gives the main quest): blind for longer than anyone remembers, he finds the
way through the dark halls by the echoes of his staff. An old man, grey hair and a grey beard, his eyes bound
with a band of pale linen. A heavy violet mantle with a cowl lying round his shoulders, a long violet-black robe to the floor
with a silver hem, a cord belt. In the LEFT hand a tall staff whose head is a silver tuning fork, a crystal at its base
that glows a cold mint: his one light (hold: torch). Signature shape: the blindfold, the cowl and the fork."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_hermit", sex="m", height=1.03, width=0.98, depth=0.98, skin="#c0a290")
    z = R.z
    R.mat("slate", "#231d30", rough=0.72, double=True)
    R.mat("violet", "#3a2856", rough=0.7, double=True)
    R.mat("dark", "#15141c", rough=0.8, double=True)
    R.mat("linen", "#ddd6c4", rough=0.8, double=True)
    R.mat("silver", "#c8ccd4", rough=0.28, metal=0.9, double=True)
    R.mat("wood", "#2a2230", rough=0.6)
    R.mat("glow", "#d8fff0", rough=0.25, emit="#60f0c0", strength=1.0)
    P.hair(R, "Hair_SimpleParted", "#a8acb4", beard="Hair_Beard")

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "slate", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "dark", offset=0.004)
    R.boots("dark", top=z["ankle"] + 0.05)
    P.toes(R, "dark")
    for n in "lr":
        P.sleeve(R, n, "slate", t0=0.4, t1=0.98, r0=0.014, r1=0.07, rim="silver", rim_r=0.006, seg=16, n=4)
    hem = z["ankle"] + 0.012
    P.skirt(R, "slate", hem, flare=1.6, depth=1.12, folds=9, amp=0.026, trim="silver", trim_h=0.022, seg=52)
    how = R.hang_w(z["waist"], hem)
    R.band("linen", z["waist"], height=0.03, grow=1.13, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for dx, ln in ((0.07, 0.4), (0.1, 0.33)):
        p0 = Vector((dx, cw.y - ryw * 1.1, z["waist"] - 0.01))
        g.tube("linen", [p0, p0 + Vector((0.01, -0.03, -ln))], 0.008, seg=6)
        g.ellipsoid("silver", p0 + Vector((0.01, -0.03, -ln - 0.012)), (0.012, 0.012, 0.018), seg=(8, 6))

    # the violet mantle and the cowl round his shoulders
    PA.cloak(R, "violet", hem=z["hip"] - 0.16, width=0.4, depth=0.85, spread=1.7, top_spread=2.3, lining="dark", trim="silver", nu=18, nv=10)
    PA.cowl(R, "violet", grow=1.22, low=0.1, high=-0.01)
    nk = R.piece("spine_03")
    cn, rxn, ryn = R.ring(z["neck"] - 0.03, dz=0.02)
    pts = [Vector((rxn * 1.9 * math.sin(2 * PI * i / 32), R.bone("neck_01").y - ryn * 2.0 * math.cos(2 * PI * i / 32) + 0.02, z["neck"] - 0.04)) for i in range(33)]
    nk.tube("violet", pts, 0.035, seg=10, caps=False)

    # the blindfold, its ends down the back of his head
    hd = P.head(R)
    hp = R.piece("Head")
    ez = hd.eye + 0.005
    band = [Vector((hd.rx * 1.0 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.04 * math.cos(2 * PI * i / 36) - 0.004 * max(0.0, math.cos(2 * PI * i / 36)), ez)) for i in range(37)]
    hp.tube("linen", band, 0.013, seg=8, caps=False)
    back = Vector((0, hd.y1 + 0.01, ez))
    for s in (1, -1):
        hp.tube("linen", [back, back + Vector((0.03 * s, 0.03, -0.07)), back + Vector((0.04 * s, 0.035, -0.15))], [0.016, 0.014, 0.012], seg=6, squash=((0, 1, 0), 0.4))

    # the tuning-fork staff
    h = K.hand(R)
    top = K.pole(h, "wood", back=1.27, front=0.62, r=0.015, butt="silver", rings=(-0.8, 0.3), ring_key="silver")
    hf = h.f
    hf.ellipsoid("silver", top, P.rr(R, 0.026), seg=(12, 8))
    hf.ellipsoid("glow", top + h.d * 0.035 * h.s, P.rr(R, 0.03), seg=(12, 8))
    fork = top + h.d * 0.06 * h.s
    for s in (1, -1):
        hf.tube("silver", [fork, fork + h.side * 0.05 * s + h.d * 0.04 * h.s, fork + h.side * 0.055 * s + h.d * 0.24 * h.s], [0.012, 0.013, 0.011], seg=8)
        hf.ellipsoid("silver", fork + h.side * 0.055 * s + h.d * 0.245 * h.s, P.rr(R, 0.012), seg=(8, 6))
    return R
