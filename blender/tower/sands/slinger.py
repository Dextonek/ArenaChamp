"""The Slinger (the Sands' ranged enemy, "throws stones from a distance"): a raider girl of the high dunes, light and
watchful. Sun-dark skin, black hair in a long braid; a saffron hood and shoulder cape over an indigo tunic to the knee,
split at the sides over sand trousers; a crossed leather strap with a stone pouch at the hip, bracers; soft boots. A
plaited sling in the RIGHT hand, its cradle holding a turquoise-glowing stone: her one light. Signature shape: the
saffron hood and cape and the long hanging sling."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("sands_slinger", sex="f", height=0.98, width=0.92, depth=0.92, head=1.0, skin="#a87656", eyes="#2a1e14")
    z = R.z
    R.mat("saffron", "#d89a2a", rough=0.66, double=True)
    R.mat("indigo", "#1e2350", rough=0.66, double=True)
    R.mat("sand", "#c8b088", rough=0.8, double=True)
    R.mat("leather", "#3a2618", rough=0.6, double=True)
    R.mat("turq", "#2a9a90", rough=0.55)
    R.mat("glow", "#a8fff0", rough=0.2, emit="#3fd4c8", strength=1.1)
    R.hair("Hair_Long", "#140e0a", rough=0.55)

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "indigo", offset=0.008)
    R.fitted("Trousers", ["thigh", "calf"], "sand", offset=0.006)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.012, where=lambda p: True)
    R.boots("leather", top=z["ankle"] + 0.12)
    hem = z["knee"] - 0.02
    for a0, a1 in ((0.3, PI - 0.3), (PI + 0.3, 2 * PI - 0.3)):
        P.skirt(R, "indigo", hem, flare=1.3, depth=1.1, folds=4, amp=0.01, seg=24, arc=(a0, a1))
    how = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"], height=0.04, grow=1.13, how=how)
    PA.strap(R, "leather", width=0.04, lift=0.2, grow=1.1, high_side=1, out=0.016)
    cw, rxw, ryw = R.ring(z["hip"])
    pf = R.piece(how)
    pouch = Vector((-rxw * 1.15, cw.y - 0.02, z["hip"] - 0.02))
    pf.ellipsoid("leather", pouch, (0.045, 0.035, 0.055), seg=(12, 8))
    pf.ellipsoid("turq", pouch + Vector((0, -0.03, 0.03)), (0.012, 0.008, 0.012), seg=(8, 6))

    # the saffron hood and shoulder cape
    PA.cowl(R, "saffron", grow=1.12, low=0.1, high=0.03)
    PA.hood(R, "saffron", lining="indigo", grow=1.5, open=0.3, tilt=0.35, peak=0.1, edge="leather", edge_r=0.006)
    PA.cloak(R, "saffron", hem=z["waist"] - 0.02, width=0.3, depth=0.9, spread=1.5, top_spread=1.7, lining="indigo", nu=14, nv=8)

    # the sling in the right hand: two plaited cords hanging, the cradle with its stone
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.torus("leather", o + d * 0.02 * s, 0.022, 0.006, normal=d, seg=(12, 5))
    low = o - upv * 0.32 + d * 0.06 * s
    for sg in (1, -1):
        f.tube("sand", [o + d * 0.02 * s, o.lerp(low, 0.5) + side * 0.025 * sg, low + side * 0.035 * sg], 0.005, seg=5)
    f.ellipsoid("leather", low, (0.045, 0.03, 0.02), seg=(10, 6))
    f.ellipsoid("glow", low + upv * 0.012, P.rr(R, 0.024), seg=(10, 8))
    return R
