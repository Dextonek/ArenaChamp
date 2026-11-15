"""The Last Marshal (the War's first ruler, a boss drawn about 2.3 to 2.5 times a hero's size: the Last Marshal, the Iron
Marshal, the Banner Knight): the guard of both banners, who commands both armies and serves neither. Built as a giant:
broad, deep, a smaller head, big hands. Blackened steel plate with gold edges and gold rivets, broad layered pauldrons; a
surcoat to the shins split down the middle, crimson on his right and azure on his left, a gold star where they meet; a
long white cloak; an open helm with a gold crown-band and a white crest, his grey-bearded face showing. A greatsword in
the RIGHT hand, its blade long and bright, a gold cross-guard, a white gem in the pommel: his one light. Signature shape:
the split surcoat and the greatsword."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("war_marshal", sex="m", height=1.04, width=1.32, depth=1.28, head=0.84, skin="#c8a088")
    z = R.z
    R.mat("plate", "#444852", rough=0.48, metal=0.6, double=True)
    R.mat("crimson", "#8c1e22", rough=0.62, double=True)
    R.mat("azure", "#1e3c8c", rough=0.62, double=True)
    R.mat("white", "#3a3c44", rough=0.75, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("steel", "#c8ccd4", rough=0.22, metal=0.9)
    R.mat("glow", "#ffffff", rough=0.2, emit="#e8f0ff", strength=1.3)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_SimpleParted", "#8c8a88", beard="Hair_Beard")

    R.fitted("Plate", ["spine", "clavicle", "upperarm", "lowerarm"], "plate", offset=0.014)
    R.fitted("Legs", ["thigh", "calf"], "plate", offset=0.01)
    R.boots("plate", top=z["ankle"] + 0.12, toe="gold", offset=0.014)
    P.gloves(R, "plate")
    R.cuffs("gold", at=(0.12, 0.9), offset=0.012, thick=0.008)
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        for k in range(3):
            c = sh + Vector((0.04 * s + 0.03 * k * s, 0, 0.06 - 0.035 * k))
            sp.ellipsoid("plate", c, (0.13 - 0.015 * k, 0.11 - 0.01 * k, 0.05), seg=(14, 8))
            sp.torus("gold", c + Vector((0, 0, -0.02)), 0.125 - 0.015 * k, 0.007, normal=(0.4 * s, 0, 1), seg=(24, 6))
    # the split surcoat: crimson on his right, azure on his left
    hem = z["knee"] - 0.18
    R.fitted("SurR", lambda i: R.dom[i].startswith(("spine", "pelvis")) and R.world[i].z > z["waist"] - 0.05 and -0.17 < R.world[i].x <= 0.0, "crimson", offset=0.024, keep_skin=True)
    R.fitted("SurL", lambda i: R.dom[i].startswith(("spine", "pelvis")) and R.world[i].z > z["waist"] - 0.05 and 0.0 < R.world[i].x < 0.17, "azure", offset=0.024, keep_skin=True)
    f, rings = P.skirt(R, "azure", hem, flare=1.5, depth=1.14, folds=5, amp=0.016, seg=48, arc=(0.06, PI - 0.06), grow=1.05)
    P.cloth(f, "crimson", rings, arc=(PI + 0.06, 2 * PI - 0.06), seg=24, rows=10, folds=3, amp=0.016)
    cc, rxc, ryc = R.ring(z["chest"])
    star = Vector((0, cc.y - ryc * 1.2 - 0.02, z["chest"] - 0.02))
    R.piece("spine_02").star("gold", star, 0.07, 0.03, thick=0.012, points=8, normal=(0, -1, 0))
    how = R.hang_w(z["waist"], hem)
    R.band("gold", z["waist"] - 0.01, height=0.06, grow=1.18, how=how)
    PA.cloak(R, "white", hem=z["ankle"] + 0.04, width=0.48, depth=0.85, spread=1.3, top_spread=1.7, trim="gold", nu=18, nv=12)

    # the open helm with its crown-band and white crest
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "plate", h.c + Vector((0, 0.01, 0.02)), (h.rx * 1.16, h.ry * 1.16, h.rz * 1.14), lambda a: 0.15 if abs(math.sin(a / 2)) < 0.4 else -0.55, seg=28, rows=8, rim="gold", rim_r=0.008)
    zc = h.c.z + h.rz * 0.45
    for k in range(8):
        a = -PI + 2 * PI * k / 8
        base = Vector((h.rx * 1.17 * math.sin(a), h.c.y + 0.01 - h.ry * 1.17 * math.cos(a), zc))
        hp.tube("gold", [base, base + Vector((0, 0, 0.05))], [0.012, 0.002], seg=5)
    ring = [Vector((h.rx * 1.18 * math.sin(a), h.c.y + 0.01 - h.ry * 1.18 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("gold", ring, 0.01, seg=6)
    crest = PA.smooth([h.c + Vector((0, -h.ry * 0.6, h.rz * 1.2)), h.c + Vector((0, 0.02, h.rz * 1.45)), h.c + Vector((0, h.ry * 1.2, h.rz * 1.1)), h.c + Vector((0, h.ry * 1.7, h.rz * 0.0))], 4)
    hp.tube("white", crest, [0.02 + 0.02 * math.sin(PI * i / (len(crest) - 1)) for i in range(len(crest))], seg=8, squash=((1, 0, 0), 0.4))

    # the greatsword in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("plate", [o - d * 0.16 * s, o + d * 0.12 * s], 0.02, seg=8)
    f.ellipsoid("gold", o - d * 0.18 * s, P.rr(R, 0.03), seg=(10, 8))
    f.ellipsoid("glow", o - d * 0.195 * s, P.rr(R, 0.016), seg=(8, 6))
    f.tube("gold", [o + d * 0.13 * s - upv * 0.13, o + d * 0.14 * s, o + d * 0.13 * s + upv * 0.13], [0.012, 0.02, 0.012], seg=8)
    PB.blade(f, "steel", o + d * 0.14 * s, d, upv, 0.95 * s, 0.075, thick=0.02, tip=0.12)
    return R
