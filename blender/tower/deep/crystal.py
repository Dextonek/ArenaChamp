"""The Crystal-Seller (one of the Deep's two traders): she cuts the Deep's crystals and sells light by the facet. A
slim woman with short silver hair, a fitted violet bodice with silver edges over a slate blouse, a long slate skirt with
a violet overskirt open at the front, a leather apron of tools at her hip. On her back a tall rack of uncut crystals,
pale lavender, rising over her shoulders. In the LEFT hand, held up, a cut crystal that glows lavender-white: her one
light (hold: torch). Signature shape: the crystals over her shoulders."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_crystal", sex="f", height=0.98, width=0.95, depth=0.96, skin="#c8a490")
    z = R.z
    R.mat("slate", "#353a50", rough=0.72, double=True)
    R.mat("violet", "#4a3270", rough=0.62, double=True)
    R.mat("leather", "#2a2024", rough=0.5, double=True)
    R.mat("silver", "#c8ccd4", rough=0.28, metal=0.9, double=True)
    R.mat("crystal", "#c8b8f0", rough=0.18)
    R.mat("glow", "#f4eeff", rough=0.2, emit="#b89aff", strength=1.0)
    R.hair("Hair_BuzzedFemale", "#d4d6dc", rough=0.5)

    R.fitted("Blouse", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "slate", offset=0.008)
    R.cuffs("silver", at=(0.9,), offset=0.01, thick=0.006)
    R.fitted("Bodice", lambda i: R.dom[i].startswith(("spine", "pelvis")) and z["waist"] - 0.08 < R.world[i].z < z["chest"] + 0.04, "violet", offset=0.016)
    up = R.piece(P.trunk_w(R))
    for zz in (z["chest"] + 0.035, z["waist"] - 0.075):
        P.band_on(R, up, "silver", [(zz, -1.7), (zz + 0.005, 0.0), (zz, 1.7)], 0.008, thick=0.005, off=0.02)
    P.collar(R, "violet", height=0.07, grow=1.08, flare=0.25, rim="silver", rim_r=0.005, arc=(0.6, 2 * PI - 0.6))
    R.fitted("Under", ["thigh", "calf"], "slate", offset=0.004)
    R.boots("leather", top=z["ankle"] + 0.06)
    P.toes(R, "leather")
    hem = z["ankle"] + 0.02
    P.skirt(R, "slate", hem, flare=1.55, depth=1.12, folds=9, amp=0.024, trim="silver", trim_h=0.02, seg=52)
    P.skirt(R, "violet", z["ankle"] + 0.1, flare=1.6, depth=1.13, arc=(0.7, 2 * PI - 0.7), folds=7, amp=0.024, trim="silver", trim_h=0.018, grow=1.05, seg=44)
    R.band("leather", z["waist"] - 0.03, height=0.04, grow=1.17)
    cw, rxw, ryw = R.ring(z["waist"])
    pg = R.piece("pelvis")
    tc = Vector((rxw * 0.9, cw.y - ryw * 0.95, z["waist"] - 0.1))
    P.box(pg, "leather", tc, (0.05, 0.02, 0.07))
    for k in range(3):
        pg.tube("silver", [tc + Vector((-0.03 + 0.03 * k, -0.02, 0.05)), tc + Vector((-0.03 + 0.03 * k, -0.025, 0.11))], 0.004, seg=5)

    # the rack of crystals on her back
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    base = Vector((0, cc.y + ryc + 0.1, z["waist"] - 0.02))
    P.box(bf, "leather", base, (0.15, 0.07, 0.035))
    bf.tube("silver", [base + Vector((-0.15, -0.07, 0.035)), base + Vector((0.15, -0.07, 0.035))], 0.006, seg=5)
    for k, (dx, dy, ht, lean) in enumerate(((-0.1, 0.0, 0.5, -0.25), (-0.03, 0.02, 0.68, -0.05), (0.05, -0.01, 0.6, 0.12), (0.11, 0.02, 0.42, 0.3), (0.0, -0.04, 0.36, 0.0))):
        b = base + Vector((dx, dy, 0.02))
        PB.shard(bf, "crystal", b + Vector((lean * ht * 0.4, 0.02, ht)), b, 0.045 if k != 1 else 0.055, n=6, mid=0.35)
    K.shoulder_straps(R, bf, "leather", cc.y + ryc + 0.03)

    # the cut crystal, held up
    h = K.hand(R)
    h.f.ellipsoid("silver", K.at(h, 0.01), P.rr(R, 0.024), seg=(10, 8))
    PB.shard(h.f, "glow", K.at(h, 0.2), K.at(h, 0.02), 0.045, n=6, mid=0.4)
    return R
