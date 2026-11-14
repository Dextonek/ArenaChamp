"""The Lurker (the Deep's melee enemy, "waits in the dark and leaps"): a hunter of the lightless halls who has not seen
the sun in a lifetime. Lean and long-armed. Chalk-grey skin, bald, large pale eyes that hold a cold mint light: his one
glow. Close wrappings of slate-grey cloth bound with dark straps over the chest, the forearms and the shins, a short kilt
of layered strips, bare feet; a silver ring in each ear. On both hands a pair of long curved bone claws strapped over the
knuckles. Signature shape: the bald pale head and the claws."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000}


def build():
    R = Real("deep_lurker", sex="m", height=1.0, width=0.9, depth=0.9, head=0.96, skin="#a8a8b0", eyes="#d8fff0")
    z = R.z
    R.mat("slate", "#3a3c48", rough=0.75, double=True)
    R.mat("strap", "#1a1820", rough=0.6, double=True)
    R.mat("bone", "#e2dcc6", rough=0.5)
    R.mat("silver", "#c8ccd8", rough=0.3, metal=0.85)
    R.mat("violet", "#3a2a52", rough=0.7, double=True)
    R.mat("glow", "#e6fff6", rough=0.2, emit="#5affd2", strength=1.0)
    R.bald()
    PB.arms(R, length=1.1, thick_y=0.95, thick_z=0.95)
    z = R.z

    R.fitted("Wraps", ["spine", "pelvis", "clavicle"], "slate", offset=0.006)
    R.fitted("Sleeves", ["lowerarm"], "slate", offset=0.008)
    R.fitted("Shins", lambda i: R.dom[i].startswith("calf") and z["ankle"] + 0.04 < R.world[i].z < z["knee"] - 0.02, "slate", offset=0.006)
    for zz in (z["waist"] + 0.05, z["chest"] - 0.02, z["chest"] + 0.06):
        R.band("strap", zz, height=0.018, grow=1.06, how="near")
    R.cuffs("strap", at=(0.2, 0.55, 0.9), offset=0.01, thick=0.006)
    for n in "lr":
        for t in (0.3, 0.7):
            c, r = R.leg_r(n, z["ankle"] + 0.04 + t * (z["knee"] - z["ankle"] - 0.06))
            R.piece(f"calf_{n}").torus("strap", c, r + 0.009, 0.005, seg=(14, 5))
    hem = z["knee"] + 0.12
    f, rings = P.skirt(R, "violet", hem, flare=1.25, depth=1.1, folds=0, amp=0.0, seg=36)
    for k in range(12):
        P.seam(f, "strap", rings, 2 * PI * k / 12, r=0.005, off=0.006)
    R.band("strap", z["waist"] - 0.01, height=0.04, grow=1.12, how=R.hang_w(z["waist"], hem))

    # the pale eyes, the silver earrings
    h = P.head(R)
    hp = R.piece("Head")
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.03, h.eye + 0.002)), (0.016, 0.007, 0.01), seg=(10, 6))
        hp.torus("silver", h.ear + Vector((0.01, 0, -0.03)) if s > 0 else Vector((-h.ear.x - 0.01, h.ear.y, h.ear.z - 0.03)), 0.012, 0.003, normal=(1, 0, 0), seg=(12, 5))

    # the bone claws on both hands: three long curved blades over the knuckles, strapped at the wrist
    for side in "lr":
        f, o, d, upv = R.held(side)
        sd = upv.cross(d).normalized()
        c, r = R.arm_r(side, 0.94)
        R.piece(f"lowerarm_{side}").torus("strap", c, r + 0.012, 0.009, normal=(1, 0, 0), seg=(14, 5))
        for k in (-1, 0, 1):
            b = o + sd * 0.022 * k + upv * 0.03
            pts = [b, b + d * 0.16 + upv * 0.015, b + d * 0.32 - upv * 0.02, b + d * 0.44 - upv * 0.1]
            f.tube("bone", PA.smooth(pts, 3), [0.018, 0.017, 0.015, 0.013, 0.011, 0.009, 0.007, 0.005, 0.003, 0.001], seg=6, squash=(tuple(sd), 0.35))
        f.tube("strap", [o + upv * 0.03 - sd * 0.035, o + upv * 0.03 + sd * 0.035], 0.012, seg=6)
    return R
