"""The Ferryman (the Deep's quest giver out by the black water): he poles the one boat across the lake under the
mountain, and brings back those who went too far down. A tall lean man, his deep hood up and his face in its shadow, a
long slate cloak to the shins lined in deep sea-green over a dark tunic, a wide belt with a silver clasp, tall wading boots. A
small lantern of silver hangs at his hip, its light a cold mint: his one light. In the LEFT hand a very long punt pole,
silver-shod at both ends (hold: torch). Signature shape: the hood and the long pole."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_ferry", sex="m", height=1.05, width=0.96, depth=0.97, skin="#a8907e")
    z = R.z
    R.mat("slate", "#2e3346", rough=0.7, double=True)
    R.mat("violet", "#1e3e3a", rough=0.7, double=True)
    R.mat("dark", "#17161d", rough=0.7, double=True)
    R.mat("leather", "#2a2024", rough=0.5, double=True)
    R.mat("wood", "#3a2e26", rough=0.6)
    R.mat("silver", "#c8ccd4", rough=0.28, metal=0.9, double=True)
    R.mat("glass", "#bfe8de", rough=0.15)
    R.mat("glow", "#d8fff0", rough=0.25, emit="#60f0c0", strength=1.0)
    P.hair(R, "Hair_SimpleParted", "#3a3436", beard="Hair_Beard")

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "dark", offset=0.008)
    R.cuffs("silver", at=(0.9,), offset=0.01, thick=0.006)
    R.fitted("Legs", ["thigh", "calf", "pelvis"], "dark", offset=0.004)
    R.boots("leather", top=z["knee"] + 0.1, cuff="silver")
    P.toes(R, "leather")
    P.skirt(R, "dark", z["knee"] + 0.02, flare=1.3, depth=1.1, folds=6, amp=0.014, seg=44)
    R.band("leather", z["waist"], height=0.07, grow=1.16)
    cw, rxw, ryw = R.ring(z["waist"])
    pg = R.piece("pelvis")
    pg.ellipsoid("silver", Vector((0, cw.y - ryw * 1.22, z["waist"])), (0.032, 0.012, 0.03), seg=(12, 8))

    # the long cloak, hood up
    PA.cloak(R, "slate", hem=z["knee"] - 0.22, width=0.42, depth=0.84, spread=1.55, top_spread=2.1, lining="violet", trim="silver", nu=18, nv=12)
    PA.cowl(R, "slate", grow=1.08, low=0.085, high=0.0)
    PA.hood(R, "slate", lining="dark", edge="silver", grow=1.46, open=0.5, tilt=0.38, peak=0.1, edge_r=0.007)

    # the lantern at his right hip
    p = Vector((-rxw * 1.2, cw.y - 0.02, z["waist"] - 0.04))
    pg.tube("silver", [p, p + Vector((0, 0, -0.04))], 0.004, seg=5)
    P.hull(pg, "silver", [p + Vector((0, 0, -0.04)), p + Vector((0, 0, -0.06))], [0.012, 0.035], seg=12)
    P.hull(pg, "glass", [p + Vector((0, 0, -0.06)), p + Vector((0, 0, -0.1)), p + Vector((0, 0, -0.14))], [0.03, 0.036, 0.03], seg=12)
    pg.ellipsoid("glow", p + Vector((0, 0, -0.1)), (0.02, 0.02, 0.026), seg=(10, 8))
    P.hull(pg, "silver", [p + Vector((0, 0, -0.14)), p + Vector((0, 0, -0.16))], [0.036, 0.02], seg=12)

    # the punt pole, longer than he is tall
    h = K.hand(R)
    top = K.pole(h, "wood", back=1.28, front=1.15, r=0.017, butt="silver", rings=(-1.0, 0.9), ring_key="silver")
    P.hull(h.f, "silver", [top, top + h.d * 0.05 * h.s, top + h.d * 0.07 * h.s], [0.019, 0.016, 0.004], seg=10, side=h.fwd)
    return R
