"""The Lamp-Bearer (the Sea's quest giver out in the village): she keeps the shore lamps that tell the boats where the
land begins. A young woman, dark hair, her hood up: a sea-green hooded mantle to the hips lined in wine, a gold edge round
her face; a long gown of sea-foam cream with a sea-green hem band, a wine cord at the waist, a small gold oil flask at her
hip. In the LEFT hand, held up, a hand lantern of gold and sea glass whose light is the cold sea-glass blue of the
harbour: her one light (hold: torch). Signature shape: the hood and the lantern held high."""
from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("sea_lamp", sex="f", height=0.97, width=0.94, depth=0.95, skin="#c99a7c")
    z = R.z
    R.mat("foam", "#cfd8cc", rough=0.75, double=True)
    R.mat("sea", "#1f4c48", rough=0.66, double=True)
    R.mat("wine", "#6a1c2c", rough=0.62, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.45)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glass", "#bfe6ea", rough=0.15)
    R.mat("glow", "#e0faff", rough=0.3, emit="#7fdcf5", strength=1.0)
    R.hair("Hair_Long", "#2a1a14", rough=0.5)

    # the long cream gown, its sleeves to the wrist, a sea-green band at the hem
    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "foam", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "sea", offset=0.004)
    R.boots("lacquer", top=z["ankle"] + 0.05)
    P.toes(R, "lacquer")
    R.cuffs("sea", at=(0.92,), offset=0.01, thick=0.01)
    hem = z["ankle"] + 0.015
    P.skirt(R, "foam", hem, flare=1.6, depth=1.12, folds=9, amp=0.026, trim="sea", trim_h=0.09, seg=52)
    how = R.hang_w(z["waist"], hem)
    R.band("wine", z["waist"], height=0.03, grow=1.13, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for dx, ln in ((-0.02, 0.3), (0.02, 0.24)):
        p0 = Vector((dx - 0.06, cw.y - ryw * 1.15, z["waist"] - 0.01))
        g.tube("wine", [p0, p0 + Vector((dx * 0.4, -0.02, -ln))], 0.007, seg=6)
        g.ellipsoid("gold", p0 + Vector((dx * 0.4, -0.02, -ln - 0.01)), (0.012, 0.012, 0.018), seg=(8, 6))
    # the little oil flask at her right hip
    fl = Vector((-rxw * 1.15, cw.y, z["waist"] - 0.1))
    P.hull(g, "gold", [fl, fl + Vector((0, 0, 0.05)), fl + Vector((0, 0, 0.09)), fl + Vector((0, 0, 0.11))], [0.035, 0.04, 0.014, 0.012], seg=12)

    # the hooded mantle to the hips, lined in wine
    PA.cloak(R, "sea", hem=z["knee"] - 0.02, width=0.4, depth=0.85, spread=1.45, top_spread=2.1, lining="wine", trim="gold", nu=18, nv=10)
    P.collar(R, "sea", height=0.04, grow=1.25, flare=0.2, arc=(0.45, 2 * PI - 0.45))
    PA.cowl(R, "sea", grow=1.08, low=0.08, high=0.0)
    PA.hood(R, "sea", lining="wine", edge="gold", grow=1.46, open=0.44, tilt=0.26, peak=0.1, edge_r=0.008)

    # the hand lantern, held up by its ring
    h = K.hand(R)
    h.f.torus("gold", K.at(h, 0.015), 0.028, 0.006, normal=h.side, seg=(14, 5))
    K.lantern(h, K.at(h, 0.0), "gold", "glass", "glow", size=1.35, chain=0.03)
    return R
